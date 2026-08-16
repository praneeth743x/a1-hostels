"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, FileText, AlertCircle, Trash2, Edit3, MessageSquare, CheckCircle, Clock, X, ArrowUpRight, HelpCircle } from 'lucide-react';
import { rpcCall } from '@/lib/rpc';

interface TenantPrivacySectionProps {
  tenantUid: string;
  pgId?: string;
}

export function TenantPrivacySection({ tenantUid, pgId }: TenantPrivacySectionProps) {
  const [requests, setRequests] = useState<any[]>([]);
  const [grievances, setGrievances] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal States
  const [activeModal, setActiveModal] = useState<'correction' | 'deletion' | 'grievance' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form States
  const [correctionFields, setCorrectionFields] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');

  const [deletionReason, setDeletionReason] = useState('');

  const [grievanceSubject, setGrievanceSubject] = useState('');
  const [grievanceDesc, setGrievanceDesc] = useState('');
  const [grievanceType, setGrievanceType] = useState('Personal Data Correction');

  useEffect(() => {
    if (tenantUid) {
      fetchPrivacyData();
    }
  }, [tenantUid]);

  const fetchPrivacyData = async () => {
    setLoading(true);
    try {
      const res = await rpcCall('getTenantPrivacyRequests', tenantUid);
      if (res.success && res.data) {
        setRequests(res.data.requests || []);
        setGrievances(res.data.grievances || []);
      }
    } catch (err) {
      console.error('Failed to fetch privacy requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionFields.trim()) {
      showToast('error', 'Please specify the information you wish to correct.');
      return;
    }

    setIsSubmitting(true);
    const res = await rpcCall(
      'createPrivacyRequest',
      tenantUid,
      pgId || 'N/A',
      'correction',
      correctionFields.trim(),
      correctionReason.trim()
    );
    setIsSubmitting(false);

    if (res.success) {
      showToast('success', 'Data correction request submitted for Owner review.');
      setActiveModal(null);
      setCorrectionFields('');
      setCorrectionReason('');
      fetchPrivacyData();
    } else {
      showToast('error', res.error || 'Failed to submit request.');
    }
  };

  const handleDeletionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const res = await rpcCall(
      'createPrivacyRequest',
      tenantUid,
      pgId || 'N/A',
      'deletion',
      'All Personal Records (subject to statutory retention)',
      deletionReason.trim()
    );
    setIsSubmitting(false);

    if (res.success) {
      showToast('success', 'Safe Data Deletion request submitted for Owner review.');
      setActiveModal(null);
      setDeletionReason('');
      fetchPrivacyData();
    } else {
      showToast('error', res.error || 'Failed to submit deletion request.');
    }
  };

  const handleGrievanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grievanceSubject.trim() || !grievanceDesc.trim()) {
      showToast('error', 'Please enter both subject and description.');
      return;
    }

    setIsSubmitting(true);
    const res = await rpcCall(
      'createPrivacyGrievance',
      tenantUid,
      pgId || 'N/A',
      grievanceSubject.trim(),
      grievanceDesc.trim(),
      grievanceType
    );
    setIsSubmitting(false);

    if (res.success) {
      showToast('success', 'Privacy grievance submitted successfully.');
      setActiveModal(null);
      setGrievanceSubject('');
      setGrievanceDesc('');
      fetchPrivacyData();
    } else {
      showToast('error', res.error || 'Failed to submit grievance.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
      case 'Completed':
      case 'Resolved':
        return <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, backgroundColor: '#DCFCE7', color: '#15803D' }}>{status}</span>;
      case 'Rejected':
        return <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, backgroundColor: '#FEE2E2', color: '#B91C1C' }}>{status}</span>;
      case 'Under Review':
      case 'In Review':
        return <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, backgroundColor: '#FEF3C7', color: '#B45309' }}>{status}</span>;
      default:
        return <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, backgroundColor: '#EEF2FF', color: '#4338CA' }}>{status || 'Pending'}</span>;
    }
  };

  return (
    <div style={{
      backgroundColor: '#ffffff',
      borderRadius: '20px',
      padding: '24px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
      marginBottom: '20px'
    }}>
      {toast && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '12px',
          marginBottom: '16px',
          fontSize: '0.85rem',
          fontWeight: 600,
          backgroundColor: toast.type === 'success' ? '#DCFCE7' : '#FEE2E2',
          color: toast.type === 'success' ? '#15803D' : '#B91C1C',
          border: `1px solid ${toast.type === 'success' ? '#86EFAC' : '#FCA5A5'}`
        }}>
          {toast.message}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
          <Shield size={18} color="#4F46E5" /> Privacy & Data Protection
        </h2>
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.8rem',
            color: '#4F46E5',
            fontWeight: 600,
            textDecoration: 'none'
          }}
        >
          View Privacy Policy <ArrowUpRight size={14} />
        </a>
      </div>

      <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 0, marginBottom: '18px', lineHeight: '1.5' }}>
        Manage your personal data requests, request information corrections, or submit privacy grievances. All data requests are safely processed in accordance with legal retention policies.
      </p>

      {/* Action Buttons Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveModal('correction')}
          style={{
            padding: '12px 14px',
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '14px',
            color: '#1E293B',
            fontWeight: 600,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <Edit3 size={15} color="#4F46E5" /> Request Correction
        </button>

        <button
          onClick={() => setActiveModal('deletion')}
          style={{
            padding: '12px 14px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: '14px',
            color: '#991B1B',
            fontWeight: 600,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <Trash2 size={15} color="#DC2626" /> Request Data Deletion
        </button>

        <button
          onClick={() => setActiveModal('grievance')}
          style={{
            padding: '12px 14px',
            backgroundColor: '#F0FDF4',
            border: '1px solid #86EFAC',
            borderRadius: '14px',
            color: '#166534',
            fontWeight: 600,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <MessageSquare size={15} color="#16A34A" /> Raise Privacy Grievance
        </button>
      </div>

      {/* Submitted Requests & Grievances Status Tracker */}
      <div>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 12px', color: '#1e293b' }}>
          Submitted Requests & Status ({requests.length + grievances.length})
        </h3>

        {requests.length === 0 && grievances.length === 0 ? (
          <div style={{ padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px border #E2E8F0', textAlign: 'center', fontSize: '0.8rem', color: '#94A3B8' }}>
            No pending or active data requests.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {requests.map((r) => (
              <div key={r.request_id} style={{ padding: '12px 14px', backgroundColor: '#F8FAFC', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0F172A' }}>
                    {r.type === 'deletion' ? 'Data Deletion Request' : 'Data Correction Request'}
                  </span>
                  {getStatusBadge(r.status)}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748B', marginBottom: '4px' }}>
                  {r.requested_fields && <div><strong>Fields:</strong> {r.requested_fields}</div>}
                  {r.reason && <div><strong>Reason:</strong> {r.reason}</div>}
                  <div>Requested on {new Date(r.requested_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                </div>
                {r.resolution_notes && (
                  <div style={{ marginTop: '6px', padding: '6px 10px', backgroundColor: '#EFF6FF', borderRadius: '8px', fontSize: '0.75rem', color: '#1E40AF' }}>
                    <strong>Owner Response:</strong> {r.resolution_notes}
                  </div>
                )}
              </div>
            ))}

            {grievances.map((g) => (
              <div key={g.grievance_id} style={{ padding: '12px 14px', backgroundColor: '#F8FAFC', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0F172A' }}>
                    Privacy Grievance: {g.subject}
                  </span>
                  {getStatusBadge(g.status)}
                </div>
                <p style={{ margin: '0 0 4px', fontSize: '0.78rem', color: '#475569' }}>{g.description}</p>
                {g.resolution && (
                  <div style={{ marginTop: '6px', padding: '6px 10px', backgroundColor: '#EFF6FF', borderRadius: '8px', fontSize: '0.75rem', color: '#1E40AF' }}>
                    <strong>Resolution:</strong> {g.resolution}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODALS */}
      <AnimatePresence>
        {activeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(6px)',
              zIndex: 999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                backgroundColor: 'white',
                borderRadius: '24px',
                padding: '24px',
                maxWidth: '460px',
                width: '100%',
                boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#0F172A' }}>
                  {activeModal === 'correction' && 'Request Data Correction'}
                  {activeModal === 'deletion' && 'Request Data Deletion'}
                  {activeModal === 'grievance' && 'Raise Privacy Grievance'}
                </h3>
                <button
                  onClick={() => setActiveModal(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
                >
                  <X size={20} />
                </button>
              </div>

              {activeModal === 'correction' && (
                <form onSubmit={handleCorrectionSubmit}>
                  <p style={{ fontSize: '0.82rem', color: '#64748B', marginTop: 0, marginBottom: '14px' }}>
                    Identify fields you believe are incorrect (e.g. Name, Phone, Email, Address, Emergency Contact). Sensitive rent ledger history cannot be directly altered.
                  </p>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                      Incorrect Information / Fields
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Phone number update or Emergency Contact correction"
                      value={correctionFields}
                      onChange={(e) => setCorrectionFields(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                      required
                    />
                  </div>
                  <div style={{ marginBottom: '18px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                      Correct Details & Reason
                    </label>
                    <textarea
                      placeholder="Enter correct details..."
                      value={correctionReason}
                      onChange={(e) => setCorrectionReason(e.target.value)}
                      rows={3}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      style={{ flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#475569', fontWeight: 600, fontSize: '0.85rem' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      style={{ flex: 1, padding: '10px', borderRadius: '12px', border: 'none', backgroundColor: '#4F46E5', color: 'white', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit Request'}
                    </button>
                  </div>
                </form>
              )}

              {activeModal === 'deletion' && (
                <form onSubmit={handleDeletionSubmit}>
                  <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', padding: '12px 14px', borderRadius: '12px', marginBottom: '14px', fontSize: '0.8rem', color: '#991B1B', lineHeight: '1.5' }}>
                    <strong>Safe Deletion Protection:</strong> Submitting a deletion request triggers Hostel Owner review. Under statutory tax & accounting regulations, financial rent ledger receipts and occupancy logs are legally preserved.
                  </div>
                  <div style={{ marginBottom: '18px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                      Reason for Deletion Request (Optional)
                    </label>
                    <textarea
                      placeholder="e.g. Vacated hostel stay, closing account..."
                      value={deletionReason}
                      onChange={(e) => setDeletionReason(e.target.value)}
                      rows={3}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      style={{ flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#475569', fontWeight: 600, fontSize: '0.85rem' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      style={{ flex: 1, padding: '10px', borderRadius: '12px', border: 'none', backgroundColor: '#DC2626', color: 'white', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit Deletion Request'}
                    </button>
                  </div>
                </form>
              )}

              {activeModal === 'grievance' && (
                <form onSubmit={handleGrievanceSubmit}>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                      Subject
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Privacy query regarding profile data"
                      value={grievanceSubject}
                      onChange={(e) => setGrievanceSubject(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                      required
                    />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                      Category
                    </label>
                    <select
                      value={grievanceType}
                      onChange={(e) => setGrievanceType(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #CBD5E1', fontSize: '0.85rem', backgroundColor: 'white' }}
                    >
                      <option value="Personal Data Correction">Personal Data Correction</option>
                      <option value="Unauthorized Data Access">Unauthorized Data Access Concern</option>
                      <option value="Notification Preferences">Notification Preferences</option>
                      <option value="General Data Protection Query">General Data Protection Query</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: '18px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                      Detailed Description
                    </label>
                    <textarea
                      placeholder="Describe your grievance or privacy query..."
                      value={grievanceDesc}
                      onChange={(e) => setGrievanceDesc(e.target.value)}
                      rows={3}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      style={{ flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#475569', fontWeight: 600, fontSize: '0.85rem' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      style={{ flex: 1, padding: '10px', borderRadius: '12px', border: 'none', backgroundColor: '#16A34A', color: 'white', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit Grievance'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
