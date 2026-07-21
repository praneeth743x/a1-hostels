import { NextResponse } from 'next/server';
import { sendRentReminderWithLink } from '@/lib/whatsapp';
import { getUnpaidInvoicesForMonth } from '@/lib/firebase-admin'; 

export async function GET(req: Request) {
  try {
    // Basic auth/security check for cron
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    
    // GUARDRAIL LOGIC: Only fetch unpaid invoices. 
    // This ensures notifications are halted/filtered out once an invoice state is 'paid'
    const pendingInvoices = await getUnpaidInvoicesForMonth(currentMonth);

    const results = [];
    for (const invoice of pendingInvoices) {
      // Avoid sending if status is somehow not 'pending' or 'overdue'
      if (invoice.status === 'paid') continue;

      const result = await sendRentReminderWithLink(
        invoice.tenantPhone,
        invoice.tenantName,
        invoice.amount,
        currentMonth,
        invoice.id
      );
      
      results.push({ invoiceId: invoice.id, success: result.success });
    }

    return NextResponse.json({ processed: results.length, details: results });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: 'Failed to process reminders' }, { status: 500 });
  }
}
