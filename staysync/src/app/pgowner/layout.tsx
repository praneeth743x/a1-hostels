"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, LayoutDashboard, Users, ClipboardList, LogOut, User, Building, Home, DoorOpen, Banknote, CreditCard, Menu, Bell, X, ChevronRight, Folder, Pizza, Camera, History, Search, TrendingUp, ChevronDown, Plus, Globe, Headphones, ChevronLeft, Calendar, Download, LifeBuoy, ShieldAlert, CheckCheck, MessageSquare, MessageCircle, ArrowRight, Lightbulb } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { doc, onSnapshot, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { rpcCall } from '@/lib/rpc';
import { HostelProvider, useHostel, usePermissions } from '@/context/HostelContext';
import { PERMISSIONS } from '@/permissions';
import { globalAppCache, getFromCache, saveToCache, clearUserCache } from '@/lib/cache';
import { navTracer } from '@/lib/navTracer';
import { routePrefetcher } from '@/lib/routePrefetcher';
import { setAppState } from '@/lib/appStateStore';
import { requestNotificationPermission, triggerPWANotification } from '@/lib/pwaNotifications';
import styles from './pgowner.module.css';
import drawerStyles from './drawer.module.css';
import AccessDeniedCard from '@/components/AccessDeniedCard';

function OptimisticRouteSkeleton({ targetRoute }: { targetRoute: string }) {
  if (targetRoute.includes('/tenants')) {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', minHeight: '65vh' }}>
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
          <div style={{ height: '70px', minWidth: '90px', backgroundColor: '#f1f5f9', borderRadius: '14px', animation: 'pulse 1.2s infinite ease-in-out' }} />
          <div style={{ height: '70px', minWidth: '90px', backgroundColor: '#f1f5f9', borderRadius: '14px', animation: 'pulse 1.2s infinite ease-in-out' }} />
          <div style={{ height: '70px', minWidth: '90px', backgroundColor: '#f1f5f9', borderRadius: '14px', animation: 'pulse 1.2s infinite ease-in-out' }} />
        </div>
        <div style={{ height: '48px', width: '100%', backgroundColor: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0', animation: 'pulse 1.2s infinite ease-in-out' }} />
        <div style={{ height: '48px', width: '100%', backgroundColor: '#4F46E5', opacity: 0.15, borderRadius: '14px', animation: 'pulse 1.2s infinite ease-in-out' }} />
        <div style={{ height: '110px', width: '100%', backgroundColor: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', animation: 'pulse 1.2s infinite ease-in-out' }} />
        <div style={{ height: '110px', width: '100%', backgroundColor: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', animation: 'pulse 1.2s infinite ease-in-out' }} />
      </div>
    );
  }

  if (targetRoute.includes('/rooms')) {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', minHeight: '65vh' }}>
        <div style={{ height: '44px', width: '100%', backgroundColor: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0', animation: 'pulse 1.2s infinite ease-in-out' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
          <div style={{ height: '130px', backgroundColor: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', animation: 'pulse 1.2s infinite ease-in-out' }} />
          <div style={{ height: '130px', backgroundColor: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', animation: 'pulse 1.2s infinite ease-in-out' }} />
          <div style={{ height: '130px', backgroundColor: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', animation: 'pulse 1.2s infinite ease-in-out' }} />
          <div style={{ height: '130px', backgroundColor: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', animation: 'pulse 1.2s infinite ease-in-out' }} />
        </div>
      </div>
    );
  }

  if (targetRoute.includes('/dues')) {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', minHeight: '65vh' }}>
        {/* Total Pending Fee Card Skeleton */}
        <div style={{ background: '#EF4444', borderRadius: '20px', padding: '16px 20px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 8px 24px rgba(239, 68, 68, 0.25)' }}>
          <div>
            <div style={{ fontSize: '0.8rem', opacity: 0.9, fontWeight: 600 }}>Total Pending Fee</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '4px' }}>₹...</div>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Banknote size={22} color="white" />
          </div>
        </div>

        {/* 3 Summary Pills Skeleton */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ flex: 1, background: '#FFF5F5', borderRadius: '16px', border: '1px solid #FECDD3', padding: '12px 4px', textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#ef4444' }}>-</div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#b91c1c' }}>OVERDUE</div>
          </div>
          <div style={{ flex: 1, background: '#FFFBEB', borderRadius: '16px', border: '1px solid #FDE68A', padding: '12px 4px', textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#f59e0b' }}>-</div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#d97706' }}>DUE TODAY</div>
          </div>
          <div style={{ flex: 1, background: '#FFFBEB', borderRadius: '16px', border: '1px solid #FDE68A', padding: '12px 4px', textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#d97706' }}>-</div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#b45309' }}>DUE TOMORROW</div>
          </div>
        </div>

        {/* Search Bar Placeholder */}
        <div style={{ height: '46px', width: '100%', backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', animation: 'pulse 1.2s infinite ease-in-out' }} />

        {/* Card Shell */}
        <div style={{ height: '100px', width: '100%', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', borderLeft: '5px solid #ef4444', animation: 'pulse 1.2s infinite ease-in-out' }} />
        <div style={{ height: '100px', width: '100%', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', borderLeft: '5px solid #3b82f6', animation: 'pulse 1.2s infinite ease-in-out' }} />
      </div>
    );
  }

  if (targetRoute.includes('/chat')) {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', minHeight: '65vh' }}>
        <div style={{ height: '48px', width: '100%', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', animation: 'pulse 1.2s infinite ease-in-out' }} />
        <div style={{ display: 'flex', gap: '12px', flex: 1, minHeight: '400px' }}>
          <div style={{ width: '280px', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', animation: 'pulse 1.2s infinite ease-in-out' }} />
          <div style={{ flex: 1, backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', animation: 'pulse 1.2s infinite ease-in-out' }} />
        </div>
      </div>
    );
  }

  if (targetRoute.includes('/complaints')) {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', minHeight: '65vh' }}>
        <div style={{ height: '48px', width: '100%', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', animation: 'pulse 1.2s infinite ease-in-out' }} />
        <div style={{ height: '100px', width: '100%', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', animation: 'pulse 1.2s infinite ease-in-out' }} />
        <div style={{ height: '100px', width: '100%', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', animation: 'pulse 1.2s infinite ease-in-out' }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', minHeight: '65vh' }}>
      <div style={{ height: '32px', width: '180px', backgroundColor: '#e2e8f0', borderRadius: '10px', animation: 'pulse 1.2s infinite ease-in-out' }} />
      <div style={{ height: '180px', width: '100%', backgroundColor: '#f1f5f9', borderRadius: '16px', border: '1px solid #e2e8f0', animation: 'pulse 1.2s infinite ease-in-out' }} />
      <div style={{ height: '140px', width: '100%', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', animation: 'pulse 1.2s infinite ease-in-out' }} />
    </div>
  );
}

function LayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const { properties, selectedProperty, switchHostel, refreshProperties, authStatus, currentUser, userProfile, refreshUserProfile } = useHostel();
  const [isMounted, setIsMounted] = useState(false);

  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [optimisticPathname, setOptimisticPathname] = useState<string>(pathname);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setOptimisticPathname(pathname);
    setIsMobileDrawerOpen(false);
    setAppState('lastOpenedPage', pathname);
    navTracer.mark('t11_pageCommitted', `Completed navigation to: ${pathname}`);
  }, [pathname]);

  const lastNavTimeRef = useRef<{ path: string; time: number }>({ path: '', time: 0 });

  const handleNavClick = useCallback((targetPath: string) => {
    const now = Date.now();
    if (lastNavTimeRef.current.path === targetPath && now - lastNavTimeRef.current.time < 250) {
      return;
    }
    lastNavTimeRef.current = { path: targetPath, time: now };

    setOptimisticPathname(targetPath);
    navTracer.startNavigation(targetPath);
    setIsMobileDrawerOpen(false);
    try {
      router.push(targetPath);
    } catch (e) {}
  }, [router]);

  // Non-blocking idle route prefetching for instant native zero-latency transitions
  useEffect(() => {
    const routesToPrefetch = [
      '/pgowner/dashboard',
      '/pgowner/tenants',
      '/pgowner/rooms',
      '/pgowner/dues',
      '/pgowner/history',
      '/pgowner/properties',
      '/pgowner/reports',
      '/pgowner/expenses',
      '/pgowner/food-menu',
      '/pgowner/notices',
      '/pgowner/chat',
      '/pgowner/complaints',
      '/pgowner/team',
      '/profile'
    ];
    routePrefetcher.prefetchIdle(router, routesToPrefetch);
  }, [router]);

  // Notification state
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: 'complaint' | 'payment';
    title: string;
    message: string;
    time: string;
    read: boolean;
    link: string;
    timestamp: number;
  }>>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [readNotifIds, setReadNotifIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const saved = localStorage.getItem('permanentlyReadNotifications');
    if (saved) {
      try {
        setReadNotifIds(new Set(JSON.parse(saved)));
      } catch (e) {}
    }
  }, []);

  // Request PWA Notification Permission & setup real-time mobile bar notifications
  useEffect(() => {
    if (!currentUser?.uid) return;

    requestNotificationPermission();

    const targetOwnerId = userProfile?.owner_id || currentUser.uid;

    let unsubComplaints: (() => void) | null = null;
    let unsubPayments: (() => void) | null = null;
    let unsubTenants: (() => void) | null = null;
    let unsubRooms: (() => void) | null = null;

    let latestComplaints: any[] = [];
    let latestPayments: any[] = [];
    let isInitialLoad = true;

    const combineNotifs = () => {
      const merged = [...latestComplaints, ...latestPayments];
      merged.sort((a, b) => b.timestamp - a.timestamp);
      setNotifications(merged);
    };

    try {
      // 1. Complaints & Messages Listener
      const cRef = collection(db, 'complaints');
      const cQuery = query(cRef, where('owner_id', '==', targetOwnerId), limit(10));
      unsubComplaints = onSnapshot(cQuery, (snap) => {
        latestComplaints = [];
        snap.forEach(doc => {
          const d = doc.data();
          const createdDate = d.created_at ? new Date(d.created_at) : new Date();
          const notifId = `comp_${doc.id}`;
          const title = `[${d.pg_name || 'Hostel'}] Tenant Complaint / Message`;
          const body = `${d.tenant_name || 'Tenant'} (${d.room_number || 'Room'}): "${d.description || d.category || 'Maintenance issue'}"`;

          latestComplaints.push({
            id: notifId,
            type: 'complaint',
            title,
            message: body,
            time: createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            link: '/pgowner/complaints',
            timestamp: createdDate.getTime()
          });

          // Trigger Mobile Notification Bar alert for new complaint/message
          if (!isInitialLoad) {
            triggerPWANotification(notifId, title, body, 'complaint', '/pgowner/complaints');
          }
        });
        combineNotifs();
      }, (err) => {
        if (err?.code !== 'permission-denied') console.warn('Complaints notif listener:', err?.code);
      });

      // 2. Fee Collected Listener
      const pRef = collection(db, 'payments');
      const pQuery = query(pRef, where('owner_id', '==', targetOwnerId), where('status', '==', 'paid'), limit(15));
      unsubPayments = onSnapshot(pQuery, (snap) => {
        latestPayments = [];
        snap.forEach(doc => {
          const d = doc.data();
          if (d.status !== 'paid' && d.status !== 'PAID') return;
          const paidDate = d.payment_date || d.created_at ? new Date(d.payment_date || d.created_at) : new Date();
          const notifId = `pay_${doc.id}`;
          const actorInfo = d.collected_by_name ? ` by ${d.collected_by_name}` : '';
          const title = `[${d.pg_name || 'Hostel'}] Fee Collected: ₹${(d.amount_paid || d.amount || 0).toLocaleString()}`;
          const body = `Payment received${actorInfo} from ${d.tenant_name || 'Tenant'} (${d.room_number ? 'Room ' + d.room_number : 'Rent'})`;

          latestPayments.push({
            id: notifId,
            type: 'payment',
            title,
            message: body,
            time: paidDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            link: '/pgowner/history',
            timestamp: paidDate.getTime()
          });

          // Trigger Mobile Notification Bar alert for fee collected
          if (!isInitialLoad) {
            triggerPWANotification(notifId, title, body, 'payment', '/pgowner/history');
          }
        });
        combineNotifs();
      }, (err) => {
        if (err?.code !== 'permission-denied') console.warn('Payments notif listener:', err?.code);
      });

      // 3. Tenants Added / Edited Listener
      const tRef = collection(db, 'tenants');
      const tQuery = query(tRef, where('owner_id', '==', targetOwnerId), limit(10));
      unsubTenants = onSnapshot(tQuery, (snap) => {
        snap.docChanges().forEach(change => {
          if (isInitialLoad) return;
          const d = change.doc.data();
          const notifId = `tenant_${change.doc.id}_${change.type}`;
          const actorInfo = d.added_by_name ? ` by ${d.added_by_name}` : d.updated_by_name ? ` by ${d.updated_by_name}` : '';
          
          if (change.type === 'added') {
            const title = `[${d.pg_name || 'Hostel'}] New Tenant Added`;
            const body = `${d.full_name || d.name || 'Tenant'} assigned to Room ${d.room_number || d.room || 'N/A'}${actorInfo}`;
            triggerPWANotification(notifId, title, body, 'tenant_add', '/pgowner/tenants');
          } else if (change.type === 'modified') {
            const title = `[${d.pg_name || 'Hostel'}] Tenant Profile Updated`;
            const body = `Details updated${actorInfo} for ${d.full_name || d.name || 'Tenant'} (Room ${d.room_number || d.room || 'N/A'})`;
            triggerPWANotification(notifId, title, body, 'tenant_edit', '/pgowner/tenants');
          }
        });
      }, (err) => {
        if (err?.code !== 'permission-denied') console.warn('Tenants notif listener:', err?.code);
      });

      // 4. Room Settings Added / Modified Listener
      const rRef = collection(db, 'rooms');
      const rQuery = query(rRef, where('owner_id', '==', targetOwnerId), limit(10));
      unsubRooms = onSnapshot(rQuery, (snap) => {
        snap.docChanges().forEach(change => {
          if (isInitialLoad) return;
          const d = change.doc.data();
          const notifId = `room_${change.doc.id}_${change.type}`;
          const roomNum = d.room_number || d.number || d.room || 'N/A';

          if (change.type === 'added') {
            const title = `[${d.pg_name || 'Hostel'}] New Room Added`;
            const body = `Room ${roomNum} (${d.sharing || 'Standard'} Sharing) added`;
            triggerPWANotification(notifId, title, body, 'room_add', '/pgowner/rooms');
          } else if (change.type === 'modified') {
            const title = `[${d.pg_name || 'Hostel'}] Room Settings Updated`;
            const body = `Settings updated for Room ${roomNum} (Rent: ₹${(d.rent_amount || d.rent || 0).toLocaleString()})`;
            triggerPWANotification(notifId, title, body, 'room_edit', '/pgowner/rooms');
          }
        });
      }, (err) => {
        if (err?.code !== 'permission-denied') console.warn('Rooms notif listener:', err?.code);
      });

      setTimeout(() => {
        isInitialLoad = false;
      }, 3000);

    } catch (e) {
      console.warn('Notifications listener setup error:', e);
    }

    return () => {
      if (unsubComplaints) unsubComplaints();
      if (unsubPayments) unsubPayments();
      if (unsubTenants) unsubTenants();
      if (unsubRooms) unsubRooms();
    };
  }, [currentUser, userProfile]);

  const unreadCount = notifications.filter(n => !readNotifIds.has(n.id)).length;

  const markAllRead = () => {
    const allIds = new Set(notifications.map(n => n.id));
    setReadNotifIds(prev => {
      const next = new Set([...Array.from(prev), ...Array.from(allIds)]);
      localStorage.setItem('permanentlyReadNotifications', JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const handleSendTestNotification = async () => {
    const granted = await requestNotificationPermission();
    if (!granted) {
      alert('Please allow notification permissions in your browser or phone settings to receive notifications on your device bar.');
      return;
    }

    const testId1 = `test_pay_${Date.now()}`;
    const testId2 = `test_comp_${Date.now()}`;

    // 1. Send Payment Test Push Alert
    await triggerPWANotification(
      testId1,
      `[Himalaya Stayin] Fee Collected: ₹5,000`,
      `Payment received from Rahul Sharma (Room 102)`,
      'payment',
      `${routePrefix}/history`
    );

    // 2. Send Complaint Test Push Alert
    setTimeout(async () => {
      await triggerPWANotification(
        testId2,
        `[Himalaya Stayin] Tenant Complaint / Message`,
        `Rahul Sharma (Room 102): "Tap leaking in bathroom"`,
        'complaint',
        `${routePrefix}/complaints`
      );
    }, 1500);

    // Also add to local notifications list
    setNotifications(prev => [
      {
        id: testId1,
        type: 'payment',
        title: '[Himalaya Stayin] Fee Collected: ₹5,000',
        message: 'Payment received from Rahul Sharma (Room 102)',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        link: `${routePrefix}/history`,
        timestamp: Date.now(),
        read: false
      },
      {
        id: testId2,
        type: 'complaint',
        title: '[Himalaya Stayin] Tenant Complaint / Message',
        message: 'Rahul Sharma (Room 102): "Tap leaking in bathroom"',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        link: `${routePrefix}/complaints`,
        timestamp: Date.now() - 1000,
        read: false
      },
      ...prev
    ]);
  };

  const markNotificationRead = (id: string) => {
    setReadNotifIds(prev => {
      const next = new Set(prev).add(id);
      localStorage.setItem('permanentlyReadNotifications', JSON.stringify(Array.from(next)));
      return next;
    });
  };

  useEffect(() => {
    let unbindDeviceDoc: (() => void) | null = null;
    let unbindProfile: (() => void) | null = null;

    if (authStatus === 'READY' && currentUser) {
      localStorage.setItem('userUid', currentUser.uid);
      
      // Background device registration
      let deviceId = localStorage.getItem('deviceId');
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const deviceName = isMobile ? 'Mobile App' : 'Web Browser';

      if (!deviceId) {
        deviceId = Math.random().toString(36).substring(2, 15);
        localStorage.setItem('deviceId', deviceId);
      }
      rpcCall('registerDevice', currentUser.uid, deviceId, deviceName).catch(console.error);

      // Real-time Firestore session listener on THIS device
      const deviceRef = doc(db, 'users', currentUser.uid, 'devices', deviceId);
      unbindDeviceDoc = onSnapshot(
        deviceRef, 
        (snapshot) => {
          if (!snapshot.exists()) {
            console.warn('Session revoked from another device');
            clearUserCache();
            localStorage.clear();
            sessionStorage.clear();
            auth.signOut().then(() => {
              window.location.href = '/';
            });
          }
        },
        (error) => {
          // Suppress expected security rule fallback gracefully
          if (error?.code !== 'permission-denied') {
            console.warn('Device session status:', error?.code);
          }
        }
      );

      // For team members: first auto-provision (syncs permissions to user_profiles), then fetch profile
      const provisionKey = `provisioned_${currentUser.uid}`;
      if (typeof window !== 'undefined' && !sessionStorage.getItem(provisionKey)) {
        sessionStorage.setItem(provisionKey, 'true');
        if (localStorage.getItem('userRole') === 'team_member') {
          const fetchStaffProfile = () => {
            rpcCall('getUserProfile', currentUser.uid, currentUser.email || '').then((res: any) => {
              if (res?.success && res?.data) {
                console.log('[STAFF PROFILE LOADED]', JSON.stringify(res.data?.permissions || 'NO PERMISSIONS'), 'role:', res.data?.role);
                refreshUserProfile();
              } else {
                console.warn('[STAFF PROFILE FAILED]', res);
              }
            }).catch((err: any) => { console.error('[STAFF PROFILE ERROR]', err); });
          };

          // Auto-provision first (syncs team_members permissions → user_profiles), then fetch
          if (currentUser.email) {
            rpcCall('autoProvisionTeamMember', currentUser.email, currentUser.uid).then((res) => {
              if (res?.member?.permissions) {
                refreshUserProfile();
              }
              if (res?.success || res?.uid) {
                refreshProperties();
              }
              // Fetch profile AFTER provision completes (ensures latest permissions)
              fetchStaffProfile();
            }).catch(() => {
              // Still fetch profile even if provision fails
              fetchStaffProfile();
            });
          } else {
            fetchStaffProfile();
          }
        } else if (currentUser.email) {
          // Non-staff: just auto-provision (no profile fetch needed)
          rpcCall('autoProvisionTeamMember', currentUser.email, currentUser.uid).then((res) => {
            if (res?.success || res?.uid) {
              refreshProperties();
            }
          }).catch(() => {});
        }
      }
    } else if (authStatus === 'UNAUTHENTICATED') {
      const hasLocalSession = typeof window !== 'undefined' && (!!localStorage.getItem('userUid') || localStorage.getItem('isLoggedIn') === 'true');
      const isExplicitLoggedOut = typeof window !== 'undefined' && sessionStorage.getItem('loggedOut') === 'true';
      if (!hasLocalSession || isExplicitLoggedOut) {
        localStorage.removeItem('userUid');
        router.replace('/login');
      }
    }

    return () => {
      const cbDevice = unbindDeviceDoc as any;
      const cbProf = unbindProfile as any;
      if (typeof cbDevice === 'function') cbDevice();
      if (typeof cbProf === 'function') cbProf();
    };
  }, [authStatus, currentUser, router]);

  const handleLogout = async () => {
    clearUserCache();
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userUid');
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem('loggedOut', 'true');
    try {
      await auth.signOut();
    } catch (e) {
      console.error(e);
    }
    window.location.href = '/';
  };

  const handlePropertySwitch = (pgId: string) => {
    setIsDropdownOpen(false);
    setIsMobileDrawerOpen(false);
    switchHostel(pgId);
  };

const WhatsAppIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
  </svg>
);

  const { isStaff, userProfile: ctxProfile, permissions, assignedProperties, hasPermission, hasAnyPermission, hasPropertyAccess, selectedPgId } = usePermissions();
  const profile = ctxProfile || userProfile;
  const routePrefix = isStaff ? '/teammember' : '/pgowner';

  // Filter properties based on staff assigned hostels
  const visibleProperties = useMemo(() => {
    if (!properties || properties.length === 0) return [];
    if (!isStaff || !assignedProperties || assignedProperties.length === 0) return properties;
    return properties.filter((p: any) => hasPropertyAccess(p.pg_id || p.id));
  }, [properties, isStaff, assignedProperties, hasPropertyAccess]);

  const mainMenuItems = useMemo(() => [
    { path: `${routePrefix}/properties`, label: 'Properties', icon: Building, key: 'properties' },
    { path: `${routePrefix}/whatsapp`, label: 'WhatsApp Suite', icon: WhatsAppIcon, key: 'whatsapp' },
    { path: `${routePrefix}/reports`, label: 'Reports', icon: TrendingUp, key: 'reports' },
    { path: `${routePrefix}/expenses`, label: 'Expenses', icon: Banknote, key: 'expenses' },
    { path: `${routePrefix}/food-menu`, label: 'Food Menu', icon: Pizza, key: 'food-menu' },
    { path: `${routePrefix}/notices`, label: 'Notifications', icon: Bell, key: 'notices' },
    { path: `${routePrefix}/chat`, label: 'Messages & Chat Box', icon: MessageSquare, key: 'chat' },
    { path: `${routePrefix}/complaints`, label: 'Complaints & Issues', icon: LifeBuoy, key: 'complaints' },
    { path: `${routePrefix}/privacy`, label: 'Privacy & Data Requests', icon: ShieldAlert, key: 'privacy' },
    { path: `${routePrefix}/team`, label: 'Team Members', icon: Users, key: 'team' },
    { path: `${routePrefix}/documents`, label: 'Documents', icon: Folder, key: 'documents' },
    { path: `${routePrefix}/profile`, label: 'My Profile', icon: User, key: 'profile' },
  ].filter(item => {
    if (isStaff) {
      if (item.key === 'properties') return false; // Properties management is exclusively for PG Owners!
      if (item.key === 'profile') return true;
      
      if (item.key === 'team' && !hasPermission(PERMISSIONS.MANAGE_MEMBERS) && !hasPermission(PERMISSIONS.VIEW_MEMBERS)) return false;
      if (item.key === 'documents' && !hasPermission(PERMISSIONS.VIEW_MEMBERS)) return false;
      if (item.key === 'reports' && !hasPermission(PERMISSIONS.VIEW_REPORTS)) return false;
      if (item.key === 'expenses' && !hasPermission(PERMISSIONS.ADD_EXPENSE) && !hasPermission(PERMISSIONS.DELETE_EXPENSE) && !hasPermission(PERMISSIONS.VIEW_REPORTS)) return false;
      if (item.key === 'food-menu' && !hasPermission(PERMISSIONS.EDIT_MENU)) return false;
      if (item.key === 'notices' && !hasPermission(PERMISSIONS.CREATE_NOTICES)) return false;
      if (item.key === 'whatsapp' && !hasPermission(PERMISSIONS.SEND_WHATSAPP)) return false;
      if (item.key === 'chat' && !hasPermission(PERMISSIONS.RESOLVE_COMPLAINTS)) return false;
      if (item.key === 'complaints' && !hasPermission(PERMISSIONS.RESOLVE_COMPLAINTS)) return false;
    }
    return true;
  }), [routePrefix, isStaff, hasPermission, selectedPgId, permissions]);

  const activePageInfo = useMemo(() => {
    const currentPath = optimisticPathname || pathname;
    
    // Check main menu items first
    const matchedMenu = mainMenuItems.find(item => item.path !== '#' && item.path.length > 2 && currentPath.includes(item.path));
    if (matchedMenu) {
      return { title: matchedMenu.label, Icon: matchedMenu.icon };
    }

    // Check sub-routes / sub-tabs
    if (currentPath.includes('/dashboard') || currentPath === '/pgowner' || currentPath === '/teammember') {
      return { title: 'Dashboard', Icon: LayoutDashboard };
    }
    if (currentPath.includes('/tenants')) {
      return { title: 'Tenants', Icon: Users };
    }
    if (currentPath.includes('/rooms')) {
      return { title: 'Rooms', Icon: DoorOpen };
    }
    if (currentPath.includes('/dues')) {
      return { title: 'Dues', Icon: Banknote };
    }
    if (currentPath.includes('/history')) {
      return { title: 'Payment History', Icon: History };
    }

    return { title: 'Dashboard', Icon: LayoutDashboard };
  }, [optimisticPathname, pathname, mainMenuItems]);

  useEffect(() => {
    if (currentUser?.email) {
      console.log('=== [RBAC SIDEBAR DIAGNOSTIC] ===');
      console.log('Logged User:', currentUser.email);
      console.log('isStaff:', isStaff);
      console.log('Permissions Object:', permissions);
      console.log('Visible Sidebar Items:', mainMenuItems.map(i => i.label));
    }
  }, [currentUser, isStaff, permissions, mainMenuItems]);

  const renderSidebarContent = () => (
    <>
      <div className={`${drawerStyles.drawerHeader} ${styles.hideOnDesktop}`}>
        <div className={drawerStyles.drawerHeaderTop}>
          <h3 className={drawerStyles.drawerHeaderTitle}>PROPERTIES</h3>
          {/* Close button only on mobile */}
          <button 
            className={`${drawerStyles.drawerCloseBtn} mobile-only-close`} 
            onPointerDown={() => setIsMobileDrawerOpen(false)}
            onTouchStart={() => setIsMobileDrawerOpen(false)}
            onClick={() => setIsMobileDrawerOpen(false)}
          >
            <X size={16} />
          </button>
        </div>
        <div className={drawerStyles.drawerHostelInfo}>
          <div className={drawerStyles.drawerHostelIcon}>
            <Building size={28} color="#0d7990" />
          </div>
          <div className={drawerStyles.drawerHostelDetails}>
            <h2 className={drawerStyles.drawerHostelName}>
              {isMounted ? (properties.length > 0 && selectedProperty ? selectedProperty.name : 'No Hostels Found') : 'No Hostels Found'}
            </h2>
            <div className={drawerStyles.drawerActiveDot}>
              <div className={drawerStyles.activeDotIndicator} style={{ backgroundColor: properties.length > 0 ? '#10B981' : '#94A3B8' }} /> {properties.length > 0 ? 'Active' : 'No Active Hostel'}
            </div>
            <div className={drawerStyles.whatsappPill} style={{background: 'transparent', padding: 0, color: '#94A3B8', fontSize: '0.65rem'}}>
              POWERED BY RALIVEN INNOVATIONS
            </div>
          </div>
        </div>
      </div>

      <div className={drawerStyles.drawerBody}>
        {/* Switch Hostel Section */}
        <div className={`${drawerStyles.drawerSection} ${styles.hideOnDesktop}`}>
          <h4 className={drawerStyles.drawerSectionTitle}>SWITCH HOSTEL</h4>
          
          <div style={{position: 'relative'}}>
            <button 
              className={drawerStyles.switchHostelCard}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              style={{ width: '100%', border: 'none', background: '#F8FAFC', cursor: 'pointer' }}
            >
              <div className={drawerStyles.switchHostelLeft}>
                <div className={drawerStyles.switchHostelIcon}>
                  <Building size={16} color={properties.length > 0 ? '#10B981' : '#94A3B8'} />
                </div>
                <span className={drawerStyles.switchHostelText}>
                  {isMounted ? (properties.length > 0 && selectedProperty ? selectedProperty.name : 'No Hostels Available') : 'No Hostels Available'}
                </span>
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
                  {visibleProperties.filter(p => (p.pg_id || p.id) !== (selectedProperty?.pg_id || selectedProperty?.id)).map(p => (
                    <div 
                      key={p.pg_id || p.id}
                      onClick={() => handlePropertySwitch(p.pg_id || p.id)}
                      style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#334155' }}
                    >
                      <Building size={14} color="#64748B" />
                      {p.name}
                    </div>
                  ))}
                  {visibleProperties.filter(p => (p.pg_id || p.id) !== (selectedProperty?.pg_id || selectedProperty?.id)).length === 0 && (
                    <div style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#94A3B8', textAlign: 'center' }}>No other hostels found</div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Main Menu Section */}
        <div className={drawerStyles.drawerSection}>
          <h4 className={drawerStyles.drawerSectionTitle}>MAIN MENU</h4>
          {mainMenuItems.map((item, index) => {
            const currentPath = optimisticPathname || pathname;
            const isMatch = currentPath === item.path || currentPath.startsWith(item.path + '/');
            
            return (
              <Link 
                key={item.path}
                href={item.path} 
                prefetch={true}
                onMouseEnter={() => routePrefetcher.prefetchSingle(router, item.path)}
                onTouchStart={() => routePrefetcher.prefetchSingle(router, item.path)}
                onPointerDown={() => handleNavClick(item.path)}
                className={drawerStyles.drawerMenuItem}
                style={{ 
                  textDecoration: 'none',
                  background: isMatch ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  marginBottom: '4px'
                }}
                onClick={() => handleNavClick(item.path)}
              >
                <div className={drawerStyles.drawerMenuItemLeft}>
                  <div 
                    className={`${drawerStyles.drawerMenuIcon} ${drawerStyles.iconDoc}`}
                    style={{ 
                      background: isMatch ? '#4F46E5' : '#F0F5FF', 
                      color: isMatch ? '#FFFFFF' : '#1E3A8A' 
                    }}
                  >
                    <item.icon size={18} />
                  </div>
                  <span 
                    className={drawerStyles.drawerMenuItemText}
                    style={{ color: isMatch ? '#4F46E5' : '#0F172A', fontWeight: isMatch ? 800 : 600 }}
                  >
                    {item.label}
                  </span>
                </div>
                {isMatch ? (
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4F46E5', boxShadow: '0 0 8px rgba(79, 70, 229, 0.5)' }} />
                ) : (
                  <ChevronRight size={16} color="#CBD5E1" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
      
      <div className={drawerStyles.drawerFooter} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {currentUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 8px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--brand-blue), var(--brand-purple))', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px' }}>
              {userProfile?.full_name ? userProfile.full_name.charAt(0).toUpperCase() : currentUser.email ? currentUser.email.charAt(0).toUpperCase() : 'O'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {userProfile?.full_name || currentUser.email?.split('@')[0] || 'User'}
              </span>
              <span style={{ fontSize: '11px', color: '#818CF8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {(userProfile?.role === 'team_member' || (isMounted && localStorage.getItem('userRole') === 'team_member')) ? (userProfile?.staff_role || 'Team Member') : 'PG Owner'}
              </span>
              {currentUser.email && (
                <span style={{ fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {currentUser.email}
                </span>
              )}
            </div>
          </div>
        )}
        <button className={drawerStyles.drawerLogoutBtn} onClick={handleLogout} style={{ width: '100%' }}>
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
  let pageTitle = "Dashboard";
  if (pathname.includes('/tenants')) pageTitle = "Tenants";
  else if (pathname.includes('/rooms')) pageTitle = "Rooms";
  else if (pathname.includes('/history')) pageTitle = "History";
  else if (pathname.includes('/dues')) pageTitle = "Dues";
  else if (pathname.includes('/reports')) pageTitle = "Reports";
  else if (pathname.includes('/food-menu')) pageTitle = "Food Menu";
  else if (pathname.includes('/notices')) pageTitle = "Notifications";
  else if (pathname.includes('/expenses')) pageTitle = "Expenses";
  else if (pathname.includes('/complaints')) pageTitle = "Complaints";
  else if (pathname.includes('/whatsapp')) pageTitle = "WhatsApp Suite";
  else if (pathname.includes('/chat')) pageTitle = "Messages & Chat";
  else if (pathname.includes('/team')) pageTitle = "Team Members";
  else if (pathname.includes('/profile')) pageTitle = "My Profile";
  else if (pathname === '/pgowner/properties' || pathname.includes('/properties')) pageTitle = "Properties";

  // Check if current route is allowed for this team member
  // CRITICAL: Don't block until permissions are actually loaded from Firestore
  const permissionsReady = !isStaff || !!ctxProfile?.permissions || (isMounted && !!localStorage.getItem('cachedUserPermissions'));

  const isPageAllowed = (() => {
    if (!isStaff) return true;

    // While permissions are still loading, allow all pages (don't flash Access Denied)
    if (!permissionsReady) return true;

    // Always allow Profile & Dashboard pages
    if (pathname.includes('/profile') || pathname.includes('/dashboard') || pathname === '/pgowner' || pathname === '/teammember') {
      return true;
    }
    
    // Properties management is exclusively for PG Owners
    if (pathname.includes('/properties')) return false;

    if (pathname.split('/').includes('tenants') && !hasAnyPermission(PERMISSIONS.VIEW_TENANTS, PERMISSIONS.MANAGE_TENANTS, PERMISSIONS.ADD_TENANT, PERMISSIONS.EDIT_TENANT)) return false;
    if (pathname.split('/').includes('rooms') && !hasAnyPermission(PERMISSIONS.VIEW_ROOMS, PERMISSIONS.MANAGE_ROOMS)) return false;
    if (pathname.split('/').includes('dues') && !hasAnyPermission(PERMISSIONS.GENERATE_DUES, PERMISSIONS.COLLECT_PAYMENTS)) return false;
    if (pathname.split('/').includes('history') && !hasAnyPermission(PERMISSIONS.VIEW_HISTORY, PERMISSIONS.PRINT_RECEIPTS)) return false;
    if (pathname.split('/').includes('reports') && !hasAnyPermission(PERMISSIONS.VIEW_REPORTS, PERMISSIONS.EXPORT_REPORTS)) return false;
    if (pathname.split('/').includes('expenses') && !hasAnyPermission(PERMISSIONS.ADD_EXPENSE, PERMISSIONS.DELETE_EXPENSE)) return false;
    if (pathname.split('/').includes('food-menu') && !hasPermission(PERMISSIONS.EDIT_MENU)) return false;
    if (pathname.split('/').includes('notices') && !hasAnyPermission(PERMISSIONS.CREATE_NOTICES, PERMISSIONS.DELETE_NOTICES)) return false;
    if (pathname.split('/').includes('whatsapp') && !hasAnyPermission(PERMISSIONS.SEND_WHATSAPP, PERMISSIONS.APPROVE_TEMPLATES)) return false;
    if (pathname.split('/').includes('team') && !hasAnyPermission(PERMISSIONS.MANAGE_MEMBERS, PERMISSIONS.VIEW_MEMBERS)) return false;
    if (pathname.split('/').includes('complaints') && !hasPermission(PERMISSIONS.RESOLVE_COMPLAINTS)) return false;

    return true;
  })();

  // NOTE: We deliberately do NOT redirect to /unauthorized.
  // Redirecting outside /pgowner loses HostelContext state and causes session corruption.
  // Instead, we show an inline "Access Restricted" block (see contentWrapper below).

  // 1. Unauthenticated Check
  const hasLocalSession = isMounted ? (!!localStorage.getItem('userUid') || localStorage.getItem('isLoggedIn') === 'true') : true;
  const isExplicitLoggedOut = isMounted ? sessionStorage.getItem('loggedOut') === 'true' : false;

  if (isMounted && (!hasLocalSession || isExplicitLoggedOut)) {
    if (authStatus === 'UNAUTHENTICATED' || (authStatus === 'READY' && !currentUser)) {
      return <AccessDeniedCard reason="unauthenticated" title="Authentication Required" subtitle="Please sign in to access the PG Owner Portal." />;
    }
  }

  // 2. Role Check (Tenant trying to access PG Owner portal)
  const cachedRole = isMounted ? localStorage.getItem('userRole') : null;
  const effectiveRole = ctxProfile?.role || cachedRole;

  if (isMounted && effectiveRole === 'tenant') {
    return <AccessDeniedCard reason="unauthorized_role" currentRole="tenant" requiredRole="pg_owner" title="403 - Access Denied" subtitle="You are currently signed in as a Tenant. You do not have permission to access the PG Owner Portal." />;
  }

  // 3. Disabled Account Check
  if (isMounted && ctxProfile && (ctxProfile.is_active === false || ctxProfile.status === 'disabled' || ctxProfile.status === 'INACTIVE')) {
    return <AccessDeniedCard reason="account_disabled" title="Account Suspended" subtitle="Your account or hostel subscription has been disabled by the administrator." />;
  }

  // 4. Booting / Restore Auth Check (when typing URL directly with no cached credentials)
  const hasUserUid = isMounted ? (!!localStorage.getItem('userUid') || localStorage.getItem('isLoggedIn') === 'true') : true;
  if (isMounted && (authStatus === 'BOOTING' || authStatus === 'RESTORE_AUTH') && !currentUser && !hasUserUid) {
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
          src={selectedProperty?.logoUrl || (typeof window !== 'undefined' ? localStorage.getItem('cachedLogoUrl') : null) || '/himalaya_logo.png'}
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
          <Loader2 size={24} color="#818CF8" style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#CBD5E1' }}>Verifying Portal Access...</span>
        </div>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className={styles.appBackground || 'appBackground'} suppressHydrationWarning>
      <div className={styles.pgownerLayout || 'pgownerLayout'} suppressHydrationWarning>
        {/* World-Class Glassmorphic Desktop Header */}
        <header className={styles.desktopTopHeader} suppressHydrationWarning>
          <div className={styles.desktopHeaderTopRow} style={{ position: 'relative' }}>
            <div className={styles.desktopHeaderLeft}>
              <div className={styles.hostelAppIcon}>
                 <Building size={20} color="#ffffff" />
              </div>
              <div className={styles.desktopHeaderTitleBox} style={{ position: 'relative' }}>
                <div 
                  className={styles.desktopHeaderHostelSelector}
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#6366F1', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Active Property</span>
                    <h1 className={styles.desktopHeaderTitle}>
                      {isMounted ? (selectedProperty ? selectedProperty.name : 'Select Hostel') : 'Select Hostel'}
                    </h1>
                  </div>
                  <ChevronDown size={16} color="#64748B" style={{ transition: 'transform 0.2s', transform: isDropdownOpen ? 'rotate(180deg)' : 'none' }} />
                </div>
                
                <AnimatePresence>
                  {isDropdownOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      style={{
                        position: 'absolute', top: 'calc(100% + 8px)', left: 0, 
                        background: '#FFFFFF', borderRadius: '16px', 
                        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.18), 0 4px 16px rgba(0,0,0,0.06)', zIndex: 1000,
                        minWidth: '260px', maxHeight: '320px', overflowY: 'auto',
                        border: '1px solid #e2e8f0', padding: '8px'
                      }}
                    >
                      {properties.map(p => {
                        const isSelected = selectedProperty?.pg_id === p.pg_id;
                        return (
                          <div 
                            key={p.pg_id}
                            onClick={() => {
                              handlePropertySwitch(p.pg_id);
                              setIsDropdownOpen(false);
                            }}
                            style={{
                              padding: '10px 14px',
                              borderRadius: '10px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px',
                              fontSize: '0.88rem',
                              color: isSelected ? '#4F46E5' : '#334155',
                              fontWeight: isSelected ? 700 : 500,
                              background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ background: isSelected ? '#4F46E5' : '#F1F5F9', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Building size={16} color={isSelected ? '#FFFFFF' : '#64748B'} />
                              </div>
                              <span>{p.name}</span>
                            </div>
                            {isSelected && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981' }} />}
                          </div>
                        );
                      })}
                      {properties.length === 0 && (
                        <div style={{ padding: '14px', fontSize: '0.85rem', color: '#94A3B8', textAlign: 'center' }}>No hostels found</div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Selected Active Navigation Page Title Badge (Red Box Location) */}
            <div className={styles.desktopHeaderCenter}>
              <div className={styles.activePageBadge}>
                {activePageInfo.Icon && <activePageInfo.Icon size={17} className={styles.activePageIcon} />}
                <span className={styles.activePageTitleText}>{activePageInfo.title}</span>
              </div>
            </div>

            <div className={styles.desktopHeaderRight}>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setIsNotifOpen(!isNotifOpen)}
                  style={{
                    position: 'relative',
                    background: '#f1f5f9',
                    border: 'none',
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                  title="Notifications"
                >
                  <Bell size={19} color="#334155" />
                  {isMounted && unreadCount > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: '-2px',
                      right: '-2px',
                      background: '#ef4444',
                      color: '#ffffff',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      height: '18px',
                      minWidth: '18px',
                      padding: '0 4px',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid #ffffff'
                    }}>
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Notification Popover Dropdown */}
                <AnimatePresence>
                  {isNotifOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: '12px',
                        width: '360px',
                        maxHeight: '420px',
                        background: '#ffffff',
                        borderRadius: '20px',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.06)',
                        border: '1px solid #e2e8f0',
                        zIndex: 1000,
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Bell size={16} color="#4338ca" />
                          <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>Notifications</h4>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            onClick={handleSendTestNotification}
                            style={{ background: '#4F46E5', border: 'none', color: '#ffffff', fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 6px rgba(79,70,229,0.3)' }}
                          >
                            <Bell size={12} /> Test Push Alert
                          </button>
                          {notifications.length > 0 && (
                            <button
                              onClick={markAllRead}
                              style={{ background: 'transparent', border: 'none', color: '#4338ca', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <CheckCheck size={14} /> Read all
                            </button>
                          )}
                        </div>
                      </div>

                      <div style={{ overflowY: 'auto', flex: 1, padding: '6px' }}>
                        {notifications.length === 0 ? (
                          <div style={{ padding: '30px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                            <Bell size={28} color="#cbd5e1" style={{ margin: '0 auto 8px auto' }} />
                            No new notifications
                          </div>
                        ) : (
                          notifications.map(n => {
                            const isRead = readNotifIds.has(n.id);
                            return (
                              <div
                                key={n.id}
                                onClick={() => {
                                  markNotificationRead(n.id);
                                  setIsNotifOpen(false);
                                  router.push(n.link);
                                }}
                                style={{
                                  padding: '12px',
                                  borderRadius: '12px',
                                  marginBottom: '4px',
                                  background: isRead ? '#ffffff' : '#f0f9ff',
                                  border: isRead ? '1px solid #f1f5f9' : '1px solid #bae6fd',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                  <div style={{
                                    background: n.type === 'complaint' ? '#fee2e2' : '#dcfce7',
                                    color: n.type === 'complaint' ? '#ef4444' : '#166534',
                                    padding: '6px',
                                    borderRadius: '8px',
                                    marginTop: '2px'
                                  }}>
                                    {n.type === 'complaint' ? <ShieldAlert size={14} /> : <Banknote size={14} />}
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: '2px' }}>
                                      {n.title}
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.4 }}>
                                      {n.message}
                                    </div>
                                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '4px' }}>
                                      {n.time}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className={styles.desktopHeaderBottomRow}>
            <div className={styles.desktopNavTabs}>
              {(() => {
                const currentPath = optimisticPathname || pathname;
                return (
                  <>
                    {(!isMounted || hasPermission(PERMISSIONS.VIEW_DASHBOARD)) && (
                      <Link 
                        prefetch={true} 
                        href={`${routePrefix}/dashboard`} 
                        onMouseEnter={() => routePrefetcher.prefetchSingle(router, `${routePrefix}/dashboard`)}
                        onTouchStart={() => routePrefetcher.prefetchSingle(router, `${routePrefix}/dashboard`)}
                        onPointerDown={() => handleNavClick(`${routePrefix}/dashboard`)}
                        onClick={() => handleNavClick(`${routePrefix}/dashboard`)}
                        className={`${styles.desktopTab} ${currentPath.includes('/dashboard') || currentPath === '/pgowner' || currentPath === '/teammember' ? styles.activeTab : ''}`}
                      >
                        Dashboard
                      </Link>
                    )}
                    {(!isMounted || hasAnyPermission(PERMISSIONS.VIEW_TENANTS, PERMISSIONS.MANAGE_TENANTS)) && (
                      <Link 
                        prefetch={true} 
                        href={`${routePrefix}/tenants`} 
                        onMouseEnter={() => routePrefetcher.prefetchSingle(router, `${routePrefix}/tenants`)}
                        onTouchStart={() => routePrefetcher.prefetchSingle(router, `${routePrefix}/tenants`)}
                        onPointerDown={() => handleNavClick(`${routePrefix}/tenants`)}
                        onClick={() => handleNavClick(`${routePrefix}/tenants`)}
                        className={`${styles.desktopTab} ${currentPath.includes('/tenants') ? styles.activeTab : ''}`}
                      >
                        Tenants
                      </Link>
                    )}
                    {(!isMounted || hasAnyPermission(PERMISSIONS.VIEW_ROOMS, PERMISSIONS.MANAGE_ROOMS)) && (
                      <Link 
                        prefetch={true} 
                        href={`${routePrefix}/rooms`} 
                        onMouseEnter={() => routePrefetcher.prefetchSingle(router, `${routePrefix}/rooms`)}
                        onTouchStart={() => routePrefetcher.prefetchSingle(router, `${routePrefix}/rooms`)}
                        onPointerDown={() => handleNavClick(`${routePrefix}/rooms`)}
                        onClick={() => handleNavClick(`${routePrefix}/rooms`)}
                        className={`${styles.desktopTab} ${currentPath.includes('/rooms') ? styles.activeTab : ''}`}
                      >
                        Rooms
                      </Link>
                    )}
                    {(!isMounted || hasAnyPermission(PERMISSIONS.GENERATE_DUES, PERMISSIONS.COLLECT_PAYMENTS)) && (
                      <Link 
                        prefetch={true} 
                        href={`${routePrefix}/dues`} 
                        onMouseEnter={() => routePrefetcher.prefetchSingle(router, `${routePrefix}/dues`)}
                        onTouchStart={() => routePrefetcher.prefetchSingle(router, `${routePrefix}/dues`)}
                        onPointerDown={() => handleNavClick(`${routePrefix}/dues`)}
                        onClick={() => handleNavClick(`${routePrefix}/dues`)}
                        className={`${styles.desktopTab} ${currentPath.includes('/dues') ? styles.activeTab : ''}`}
                      >
                        Dues
                      </Link>
                    )}
                    {(!isMounted || hasAnyPermission(PERMISSIONS.VIEW_HISTORY, PERMISSIONS.PRINT_RECEIPTS)) && (
                      <Link 
                        prefetch={true} 
                        href={`${routePrefix}/history`} 
                        onMouseEnter={() => routePrefetcher.prefetchSingle(router, `${routePrefix}/history`)}
                        onTouchStart={() => routePrefetcher.prefetchSingle(router, `${routePrefix}/history`)}
                        onPointerDown={() => handleNavClick(`${routePrefix}/history`)}
                        onClick={() => handleNavClick(`${routePrefix}/history`)}
                        className={`${styles.desktopTab} ${currentPath.includes('/history') ? styles.activeTab : ''}`}
                      >
                        History
                      </Link>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </header>

        <div className={styles.layoutBody}>
          {/* Desktop Sidebar (fixed position, zero movement on page navigation) */}
          <aside 
            className={`${styles.sidebar} glass`}
            style={{ padding: 0 }}
          >
            {renderSidebarContent()}
          </aside>

          <div className={styles.contentColumn} suppressHydrationWarning>
            <main className={`${styles.mainContent} ${pathname.includes('/chat') ? styles.chatMainContent : ''}`} suppressHydrationWarning>
          {/* Mobile Top Wave Header */}
          <header className={styles.mobileWaveHeader} suppressHydrationWarning>
            <div className={styles.mobileWaveHeaderTop} suppressHydrationWarning>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Menu 
                  size={22} 
                  style={{ cursor: 'pointer', color: '#ffffff', touchAction: 'manipulation' }} 
                  onPointerDown={() => setIsMobileDrawerOpen(true)}
                  onTouchStart={() => setIsMobileDrawerOpen(true)}
                  onClick={() => setIsMobileDrawerOpen(true)} 
                />
                {isMounted && notifications.some(n => n.type === 'complaint' && !readNotifIds.has(n.id)) && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: [1, 1.25, 1], opacity: [0.85, 1, 0.85] }}
                    transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, rgba(251, 191, 36, 1) 0%, rgba(245, 158, 11, 0.6) 70%, transparent 100%)',
                      boxShadow: '0 0 12px #FBBF24, 0 0 20px rgba(251, 191, 36, 0.8)',
                      cursor: 'pointer',
                      marginLeft: '2px'
                    }}
                    onClick={() => router.push(`${routePrefix}/complaints`)}
                    title="Unread Tenant Complaints / Messages"
                  >
                    <Lightbulb size={14} color="#ffffff" style={{ filter: 'drop-shadow(0 0 4px #ffffff)' }} />
                  </motion.div>
                )}
              </div>
              <div className={styles.mobileHeaderTitleContainer} suppressHydrationWarning>
                <h1 className={styles.mobileHeaderTitle} suppressHydrationWarning>{pageTitle}</h1>
                {isMounted && properties.length > 0 && selectedProperty?.name ? (
                  <span className={styles.mobileHeaderSubtitle}>
                    {selectedProperty.name} {userProfile?.role === 'team_member' ? '• TEAM MEMBER' : ''}
                  </span>
                ) : isMounted && properties.length === 0 ? (
                  <span className={styles.mobileHeaderSubtitle}>
                    NO HOSTELS ADDED
                  </span>
                ) : null}
              </div>
              <div className={styles.bellIconContainer} style={{ position: 'relative' }}>
                <Bell size={20} style={{ cursor: 'pointer', color: '#ffffff' }} onClick={() => setIsNotifOpen(!isNotifOpen)} />
                {isMounted && unreadCount > 0 && <div className={styles.notificationDot}></div>}

                {/* Popover Window (Top 3 Notifications) */}
                <AnimatePresence>
                  {isNotifOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      style={{
                        position: 'absolute',
                        top: '36px',
                        right: '-8px',
                        width: '320px',
                        background: '#ffffff',
                        borderRadius: '16px',
                        boxShadow: '0 15px 40px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05)',
                        border: '1px solid #e2e8f0',
                        overflow: 'hidden',
                        zIndex: 9999,
                        color: '#0f172a',
                        textTransform: 'none'
                      }}
                    >
                      {/* Popover Header */}
                      <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Bell size={16} color="#4F46E5" />
                          <span style={{ fontWeight: 800, fontSize: '0.88rem' }}>Recent Notifications</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            onClick={handleSendTestNotification}
                            style={{ background: '#4F46E5', border: 'none', color: '#ffffff', fontSize: '0.68rem', fontWeight: 700, padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                          >
                            <Bell size={10} /> Test Push
                          </button>
                          {unreadCount > 0 && (
                            <span style={{ background: '#ef4444', color: 'white', fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '10px' }}>
                              {unreadCount} New
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 3 Notifications List */}
                      <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                        {notifications.length === 0 ? (
                          <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                            No new notifications right now.
                          </div>
                        ) : (
                          notifications.slice(0, 3).map((n) => {
                            const isRead = readNotifIds.has(n.id);
                            return (
                              <div
                                key={n.id}
                                onClick={() => {
                                  markNotificationRead(n.id);
                                  setIsNotifOpen(false);
                                  router.push(n.link || `${routePrefix}/notices`);
                                }}
                                style={{
                                  padding: '10px 14px',
                                  borderBottom: '1px solid #f1f5f9',
                                  cursor: 'pointer',
                                  background: isRead ? '#ffffff' : '#f0f9ff',
                                  transition: 'background 0.15s ease',
                                  display: 'flex',
                                  gap: '10px',
                                  alignItems: 'flex-start'
                                }}
                              >
                                {!isRead && (
                                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0284c7', marginTop: '6px', flexShrink: 0 }} />
                                )}
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isRead ? '#1e293b' : '#0369a1', marginBottom: '2px' }}>
                                    {n.title}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: '#64748b', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.3' }}>
                                    {n.message}
                                  </div>
                                  <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '4px' }}>
                                    {n.time}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Popover Footer Link to Full Page */}
                      <div 
                        onClick={() => {
                          setIsNotifOpen(false);
                          router.push(`${routePrefix}/notices`);
                        }}
                        style={{
                          padding: '10px 14px',
                          background: '#EEF2FF',
                          color: '#4F46E5',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          textAlign: 'center',
                          cursor: 'pointer',
                          borderTop: '1px solid #e0e7ff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <span>View All Notifications</span>
                        <ArrowRight size={14} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            
            <div className={styles.waveContainer}>
            <svg viewBox="0 0 500 75" preserveAspectRatio="none" className={styles.waveSvg}>
              <defs>
                {/* Header Base Gradient */}
                <linearGradient id="mobileHeaderGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#7C3AED" />
                  <stop offset="100%" stopColor="#A855F7" />
                </linearGradient>

                {/* Liquid Glass Band Gradient - Directly Absorbs and Refracts Header Gradient Colors */}
                <linearGradient id="liquidGlassBandGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#7C3AED" />
                  <stop offset="50%" stopColor="#A855F7" />
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

        {renderMobileDrawer()}

        <div className={`${styles.contentWrapper} ${pathname.includes('/chat') ? styles.chatContentWrapper : ''}`}>
          {!isPageAllowed ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '65vh', padding: '24px', textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#FEF2F2', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', border: '1px solid #FCA5A5' }}>
                <ShieldAlert size={32} />
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>Access Restricted</h2>
              <p style={{ fontSize: '0.88rem', color: '#64748B', maxWidth: '360px', margin: '0 auto 20px auto' }}>
                You do not have permission to view this module. Please contact your PG Owner to grant access.
              </p>
              <button onClick={() => router.push(`${routePrefix}/dashboard`)} style={{ padding: '10px 20px', borderRadius: '12px', background: '#4F46E5', color: '#FFFFFF', border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                Back to Dashboard
              </button>
            </div>
          ) : (
            <React.Suspense fallback={<OptimisticRouteSkeleton targetRoute={optimisticPathname || pathname} />}>
              {children}
            </React.Suspense>
          )}
        </div>
            </main>
          </div>
        </div>

      {/* Mobile Bottom Navigation */}
      <nav className={styles.mobileBottomNav}>
        <div className={styles.mobileBottomNavInner} style={{ paddingBottom: 'env(safe-area-inset-bottom)', position: 'relative' }}>
          {(() => {
            const currentPath = optimisticPathname || pathname;
            const navItems = [
              { href: `${routePrefix}/dashboard`, label: "Dashboard", icon: Home, matchKey: '/dashboard', show: !isMounted || (hasPermission ? hasPermission(PERMISSIONS.VIEW_DASHBOARD) : true) },
              { href: `${routePrefix}/tenants`, label: "Tenants", icon: Users, matchKey: '/tenants', show: !isMounted || (hasAnyPermission ? hasAnyPermission(PERMISSIONS.VIEW_TENANTS, PERMISSIONS.MANAGE_TENANTS) : true) },
              { href: `${routePrefix}/rooms`, label: "Rooms", icon: Building, matchKey: '/rooms', show: !isMounted || (hasAnyPermission ? hasAnyPermission(PERMISSIONS.VIEW_ROOMS, PERMISSIONS.MANAGE_ROOMS) : true) },
              { href: `${routePrefix}/dues`, label: "Dues", icon: ClipboardList, matchKey: '/dues', show: !isMounted || (hasAnyPermission ? hasAnyPermission(PERMISSIONS.GENERATE_DUES, PERMISSIONS.COLLECT_PAYMENTS) : true) },
              { href: `${routePrefix}/history`, label: "History", icon: History, matchKey: '/history', show: !isMounted || (hasAnyPermission ? hasAnyPermission(PERMISSIONS.VIEW_HISTORY, PERMISSIONS.PRINT_RECEIPTS) : true) },
            ].filter(item => item.show);

            const activeIndex = Math.max(0, navItems.findIndex(item =>
              currentPath.includes(item.matchKey) || (item.matchKey === '/dashboard' && (currentPath.includes('/properties') || currentPath === '/pgowner' || currentPath === '/teammember'))
            ));

            return (
              <>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isMatch = currentPath.includes(item.matchKey) || (item.matchKey === '/dashboard' && (currentPath.includes('/properties') || currentPath === '/pgowner' || currentPath === '/teammember'));
                  
                  return (
                    <Link 
                      key={item.href}
                      prefetch={true} 
                      href={item.href}
                      onMouseEnter={() => routePrefetcher.prefetchSingle(router, item.href)}
                      onTouchStart={() => routePrefetcher.prefetchSingle(router, item.href)}
                      onClick={() => handleNavClick(item.href)}
                      className={`${styles.bottomNavItem} ${isMatch ? styles.active : ''}`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={22} />
                      </div>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}

                {/* Persistent Sliding Indicator */}
                {navItems.length > 0 && (
                  <div 
                    style={{
                      position: 'absolute',
                      bottom: '4px',
                      left: '12px',
                      width: `calc((100% - 24px) / ${navItems.length})`,
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
              </>
            );
          })()}
        </div>
      </nav>
      </div>
    </div>
  );
}

export default function PGOwnerLayout({ children }: { children: React.ReactNode }) {
  return <LayoutInner>{children}</LayoutInner>;
}

