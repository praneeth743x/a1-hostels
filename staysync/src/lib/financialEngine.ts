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
  const chargesMap = new Map<string, FinancialCharge>();
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

    const charge: FinancialCharge = {
      chargeId,
      tenantId,
      pgId: c.pg_id || tenant?.pg_id,
      type: (c.type || 'monthly_rent') as ChargeType,
      billingPeriod: c.billing_period || c.month,
      description: c.description || c.type || 'Rent Charge',
      amountPaise,
      paidPaise: 0, // Will be computed deterministically from payments
      dueDate,
      status: 'pending',
      createdAt: c.created_at || c.createdAt || new Date().toISOString(),
      isVirtual: c.is_virtual || c.isVirtual || false
    };

    chargesMap.set(chargeId, charge);
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
    if (status === 'pending' || status === 'overdue' || status === 'settled' || status === 'failed') return; // Invoices/charges are in charges, not payments

    const pId = p.payment_id || p.id;
    if (pId && allocatedChargeIds.has(pId)) return; // Exclude charge document that was allocated/paid by a receipt

    const isReversed = status === 'reversed' || p.is_reversed === true;
    const isRefund = status === 'refunded' || p.is_refund === true;

    const amountPaise = parseMoneyToPaise(p.amount_paid !== undefined ? p.amount_paid : p.amount);
    if (amountPaise <= 0) return;

    const payment: FinancialPayment = {
      paymentId: p.payment_id || p.id || `payment_${normalizedPayments.length + 1}`,
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
      advancePaise: 0,
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

  // 3. Sort Charges by Priority (Security Deposit -> Monthly Rent -> Others), then chronologically
  normalizedCharges.sort((a, b) => sortChargesByPriorityCompare(a, b));

  // 4. Deterministic FIFO Payment Allocation across charges
  let availablePaymentPoolPaise = Math.max(0, totalPaidPaise - totalRefundsPaise);
  let totalBilledPaise = 0;
  const computedCharges: ComputedCharge[] = [];

  for (const charge of normalizedCharges) {
    totalBilledPaise += charge.amountPaise;

    const allocatedToThisCharge = Math.min(availablePaymentPoolPaise, charge.amountPaise);
    charge.paidPaise = allocatedToThisCharge;
    availablePaymentPoolPaise -= allocatedToThisCharge;

    const remainingPaise = Math.max(0, charge.amountPaise - allocatedToThisCharge);
    if (remainingPaise === 0) {
      charge.status = 'paid';
    } else if (allocatedToThisCharge > 0) {
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

  // Any leftover payment in the pool is Advance Credit
  const advanceCreditPaise = availablePaymentPoolPaise;
  const outstandingPaise = computedCharges.reduce((sum, c) => sum + c.remainingPaise, 0);

  // 5. Determine Overall Tenant Payment Status & Overdue Days
  const activeUnpaidCharges = computedCharges.filter(c => c.remainingPaise > 0);
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
    // Find oldest unpaid charge
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

// -----------------------------------------------------------------------------
// FIFO ALLOCATOR FOR SINGLE PAYMENT TRANSACTION
// -----------------------------------------------------------------------------

/**
 * Calculates exactly how a newly submitted payment amount will be distributed
 * across existing pending charges in FIFO order without floating-point errors.
 */
export function allocatePaymentFIFO(
  amountPaise: number,
  pendingCharges: FinancialCharge[]
): {
  allocated: Array<{ chargeId: string; amountPaise: number; remainingPaise: number; isFullyPaid: boolean }>;
  advancePaise: number;
} {
  let remainingPaymentPaise = amountPaise;
  const allocated: Array<{ chargeId: string; amountPaise: number; remainingPaise: number; isFullyPaid: boolean }> = [];

  const sortedCharges = [...pendingCharges].sort((a, b) => sortChargesByPriorityCompare(a, b));

  for (const charge of sortedCharges) {
    if (remainingPaymentPaise <= 0) break;

    const chargeDuePaise = Math.max(0, charge.amountPaise - (charge.paidPaise || 0));
    if (chargeDuePaise <= 0) continue;

    const payTowardsThis = Math.min(remainingPaymentPaise, chargeDuePaise);
    const newRemaining = chargeDuePaise - payTowardsThis;
    
    allocated.push({
      chargeId: charge.chargeId,
      amountPaise: payTowardsThis,
      remainingPaise: newRemaining,
      isFullyPaid: newRemaining === 0
    });

    remainingPaymentPaise -= payTowardsThis;
  }

  return {
    allocated,
    advancePaise: Math.max(0, remainingPaymentPaise)
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
