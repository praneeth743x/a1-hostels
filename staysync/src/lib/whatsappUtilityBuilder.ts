/**
 * Centralized Meta WhatsApp Utility Message Builder
 * Complies 100% with Meta WhatsApp Utility Template Policies.
 * Purely transactional, neutral, formal, and free of marketing/promotional language.
 */

export interface RentReminderParams {
  hostelName: string;
  tenantName: string;
  amount: number;
  dueMonth: string;
  dueDate?: string;
  invoiceId: string;
  paymentLink?: string;
}

const FORBIDDEN_PROMOTIONAL_PATTERNS = [
  /use staysync/i,
  /download staysync/i,
  /via staysync/i,
  /staysync app/i,
  /download/i,
  /best hostel/i,
  /thank you for choosing/i,
  /discount/i,
  /offer/i,
  /coupon/i,
  /referral/i,
  /upgrade/i,
  /easily online via/i
];

/**
 * Validates a message string against Meta WhatsApp Utility guidelines.
 * Throws an error if any promotional or forbidden terms are detected.
 */
export function validateUtilityMessage(content: string): void {
  for (const pattern of FORBIDDEN_PROMOTIONAL_PATTERNS) {
    if (pattern.test(content)) {
      throw new Error(`[Utility Policy Violation] Content contains forbidden promotional pattern: ${pattern.source}`);
    }
  }
}

/**
 * Builds a strictly Utility-compliant Rent Payment Reminder message.
 */
export function buildRentReminderUtilityMessage(params: RentReminderParams): string {
  const {
    hostelName = 'A1 Hostels',
    tenantName,
    amount,
    dueMonth,
    dueDate = 'Immediate',
    invoiceId,
    paymentLink = `https://staysync.app/pay/${invoiceId}`
  } = params;

  const formattedAmount = amount.toLocaleString('en-IN');
  const sanitizedHostelName = hostelName.trim().toUpperCase();

  const message = 
`🏢 ${sanitizedHostelName}

Rent Payment Reminder

Dear ${tenantName},

This is a reminder that your hostel rent payment is pending.

Pending Amount: ₹${formattedAmount}
Billing Period: ${dueMonth}
Due Date: ${dueDate}
Invoice Reference: #${invoiceId}

To complete your payment securely, use the link below:
${paymentLink}

If you have already completed the payment, please disregard this message.

For assistance, contact the hostel management.`;

  // Enforce strict utility check
  validateUtilityMessage(message);

  return message;
}

/**
 * Builds a strictly Utility-compliant Welcome & Onboarding Message for new tenants.
 */
export function buildTenantWelcomeUtilityMessage(params: {
  hostelName: string;
  tenantName: string;
  roomNumber?: string;
  moveInDate: string;
  rentAmount: number;
  securityDeposit: number;
  invoiceId: string;
  paymentLink?: string;
}): string {
  const {
    hostelName = 'A1 Hostels',
    tenantName,
    roomNumber = 'N/A',
    moveInDate,
    rentAmount,
    securityDeposit,
    invoiceId,
    paymentLink = `https://staysync.app/pay/${invoiceId}`
  } = params;

  const sanitizedHostel = hostelName.trim().toUpperCase();

  const message = 
`🏢 ${sanitizedHostel}

Tenant Welcome & Account Summary

Dear ${tenantName},

Welcome to ${hostelName}. Your tenant account and stay profile have been initialized.

Room Number: ${roomNumber}
Move-in Date: ${moveInDate}
Monthly Rent: ₹${rentAmount.toLocaleString('en-IN')}
Security Deposit: ₹${securityDeposit.toLocaleString('en-IN')}
Invoice Ref: #${invoiceId}

View account details or complete initial payment:
${paymentLink}

For support, please contact the hostel desk.`;

  validateUtilityMessage(message);
  return message;
}

/**
 * Builds a strictly Utility-compliant Rent Due TODAY Reminder.
 */
export function buildRentDueTodayUtilityMessage(params: RentReminderParams): string {
  const {
    hostelName = 'A1 Hostels',
    tenantName,
    amount,
    dueMonth,
    invoiceId,
    paymentLink = `https://staysync.app/pay/${invoiceId}`
  } = params;

  const sanitizedHostel = hostelName.trim().toUpperCase();

  const message = 
`🏢 ${sanitizedHostel}

Rent Due Today Notice

Dear ${tenantName},

This is an automated notice that your hostel rent is due TODAY.

Amount Due: ₹${amount.toLocaleString('en-IN')}
Billing Period: ${dueMonth}
Due Date: TODAY
Invoice Ref: #${invoiceId}

Pay securely online:
${paymentLink}

Ignore if already paid. For queries, contact management.`;

  validateUtilityMessage(message);
  return message;
}

/**
 * Builds a strictly Utility-compliant Rent Due TOMORROW Reminder.
 */
export function buildRentDueTomorrowUtilityMessage(params: RentReminderParams): string {
  const {
    hostelName = 'A1 Hostels',
    tenantName,
    amount,
    dueMonth,
    invoiceId,
    paymentLink = `https://staysync.app/pay/${invoiceId}`
  } = params;

  const sanitizedHostel = hostelName.trim().toUpperCase();

  const message = 
`🏢 ${sanitizedHostel}

Upcoming Rent Due Notice

Dear ${tenantName},

This is a notice that your hostel rent will be due TOMORROW.

Amount Due: ₹${amount.toLocaleString('en-IN')}
Billing Period: ${dueMonth}
Due Date: TOMORROW
Invoice Ref: #${invoiceId}

Complete payment online:
${paymentLink}

Ignore if already paid. For queries, contact management.`;

  validateUtilityMessage(message);
  return message;
}

/**
 * Builds a strictly Utility-compliant Overdue Payment Notice.
 */
export function buildRentOverdueUtilityMessage(params: RentReminderParams & { overdueDays: number }): string {
  const {
    hostelName = 'A1 Hostels',
    tenantName,
    amount,
    dueMonth,
    overdueDays = 1,
    invoiceId,
    paymentLink = `https://staysync.app/pay/${invoiceId}`
  } = params;

  const sanitizedHostel = hostelName.trim().toUpperCase();

  const message = 
`🏢 ${sanitizedHostel}

OVERDUE Rent Notice

Dear ${tenantName},

Your hostel rent payment is OVERDUE by ${overdueDays} ${overdueDays === 1 ? 'day' : 'days'}.

Overdue Balance: ₹${amount.toLocaleString('en-IN')}
Billing Period: ${dueMonth}
Invoice Ref: #${invoiceId}

Please complete payment immediately using the secure link:
${paymentLink}

Ignore if already paid. Contact management for billing inquiries.`;

  validateUtilityMessage(message);
  return message;
}

/**
 * Builds a strictly Utility-compliant Fee Receipt & Payment Confirmation Message.
 */
export function buildFeeReceiptUtilityMessage(params: {
  hostelName?: string;
  tenantName: string;
  amountPaid: number;
  paymentMethod: string;
  paymentDate: string;
  category?: string;
  receiptId: string;
  receiptLink?: string;
}): string {
  const {
    hostelName = 'A1 Hostels',
    tenantName,
    amountPaid,
    paymentMethod = 'UPI',
    paymentDate,
    category = 'Rent Payment',
    receiptId,
    receiptLink = `https://staysync.app/receipt/${receiptId}`
  } = params;

  const sanitizedHostel = hostelName.trim().toUpperCase();

  const message = 
`🏢 ${sanitizedHostel}

Official Payment Receipt

Dear ${tenantName},

Your payment has been successfully received and recorded.

Amount Paid: ₹${amountPaid.toLocaleString('en-IN')}
Payment Mode: ${paymentMethod.toUpperCase()}
Category: ${category}
Date: ${paymentDate}
Receipt Reference: #${receiptId}

View digital receipt:
${receiptLink}

Thank you for your payment. Save this message for your records.`;

  validateUtilityMessage(message);
  return message;
}
