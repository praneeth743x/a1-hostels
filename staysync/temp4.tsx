"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Wallet, BedDouble, Users, AlertCircle, Building, DoorOpen, ClipboardList, History, ChevronRight } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { getDashboardStats } from '@/app/actions/pgowner';
import { CustomSelect } from '@/components/CustomSelect';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import styles from './analytics.module.css';

export default function PropertyAnalytics() {
  const router = useRouter();
  const params = useParams();
  const pgId = params.pgId as string;
  
  const [isLoading, setIsLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>(null);
  
  // Shared Filter State for both Overview and Graphs
  const [filterType, setFilterType] = useState<'daily' | 'monthly' | 'yearly'>('monthly');
  const [filterValue, setFilterValue] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; // Default to current YYYY-MM
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && pgId) {
        try {
          const res = await getDashboardStats(user.uid, [pgId]);
          if (res.success && res.data) {
            setAnalytics(res.data);
          }
        } catch (e) {
          console.error("Error fetching analytics:", e);
        } finally {
          setIsLoading(false);
        }
      }
    });
    return () => unsubscribe();
  }, [pgId]);

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
    if (!analytics?.payments) return [];
    
    // First, filter payments by the selected period
    const relevantPayments = analytics.payments.filter((p:any) => isDateMatch(p.created_at) && p.status === 'paid');
    
    const groupedData: Record<string, number> = {};

    relevantPayments.forEach((p: any) => {
      const date = new Date(p.created_at);
      let key = '';

      // If we are looking at a specific YEAR, group by MONTH
      if (filterType === 'yearly') {
        key = date.toLocaleDateString('en-US', { month: 'short' });
      } 
      // If we are looking at a specific MONTH, group by DAY
      else if (filterType === 'monthly') {
        key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } 
      // If we are looking at a specific DAY, just group by that DAY
      else {
        key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }

      groupedData[key] = (groupedData[key] || 0) + p.amount;
    });

    const sortedKeys = Object.keys(groupedData).sort((a, b) => {
      if (filterType === 'yearly') {
        // Sort months chronologically
        return new Date(`${a} 1, 2020`).getTime() - new Date(`${b} 1, 2020`).getTime();
      }
      // Sort days chronologically
      return new Date(a).getTime() - new Date(b).getTime();
    });

    return sortedKeys.map(key => ({
      name: key,
      Revenue: groupedData[key]
    }));
  }, [analytics, filterType, filterValue]);

  // Graph Data Calculation for Tenant Growth
  const tenantChartData = useMemo(() => {
    if (!analytics?.tenants) return [];
    
    // Filter tenants who joined in the selected period
    const relevantTenants = analytics.tenants.filter((t:any) => isDateMatch(t.created_at || t.joined_at));
    
    const groupedData: Record<string, number> = {};

    relevantTenants.forEach((t: any) => {
      const date = new Date(t.created_at || t.joined_at);
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

    const sortedKeys = Object.keys(groupedData).sort((a, b) => {
      if (filterType === 'yearly') {
        return new Date(`${a} 1, 2020`).getTime() - new Date(`${b} 1, 2020`).getTime();
      }
      return new Date(a).getTime() - new Date(b).getTime();
    });

    return sortedKeys.map(key => ({
      name: key,
      Tenants: groupedData[key]
    }));
  }, [analytics, filterType, filterValue]);

  // Dynamic KPI Calculation based on Time Picker
  const filteredKpi = useMemo(() => {
    let collected = 0;
    let overdue = 0;
    let overdueCount = 0;
    
    if (!analytics?.payments) return { collected, overdue, overdueCount };

    const defaulters = new Set();
    analytics.payments.forEach((p: any) => {
      if (p.status === 'paid') {
        if (isDateMatch(p.created_at)) {
          collected += p.amount;
        }
      } else if (p.status === 'pending' || p.status === 'overdue') {
        overdue += p.amount;
        if (p.tenant_id) defaulters.add(p.tenant_id);
      }
    });

    return { collected, overdue, overdueCount: defaulters.size };
  }, [analytics, filterType, filterValue]);

  if (isLoading) {
    return <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Loading Analytics...</div>;
  }

  if (!analytics) {
    return <div style={{ padding: '2rem' }}>Failed to load analytics.</div>;
  }

  const { dashboardTitle, kpi, properties, tenants } = analytics;
  const propertyName = properties.find((p:any) => p.pg_id === pgId)?.name || dashboardTitle.split(' (')[0];
  
  // Dynamic Calculations for Display
  const expectedRent = filteredKpi.collected + filteredKpi.overdue;
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
          Day
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

  return (
    <div className={styles.dashboardPage}>
      <div style={{ paddingBottom: '40px' }}>
        
        {/* Quick Links Section */}
        <div className={styles.quickLinksSection}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#334155', marginBottom: '16px' }}>Manage {analytics?.properties?.[0]?.name || 'Hostel'}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
            
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push(`/pgowner/tenants?pgId=${pgId}`)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', cursor: 'pointer', gap: '8px' }}
            >
              <div style={{ background: '#F0F9FF', padding: '10px', borderRadius: '50%' }}>
                <Users size={24} color="#0EA5E9" />
              </div>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Tenants</span>
            </motion.button>
            
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push(`/pgowner/rooms?pgId=${pgId}`)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', cursor: 'pointer', gap: '8px' }}
            >
              <div style={{ background: '#FEF3C7', padding: '10px', borderRadius: '50%' }}>
                <Building size={24} color="#D97706" />
              </div>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Rooms</span>
            </motion.button>

            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push(`/pgowner/dues?pgId=${pgId}`)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', cursor: 'pointer', gap: '8px' }}
            >
              <div style={{ background: '#FCE7F3', padding: '10px', borderRadius: '50%' }}>
                <ClipboardList size={24} color="#DB2777" />
              </div>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Dues</span>
            </motion.button>

            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push(`/pgowner/history?pgId=${pgId}`)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', cursor: 'pointer', gap: '8px' }}
            >
              <div style={{ background: '#F3F4F6', padding: '10px', borderRadius: '50%' }}>
                <History size={24} color="#4B5563" />
              </div>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>History</span>
            </motion.button>

          </div>
        </div>

        {renderFilterUI()}

        <div className={styles.analyticsGrid}>
          {/* Revenue Collection Card */}
          <div className={styles.glassCard}>
            <div className={styles.revenueHeader}>
              <div className={styles.iconBox + ' ' + styles.iconGreen}>
                <Wallet />
              </div>
              <span className={styles.revenueTitle} style={{ textTransform: 'capitalize' }}>
                {filterType} View
              </span>
            </div>
            <div className={styles.revenueAmount}>â‚¹{filteredKpi.collected.toLocaleString('en-IN')}</div>
            <div className={styles.revenueSubtitle}>Collected Rent</div>
            
            <div className={styles.progressBarContainer}>
              <div 
                className={styles.progressBarFill} 
                style={{ width: `${collectedPercent}%`, backgroundColor: '#10b981' }}
              ></div>
            </div>
            
            <div className={styles.statsRow}>
              <div className={styles.statBlock}>
                <span className={styles.statLabel}>Expected</span>
                <span className={styles.statValue}>â‚¹{expectedRent.toLocaleString('en-IN')}</span>
              </div>
              <div className={styles.statBlock} style={{ textAlign: 'right' }}>
                <span className={styles.statLabel}>Collection Rate</span>
                <span className={styles.statValue} style={{ color: '#10b981' }}>{collectedPercent}%</span>
              </div>
            </div>
          </div>

          {/* Outstanding Dues Card */}
          <div className={styles.glassCard}>
            <div className={styles.revenueHeader}>
              <div className={styles.iconBox + ' ' + styles.iconRed}>
                <AlertCircle />
              </div>
              <span className={styles.revenueTitle}>Outstanding</span>
            </div>
            <div className={styles.revenueAmount} style={{ color: '#ef4444' }}>â‚¹{filteredKpi.overdue.toLocaleString('en-IN')}</div>
            <div className={styles.revenueSubtitle}>Pending Rent Payments</div>
            
            <div className={styles.statsRow} style={{ marginTop: 'auto' }}>
              <div className={styles.statBlock}>
                <span className={styles.statLabel}>Defaulters</span>
                <span className={styles.statValue} style={{ color: '#ef4444' }}>{filteredKpi.overdueCount} Tenants</span>
              </div>
            </div>
          </div>

          {/* Occupancy Card (Live Data) */}
          <div className={styles.glassCard}>
            <div className={styles.revenueHeader}>
              <div className={styles.iconBox + ' ' + styles.iconBlue}>
                <BedDouble />
              </div>
              <span className={styles.revenueTitle}>Capacity</span>
            </div>
            <div className={styles.revenueAmount}>{occupancyPercent}%</div>
            <div className={styles.revenueSubtitle}>Live Occupancy Rate</div>
            
            <div className={styles.progressBarContainer}>
              <div 
                className={styles.progressBarFill} 
                style={{ width: `${occupancyPercent}%`, backgroundColor: '#3b82f6' }}
              ></div>
            </div>
            
            <div className={styles.miniStatsGrid}>
              <div className={styles.miniCard}>
                <span className={styles.statLabel}>Filled Beds</span>
                <span className={styles.statValue} style={{ color: '#3b82f6' }}>{occupiedBeds}</span>
              </div>
              <div className={styles.miniCard}>
                <span className={styles.statLabel}>Vacant Beds</span>
                <span className={styles.statValue}>{kpi.bedsAvailable}</span>
              </div>
            </div>
          </div>

          {/* Demographics Card (Live Data) */}
          <div className={styles.glassCard}>
            <div className={styles.revenueHeader}>
              <div className={styles.iconBox + ' ' + styles.iconPurple}>
                <Users />
              </div>
              <span className={styles.revenueTitle}>Tenant Base</span>
            </div>
            <div className={styles.revenueAmount} style={{ color: '#10b981' }}>{activeTenants}</div>
            <div className={styles.revenueSubtitle}>Active Tenants</div>
            
            <div className={styles.statsRow} style={{ marginTop: 'auto' }}>
              <div className={styles.statBlock}>
                <span className={styles.statLabel} style={{ fontSize: '0.8rem' }}>Total Tenants</span>
                <span className={styles.statValue} style={{ fontSize: '1.2rem' }}>{totalTenants}</span>
              </div>
              <div className={styles.statBlock} style={{ textAlign: 'right' }}>
                <span className={styles.statLabel} style={{ fontSize: '0.8rem' }}>Inactive</span>
                <span className={styles.statValue} style={{ fontSize: '1.2rem' }}>{inactiveTenants}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Revenue Chart */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>Revenue Growth</h3>
            <h3 className={styles.chartValue}>â‚¹{expectedRent.toLocaleString('en-IN')}</h3>
          </div>
          <div style={{ flex: 1, width: '100%', minHeight: 250, paddingRight: '12px' }}>
            {chartData.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center' }}>
                No payment data available for the selected period.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `â‚¹${value >= 1000 ? (value / 1000) + 'k' : value}`} />
                  <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} formatter={(value: any) => [`â‚¹${value}`, 'Revenue']} />
                  <Area type="monotone" dataKey="Revenue" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Tenant Chart */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>Tenant Growth</h3>
            <h3 className={styles.chartValue}>{totalTenants}</h3>
          </div>
          <div style={{ flex: 1, width: '100%', minHeight: 250, paddingRight: '12px' }}>
            {tenantChartData.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center' }}>
                No tenant data available for the selected period.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
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
                  <Area type="monotone" dataKey="Tenants" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorTenants)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
