export interface PaymentStatusInfo {
  pendingAmount: number;
  paidAmount: number;
  dueDate: Date | null;
  daysOverdue: number;
  status: 'PAID' | 'DUE_TODAY' | 'UPCOMING' | 'OVERDUE' | 'CRITICAL' | 'VACATED' | 'PAUSED';
  isVirtual: boolean;
  virtualMonth: string;
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

  if (tenantPaidPayments && tenantPaidPayments.length > 0) {
    const paidMonths = tenantPaidPayments.map((p: any) => p.month).filter(Boolean);

    let maxIterations = 24;
    while (maxIterations > 0) {
      const currentMonthFull = monthNames[nextDueDate.getMonth()];
      const currentMonthShort = shortMonthNames[nextDueDate.getMonth()];

      const isAlreadyPaid = paidMonths.some((m: string) => {
        if (!m) return false;
        const lowerM = m.toLowerCase();
        return (
          lowerM.includes(currentMonthFull.toLowerCase()) || 
          lowerM.includes(currentMonthShort.toLowerCase())
        );
      });

      if (isAlreadyPaid) {
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
        maxIterations--;
      } else {
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
    monthShort: nextDueDate.toLocaleString('default', { month: 'short' })
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

  const pendingAmount = tenantPendingDues.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
  const paidAmount = tenantPaid.reduce((acc, p) => acc + (Number(p.amount_paid || p.amount) || 0), 0);

  let dueDate: Date | null = null;
  let daysOverdue = 0;
  let status: PaymentStatusInfo['status'] = 'UPCOMING';
  let isVirtual = false;
  let virtualMonth = '';

  const today = new Date(currentDate);
  today.setHours(0,0,0,0);

  if (isVacated) {
    return { pendingAmount, paidAmount, dueDate: null, daysOverdue: 0, status: 'VACATED', isVirtual: false, virtualMonth: '' };
  }
  
  if (isPaused) {
    return { pendingAmount, paidAmount, dueDate: null, daysOverdue: 0, status: 'PAUSED', isVirtual: false, virtualMonth: '' };
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
    virtualMonth
  };
}
