import { adminDb } from '../lib/firebase-admin';
import { calculateTenantFinancialState, parseMoneyToPaise, paiseToRupees } from '../lib/financialEngine';

async function diagnoseMismatch() {
  console.log("=== DIAGNOSING MISMATCH FOR FIFO TEST TENANT ===");
  const tenantId = 'up9BqKUAlFhPuCJ7dgOy';

  // 1. Fetch tenant doc
  const tDoc = await adminDb.collection('tenants').doc(tenantId).get();
  const tenantData = tDoc.data();
  console.log("Tenant active status:", tenantData?.is_active, "status:", tenantData?.status);

  // 2. Fetch all payments/charges in Firestore
  const snap = await adminDb.collection('payments').where('tenant_id', '==', tenantId).get();
  const allDocs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

  // Separate into charges and payments
  const charges = allDocs.filter((p: any) => p.status === 'pending' || p.status === 'overdue' || p.status === 'settled');
  const payments = allDocs.filter((p: any) => {
    if (p.status === 'settled' || p.status === 'pending' || p.status === 'overdue') return false;
    const isPaid = p.status === 'paid' || p.status === 'completed' || p.status === 'success' || p.status === 'reversed';
    if (!isPaid) return false;
    // Exclude if it's a settled invoice doc that was somehow categorized as payment
    return true;
  });

  console.log(`\nFound ${charges.length} Charges in Firestore:`);
  charges.forEach((c, idx) => {
    console.log(`${idx + 1}. [${c.id}] ${c.type} - ${c.description}: amount=${c.amount}, amount_paid=${c.amount_paid || 0}, status=${c.status}`);
  });

  console.log(`\nFound ${payments.length} Payments/Receipts in Firestore:`);
  payments.forEach((p, idx) => {
    console.log(`${idx + 1}. [${p.id}] status=${p.status}, amount=${p.amount}, amount_paid=${p.amount_paid || 0}, is_receipt=${p.is_payment_receipt}`);
  });

  // Calculate using engine
  const state = calculateTenantFinancialState(tenantData, charges, payments);
  console.log("\n=== ENGINE CALCULATION ===");
  console.log("totalBilledPaise:", state.totalBilledPaise, `(₹${paiseToRupees(state.totalBilledPaise)})`);
  console.log("totalPaidPaise:", state.totalPaidPaise, `(₹${paiseToRupees(state.totalPaidPaise)})`);
  console.log("outstandingPaise:", state.outstandingPaise, `(₹${paiseToRupees(state.outstandingPaise)})`);
  console.log("advanceCreditPaise:", state.advanceCreditPaise, `(₹${paiseToRupees(state.advanceCreditPaise)})`);

  console.log("\nEngine Computed Charges List:");
  state.charges.forEach(c => {
    console.log(`- [${c.chargeId}] ${c.description}: Original=₹${paiseToRupees(c.amountPaise)}, Paid=₹${paiseToRupees(c.paidPaise)}, Remaining=₹${paiseToRupees(c.remainingPaise)}, status=${c.status}`);
  });
}

diagnoseMismatch().catch(console.error);
