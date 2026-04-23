"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { LayoutDashboard, Users, Radio, LogOut, User } from 'lucide-react';
import styles from './superadmin.module.css';

export default function SuperAdminLayout({
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
    { path: '/superadmin', label: 'Overview', icon: LayoutDashboard },
    { path: '/superadmin/owners', label: 'PG Owners', icon: Users },
    { path: '/superadmin/broadcast', label: 'Global Broadcast', icon: Radio },
    { path: '/profile', label: 'My Profile', icon: User },
  ];

  return (
    <div className={styles.superadminLayout}>
      <motion.aside 
        className={`${styles.sidebar} glass`}
        initial={{ x: -280 }}
        animate={{ x: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className={styles.sidebarHeader}>
          <div className={`${styles.logoSmall} pulse-ring`}></div>
          <span className={styles.brandText}>StaySync <span className={styles.roleBadge}>Admin</span></span>
        </div>
        
        <nav className={styles.sidebarNav}>
          {navItems.map((item, index) => {
            const isActive = pathname === item.path || (item.path !== '/superadmin' && pathname.startsWith(item.path));
            return (
              <motion.div 
                key={item.path}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
              >
                <Link 
                  href={item.path} 
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
          <button className={styles.logoutBtn} onClick={handleLogout}>
            <LogOut size={20} className={styles.navIcon} />
            <span>Sign Out</span>
          </button>
        </div>
      </motion.aside>

      <main className={styles.mainContent}>
        <motion.div
          className={styles.contentWrapper}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
