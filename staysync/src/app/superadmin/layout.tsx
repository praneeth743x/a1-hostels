"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Users, Radio, LogOut, User, Settings } from 'lucide-react';
import styles from './superadmin.module.css';

import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import AccessDeniedCard from '@/components/AccessDeniedCard';

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [optimisticPath, setOptimisticPath] = useState<string | null>(null);
  
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(true);
  const [logoUrl, setLogoUrl] = useState<string>('/himalaya_logo.png');

  useEffect(() => {
    setOptimisticPath(null);
  }, [pathname]);

  useEffect(() => {
    // Fast-path local storage check on client mount
    if (typeof window !== 'undefined') {
      const cachedLogo = localStorage.getItem('cachedLogoUrl');
      if (cachedLogo) setLogoUrl(cachedLogo);

      const cachedRole = localStorage.getItem('userRole');
      if (cachedRole === 'super_admin') {
        setIsSuperAdmin(true);
        setIsVerifying(false);
      }
    }

    // Fetch website logo from system_settings
    getDoc(doc(db, 'system_settings', 'landing')).then((snap) => {
      if (snap.exists() && snap.data()?.logoUrl) {
        const url = snap.data().logoUrl;
        setLogoUrl(url);
        if (typeof window !== 'undefined') localStorage.setItem('cachedLogoUrl', url);
      }
    }).catch(() => {});

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsSuperAdmin(false);
        setIsVerifying(false);
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userUid');
        router.replace('/login');
        return;
      }

      const cleanEmail = (user.email || '').trim().toLowerCase();
      // Recognized super admin emails
      if (cleanEmail === '25r21a05e2@mlrit.ac.in' || cleanEmail === 'admin@raliving.com') {
        if (typeof window !== 'undefined') localStorage.setItem('userRole', 'super_admin');
        setIsSuperAdmin(true);
        setIsVerifying(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'user_profiles', user.uid));
        if (snap.exists() && snap.data()?.role === 'super_admin') {
          if (typeof window !== 'undefined') localStorage.setItem('userRole', 'super_admin');
          setIsSuperAdmin(true);
        } else {
          setIsSuperAdmin(false);
        }
      } catch (err) {
        console.error("SuperAdmin profile verification error:", err);
        const cached = typeof window !== 'undefined' ? localStorage.getItem('userRole') : null;
        setIsSuperAdmin(cached === 'super_admin');
      } finally {
        setIsVerifying(false);
      }
    });

    return unsub;
  }, []);

  if (isVerifying && isSuperAdmin === null) {
    return (
      <div style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%)',
        color: '#FFFFFF'
      }}>
        <img
          suppressHydrationWarning
          src={typeof window !== 'undefined' ? (localStorage.getItem('cachedLogoUrl') || logoUrl) : logoUrl}
          alt="Logo"
          style={{
            width: '64px',
            height: '64px',
            objectFit: 'contain',
            borderRadius: '16px',
            marginBottom: '24px',
            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)'
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 0.8s linear infinite' }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#CBD5E1' }}>Verifying Super Admin Access...</span>
        </div>
      </div>
    );
  }

  if (isSuperAdmin === false) {
    return <AccessDeniedCard reason="unauthorized_role" title="403 - Super Admin Required" subtitle="Super Admin privileges are required to access this management portal." />;
  }

  const handleLogout = async () => {
    try {
      const { auth } = await import('@/lib/firebase');
      const { signOut } = await import('firebase/auth');
      await signOut(auth);
    } catch (err) {
      console.error("Error signing out:", err);
    } finally {
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('userRole');
      localStorage.removeItem('userUid');
      localStorage.clear();
      sessionStorage.clear();
      sessionStorage.setItem('loggedOut', 'true');
      window.location.href = '/login';
    }
  };

  const navItems = [
    { path: '/superadmin/owners', label: 'PG Owners', icon: Users, matchKey: '/owners' },
    { path: '/superadmin/whatsapp-rules', label: 'Features', icon: Settings, matchKey: '/whatsapp-rules' },
    { path: '/superadmin/profile', label: 'Profile', icon: User, matchKey: '/profile' },
  ];

  const currentPath = optimisticPath || pathname;
  const activeIndex = Math.max(0, navItems.findIndex(item => currentPath.includes(item.matchKey)));

  const handleNavClick = (path: string) => {
    setOptimisticPath(path);
  };

  return (
    <div className={styles.superadminLayout}>
      <motion.aside 
        className={styles.sidebar}
        initial={{ x: -280 }}
        animate={{ x: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <div className={styles.sidebarHeader}>
          <div className={styles.brandLogo}>
            <div className={styles.logoSmall}>S</div>
            <div>
              <span className={styles.brandText}>Raliving</span>
              <span className={styles.roleBadge}>ADMIN</span>
            </div>
          </div>
        </div>
        
        <nav className={styles.sidebarNav}>
          {navItems.map((item, index) => {
            const isActive = currentPath.includes(item.matchKey);
            return (
              <motion.div 
                key={item.path}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
              >
                <Link 
                  href={item.path} 
                  onPointerDown={() => handleNavClick(item.path)}
                  onClick={() => handleNavClick(item.path)}
                  onMouseEnter={() => router.prefetch(item.path)}
                  onTouchStart={() => router.prefetch(item.path)}
                  className={`${styles.navLink} ${isActive ? styles.active : ''}`}
                >
                  <item.icon size={20} className={styles.navIcon} />
                  <span>{item.label}</span>
                </Link>
              </motion.div>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <button className={styles.logoutBtn} onClick={handleLogout} type="button">
            <LogOut size={18} className={styles.navIcon} />
            <span>Sign Out</span>
          </button>
        </div>
      </motion.aside>

      <main className={styles.mainContent}>
        <motion.div
          className={styles.contentWrapper}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {children}
        </motion.div>
      </main>

      {/* Floating Mobile Bottom Navigation (Same as PG Owner Portal) */}
      <nav className={styles.mobileBottomNav}>
        <div className={styles.mobileBottomNavInner} style={{ paddingBottom: 'env(safe-area-inset-bottom)', position: 'relative' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isMatch = currentPath.includes(item.matchKey);
            return (
              <Link
                key={item.path}
                href={item.path}
                prefetch={true}
                onPointerDown={() => handleNavClick(item.path)}
                onClick={() => handleNavClick(item.path)}
                className={`${styles.bottomNavItem} ${isMatch ? styles.active : ''}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={22} />
                </div>
                <span>{item.label}</span>
              </Link>
            );
          })}

          <button
            onClick={handleLogout}
            className={styles.bottomNavItem}
            type="button"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LogOut size={22} />
            </div>
            <span>Sign Out</span>
          </button>

          {/* Persistent Sliding Indicator */}
          {navItems.length > 0 && (
            <div 
              style={{
                position: 'absolute',
                bottom: '4px',
                left: '12px',
                width: `calc((100% - 24px) / ${navItems.length + 1})`,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                pointerEvents: 'none',
                transform: `translate3d(${activeIndex * 100}%, 0, 0)`,
                transition: 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)',
                zIndex: 2,
              }}
            >
              <div className={styles.activeTabLine} />
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}
