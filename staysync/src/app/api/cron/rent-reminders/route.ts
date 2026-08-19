import { NextResponse } from 'next/server';
import { sendRentReminderWithLink, resolveTenantRoomAndPendingDues } from '@/lib/whatsapp';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = today.toLocaleString('default', { month: 'long', year: 'numeric' });

    // 0. Fetch WhatsApp reminder global settings
    const settingsDoc = await adminDb.collection('system_settings').doc('whatsapp_reminders').get();
    const globalSettings = settingsDoc.exists ? settingsDoc.data() : null;
    const sendDueDay = globalSettings?.dueDayReminder ?? true;
    const overdueFirstDay = globalSettings?.overdueFirstReminderDays ?? 1;
    const overdueFrequency = globalSettings?.overdueReminderFrequencyDays ?? 3;

    // 1. Fetch pending payment bills from 'payments' collection
    const paymentsSnap = await adminDb.collection('payments')
      .where('status', '==', 'pending')
      .get();

    // 2. Fetch active and vacated tenants to map details
    const tenantsSnap = await adminDb.collection('tenants').get();

    const activeTenantsMap = new Map<string, any>();
    tenantsSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.status !== 'DELETED' && data.status !== 'ARCHIVED') {
        activeTenantsMap.set(doc.id, { id: doc.id, ...data });
        if (data.tenant_id) activeTenantsMap.set(data.tenant_id, { id: doc.id, ...data });
      }
    });

    const processedTenantsToday = new Set<string>();

    const tenantDuesMap = new Map<string, number>();
    paymentsSnap.docs.forEach(pdoc => {
      const data = pdoc.data();
      const tId = data.tenant_id || data.tenantId;
      if (tId) {
        tenantDuesMap.set(tId, (tenantDuesMap.get(tId) || 0) + Number(data.amount || 0));
      }
    });

    const reminderPromises: Promise<{ tenantName: string; phone: string; statusType: string; success: boolean }>[] = [];

    for (const pDoc of paymentsSnap.docs) {
      const payment = pDoc.data();
      const tenantId = payment.tenant_id || payment.tenantId;
      const tenant = activeTenantsMap.get(tenantId);

      if (!tenant || tenant.whatsappEnabled === false) continue;

      const isVacated = tenant.status === 'VACATED' || tenant.status === 'Vacated' || tenant.is_active === false;

      const tenantUniqueId = tenant.id || tenant.tenant_id;
      if (processedTenantsToday.has(tenantUniqueId)) continue; // avoid duplicate reminders on same day

      const phone = tenant.mobile || tenant.phone || tenant.phone_number || payment.tenant_phone;
      if (!phone) continue;

      // Determine due date
      let targetDay = 5;
      const moveInDateStr = tenant.move_in_date || payment.created_at;
      if (moveInDateStr) {
        const checkin = new Date(moveInDateStr);
        if (!isNaN(checkin.getTime())) targetDay = checkin.getDate();
      }

      // Target due date for current month
      const targetDueDate = new Date(today.getFullYear(), today.getMonth(), targetDay);
      targetDueDate.setHours(0, 0, 0, 0);

      const diffTime = today.getTime() - targetDueDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let statusType: 'STANDARD' | 'DUE_TODAY' | 'DUE_TOMORROW' | 'OVERDUE' = 'STANDARD';
      let overdueDays = 0;

      if (diffDays === 0) {
        if (!sendDueDay || isVacated) continue; // Vacated tenants ONLY receive reminders when OVERDUE
        statusType = 'DUE_TODAY';
      } else if (diffDays > 0) {
        // Enforce overdue reminder frequency
        if (diffDays === overdueFirstDay) {
          // It's the first reminder day, proceed
        } else if (diffDays > overdueFirstDay) {
          const daysSinceFirst = diffDays - overdueFirstDay;
          if (daysSinceFirst % overdueFrequency !== 0) {
            // Not a scheduled reminder day
            continue;
          }
        } else {
          // Overdue, but we haven't reached the first reminder day yet
          continue;
        }

        statusType = 'OVERDUE';
        overdueDays = diffDays;
      } else {
        // Not due yet today
        continue;
      }

      processedTenantsToday.add(tenantUniqueId);

      const promise = (async () => {
        const precalcDues = tenantDuesMap.get(tenantUniqueId) || 0;
        const roomInfo = await resolveTenantRoomAndPendingDues(tenantUniqueId, tenant, precalcDues);
        const dueDateFormatted = targetDueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

        const res = await sendRentReminderWithLink(
          phone,
          tenant.full_name || tenant.name || 'Resident',
          Number(payment.amount || tenant.rent_amount || 0),
          currentMonth,
          pDoc.id,
          roomInfo.hostelName,
          statusType,
          overdueDays,
          {
            tenantId: tenantUniqueId,
            triggeredBy: 'daily_8am_cron_reminders',
            roomNumber: roomInfo.roomNumber,
            dueDateStr: dueDateFormatted
          }
        );

        return {
          tenantName: tenant.full_name || tenant.name || 'Resident',
          phone,
          statusType,
          success: res.success
        };
      })();

      reminderPromises.push(promise);
    }

    const results = await Promise.all(reminderPromises);

    return NextResponse.json({
      success: true,
      processedCount: results.length,
      timestamp: new Date().toISOString(),
      details: results
    });
  } catch (error: any) {
    console.error('Cron job 8:00 AM error:', error);
    return NextResponse.json({ error: 'Failed to process reminders', message: error.message }, { status: 500 });
  }
}
