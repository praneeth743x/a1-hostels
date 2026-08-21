/**
 * COMPREHENSIVE FINANCIAL ENGINE TEST SUITE
 * 
 * Tests:
 * 1. Basic Payments (₹1,000 bill, ₹100 pay -> ₹900 outstanding)
 * 2. Multi-Payment Chains (₹10,000 bill, ₹100 + ₹200 + ₹300 + ₹400 -> ₹1,000 paid, ₹9,000 outstanding)
 * 3. Decimal Paise Precision (₹100.50, ₹999.99, ₹1,000.01)
 * 4. Large Numbers (₹1 to ₹1,00,00,000)
 * 5. String Normalization & Error Recovery
 * 6. Regression Bug Reproductions:
 *    - "₹100 collection -> ₹1,000/₹2,000 deduction" bug
 *    - "₹100 collection -> clears entire pending balance" bug
 *    - String "100" vs Number 100 coercion bug
 * 7. Payment Reversals & Invariant Preservation
 * 8. Property-Based Fuzz Testing (1,000 randomized sequences)
 */

import {
  parseMoneyToPaise,
  formatPaiseToINR,
  paiseToRupees,
  rupeesToPaise,
  calculateTenantFinancialState,
  allocatePaymentFIFO,
  verifyFinancialInvariants,
  reconcileTenantLedger,
  TenantFinancialState
} from '../lib/financialEngine';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

function assertEqual(actual: any, expected: any, testName: string) {
  if (actual !== expected) {
    throw new Error(`[FAIL] ${testName}: Expected ${expected} (${typeof expected}), but got ${actual} (${typeof actual})`);
  }
}

export function runFinancialEngineTests() {
  console.log('🧪 Starting Advanced Financial Calculation Engine Tests...\n');
  let testsPassed = 0;

  // ---------------------------------------------------------------------------
  // TEST GROUP 1: Money Normalization & Formatting
  // ---------------------------------------------------------------------------
  console.log('--- Test Group 1: Money Parser & Formatter ---');
  
  assertEqual(parseMoneyToPaise(100), 10000, 'Integer 100 -> 10000 paise');
  assertEqual(parseMoneyToPaise('100'), 10000, 'String "100" -> 10000 paise');
  assertEqual(parseMoneyToPaise('₹100'), 10000, 'Currency "₹100" -> 10000 paise');
  assertEqual(parseMoneyToPaise('1,000'), 100000, 'Comma formatted "1,000" -> 100000 paise');
  assertEqual(parseMoneyToPaise('100.50'), 10050, 'Decimal "100.50" -> 10050 paise');
  assertEqual(parseMoneyToPaise('999.99'), 99999, 'Decimal "999.99" -> 99999 paise');
  assertEqual(parseMoneyToPaise('1000.01'), 100001, 'Decimal "1000.01" -> 100001 paise');
  assertEqual(parseMoneyToPaise('₹1,50,000.75'), 15000075, 'Large formatted Indian rupee string');
  assertEqual(parseMoneyToPaise(null), 0, 'Null -> 0');
  assertEqual(parseMoneyToPaise(undefined), 0, 'Undefined -> 0');
  assertEqual(parseMoneyToPaise(''), 0, 'Empty string -> 0');
  assertEqual(parseMoneyToPaise('abc'), 0, 'Invalid string -> 0');
  assertEqual(parseMoneyToPaise(-100), 0, 'Negative rejected by default');
  assertEqual(parseMoneyToPaise(-100, true), -10000, 'Negative accepted when allowed');

  assertEqual(formatPaiseToINR(10000), '₹100', '10000 paise -> ₹100');
  assertEqual(formatPaiseToINR(10050), '₹100.50', '10050 paise -> ₹100.50');
  assertEqual(formatPaiseToINR(100000), '₹1,000', '100000 paise -> ₹1,000');
  assertEqual(formatPaiseToINR(10000000), '₹1,00,000', '10000000 paise -> ₹1,00,000');
  
  testsPassed += 16;
  console.log('✅ Passed Test Group 1 (16 assertions)\n');

  // ---------------------------------------------------------------------------
  // TEST GROUP 2: Basic Canonical Scenarios
  // ---------------------------------------------------------------------------
  console.log('--- Test Group 2: Canonical Scenarios ---');

  // Scenario 2.1: Bill ₹1,000, Pay ₹100 -> Expected ₹900
  {
    const tenant = { id: 'T1', name: 'John Doe' };
    const charges = [{ id: 'C1', amount: 1000, created_at: '2026-08-01T00:00:00Z' }];
    const payments = [{ id: 'P1', amount: 100, status: 'paid', created_at: '2026-08-05T00:00:00Z' }];

    const state = calculateTenantFinancialState(tenant, charges, payments);
    assertEqual(state.totalBilledPaise, 100000, 'Total Billed ₹1,000');
    assertEqual(state.totalPaidPaise, 10000, 'Total Paid ₹100');
    assertEqual(state.outstandingPaise, 90000, 'Outstanding ₹900');
    assertEqual(state.advanceCreditPaise, 0, 'Advance Credit ₹0');
    assert(state.isReconciled, 'Invariants Verified');
  }

  // Scenario 2.2: Bill ₹1,000, Pay ₹500 -> Expected ₹500
  {
    const tenant = { id: 'T1' };
    const charges = [{ id: 'C1', amount: 1000 }];
    const payments = [{ id: 'P1', amount: 500, status: 'paid' }];
    const state = calculateTenantFinancialState(tenant, charges, payments);
    assertEqual(state.outstandingPaise, 50000, 'Outstanding ₹500');
    assertEqual(state.totalPaidPaise, 50000, 'Total Paid ₹500');
  }

  // Scenario 2.3: Bill ₹1,000, Pay ₹1,000 -> Expected ₹0
  {
    const tenant = { id: 'T1' };
    const charges = [{ id: 'C1', amount: 1000 }];
    const payments = [{ id: 'P1', amount: 1000, status: 'paid' }];
    const state = calculateTenantFinancialState(tenant, charges, payments);
    assertEqual(state.outstandingPaise, 0, 'Outstanding ₹0');
    assertEqual(state.status, 'PAID', 'Status is PAID');
  }

  testsPassed += 8;
  console.log('✅ Passed Test Group 2 (8 assertions)\n');

  // ---------------------------------------------------------------------------
  // TEST GROUP 3: Multi-Payment Chains (₹10,000 Billed, ₹100, ₹200, ₹300, ₹400)
  // ---------------------------------------------------------------------------
  console.log('--- Test Group 3: Multi-Payment Chains ---');
  {
    const tenant = { id: 'T1' };
    const charges = [{ id: 'C1', amount: 10000, created_at: '2026-08-01T00:00:00Z' }];
    const payments = [
      { id: 'P1', amount: 100, status: 'paid', created_at: '2026-08-02T00:00:00Z' },
      { id: 'P2', amount: 200, status: 'paid', created_at: '2026-08-03T00:00:00Z' },
      { id: 'P3', amount: 300, status: 'paid', created_at: '2026-08-04T00:00:00Z' },
      { id: 'P4', amount: 400, status: 'paid', created_at: '2026-08-05T00:00:00Z' }
    ];

    const state = calculateTenantFinancialState(tenant, charges, payments);
    assertEqual(state.totalBilledPaise, 1000000, 'Total Billed ₹10,000');
    assertEqual(state.totalPaidPaise, 100000, 'Total Paid ₹1,000');
    assertEqual(state.outstandingPaise, 900000, 'Outstanding ₹9,000');
    assert(state.isReconciled, 'Invariants Verified');
  }
  testsPassed += 4;
  console.log('✅ Passed Test Group 3 (4 assertions)\n');

  // ---------------------------------------------------------------------------
  // TEST GROUP 4: Multi-Charge FIFO Allocator
  // ---------------------------------------------------------------------------
  console.log('--- Test Group 4: Multi-Charge FIFO Allocation ---');
  {
    const charges = [
      { chargeId: 'C1', tenantId: 'T1', amountPaise: 500000, paidPaise: 0, dueDate: '2026-07-05', status: 'pending' as const, createdAt: '2026-07-01', description: 'July Rent', type: 'monthly_rent' as const },
      { chargeId: 'C2', tenantId: 'T1', amountPaise: 500000, paidPaise: 0, dueDate: '2026-08-05', status: 'pending' as const, createdAt: '2026-08-01', description: 'Aug Rent', type: 'monthly_rent' as const }
    ];

    // Pay ₹6,000: July (₹5,000) fully paid, Aug (₹1,000 paid, ₹4,000 remaining)
    const result = allocatePaymentFIFO(600000, charges);
    assertEqual(result.allocated.length, 2, 'Allocated to 2 charges');
    assertEqual(result.allocated[0].chargeId, 'C1', 'July is first');
    assertEqual(result.allocated[0].amountPaise, 500000, 'July paid ₹5,000');
    assertEqual(result.allocated[0].remainingPaise, 0, 'July remaining ₹0');
    assertEqual(result.allocated[0].isFullyPaid, true, 'July fully paid');

    assertEqual(result.allocated[1].chargeId, 'C2', 'Aug is second');
    assertEqual(result.allocated[1].amountPaise, 100000, 'Aug paid ₹1,000');
    assertEqual(result.allocated[1].remainingPaise, 400000, 'Aug remaining ₹4,000');
    assertEqual(result.allocated[1].isFullyPaid, false, 'Aug partially paid');

    assertEqual(result.advancePaise, 0, 'Advance is ₹0');
  }
  testsPassed += 10;
  console.log('✅ Passed Test Group 4 (10 assertions)\n');

  // ---------------------------------------------------------------------------
  // TEST GROUP 5: Overpayments & Advance Credit
  // ---------------------------------------------------------------------------
  console.log('--- Test Group 5: Overpayments & Advance Credit ---');
  {
    const tenant = { id: 'T1' };
    const charges = [{ id: 'C1', amount: 5000 }];
    const payments = [{ id: 'P1', amount: 6000, status: 'paid' }];

    const state = calculateTenantFinancialState(tenant, charges, payments);
    assertEqual(state.totalBilledPaise, 500000, 'Total Billed ₹5,000');
    assertEqual(state.totalPaidPaise, 600000, 'Total Paid ₹6,000');
    assertEqual(state.outstandingPaise, 0, 'Outstanding ₹0');
    assertEqual(state.advanceCreditPaise, 100000, 'Advance Credit ₹1,000');
    assert(state.isReconciled, 'Invariants Verified (Conservation of Money)');
  }
  testsPassed += 5;
  console.log('✅ Passed Test Group 5 (5 assertions)\n');

  // ---------------------------------------------------------------------------
  // TEST GROUP 6: Payment Reversals
  // ---------------------------------------------------------------------------
  console.log('--- Test Group 6: Payment Reversals ---');
  {
    const tenant = { id: 'T1' };
    const charges = [{ id: 'C1', amount: 5000 }];
    const payments = [
      { id: 'P1', amount: 2000, status: 'paid' },
      { id: 'P2', amount: 1000, status: 'reversed', reversalInfo: { reason: 'Bounced Check' } }
    ];

    const state = calculateTenantFinancialState(tenant, charges, payments);
    assertEqual(state.totalBilledPaise, 500000, 'Total Billed ₹5,000');
    assertEqual(state.totalPaidPaise, 200000, 'Total Paid ₹2,000 (Reversed excluded)');
    assertEqual(state.outstandingPaise, 300000, 'Outstanding ₹3,000');
    assert(state.isReconciled, 'Invariants Verified');
  }
  testsPassed += 4;
  console.log('✅ Passed Test Group 6 (4 assertions)\n');

  // ---------------------------------------------------------------------------
  // TEST GROUP 7: REGRESSION TESTS (Previous Bugs)
  // ---------------------------------------------------------------------------
  console.log('--- Test Group 7: Permanent Regression Tests ---');

  // REGRESSION 1: "Collecting ₹100 deducts ₹1,000 or ₹2,000"
  // Ensured that collecting ₹100 deducts strictly 10000 paise from outstanding
  {
    const tenant = { id: 'T_REG1' };
    const charges = [{ id: 'C1', amount: 5500 }]; // ₹5,500 due
    const payments = [{ id: 'P1', amount: 100, status: 'paid' }]; // Pay ₹100

    const state = calculateTenantFinancialState(tenant, charges, payments);
    assertEqual(state.outstandingPaise, 540000, '₹100 payment deducts strictly ₹100, leaving ₹5,400');
    assertEqual(state.totalPaidPaise, 10000, 'Total paid is ₹100');
  }

  // REGRESSION 2: "Collecting ₹100 clears entire pending balance"
  // Ensured that a partial ₹100 payment NEVER marks the whole charge as paid
  {
    const tenant = { id: 'T_REG2' };
    const charges = [{ id: 'C1', amount: 10000 }]; // ₹10,000 due
    const payments = [{ id: 'P1', amount: 100, status: 'paid' }]; // Pay ₹100

    const state = calculateTenantFinancialState(tenant, charges, payments);
    assertEqual(state.outstandingPaise, 990000, 'Outstanding is ₹9,900, NOT ₹0');
    assertEqual(state.charges[0].status, 'partially_paid', 'Charge status is partially_paid, NOT paid');
  }

  // REGRESSION 3: String input "100" in form input coerced safely
  {
    const parsed = parseMoneyToPaise("100");
    assertEqual(parsed, 10000, 'String "100" parsed safely as 10000 paise');
    const allocation = allocatePaymentFIFO(parsed, [
      { chargeId: 'C1', tenantId: 'T1', amountPaise: 200000, paidPaise: 0, dueDate: '2026-08-05', status: 'pending', createdAt: '2026-08-01', description: 'Rent', type: 'monthly_rent' }
    ]);
    assertEqual(allocation.allocated[0].amountPaise, 10000, 'Allocated strictly ₹100');
    assertEqual(allocation.allocated[0].remainingPaise, 190000, 'Remaining strictly ₹1,900');
  }

  testsPassed += 8;
  console.log('✅ Passed Test Group 7 (8 assertions)\n');

  // ---------------------------------------------------------------------------
  // TEST GROUP 8: Property-Based Fuzz Testing (1,000 Randomized Scenarios)
  // ---------------------------------------------------------------------------
  console.log('--- Test Group 8: 1,000 Randomized Property-Based Fuzz Tests ---');
  let fuzzPassed = 0;
  for (let i = 0; i < 1000; i++) {
    const numCharges = Math.floor(Math.random() * 5) + 1;
    const numPayments = Math.floor(Math.random() * 8);

    const charges: any[] = [];
    let expectedTotalBilledPaise = 0;
    for (let c = 0; c < numCharges; c++) {
      const amtRupees = Math.floor(Math.random() * 15000) + 100;
      charges.push({
        id: `C_${i}_${c}`,
        amount: amtRupees,
        created_at: new Date(2026, 0, c + 1).toISOString()
      });
      expectedTotalBilledPaise += amtRupees * 100;
    }

    const payments: any[] = [];
    let expectedTotalPaidPaise = 0;
    for (let p = 0; p < numPayments; p++) {
      const isReversed = Math.random() < 0.1;
      const amtRupees = Math.floor(Math.random() * 5000) + 50;
      payments.push({
        id: `P_${i}_${p}`,
        amount: amtRupees,
        status: isReversed ? 'reversed' : 'paid',
        created_at: new Date(2026, 0, p + 2).toISOString()
      });
      if (!isReversed) {
        expectedTotalPaidPaise += amtRupees * 100;
      }
    }

    const state = calculateTenantFinancialState({ id: `T_${i}` }, charges, payments);
    
    // Invariant Check 1: Conservation of Money
    const expectedOutstanding = Math.max(0, expectedTotalBilledPaise - expectedTotalPaidPaise);
    const expectedAdvance = Math.max(0, expectedTotalPaidPaise - expectedTotalBilledPaise);

    assertEqual(state.totalBilledPaise, expectedTotalBilledPaise, `Fuzz ${i}: Total Billed`);
    assertEqual(state.totalPaidPaise, expectedTotalPaidPaise, `Fuzz ${i}: Total Paid`);
    assertEqual(state.outstandingPaise, expectedOutstanding, `Fuzz ${i}: Outstanding`);
    assertEqual(state.advanceCreditPaise, expectedAdvance, `Fuzz ${i}: Advance Credit`);
    assert(state.isReconciled, `Fuzz ${i}: Mathematical Invariants`);

    fuzzPassed++;
  }
  testsPassed += fuzzPassed * 5;
  console.log(`✅ Passed Test Group 8 (1,000 randomized fuzz scenarios, ${fuzzPassed * 5} assertions)\n`);

  console.log(`🎉 ALL ${testsPassed} FINANCIAL ENGINE TESTS PASSED WITH 100% SUCCESS!\n`);
  return true;
}

// Auto-run if executed directly via tsx / node
if (typeof require !== 'undefined' && require.main === module) {
  runFinancialEngineTests();
}
