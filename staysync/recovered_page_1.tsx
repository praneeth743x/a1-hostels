"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCircle, Search, Filter, Phone, Building2, MessageCircle } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getPendingDues } from '@/app/actions/pgowner';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './dues.module.css';
import { sendRentReminderWithLink } from '@/lib/whatsapp';
import { AnimatedButton } from '@/components/AnimatedButton';
import { IndianRupee, X, XCircle } from 'lucide-react';
import { markPaymentPaid, recordPartialPayment, getTenants, collectUpcomingPayment, collectFIFOPayment, getPaymentHistory } from '@/app/actions/pgowner';
import { CustomSelect } from '@/components/CustomSelect';
import { Users, Clock } from 'lucide-react';

const WhatsappIcon = ({ size = 24, color = "currentColor", fill = "currentColor" }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={fill} xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.82 9.82 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
  </svg>
);

export default function DuesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [dues, setDues] = useState<any[]>([]);
  const [paidPayments, setPaidPayments] = useState<any[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [confirmingAction, setConfirmingAction] = useState<{ id: string, type: 'full' | 'settle' | 'partial' } | null>(null);
  const [collectedAmount, setCollectedAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [isCollecting, setIsCollecting] = useState(false);
  const [tenants, setTenants] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ status: 'All', duration: 'All', month: '' });
  const [localFilters, setLocalFilters] = useState({ status: 'All', duration: 'All', month: '' });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setOwnerId(user.uid);
        await fetchDues(user.uid);
      } else {
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchDues = async (uid: string) => {
    try {
      let currentId = searchParams.get('pgId');
      if (!currentId && typeof localStorage !== 'undefined') {
         currentId = localStorage.getItem('activePgId');
      }
      
      // Fetch tenants to calculate payment stats
      const tenantsRes = await getTenants(uid, currentId);
      if (tenantsRes.success && tenantsRes.data) {
        setTenants(tenantsRes.data);
      }

      // Fetch paid payments to accurately compute next unpaid due dates
      const historyRes = await getPaymentHistory(uid, currentId);
      if (historyRes.success && historyRes.data) {
        setPaidPayments(historyRes.data);
      }

      const res = await getPendingDues(uid, currentId);
      if (res.success && res.data) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const groupedMap = new Map<string, any>();

        res.data.forEach((p: any) => {
          const createdAt = new Date(p.created_at || Date.now());
          const dueDate = new Date(createdAt);
          
          let targetDay = 5; // Fallback
          if (p.move_in_date) {
            const checkin = new Date(p.move_in_date);
            if (!isNaN(checkin.getTime())) {
              targetDay = checkin.getDate();
            }
          }
          
          dueDate.setDate(targetDay);
          dueDate.setHours(0, 0, 0, 0);

          const diffTime = today.getTime() - dueDate.getTime();
          const dueDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const amount = p.amount || 0;

          if (!groupedMap.has(p.tenant_id)) {
            const tenant = tenantsRes.data?.find((t: any) => t.tenant_id === p.tenant_id);
            const tenantStatus = tenant ? (tenant.is_active === false ? 'Vacated' : (tenant.status === 'notice_period' ? 'Notice Period' : 'Active')) : 'Unknown';
            
            groupedMap.set(p.tenant_id, {
              tenant_id: p.tenant_id,
              tenant_name: p.tenant_name,
              tenant_phone: p.tenant_phone,
              room_number: p.room_number,
              tenantStatus,
              totalAmount: 0,
              oldestDueDays: dueDays,
              charges: []
            });
          }
          
          const group = groupedMap.get(p.tenant_id);
          group.totalAmount += amount;
          if (dueDays > group.oldestDueDays) {
            group.oldestDueDays = dueDays;
          }
          // Sort charges internally by created_at later if needed
          group.charges.push({ ...p, dueDays });
        });

        const processed = Array.from(groupedMap.values()).map(g => {
          g.charges.sort((a: any, b: any) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
          
          return {
            ...g,
            amount: g.totalAmount,
            dueDays: g.oldestDueDays,
            isOverdue: g.oldestDueDays > 0,
            payment_id: g.tenant_id, // Use tenant_id as the key for expanding the card
            month: g.charges.length > 1 ? `${g.charges.length} Pending Charges` : g.charges[0]?.month || 'Unknown'
          };
        });

        // Sort: Highest overdue days first, then lowest upcoming days
        processed.sort((a: any, b: any) => b.dueDays - a.dueDays);
        setDues(processed);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const getNextUnpaidMonthAndDate = (t: any, tenantPaidPayments: any[]) => {
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

    const today = new Date();
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
    const diffTime = nextDueDate.getTime() - today.getTime();
    const dueDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
      dueDays,
      monthShort: nextDueDate.toLocaleString('default', { month: 'short' })
    };
  };

  const handleRemind = async (due: any) => {
    if (!due.tenant_phone) {
      alert("No phone number available for this tenant.");
      return;
    }
    const res = await sendRentReminderWithLink(
      due.tenant_phone, 
      due.tenant_name, 
      due.amount, 
      due.month || 'this month', 
      due.payment_id
    );
    if (res.success) {
      alert(`Reminder sent to ${due.tenant_name}`);
    } else {
      alert(`Failed to send reminder: ${res.error}`);
    }
  };

  const handleBulkRemind = async () => {
    const overdueDues = dues.filter((d: any) => d.isOverdue);
    if (overdueDues.length === 0) {
      alert("No overdue tenants to remind.");
      return;
    }
    const confirm = window.confirm(`Send WhatsApp reminders to ${overdueDues.length} overdue tenants?`);
    if (!confirm) return;

    let successCount = 0;
    let failCount = 0;
    for (const due of overdueDues) {
      if (due.tenant_phone) {
        const res = await sendRentReminderWithLink(
          due.tenant_phone, 
          due.tenant_name, 
          due.amount, 
          due.month || 'this month', 
          due.payment_id
        );
        if (res.success) successCount++;
        else failCount++;
      } else {
        failCount++;
      }
    }
    alert(`Bulk reminder complete. ${successCount} sent, ${failCount} failed.`);
  };

  const handleSettle = async (e: React.MouseEvent | React.FormEvent, due: any, type: 'full' | 'settle') => {
    e.preventDefault();
    if (!confirmingAction || confirmingAction.id !== due.payment_id || confirmingAction.type !== type) {
      setConfirmingAction({ id: due.payment_id, type });
      return;
    }

    setIsCollecting(true);
    const finalCollected = typeof collectedAmount === 'number' ? collectedAmount : due.amount;
    
    const pgId = tenants.find(t => t.tenant_id === due.tenant_id)?.pg_id || localStorage.getItem('activePgId') || '';
    const res = await collectFIFOPayment(due.tenant_id, finalCollected, paymentMethod, pgId);
    
    if (res.success) {
      setExpandedCardId(null);
      setConfirmingAction(null);
      setCollectedAmount('');
      if (ownerId) fetchDues(ownerId);
    } else {
      alert("Failed to collect payment: " + res.error);
    }
    setIsCollecting(false);
  };

  const handlePartial = async (e: React.MouseEvent, due: any) => {
    e.preventDefault();
    if (typeof collectedAmount !== 'number' || collectedAmount <= 0) {
      alert("Please enter a valid partial amount.");
      return;
    }
    if (!confirmingAction || confirmingAction.id !== due.payment_id || confirmingAction.type !== 'partial') {
      setConfirmingAction({ id: due.payment_id, type: 'partial' });
      return;
    }
    setIsCollecting(true);
    
    const pgId = tenants.find(t => t.tenant_id === due.tenant_id)?.pg_id || localStorage.getItem('activePgId') || '';
    const res = await collectFIFOPayment(due.tenant_id, collectedAmount, paymentMethod, pgId);
    
    if (res.success) {
      setExpandedCardId(null);
      setConfirmingAction(null);
      setCollectedAmount('');
      if (ownerId) fetchDues(ownerId);
    } else {
      alert("Failed to record partial payment: " + res.error);
    }
    setIsCollecting(false);
  };

  if (isLoading) {
    return (
      <div className={styles.container} style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  const activeTenants = tenants.filter(t => t.is_active);
  const pendingDueTenantIds = new Set(dues.map(d => d.tenant_id));
  
  const paidCount = activeTenants.filter(t => !pendingDueTenantIds.has(t.tenant_id)).length;
  
  const dueCount = activeTenants.filter(t => pendingDueTenantIds.has(t.tenant_id)).length;

  const combinedList = [...dues];

  activeTenants.forEach(t => {
    if (!pendingDueTenantIds.has(t.tenant_id)) {
      const tenantPaid = paidPayments.filter((p: any) => p.tenant_id === t.tenant_id);
      const { dueDays, monthShort } = getNextUnpaidMonthAndDate(t, tenantPaid);

      combinedList.push({
        payment_id: `paid-${t.tenant_id}`,
        tenant_id: t.tenant_id,
        tenant_name: t.full_name,
        room_number: t.rooms?.room_number || 'N/A',
        amount: t.rent_amount || 0,
        month: monthShort,
        dueDays,
        tenantStatus: getTenantStatus(t),
        isOverdue: false,
        isFullyPaid: false,
        tenant_phone: t.mobile
      });
    }
  });

  const filteredList = combinedList.filter(item => {
     const matchesSearch = item.tenant_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.room_number?.toString().toLowerCase().includes(searchTerm.toLowerCase());
     
     let matchesStatus = false;
     if (filters.status === 'All') {
       if (item.tenantStatus === 'Vacated' && !pendingDueTenantIds.has(item.tenant_id)) {
         matchesStatus = false;
       } else {
         matchesStatus = true;
       }
     } else {
       matchesStatus = item.tenantStatus === filters.status;
     }
     
     let matchesDuration = true;
     if (filters.duration === 'Overdue') {
       matchesDuration = item.isOverdue;
     } else if (filters.duration === 'Over 1 week') {
       matchesDuration = item.isOverdue && item.dueDays > 7;
     } else if (filters.duration === 'Over 2 weeks') {
       matchesDuration = item.isOverdue && item.dueDays > 14;
     } else if (filters.duration === 'Over 1 month') {
       matchesDuration = item.isOverdue && item.dueDays > 30;
     }

     let matchesMonth = true;
     if (filters.month) {
       const date = new Date(filters.month + "-01");
       const longMonth = date.toLocaleString('default', { month: 'long' }).toLowerCase();
       const shortMonth = date.toLocaleString('default', { month: 'short' }).toLowerCase();
       const itemMonth = (item.month || '').toLowerCase();
       matchesMonth = itemMonth.includes(longMonth) || itemMonth.includes(shortMonth);
     }

     return matchesSearch && matchesStatus && matchesDuration && matchesMonth;
  });

  const totalPendingFee = dues.reduce((sum, d) => sum + (d.amount || 0), 0);

  return (
    <div className={styles.container}>

      <AnimatePresence>
        {isFilterOpen && (
          <>
            <motion.div 
              className={styles.modalOverlay}
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsFilterOpen(false)}
            />
            <motion.div
              className={styles.filterModal}
              initial={{ y: '100%' }} 
              animate={{ y: 0 }} 
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              <div className={styles.modalHeader}>
                <h2>Filters</h2>
                <button 
                  onClick={() => setLocalFilters({ status: 'All', duration: 'All', month: '' })} 
                  className={styles.resetBtn}
                >
                  Reset
                </button>
              </div>

              <div className={styles.modalBody}>
                <div className={styles.filterSection}>
                  <h3>Tenant Status</h3>
                  <div className={styles.optionsGrid}>
                    {['All', 'Active', 'Notice Period', 'Vacated'].map(opt => (
                      <button 
                        key={opt} 
                        className={`${styles.filterOptionBtn} ${localFilters.status === opt ? styles.selected : ''}`}
                        onClick={() => setLocalFilters({...localFilters, status: opt})}
                      >
                        {opt === 'All' ? 'All Status' : opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.filterSection}>
                  <h3>Due Duration</h3>
                  <div className={styles.optionsGrid}>
                    {['All', 'Overdue', 'Over 1 week', 'Over 2 weeks', 'Over 1 month'].map(opt => (
                      <button 
                        key={opt} 
                        className={`${styles.filterOptionBtn} ${localFilters.duration === opt ? styles.selected : ''}`}
                        onClick={() => setLocalFilters({...localFilters, duration: opt})}
                      >
                        {opt === 'All' ? 'Any Duration' : opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.filterSection}>
                  <h3>Select Month</h3>
                  <input 
                    type="month" 
                    value={localFilters.month} 
                    onChange={(e) => setLocalFilters({...localFilters, month: e.target.value})}
                    style={{ padding: '10px 14px', borderRadius: '12px', border: '1px solid #e2e8f0', width: '100%', fontSize: '0.9rem', color: '#0f172a', outline: 'none' }}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button className={styles.cancelBtn} onClick={() => setIsFilterOpen(false)}>Cancel</button>
                <button 
                  className={styles.applyBtn} 
                  onClick={() => {
                    setFilters(localFilters);
                    setIsFilterOpen(false);
                  }}
                >
                  Apply Filters
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className={styles.statsContainer}>
        <div className={styles.totalCardHalf}>
          <div className={styles.totalTitle}>Total Pending Fee</div>
          <div className={styles.totalAmount}>₹{totalPendingFee.toLocaleString('en-IN')}</div>
        </div>
        <button 
          className={styles.bulkRemindBtn} 
          onClick={handleBulkRemind}
          title="Remind All Overdue"
        >
          <WhatsappIcon size={24} color="white" />
        </button>
      </div>


      {/* Payment Status (Smaller Cards) */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <motion.div 
          style={{ flex: 1, background: 'linear-gradient(145deg, #ffffff, #f8fafc)', borderRadius: '16px', height: '85px', boxShadow: '0 8px 24px rgba(15,23,42,0.1)', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px 4px', textAlign: 'center' }}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 20 }}
        >
          <div style={{ color: '#10b981', marginBottom: 4 }}><CheckCircle size={20} strokeWidth={2.5} /></div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', lineHeight: 1, marginBottom: '4px' }}>
            {paidCount}
          </div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Paid</div>
        </motion.div>

        <motion.div 
          style={{ flex: 1, background: 'linear-gradient(145deg, #ffffff, #f8fafc)', borderRadius: '16px', height: '85px', boxShadow: '0 8px 24px rgba(15,23,42,0.1)', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px 4px', textAlign: 'center' }}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 20 }}
        >
          <div style={{ color: '#ef4444', marginBottom: 4 }}><XCircle size={20} strokeWidth={2.5} /></div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', lineHeight: 1, marginBottom: '4px' }}>
            {dueCount}
          </div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Due</div>
        </motion.div>
      </div>

      <div style={{ marginTop: '8px' }}>
        {(filters.status !== 'All' || filters.duration !== 'All' || filters.month !== '') && (
          <div className={styles.activeFiltersRow}>
            <div className={styles.activeFiltersScroll}>
              {filters.status !== 'All' && (
                <div className={styles.activeFilterChip}>
                  {filters.status} <button onClick={() => setFilters({...filters, status: 'All'})}><X size={12}/></button>
                </div>
              )}
              {filters.duration !== 'All' && (
                <div className={styles.activeFilterChip}>
                  {filters.duration} <button onClick={() => setFilters({...filters, duration: 'All'})}><X size={12}/></button>
                </div>
              )}
              {filters.month !== '' && (
                <div className={styles.activeFilterChip}>
                  {new Date(filters.month + "-01").toLocaleString('default', { month: 'short', year: 'numeric' })} <button onClick={() => setFilters({...filters, month: ''})}><X size={12}/></button>
                </div>
              )}
            </div>
            <button className={styles.clearAllFilters} onClick={() => setFilters({ status: 'All', duration: 'All', month: '' })}>
              Clear All
            </button>
          </div>
        )}

        <div className={styles.searchRow}>
          <div className={styles.searchWrapper}>
            <Search size={18} className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Search by name or room..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          <button className={styles.filterBtnSmall} onClick={() => { setLocalFilters(filters); setIsFilterOpen(true); }}>
            <Filter size={20} />
          </button>
        </div>
      </div>

      {filteredList.length === 0 ? (
        <div className={styles.emptyState}>
          <CheckCircle size={48} color="#10b981" />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0, color: '#0f172a' }}>All Clear!</h2>
          <p style={{ margin: 0 }}>No tenants or dues match your search.</p>
        </div>
      ) : (
        <div className={styles.list}>
          <AnimatePresence>
            {filteredList.map((due) => (
              <motion.div
                key={due.payment_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`${styles.card} ${due.isOverdue ? styles.cardOverdue : due.isFullyPaid ? styles.cardPaid : styles.cardUpcoming}`}
              >
                <div className={styles.cardTop}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className={styles.avatarCircle} style={{ 
                       background: due.isOverdue ? '#fef2f2' : due.isFullyPaid ? '#eff6ff' : '#fffbeb',
                       color: due.isOverdue ? '#ef4444' : due.isFullyPaid ? '#3b82f6' : '#f59e0b'
                    }}>
                      {due.tenant_name?.charAt(0).toUpperCase()}
                    </div>
                    <div className={styles.tenantInfo}>
                      <h3 className={styles.tenantName}>{due.tenant_name}</h3>
                      <div className={styles.roomInfo}>
                        Room {due.room_number} &bull; {due.month}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className={styles.amount} style={{ color: due.isOverdue ? '#ef4444' : '#0f172a' }}>₹{due.amount}</div>
                    <div className={`${styles.badge} ${due.isOverdue ? styles.badgeOverdue : due.isFullyPaid ? styles.badgePaid : styles.badgeUpcoming}`}>
                      {due.isOverdue ? `Overdue by ${due.dueDays} days` : due.dueDays === 0 ? `Due Today` : `Next Due in ${Math.abs(due.dueDays)} days`}
                    </div>
                  </div>
                </div>

                {!due.isFullyPaid && (
                  <div className={styles.cardBottom}>
                    <button 
                      className={styles.remindBtn}
                      onClick={() => handleRemind(due)}
                    >
                      <Bell size={14} />
                      Remind
                    </button>
                    <button 
                      className={styles.collectBtn}
                      onClick={() => {
                        if (expandedCardId === due.payment_id) {
                          setExpandedCardId(null);
                          setConfirmingAction(null);
                        } else {
                          setExpandedCardId(due.payment_id);
                          setConfirmingAction(null);
                          setCollectedAmount(due.amount);
                        }
                      }}
                    >
                      <IndianRupee size={14} />
                      Collect
                    </button>
                  </div>
                )}
                
                {/* Expanding Collect Form */}
                <AnimatePresence>
                  {expandedCardId === due.payment_id && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '16px', paddingTop: '16px' }}>
                        {due.charges && due.charges.length > 0 && (
                          <div style={{ marginBottom: '16px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '8px', marginTop: 0 }}>Outstanding Breakdown</h4>
                            {due.charges.map((charge: any, idx: number) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#64748b', marginBottom: '4px' }}>
                                <span>{charge.month} {charge.type === 'opening-fee' ? '(Opening Balance)' : ''}</span>
                                <span style={{ fontWeight: 500, color: '#0f172a' }}>₹{charge.amount}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Amount to Collect (₹)</label>
                              <input 
                                type="number" 
                                placeholder={due.amount.toString()}
                                value={collectedAmount}
                                onChange={(e) => setCollectedAmount(e.target.value === '' ? '' : Number(e.target.value))}
                                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }}
                                required
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Payment Method</label>
                              <CustomSelect 
                                value={paymentMethod}
                                onChange={(val) => setPaymentMethod(val)}
                                options={[
                                  { value: 'UPI', label: 'UPI' },
                                  { value: 'Cash', label: 'Cash' },
                                  { value: 'Bank Transfer', label: 'Bank Transfer' }
                                ]}
                              />
                            </div>
                          </div>

                          {typeof collectedAmount === 'number' && collectedAmount < due.amount ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {confirmingAction?.id === due.payment_id && confirmingAction?.type === 'settle' ? (
                                <div style={{ display: 'flex', gap: '10px' }}>
                                  <AnimatedButton variant="danger" type="button" onClick={(e) => handleSettle(e, due, 'settle')} isLoading={isCollecting} style={{ flex: 1 }}>
                                    Confirm Settle
                                  </AnimatedButton>
                                  <AnimatedButton variant="outline" type="button" onClick={() => setConfirmingAction(null)} style={{ flex: 1 }}>
                                    Cancel
                                  </AnimatedButton>
                                </div>
                              ) : confirmingAction?.id === due.payment_id && confirmingAction?.type === 'partial' ? (
                                <div style={{ display: 'flex', gap: '10px' }}>
                                  <AnimatedButton variant="primary" type="button" onClick={(e) => handlePartial(e, due)} isLoading={isCollecting} style={{ flex: 1 }}>
                                    Confirm Partial
                                  </AnimatedButton>
                                  <AnimatedButton variant="outline" type="button" onClick={() => setConfirmingAction(null)} style={{ flex: 1 }}>
                                    Cancel
                                  </AnimatedButton>
                                </div>
                              ) : (
                                <>
                                  <AnimatedButton variant="primary" type="button" onClick={(e) => handlePartial(e, due)} isLoading={isCollecting} style={{ width: '100%' }}>
                                    Record Partial Payment
                                  </AnimatedButton>
                                  <AnimatedButton variant="secondary" type="button" onClick={(e) => handleSettle(e, due, 'settle')} isLoading={isCollecting} style={{ width: '100%' }}>
                                    Settle Month
                                  </AnimatedButton>
                                </>
                              )}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {confirmingAction?.id === due.payment_id && confirmingAction?.type === 'full' ? (
                                <div style={{ display: 'flex', gap: '10px' }}>
                                  <AnimatedButton variant="success" type="button" onClick={(e) => handleSettle(e, due, 'full')} isLoading={isCollecting} style={{ flex: 1 }}>
                                    Confirm Payment
                                  </AnimatedButton>
                                  <AnimatedButton variant="outline" type="button" onClick={() => setConfirmingAction(null)} style={{ flex: 1 }}>
                                    Cancel
                                  </AnimatedButton>
                                </div>
                              ) : (
                                <AnimatedButton variant="success" type="button" onClick={(e) => handleSettle(e, due, 'full')} isLoading={isCollecting} style={{ width: '100%' }}>
                                  Confirm Payment
                                </AnimatedButton>
                              )}
                            </div>
                          )}
                        </form>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
