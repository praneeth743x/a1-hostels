"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Users, ClipboardList, LogOut, User, Building, Home, DoorOpen, Banknote, CreditCard, Menu, Bell, X, ChevronRight, Folder, Pizza, Camera, History, Search, TrendingUp, ChevronDown, Plus, Globe, Headphones, ChevronLeft, Calendar, Download } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getProperties } from '@/app/actions/pgowner';
import styles from './pgowner.module.css';
import drawerStyles from './drawer.module.css';

export default function PGOwnerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [properties, setProperties] = useState<any[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<any>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const res = await getProperties(user.uid);
          if (res.success && res.data) {
            const props = res.data;
            setProperties(props);
          
          // Determine selected property from URL if we are on a specific property page
          const match = pathname.match(/\/pgowner\/properties\/(pg_[^/]+)/);
          if (match && match[1]) {
            const prop = props.find(p => p.pg_id === match[1]);
            if (prop) setSelectedProperty(prop);
            else if (props.length > 0) setSelectedProperty(props[0]);
          } else if (props.length > 0) {
            setSelectedProperty(props[0]);
          }
          } else {
            console.error("Error fetching properties for sidebar:", res.error);
          }
        } catch (error) {
          console.error("Error fetching properties for sidebar:", error);
        }
      }
    });
    return () => unsubscribe();
  }, [pathname]);

  const handleLogout = () => {
    auth.signOut().then(() => router.push('/'));
  };

  const handlePropertySwitch = (pgId: string) => {
    setIsDropdownOpen(false);
    setIsMobileDrawerOpen(false);
    router.push(`/pgowner/properties/${pgId}`);
  };

  const mainMenuItems = [
    { path: '/pgowner/properties', label: 'Hostel Management', icon: Building },
    { path: '#', label: 'Notice Board', icon: ClipboardList },
    { path: '/profile', label: 'My Profile', icon: User },
  ];

  const renderSidebarContent = () => (
    <>
      <div className={drawerStyles.drawerHeader}>
        <div className={drawerStyles.drawerHeaderTop}>
          <h3 className={drawerStyles.drawerHeaderTitle}>HOSTEL MANAGEMENT</h3>
          {/* Close button only on mobile */}
          <button className={`${drawerStyles.drawerCloseBtn} mobile-only-close`} onClick={() => setIsMobileDrawerOpen(false)}>
            <X size={16} />
          </button>
        </div>
        <div className={drawerStyles.drawerHostelInfo}>
          <div className={drawerStyles.drawerHostelIcon}>
            <Building size={28} color="#0d7990" />
          </div>
          <div className={drawerStyles.drawerHostelDetails}>
            <h2 className={drawerStyles.drawerHostelName}>{selectedProperty ? selectedProperty.name : 'All Hostels'}</h2>
            <div className={drawerStyles.drawerActiveDot}>
              <div className={drawerStyles.activeDotIndicator} /> Active
            </div>
            <div className={drawerStyles.whatsappPill} style={{background: 'transparent', padding: 0, color: '#94A3B8', fontSize: '0.65rem'}}>
              POWERED BY STAYSYNC
            </div>
          </div>
        </div>
      </div>

      <div className={drawerStyles.drawerBody}>
        {/* Switch Hostel Section */}
        <div className={drawerStyles.drawerSection}>
          <h4 className={drawerStyles.drawerSectionTitle}>SWITCH HOSTEL</h4>
          
          <div style={{position: 'relative'}}>
            <button 
              className={drawerStyles.switchHostelCard}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              style={{ width: '100%', border: 'none', background: '#F8FAFC', cursor: 'pointer' }}
            >
              <div className={drawerStyles.switchHostelLeft}>
                <div className={drawerStyles.switchHostelIcon}>
                  <Building size={16} color="#10B981" />
                </div>
                <span className={drawerStyles.switchHostelText}>{selectedProperty ? selectedProperty.name : 'Select a hostel'}</span>
              </div>
              <ChevronDown size={16} color="#94A3B8" />
            </button>
            
            <AnimatePresence>
              {isDropdownOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, 
                    background: 'white', borderRadius: '12px', 
                    boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 100,
                    maxHeight: '200px', overflowY: 'auto', marginTop: '4px',
                    border: '1px solid #E2E8F0'
                  }}
                >
                  {properties.map(p => (
                    <div 
                      key={p.pg_id}
                      onClick={() => handlePropertySwitch(p.pg_id)}
                      style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#334155' }}
                    >
                      <Building size={14} color="#64748B" />
                      {p.name}
                    </div>
                  ))}
                  {properties.length === 0 && (
                    <div style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#94A3B8', textAlign: 'center' }}>No hostels found</div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Main Menu Section */}
        <div className={drawerStyles.drawerSection}>
          <h4 className={drawerStyles.drawerSectionTitle}>MAIN MENU</h4>
          {mainMenuItems.map((item, index) => (
            <Link 
              key={item.path}
              href={item.path} 
              className={drawerStyles.drawerMenuItem}
              style={{ textDecoration: 'none' }}
              onClick={() => setIsMobileDrawerOpen(false)}
            >
              <div className={drawerStyles.drawerMenuItemLeft}>
                <div className={`${drawerStyles.drawerMenuIcon} ${drawerStyles.iconDoc}`}>
                  <item.icon size={18} />
                </div>
                <span className={drawerStyles.drawerMenuItemText}>{item.label}</span>
              </div>
              <ChevronRight size={16} color="#CBD5E1" />
            </Link>
          ))}
        </div>
      </div>
      
      <div className={drawerStyles.drawerFooter}>
        <button className={drawerStyles.drawerLogoutBtn} onClick={handleLogout}>
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </>
  );

  // Replicate the exact drawer shown in the screenshot
  const renderMobileDrawer = () => (
    <AnimatePresence>
      {isMobileDrawerOpen && (
        <>
          <motion.div 
            className={drawerStyles.mobileDrawerOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileDrawerOpen(false)}
          />
          <motion.div
            className={drawerStyles.mobileDrawerContainer}
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
          >
            {renderSidebarContent()}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  // Dynamic header title based on pathname
  let mobileTitle = "Dashboard";
  if (pathname.includes('/tenants')) mobileTitle = "Tenants";
  if (pathname.includes('/rooms')) mobileTitle = "Rooms";
  if (pathname.includes('/history')) mobileTitle = "History";
  if (pathname.includes('/dues')) mobileTitle = "Dues";
  if (pathname.includes('/notices')) mobileTitle = "Notice Board";
  if (pathname.includes('/properties')) mobileTitle = "My Hostels";

  return (
    <div className={styles.appBackground}>
      <div className={styles.pgownerLayout}>
        {/* Desktop Sidebar (hidden on mobile via CSS) */}
        <motion.aside 
          className={`${styles.sidebar} glass`}
          initial={{ x: -280 }}
          animate={{ x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{ padding: 0 }}
        >
          {renderSidebarContent()}
        </motion.aside>

      <main className={styles.mainContent}>
        {/* Desktop Header Assembly (hidden on mobile via CSS) */}
        {/* Floating Workspace Header */}
        <header className={styles.workspaceHeader}>
          <div className={styles.workspaceHeaderLeft}>
            <div className={styles.workspaceTitleBox}>
              <h1 className={styles.workspaceTitle}>{mobileTitle}</h1>
              <p className={styles.workspaceSubtitle}>StaySync Command Center</p>
            </div>
          </div>
          
          <div className={styles.workspaceHeaderCenter}>
            <div className={styles.workspaceSearch}>
              <Search size={16} className={styles.searchIcon} />
              <input type="text" placeholder="Search hostels, tenants, or press ⌘K" className={styles.searchInput} />
            </div>
          </div>

          <div className={styles.workspaceHeaderRight}>
            <div className={styles.workspaceStats}>
              <TrendingUp size={14} color="#4F46E5" />
              <span>94% Occupied</span>
            </div>

            <div className={styles.workspaceDivider} />

            <div className={styles.workspaceActionIcons}>
              <button className={styles.iconBtn}><Plus size={18} /></button>
              <button className={styles.iconBtn}><CreditCard size={18} /></button>
              <button className={styles.iconBtn}>
                <Bell size={18} />
                <span className={styles.badge}>3</span>
              </button>
            </div>

            <div className={styles.workspaceDivider} />

            <div className={styles.workspaceProfile}>
              <img src="https://i.pravatar.cc/150?img=32" alt="Profile" className={styles.avatar} />
            </div>
          </div>
        </header>
        {/* Mobile Top Wave Header */}
        <header className={styles.mobileWaveHeader}>
          <div className={styles.mobileWaveHeaderTop}>
            <Menu size={24} style={{ cursor: 'pointer', color: '#ffffff' }} onClick={() => setIsMobileDrawerOpen(true)} />
            <div className={styles.mobileHeaderTitleContainer}>
              <h1 className={styles.mobileHeaderTitle}>{mobileTitle}</h1>
              {selectedProperty && (
                <span className={styles.mobileHeaderSubtitle}>{selectedProperty.name}</span>
              )}
            </div>
            <div className={styles.bellIconContainer}>
              <Bell size={22} style={{ cursor: 'pointer', color: '#ffffff' }} />
              <div className={styles.notificationDot}></div>
            </div>
          </div>
          
          <div className={styles.waveContainer}>
            <svg viewBox="0 0 500 70" preserveAspectRatio="none" className={styles.waveSvg}>
              {/* Layer 1: Translucent Soft Lavender Under-Wave */}
              <path 
                d="M 0,0 L 500,0 L 500,32 C 375,44 300,62 250,62 C 200,62 125,44 0,35 Z" 
                fill="#e9d5ff" 
                opacity="0.85"
              />
              {/* Layer 2: Main Gradient Purple Header Wave dipping in the center */}
              <path 
                d="M 0,0 L 500,0 L 500,20 C 375,32 300,50 250,50 C 200,50 125,32 0,22 Z" 
                fill="url(#mobileHeaderGrad)" 
              />
              <defs>
                <linearGradient id="mobileHeaderGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#4F46E5" />
                  <stop offset="50%" stopColor="#7C3AED" />
                  <stop offset="100%" stopColor="#A855F7" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </header>

        {renderMobileDrawer()}

        <motion.div 
          className={styles.contentWrapper}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {children}
        </motion.div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className={styles.mobileBottomNav}>
        <Link href={selectedProperty ? `/pgowner/properties/${selectedProperty.pg_id}` : `/pgowner/properties`} className={`${styles.bottomNavItem} ${pathname.includes('/properties/') ? styles.active : ''}`}>
          <Home size={22} />
          <span>Dashboard</span>
        </Link>
        <Link href={`/pgowner/tenants${selectedProperty ? `?pgId=${selectedProperty.pg_id}` : ''}`} className={`${styles.bottomNavItem} ${pathname.includes('/tenants') ? styles.active : ''}`}>
          <Users size={22} />
          <span>Tenants</span>
        </Link>
        <Link href={`/pgowner/rooms${selectedProperty ? `?pgId=${selectedProperty.pg_id}` : ''}`} className={`${styles.bottomNavItem} ${pathname.includes('/rooms') ? styles.active : ''}`}>
          <Building size={22} />
          <span>Rooms</span>
        </Link>
        <Link href={`/pgowner/dues${selectedProperty ? `?pgId=${selectedProperty.pg_id}` : ''}`} className={`${styles.bottomNavItem} ${pathname.includes('/dues') ? styles.active : ''}`}>
          <ClipboardList size={22} />
          <span>Dues</span>
        </Link>
        <Link href={`/pgowner/history${selectedProperty ? `?pgId=${selectedProperty.pg_id}` : ''}`} className={`${styles.bottomNavItem} ${pathname.includes('/history') ? styles.active : ''}`}>
          <History size={22} />
          <span>History</span>
        </Link>
      </nav>
      </div>
    </div>
  );
}
