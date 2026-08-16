"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Users, ClipboardList, LogOut, User, Building, Search, Bell, ChevronRight, Menu, X, CheckCircle, Smartphone, HelpCircle, Shield, Globe } from 'lucide-react';
import styles from './pgowner.module.css';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function PGOwnerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [activePgId, setActivePgId] = useState<string | null>(null);

  useEffect(() => {
    setActivePgId(localStorage.getItem('activePgId'));
    const handlePgChange = () => {
      setActivePgId(localStorage.getItem('activePgId'));
    };
    window.addEventListener('pgChanged', handlePgChange);
    return () => window.removeEventListener('pgChanged', handlePgChange);
  }, []);

  const handleLogout = async () => {
    await auth.signOut();
    localStorage.removeItem('activePgId');
    router.push('/');
  };

  const navItems = [
    { path: '/pgowner', label: 'Command Center', subLabel: 'Overview & Analytics', icon: LayoutDashboard },
    { path: '/pgowner/properties', label: 'My Hostels', subLabel: 'Manage properties', icon: Building },
    { path: '/pgowner/tenants', label: 'Tenant Directory', subLabel: 'Manage all tenants', icon: Users },
    { path: '/pgowner/history', label: 'Payment History', subLabel: 'Transactions & dues', icon: ClipboardList },
    { path: '/profile', label: 'My Profile', subLabel: 'Account settings', icon: User },
  ];

  return (
    <div className={styles.pgownerLayout}>
      
      {/* SIDEBAR USING MOBILE DRAWER STYLES */}
      <aside className={styles.mobileDrawerContainer} style={{ transform: 'none', position: 'sticky', top: 0, height: '100vh', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        <div className={styles.drawerHeader}>
          <div className={styles.drawerHeaderTop}>
            <div className={styles.drawerHeaderTitle}>
              <div style={{width: 24, height: 24, background: '#3b82f6', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 14}}>
                S
              </div>
              Raliving
            </div>
          </div>
          
          <div className={styles.drawerHostelInfo}>
            <div className={styles.drawerHostelIcon}>
              <Building size={24} color="#3b82f6" />
            </div>
            <div className={styles.drawerHostelDetails}>
              <h2 className={styles.drawerHostelName}>Venkateshwara</h2>
              <div className={styles.drawerActiveDot}>
                <div style={{width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 0 2px rgba(34,197,94,0.2)'}}></div>
                Active Hostel
              </div>
            </div>
          </div>
        </div>

        <div className={styles.drawerBody}>
          <h3 className={styles.drawerSectionTitle}>MAIN MENU</h3>
          
          {navItems.map((item, index) => {
            const isActive = pathname === item.path || (item.path !== '/pgowner' && pathname.startsWith(item.path));
            return (
              <Link href={item.path} key={item.path} style={{ textDecoration: 'none' }}>
                <div className={styles.drawerMenuRow}>
                  <div className={styles.drawerMenuLeft}>
                    <div className={styles.drawerIconWrapper} style={isActive ? { background: '#3b82f6', color: 'white' } : {}}>
                      <item.icon size={20} />
                    </div>
                    <div className={styles.drawerMenuText}>
                      <span style={isActive ? { color: '#3b82f6' } : {}}>{item.label}</span>
                      <span className={styles.drawerMenuSubText}>{item.subLabel}</span>
                    </div>
                  </div>
                  <ChevronRight size={16} color="#cbd5e1" />
                </div>
              </Link>
            );
          })}
          
          <h3 className={styles.drawerSectionTitle} style={{ marginTop: '24px' }}>HELP & SETTINGS</h3>
          
          <div className={styles.drawerMenuRow}>
            <div className={styles.drawerMenuLeft}>
              <div className={styles.drawerIconWrapper}>
                <Globe size={20} />
              </div>
              <div className={styles.drawerMenuText}>
                <span>Language</span>
                <span className={styles.drawerMenuSubText}>English</span>
              </div>
            </div>
            <ChevronRight size={16} color="#cbd5e1" />
          </div>
          
          <div className={styles.drawerMenuRow}>
            <div className={styles.drawerMenuLeft}>
              <div className={styles.drawerIconWrapper}>
                <HelpCircle size={20} />
              </div>
              <div className={styles.drawerMenuText}>
                <span>Support</span>
                <span className={styles.drawerMenuSubText}>Get help</span>
              </div>
            </div>
            <ChevronRight size={16} color="#cbd5e1" />
          </div>

          <div className={styles.drawerMenuRow} onClick={handleLogout} style={{ borderBottom: 'none' }}>
            <div className={styles.drawerMenuLeft}>
              <div className={styles.drawerIconWrapper} style={{ background: '#fef2f2', color: '#ef4444' }}>
                <LogOut size={20} />
              </div>
              <div className={styles.drawerMenuText}>
                <span style={{ color: '#ef4444' }}>Logout</span>
              </div>
            </div>
          </div>

        </div>
        
        <div className={styles.drawerFooter}>
          <h4 className={styles.drawerFooterTitle}>Raliving PRO</h4>
          <p className={styles.drawerFooterSub}>Manage multiple properties seamlessly</p>
          <div className={styles.drawerFooterLinks}>
            <Link href="#">Terms</Link>
            <Link href="#">Privacy</Link>
            <Link href="#">Help</Link>
          </div>
          <h5 className={styles.drawerFooterBrand}>Raliving</h5>
          <p className={styles.drawerFooterCopy}>© 2026 Raliving Inc.</p>
        </div>
      </aside>

      <main className={styles.mainContent}>
        {/* Mobile Header (Hidden on Desktop) */}
        <div className={styles.mobileHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className={styles.mobileLogoSquare}>S</div>
            <span className={styles.mobileHeaderTitle}>Raliving</span>
          </div>
          <Menu size={24} color="#0f172a" />
        </div>

        {/* Premium Global Header for Desktop */}
        <header className={styles.premiumDashboardHeader}>
          <div className={styles.headerTopRow}>
            <div className={styles.headerTitleGroup}>
              <div className={styles.headerIconTile}>
                <Building size={24} color="#fff" />
              </div>
              <div className={styles.headerTextStack}>
                <h1 className={styles.headerMainTitle}>Venkateshwara</h1>
                <span className={styles.headerSubTitle}>Active Hostel</span>
              </div>
            </div>

            <div className={styles.headerSearchArea}>
              <Search size={18} className={styles.searchIcon} />
              <input type="text" placeholder="Search hostels, tenants, invoices..." className={styles.headerSearchInput} />
              <div className={styles.searchShortcut}>⌘K</div>
            </div>

            <div className={styles.headerActionsGroup}>
              <div className={styles.occupancyWidget}>
                <div className={styles.occTrend}>
                  <motion.svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4F6DFF" strokeWidth="2">
                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
                    <polyline points="16 7 22 7 22 13"></polyline>
                  </motion.svg>
                </div>
                <div className={styles.occData}>
                  <span className={styles.occLabel}>Occupancy</span>
                  <div className={styles.occValueRow}>
                    <span className={styles.occValue}>94%</span>
                    <span className={styles.occDelta}>▲ 2.4%</span>
                  </div>
                </div>
              </div>
              
              <div className={styles.headerIconButton}>
                <Bell size={20} />
                <span className={styles.headerBadge}>3</span>
              </div>

              <div className={styles.headerPrimaryBtn}>
                <span>+</span> New
              </div>

              <div className={styles.headerAvatarGroup}>
                <div className={styles.avatarCircle}>JD</div>
                <div className={styles.avatarText}>
                  <span className={styles.avatarName}>John Doe</span>
                  <span className={styles.avatarRole}>Owner</span>
                </div>
                <ChevronRight size={14} color="#94A3B8" style={{ transform: 'rotate(90deg)' }} />
              </div>
            </div>
          </div>

          <div className={styles.headerBottomRow}>
            <div className={styles.segmentedControl}>
              <div className={styles.segment}>Day</div>
              <div className={styles.segment}>Week</div>
              <div className={`${styles.segment} ${styles.segmentActive}`}>Month</div>
              <div className={styles.segment}>Year</div>
            </div>

            <div className={styles.datePickerControl}>
              <button className={styles.datePickerBtn}><ChevronRight size={16} style={{transform:'rotate(180deg)'}}/></button>
              <div className={styles.currentDate}>
                <CalendarIcon />
                July, 2026
                <ChevronRight size={14} style={{transform:'rotate(90deg)', marginLeft:4}} />
              </div>
              <button className={styles.datePickerBtn}><ChevronRight size={16}/></button>
            </div>

            <div className={styles.actionPills}>
              <div className={styles.actionPill}>
                <TrendingUpIcon /> Revenue
              </div>
              <div className={styles.actionPill}>
                <CreditCardIcon /> Payments
              </div>
              <div className={styles.actionPill}>
                <AlertCircleIcon /> Complaints
              </div>
              <div className={styles.actionPill}>
                <UsersIcon /> Visitors
              </div>
              <div className={styles.actionPill}>
                <DownloadIcon /> Export
              </div>
            </div>
          </div>
        </header>

        <motion.div
          className={styles.contentWrapper}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}

const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
);
const TrendingUpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4F6DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
);
const CreditCardIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
);
const AlertCircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
);
const UsersIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
);
const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
);