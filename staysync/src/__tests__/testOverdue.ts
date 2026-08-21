import { sendRentReminderWithLink, sendTenantWelcomeNotification, sendFeeReceiptNotification } from '../lib/whatsapp';

async function testAllTemplates() {
  console.log('--- Testing sendRentReminderWithLink (DUE_TODAY) ---');
  const res1 = await sendRentReminderWithLink(
    '919618113435',
    'Praneeth',
    5000,
    'August',
    'INV-12345',
    'A1 Hostels',
    'DUE_TODAY',
    0,
    { roomNumber: '101', dueDateStr: '21 Aug, 2026' }
  );
  console.log('DUE_TODAY Result:', res1);

  console.log('\n--- Testing sendRentReminderWithLink (OVERDUE) ---');
  const res2 = await sendRentReminderWithLink(
    '919618113435',
    'Praneeth',
    5000,
    'August',
    'INV-12345',
    'A1 Hostels',
    'OVERDUE',
    3,
    { roomNumber: '101', dueDateStr: '18 Aug, 2026' }
  );
  console.log('OVERDUE Result:', res2);

  console.log('\n--- Testing sendTenantWelcomeNotification ---');
  const res3 = await sendTenantWelcomeNotification({
    tenantPhone: '919618113435',
    tenantName: 'Praneeth',
    roomNumber: '101',
    moveInDate: '2026-08-21',
    rentAmount: 5000,
    securityDeposit: 5000,
    invoiceId: 'INV-12345',
    hostelName: 'A1 Hostels'
  });
  console.log('WELCOME Result:', res3);
}

testAllTemplates();
