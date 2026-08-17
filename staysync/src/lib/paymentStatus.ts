export interface PaymentStatusInfo {
  pendingAmount: number;
  paidAmount: number;
  dueDate: Date | null;
  daysOverdue: number;
  status: 'PAID' | 'DUE_TODAY' | 'UPCOMING' | 'OVERDUE' | 'CRITICAL' | 'VACATED' | 'PAUSED';
  isVirtual: boolean;
  virtualMonth: string;
  virtualRentRemaining?: number;
}

const getNextUnpaidMonthAndDate = (t: any, tenantPaidPayments: any[], currentDate: Date) => {
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const shortMonthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  let targetDay = 5;
  if (t.move_in_date) {
    const checkin = new Date(t.move_in_date);
    if (!isNaN(checkin.getTime())) targetDay = checkin.getDate();
  } else if (t.created_at) {
    const created = new Date(t.created_at);
    if (!isNaN(created.getTime())) targetDay = created.getDate();
  }

  const today = new Date(currentDate);
  today.setHours(0,0,0,0);

  let nextDueDate = new Date(today);
  if (today.getDate() < targetDay) {
    nextDueDate.setDate(targetDay);
  } else {
    nextDueDate.setMonth(today.getMonth() + 1);
    nextDueDate.setDate(targetDay);
  }

  const parseNum = (val: any) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    return Number(val.toString().replace(/,/g, '')) || 0;
  };

  let virtualRentRemaining = parseNum(t.rent_amount) || parseNum(t.monthly_rent) || parseNum(t.rent) || 0;

  if (tenantPaidPayments && tenantPaidPayments.length > 0) {
    let maxIterations = 24;
    while (maxIterations > 0) {
      const currentMonthFull = monthNames[nextDueDate.getMonth()];
      const currentMonthShort = shortMonthNames[nextDueDate.getMonth()];
      const currentYear = nextDueDate.getFullYear();

      const rentPaymentsForMonth = tenantPaidPayments.filter((p: any) => {
        const m = (p.month || p.description || '').toLowerCase();
        if (p.type === 'security_deposit' || p.type === 'security-deposit' || m.includes('deposit') || m.includes('opening')) return false;
        if (p.type === 'one-time' || m.includes('bill') || m.includes('extra')) return false;
        
        const hasMonth = m.includes(currentMonthFull.toLowerCase()) || m.includes(currentMonthShort.toLowerCase());
        const hasYear = m.includes(currentYear.toString());
        const containsAnyYear = /202\d/.test(m);
        
        return containsAnyYear ? (hasMonth && hasYear) : hasMonth;
      });

      const amountPaidForMonth = rentPaymentsForMonth.reduce((sum, p) => sum + parseNum(p.amount_paid || p.amount), 0);
      const rentAmount = parseNum(t.rent_amount) || parseNum(t.monthly_rent) || parseNum(t.rent) || 0;

      if (rentAmount > 0 && amountPaidForMonth >= rentAmount) {
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
        maxIterations--;
      } else {
        virtualRentRemaining = Math.max(0, rentAmount - amountPaidForMonth);
        break;
      }
    }
  }

  nextDueDate.setHours(0,0,0,0);
  const diffTime = today.getTime() - nextDueDate.getTime();
  const dueDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return {
    dueDays,
    nextDueDate,
    monthShort: nextDueDate.toLocaleString('default', { month: 'short' }),
    virtualRentRemaining
  };
};

export function getTenantPaymentStatus(
  tenant: any,
  allPendingDues: any[],
  allPaidPayments: any[],
  currentDate: Date = new Date()
): PaymentStatusInfo {
  const isVacated = tenant.is_active === false || tenant.status === 'vacated' || tenant.status === 'Vacated' || tenant.status === 'VACATED';
  const isPaused = tenant.status === 'PAUSED' || tenant.status === 'Paused' || tenant.status === 'paused';

  const tenantPendingDues = allPendingDues.filter(d => 
    d.tenant_id === tenant.tenant_id || d.tenant_id === tenant.id
  ).sort((a: any, b: any) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

  const tenantPaid = allPaidPayments.filter(p => 
    (p.tenant_id === tenant.tenant_id || p.tenant_id === tenant.id) && 
    p.status !== 'pending'
  );

  const parseNum = (val: any) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    return Number(val.toString().replace(/,/g, '')) || 0;
  };

  const pendingAmount = tenantPendingDues.reduce((acc, d) => acc + parseNum(d.amount), 0);
  const paidAmount = tenantPaid.reduce((acc, p) => acc + parseNum(p.amount_paid || p.amount), 0);

  let dueDate: Date | null = null;
  let daysOverdue = 0;
  let status: PaymentStatusInfo['status'] = 'UPCOMING';
  let isVirtual = false;
  let virtualMonth = '';

  const today = new Date(currentDate);
  today.setHours(0,0,0,0);

  let virtualRentRemaining = 0;

  if (isVacated) {
    return { pendingAmount, paidAmount, dueDate: null, daysOverdue: 0, status: 'VACATED', isVirtual: false, virtualMonth: '', virtualRentRemaining: 0 };
  }
  
  if (isPaused) {
    return { pendingAmount, paidAmount, dueDate: null, daysOverdue: 0, status: 'PAUSED', isVirtual: false, virtualMonth: '', virtualRentRemaining: 0 };
  }

  // 1. Check if there are explicit pending dues (invoices)
  if (tenantPendingDues.length > 0) {
    const oldestDue = tenantPendingDues[0];
    let targetDay = 5;
    if (oldestDue.move_in_date || tenant.move_in_date) {
      const checkin = new Date(oldestDue.move_in_date || tenant.move_in_date);
      if (!isNaN(checkin.getTime())) targetDay = checkin.getDate();
    }

    if (oldestDue.due_date) {
      dueDate = new Date(oldestDue.due_date);
    } else {
      dueDate = new Date(oldestDue.created_at || Date.now());
      dueDate.setDate(targetDay);
    }
    dueDate.setHours(0,0,0,0);

    const diffTime = today.getTime() - dueDate.getTime();
    daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } else {
    // 2. If no explicit invoice, calculate dynamically
    const unpaidInfo = getNextUnpaidMonthAndDate(tenant, tenantPaid, currentDate);
    daysOverdue = unpaidInfo.dueDays;
    dueDate = unpaidInfo.nextDueDate;
    virtualMonth = unpaidInfo.monthShort;
    virtualRentRemaining = unpaidInfo.virtualRentRemaining;
    isVirtual = true;
  }

  if (daysOverdue > 30) {
    status = 'CRITICAL';
  } else if (daysOverdue > 0) {
    status = 'OVERDUE';
  } else if (daysOverdue === 0) {
    status = 'DUE_TODAY';
  } else {
    status = 'UPCOMING';
    daysOverdue = Math.abs(daysOverdue); // If upcoming, return positive days until due
  }

  return {
    pendingAmount,
    paidAmount,
    dueDate,
    daysOverdue,
    status,
    isVirtual,
    virtualMonth,
    virtualRentRemaining
  };
}
