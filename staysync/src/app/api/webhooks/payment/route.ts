import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { dbUpdateInvoiceStatus } from '@/lib/firebase-admin'; 

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const headers = req.headers;
    
    // Example: Razorpay signature verification
    const signature = headers.get('x-razorpay-signature');
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    if (signature !== expectedSignature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const payload = JSON.parse(rawBody);
    
    // Handle payment success event
    if (payload.event === 'payment.captured' || payload.event === 'order.paid') {
      const paymentEntity = payload.payload.payment.entity;
      // Assuming invoiceId is passed in notes during order creation
      const invoiceId = paymentEntity.notes.invoice_id; 

      if (invoiceId) {
        // Update database: Mark invoice as paid
        await dbUpdateInvoiceStatus(invoiceId, 'paid');
        console.log(`Invoice ${invoiceId} marked as paid successfully.`);
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
