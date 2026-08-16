import { NextResponse } from 'next/server';
import { sendFeeReceiptNotification } from '@/lib/whatsapp';

export async function GET(req: Request) {
  const phone = '9963256396';
  
  const res = await sendFeeReceiptNotification({
    tenantPhone: phone,
    tenantName: 'sunny',
    amountPaid: 940,
    paymentMethod: 'UPI (Partial)',
    paymentDate: '04 August 2026, 01:37 AM',
    category: 'Rent Payment',
    receiptId: 'SS-ZIYXO5UH',
    hostelName: 'Himalaya stayin',
    pendingFee: 8465,
    roomNumber: '103'
  });

  return NextResponse.json({
    phone,
    res
  });
}
