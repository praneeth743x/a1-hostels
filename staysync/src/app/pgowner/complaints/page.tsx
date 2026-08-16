"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ShieldAlert, CheckCircle, Loader2, Building, MessageSquare, ChevronDown } from 'lucide-react';
import { useHostel, usePermissions } from '@/context/HostelContext';
import { rpcCall } from '@/lib/rpc';
import { SkeletonListCards } from '@/components/SkeletonLoader';
import styles from '../dashboard.module.css';

export default function PGOwnerComplaintsPage() {
  const router = useRouter();
  const { isStaff } = usePermissions();
  const routePrefix = '/pgowner';
  const { properties } = useHostel();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  // Status filter state
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'in-progress', 'resolved'
  const [isPropertyDropdownOpen, setIsPropertyDropdownOpen] = useState(false);
  const [localPropertyFilter, setLocalPropertyFilter] = useState<string>('all');

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setLoading(true);
        const fetchComplaints = async () => {
          if (!properties || properties.length === 0) {
            setComplaints([]);
            return;
          }
          const pgId = localPropertyFilter;
          const res = await rpcCall('getOwnerComplaints', user.uid, pgId);
          if (res?.success) {
            const activePgIds = new Set(properties.map((p: any) => p.pg_id || p.id));
            const valid = (res.data || []).filter((c: any) => {
              if (!c) return false;
              const s = String(c.status || '').toUpperCase();
              return s !== 'DELETED' && c.is_active !== false && activePgIds.has(c.pg_id);
            });
            setComplaints(valid);
          }
        };
        
        await fetchComplaints();
        setLoading(false);
        
        intervalId = setInterval(fetchComplaints, 5000);
      } else {
        setLoading(false);
      }
    });
    return () => {
      unsub();
      if (intervalId) clearInterval(intervalId);
    };
  }, [localPropertyFilter, properties]);

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

  const filteredComplaints = complaints.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved': return '#10B981';
      case 'in-progress': return '#F59E0B';
      default: return '#EF4444';
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '32px' }}>
      
      {/* ── TOP HEADER / FILTER BAR ── */}
      <div style={{ background: '#ffffff', borderRadius: '16px', padding: '16px 20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
        
        {/* HOSTEL SELECTOR */}
        <div style={{ position: 'relative', zIndex: 50, flex: '1 1 200px', maxWidth: '320px' }}>
          <button
            onClick={() => setIsPropertyDropdownOpen(!isPropertyDropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              width: '100%',
              background: '#4F46E5',
              border: 'none',
              borderRadius: '12px',
              padding: '10px 16px',
              color: 'white',
              cursor: 'pointer',
              outline: 'none',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
              fontWeight: 600
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
              <Building size={18} color="#A5B4FC" />
              <span style={{ fontSize: '0.9rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {localPropertyFilter === 'all' 
                  ? 'All Hostels' 
                  : properties.find((p: any) => p.pg_id === localPropertyFilter)?.name || 'All Hostels'}
              </span>
            </div>
            <motion.div animate={{ rotate: isPropertyDropdownOpen ? 180 : 0 }}>
              <ChevronDown size={18} color="#A5B4FC" />
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
                  left: 0,
                  right: 0,
                  marginTop: '6px',
                  background: '#ffffff',
                  borderRadius: '14px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                  zIndex: 100
                }}
              >
                <div 
                  onClick={() => { setLocalPropertyFilter('all'); setIsPropertyDropdownOpen(false); }}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    fontSize: '0.88rem',
                    fontWeight: localPropertyFilter === 'all' ? 700 : 500,
                    color: localPropertyFilter === 'all' ? '#4F46E5' : '#334155',
                    background: localPropertyFilter === 'all' ? '#EEF2FF' : 'white',
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
                      padding: '12px 16px',
                      cursor: 'pointer',
                      fontSize: '0.88rem',
                      fontWeight: localPropertyFilter === p.pg_id ? 700 : 500,
                      color: localPropertyFilter === p.pg_id ? '#4F46E5' : '#334155',
                      background: localPropertyFilter === p.pg_id ? '#EEF2FF' : 'white',
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

        {/* STATUS PILLS */}
        <div style={{ display: 'flex', gap: '6px', background: '#f8fafc', padding: '4px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          {[
            { id: 'all', label: 'All' },
            { id: 'pending', label: 'Pending' },
            { id: 'in-progress', label: 'In Progress' },
            { id: 'resolved', label: 'Resolved' }
          ].map((item) => {
            const isActive = statusFilter === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setStatusFilter(item.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isActive ? '#ffffff' : 'transparent',
                  color: isActive ? '#0f172a' : '#64748b',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.82rem',
                  boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── COMPLAINTS LIST ── */}
      {loading && complaints.length === 0 ? (
        <SkeletonListCards count={4} />
      ) : filteredComplaints.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '20px', padding: '48px 24px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <ShieldAlert size={48} color="#94a3b8" style={{ margin: '0 auto 16px auto' }} />
          <h3 style={{ color: '#1e293b', fontWeight: 700, margin: 0 }}>No Complaints Found</h3>
          <p style={{ color: '#64748b', fontSize: '0.95rem', marginTop: '8px' }}>There are no {statusFilter !== 'all' ? statusFilter : ''} complaints for the selected criteria.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          <AnimatePresence>
            {filteredComplaints.map(complaint => (
              <motion.div
                key={complaint.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ padding: '16px' }}>
                  
                  {/* Category & Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ background: '#EEF2FF', padding: '6px', borderRadius: '8px', color: '#4F46E5', display: 'flex' }}>
                        <ShieldAlert size={16} />
                      </div>
                      <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem' }}>{complaint.category}</span>
                    </div>

                    <span style={{ 
                      padding: '4px 10px', 
                      borderRadius: '20px', 
                      fontSize: '0.72rem', 
                      fontWeight: 800, 
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                      background: `${getStatusColor(complaint.status)}15`,
                      color: getStatusColor(complaint.status),
                      border: `1px solid ${getStatusColor(complaint.status)}40`
                    }}>
                      {complaint.status.replace('-', ' ')}
                    </span>
                  </div>

                  {/* Tenant Details */}
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '10px', marginBottom: '12px', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem', display: 'block' }}>{complaint.tenant_name}</span>
                      <span style={{ 
                        fontSize: '0.75rem', 
                        padding: '2px 8px', 
                        borderRadius: '6px', 
                        fontWeight: 700,
                        background: complaint.room_number === 'Unassigned' ? '#fee2e2' : '#e0e7ff', 
                        color: complaint.room_number === 'Unassigned' ? '#ef4444' : '#4338ca', 
                      }}>
                        Room: {complaint.room_number}
                      </span>
                    </div>

                    {complaint.pg_name && (
                      <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        <Building size={12} /> {complaint.pg_name}
                      </span>
                    )}
                  </div>

                  {/* Description Box */}
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', fontSize: '0.88rem', color: '#334155', lineHeight: '1.4', marginBottom: '12px', border: '1px solid #f1f5f9' }}>
                    {complaint.description}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>
                    <span>Urgency: <strong style={{ color: complaint.urgency === 'High' ? '#EF4444' : '#64748b' }}>{complaint.urgency}</strong></span>
                    <span>{new Date(complaint.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Footer Actions */}
                <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '8px' }}>
                  {complaint.status !== 'resolved' && (
                    <>
                      {complaint.status === 'pending' && (
                        <button 
                          onClick={() => handleStatusUpdate(complaint.id, 'in-progress')}
                          disabled={isUpdating === complaint.id}
                          style={{ flex: 1, padding: '8px', background: 'white', border: '1px solid #F59E0B', color: '#F59E0B', borderRadius: '8px', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                          In Progress
                        </button>
                      )}
                      
                      <button 
                        onClick={() => handleStatusUpdate(complaint.id, 'resolved')}
                        disabled={isUpdating === complaint.id}
                        style={{ flex: 1, padding: '8px', background: '#10B981', border: 'none', color: 'white', borderRadius: '8px', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}
                      >
                        {isUpdating === complaint.id ? 'Updating...' : 'Resolve'}
                      </button>
                    </>
                  )}

                  {/* Chat Action Button - Forwards Complaint to Chat Page */}
                  <button
                    onClick={() => {
                      const tenantId = complaint.tenant_id || complaint.id || '';
                      const initialMsg = `Hi ${complaint.tenant_name || 'Tenant'}, regarding your ${complaint.category || 'complaint'} issue (${complaint.description || ''}): `;
                      const url = `${routePrefix}/chat?complaintId=${encodeURIComponent(complaint.id)}&tenantId=${encodeURIComponent(tenantId)}&initialMessage=${encodeURIComponent(initialMsg)}`;
                      router.push(url);
                    }}
                    style={{ 
                      padding: '8px 14px', 
                      background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '8px', 
                      fontWeight: 600, 
                      fontSize: '0.75rem', 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)'
                    }}
                  >
                    <MessageSquare size={14} />
                    Chat
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
