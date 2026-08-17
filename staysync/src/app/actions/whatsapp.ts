'use server';

import { 
  sendRentReminderWithLink as sendRentReminderMeta, 
  sendTenantWelcomeNotification as sendWelcomeMeta,
  sendFeeReceiptNotification as sendFeeReceiptMeta
} from '@/lib/whatsapp';

export async function sendTenantWelcomeAction(params: {
  tenantPhone: string;
  tenantName: string;
  roomNumber?: string;
  moveInDate: string;
  rentAmount: number;
  securityDeposit: number;
  invoiceId: string;
  hostelName?: string;
}): Promise<{ success: boolean; error?: any; data?: any }> {
  try {
    return await sendWelcomeMeta(params);
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to send welcome message' };
  }
}

export async function sendFeeReceiptAction(params: {
  tenantPhone: string;
  tenantName: string;
  amountPaid: number;
  paymentMethod: string;
  paymentDate: string;
  category?: string;
  receiptId: string;
  hostelName?: string;
  pdfUrl?: string;
  roomNumber?: string;
  pendingFee?: number;
}): Promise<{ success: boolean; error?: any; data?: any }> {
  try {
    return await sendFeeReceiptMeta(params);
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to send fee receipt message' };
  }
}

export async function sendRentReminderAction(
  tenantPhone: string,
  tenantName: string,
  roomRent: number,
  dueMonth: string,
  invoiceId: string,
  statusType: 'STANDARD' | 'DUE_TODAY' | 'DUE_TOMORROW' | 'OVERDUE' = 'STANDARD',
  overdueDays: number = 0,
  roomNumber: string = '101',
  dueDateStr: string = '1 Aug, 2026',
  hostelName: string = 'A1 Hostels'
): Promise<{ success: boolean; error?: any; data?: any }> {
  try {
    const res = await sendRentReminderMeta(
      tenantPhone,
      tenantName,
      roomRent,
      dueMonth,
      invoiceId,
      hostelName,
      statusType,
      overdueDays,
      { roomNumber, dueDateStr }
    );
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to send WhatsApp message' };
  }
}

export async function sendBulkRentRemindersAction(
  items: Array<{
    tenantPhone: string;
    tenantName: string;
    roomRent: number;
    dueMonth: string;
    invoiceId: string;
    statusType?: 'STANDARD' | 'DUE_TODAY' | 'DUE_TOMORROW' | 'OVERDUE';
    overdueDays?: number;
  }>
): Promise<{ 
  successCount: number; 
  failCount: number; 
  results: Array<{ tenantName: string; tenantPhone: string; success: boolean; error?: string }> 
}> {
  const promises = items.map(async (item) => {
    try {
      const res = await sendRentReminderMeta(
        item.tenantPhone,
        item.tenantName,
        item.roomRent,
        item.dueMonth,
        item.invoiceId,
        'A1 Hostels',
        item.statusType || 'STANDARD',
        item.overdueDays || 0
      );
      return { 
        tenantName: item.tenantName, 
        tenantPhone: item.tenantPhone, 
        success: res.success, 
        error: res.error 
      };
    } catch (err: any) {
      return { 
        tenantName: item.tenantName, 
        tenantPhone: item.tenantPhone, 
        success: false, 
        error: err.message 
      };
    }
  });

  const results = await Promise.all(promises);
  let successCount = 0;
  let failCount = 0;

  results.forEach(r => {
    if (r.success) successCount++;
    else failCount++;
  });

  return { successCount, failCount, results };
}
