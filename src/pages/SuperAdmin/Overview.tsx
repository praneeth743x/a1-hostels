import React from 'react';
import { motion } from 'framer-motion';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';
import './SuperAdmin.css';

const monthlyData = [
  { name: 'Jan', rent: 450000 },
  { name: 'Feb', rent: 520000 },
  { name: 'Mar', rent: 480000 },
  { name: 'Apr', rent: 610000 },
  { name: 'May', rent: 750000 },
  { name: 'Jun', rent: 890000 },
];

const hostelData = [
  { name: 'Hostel A', tenants: 120 },
  { name: 'Hostel B', tenants: 95 },
  { name: 'Hostel C', tenants: 150 },
  { name: 'Hostel D', tenants: 80 },
];

export const Overview: React.FC = () => {
  return (
    <div className="dashboard-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Global Overview</h1>
          <p className="page-subtitle">Welcome back, Super Admin</p>
        </div>
      </header>

      <div className="stats-grid">
        {[
          { label: 'Total Revenue (Platform)', value: '₹37,00,000', trend: '+14%' },
          { label: 'Active PG Owners', value: '54', trend: '+3 this month' },
          { label: 'Total Tenants', value: '2,845', trend: '+124 this month' },
          { label: 'Pending Payouts', value: '₹1,24,000', trend: '-2%' },
        ].map((stat, i) => (
          <motion.div 
            key={stat.label}
            className="stat-card glass-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <h3 className="stat-label">{stat.label}</h3>
            <div className="stat-value text-indigo">{stat.value}</div>
            <div className="stat-trend text-cyan">{stat.trend}</div>
          </motion.div>
        ))}
      </div>

      <div className="charts-grid">
        <motion.div 
          className="chart-card glass-card"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          <h3 className="chart-title">Revenue Growth</h3>
          <div className="chart-container">
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
          className="chart-card glass-card"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className="chart-title">Top Hostels by Occupancy</h3>
          <div className="chart-container">
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
};
