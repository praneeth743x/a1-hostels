"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, LifeBuoy, LogOut, Wallet, User } from 'lucide-react';
import styles from './tenant.module.css';

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    router.push('/');
  };

  const navItems = [
    { path: '/tenant', label: 'Payment Hub', icon: Wallet },
    { path: '/tenant/support', label: 'Help Desk', icon: LifeBuoy },
    { path: '/profile', label: 'Profile', icon: User },
  ];

  return (
    <div className={styles.tenantLayout}>
      <main className={styles.mainContent}>
        <motion.div
          className={styles.contentWrapper}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </main>

      {/* Mobile-first bottom navigation */}
      <nav className={`${styles.bottomNav} glass`}>
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link 
              key={item.path}
              href={item.path} 
              className={`${styles.navLink} ${isActive ? styles.active : ''}`}
            >
              <div className={styles.navIconWrapper}>
                <item.icon size={24} className={styles.navIcon} />
                <AnimatePresence>
                  {isActive && (
                    <motion.div 
                      layoutId="nav-indicator"
                      className={styles.navIndicator}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    />
                  )}
                </AnimatePresence>
              </div>
              <span className={styles.navLabel}>{item.label}</span>
            </Link>
          );
        })}
        <button className={`${styles.navLink} ${styles.logoutBtn}`} onClick={handleLogout}>
          <div className={styles.navIconWrapper}>
            <LogOut size={24} className={styles.navIcon} />
          </div>
          <span className={styles.navLabel}>Log out</span>
        </button>
      </nav>
    </div>
  );
}
