import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const targetDay = tomorrow.getDate();
    const currentMonth = tomorrow.toLocaleString('default', { month: 'long', year: 'numeric' });

    // 1. Fetch pending payments
    const paymentsSnap = await adminDb.collection('payments')
      .where('status', '==', 'pending')
      .get();

    // 2. Fetch active tenants
    const tenantsSnap = await adminDb.collection('tenants')
      .where('is_active', '==', true)
      .get();

    const activeTenantsMap = new Map<string, any>();
    tenantsSnap.docs.forEach(doc => {
      const d = doc.data();
      if (d.status !== 'DELETED' && d.status !== 'ARCHIVED' && d.status !== 'VACATED') {
        activeTenantsMap.set(doc.id, { id: doc.id, ...d });
        if (d.tenant_id) activeTenantsMap.set(d.tenant_id, { id: doc.id, ...d });
      }
    });

    // Group dues by owner_id
    const ownerDuesMap = new Map<string, Array<{ tenantName: string; roomNumber: string; amount: number; pgName: string }>>();

    for (const pDoc of paymentsSnap.docs) {
      const payment = pDoc.data();
      const tenantId = payment.tenant_id || payment.tenantId;
      const tenant = activeTenantsMap.get(tenantId);

      if (!tenant) continue;

      let tenantDueDay = 5;
      const moveInStr = tenant.move_in_date || payment.created_at;
      if (moveInStr) {
        const checkin = new Date(moveInStr);
        if (!isNaN(checkin.getTime())) tenantDueDay = checkin.getDate();
      }

      // Check if rent is due tomorrow
      if (tenantDueDay === targetDay) {
        const ownerId = payment.owner_id || tenant.owner_id;
        if (!ownerId) continue;

        if (!ownerDuesMap.has(ownerId)) {
          ownerDuesMap.set(ownerId, []);
        }

        ownerDuesMap.get(ownerId)!.push({
          tenantName: tenant.full_name || tenant.name || 'Resident',
          roomNumber: tenant.room_number || tenant.room || 'N/A',
          amount: Number(payment.amount || tenant.rent_amount || 0),
          pgName: payment.pg_name || tenant.pg_name || 'Hostel'
        });
      }
    }

    const summaryResults = [];

    // Create system notification for each PG Owner
    for (const [ownerId, duesList] of ownerDuesMap.entries()) {
      const totalAmount = duesList.reduce((sum, item) => sum + item.amount, 0);
      const tenantSummary = duesList.slice(0, 3).map(d => `${d.tenantName} (Room ${d.roomNumber})`).join(', ');
      const extraCount = duesList.length > 3 ? ` +${duesList.length - 3} more` : '';

      const title = `[A1 Hostels 6 PM Summary] ${duesList.length} Tenant(s) Due Tomorrow (₹${totalAmount.toLocaleString('en-IN')})`;
      const message = `Tomorrow's Dues (${currentMonth}): ${tenantSummary}${extraCount}. Total Pending: ₹${totalAmount.toLocaleString('en-IN')}.`;

      // Save notification to Firestore under notifications collection
      await adminDb.collection('notifications').add({
        owner_id: ownerId,
        type: 'tomorrow_dues_summary',
        title,
        message,
        timestamp: Date.now(),
        created_at: new Date().toISOString(),
        read: false,
        link: '/pgowner/dues'
      });

      summaryResults.push({ ownerId, count: duesList.length, totalAmount, title });
    }

    return NextResponse.json({
      success: true,
      summaryTime: '6:00 PM IST',
      ownersNotified: summaryResults.length,
      details: summaryResults
    });
  } catch (error: any) {
    console.error('Error in 6 PM owner dues cron job:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
