"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, FileText, AlertCircle, Trash2, Edit3, MessageSquare, CheckCircle, Clock, X, Search, Filter, Loader2 } from 'lucide-react';
import { rpcCall } from '@/lib/rpc';
import { useHostel } from '@/context/HostelContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import styles from './privacyOwner.module.css';

function PrivacyOwnerPageContent() {
  const { selectedPgId, currentUser } = useHostel();
  const [activeTab, setActiveTab] = useState<'requests' | 'grievances'>('requests');
  const [requests, setRequests] = useState<any[]>([]);
  const [grievances, setGrievances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Review Modal State
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [modalType, setModalType] = useState<'request' | 'grievance' | null>(null);
  const [newStatus, setNewStatus] = useState<string>('Approved');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (currentUser?.uid) {
      fetchOwnerPrivacyData();
    }
  }, [currentUser?.uid, selectedPgId]);

  const fetchOwnerPrivacyData = async () => {
    setLoading(true);
    try {
      const activeUid = currentUser?.uid;
      const res = await rpcCall('getOwnerPrivacyRequests', activeUid, selectedPgId || 'all');
      if (res.success && res.data) {
        setRequests(res.data.requests || []);
        setGrievances(res.data.grievances || []);
      }
    } catch (err) {
      console.error('Failed to fetch owner privacy data:', err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !modalType) return;

    setIsUpdating(true);
    const activeUid = currentUser?.uid;

    let res;
    if (modalType === 'request') {
      res = await rpcCall('updatePrivacyRequestStatus', activeUid, selectedItem.request_id, newStatus, resolutionNotes.trim());
    } else {
      res = await rpcCall('updatePrivacyGrievanceStatus', activeUid, selectedItem.grievance_id, newStatus, resolutionNotes.trim());
    }
    setIsUpdating(false);

    if (res.success) {
      showToast('success', `Status updated to ${newStatus} successfully!`);
      setSelectedItem(null);
      setModalType(null);
      setResolutionNotes('');
      fetchOwnerPrivacyData();
    } else {
      showToast('error', res.error || 'Failed to update status.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
      case 'Completed':
      case 'Resolved':
        return <span className={`${styles.badge} ${styles.badgeSuccess}`}>{status}</span>;
      case 'Rejected':
        return <span className={`${styles.badge} ${styles.badgeError}`}>{status}</span>;
      case 'Under Review':
      case 'In Review':
        return <span className={`${styles.badge} ${styles.badgeWarning}`}>{status}</span>;
      default:
        return <span className={`${styles.badge} ${styles.badgePending}`}>{status || 'Pending'}</span>;
    }
  };

  return (
    <ProtectedRoute permission="viewTenants">
      <div className={styles.container}>
        {toast && (
          <div className={`${styles.toast} ${toast.type === 'success' ? styles.toastSuccess : styles.toastError}`}>
            {toast.message}
          </div>
        )}

        {/* Page Header */}
        <div className={styles.headerCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className={styles.headerIconBox}>
              <Shield size={24} color="#4F46E5" />
            </div>
            <div>
              <h1 className={styles.title}>Privacy & Data Protection Requests</h1>
              <p className={styles.subtitle}>
                Review tenant data correction requests, safe data deletion requests, and privacy grievances under the DPDP framework.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className={styles.tabBar}>
          <button
            className={`${styles.tabBtn} ${activeTab === 'requests' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            Data Requests ({requests.length})
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'grievances' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('grievances')}
          >
            Privacy Grievances ({grievances.length})
          </button>
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div className={styles.loadingContainer}>
            <Loader2 size={24} className="animate-spin" color="#4F46E5" />
            <span>Loading requests...</span>
          </div>
        )}

        {/* DATA REQUESTS LIST */}
        {!loading && activeTab === 'requests' && (
          <div>
            {requests.length === 0 ? (
              <div className={styles.emptyCard}>
                <CheckCircle size={36} color="#10B981" />
                <h3>No Data Requests</h3>
                <p>No tenant data correction or deletion requests currently pending.</p>
              </div>
            ) : (
              <div className={styles.grid}>
                {requests.map((r) => (
                  <motion.div
                    key={r.request_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={styles.card}
                  >
                    <div className={styles.cardHeader}>
                      <div className={styles.cardTitleBox}>
                        {r.type === 'deletion' ? (
                          <Trash2 size={18} color="#DC2626" />
                        ) : (
                          <Edit3 size={18} color="#4F46E5" />
                        )}
                        <span className={styles.cardTitle}>
                          {r.type === 'deletion' ? 'Data Deletion Request' : 'Data Correction Request'}
                        </span>
                      </div>
                      {getStatusBadge(r.status)}
                    </div>

                    <div className={styles.cardBody}>
                      <div className={styles.fieldRow}>
                        <span className={styles.fieldLabel}>Requested Fields / Action:</span>
                        <span className={styles.fieldValue}>{r.requested_fields || 'N/A'}</span>
                      </div>

                      {r.reason && (
                        <div className={styles.fieldRow}>
                          <span className={styles.fieldLabel}>Reason:</span>
                          <span className={styles.fieldValue}>{r.reason}</span>
                        </div>
                      )}

                      <div className={styles.fieldRow}>
                        <span className={styles.fieldLabel}>Requested Date:</span>
                        <span className={styles.fieldValue}>
                          {new Date(r.requested_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {r.resolution_notes && (
                        <div className={styles.notesBox}>
                          <strong>Owner Notes:</strong> {r.resolution_notes}
                        </div>
                      )}
                    </div>

                    <div className={styles.cardFooter}>
                      <button
                        className={styles.reviewBtn}
                        onClick={() => {
                          setSelectedItem(r);
                          setModalType('request');
                          setNewStatus(r.status || 'Approved');
                          setResolutionNotes(r.resolution_notes || '');
                        }}
                      >
                        Review & Update Status
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* GRIEVANCES LIST */}
        {!loading && activeTab === 'grievances' && (
          <div>
            {grievances.length === 0 ? (
              <div className={styles.emptyCard}>
                <CheckCircle size={36} color="#10B981" />
                <h3>No Privacy Grievances</h3>
                <p>No tenant privacy grievances raised.</p>
              </div>
            ) : (
              <div className={styles.grid}>
                {grievances.map((g) => (
                  <motion.div
                    key={g.grievance_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={styles.card}
                  >
                    <div className={styles.cardHeader}>
                      <div className={styles.cardTitleBox}>
                        <MessageSquare size={18} color="#16A34A" />
                        <span className={styles.cardTitle}>{g.subject}</span>
                      </div>
                      {getStatusBadge(g.status)}
                    </div>

                    <div className={styles.cardBody}>
                      <div className={styles.fieldRow}>
                        <span className={styles.fieldLabel}>Category:</span>
                        <span className={styles.fieldValue}>{g.related_data_type || 'General'}</span>
                      </div>

                      <div className={styles.fieldRow}>
                        <span className={styles.fieldLabel}>Description:</span>
                        <span className={styles.fieldValue}>{g.description}</span>
                      </div>

                      <div className={styles.fieldRow}>
                        <span className={styles.fieldLabel}>Submitted Date:</span>
                        <span className={styles.fieldValue}>
                          {new Date(g.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>

                      {g.resolution && (
                        <div className={styles.notesBox}>
                          <strong>Resolution Details:</strong> {g.resolution}
                        </div>
                      )}
                    </div>

                    <div className={styles.cardFooter}>
                      <button
                        className={styles.reviewBtn}
                        onClick={() => {
                          setSelectedItem(g);
                          setModalType('grievance');
                          setNewStatus(g.status || 'Resolved');
                          setResolutionNotes(g.resolution || '');
                        }}
                      >
                        Resolve & Respond
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* REVIEW MODAL */}
        <AnimatePresence>
          {selectedItem && modalType && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={styles.modalOverlay}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className={styles.modalCard}
              >
                <div className={styles.modalHeader}>
                  <h3>
                    {modalType === 'request' ? 'Review Data Request' : 'Resolve Privacy Grievance'}
                  </h3>
                  <button onClick={() => { setSelectedItem(null); setModalType(null); }} className={styles.closeBtn}>
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleUpdateStatus}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Select New Status</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className={styles.select}
                    >
                      {modalType === 'request' ? (
                        <>
                          <option value="Under Review">Under Review</option>
                          <option value="Approved">Approved</option>
                          <option value="Completed">Completed</option>
                          <option value="Rejected">Rejected</option>
                        </>
                      ) : (
                        <>
                          <option value="In Review">In Review</option>
                          <option value="Resolved">Resolved</option>
                          <option value="Rejected">Rejected</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Resolution Notes / Response for Tenant</label>
                    <textarea
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      rows={4}
                      placeholder="Add notes for tenant explaining resolution or reason..."
                      className={styles.textarea}
                    />
                  </div>

                  <div className={styles.modalActions}>
                    <button
                      type="button"
                      onClick={() => { setSelectedItem(null); setModalType(null); }}
                      className={styles.cancelBtn}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isUpdating}
                      className={styles.submitBtn}
                    >
                      {isUpdating ? 'Saving...' : 'Save & Update'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ProtectedRoute>
  );
}

export default function PrivacyOwnerPage() {
  return (
    <Suspense fallback={<div style={{ padding: '20px' }}>Loading Privacy Page...</div>}>
      <PrivacyOwnerPageContent />
    </Suspense>
  );
}
