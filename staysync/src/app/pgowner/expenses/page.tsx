"use client";

// Expenses Page - Recorded expenses are permanent
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, IndianRupee, Tag, Calendar, Loader2, Wallet, Plus, Check, Filter } from 'lucide-react';
import { CustomDatePicker } from '@/components/CustomDatePicker';
import { CustomSelect } from '@/components/CustomSelect';
import { rpcCall } from '@/lib/rpc';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useHostel, usePermissions } from '@/context/HostelContext';
import { PERMISSIONS } from '@/constants/permissions';
import ProtectedRoute from '@/components/ProtectedRoute';
import { SelectHostelPrompt } from '@/components/SelectHostelPrompt';
import styles from './expenses.module.css';
import { navTracer } from '@/lib/navTracer';
import { Suspense } from 'react';

const CATEGORIES = [
  { id: 'Groceries', label: '🛒 Groceries' },
  { id: 'Electricity', label: '⚡ Electricity' },
  { id: 'Water', label: '💧 Water' },
  { id: 'Internet/Wifi', label: '📶 Internet/Wifi' },
  { id: 'Maintenance', label: '🔧 Maintenance' },
  { id: 'Salaries', label: '👨‍🍳 Staff Salary' },
  { id: 'Rent', label: '🏠 Property Rent' },
  { id: 'Other', label: '📦 Other' }
];

function ExpensesPageContent() {
  navTracer.mark('t6_pageComponentRender', 'ExpensesPageContent');

  const { properties: storeProperties, selectedPgId, selectedProperty, currentUser, userProfile } = useHostel();
  const { hasPermission } = usePermissions();
  const [properties, setProperties] = useState<any[]>(storeProperties || []);
  const [selectedPg, setSelectedPg] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('activePgId') || selectedPgId || (storeProperties?.[0]?.pg_id || '');
    }
    return selectedPgId || '';
  });
  const [date, setDate] = useState<Date | null>(new Date());
  const [amount, setAmount] = useState<number | ''>('');
  const [category, setCategory] = useState<string>('Groceries');
  const [ownerId, setOwnerId] = useState<string | null>(() => {
    return currentUser?.uid || auth.currentUser?.uid || null;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [expensesList, setExpensesList] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');

  const [feedbackToast, setFeedbackToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    navTracer.mark('t8_skeletonFirstPaint', 'ExpensesPageContent mounted');
    navTracer.mark('t11_pageCommitted', 'ExpensesPageContent committed');
  }, []);

  useEffect(() => {
    if (storeProperties && storeProperties.length > 0) {
      setProperties(storeProperties);
      const currentId = localStorage.getItem('activePgId') || selectedPgId;
      if (currentId && storeProperties.some((p: any) => p.pg_id === currentId)) {
        setSelectedPg(currentId);
      } else if (storeProperties.length > 0) {
        setSelectedPg(storeProperties[0].pg_id);
      }
    }
  }, [storeProperties, selectedPgId]);



  // Instant Local Cache Loading
  useEffect(() => {
    if (!selectedPg || typeof window === 'undefined') return;
    const cacheKey = `staysync_expenses_${selectedPg}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        setExpensesList(JSON.parse(cached));
      } catch (e) {
        console.error('Error loading cached expenses:', e);
      }
    }
  }, [selectedPg]);

  // Fetch expenses history
  useEffect(() => {
    const activeUid = ownerId || currentUser?.uid || auth.currentUser?.uid;
    if (!ownerId && activeUid) {
      setOwnerId(activeUid);
    }
    if (activeUid && selectedPg) {
      fetchExpensesHistory(activeUid, selectedPg);
    }
  }, [ownerId, selectedPg, currentUser]);

  const fetchExpensesHistory = async (uid: string, pgId: string) => {
    const cacheKey = `staysync_expenses_${pgId}`;
    const hasCache = typeof window !== 'undefined' && !!localStorage.getItem(cacheKey);
    if (!hasCache) {
      setIsLoadingHistory(true);
    }
    try {
      const res = await rpcCall('getExpensesList', uid, pgId);
      if (res.success && res.data) {
        setExpensesList(res.data);
        if (typeof window !== 'undefined') {
          localStorage.setItem(cacheKey, JSON.stringify(res.data));
        }
      }
    } catch (err) {
      console.error('Failed to fetch expenses list:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setFeedbackToast({ type, message });
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeUid = ownerId || currentUser?.uid || auth.currentUser?.uid;
    if (!activeUid || !selectedPg || !date || amount === '' || Number(amount) <= 0) {
      showToast('error', 'Please enter a valid amount and fill all required fields.');
      return;
    }
    
    setIsSaving(true);
    const dateIso = date.toISOString();
    const numAmount = Number(amount);
    
    // User identity for tracking who added the expense
    const userRole = userProfile?.role === 'team_member' ? (userProfile?.staff_role || 'Team Member') : 'PG Owner';
    const userName = userProfile?.full_name || currentUser?.email?.split('@')[0] || 'PG Owner';

    // Optimistic UI Update
    const tempId = `temp_${Date.now()}`;
    const optimisticRecord = {
      id: tempId,
      expense_id: tempId,
      owner_id: activeUid,
      pg_id: selectedPg,
      date: dateIso,
      amount: numAmount,
      category: category,
      description: '',
      payment_method: 'Cash',
      added_by_name: userName,
      added_by_role: userRole,
      created_at: new Date().toISOString()
    };
    setExpensesList(prev => [optimisticRecord, ...prev]);

    const res = await rpcCall(
      'addExpense', 
      activeUid, 
      selectedPg, 
      dateIso, 
      numAmount, 
      category, 
      '',
      'Cash',
      userName,
      userRole
    );
    setIsSaving(false);
    
    if (res.success) {
      showToast('success', `₹${numAmount.toLocaleString('en-IN')} expense recorded successfully!`);
      setAmount('');
      fetchExpensesHistory(activeUid, selectedPg);
    } else {
      showToast('error', 'Failed to record expense: ' + (res.error || 'Unknown error'));
      fetchExpensesHistory(activeUid, selectedPg);
    }
  };

  const MONTHS = [
    { value: 'ALL', label: 'All Months' },
    { value: '0', label: 'January' },
    { value: '1', label: 'February' },
    { value: '2', label: 'March' },
    { value: '3', label: 'April' },
    { value: '4', label: 'May' },
    { value: '5', label: 'June' },
    { value: '6', label: 'July' },
    { value: '7', label: 'August' },
    { value: '8', label: 'September' },
    { value: '9', label: 'October' },
    { value: '10', label: 'November' },
    { value: '11', label: 'December' }
  ];

  // Generate Year Options dynamically
  const yearOptions = useMemo(() => {
    const options = [{ value: 'ALL', label: 'All Years' }];
    const yearSet = new Set<string>();

    const currentYear = new Date().getFullYear();
    yearSet.add(currentYear.toString());
    yearSet.add((currentYear - 1).toString());

    expensesList.forEach(item => {
      if (item.date) {
        const d = new Date(item.date);
        if (!isNaN(d.getTime())) {
          yearSet.add(d.getFullYear().toString());
        }
      }
    });

    Array.from(yearSet)
      .sort((a, b) => Number(b) - Number(a))
      .forEach(yr => {
        options.push({ value: yr, label: yr });
      });

    return options;
  }, [expensesList]);

  // Filtered Expenses by Selected Month & Year
  const filteredExpenses = useMemo(() => {
    return expensesList.filter(item => {
      if (!item.date) return false;
      const d = new Date(item.date);
      if (isNaN(d.getTime())) return false;

      if (selectedMonth !== 'ALL' && d.getMonth() !== Number(selectedMonth)) {
        return false;
      }

      if (selectedYear !== 'ALL' && d.getFullYear().toString() !== selectedYear) {
        return false;
      }

      return true;
    });
  }, [expensesList, selectedMonth, selectedYear]);

  const totalExpenseAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [filteredExpenses]);

  const monthlyCount = filteredExpenses.length;

  if (!selectedPgId && !selectedProperty) {
    return <SelectHostelPrompt pageTitle="Expenses" />;
  }

  return (
    <ProtectedRoute permission={PERMISSIONS.ADD_EXPENSE}>
      <div className={styles.pageContainer}>
        
        {/* Toast Feedback Notification */}
        <AnimatePresence>
          {feedbackToast && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              style={{
                position: 'fixed',
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 999,
                backgroundColor: feedbackToast.type === 'success' ? '#10B981' : '#EF4444',
                color: '#FFFFFF',
                padding: '10px 18px',
                borderRadius: '12px',
                fontSize: '0.85rem',
                fontWeight: 700,
                boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {feedbackToast.type === 'success' ? <Check size={16} /> : <Wallet size={16} />}
              {feedbackToast.message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Property Selector & Compact Summary Header */}
        <div className={styles.topPropertyBar}>
          <div className={styles.propertySelectRow}>
            <Building2 size={16} color="#4F46E5" />
            <div style={{ flex: 1 }}>
              <CustomSelect 
                value={selectedPg}
                onChange={setSelectedPg}
                options={properties.map(p => ({ value: p.pg_id, label: p.name }))}
                placeholder="Select Property"
              />
            </div>
          </div>

          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Total Expenses</span>
              <span className={`${styles.statValue} ${styles.expenseStatValue}`}>
                ₹{totalExpenseAmount.toLocaleString('en-IN')}
              </span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Total Records</span>
              <span className={styles.statValue}>
                {monthlyCount} {monthlyCount === 1 ? 'entry' : 'entries'}
              </span>
            </div>
          </div>
        </div>

        {/* Minimal Record Expense Card */}
        <motion.div 
          className={styles.formCard}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <h2 className={styles.formTitle}>
            <Plus size={16} color="#4F46E5" /> Record Expense
          </h2>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* Category & Date in 2 columns */}
            <div className={styles.formGridTwoCol}>
              <div className={styles.inputGroup} style={{ zIndex: 60, position: 'relative' }}>
                <label className={styles.inputLabel}>
                  <Tag size={14} className={styles.inputLabelIcon} />
                  Category
                </label>
                <CustomSelect 
                  value={category}
                  onChange={setCategory}
                  options={CATEGORIES.map(c => ({ value: c.id, label: c.label }))}
                  placeholder="Select Category"
                />
              </div>

              <div className={styles.inputGroup} style={{ zIndex: 50, position: 'relative' }}>
                <label className={styles.inputLabel}>
                  <Calendar size={14} className={styles.inputLabelIcon} />
                  Date
                </label>
                <CustomDatePicker 
                  selectedDate={date}
                  onChange={(d: Date | null) => setDate(d)}
                  placeholder="Select Date"
                  required={true}
                />
              </div>
            </div>

            {/* Amount Field + Record Expense Button inside card */}
            <div className={styles.formGridTwoCol} style={{ alignItems: 'flex-end' }}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>
                  <IndianRupee size={14} className={styles.inputLabelIcon} />
                  Amount (₹)
                </label>
                <div className={`${styles.inputWrapper} ${styles.amountWrapper}`}>
                  <div className={styles.inputIcon}>
                    <IndianRupee size={18} strokeWidth={2.5} />
                  </div>
                  <input 
                    type="number"
                    placeholder="0.00"
                    className={styles.premiumInput}
                    value={amount}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '') setAmount('');
                      else setAmount(parseInt(val) || 0);
                    }}
                    required
                    min="1"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className={styles.cardSubmitBtn}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Wallet size={16} />
                    Record Expense
                  </>
                )}
              </button>
            </div>

          </form>
        </motion.div>

        {/* Side-by-side Month & Year Filter Bar */}
        <div className={styles.filterCard}>
          <div className={styles.filterHeader}>
            <span className={styles.filterTitle}>
              <Filter size={14} className={styles.inputLabelIcon} />
              Filter Period
            </span>
            {(selectedMonth !== 'ALL' || selectedYear !== 'ALL') && (
              <button 
                type="button" 
                className={styles.resetFilterBtn}
                onClick={() => {
                  setSelectedMonth('ALL');
                  setSelectedYear('ALL');
                }}
              >
                Clear Filter
              </button>
            )}
          </div>

          <div className={styles.filterControlsGrid}>
            <div style={{ zIndex: 45, position: 'relative' }}>
              <span className={styles.filterSubLabel}>Month</span>
              <CustomSelect 
                value={selectedMonth}
                onChange={setSelectedMonth}
                options={MONTHS}
                placeholder="Select Month"
              />
            </div>

            <div style={{ zIndex: 40, position: 'relative' }}>
              <span className={styles.filterSubLabel}>Year</span>
              <CustomSelect 
                value={selectedYear}
                onChange={setSelectedYear}
                options={yearOptions}
                placeholder="Select Year"
              />
            </div>
          </div>
        </div>

        {/* Compact History List Section */}
        <div className={styles.historySection}>
          <div className={styles.historyHeader}>
            <h3 className={styles.historyTitle}>Recent Expense Records</h3>
            {isLoadingHistory && expensesList.length === 0 && <Loader2 size={14} className="animate-spin" color="#4F46E5" />}
          </div>

          {filteredExpenses.length === 0 ? (
            <div className={styles.emptyState}>
              <Wallet size={30} color="#94A3B8" strokeWidth={1.5} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                {expensesList.length === 0 ? 'No expenses recorded yet' : 'No expenses for selected filter'}
              </span>
              <span style={{ fontSize: '0.75rem' }}>Record spending above to track property costs.</span>
            </div>
          ) : (
            <div className={styles.historyList}>
              <AnimatePresence>
                {filteredExpenses.map((item) => {
                  const catObj = CATEGORIES.find(c => c.id === item.category);
                  const iconLabel = catObj ? catObj.label.split(' ')[0] : '💸';
                  const dateStr = item.date 
                    ? new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                    : 'N/A';

                  return (
                    <motion.div
                      key={item.id || item.expense_id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={styles.historyCard}
                    >
                      <div className={styles.historyLeft}>
                        <div className={styles.categoryIconBadge}>
                          {iconLabel}
                        </div>
                        <div className={styles.historyInfo}>
                          <span className={styles.historyCategory}>{item.category || 'Expense'}</span>
                          <span className={styles.historySub}>
                            {dateStr} &bull; <span style={{ color: '#4F46E5', fontWeight: 600 }}>Added by: {item.added_by_name || item.added_by_role || 'PG Owner'}</span>
                          </span>
                        </div>
                      </div>

                      <div className={styles.historyRight}>
                        <span className={styles.historyAmount}>-₹{Number(item.amount).toLocaleString('en-IN')}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

      </div>
    </ProtectedRoute>
  );
}

export default function ExpensesPage() { return <Suspense fallback={<div>Loading...</div>}><ExpensesPageContent /></Suspense>; }

