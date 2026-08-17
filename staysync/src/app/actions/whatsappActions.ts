"use server";

import { adminDb } from '@/lib/firebase-admin';
import { 
  sendTenantWelcomeNotification, 
  sendRentReminderWithLink, 
  sendFeeReceiptNotification, 
  sendWhatsAppTextMessage,
  testWhatsAppConnection
} from '@/lib/whatsapp';
import { WHATSAPP_CONFIG, WhatsAppLogEntry } from '@/lib/whatsappConfig';

/**
 * Server Action: Sends a manual WhatsApp message to a tenant by ID.
 */
export async function sendManualTenantNotificationAction(params: {
  tenantId: string;
  triggerType: 'WELCOME' | 'DUE_REMINDER' | 'OVERDUE_REMINDER' | 'PAYMENT_CONFIRMATION' | 'CUSTOM';
  customMessage?: string;
}) {
  try {
    const tSnap = await adminDb.collection('tenants').doc(params.tenantId).get();
    if (!tSnap.exists) {
      return { success: false, error: 'Tenant record not found' };
    }

    const tenant = tSnap.data() || {};
    if (tenant.whatsappEnabled === false) {
      return { success: false, error: 'WhatsApp notifications are disabled for this tenant' };
    }

    const phone = tenant.mobile || tenant.phone || tenant.mobileNumber || tenant.phone_number || '';
    const name = tenant.full_name || tenant.name || tenant.tenantName || 'Resident';
    const rentAmount = Number(tenant.rent_amount || tenant.rentAmount || tenant.roomRent || tenant.monthly_rent || 0);
    const roomNumber = tenant.room_number || tenant.roomNumber || (tenant.room?.room_number) || 'N/A';
    const moveInDate = tenant.move_in_date || tenant.joiningDate || tenant.moveInDate || tenant.created_at || new Date().toISOString().split('T')[0];
    const securityDeposit = Number(tenant.security_deposit || tenant.securityDeposit || 0);
    const hostelName = tenant.pg_name || tenant.hostelName || 'A1 Hostels';

    if (!phone) {
      return { success: false, error: 'Tenant has no valid phone number recorded' };
    }

    let res: { success: boolean; error?: any; data?: any; messageId?: string } = { success: false };

    switch (params.triggerType) {
      case 'WELCOME':
        res = await sendTenantWelcomeNotification({
          tenantPhone: phone,
          tenantName: name,
          roomNumber,
          moveInDate,
          rentAmount,
          securityDeposit,
          invoiceId: tenant.invoiceId || `INV-${Date.now().toString().slice(-6)}`,
          hostelName,
          tenantId: params.tenantId,
          triggeredBy: 'manual_welcome_btn'
        });
        break;

      case 'DUE_REMINDER':
        res = await sendRentReminderWithLink(
          phone,
          name,
          rentAmount,
          new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
          tenant.invoiceId || `INV-${Date.now().toString().slice(-6)}`,
          tenant.hostelName || 'A1 Hostels',
          'DUE_TODAY',
          0,
          { tenantId: params.tenantId, triggeredBy: 'manual_due_reminder_btn' }
        );
        break;

      case 'OVERDUE_REMINDER':
        res = await sendRentReminderWithLink(
          phone,
          name,
          rentAmount,
          new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
          tenant.invoiceId || `INV-${Date.now().toString().slice(-6)}`,
          tenant.hostelName || 'A1 Hostels',
          'OVERDUE',
          3,
          { tenantId: params.tenantId, triggeredBy: 'manual_overdue_reminder_btn' }
        );
        break;

      case 'PAYMENT_CONFIRMATION':
        res = await sendFeeReceiptNotification({
          tenantPhone: phone,
          tenantName: name,
          amountPaid: rentAmount,
          paymentMethod: 'UPI',
          paymentDate: new Date().toLocaleDateString(),
          receiptId: `REC-${Date.now().toString().slice(-6)}`,
          hostelName: tenant.hostelName || 'A1 Hostels',
          roomNumber,
          tenantId: params.tenantId,
          triggeredBy: 'manual_payment_confirmation_btn'
        });
        break;

      case 'CUSTOM':
        if (!params.customMessage) {
          return { success: false, error: 'Custom message text is required' };
        }
        res = await sendWhatsAppTextMessage(phone, params.customMessage, {
          tenantId: params.tenantId,
          tenantName: name,
          triggeredBy: 'manual_custom_notice_btn'
        });
        break;

      default:
        return { success: false, error: 'Invalid trigger type' };
    }

    return res;
  } catch (error: any) {
    console.error('sendManualTenantNotificationAction error:', error);
    return { success: false, error: error.message || 'Failed to send WhatsApp message' };
  }
}

/**
 * Server Action: Fetches recent WhatsApp logs (last 100 entries).
 */
export async function fetchWhatsAppLogsAction(limitCount: number = 100) {
  try {
    const snapshot = await adminDb.collection('whatsapp_logs')
      .orderBy('createdAt', 'desc')
      .limit(limitCount)
      .get();

    const logs: WhatsAppLogEntry[] = [];
    snapshot.forEach(doc => {
      logs.push({ id: doc.id, ...(doc.data() as WhatsAppLogEntry) });
    });

    return { success: true, logs };
  } catch (error: any) {
    console.error('fetchWhatsAppLogsAction error:', error);
    return { success: false, error: error.message || 'Failed to fetch logs', logs: [] };
  }
}

/**
 * Server Action: Calculates overall metrics & analytics for WhatsApp dashboard.
 */
export async function fetchWhatsAppMetricsAction() {
  try {
    const snapshot = await adminDb.collection('whatsapp_logs')
      .orderBy('createdAt', 'desc')
      .limit(500)
      .get();

    let total = 0;
    let todayCount = 0;
    let deliveredCount = 0;
    let readCount = 0;
    let failedCount = 0;
    let sentCount = 0;

    const templateUsage: Record<string, number> = {};
    const todayStr = new Date().toISOString().split('T')[0];

    snapshot.forEach(doc => {
      const data = doc.data() as WhatsAppLogEntry;
      total++;

      if (data.createdAt && data.createdAt.startsWith(todayStr)) {
        todayCount++;
      }

      if (data.status === 'sent') sentCount++;
      if (data.status === 'delivered') deliveredCount++;
      if (data.status === 'read') readCount++;
      if (data.status === 'failed') failedCount++;

      const tName = data.templateName || 'custom';
      templateUsage[tName] = (templateUsage[tName] || 0) + 1;
    });

    const successCount = sentCount + deliveredCount + readCount;
    const successRate = total > 0 ? Math.round((successCount / total) * 100) : 100;
    const deliveredRate = total > 0 ? Math.round(((deliveredCount + readCount) / total) * 100) : 0;
    const readRate = total > 0 ? Math.round((readCount / total) * 100) : 0;
    const failedRate = total > 0 ? Math.round((failedCount / total) * 100) : 0;

    return {
      success: true,
      metrics: {
        totalMessages: total,
        todayMessages: todayCount,
        deliveredCount,
        readCount,
        failedCount,
        successRate,
        deliveredRate,
        readRate,
        failedRate,
        templateUsage
      }
    };
  } catch (error: any) {
    console.error('fetchWhatsAppMetricsAction error:', error);
    return {
      success: false,
      error: error.message,
      metrics: {
        totalMessages: 0,
        todayMessages: 0,
        deliveredCount: 0,
        readCount: 0,
        failedCount: 0,
        successRate: 100,
        deliveredRate: 0,
        readRate: 0,
        failedRate: 0,
        templateUsage: {}
      }
    };
  }
}

/**
 * Server Action: Runs diagnostic test connection suite.
 */
export async function testWhatsAppConnectionAction(phone: string) {
  return await testWhatsAppConnection(phone);
}

/**
 * Server Action: Toggles tenant's whatsappEnabled setting in Firestore.
 */
export async function toggleTenantWhatsAppAction(tenantId: string, enabled: boolean) {
  try {
    await adminDb.collection('tenants').doc(tenantId).update({
      whatsappEnabled: enabled,
      updatedAt: new Date().toISOString()
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Server Action: Fetches active WhatsApp template header banner image URLs for all 3 templates.
 */
export async function getWhatsAppBannersAction() {
  try {
    const docSnap = await adminDb.collection('app_settings').doc('whatsapp_config').get();
    if (docSnap.exists) {
      const data = docSnap.data() || {};
      return {
        success: true,
        banners: {
          welcomeBannerUrl: data.welcomeBannerUrl || data.bannerUrl || null,
          dueBannerUrl: data.dueBannerUrl || data.bannerUrl || null,
          overdueBannerUrl: data.overdueBannerUrl || data.bannerUrl || null,
        }
      };
    }
    return {
      success: true,
      banners: { welcomeBannerUrl: null, dueBannerUrl: null, overdueBannerUrl: null }
    };
  } catch (err: any) {
    return { success: false, error: err.message, banners: { welcomeBannerUrl: null, dueBannerUrl: null, overdueBannerUrl: null } };
  }
}

/**
 * Server Action: Saves active WhatsApp template header banner image URL for a specific template.
 */
export async function saveWhatsAppBannerAction(params: { templateKey: 'welcome' | 'due' | 'overdue'; bannerUrl: string }) {
  try {
    const fieldName = `${params.templateKey}BannerUrl`;
    await adminDb.collection('app_settings').doc('whatsapp_config').set({
      [fieldName]: params.bannerUrl,
      bannerUrl: params.bannerUrl, // general fallback
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
