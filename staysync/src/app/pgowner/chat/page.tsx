"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { Loader2, Building, MessageSquare, Send, Search, ChevronDown, ArrowLeft } from 'lucide-react';
import { AvatarImage } from '@/components/AvatarImage';
import { useHostel } from '@/context/HostelContext';
import { rpcCall } from '@/lib/rpc';
import { SkeletonChatPage } from '@/components/SkeletonLoader';
function formatWhatsAppDateHeader(timestampString?: string): string {
  if (!timestampString) return 'TODAY';
  const msgDate = new Date(timestampString);
  if (isNaN(msgDate.getTime())) return 'TODAY';
  
  const now = new Date();
  const msgDay = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate()).getTime();
  const todayDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayDay = todayDay - 86400000;

  if (msgDay === todayDay) return 'TODAY';
  if (msgDay === yesterdayDay) return 'YESTERDAY';

  const diffDays = Math.round((todayDay - msgDay) / 86400000);
  if (diffDays < 7 && diffDays > 1) {
    return msgDate.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  }

  return msgDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
}

function PGOwnerChatContent() {
  const searchParams = useSearchParams();
  const complaintIdParam = searchParams?.get('complaintId');
  const tenantIdParam = searchParams?.get('tenantId');
  const initialMsgParam = searchParams?.get('initialMessage');

  const { properties, selectedProperty, switchHostel } = useHostel();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [allTenants, setAllTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  // Chat state
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(tenantIdParam || null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(complaintIdParam || null);
  const [sendWhatsAppAlso, setSendWhatsAppAlso] = useState(true);
  const [ownerReplyInput, setOwnerReplyInput] = useState(initialMsgParam || '');
  const [sendingOwnerReply, setSendingOwnerReply] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Unread read-timestamps by tenant ID with localStorage persistence
  const [readState, setReadState] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('staysync_chat_read_timestamps');
        return saved ? JSON.parse(saved) : {};
      } catch (e) {}
    }
    return {};
  });

  const markTenantAsRead = React.useCallback((tenantId: string) => {
    if (!tenantId) return;
    const futureTimestamp = Date.now() + 86400000; // 24h future timestamp ensures all past messages are permanently marked as read
    setReadState(prev => {
      const next = { ...prev, [tenantId]: futureTimestamp };
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('staysync_chat_read_timestamps', JSON.stringify(next));
        }
      } catch (e) {}
      return next;
    });
  }, []);

  // Mobile navigation state
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>((complaintIdParam || tenantIdParam) ? 'chat' : 'list');

  // Property filter
  const [isPropertyDropdownOpen, setIsPropertyDropdownOpen] = useState(false);
  const [localPropertyFilter, setLocalPropertyFilter] = useState<string>('all');

  useEffect(() => {
    if (tenantIdParam) setSelectedTenantId(tenantIdParam);
    if (complaintIdParam) setSelectedThreadId(complaintIdParam);
    if (initialMsgParam) setOwnerReplyInput(initialMsgParam);
    if (complaintIdParam || tenantIdParam) setMobileView('chat');
  }, [tenantIdParam, complaintIdParam, initialMsgParam]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Real-time authentication and Firestore onSnapshot listener for instant updates
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let unsubFirestore: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setLoading(true);
        const fetchAll = async () => {
          if (!properties || properties.length === 0) {
            setComplaints([]);
            setAllTenants([]);
            return;
          }
          const activePgIds = new Set(properties.map((p: any) => p.pg_id || p.id));
          const pgId = localPropertyFilter;
          const [cRes, tRes] = await Promise.all([
            rpcCall('getOwnerComplaints', user.uid, pgId),
            rpcCall('getAllTenantsForOwner', user.uid, pgId)
          ]);
          if (cRes?.success) {
            const valid = (cRes.data || []).filter((c: any) => {
              if (!c) return false;
              const s = String(c.status || '').toUpperCase();
              return s !== 'DELETED' && c.is_active !== false && activePgIds.has(c.pg_id);
            });
            setComplaints(valid);
          }
          if (tRes?.success) {
            const valid = (tRes.data || []).filter((t: any) => {
              if (!t) return false;
              const s = String(t.status || '').toUpperCase();
              return s !== 'DELETED' && t.is_active !== false && activePgIds.has(t.pg_id);
            });
            setAllTenants(valid);
          }
        };
        
        await fetchAll();
        setLoading(false);

        // Instant Realtime Firestore Listener on complaints collection
        try {
          const complaintsQuery = query(
            collection(db, 'complaints'),
            where('owner_id', '==', user.uid),
            limit(200)
          );
          unsubFirestore = onSnapshot(complaintsQuery, (snapshot) => {
            if (!properties || properties.length === 0) {
              setComplaints([]);
              return;
            }
            const activePgIds = new Set(properties.map((p: any) => p.pg_id || p.id));
            const liveComplaints: any[] = [];
            snapshot.forEach(doc => {
              const d = doc.data();
              const s = String(d.status || '').toUpperCase();
              if (s !== 'DELETED' && d.is_active !== false && activePgIds.has(d.pg_id)) {
                liveComplaints.push({ id: doc.id, ...d });
              }
            });
            setComplaints(liveComplaints);
          }, (err) => {
            if (err?.code !== 'permission-denied') {
              console.warn("Firestore real-time listener status:", err?.code);
            }
          });
        } catch (err) {
          console.warn("Could not attach real-time listener:", err);
        }
        
        intervalId = setInterval(fetchAll, 3000);
      } else {
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubFirestore) unsubFirestore();
      if (intervalId) clearInterval(intervalId);
    };
  }, [localPropertyFilter]);

  // Mark tenant messages as read when owner selects contact or receives messages
  useEffect(() => {
    if (selectedTenantId) {
      markTenantAsRead(selectedTenantId);
    }
  }, [selectedTenantId, complaints, markTenantAsRead]);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when chat messages update or active contact changes
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedTenantId, complaints]);

  const handleStatusUpdate = async (complaintId: string, newStatus: string) => {
    setIsUpdating(complaintId);
    try {
      const res = await rpcCall('updateComplaintStatus', complaintId, newStatus);
      if (res?.success) {
        setComplaints(prev => prev.map(c => c.id === complaintId ? { ...c, status: newStatus } : c));
      }
    } catch (error) {
      console.error("Failed to update status", error);
    } finally {
      setIsUpdating(null);
    }
  };

  // Build unified contacts list for WhatsApp Messenger
  const tenantChatsList = React.useMemo(() => {
    const list: any[] = [];
    const processedIds = new Set<string>();

    allTenants.forEach(t => {
      const tId = t.tenant_id || t.id;
      if (!tId) return;
      processedIds.add(tId.toLowerCase());

      const tPhone10 = (t.mobile || t.phone || '').replace(/\D/g, '').slice(-10);

      const tenantComplaints = complaints.filter(c => {
        const cPhone10 = (c.tenant_phone || c.phone || '').replace(/\D/g, '').slice(-10);
        return (
          (c.tenant_id && c.tenant_id.toLowerCase() === tId.toLowerCase()) ||
          (c.tenant_email && t.email && c.tenant_email.toLowerCase() === t.email.toLowerCase()) ||
          (c.tenant_name && t.full_name && c.tenant_name.toLowerCase() === t.full_name.toLowerCase()) ||
          (tPhone10 && cPhone10 && tPhone10 === cPhone10)
        );
      });

      const linkedComplaint = tenantComplaints[0] || null;

      // Extract all messages across complaint docs for this tenant
      let messages: any[] = [];
      tenantComplaints.forEach(c => {
        if (c.messages && Array.isArray(c.messages) && c.messages.length > 0) {
          messages.push(...c.messages);
        } else if (c.description) {
          messages.push({
            sender: 'tenant',
            message: c.description,
            timestamp: c.created_at || new Date().toISOString()
          });
        }
      });

      // Sort messages chronologically (ascending: earliest at top, newest at bottom)
      messages.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());

      // Find property name
      const hostelName = t.pg_name || properties.find((p: any) => p.pg_id === t.pg_id)?.name || 'Hostel Management';

      list.push({
        id: tId,
        name: t.full_name || t.name || 'Tenant',
        room_number: t.room_number || 'Unassigned',
        mobile: t.mobile || t.phone || '',
        pg_name: hostelName,
        complaint: linkedComplaint,
        messages
      });
    });

    complaints.forEach(c => {
      const cTId = c.tenant_id || c.id;
      if (cTId && !processedIds.has(cTId.toLowerCase()) && !processedIds.has((c.tenant_name || '').toLowerCase())) {
        processedIds.add(cTId.toLowerCase());
        const hostelName = c.pg_name || properties.find((p: any) => p.pg_id === c.pg_id)?.name || 'Hostel Management';
        const msgs = c.messages || (c.description ? [{ sender: 'tenant', message: c.description, timestamp: c.created_at }] : []);
        msgs.sort((a: any, b: any) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
        list.push({
          id: cTId,
          name: c.tenant_name || 'Tenant',
          room_number: c.room_number || 'Unassigned',
          mobile: c.tenant_phone || '',
          pg_name: hostelName,
          complaint: c,
          messages: msgs
        });
      }
    });

    return list;
  }, [allTenants, complaints, properties]);

  const filteredChatList = tenantChatsList.filter(item => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.name || '').toLowerCase().includes(q) ||
      (item.room_number || '').toLowerCase().includes(q) ||
      (item.mobile || '').toLowerCase().includes(q) ||
      (item.pg_name || '').toLowerCase().includes(q)
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved': return '#10B981';
      case 'in-progress': return '#F59E0B';
      default: return '#EF4444';
    }
  };

  return (
    <div style={{ height: '100%', margin: isMobile ? '0' : '0 auto', display: 'flex', flexDirection: 'column', padding: '0px', maxWidth: '1400px', overflow: 'hidden' }}>
      
      {/* WHATSAPP WEB MESSENGER CONTAINER */}
      <div style={{ background: '#ffffff', borderRadius: isMobile ? '0px' : '16px', border: isMobile ? 'none' : '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.06)', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%', flex: 1, position: 'relative' }}>
        
        {/* WHATSAPP TOP HEADER (Shows on desktop OR on mobile list view) */}
        {(!isMobile || mobileView === 'list') && (
          <div style={{ background: 'linear-gradient(135deg, #075e54, #128c7e)', padding: isMobile ? '10px 14px' : '12px 20px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, gap: '12px', flexWrap: 'wrap', position: 'relative', zIndex: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#25d366', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>
                <MessageSquare size={20} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: isMobile ? '0.95rem' : '1.1rem', fontWeight: 800, letterSpacing: '0.01em' }}>WhatsApp Tenant Messenger</h2>
                <span style={{ fontSize: '0.72rem', opacity: 0.85 }}>Send messages to any tenant or reply to issues</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'space-between' : 'flex-end' }}>
              {/* HOSTEL SELECTION BUTTON */}
              <div style={{ position: 'relative', zIndex: 30, flex: isMobile ? 1 : 'initial', maxWidth: isMobile ? '200px' : 'none' }}>
                <button
                  onClick={() => setIsPropertyDropdownOpen(!isPropertyDropdownOpen)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.18)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '10px',
                    padding: '7px 12px',
                    color: 'white',
                    cursor: 'pointer',
                    outline: 'none',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    <Building size={15} color="#a7f3d0" />
                    <span style={{ fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {localPropertyFilter === 'all' 
                        ? 'All Hostels' 
                        : properties.find((p: any) => p.pg_id === localPropertyFilter)?.name || 'All Hostels'}
                    </span>
                  </div>
                  <motion.div animate={{ rotate: isPropertyDropdownOpen ? 180 : 0 }}>
                    <ChevronDown size={16} color="#a7f3d0" />
                  </motion.div>
                </button>

                <AnimatePresence>
                  {isPropertyDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        minWidth: '180px',
                        marginTop: '6px',
                        background: '#ffffff',
                        borderRadius: '12px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                        border: '1px solid #e2e8f0',
                        overflow: 'hidden',
                        zIndex: 40
                      }}
                    >
                      <div 
                        onClick={() => { setLocalPropertyFilter('all'); setIsPropertyDropdownOpen(false); }}
                        style={{
                          padding: '10px 14px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: localPropertyFilter === 'all' ? 700 : 500,
                          color: localPropertyFilter === 'all' ? '#075e54' : '#334155',
                          background: localPropertyFilter === 'all' ? '#dcfce7' : 'white',
                          borderBottom: '1px solid #f1f5f9',
                          transition: 'all 0.15s'
                        }}
                      >
                        All Hostels
                      </div>
                      {properties.map((p: any) => (
                        <div
                          key={p.pg_id}
                          onClick={() => { setLocalPropertyFilter(p.pg_id); setIsPropertyDropdownOpen(false); }}
                          style={{
                            padding: '10px 14px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: localPropertyFilter === p.pg_id ? 700 : 500,
                            color: localPropertyFilter === p.pg_id ? '#075e54' : '#334155',
                            background: localPropertyFilter === p.pg_id ? '#dcfce7' : 'white',
                            borderBottom: '1px solid #f1f5f9',
                            transition: 'all 0.15s'
                          }}
                        >
                          {p.name}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.15)', padding: '5px 10px', borderRadius: '20px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {filteredChatList.length} Tenants Listed
              </span>
            </div>
          </div>
        )}

        {/* WHATSAPP BODY */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '340px 1fr', flex: 1, minHeight: 0, overflow: 'hidden', alignItems: 'stretch' }}>
          
          {/* LEFT COLUMN: WHATSAPP CONTACT LIST */}
          <div style={{ background: '#ffffff', borderRight: isMobile ? 'none' : '1px solid #e2e8f0', display: (!isMobile || mobileView === 'list') ? 'flex' : 'none', flexDirection: 'column', height: '100%', overflow: 'hidden', width: '100%' }}>
            
            {/* SEARCH BAR */}
            <div style={{ padding: '12px 16px', background: '#f6f6f6', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <Search size={15} color="#8696a0" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Search tenant by name, room # or mobile..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px 8px 34px', borderRadius: '8px', border: 'none', background: '#ffffff', fontSize: '0.85rem', outline: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
                />
              </div>
            </div>

            {/* CONTACTS LIST (ISOLATED SCROLL AREA) */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {filteredChatList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: '#8696a0', fontSize: '0.875rem' }}>
                  No tenants found matching search.
                </div>
              ) : (
                filteredChatList.map(item => {
                  const isSelected = (selectedTenantId || filteredChatList[0]?.id) === item.id;
                  
                  // Calculate unread tenant messages count
                  const lastReadTime = readState[item.id] || 0;
                  const tenantMsgs = (item.messages || []).filter((m: any) => m.sender === 'tenant');
                  const unreadMsgs = tenantMsgs.filter((m: any) => {
                    const msgTime = new Date(m.timestamp || Date.now()).getTime();
                    return msgTime > lastReadTime && !m.read;
                  });
                  const unreadCount = isSelected ? 0 : unreadMsgs.length;

                  // Get latest message timestamp
                  const latestMsg = item.messages?.[item.messages.length - 1];
                  const formattedTime = latestMsg?.timestamp 
                    ? new Date(latestMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '';

                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedTenantId(item.id);
                        if (item.complaint) setSelectedThreadId(item.complaint.id);
                        if (isMobile) setMobileView('chat');
                        markTenantAsRead(item.id);
                      }}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #f0f2f5',
                        cursor: 'pointer',
                        background: (isSelected && !isMobile) ? '#f0f2f5' : '#ffffff',
                        transition: 'background 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}
                    >
                      {/* TENANT AVATAR WITH ONLINE DOT */}
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <AvatarImage src={item.face_picture || item.facePicture || item.documents?.photo || item.documents?.facePicture || item.documents?.photo_url || item.avatar || item.photo_url || item.photoUrl} alt={item.name || 'Tenant'} name={item.name || 'T'} size={44} />
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#25d366', border: '2px solid white', position: 'absolute', bottom: 0, right: 0 }} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* TOP ROW: NAME & TIMESTAMP */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.name}
                          </span>
                          {formattedTime && (
                            <span style={{ fontSize: '0.72rem', color: unreadCount > 0 ? '#25d366' : '#64748b', fontWeight: unreadCount > 0 ? 800 : 500, flexShrink: 0 }}>
                              {formattedTime}
                            </span>
                          )}
                        </div>

                        {/* MIDDLE ROW: HOSTEL NAME + SINGLE ROOM NUMBER DISPLAY */}
                        <div style={{ fontSize: '0.73rem', color: '#075e54', fontWeight: 700, margin: '2px 0', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <Building size={12} color="#128c7e" style={{ flexShrink: 0 }} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.pg_name}</span>
                          <span style={{ color: '#cbd5e1', flexShrink: 0 }}>•</span>
                          <span style={{ color: '#475569', fontWeight: 600, background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem', flexShrink: 0 }}>
                            Rm {item.room_number || 'N/A'}
                          </span>
                        </div>

                        {/* BOTTOM ROW: PERMANENTLY VISIBLE PHONE NUMBER + LATEST MESSAGE SNIPPET + UNREAD BADGE */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden', flex: 1 }}>
                            {/* Phone Number (ALWAYS VISIBLE) */}
                            <span style={{ fontSize: '0.74rem', color: '#64748b', fontFamily: 'monospace', fontWeight: 600, flexShrink: 0 }}>
                              {item.mobile || 'No Phone'}
                            </span>

                            {/* Message Snippet (If available) */}
                            {latestMsg?.message && (
                              <>
                                <span style={{ color: '#cbd5e1', flexShrink: 0 }}>•</span>
                                <span style={{ fontSize: '0.74rem', color: unreadCount > 0 ? '#0f172a' : '#64748b', fontWeight: unreadCount > 0 ? 700 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {latestMsg.message}
                                </span>
                              </>
                            )}
                          </div>
                          
                          {/* WHATSAPP STYLE GREEN UNREAD COUNTER BADGE */}
                          {unreadCount > 0 && (
                            <div style={{
                              background: '#25d366',
                              color: '#ffffff',
                              borderRadius: '999px',
                              minWidth: '20px',
                              height: '20px',
                              padding: '0 6px',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 2px 6px rgba(37,211,102,0.4)',
                              flexShrink: 0
                            }}>
                              {unreadCount}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: WHATSAPP CHAT CANVAS (PINNED HEADER & INPUT BAR, ISOLATED BUBBLE SCROLLING) */}
          <div style={{ height: '100%', overflow: 'hidden', display: (!isMobile || mobileView === 'chat') ? 'flex' : 'none', flexDirection: 'column', width: '100%', position: 'relative' }}>
            {(() => {
              const activeContact = filteredChatList.find(c => c.id === (selectedTenantId || filteredChatList[0]?.id)) || filteredChatList[0];

              if (!activeContact) {
                return (
                  <div style={{ background: '#efeae2', padding: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', height: '100%' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#00a884', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                      <MessageSquare size={40} />
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111b21', margin: 0 }}>WhatsApp Web for StaySync</h3>
                    <p style={{ color: '#667781', fontSize: '0.9rem', marginTop: '6px', maxWidth: '380px' }}>
                      Select a tenant from the left sidebar to send direct WhatsApp messages or respond to maintenance requests.
                    </p>
                  </div>
                );
              }

              const activeComplaint = activeContact.complaint;
              const allMessages = activeContact.messages || [];

              return (
                <div style={{ display: 'flex', flexDirection: 'column', background: '#efeae2', position: 'relative', height: '100%', minHeight: 0, overflow: 'hidden', width: '100%' }}>
                  
                  {/* CHAT HEADER (FIXED STICKY AT TOP) */}
                  <div style={{ padding: '10px 14px', background: '#f0f2f5', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, position: 'sticky', top: 0, zIndex: 40, boxShadow: '0 2px 4px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      {/* BACK BUTTON FOR MOBILE */}
                      {isMobile && (
                        <button
                          onClick={() => setMobileView('list')}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: '4px',
                            borderRadius: '50%',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#075e54',
                            marginRight: '2px'
                          }}
                          title="Back to tenant list"
                        >
                          <ArrowLeft size={22} />
                        </button>
                      )}

                      <AvatarImage src={activeContact.face_picture || activeContact.facePicture || activeContact.documents?.photo || activeContact.documents?.facePicture || activeContact.documents?.photo_url || activeContact.avatar || activeContact.photo_url || activeContact.photoUrl} alt={activeContact.name || 'Tenant'} name={activeContact.name || 'T'} size={38} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#111b21', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {activeContact.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#667781', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {activeContact.pg_name} • Rm {activeContact.room_number || 'N/A'} • {activeContact.mobile || 'No Phone'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {activeContact.mobile && (
                        <a
                          href={`https://wa.me/${activeContact.mobile.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#25d366', color: 'white', padding: '6px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, textDecoration: 'none' }}
                        >
                          <MessageSquare size={14} /> {!isMobile && <span>Open WhatsApp Web</span>}
                        </a>
                      )}

                      {activeComplaint && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {!isMobile && <span style={{ fontSize: '0.75rem', color: '#667781', fontWeight: 600 }}>Status:</span>}
                          <select
                            value={activeComplaint.status}
                            onChange={(e) => handleStatusUpdate(activeComplaint.id, e.target.value)}
                            disabled={isUpdating === activeComplaint.id}
                            style={{ padding: '4px 6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem', fontWeight: 700, color: getStatusColor(activeComplaint.status), background: 'white', outline: 'none' }}
                          >
                            <option value="pending">Pending 🕒</option>
                            <option value="in-progress">In Progress ⏳</option>
                            <option value="resolved">Resolved ✅</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* MESSAGES FLOW CANVAS - ISOLATED SCROLLABLE BUBBLE STREAM */}
                  <div style={{ flex: 1, minHeight: 0, padding: '16px', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    
                    {allMessages.length === 0 ? (
                      <div style={{ alignSelf: 'center', background: '#ffeecd', color: '#543b1d', padding: '6px 14px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                        Starting direct WhatsApp conversation with {activeContact.name} ({activeContact.pg_name}, Room {activeContact.room_number})
                      </div>
                    ) : (
                      (() => {
                        const sortedMessages = [...allMessages].sort((a: any, b: any) => {
                          const tA = new Date(a.timestamp || 0).getTime();
                          const tB = new Date(b.timestamp || 0).getTime();
                          return tA - tB;
                        });

                        let lastDateHeader = '';

                        return sortedMessages.map((msg: any, idx: number) => {
                          const msgDateHeader = formatWhatsAppDateHeader(msg.timestamp);
                          const showDateHeader = msgDateHeader !== lastDateHeader;
                          if (showDateHeader) {
                            lastDateHeader = msgDateHeader;
                          }

                          const isOwner = msg.sender === 'owner';

                          return (
                            <React.Fragment key={idx}>
                              {showDateHeader && (
                                <div style={{
                                  alignSelf: 'center',
                                  margin: '10px 0 4px 0',
                                  background: '#ffffff',
                                  color: '#54656f',
                                  padding: '4px 12px',
                                  borderRadius: '8px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  boxShadow: '0 1px 2px rgba(11,20,26,0.12)',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.04em',
                                  userSelect: 'none'
                                }}>
                                  {msgDateHeader}
                                </div>
                              )}

                              <div
                                style={{
                                  alignSelf: isOwner ? 'flex-end' : 'flex-start',
                                  maxWidth: '85%',
                                  background: isOwner ? '#dcf8c6' : '#ffffff',
                                  padding: '10px 14px',
                                  borderRadius: isOwner ? '12px 0px 12px 12px' : '0px 12px 12px 12px',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.15)'
                                }}
                              >
                                <div style={{ fontSize: '0.875rem', color: '#111b21', lineHeight: 1.4 }}>
                                  {msg.message}
                                </div>
                                <div style={{ fontSize: '0.68rem', color: '#667781', textAlign: 'right', marginTop: '4px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px' }}>
                                  {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  {isOwner && <span style={{ color: '#53bdeb', fontWeight: 800 }}>✓✓</span>}
                                </div>
                              </div>
                            </React.Fragment>
                          );
                        });
                      })()
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* WHATSAPP INPUT BAR (FIXED STICKY AT BOTTOM) */}
                  <div style={{ padding: isMobile ? '8px 10px' : '10px 14px', background: '#f0f2f5', borderTop: '1px solid #e2e8f0', flexShrink: 0, position: 'sticky', bottom: 0, zIndex: 40, boxShadow: '0 -2px 6px rgba(0,0,0,0.06)' }}>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!ownerReplyInput.trim() || !activeContact) return;
                        const text = ownerReplyInput;
                        setOwnerReplyInput('');
                        setSendingOwnerReply(true);

                        // Optimistic update
                        const newMsg = { sender: 'owner', message: text, timestamp: new Date().toISOString() };
                        if (activeComplaint) {
                          setComplaints(prev => prev.map(c => c.id === activeComplaint.id ? { ...c, resolution_comment: text, messages: [...(c.messages || []), newMsg] } : c));
                        } else {
                          activeContact.messages = [...(activeContact.messages || []), newMsg];
                        }

                        await rpcCall('sendOwnerDirectMessage', {
                          tenantId: activeContact.id,
                          tenantPhone: activeContact.mobile,
                          tenantName: activeContact.name,
                          message: text,
                          complaintId: activeComplaint?.id,
                          sendWhatsApp: sendWhatsAppAlso
                        });

                        setSendingOwnerReply(false);
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      {/* WHATSAPP SYNC TOGGLE BADGE */}
                      <button
                        type="button"
                        onClick={() => setSendWhatsAppAlso(!sendWhatsAppAlso)}
                        title={sendWhatsAppAlso ? "WhatsApp Sync Active (Click to disable)" : "WhatsApp Sync Off (Click to enable)"}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '6px 10px',
                          borderRadius: '20px',
                          background: sendWhatsAppAlso ? '#dcfce7' : '#f1f5f9',
                          border: sendWhatsAppAlso ? '1px solid #86efac' : '1px solid #cbd5e1',
                          color: sendWhatsAppAlso ? '#15803d' : '#64748b',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          flexShrink: 0,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <MessageSquare size={14} color={sendWhatsAppAlso ? '#16a34a' : '#64748b'} />
                        <span style={{ whiteSpace: 'nowrap' }}>
                          {sendWhatsAppAlso ? 'WA Sync' : 'Direct'}
                        </span>
                      </button>

                      {/* PILL INPUT FIELD */}
                      <input
                        type="text"
                        placeholder={`Type a message to ${activeContact.name}...`}
                        value={ownerReplyInput}
                        onChange={e => setOwnerReplyInput(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '10px 16px',
                          borderRadius: '24px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.88rem',
                          outline: 'none',
                          background: '#ffffff',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                        }}
                      />

                      {/* CIRCULAR WHATSAPP SEND BUTTON */}
                      <button
                        type="submit"
                        disabled={sendingOwnerReply || !ownerReplyInput.trim()}
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: (!ownerReplyInput.trim() || sendingOwnerReply) ? '#94a3b8' : '#00a884',
                          color: '#ffffff',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: (!ownerReplyInput.trim() || sendingOwnerReply) ? 'not-allowed' : 'pointer',
                          boxShadow: (!ownerReplyInput.trim() || sendingOwnerReply) ? 'none' : '0 2px 8px rgba(0,168,132,0.4)',
                          flexShrink: 0,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {sendingOwnerReply ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} style={{ marginLeft: '2px' }} />}
                      </button>
                    </form>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PGOwnerChatPage() {
  return (
    <Suspense fallback={<SkeletonChatPage />}>
      <PGOwnerChatContent />
    </Suspense>
  );
}
