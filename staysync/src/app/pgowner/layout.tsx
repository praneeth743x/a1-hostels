"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { LayoutDashboard, Users, ClipboardList, LogOut, User, Building } from 'lucide-react';
import styles from './pgowner.module.css';

export default function PGOwnerLayout({
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
    { path: '/pgowner', label: 'Command Center', icon: LayoutDashboard },
    { path: '/pgowner/properties', label: 'My Hostels', icon: Building },
    { path: '/pgowner/tenants', label: 'Tenant Directory', icon: Users },
    { path: '/pgowner/notices', label: 'Notice Board', icon: ClipboardList },
    { path: '/profile', label: 'My Profile', icon: User },
  ];

  return (
    <div className={styles.pgownerLayout}>
      <motion.aside 
        className={`${styles.sidebar} glass`}
        initial={{ x: -280 }}
        animate={{ x: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className={styles.sidebarHeader}>
          <div className={`${styles.logoSmall} pulse-ring`}></div>
          <span className={styles.brandText}>StaySync <span className={styles.roleBadge}>Owner</span></span>
        </div>
        
        <nav className={styles.sidebarNav}>
          {navItems.map((item, index) => {
            const isActive = pathname === item.path || (item.path !== '/pgowner' && pathname.startsWith(item.path));
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
