import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { createRealReceiptPDFBuffer } from '@/lib/pdfReceiptBuilder';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let paymentData: any = null;
  let tenantData: any = null;
  let hostelData: any = null;

  try {
    const paySnap = await adminDb.collection('payments').doc(id).get();
    if (paySnap.exists) {
      paymentData = paySnap.data();
    } else {
      const qSnap = await adminDb.collection('payments').where('payment_id', '==', id).limit(1).get();
      if (!qSnap.empty) {
        paymentData = qSnap.docs[0].data();
      }
    }

    if (paymentData?.tenant_id) {
      const tSnap = await adminDb.collection('tenants').doc(paymentData.tenant_id).get();
      if (tSnap.exists) tenantData = tSnap.data();
    }

    if (paymentData?.pg_id) {
      const pSnap = await adminDb.collection('properties').doc(paymentData.pg_id).get();
      if (pSnap.exists) hostelData = pSnap.data();
    }
  } catch (e) {
    console.error('Error fetching receipt data for PDF:', e);
  }

  const rawDate = paymentData?.payment_date || paymentData?.created_at || new Date().toISOString();
  const d = new Date(rawDate);
  const dateTimeStr = !isNaN(d.getTime())
    ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) + ', ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    : new Date().toLocaleString();

  const pdfBuffer = await createRealReceiptPDFBuffer({
    receiptId: id,
    dateTimeStr,
    tenantName: paymentData?.tenant_name || tenantData?.full_name || tenantData?.name || 'Tenant',
    roomNumber: String(paymentData?.room_number || tenantData?.room_number || 'N/A'),
    hostelName: paymentData?.pg_name || hostelData?.name || 'Himalaya Hostels',
    paymentMethod: paymentData?.payment_method || paymentData?.method || 'UPI',
    pendingFee: Number(paymentData?.remaining_due || paymentData?.pending_balance || 0),
    amountPaid: Number(paymentData?.amount_paid || paymentData?.amount || 0)
  });

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Fee_Receipt_${id}.pdf"`,
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
