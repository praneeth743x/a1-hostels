"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Wallet, BedDouble, Users, AlertCircle, Building, DoorOpen, ClipboardList, History, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { rpcCall } from '@/lib/rpc';
import { CustomSelect } from '@/components/CustomSelect';
import { globalAppCache, saveToCache, getFromCache } from '@/lib/cache';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import styles from './analytics.module.css';

import { auth, db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useHostel, usePermissions } from '@/context/HostelContext';
import { PERMISSIONS } from '@/permissions';
import { useHostelData } from '@/hooks/useHostelData';
import { perfLogger } from '@/lib/perfLogger';
import { SelectHostelPrompt } from '@/components/SelectHostelPrompt';

export default function PropertyAnalytics() {
  const router = useRouter();
  const { properties: storeProperties, selectedProperty, selectedPgId } = useHostel();
  const { isOwner, isStaff, hasPermission, hasAnyPermission } = usePermissions();
  const [pgId, setPgId] = useState<string | null>(selectedPgId || null);
  
  // Permission-aware widget visibility flags
  const showRevenueCard = isOwner || hasAnyPermission(PERMISSIONS.VIEW_REPORTS, PERMISSIONS.EXPORT_REPORTS, PERMISSIONS.ADD_EXPENSE);
  const showCollectionCard = isOwner || hasAnyPermission(PERMISSIONS.VIEW_REPORTS, PERMISSIONS.EXPORT_REPORTS);
  const showDuesCard = isOwner || hasAnyPermission(PERMISSIONS.VIEW_REPORTS, PERMISSIONS.GENERATE_DUES);
  const showOccupancyCard = isOwner || hasAnyPermission(PERMISSIONS.VIEW_ROOMS, PERMISSIONS.MANAGE_ROOMS);
  const showTenantCard = isOwner || hasAnyPermission(PERMISSIONS.VIEW_TENANTS, PERMISSIONS.MANAGE_TENANTS);

  const canViewRevenueChart = isOwner || hasAnyPermission(PERMISSIONS.VIEW_REPORTS, PERMISSIONS.EXPORT_REPORTS);
  const canViewTenantChart = isOwner || hasAnyPermission(PERMISSIONS.VIEW_TENANTS, PERMISSIONS.MANAGE_TENANTS);
  
  // SWR Hook for Data
  const { data: hostelData, isLoading, isValidating } = useHostelData(pgId);
  const storeTenants = hostelData?.tenants;
  const storeRooms = hostelData?.rooms;
  const storeDues = hostelData?.dues;
  const storePayments = hostelData?.payments;
  const storeExpenses = hostelData?.expenses;

  // Calculate Dashboard Summary
  const dashboardSummary = useMemo(() => {
    let totalRooms = 0;
    let occupiedRooms = 0;
    let vacantRooms = 0;
    let totalBeds = 0;
    const safeTenants = storeTenants || [];
    const safeRooms = storeRooms || [];
    let occupiedBeds = safeTenants.filter((t: any) => t.is_active !== false).length;

    safeRooms.forEach((r: any) => {
      totalRooms++;
      const beds = r.total_beds || r.beds || 2;
      totalBeds += beds;
      const roomTenants = safeTenants.filter((t: any) => (t.room_id === r.room_id || t.room === r.room_number) && t.is_active !== false);
      const occupiedInRoom = roomTenants.length;

      if (occupiedInRoom >= beds) {
        occupiedRooms++;
      } else if (occupiedInRoom === 0) {
        vacantRooms++;
      }
    });
    
    return {
      totalRooms, occupiedRooms, vacantRooms, totalBeds, vacantBeds: Math.max(0, totalBeds - occupiedBeds)
    };
  }, [storeRooms, storeTenants]);
  
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    perfLogger.logNavigationStart('/pgowner/dashboard');
    perfLogger.logRenderStart('PropertyAnalytics');
    perfLogger.logPageSummary('Dashboard');
    return () => {
      perfLogger.logRenderEnd('PropertyAnalytics');
    };
  }, []);

  useEffect(() => {
    setIsMounted(true);
    // Run daily automated reminders silently in the background (deduplicated per day)
    import('@/app/actions/whatsappActions').then(({ runDailyAutomatedRemindersAction }) => {
      runDailyAutomatedRemindersAction().catch(() => {});
    }).catch(() => {});
  }, []);
  
  // Shared Filter State for both Overview and Graphs
  const [filterType, setFilterType] = useState<'daily' | 'monthly' | 'yearly'>('monthly');
  const [filterValue, setFilterValue] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; // Default to current YYYY-MM
  });
  const [activeGraph, setActiveGraph] = useState<'revenue' | 'tenant'>('revenue');

  useEffect(() => {
    if (!canViewRevenueChart && canViewTenantChart) {
      setActiveGraph('tenant');
    }
  }, [canViewRevenueChart, canViewTenantChart]);

  useEffect(() => {
    if (selectedPgId) {
      setPgId(selectedPgId);
    } else if (typeof window !== 'undefined') {
      const cachedPgId = localStorage.getItem('activePgId');
      if (cachedPgId) setPgId(cachedPgId);
    }
  }, [selectedPgId]);

  // Utility to check if a date matches the current filter
  const isDateMatch = (dateStr: string) => {
    if (!dateStr) return false;
    const pDate = new Date(dateStr);
    if (filterType === 'daily') {
      const localDateStr = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}-${String(pDate.getDate()).padStart(2, '0')}`;
      return localDateStr === filterValue;
    } else if (filterType === 'monthly') {
      const localMonthStr = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}`;
      return localMonthStr === filterValue;
    } else if (filterType === 'yearly') {
      return pDate.getFullYear().toString() === filterValue;
    }
    return false;
  };

  // Graph Data Calculation for Revenue
  const chartData = useMemo(() => {
    if (!storePayments) return [];
    
    // First, filter payments by the selected period
    const relevantPayments = storePayments.filter((p:any) => isDateMatch(p.created_at) && (p.status === 'paid' || p.status === 'PAID'));
    
    const groupedData: Record<string, number> = {};

    relevantPayments.forEach((p: any) => {
      const date = new Date(p.created_at);
      let key = '';

      if (filterType === 'yearly') {
        key = date.toLocaleDateString('en-US', { month: 'short' });
      } else if (filterType === 'monthly') {
        key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else {
        key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }

      groupedData[key] = (groupedData[key] || 0) + p.amount;
    });

    const now = new Date();
    const resultKeys: string[] = [];

    if (filterType === 'monthly') {
      const [yearStr, monthStr] = filterValue.split('-');
      const targetYear = parseInt(yearStr, 10);
      const targetMonth = parseInt(monthStr, 10);
      const isCurrentMonth = now.getFullYear() === targetYear && (now.getMonth() + 1) === targetMonth;

      let earliestDay = isCurrentMonth ? now.getDate() : 1;
      let latestDay = isCurrentMonth ? now.getDate() : new Date(targetYear, targetMonth, 0).getDate();

      relevantPayments.forEach((p: any) => {
        const d = new Date(p.created_at);
        const day = d.getDate();
        if (day < earliestDay) earliestDay = day;
        if (day > latestDay) latestDay = day;
      });

      if (isCurrentMonth && now.getDate() > latestDay) {
        latestDay = now.getDate();
      }

      for (let day = earliestDay; day <= latestDay; day++) {
        const d = new Date(targetYear, targetMonth - 1, day);
        const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        resultKeys.push(key);
      }
    } else if (filterType === 'daily') {
      const d = new Date(filterValue + 'T00:00:00');
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      resultKeys.push(key);
    } else if (filterType === 'yearly') {
      const targetYear = parseInt(filterValue, 10);
      const isCurrentYear = now.getFullYear() === targetYear;
      const maxMonth = isCurrentYear ? now.getMonth() : 11;
      for (let m = 0; m <= maxMonth; m++) {
        const d = new Date(targetYear, m, 1);
        const key = d.toLocaleDateString('en-US', { month: 'short' });
        resultKeys.push(key);
      }
    }

    const allKeysSet = new Set([...resultKeys, ...Object.keys(groupedData)]);
    const sortedKeys = Array.from(allKeysSet).sort((a, b) => {
      if (filterType === 'yearly') {
        return new Date(`${a} 1, 2020`).getTime() - new Date(`${b} 1, 2020`).getTime();
      }
      return new Date(a).getTime() - new Date(b).getTime();
    });

    return sortedKeys.map(key => ({
      name: key,
      Revenue: groupedData[key] || 0
    }));
  }, [storePayments, filterType, filterValue]);

  // Graph Data Calculation for Tenant Growth
  const tenantChartData = useMemo(() => {
    if (!storeTenants) return [];
    
    // Filter tenants who joined in the selected period
    const relevantTenants = storeTenants.filter((t:any) => isDateMatch(t.created_at || t.joined_at || t.move_in_date));
    
    const groupedData: Record<string, number> = {};

    relevantTenants.forEach((t: any) => {
      const date = new Date(t.created_at || t.joined_at || t.move_in_date);
      let key = '';

      if (filterType === 'yearly') {
        key = date.toLocaleDateString('en-US', { month: 'short' });
      } else if (filterType === 'monthly') {
        key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else {
        key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }

      groupedData[key] = (groupedData[key] || 0) + 1;
    });

    const now = new Date();
    const resultKeys: string[] = [];

    if (filterType === 'monthly') {
      const [yearStr, monthStr] = filterValue.split('-');
      const targetYear = parseInt(yearStr, 10);
      const targetMonth = parseInt(monthStr, 10);
      const isCurrentMonth = now.getFullYear() === targetYear && (now.getMonth() + 1) === targetMonth;

      let earliestDay = isCurrentMonth ? now.getDate() : 1;
      let latestDay = isCurrentMonth ? now.getDate() : new Date(targetYear, targetMonth, 0).getDate();

      relevantTenants.forEach((t: any) => {
        const d = new Date(t.created_at || t.joined_at || t.move_in_date);
        const day = d.getDate();
        if (day < earliestDay) earliestDay = day;
        if (day > latestDay) latestDay = day;
      });

      if (isCurrentMonth && now.getDate() > latestDay) {
        latestDay = now.getDate();
      }

      for (let day = earliestDay; day <= latestDay; day++) {
        const d = new Date(targetYear, targetMonth - 1, day);
        const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        resultKeys.push(key);
      }
    } else if (filterType === 'daily') {
      const d = new Date(filterValue + 'T00:00:00');
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      resultKeys.push(key);
    } else if (filterType === 'yearly') {
      const targetYear = parseInt(filterValue, 10);
      const isCurrentYear = now.getFullYear() === targetYear;
      const maxMonth = isCurrentYear ? now.getMonth() : 11;
      for (let m = 0; m <= maxMonth; m++) {
        const d = new Date(targetYear, m, 1);
        const key = d.toLocaleDateString('en-US', { month: 'short' });
        resultKeys.push(key);
      }
    }

    const allKeysSet = new Set([...resultKeys, ...Object.keys(groupedData)]);
    const sortedKeys = Array.from(allKeysSet).sort((a, b) => {
      if (filterType === 'yearly') {
        return new Date(`${a} 1, 2020`).getTime() - new Date(`${b} 1, 2020`).getTime();
      }
      return new Date(a).getTime() - new Date(b).getTime();
    });

    return sortedKeys.map(key => ({
      name: key,
      Tenants: groupedData[key] || 0
    }));
  }, [storeTenants, filterType, filterValue]);

  // Dynamic KPI Calculation based on Time Picker
  const filteredKpi = useMemo(() => {
    let collected = 0;
    let overdue = 0;
    const defaulters = new Set();
    
    if (storePayments && Array.isArray(storePayments)) {
      storePayments.forEach((p: any) => {
        if (p.status === 'paid' || p.status === 'PAID') {
          if (isDateMatch(p.payment_date || p.created_at)) {
            collected += Number(p.amount) || 0;
          }
        }
      });
    }

    const duesList = storeDues && Array.isArray(storeDues) ? storeDues : [];
    const now = new Date();
    const isCurrentFilterPeriod = (() => {
      if (filterType === 'monthly') {
        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        return filterValue === currentMonthStr;
      }
      return false;
    })();

    duesList.forEach((p: any) => {
      if (p.status === 'pending' || p.status === 'overdue' || p.status === 'PENDING') {
        const itemDate = p.created_at || p.payment_date || p.due_date;
        if (isCurrentFilterPeriod || !itemDate || isDateMatch(itemDate)) {
          overdue += Number(p.amount) || 0;
          if (p.tenant_id || p.tenantId) defaulters.add(p.tenant_id || p.tenantId);
        }
      }
    });

    return { collected, overdue, overdueCount: defaulters.size };
  }, [storePayments, storeDues, filterType, filterValue, isDateMatch]);

  const activeAnalytics = {
    dashboardTitle: selectedProperty?.name || "Hostel Dashboard",
    kpi: {
      totalBeds: dashboardSummary.totalBeds,
      bedsAvailable: dashboardSummary.vacantBeds,
      totalRooms: dashboardSummary.totalRooms,
      vacantRooms: dashboardSummary.vacantRooms,
      occupiedRooms: dashboardSummary.occupiedRooms,
    },
    properties: storeProperties,
    tenants: storeTenants,
    expenses: storeExpenses,
    payments: storePayments
  };

  const { dashboardTitle, kpi, properties, tenants, expenses } = activeAnalytics;
  // Monthly expected rent sum from all active tenants
  const activeTenantsMonthlyRentSum = useMemo(() => {
    const safeTenants = storeTenants || [];
    const safeRooms = storeRooms || [];
    let total = 0;

    safeTenants.forEach((t: any) => {
      if (t.is_active !== false && t.status !== 'PAUSED' && t.status !== 'Paused') {
        const room = safeRooms.find((r: any) => 
          r.room_id === t.room_id || 
          r.room_number === t.room_number || 
          r.room === t.room_number ||
          r.num === t.room_number
        );
        const roomExtraFee = Number(room?.extra_fee ?? room?.extraFee ?? 0);
        const baseRent = Number(t.rent_amount ?? t.fee ?? t.monthly_rent ?? t.rent ?? 0);
        total += (baseRent + roomExtraFee);
      }
    });
    return total;
  }, [storeTenants, storeRooms]);

  // Dynamic Calculations for Display
  const expectedRent = useMemo(() => {
    if (filterType === 'yearly') {
      let oneTimeOrExtraInYear = 0;
      if (storePayments && Array.isArray(storePayments)) {
        storePayments.forEach((p: any) => {
          if (isDateMatch(p.payment_date || p.created_at) && (p.type === 'one-time' || p.type === 'security_deposit' || p.type === 'maintenance-fee' || p.type === 'advance')) {
            oneTimeOrExtraInYear += Number(p.amount) || 0;
          }
        });
      }
      if (storeDues && Array.isArray(storeDues)) {
        storeDues.forEach((p: any) => {
          if (isDateMatch(p.created_at || p.payment_date || p.due_date) && (p.type === 'one-time' || p.type === 'security_deposit' || p.type === 'maintenance-fee')) {
            oneTimeOrExtraInYear += Number(p.amount) || 0;
          }
        });
      }
      const fullYearBase = activeTenantsMonthlyRentSum * 12;
      return Math.max(fullYearBase + oneTimeOrExtraInYear, filteredKpi.collected + filteredKpi.overdue);
    }
    return filteredKpi.collected + filteredKpi.overdue;
  }, [filterType, activeTenantsMonthlyRentSum, filteredKpi, storePayments, storeDues, isDateMatch]);
  
  const revenueAmount = filteredKpi.collected;
  
  let expensesAmount = 0;
  if (expenses && Array.isArray(expenses)) {
    expenses.forEach((e: any) => {
      if (isDateMatch(e.date || e.created_at)) {
        expensesAmount += Number(e.amount || 0);
      }
    });
  }
  
  const profitAmount = revenueAmount - expensesAmount;

  const collectedPercent = expectedRent > 0 ? Math.round((filteredKpi.collected / expectedRent) * 100) : 0;
  
  // Occupancy and Tenants are always all-time/live
  const occupiedBeds = kpi.totalBeds - kpi.bedsAvailable;
  const occupancyPercent = kpi.totalBeds > 0 ? Math.round((occupiedBeds / kpi.totalBeds) * 100) : 0;

  const totalTenants = tenants?.length || 0;
  const activeTenants = tenants?.filter((t:any) => t.is_active).length || 0;
  const inactiveTenants = totalTenants - activeTenants;

  // Render Time Input based on type
  const renderKpiInput = () => {
    if (filterType === 'daily') {
      return (
        <input 
          type="date" 
          className={styles.kpiDateInput}
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
        />
      );
    } else if (filterType === 'monthly') {
      return (
        <input 
          type="month" 
          className={styles.kpiDateInput}
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
        />
      );
    } else {
      // Yearly select
      const currentYear = new Date().getFullYear();
      const years = Array.from(new Array(10), (val, index) => currentYear - index);
      return (
        <div style={{ width: '100px', display: 'inline-block' }}>
          <CustomSelect 
            value={filterValue} 
            onChange={(val) => setFilterValue(val)}
            options={years.map(y => ({ value: y.toString(), label: y.toString() }))}
          />
        </div>
      );
    }
  };

  const handleFilterTypeChange = (type: 'daily' | 'monthly' | 'yearly') => {
    setFilterType(type);
    const d = new Date();
    if (type === 'daily') setFilterValue(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    else if (type === 'monthly') setFilterValue(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    else setFilterValue(d.getFullYear().toString());
  };

  const renderFilterUI = () => (
    <div className={styles.kpiFilterContainer}>
      <div className={styles.kpiFilterGroup}>
        <button 
          className={`${styles.kpiFilterBtn} ${filterType === 'daily' ? styles.active : ''}`}
          onClick={() => handleFilterTypeChange('daily')}
        >
          Date
        </button>
        <button 
          className={`${styles.kpiFilterBtn} ${filterType === 'monthly' ? styles.active : ''}`}
          onClick={() => handleFilterTypeChange('monthly')}
        >
          Month
        </button>
        <button 
          className={`${styles.kpiFilterBtn} ${filterType === 'yearly' ? styles.active : ''}`}
          onClick={() => handleFilterTypeChange('yearly')}
        >
          Year
        </button>
      </div>
      <div>
        {renderKpiInput()}
      </div>
    </div>
  );

  if (!selectedProperty && !pgId && isMounted) {
    return <SelectHostelPrompt pageTitle="Dashboard Metrics" />;
  }

  return (
    <div className={styles.dashboardPage}>
      {/* SWR Loading Indicator overlay during fast switches */}
      {isValidating && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '3px', background: '#e2e8f0', zIndex: 9999 }}>
           <motion.div
             initial={{ width: '0%' }}
             animate={{ width: '100%' }}
             transition={{ duration: 1.5, repeat: Infinity }}
             style={{ height: '100%', background: '#6366F1' }}
           />
        </div>
      )}
      
      <div className={styles.desktopMacroGrid}>
        {/* Left Column - Financial Summary or Roster Summary */}
        {showRevenueCard ? (
          <div className={styles.macroColumn}>
            {renderFilterUI()}
            <div className={styles.summaryBox} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly' }}>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Revenue</span>
                <span className={styles.summaryValue}>₹{revenueAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Expenses</span>
                <span className={`${styles.summaryValue} ${styles.expenseValue}`}>- ₹{expensesAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Profit</span>
                <span className={`${styles.summaryValue} ${styles.profitValue}`}>₹{profitAmount.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.macroColumn}>
            <div className={styles.summaryBox} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)', borderRadius: '16px', padding: '20px', border: '1px solid #C7D2FE' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#4338CA', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Property Overview</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.9rem', color: '#3730A3', fontWeight: 500 }}>Active Tenants</span>
                <span style={{ fontSize: '1.1rem', color: '#1E1B4B', fontWeight: 800 }}>{activeTenants}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.9rem', color: '#3730A3', fontWeight: 500 }}>Live Beds Occupancy</span>
                <span style={{ fontSize: '1.1rem', color: '#1E1B4B', fontWeight: 800 }}>{occupiedBeds} / {kpi.totalBeds} ({occupancyPercent}%)</span>
              </div>
            </div>
          </div>
        )}

        {/* Right Column - Modular Analytics Grid */}
        <div className={styles.macroColumn}>
          <div className={styles.miniAnalyticsGrid} style={{ flex: 1, gridTemplateRows: '1fr' }}>
            {/* Revenue Collection Card */}
            {showCollectionCard && (
              <div className={styles.glassCard} style={{ display: 'flex', flexDirection: 'column', padding: '16px' }}>
                <div>
                  <div className={styles.revenueHeader}>
                    <div className={styles.iconBox + ' ' + styles.iconGreen}>
                      <Wallet />
                    </div>
                    <span className={styles.revenueTitle} style={{ textTransform: 'capitalize' }}>
                      {filterType} View
                    </span>
                  </div>
                  <div className={styles.revenueAmount} style={{ fontSize: '1.75rem', marginTop: '12px' }}>₹{filteredKpi.collected.toLocaleString('en-IN')}</div>
                  <div className={styles.revenueSubtitle}>Collected Rent</div>
                </div>
                
                <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
                  <div className={styles.progressBarContainer} style={{ height: '8px', marginBottom: '12px' }}>
                    <div 
                      className={styles.progressBarFill} 
                      style={{ width: `${collectedPercent}%`, backgroundColor: '#10b981' }}
                    ></div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className={styles.statBlock}>
                      <span className={styles.statLabel}>Expected</span>
                      <span className={styles.statValue}>₹{expectedRent.toLocaleString('en-IN')}</span>
                    </div>
                    <div className={styles.statBlock} style={{ textAlign: 'right' }}>
                      <span className={styles.statLabel}>Collection Rate</span>
                      <span className={styles.statValue} style={{ color: '#10b981' }}>{collectedPercent}%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Outstanding Dues Card */}
            {showDuesCard && (
              <div className={styles.glassCard} style={{ display: 'flex', flexDirection: 'column', padding: '16px' }}>
                <div>
                  <div className={styles.revenueHeader}>
                    <div className={styles.iconBox + ' ' + styles.iconRed}>
                      <AlertCircle />
                    </div>
                    <span className={styles.revenueTitle}>Outstanding</span>
                  </div>
                  <div className={styles.revenueAmount} style={{ fontSize: '1.75rem', color: '#ef4444', marginTop: '12px' }}>₹{filteredKpi.overdue.toLocaleString('en-IN')}</div>
                  <div className={styles.revenueSubtitle}>Pending Rent Payments</div>
                </div>
                
                <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
                  <div 
                    onClick={() => router.push('/pgowner/dues')}
                    style={{ padding: '12px', background: '#fef2f2', borderRadius: '8px', border: '1px dashed #fca5a5', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className={styles.statLabel} style={{ color: '#b91c1c' }}>Due</span>
                      <span className={styles.statValue} style={{ color: '#ef4444' }}>{filteredKpi.overdueCount} Tenant{filteredKpi.overdueCount !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Occupancy Card (Live Data) */}
            {showOccupancyCard && (
              <div className={styles.glassCard} style={{ display: 'flex', flexDirection: 'column', padding: '16px' }}>
                <div>
                  <div className={styles.revenueHeader}>
                    <div className={styles.iconBox + ' ' + styles.iconBlue}>
                      <BedDouble />
                    </div>
                    <span className={styles.revenueTitle}>Capacity</span>
                  </div>
                  <div className={styles.revenueAmount} style={{ fontSize: '1.75rem', marginTop: '12px' }}>{occupancyPercent}%</div>
                  <div className={styles.revenueSubtitle}>Live Occupancy Rate</div>
                </div>
                
                <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
                  <div className={styles.progressBarContainer} style={{ height: '8px', marginBottom: '12px' }}>
                    <div 
                      className={styles.progressBarFill} 
                      style={{ width: `${occupancyPercent}%`, backgroundColor: '#3b82f6' }}
                    ></div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className={styles.miniCard} style={{ flex: 1, marginRight: '4px', background: '#eff6ff', border: 'none', padding: '10px' }}>
                      <span className={styles.statLabel} style={{ color: '#1d4ed8' }}>Filled Beds</span>
                      <span className={styles.statValue} style={{ color: '#3b82f6', fontSize: '1.1rem' }}>{occupiedBeds}</span>
                    </div>
                    <div className={styles.miniCard} style={{ flex: 1, marginLeft: '4px', background: '#f1f5f9', border: 'none', padding: '10px' }}>
                      <span className={styles.statLabel}>Vacant Beds</span>
                      <span className={styles.statValue} style={{ fontSize: '1.1rem' }}>{kpi.bedsAvailable}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Demographics Card (Tenant Base) */}
            {showTenantCard && (
              <div className={styles.glassCard} style={{ display: 'flex', flexDirection: 'column', padding: '16px' }}>
                <div>
                  <div className={styles.revenueHeader}>
                    <div className={styles.iconBox + ' ' + styles.iconPurple}>
                      <Users />
                    </div>
                    <span className={styles.revenueTitle}>Tenant Base</span>
                  </div>
                  <div className={styles.revenueAmount} style={{ fontSize: '1.75rem', color: '#10b981', marginTop: '12px' }}>{activeTenants}</div>
                  <div className={styles.revenueSubtitle}>Active Tenants</div>
                </div>
                
                <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
                  <div style={{ padding: '12px', background: '#faf5ff', borderRadius: '8px', border: 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span className={styles.statLabel} style={{ color: '#6b21a8' }}>Total Tenants</span>
                      <span className={styles.statValue} style={{ fontSize: '1.1rem' }}>{totalTenants}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className={styles.statLabel} style={{ color: '#6b21a8' }}>Inactive</span>
                      <span className={styles.statValue} style={{ fontSize: '1.1rem' }}>{inactiveTenants}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      {(canViewRevenueChart || canViewTenantChart) && (
        <div className={styles.chartCard}>
          <div className={styles.graphToggleBar}>
            {canViewRevenueChart && (
              <button 
                className={`${styles.graphToggleBtn} ${activeGraph === 'revenue' ? styles.activeGraphBtn : ''}`}
                onClick={() => setActiveGraph('revenue')}
              >
                Revenue Growth
              </button>
            )}
            {canViewTenantChart && (
              <button 
                className={`${styles.graphToggleBtn} ${(!canViewRevenueChart || activeGraph === 'tenant') ? styles.activeGraphBtn : ''}`}
                onClick={() => setActiveGraph('tenant')}
              >
                Tenant Growth
              </button>
            )}
          </div>

          {(canViewRevenueChart && activeGraph === 'revenue') ? (
          <>
            <div className={styles.chartHeader}>
              <h3 className={styles.chartTitle}>Revenue Growth</h3>
              <h3 className={styles.chartValue}>₹{expectedRent.toLocaleString('en-IN')}</h3>
            </div>
            <div style={{ width: '100%', height: 250, paddingRight: '12px' }}>
              {chartData.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center' }}>
                  No payment data available for the selected period.
                </div>
              ) : isMounted ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={240} initialDimension={{ width: 320, height: 240 }}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `₹${value >= 1000 ? (value / 1000) + 'k' : value}`} />
                    <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} formatter={(value: any) => [`₹${value}`, 'Revenue']} />
                    <Area type="linear" dataKey="Revenue" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" dot={{ r: 4, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div className={styles.chartHeader}>
              <h3 className={styles.chartTitle}>Tenant Growth</h3>
              <h3 className={styles.chartValue}>{totalTenants}</h3>
            </div>
            <div style={{ width: '100%', height: 250, paddingRight: '12px' }}>
              {tenantChartData.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center' }}>
                  No tenant data available for the selected period.
                </div>
              ) : isMounted ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={240} initialDimension={{ width: 320, height: 240 }}>
                  <AreaChart data={tenantChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorTenants" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} formatter={(value: any) => [`${value}`, 'New Tenants']} />
                    <Area type="linear" dataKey="Tenants" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorTenants)" dot={{ r: 4, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </>
        )}
      </div>
      )}
    </div>
  );
}
