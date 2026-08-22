/**
 * ADVANCED FINANCIAL CALCULATION ENGINE
 * 
 * Centralized, deterministic, integer-paise financial engine for A1 Hostels.
 * All monetary calculations are performed strictly in INTEGER PAISE (100 paise = ₹1.00).
 * Never uses floating-point rupee values in calculations.
 * 
 * Mathematical Invariant:
 * TOTAL_BILLED + VALID_ADJUSTMENTS + VALID_LATE_FEES - VALID_DISCOUNTS - VALID_REFUNDS = TOTAL_PAID + OUTSTANDING - ADVANCE_CREDIT
 */

export type Currency = 'INR';

export type ChargeType = 
  | 'monthly_rent' 
  | 'security_deposit' 
  | 'maintenance' 
  | 'utility' 
  | 'fine' 
  | 'one_time' 
  | 'opening_balance' 
  | 'other';

export type ChargeStatus = 'pending' | 'partially_paid' | 'paid' | 'waived';

export type PaymentStatus = 'paid' | 'reversed' | 'refunded';

export type PaymentMethod = 'UPI' | 'Cash' | 'Bank Transfer' | 'Card' | 'Online' | 'Other';

export interface ChargeAllocation {
  chargeId: string;
  amountPaise: number;
}

export interface FinancialCharge {
  chargeId: string;
  tenantId: string;
  pgId?: string;
  type: ChargeType;
  billingPeriod?: string; // e.g. "2026-08"
  description: string;
  amountPaise: number;
  paidPaise: number;
  dueDate: string; // ISO string
  status: ChargeStatus;
  createdAt: string; // ISO string
  isVirtual?: boolean;
}

export interface FinancialPayment {
  paymentId: string;
  idempotencyKey?: string;
  tenantId: string;
  pgId?: string;
  amountPaise: number;
  currency: Currency;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  referenceId?: string;
  description?: string;
  month?: string;
  type?: ChargeType;
  allocatedCharges?: ChargeAllocation[];
  advancePaise?: number;
  collectedBy?: {
    uid?: string;
    name: string;
    role: string;
  };
  reversalInfo?: {
    reversedAt: string;
    reversedBy: string;
    reason: string;
  };
  createdAt: string;
  paymentDate?: string;
}

export interface ComputedCharge extends FinancialCharge {
  remainingPaise: number;
  dueDays: number;
  isOverdue: boolean;
}

export interface TenantFinancialState {
  tenantId: string;
  totalBilledPaise: number;
  totalAdjustmentsPaise: number;
  totalLateFeesPaise: number;
  totalDiscountsPaise: number;
  totalRefundsPaise: number;
  totalPaidPaise: number;
  outstandingPaise: number;
  advanceCreditPaise: number;
  charges: ComputedCharge[];
  payments: FinancialPayment[];
  status: 'PAID' | 'DUE_TODAY' | 'UPCOMING' | 'OVERDUE' | 'CRITICAL' | 'VACATED' | 'PAUSED';
  daysOverdue: number;
  nextDueDate: Date | null;
  isReconciled: boolean;
  reconciliationError?: string;
}

export interface ReconciliationReport {
  tenantId: string;
  storedOutstandingPaise?: number;
  calculatedOutstandingPaise: number;
  differencePaise: number;
  status: 'MATCH' | 'MISMATCH' | 'CORRUPTED';
  details?: string;
}

// -----------------------------------------------------------------------------
// STRING / NUMBER NORMALIZATION & MONEY PARSER
// -----------------------------------------------------------------------------

/**
 * Safely parses any money representation (string with currency, commas, decimals, numbers)
 * into strictly INTEGER PAISE (e.g. ₹100.50 -> 10050 paise).
 */
export function parseMoneyToPaise(val: any, allowNegative: boolean = false): number {
  if (val === null || val === undefined) return 0;
  
  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) return 0;
    if (!allowNegative && val < 0) return 0;
    return Math.round(val * 100);
  }

  if (typeof val === 'string') {
    const cleaned = val.trim().replace(/₹/g, '').replace(/INR/gi, '').replace(/,/g, '').trim();
    if (!cleaned) return 0;
    const isNeg = cleaned.startsWith('-');
    const numStr = isNeg ? cleaned.slice(1).trim() : cleaned;
    const num = parseFloat(numStr);
    
    if (isNaN(num) || !isFinite(num)) return 0;
    const paise = Math.round(num * 100);
    if (isNeg) {
      return allowNegative ? -paise : 0;
    }
    return paise;
  }

  return 0;
}

/**
 * Converts integer paise into Indian Rupee representation (Rupees).
 */
export function paiseToRupees(paise: number): number {
  if (isNaN(paise) || !isFinite(paise)) return 0;
  return Math.round(paise) / 100;
}

/**
 * Converts float/integer rupees into integer paise.
 */
export function rupeesToPaise(rupees: number): number {
  return parseMoneyToPaise(rupees);
}

/**
 * Canonical formatting of paise into Indian Rupee string format (e.g. "₹1,200" or "₹1,200.50").
 */
export function formatPaiseToINR(paise: number, options?: { showPaiseIfZero?: boolean; prefix?: string }): string {
  const prefix = options?.prefix !== undefined ? options.prefix : '₹';
  if (isNaN(paise) || !isFinite(paise)) return `${prefix}0`;

  const absPaise = Math.abs(Math.round(paise));
  const isNegative = paise < 0;
  const rupeesInt = Math.floor(absPaise / 100);
  const paiseRem = absPaise % 100;

  // Format rupees according to Indian numbering system (e.g. 1,00,000)
  const rupeesStr = rupeesInt.toLocaleString('en-IN');

  let formatted = '';
  if (paiseRem > 0 || options?.showPaiseIfZero) {
    formatted = `${rupeesStr}.${paiseRem.toString().padStart(2, '0')}`;
  } else {
    formatted = rupeesStr;
  }

  return isNegative ? `-${prefix}${formatted}` : `${prefix}${formatted}`;
}

// -----------------------------------------------------------------------------
// FINANCIAL INVARIANTS CHECKER
// -----------------------------------------------------------------------------

export function verifyFinancialInvariants(state: TenantFinancialState): { valid: boolean; error?: string } {
  // Invariant 1: Non-negativity
  if (state.totalBilledPaise < 0) return { valid: false, error: 'Total billed paise cannot be negative.' };
  if (state.totalPaidPaise < 0) return { valid: false, error: 'Total paid paise cannot be negative.' };
  if (state.outstandingPaise < 0) return { valid: false, error: 'Outstanding paise cannot be negative.' };
  if (state.advanceCreditPaise < 0) return { valid: false, error: 'Advance credit paise cannot be negative.' };

  // Invariant 2: Conservation of Monetary Ledger Balance
  // Effective Billed = Total Billed + Adjustments + Late Fees - Discounts - Refunds
  const effectiveBilled = 
    state.totalBilledPaise + 
    state.totalAdjustmentsPaise + 
    state.totalLateFeesPaise - 
    state.totalDiscountsPaise - 
    state.totalRefundsPaise;

  const expectedPaidPlusOutstanding = state.totalPaidPaise + state.outstandingPaise - state.advanceCreditPaise;

  if (effectiveBilled !== expectedPaidPlusOutstanding) {
    return {
      valid: false,
      error: `Ledger Conservation Invariant Violation: Effective Billed (${effectiveBilled}p) != Paid + Outstanding - Credit (${expectedPaidPlusOutstanding}p). Diff = ${effectiveBilled - expectedPaidPlusOutstanding}p`
    };
  }

  return { valid: true };
}

// -----------------------------------------------------------------------------
// CHARGE PRIORITY SORT COMPARATOR
// -----------------------------------------------------------------------------

export function sortChargesByPriorityCompare(a: any, b: any): number {
  const typeA = String(a.type || '').toLowerCase();
  const typeB = String(b.type || '').toLowerCase();

  // Priority 1: Security Deposit
  const isASecurity = typeA === 'security_deposit' || typeA === 'security-deposit';
  const isBSecurity = typeB === 'security_deposit' || typeB === 'security-deposit';

  if (isASecurity && !isBSecurity) return -1;
  if (!isASecurity && isBSecurity) return 1;

  // Priority 2: Monthly Rent
  const isARent = typeA === 'monthly_rent' || typeA === 'monthly-rent';
  const isBRent = typeB === 'monthly_rent' || typeB === 'monthly-rent';

  if (isARent && !isBRent) return -1;
  if (!isARent && isBRent) return 1;

  // Priority 3: Other charges - fallback to chronological creation order
  return new Date(a.createdAt || a.created_at || 0).getTime() - new Date(b.createdAt || b.created_at || 0).getTime();
}

// -----------------------------------------------------------------------------
// CANONICAL FINANCIAL CALCULATION ENGINE
// -----------------------------------------------------------------------------

/**
 * Authoritative financial state calculator for a tenant.
 * Consumes raw charges and raw payments, reconciles them deterministically,
 * and returns the exact ledger state with mathematical invariants guaranteed.
 */
/**
 * Authoritative financial state calculator for a tenant.
 * Consumes raw charges and raw payments, reconciles them deterministically,
 * and returns the exact ledger state with mathematical invariants guaranteed.
 */
export function calculateTenantFinancialState(
  tenant: any,
  rawChargesOrDues: any[],
  rawPayments: any[],
  currentDate: Date = new Date()
): TenantFinancialState {
  const tenantId = tenant?.tenant_id || tenant?.id || '';
  const isVacated = tenant?.is_active === false || tenant?.status === 'vacated' || tenant?.status === 'Vacated' || tenant?.status === 'VACATED';
  const isPaused = tenant?.status === 'PAUSED' || tenant?.status === 'Paused' || tenant?.status === 'paused';

  const today = new Date(currentDate);
  today.setHours(0, 0, 0, 0);

  // 1. Normalize Charges
  const normalizedCharges: FinancialCharge[] = [];

  (rawChargesOrDues || []).forEach((c: any) => {
    const cTenantId = c.tenant_id || c.tenantId;
    if (cTenantId && cTenantId !== tenantId) return;

    const chargeId = c.payment_id || c.id || c.charge_id || `charge_${normalizedCharges.length + 1}`;
    const amountPaise = parseMoneyToPaise(c.original_amount !== undefined ? c.original_amount : c.amount);
    if (amountPaise <= 0) return;

    let dueDate = c.due_date || c.dueDate;
    if (!dueDate) {
      const createdAt = new Date(c.created_at || c.createdAt || Date.now());
      const d = new Date(createdAt);
      let targetDay = 5;
      if (tenant?.move_in_date) {
        const checkin = new Date(tenant.move_in_date);
        if (!isNaN(checkin.getTime())) targetDay = checkin.getDate();
      }
      d.setDate(targetDay);
      d.setHours(0, 0, 0, 0);
      dueDate = d.toISOString();
    }

    const storedPaidPaise = parseMoneyToPaise(
      c.amount_paid_paise !== undefined 
        ? c.amount_paid_paise 
        : (c.amount_paid !== undefined ? c.amount_paid : 0)
    );

    const charge: FinancialCharge = {
      chargeId,
      tenantId,
      pgId: c.pg_id || tenant?.pg_id,
      type: (c.type || 'monthly_rent') as ChargeType,
      billingPeriod: c.billing_period || c.month,
      description: c.description || c.type || 'Rent Charge',
      amountPaise,
      paidPaise: storedPaidPaise, // Will be merged with allocations
      dueDate,
      status: (c.status || 'pending') as ChargeStatus,
      createdAt: c.created_at || c.createdAt || new Date().toISOString(),
      isVirtual: c.is_virtual || c.isVirtual || false
    };

    normalizedCharges.push(charge);
  });

  // 2. Normalize Payments (Excluding reversed/failed transactions and settled charge docs)
  const allocatedChargeIds = new Set<string>();
  (rawPayments || []).forEach((p: any) => {
    if (Array.isArray(p.allocated_charges)) {
      p.allocated_charges.forEach((alloc: any) => {
        if (alloc.chargeId) allocatedChargeIds.add(alloc.chargeId);
      });
    }
  });

  const normalizedPayments: FinancialPayment[] = [];
  let totalPaidPaise = 0;
  let totalRefundsPaise = 0;

  (rawPayments || []).forEach((p: any) => {
    const pTenantId = p.tenant_id || p.tenantId;
    if (pTenantId && pTenantId !== tenantId) return;

    const status = (p.status || 'paid').toLowerCase();
    // Exclude invoices/charges that are in payments collection but aren't receipts
    if (status === 'pending' || status === 'overdue' || status === 'settled' || status === 'failed') return;

    const pId = p.payment_id || p.id;
    if (pId && allocatedChargeIds.has(pId)) return; // Exclude charge document that was allocated/paid by a receipt

    const isReversed = status === 'reversed' || p.is_reversed === true;
    const isRefund = status === 'refunded' || p.is_refund === true;

    const amountPaise = parseMoneyToPaise(p.amount_paid !== undefined ? p.amount_paid : p.amount);
    if (amountPaise <= 0) return;

    const payment: FinancialPayment = {
      paymentId: pId || `payment_${normalizedPayments.length + 1}`,
      idempotencyKey: p.idempotency_key || p.idempotencyKey,
      tenantId,
      pgId: p.pg_id || tenant?.pg_id,
      amountPaise,
      currency: 'INR',
      paymentMethod: (p.payment_method || p.method || 'UPI') as PaymentMethod,
      status: isReversed ? 'reversed' : isRefund ? 'refunded' : 'paid',
      referenceId: p.reference_id || p.referenceId,
      description: p.description,
      month: p.month,
      type: p.type as ChargeType,
      allocatedCharges: p.allocated_charges || [],
      advancePaise: parseMoneyToPaise(p.advance_paise || 0),
      collectedBy: p.collected_by ? {
        uid: p.collected_by_uid || '',
        name: p.collected_by_name || p.collected_by || 'Staff',
        role: p.collected_by_role || 'Staff'
      } : undefined,
      createdAt: p.created_at || p.payment_date || new Date().toISOString(),
      paymentDate: p.payment_date || p.created_at || new Date().toISOString()
    };

    normalizedPayments.push(payment);

    if (!isReversed) {
      if (isRefund) {
        totalRefundsPaise += amountPaise;
      } else {
        totalPaidPaise += amountPaise;
      }
    }
  });

  // Sort payments chronologically to process allocations in order
  normalizedPayments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // 3. Process allocations chronologically
  const chargeAllocationsSumMap = new Map<string, number>();
  let runningAdvanceCreditPaise = 0;

  normalizedPayments.forEach((p) => {
    if (p.status !== 'paid') return; // Exclude reversed/refunded payments from allocation sum

    if (Array.isArray(p.allocatedCharges) && p.allocatedCharges.length > 0) {
      // Explicit allocations
      p.allocatedCharges.forEach((alloc) => {
        const cId = alloc.chargeId;
        const amt = parseMoneyToPaise(alloc.amountPaise);
        if (cId && amt > 0) {
          chargeAllocationsSumMap.set(cId, (chargeAllocationsSumMap.get(cId) || 0) + amt);
        }
      });
      if (p.advancePaise) {
        runningAdvanceCreditPaise += p.advancePaise;
      }
    } else {
      // Legacy payment with no explicit allocations - allocate dynamically via FIFO waterfall
      let remainingToAllocate = p.amountPaise;

      // Find all charges that still have outstanding balance at this point in the chronological simulation
      const eligibleCharges = normalizedCharges.filter(c => {
        const allocatedSum = chargeAllocationsSumMap.get(c.chargeId) || 0;
        const currentPaid = Math.max(allocatedSum, c.paidPaise || 0); // Include stored fallback
        return c.amountPaise - currentPaid > 0;
      });

      // Sort them using the deterministic waterfall priority
      eligibleCharges.sort((a, b) => sortChargesForWaterfallCompare(a, b));

      const mockAllocations: ChargeAllocation[] = [];
      for (const charge of eligibleCharges) {
        if (remainingToAllocate <= 0) break;

        const allocatedSum = chargeAllocationsSumMap.get(charge.chargeId) || 0;
        const currentPaid = Math.max(allocatedSum, charge.paidPaise || 0);
        const outstanding = charge.amountPaise - currentPaid;

        const pay = Math.min(remainingToAllocate, outstanding);
        chargeAllocationsSumMap.set(charge.chargeId, allocatedSum + pay);
        remainingToAllocate -= pay;

        mockAllocations.push({
          chargeId: charge.chargeId,
          amountPaise: pay
        });
      }
      p.allocatedCharges = mockAllocations;
      p.advancePaise = remainingToAllocate;
      runningAdvanceCreditPaise += remainingToAllocate;
    }
  });

  // 4. Update Charge States
  let totalBilledPaise = 0;
  const computedCharges: ComputedCharge[] = [];

  for (const charge of normalizedCharges) {
    totalBilledPaise += charge.amountPaise;

    const allocatedSum = chargeAllocationsSumMap.get(charge.chargeId) || 0;
    // Charge paid amount is the maximum of explicit allocations or stored paid amount (backwards compatibility)
    let paidPaise = Math.max(allocatedSum, charge.paidPaise || 0);
    paidPaise = Math.min(paidPaise, charge.amountPaise); // safety cap

    charge.paidPaise = paidPaise;
    const remainingPaise = charge.amountPaise - paidPaise;

    if (remainingPaise === 0) {
      charge.status = 'paid';
    } else if (paidPaise > 0) {
      charge.status = 'partially_paid';
    } else {
      charge.status = 'pending';
    }

    const dueDateObj = new Date(charge.dueDate);
    dueDateObj.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - dueDateObj.getTime();
    const dueDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const isOverdue = dueDays > 0 && remainingPaise > 0;

    computedCharges.push({
      ...charge,
      remainingPaise,
      dueDays,
      isOverdue
    });
  }

  // Authoritative outstanding balance is sum of remaining charges
  const outstandingPaise = computedCharges.reduce((sum, c) => sum + c.remainingPaise, 0);
  
  // Total allocated to all charges
  const totalAllocatedToAllCharges = computedCharges.reduce((sum, c) => sum + c.paidPaise, 0);
  // Derived advance credit is the remaining unallocated portion of all valid payments
  const advanceCreditPaise = Math.max(0, (totalPaidPaise - totalRefundsPaise) - totalAllocatedToAllCharges);

  // 5. Determine Overall Tenant Payment Status & Overdue Days
  const activeUnpaidCharges = computedCharges.filter(c => c.remainingPaise > 0);
  // Sort active unpaid charges by due date to get the oldest overdue days
  activeUnpaidCharges.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  let daysOverdue = 0;
  let nextDueDate: Date | null = null;
  let status: TenantFinancialState['status'] = 'UPCOMING';

  if (isVacated) {
    status = 'VACATED';
  } else if (isPaused) {
    status = 'PAUSED';
  } else if (outstandingPaise === 0) {
    status = 'PAID';
  } else {
    if (activeUnpaidCharges.length > 0) {
      const oldestUnpaid = activeUnpaidCharges[0];
      daysOverdue = oldestUnpaid.dueDays;
      nextDueDate = new Date(oldestUnpaid.dueDate);

      if (daysOverdue > 15) {
        status = 'CRITICAL';
      } else if (daysOverdue > 0) {
        status = 'OVERDUE';
      } else if (daysOverdue === 0) {
        status = 'DUE_TODAY';
      } else {
        status = 'UPCOMING';
      }
    }
  }

  const resultState: TenantFinancialState = {
    tenantId,
    totalBilledPaise,
    totalAdjustmentsPaise: 0,
    totalLateFeesPaise: 0,
    totalDiscountsPaise: 0,
    totalRefundsPaise,
    totalPaidPaise,
    outstandingPaise,
    advanceCreditPaise,
    charges: computedCharges,
    payments: normalizedPayments,
    status,
    daysOverdue,
    nextDueDate,
    isReconciled: true
  };

  // Enforce mathematical invariants
  const invariantCheck = verifyFinancialInvariants(resultState);
  if (!invariantCheck.valid) {
    resultState.isReconciled = false;
    resultState.reconciliationError = invariantCheck.error;
    console.error(`[FINANCIAL INVARIANT ERROR] Tenant ${tenantId}:`, invariantCheck.error);
  }

  return resultState;
}

export function sortChargesForWaterfallCompare(a: any, b: any): number {
  // 1. Compare due dates (oldest first)
  const dueA = new Date(a.dueDate || a.due_date || 0).getTime();
  const dueB = new Date(b.dueDate || b.due_date || 0).getTime();
  if (dueA !== dueB) return dueA - dueB;

  // 2. Type priority: security deposit -> monthly_rent -> opening-fee -> others
  const typePriority = (type: string) => {
    const t = String(type || '').toLowerCase();
    if (t === 'security_deposit' || t === 'security-deposit' || t === 'deposit') return 1;
    if (t === 'monthly_rent' || t === 'monthly-rent' || t === 'rent') return 2;
    if (t === 'opening-fee' || t === 'opening_balance' || t === 'opening-balance') return 3;
    return 4;
  };
  const prioA = typePriority(a.type);
  const prioB = typePriority(b.type);
  if (prioA !== prioB) return prioA - prioB;

  // 3. Fallback: creation date
  const createA = new Date(a.createdAt || a.created_at || 0).getTime();
  const createB = new Date(b.createdAt || b.created_at || 0).getTime();
  if (createA !== createB) return createA - createB;

  // 4. Final fallback: charge ID
  return String(a.chargeId || a.id).localeCompare(String(b.chargeId || b.id));
}

export interface AllocationInput {
  tenantId: string;
  paymentAmountPaise: number;
  pendingCharges: any[];
  selectedChargeIds?: string[];
}

export interface AllocationResult {
  paymentAmountPaise: number;
  allocations: Array<{
    chargeId: string;
    allocatedAmountPaise: number;
    remainingPaise: number;
    isFullyPaid: boolean;
  }>;
  unallocatedAmountPaise: number;
  remainingTenantDuePaise: number;
}

export function allocatePayment(input: AllocationInput): AllocationResult {
  const { paymentAmountPaise, pendingCharges, selectedChargeIds } = input;
  let remainingPaymentPaise = paymentAmountPaise;
  const allocations: AllocationResult['allocations'] = [];

  // Filter to charges with positive remaining balance
  const eligibleCharges = pendingCharges.map(c => {
    const amountPaise = c.amountPaise !== undefined ? c.amountPaise : parseMoneyToPaise(c.original_amount !== undefined ? c.original_amount : c.amount);
    const paidPaise = c.paidPaise !== undefined ? c.paidPaise : parseMoneyToPaise(c.amount_paid_paise !== undefined ? c.amount_paid_paise : (c.amount_paid !== undefined ? c.amount_paid : 0));
    return {
      ...c,
      chargeId: c.chargeId || c.payment_id || c.id,
      amountPaise,
      paidPaise,
      outstandingPaise: Math.max(0, amountPaise - paidPaise)
    };
  }).filter(c => c.outstandingPaise > 0);

  // If specific charges selected, restrict targets to those
  let targetCharges = eligibleCharges;
  const hasSpecificSelection = Array.isArray(selectedChargeIds) && selectedChargeIds.length > 0;
  if (hasSpecificSelection) {
    targetCharges = eligibleCharges.filter(c => selectedChargeIds.includes(c.chargeId));
  }

  // Sort targets using deterministic waterfall comparison
  targetCharges.sort((a, b) => sortChargesForWaterfallCompare(a, b));

  // Perform allocation
  for (const charge of targetCharges) {
    if (remainingPaymentPaise <= 0) break;

    const outstanding = charge.outstandingPaise;
    if (outstanding <= 0) continue;

    const pay = Math.min(remainingPaymentPaise, outstanding);
    const remaining = outstanding - pay;

    allocations.push({
      chargeId: charge.chargeId,
      allocatedAmountPaise: pay,
      remainingPaise: remaining,
      isFullyPaid: remaining === 0
    });

    remainingPaymentPaise -= pay;
  }

  // Compute remaining tenant total due
  const remainingTenantDuePaise = eligibleCharges.reduce((sum, c) => {
    const allocated = allocations.find(a => a.chargeId === c.chargeId)?.allocatedAmountPaise || 0;
    return sum + (c.outstandingPaise - allocated);
  }, 0);

  return {
    paymentAmountPaise,
    allocations,
    unallocatedAmountPaise: Math.max(0, remainingPaymentPaise),
    remainingTenantDuePaise
  };
}

export function allocatePaymentFIFO(
  amountPaise: number,
  pendingCharges: FinancialCharge[]
): {
  allocated: Array<{ chargeId: string; amountPaise: number; remainingPaise: number; isFullyPaid: boolean }>;
  advancePaise: number;
} {
  const res = allocatePayment({
    tenantId: '',
    paymentAmountPaise: amountPaise,
    pendingCharges: pendingCharges
  });

  return {
    allocated: res.allocations.map(a => ({
      chargeId: a.chargeId,
      amountPaise: a.allocatedAmountPaise,
      remainingPaise: a.remainingPaise,
      isFullyPaid: a.isFullyPaid
    })),
    advancePaise: res.unallocatedAmountPaise
  };
}

// -----------------------------------------------------------------------------
// RECONCILIATION ENGINE
// -----------------------------------------------------------------------------

export function reconcileTenantLedger(
  tenantId: string,
  storedOutstandingPaise: number | undefined,
  computedState: TenantFinancialState
): ReconciliationReport {
  const calculatedOutstandingPaise = computedState.outstandingPaise;
  
  if (storedOutstandingPaise === undefined) {
    return {
      tenantId,
      calculatedOutstandingPaise,
      differencePaise: 0,
      status: 'MATCH'
    };
  }

  const differencePaise = storedOutstandingPaise - calculatedOutstandingPaise;

  if (differencePaise === 0) {
    return {
      tenantId,
      storedOutstandingPaise,
      calculatedOutstandingPaise,
      differencePaise: 0,
      status: 'MATCH'
    };
  }

  return {
    tenantId,
    storedOutstandingPaise,
    calculatedOutstandingPaise,
    differencePaise,
    status: Math.abs(differencePaise) > 0 ? 'MISMATCH' : 'MATCH',
    details: `Stored Outstanding (${formatPaiseToINR(storedOutstandingPaise)}) != Calculated Outstanding (${formatPaiseToINR(calculatedOutstandingPaise)})`
  };
}

export interface IntegrityReport {
  tenantId: string;
  propertyId: string;
  calculatedOutstandingPaise: number;
  storedOutstandingPaise: number;
  hasMismatch: boolean;
  timestamp: string;
}

export function checkTenantFinancialIntegrity(
  tenant: any,
  rawCharges: any[],
  rawPayments: any[]
): IntegrityReport | null {
  const tenantId = tenant?.tenant_id || tenant?.id || '';
  const propertyId = tenant?.pg_id || '';
  
  const calculatedState = calculateTenantFinancialState(tenant, rawCharges, rawPayments);
  const calculatedOutstandingPaise = calculatedState.outstandingPaise;
  
  const storedOutstandingPaise = parseMoneyToPaise(
    tenant.outstanding_balance_paise !== undefined 
      ? tenant.outstanding_balance_paise 
      : (tenant.outstanding_balance !== undefined 
          ? tenant.outstanding_balance 
          : (tenant.pending_fee !== undefined ? tenant.pending_fee : null))
  );

  if (tenant.outstanding_balance_paise === undefined && 
      tenant.outstanding_balance === undefined && 
      tenant.pending_fee === undefined) {
    return null;
  }

  const hasMismatch = calculatedOutstandingPaise !== storedOutstandingPaise;
  
  if (hasMismatch) {
    console.error(`[CRITICAL FINANCIAL INCONSISTENCY] Mismatch detected for tenant ${tenantId}. Property: ${propertyId}. Calculated: ${calculatedOutstandingPaise}p, Stored: ${storedOutstandingPaise}p.`);
  }

  return {
    tenantId,
    propertyId,
    calculatedOutstandingPaise,
    storedOutstandingPaise,
    hasMismatch,
    timestamp: new Date().toISOString()
  };
}
