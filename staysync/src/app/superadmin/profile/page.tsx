"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Mail, Key, User, Server, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import styles from '../superadmin.module.css';

export default function SuperAdminProfile() {
  const [resetMessage, setResetMessage] = useState('');

  const handlePasswordReset = () => {
    setResetMessage("Password reset email sent to 25r21a05e2@mlrit.ac.in");
    setTimeout(() => setResetMessage(''), 5000);
  };

  return (
    <div className={styles.dashboardPage}>
      {/* Super Admin Profile Banner */}
      <div className={styles.heroBanner}>
        <div className={styles.heroBannerInner}>
          <div>
            <span className={styles.heroBadge}>SUPER ADMIN SECURITY</span>
            <h1 className={styles.heroTitle}>Super Admin Profile</h1>
            <p className={styles.heroSubtitle}>Primary administrative account details, security credentials, and system parameters.</p>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.3)', padding: '8px 16px', borderRadius: '12px', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={18} style={{ color: '#4ade80' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>SYSTEM MASTER ADMIN</span>
          </div>
        </div>
      </div>

      {/* Account Details & Security Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        {/* Card 1: Account Credentials */}
        <div className={styles.tableCard} style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Super Admin Credentials</h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>Exclusive administrative account</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>
                Admin Email Address
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '10px 14px', borderRadius: '12px', border: '1px solid #e2e8f0', fontWeight: 700, color: '#0f172a' }}>
                <Mail size={16} style={{ color: '#6366f1' }} />
                <span>25r21a05e2@mlrit.ac.in</span>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>
                Account Authority Status
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f0fdf4', padding: '10px 14px', borderRadius: '12px', border: '1px solid #bbf7d0', fontWeight: 700, color: '#16a34a' }}>
                <CheckCircle2 size={16} />
                <span>Single Super Admin (Sole Authority)</span>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>
                Access Scope
              </label>
              <div style={{ fontSize: '0.85rem', color: '#334155', lineHeight: '1.5' }}>
                Full system permissions including PG owner registration, property kill switches, global tenant broadcasts, and database management.
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Security & Password Management */}
        <div className={styles.tableCard} style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Security & Authentication</h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>Manage access security for Super Admin</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '14px', padding: '14px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <ShieldCheck size={20} style={{ color: '#2563eb', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e40af', display: 'block' }}>Protected Admin Session</span>
                <span style={{ fontSize: '0.78rem', color: '#1e3a8a' }}>Authenticated via Firebase Server Admin SDK. Session active for 25r21a05e2@mlrit.ac.in.</span>
              </div>
            </div>

            {resetMessage && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', padding: '10px 14px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} /> {resetMessage}
              </div>
            )}

            <button 
              onClick={handlePasswordReset}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 20px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #1e1b4b, #4338ca)',
                color: 'white',
                fontWeight: 700,
                fontSize: '0.9rem',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(67, 56, 202, 0.3)',
                marginTop: '8px'
              }}
              type="button"
            >
              <Key size={16} /> Send Password Reset Email
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
