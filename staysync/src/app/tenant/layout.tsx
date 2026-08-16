"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Building, Bell, X, ShieldAlert, CreditCard } from 'lucide-react';
import { getTenantDashboardData } from '@/app/actions/tenant';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import TenantHeaderTitle from './TenantHeaderTitle';
import TenantBottomNav from './TenantBottomNav';
import styles from './tenant.module.css';

import AccessDeniedCard from '@/components/AccessDeniedCard';
import { routePrefetcher } from '@/lib/routePrefetcher';

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter();
  const [hostelName, setHostelName] = useState<string>('Himalaya stayin');
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(2);
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const [isMounted, setIsMounted] = useState<boolean>(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    routePrefetcher.prefetchIdle(router, [
      '/tenant?tab=Dashboard',
      '/tenant?tab=Payments',
      '/tenant?tab=Notices',
      '/tenant?tab=Complaints',
      '/tenant?tab=Profile',
      '/tenant/notifications',
      '/tenant/profile'
    ]);
  }, [router]);

  const cachedRole = isMounted ? localStorage.getItem('userRole') : null;
  if (isMounted && (cachedRole === 'pg_owner' || cachedRole === 'owner' || cachedRole === 'team_member')) {
    return <AccessDeniedCard reason="unauthorized_role" currentRole="pg_owner" requiredRole="tenant" title="403 - Access Denied" subtitle="You are currently signed in as a PG Owner/Staff. This portal is reserved for Tenants." />;
  }

  return (
    <div className={styles.tenantLayout}>
      {/* Mobile Wave Header (Matched to PG Owner Dashboard, displaying active hostel name) */}
      {!isDesktop && (
        <header className={styles.mobileWaveHeader}>
          <div className={styles.mobileWaveHeaderTop}>
            <Building size={22} style={{ color: '#ffffff' }} />
          <TenantHeaderTitle hostelName={hostelName} />

          <button 
            className={styles.bellIconContainer} 
            title="Notifications"
            onClick={() => {
              setIsNotifOpen(!isNotifOpen);
              if (unreadCount > 0) setUnreadCount(0);
            }}
          >
            <Bell size={20} color="#ffffff" />
            {unreadCount > 0 && <div className={styles.notificationDot}></div>}
          </button>

          {/* Interactive Notifications Popover */}
          <AnimatePresence>
            {isNotifOpen && (
              <motion.div 
                className={styles.notifDropdown}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                <div className={styles.notifHeader}>
                  <h4 className={styles.notifTitle}>
                    <Bell size={16} color="#4F46E5" />
                    <span>Notifications</span>
                  </h4>
                  <button className={styles.closeBtn} onClick={() => setIsNotifOpen(false)}>
                    <X size={16} />
                  </button>
                </div>

                <div className={styles.notifList}>
                  <div className={styles.notifItem}>
                    <div className={styles.notifIcon}>
                      <CreditCard size={18} />
                    </div>
                    <div>
                      <div className={styles.notifItemTitle}>Monthly Rent Payment Due</div>
                      <div className={styles.notifItemMsg}>₹10,500 pending payment for July 2026.</div>
                      <div className={styles.notifItemTime}>Today • 10:30 AM</div>
                    </div>
                  </div>

                  <div className={styles.notifItem}>
                    <div className={styles.notifIcon} style={{ background: '#fef3c7', color: '#d97706' }}>
                      <ShieldAlert size={18} />
                    </div>
                    <div>
                      <div className={styles.notifItemTitle}>Welcome to {hostelName}</div>
                      <div className={styles.notifItemMsg}>Your tenant portal account is active & verified.</div>
                      <div className={styles.notifItemTime}>Yesterday</div>
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={() => {
                    setIsNotifOpen(false);
                    router.push('/tenant/notifications');
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#EEF2FF',
                    color: '#4F46E5',
                    border: 'none',
                    borderTop: '1px solid #E2E8F0',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  View all notifications
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className={styles.waveContainer}>
            <svg viewBox="0 0 500 75" preserveAspectRatio="none" className={styles.waveSvg}>
              <defs>
                {/* Header Base Gradient */}
                <linearGradient id="mobileHeaderGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#4F46E5" />
                  <stop offset="50%" stopColor="#7C3AED" />
                  <stop offset="100%" stopColor="#A855F7" />
                </linearGradient>

                {/* Liquid Glass Band Gradient - Directly Absorbs and Refracts Header Gradient Colors */}
                <linearGradient id="liquidGlassBandGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6366F1" />
                  <stop offset="35%" stopColor="#818CF8" />
                  <stop offset="50%" stopColor="#A855F7" />
                  <stop offset="75%" stopColor="#C084FC" />
                  <stop offset="100%" stopColor="#E9D5FF" />
                </linearGradient>

                {/* Liquid Glass Refraction & Depth Drop Shadows */}
                <filter id="liquidGlassLensFilter" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#4F46E5" floodOpacity="0.45" />
                  <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#ffffff" floodOpacity="0.75" />
                </filter>
              </defs>

              {/* Layer 1: Main Purple Gradient Header Shape */}
              <path 
                d="M -10,0 L 510,0 L 510,18 C 375,52 125,52 -10,18 Z" 
                fill="url(#mobileHeaderGrad)" 
              />

              {/* Layer 2: Liquid Glass Color Aura Glow (26px) - Absorbs Header Tones */}
              <path 
                d="M -10,18 C 125,52 375,52 510,18" 
                fill="none"
                stroke="url(#liquidGlassBandGrad)" 
                strokeWidth="26"
                strokeLinecap="round"
                opacity="0.4"
                filter="url(#liquidGlassLensFilter)"
              />

              {/* Layer 3: Thick Liquid Glass Refraction Body (22px) - Rich Header Gradient Absorption */}
              <path 
                d="M -10,18 C 125,52 375,52 510,18" 
                fill="none"
                stroke="url(#liquidGlassBandGrad)" 
                strokeWidth="22"
                strokeLinecap="round"
                opacity="0.88"
              />

              {/* Layer 4: Translucent White Glass Sheen (14px) - Crystalline Gloss Effect */}
              <path 
                d="M -10,18 C 125,52 375,52 510,18" 
                fill="none"
                stroke="#ffffff" 
                strokeWidth="14"
                strokeLinecap="round"
                opacity="0.32"
              />

              {/* Layer 5: Top Specular Light Glare (2.5px) */}
              <path 
                d="M -10,16.5 C 125,50.5 375,50.5 510,16.5" 
                fill="none"
                stroke="rgba(255, 255, 255, 0.85)" 
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Layer 6: Caustic Bottom Rim Highlight (1.5px) */}
              <path 
                d="M -10,19.5 C 125,53.5 375,53.5 510,19.5" 
                fill="none"
                stroke="rgba(255, 255, 255, 0.45)" 
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
      </header>
      )}

      <main className={styles.mainContent}>
        <motion.div
          className={styles.contentWrapper}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </main>

      {!isDesktop && <TenantBottomNav />}
    </div>
  );
}
