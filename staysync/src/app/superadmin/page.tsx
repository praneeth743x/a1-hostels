"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';
import { supabase } from '@/lib/supabase';
import styles from './superadmin.module.css';

export default function SuperAdminOverview() {
  const [stats, setStats] = useState({
    revenue: 0,
    activeOwners: 0,
    totalTenants: 0,
    pendingPayouts: 0,
  });
  const [monthlyData, setMonthlyData] = useState<{name: string, rent: number}[]>([]);
  const [hostelData, setHostelData] = useState<{name: string, tenants: number}[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // Fetch total tenants
        const { count: tenantCount } = await supabase
          .from('tenants')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        // Fetch total active owners
        const { count: ownerCount } = await supabase
          .from('user_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'pg_owner');

        // Fetch payments for revenue (In production, sum via RPC. Doing client sum for now)
        const { data: payments } = await supabase
          .from('payments')
          .select('amount, status');

        let totalRev = 0;
        let pending = 0;
        if (payments) {
          payments.forEach((p: any) => {
            if (p.status === 'paid') totalRev += Number(p.amount);
            if (p.status === 'pending') pending += Number(p.amount);
          });
        }

        // Fetch properties for chart
        const { data: properties } = await supabase
          .from('properties')
          .select('pg_id, name');

        const hData = [];
        if (properties) {
          for (const prop of properties) {
            const { count: ptCount } = await supabase
              .from('tenants')
              .select('*', { count: 'exact', head: true })
              .eq('pg_id', prop.pg_id);
            hData.push({ name: prop.name || 'Unnamed', tenants: ptCount || 0 });
          }
        }

        setStats({
          revenue: totalRev,
          activeOwners: ownerCount || 0,
          totalTenants: tenantCount || 0,
          pendingPayouts: pending,
        });

        // Set mock monthly data until we have real historical data
        setMonthlyData([
          { name: 'Jan', rent: totalRev * 0.4 },
          { name: 'Feb', rent: totalRev * 0.5 },
          { name: 'Mar', rent: totalRev * 0.7 },
          { name: 'Apr', rent: totalRev },
        ]);

        setHostelData(hData.length > 0 ? hData : [{ name: 'No Hostels', tenants: 0 }]);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDashboardData();
  }, []);
  return (
    <div className={styles.dashboardPage}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Global Overview</h1>
          <p className={styles.pageSubtitle}>Welcome back, Super Admin</p>
        </div>
      </header>

      <div className={styles.statsGrid}>
        {[
          { label: 'Total Revenue (Platform)', value: `₹${stats.revenue.toLocaleString()}`, trend: '+0%' },
          { label: 'Active PG Owners', value: stats.activeOwners.toString(), trend: 'Current' },
          { label: 'Total Tenants', value: stats.totalTenants.toString(), trend: 'Current' },
          { label: 'Pending Payouts', value: `₹${stats.pendingPayouts.toLocaleString()}`, trend: 'Awaiting' },
        ].map((stat, i) => (
          <motion.div 
            key={stat.label}
            className={`${styles.statCard} glass-card`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <h3 className={styles.statLabel}>{stat.label}</h3>
            <div className={`${styles.statValue} text-indigo`}>{stat.value}</div>
            <div className={`${styles.statTrend} text-cyan`}>{stat.trend}</div>
          </motion.div>
        ))}
      </div>

      <div className={styles.chartsGrid}>
        <motion.div 
          className={`${styles.chartCard} glass-card`}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          <h3 className={styles.chartTitle}>Revenue Growth</h3>
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary-indigo)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--primary-indigo)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value/1000}k`} />
                <Tooltip cursor={{ stroke: 'var(--border-light)', strokeWidth: 1 }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }} />
                <Area type="monotone" dataKey="rent" stroke="var(--primary-indigo)" strokeWidth={3} fillOpacity={1} fill="url(#colorRent)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div 
          className={`${styles.chartCard} glass-card`}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className={styles.chartTitle}>Top Hostels by Occupancy</h3>
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hostelData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'var(--bg-offwhite)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }} />
                <Bar dataKey="tenants" fill="var(--secondary-cyan)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
