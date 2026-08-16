"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCheck, Filter, ChevronDown, CheckCircle2, Clock, Calendar, Banknote, ShieldAlert, MessageSquare } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getTenantDashboardData } from '@/app/actions/tenant';
import { SkeletonListCards } from '@/components/SkeletonLoader';

export default function TenantNotificationsPage() {
  const router = useRouter();
  const [tenantInfo, setTenantInfo] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'due' | 'payment' | 'complaint' | 'chat'>('all');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // States for different types of notifications
  const [dueNotifs, setDueNotifs] = useState<any[]>([]);
  const [paymentNotifs, setPaymentNotifs] = useState<any[]>([]);
  const [complaintNotifs, setComplaintNotifs] = useState<any[]>([]);
  const [chatNotifs, setChatNotifs] = useState<any[]>([]);
  const [generalNotices, setGeneralNotices] = useState<any[]>([]);
  
  const [readNotifIds, setReadNotifIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const saved = localStorage.getItem('permanentlyReadTenantNotifs');
    if (saved) {
      try {
        setReadNotifIds(new Set(JSON.parse(saved)));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        const res = await getTenantDashboardData(user.email);
        if (res.success && res.data?.tenant) {
          setTenantInfo(res.data.tenant);
        }
      } else {
        router.push('/');
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    if (!tenantInfo?.id && !tenantInfo?.tenant_id) return;
    
    const tId = tenantInfo.id || tenantInfo.tenant_id;
    const ownerId = tenantInfo.owner_id;
    
    // 1. Complaints Listener
    const cRef = collection(db, 'complaints');
    const cQuery = query(cRef, where('tenant_id', '==', tId));
    const unsubComplaints = onSnapshot(cQuery, (snap) => {
      const arr: any[] = [];
      snap.forEach(doc => {
        const d = doc.data();
        const updatedDate = d.updated_at || d.created_at ? new Date(d.updated_at || d.created_at) : new Date();
        if (d.status === 'resolved' || d.status === 'in-progress') {
          arr.push({
            id: `comp_${doc.id}_${d.status}`, // unique ID for status change
            type: 'complaint',
            title: `Complaint ${d.status === 'resolved' ? 'Resolved' : 'Update'}`,
            message: `Your complaint regarding "${d.category}" is now ${d.status}.`,
            time: updatedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            link: '/tenant/complaints',
            timestamp: updatedDate.getTime(),
          });
        }
      });
      setComplaintNotifs(arr);
      setLoading(false);
    }, (err) => {
      if (err?.code !== 'permission-denied') console.warn('Complaints notif listener:', err?.code);
      setLoading(false);
    });

    // 2. Payments Listener (Paid vs Pending Dues)
    const pRef = collection(db, 'payments');
    const pQuery = query(pRef, where('tenant_id', '==', tId));
    const unsubPayments = onSnapshot(pQuery, (snap) => {
      const payArr: any[] = [];
      const dueArr: any[] = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (d.status === 'paid' || d.status === 'PAID') {
          const paidDate = d.payment_date || d.created_at ? new Date(d.payment_date || d.created_at) : new Date();
          payArr.push({
            id: `pay_${doc.id}`,
            type: 'payment',
            title: `Payment Successful`,
            message: `Your payment of ₹${(d.amount_paid || d.amount || 0).toLocaleString()} was received.`,
            time: paidDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            link: '/tenant?tab=Billing',
            timestamp: paidDate.getTime(),
          });
        } else if (d.status === 'pending') {
          const dueDate = d.due_date ? new Date(d.due_date) : new Date();
          dueArr.push({
            id: `due_${doc.id}`,
            type: 'due',
            title: `Pending Due: ₹${(d.amount || 0).toLocaleString()}`,
            message: `You have a pending payment for ${d.month || 'this month'}.`,
            time: dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            link: '/tenant?tab=Billing',
            timestamp: dueDate.getTime(),
          });
        }
      });
      setPaymentNotifs(payArr);
      setDueNotifs(dueArr);
      setLoading(false);
    }, (err) => {
      if (err?.code !== 'permission-denied') console.warn('Payments notif listener:', err?.code);
      setLoading(false);
    });

    // 3. Chat Listener (Messages from owner)
    const chatRef = collection(db, 'owner_messages');
    const chatQuery = query(chatRef, where('tenantId', '==', tId));
    const unsubChat = onSnapshot(chatQuery, (snap) => {
      const arr: any[] = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (d.sender !== tId && d.sender !== tenantInfo.email) { 
          const createdDate = d.timestamp ? new Date(d.timestamp) : new Date();
          arr.push({
            id: `chat_${doc.id}`,
            type: 'chat',
            title: `Message from Admin`,
            message: `"${d.message}"`,
            time: createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            link: '/tenant?tab=Messages',
            timestamp: createdDate.getTime(),
          });
        }
      });
      setChatNotifs(arr);
      setLoading(false);
    }, (err) => {
      if (err?.code !== 'permission-denied') console.warn('Chat notif listener:', err?.code);
      setLoading(false);
    });

    // 4. Notices Broadcast by owner
    let unsubNotices = () => {};
    if (ownerId) {
      const noticeRef = collection(db, 'notices');
      const noticeQuery = query(noticeRef, where('owner_id', '==', ownerId));
      unsubNotices = onSnapshot(noticeQuery, (snap) => {
        const arr: any[] = [];
        snap.forEach(doc => {
          const d = doc.data();
          const createdDate = d.created_at ? new Date(d.created_at) : new Date();
          arr.push({
            id: `notice_${doc.id}`,
            type: 'notice', // handled by chat icon or bell
            title: `Hostel Announcement`,
            message: d.message,
            time: createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            link: '/tenant',
            timestamp: createdDate.getTime(),
          });
        });
        setGeneralNotices(arr);
        setLoading(false);
      }, (err) => {
        if (err?.code !== 'permission-denied') console.warn('Notices notif listener:', err?.code);
        setLoading(false);
      });
    }

    return () => {
      unsubComplaints();
      unsubPayments();
      unsubChat();
      unsubNotices();
    };
  }, [tenantInfo]);

  const allNotifications = [...dueNotifs, ...paymentNotifs, ...complaintNotifs, ...chatNotifs, ...generalNotices]
    .map(n => ({ ...n, read: readNotifIds.has(n.id) }))
    .sort((a, b) => b.timestamp - a.timestamp);

  const unreadCount = allNotifications.filter(n => !n.read).length;

  const filteredNotifications = allNotifications.filter(n => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unread') return !n.read;
    if (activeTab === 'chat' && n.type === 'notice') return true; // Group notices under chat filter for tenant
    return n.type === activeTab;
  });

  const markAllAsRead = () => {
    const allIds = new Set(allNotifications.map(n => n.id));
    setReadNotifIds(prev => {
      const next = new Set([...Array.from(prev), ...Array.from(allIds)]);
      localStorage.setItem('permanentlyReadTenantNotifs', JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const handleNotificationClick = (notif: any) => {
    setReadNotifIds(prev => {
      const next = new Set(prev).add(notif.id);
      localStorage.setItem('permanentlyReadTenantNotifs', JSON.stringify(Array.from(next)));
      return next;
    });
    if (notif.link) {
      router.push(notif.link);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'due': return <Calendar size={16} color="#D97706" />;
      case 'payment': return <Banknote size={16} color="#166534" />;
      case 'complaint': return <ShieldAlert size={16} color="#DC2626" />;
      case 'chat': 
      case 'notice': return <MessageSquare size={16} color="#2563EB" />;
      default: return <Bell size={16} color="#4F46E5" />;
    }
  };

  const getTypeBadgeStyle = (type: string) => {
    switch (type) {
      case 'due': return { background: '#FEF3C7', color: '#B45309' };
      case 'payment': return { background: '#DCFCE7', color: '#166534' };
      case 'complaint': return { background: '#FEE2E2', color: '#991B1B' };
      case 'chat': 
      case 'notice': return { background: '#EFF6FF', color: '#1D4ED8' };
      default: return { background: '#EEF2FF', color: '#4338CA' };
    }
  };

  if (loading && allNotifications.length === 0) {
    return <div style={{ padding: '20px' }}><SkeletonListCards count={4} /></div>;
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 4px 32px 4px' }}>
      
      {/* ── MOBILE-OPTIMIZED HEADER BAR ── */}
      <div style={{ background: '#ffffff', borderRadius: '16px', padding: '14px 16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              Notifications
              {unreadCount > 0 && (
                <span style={{ background: '#EF4444', color: '#ffffff', fontSize: '0.68rem', fontWeight: 800, padding: '2px 7px', borderRadius: '10px' }}>
                  {unreadCount}
                </span>
              )}
            </h2>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '7px 10px',
                  borderRadius: '10px',
                  background: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  color: '#334155',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                <CheckCheck size={14} color="#2563eb" /> Read All
              </button>
            )}
          </div>
        </div>

        {/* COMPACT MOBILE STATS ROW */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none', paddingTop: '8px', borderTop: '1px solid #F1F5F9' }}>
          <div style={{ background: '#F8FAFC', padding: '6px 10px', borderRadius: '8px', fontSize: '0.75rem', border: '1px solid #E2E8F0', flexShrink: 0 }}>
            <span style={{ color: '#64748B' }}>Total: </span>
            <strong style={{ color: '#0F172A', fontWeight: 800 }}>{allNotifications.length}</strong>
          </div>
          <div style={{ background: unreadCount > 0 ? '#FEF2F2' : '#F8FAFC', padding: '6px 10px', borderRadius: '8px', fontSize: '0.75rem', border: `1px solid ${unreadCount > 0 ? '#FCA5A5' : '#E2E8F0'}`, flexShrink: 0 }}>
            <span style={{ color: unreadCount > 0 ? '#991B1B' : '#64748B' }}>Unread: </span>
            <strong style={{ color: unreadCount > 0 ? '#EF4444' : '#0F172A', fontWeight: 800 }}>{unreadCount}</strong>
          </div>
          <div style={{ background: '#FEF3C7', padding: '6px 10px', borderRadius: '8px', fontSize: '0.75rem', border: '1px solid #FDE68A', flexShrink: 0 }}>
            <span style={{ color: '#B45309' }}>Pending: </span>
            <strong style={{ color: '#D97706', fontWeight: 800 }}>{dueNotifs.length}</strong>
          </div>
          <div style={{ background: '#EFF6FF', padding: '6px 10px', borderRadius: '8px', fontSize: '0.75rem', border: '1px solid #BFDBFE', flexShrink: 0 }}>
            <span style={{ color: '#1D4ED8' }}>Messages: </span>
            <strong style={{ color: '#1E40AF', fontWeight: 800 }}>{chatNotifs.length + generalNotices.length}</strong>
          </div>
        </div>
      </div>

      {/* ── SINGLE FILTER BUTTON WITH DROPDOWN ── */}
      <div style={{ position: 'relative', marginBottom: '12px', display: 'flex', justifyContent: 'flex-start' }}>
        <button
          onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '12px',
            background: '#ffffff',
            border: '1px solid #CBD5E1',
            color: '#1E293B',
            fontWeight: 700,
            fontSize: '0.82rem',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
            transition: 'all 0.15s ease'
          }}
        >
          <Filter size={15} color="#4F46E5" />
          <span>
            Filter: {
              activeTab === 'all' ? 'All Notifications' :
              activeTab === 'unread' ? 'Unread Only' :
              activeTab === 'due' ? 'Pending Dues' :
              activeTab === 'payment' ? 'Payments' :
              activeTab === 'complaint' ? 'Complaints' : 'Messages'
            } ({filteredNotifications.length})
          </span>
          <ChevronDown size={15} color="#64748B" style={{ transform: isFilterDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
        </button>

        {/* DROPDOWN MENU */}
        <AnimatePresence>
          {isFilterDropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'absolute',
                top: '42px',
                left: 0,
                width: '230px',
                background: '#ffffff',
                borderRadius: '14px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
                padding: '6px',
                zIndex: 100
              }}
            >
              {[
                { id: 'all', label: 'All Notifications', count: allNotifications.length },
                { id: 'unread', label: 'Unread Only', count: unreadCount },
                { id: 'due', label: 'Pending Dues', count: dueNotifs.length },
                { id: 'payment', label: 'Payments', count: paymentNotifs.length },
                { id: 'complaint', label: 'Complaints', count: complaintNotifs.length },
                { id: 'chat', label: 'Messages', count: chatNotifs.length + generalNotices.length }
              ].map((item) => {
                const isSelected = activeTab === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as any);
                      setIsFilterDropdownOpen(false);
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: isSelected ? 800 : 600,
                      background: isSelected ? '#EEF2FF' : 'transparent',
                      color: isSelected ? '#4F46E5' : '#334155',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>{item.label}</span>
                    <span style={{
                      background: isSelected ? '#4F46E5' : '#F1F5F9',
                      color: isSelected ? '#ffffff' : '#64748B',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: '8px'
                    }}>
                      {item.count}
                    </span>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── NOTIFICATIONS FEED (MOBILE COMPACT CARDS) ── */}
      {filteredNotifications.length === 0 ? (
        <div style={{ background: '#ffffff', borderRadius: '16px', padding: '40px 16px', textAlign: 'center', border: '1px solid #E2E8F0' }}>
          <CheckCircle2 size={40} color="#10B981" style={{ margin: '0 auto 12px auto', opacity: 0.7 }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>No Notifications</h3>
          <p style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '4px' }}>
            There are no {activeTab !== 'all' ? activeTab : ''} notifications at this time.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <AnimatePresence>
            {filteredNotifications.map((notif) => (
              <motion.div
                key={notif.id}
                layout
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                onClick={() => handleNotificationClick(notif)}
                style={{
                  background: notif.read ? '#ffffff' : '#F0F9FF',
                  borderRadius: '14px',
                  padding: '12px 14px',
                  border: notif.read ? '1px solid #E2E8F0' : '1.5px solid #38BDF8',
                  boxShadow: notif.read ? '0 1px 4px rgba(0,0,0,0.02)' : '0 3px 12px rgba(56, 189, 248, 0.15)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  position: 'relative'
                }}
              >
                {/* UNREAD BLUE DOT */}
                {!notif.read && (
                  <div style={{ position: 'absolute', top: '14px', left: '6px', width: '6px', height: '6px', borderRadius: '50%', background: '#0284C7', boxShadow: '0 0 6px #0284C7' }} />
                )}

                {/* TYPE ICON */}
                <div style={{ 
                  width: '36px', 
                  height: '36px', 
                  borderRadius: '10px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  flexShrink: 0,
                  ...getTypeBadgeStyle(notif.type)
                }}>
                  {getTypeIcon(notif.type)}
                </div>

                {/* NOTIFICATION CONTENT */}
                <div style={{ flex: 1, minWidth: 0, paddingLeft: notif.read ? '0px' : '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <h4 style={{ fontSize: '0.86rem', fontWeight: 800, color: notif.read ? '#1E293B' : '#0369A1', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {notif.title}
                    </h4>

                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: '12px',
                      flexShrink: 0,
                      background: notif.read ? '#F1F5F9' : '#0284C7',
                      color: notif.read ? '#64748B' : '#ffffff'
                    }}>
                      {notif.read ? 'Read' : 'Unread'}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.78rem', color: '#475569', margin: '2px 0 4px 0', lineHeight: '1.35', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {notif.message}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.7rem', color: '#94A3B8', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <Clock size={11} /> {notif.time}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
