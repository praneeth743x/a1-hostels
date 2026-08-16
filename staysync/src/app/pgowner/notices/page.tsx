"use client";

import { toast } from 'react-hot-toast';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCheck, Sparkles, Filter, ChevronDown, CheckCircle2, Clock, Calendar, Banknote, ShieldAlert, MessageSquare, Send, Loader2 } from 'lucide-react';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { addNotice } from '@/app/actions/pgowner';
import { SkeletonListCards } from '@/components/SkeletonLoader';

export default function NotificationsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'due' | 'payment' | 'complaint' | 'chat'>('all');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [loading, setLoading] = useState(true);

  // States for different types of notifications
  const [dueNotifs, setDueNotifs] = useState<any[]>([]);
  const [paymentNotifs, setPaymentNotifs] = useState<any[]>([]);
  const [complaintNotifs, setComplaintNotifs] = useState<any[]>([]);
  const [chatNotifs, setChatNotifs] = useState<any[]>([]);
  
  const [readNotifIds, setReadNotifIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const saved = localStorage.getItem('permanentlyReadNotifications');
    if (saved) {
      try {
        setReadNotifIds(new Set(JSON.parse(saved)));
      } catch (e) {}
    }
  }, []);

  const markAllAsRead = () => {
    const allIds = new Set(allNotifications.map(n => n.id));
    setReadNotifIds(prev => {
      const next = new Set([...Array.from(prev), ...Array.from(allIds)]);
      localStorage.setItem('permanentlyReadNotifications', JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const handleNotificationClick = (notif: any) => {
    setReadNotifIds(prev => {
      const next = new Set(prev).add(notif.id);
      localStorage.setItem('permanentlyReadNotifications', JSON.stringify(Array.from(next)));
      return next;
    });
    if (notif.link) {
      router.push(notif.link);
    }
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        router.push('/');
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    
    // Dynamically import firestore functions to avoid client issues
    import('firebase/firestore').then(({ collection, query, where, onSnapshot }) => {
      
      // 1. Complaints Listener
      const cRef = collection(db, 'complaints');
      const cQuery = query(cRef, where('owner_id', '==', currentUser.uid));
      const unsubComplaints = onSnapshot(cQuery, (snap) => {
        const arr: any[] = [];
        snap.forEach(doc => {
          const d = doc.data();
          const createdDate = d.created_at ? new Date(d.created_at) : new Date();
          arr.push({
            id: `comp_${doc.id}`,
            type: 'complaint',
            title: `[${d.pg_name || 'Hostel'}] Tenant Complaint: ${d.category || 'Issue'}`,
            message: `${d.tenant_name || 'Tenant'} (${d.room_number || 'Room'}) raised: "${d.description || 'Maintenance issue'}"`,
            time: createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            link: '/pgowner/complaints',
            timestamp: createdDate.getTime(),
            tenantName: d.tenant_name,
            roomNumber: d.room_number,
          });
        });
        setComplaintNotifs(arr);
        setLoading(false);
      }, (err) => {
        if (err?.code !== 'permission-denied') console.warn('Complaints notif listener:', err?.code);
        setLoading(false);
      });

      // 2. Payments Listener (Paid vs Pending Dues)
      const pRef = collection(db, 'payments');
      const pQuery = query(pRef, where('owner_id', '==', currentUser.uid));
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
              title: `[${d.pg_name || 'Hostel'}] Fee Collected: ₹${(d.amount_paid || d.amount || 0).toLocaleString()}`,
              message: `Payment received from ${d.tenant_name || 'Tenant'}`,
              time: paidDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              link: '/pgowner/history',
              timestamp: paidDate.getTime(),
              tenantName: d.tenant_name,
              roomNumber: d.room_number,
            });
          } else if (d.status === 'pending') {
            const dueDate = d.due_date ? new Date(d.due_date) : new Date();
            dueArr.push({
              id: `due_${doc.id}`,
              type: 'due',
              title: `[${d.pg_name || 'Hostel'}] Pending Dues: ₹${(d.amount || 0).toLocaleString()}`,
              message: `Payment pending from ${d.tenant_name || 'Tenant'}`,
              time: dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              link: '/pgowner/dues',
              timestamp: dueDate.getTime(),
              tenantName: d.tenant_name,
              roomNumber: d.room_number,
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

      // 3. Chat Listener
      const chatRef = collection(db, 'owner_messages');
      const chatQuery = query(chatRef, where('ownerId', '==', currentUser.uid));
      const unsubChat = onSnapshot(chatQuery, (snap) => {
        const arr: any[] = [];
        snap.forEach(doc => {
          const d = doc.data();
          if (d.sender !== currentUser.uid) { // Messages from tenants
            const createdDate = d.timestamp ? new Date(d.timestamp) : new Date();
            arr.push({
              id: `chat_${doc.id}`,
              type: 'chat',
              title: `[${d.pgName || 'Hostel'}] Message from ${d.senderName || 'Tenant'}`,
              message: `"${d.message}"`,
              time: createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              link: '/pgowner/chat',
              timestamp: createdDate.getTime(),
              tenantName: d.senderName,
              roomNumber: d.roomNumber || 'Unassigned',
            });
          }
        });
        setChatNotifs(arr);
        setLoading(false);
      }, (err) => {
        if (err?.code !== 'permission-denied') console.warn('Chat notif listener:', err?.code);
        setLoading(false);
      });

      return () => {
        unsubComplaints();
        unsubPayments();
        unsubChat();
      };
    });
  }, [currentUser?.uid]);

  const allNotifications = [...dueNotifs, ...paymentNotifs, ...complaintNotifs, ...chatNotifs]
    .map(n => ({ ...n, read: readNotifIds.has(n.id) }))
    .sort((a, b) => b.timestamp - a.timestamp);

  const unreadCount = allNotifications.filter(n => !n.read).length;

  const filteredNotifications = allNotifications.filter(n => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unread') return !n.read;
    return n.type === activeTab;
  });

  const handleBroadcastSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeMessage.trim() || !currentUser?.uid) return;
    
    setIsBroadcasting(true);
    try {
      await addNotice(currentUser.uid, noticeMessage.trim());
      setNoticeMessage('');
      setShowBroadcastModal(false);
      toast.success('Announcement broadcasted to all tenants successfully!');
    } catch (err: any) {
      toast.error('Error broadcasting announcement: ' + err.message);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'due': return <Calendar size={16} color="#D97706" />;
      case 'payment': return <Banknote size={16} color="#166534" />;
      case 'complaint': return <ShieldAlert size={16} color="#DC2626" />;
      case 'chat': return <MessageSquare size={16} color="#2563EB" />;
      default: return <Bell size={16} color="#4F46E5" />;
    }
  };

  const getTypeBadgeStyle = (type: string) => {
    switch (type) {
      case 'due': return { background: '#FEF3C7', color: '#B45309' };
      case 'payment': return { background: '#DCFCE7', color: '#166534' };
      case 'complaint': return { background: '#FEE2E2', color: '#991B1B' };
      case 'chat': return { background: '#EFF6FF', color: '#1D4ED8' };
      default: return { background: '#EEF2FF', color: '#4338CA' };
    }
  };

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

            <button
              onClick={() => setShowBroadcastModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '7px 12px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                border: 'none',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.75rem',
                cursor: 'pointer',
                boxShadow: '0 3px 10px rgba(79, 70, 229, 0.25)'
              }}
            >
              <Sparkles size={14} /> Notice
            </button>
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
            <span style={{ color: '#B45309' }}>Dues (1-Day): </span>
            <strong style={{ color: '#D97706', fontWeight: 800 }}>{dueNotifs.length}</strong>
          </div>
          <div style={{ background: '#DCFCE7', padding: '6px 10px', borderRadius: '8px', fontSize: '0.75rem', border: '1px solid #BBF7D0', flexShrink: 0 }}>
            <span style={{ color: '#166534' }}>Payments: </span>
            <strong style={{ color: '#15803D', fontWeight: 800 }}>{paymentNotifs.length}</strong>
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
              activeTab === 'due' ? '1-Day Dues' :
              activeTab === 'payment' ? 'Payments' :
              activeTab === 'complaint' ? 'Complaints' : 'Chat'
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
                { id: 'due', label: '1-Day Dues', count: dueNotifs.length },
                { id: 'payment', label: 'Payments Collected', count: paymentNotifs.length },
                { id: 'complaint', label: 'Complaints', count: complaintNotifs.length },
                { id: 'chat', label: 'Chat Messages', count: chatNotifs.length }
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
      {loading && allNotifications.length === 0 ? (
        <SkeletonListCards count={4} />
      ) : filteredNotifications.length === 0 ? (
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
                    {notif.tenantName && (
                      <span>Tenant: <strong>{notif.tenantName}</strong></span>
                    )}
                    {notif.roomNumber && (
                      <span>Room: <strong>{notif.roomNumber}</strong></span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── BROADCAST NOTICE MODAL ── */}
      <AnimatePresence>
        {showBroadcastModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{ background: '#ffffff', width: '100%', maxWidth: '480px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 25px 50px rgba(0,0,0,0.2)', padding: '20px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <div style={{ background: '#EEF2FF', padding: '8px', borderRadius: '10px', color: '#4F46E5' }}>
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>Broadcast Announcement</h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Post a notice to all tenant mobile apps</span>
                </div>
              </div>

              <form onSubmit={handleBroadcastSubmit}>
                <textarea
                  rows={4}
                  value={noticeMessage}
                  onChange={e => setNoticeMessage(e.target.value)}
                  placeholder="e.g. Water tank maintenance scheduled for tomorrow between 10 AM to 1 PM. Please store water accordingly."
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    marginBottom: '16px'
                  }}
                />

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowBroadcastModal(false)}
                    style={{ padding: '8px 14px', borderRadius: '10px', background: '#F1F5F9', border: 'none', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', color: '#475569' }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isBroadcasting || !noticeMessage.trim()}
                    style={{ padding: '8px 16px', borderRadius: '10px', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', color: 'white', border: 'none', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {isBroadcasting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {isBroadcasting ? 'Broadcasting...' : 'Broadcast Notice'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
