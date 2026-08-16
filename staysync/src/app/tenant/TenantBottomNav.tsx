"use client";

import React, { Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Home, CreditCard, MessageCircle, MessageSquare, Settings } from 'lucide-react';
import styles from './tenantDashboard.module.css'; // Make sure this path is correct if we move it

function BottomNavContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Determine active tab from URL search params & route with optimistic override
  const isNotifications = pathname.includes('/notifications');
  const activeTabFromUrl = searchParams.get('tab') || 'Dashboard';
  const [optimisticTab, setOptimisticTab] = React.useState<string>(activeTabFromUrl);

  React.useEffect(() => {
    setOptimisticTab(activeTabFromUrl);
  }, [activeTabFromUrl]);

  const navItems = [
    { id: 'Dashboard' as const, label: 'Dashboard', icon: Home },
    { id: 'Payments' as const, label: 'Payments', icon: CreditCard },
    { id: 'Notices' as const, label: 'Notices', icon: MessageCircle },
    { id: 'Complaints' as const, label: 'Complaints', icon: MessageSquare },
    { id: 'Profile' as const, label: 'Profile', icon: Settings },
  ];

  const currentTab = !isNotifications ? optimisticTab : 'Dashboard';
  const activeIndex = Math.max(0, navItems.findIndex(item => !isNotifications && currentTab === item.id));

  return (
    <nav className={styles.mobileBottomNav}>
      <div className={styles.mobileBottomNavInner} style={{ position: 'relative' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isMatch = !isNotifications && currentTab === item.id;

          return (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                setOptimisticTab(item.id);
                if (isNotifications) {
                  router.push(`/tenant?tab=${item.id}`);
                } else {
                  router.push(`?tab=${item.id}`);
                }
              }}
              className={`${styles.bottomNavItem} ${isMatch ? styles.bottomNavItemActive : ''}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} />
              </div>
              <span>{item.label}</span>
            </motion.button>
          );
        })}

        {/* Persistent Sliding Indicator */}
        {!isNotifications && (
          <div 
            style={{
              position: 'absolute',
              bottom: '3px',
              left: '8px',
              width: `calc((100% - 16px) / ${navItems.length})`,
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
  );
}

export default function TenantBottomNav() {
  return (
    <Suspense fallback={null}>
      <BottomNavContent />
    </Suspense>
  );
}
