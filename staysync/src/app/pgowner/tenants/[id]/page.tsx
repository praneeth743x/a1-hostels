"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getTenantById, updateTenantBasicDetails, updateTenantStatus, getTenantPayments } from '@/app/actions/pgowner';
import styles from './tenantDetails.module.css';
import { Bell, Download, MoreVertical, Phone, Mail, MapPin, Briefcase, Building2, Calendar, ArrowLeft, Edit, LogIn, LogOut, Clock, Plus, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TenantDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = React.use(params);
  const [tenant, setTenant] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Basic Details');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [noticeDate, setNoticeDate] = useState('');
  const [editData, setEditData] = useState({
    fullName: '',
    mobile: '',
    email: '',
    moveInDate: '',
    checkOutDate: ''
  });
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [isPaymentsLoading, setIsPaymentsLoading] = useState(true);

  const handleEditClick = () => {
    setEditData({
      fullName: tenant?.full_name || '',
      mobile: tenant?.mobile || '',
      email: tenant?.email || '',
      moveInDate: tenant?.move_in_date || (tenant?.created_at ? new Date(tenant.created_at).toISOString().split('T')[0] : ''),
      checkOutDate: tenant?.check_out_date || (tenant?.created_at ? new Date(new Date(tenant.created_at).getTime() + 365*24*60*60*1000).toISOString().split('T')[0] : '')
    });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    setIsSaving(true);
    const res = await updateTenantBasicDetails(resolvedParams.id, editData);
    if (res.success) {
      setTenant({
        ...tenant,
        full_name: editData.fullName,
        mobile: editData.mobile,
        email: editData.email,
        move_in_date: editData.moveInDate,
        check_out_date: editData.checkOutDate
      });
      setIsEditing(false);
    } else {
      alert("Failed to update details: " + res.error);
    }
    setIsSaving(false);
  };

  const handleVacate = async () => {
    setShowMenu(false);
    if (!window.confirm('Are you sure you want to vacate this tenant?')) return;
    setIsUpdatingStatus(true);
    const res = await updateTenantStatus(resolvedParams.id, 'vacated');
    if (res.success) {
      setTenant({...tenant, status: 'vacated', is_active: false});
    } else {
      alert("Failed to update status");
    }
    setIsUpdatingStatus(false);
  };
  
  const handleNoticePeriodClick = () => {
    setShowMenu(false);
    setNoticeDate('');
    setShowNoticeModal(true);
  };

  const confirmNoticePeriod = async () => {
    if (!noticeDate) return;
    setIsUpdatingStatus(true);
    const d = new Date(noticeDate);
    const res = await updateTenantStatus(resolvedParams.id, 'notice_period', { check_out_date: d.toISOString() });
    if (res.success) {
      setTenant({...tenant, status: 'notice_period', check_out_date: d.toISOString()});
      setShowNoticeModal(false);
    } else {
      alert("Failed to update status");
    }
    setIsUpdatingStatus(false);
  };
  
  const handleUndoNoticePeriod = async () => {
    setShowMenu(false);
    setIsUpdatingStatus(true);
    const res = await updateTenantStatus(resolvedParams.id, 'active', { check_out_date: null });
    if (res.success) {
      setTenant({...tenant, status: 'active', check_out_date: null});
    } else {
      alert("Failed to update status");
    }
    setIsUpdatingStatus(false);
  };

  useEffect(() => {
    async function load() {
      const res = await getTenantById(resolvedParams.id);
      if (res.success && res.data) {
        setTenant(res.data);
      }
      setIsLoading(false);
      
      const paymentsRes = await getTenantPayments(resolvedParams.id);
      if (paymentsRes.success && paymentsRes.data) {
        setPaymentHistory(paymentsRes.data);
      }
      setIsPaymentsLoading(false);
    }
    load();
  }, [resolvedParams.id]);

  if (isLoading) return <div className={styles.tdRevampedContainer} style={{ padding: '20px', textAlign: 'center', paddingTop: '100px' }}>Loading...</div>;
  if (!tenant) return <div className={styles.tdRevampedContainer} style={{ padding: '20px', textAlign: 'center', paddingTop: '100px' }}>Tenant not found.</div>;

  return (
    <div className={styles.tdRevampedContainer}>
      {/* Top Navigation Custom Header */}
      <header className={styles.tdCustomHeader}>
        <button onClick={() => router.back()} className={styles.tdIconButton}>
          <ArrowLeft size={24} />
        </button>
        <h1 className={styles.tdHeaderTitle}>Tenant Details</h1>
        <button className={styles.tdIconButton}>
          <Bell size={20} />
        </button>
      </header>

      {/* Main Profile Card */}
      <div className={styles.tdMainCardWrapper}>
        <div className={styles.tdMainCard}>
          <div className={styles.tdProfileSection}>
            <div className={styles.tdProfileLeft}>
              <div className={styles.tdAvatarCircle}>
                {tenant.full_name?.charAt(0).toUpperCase()}
              </div>
              <div className={styles.tdProfileInfo}>
                <h2>{tenant.full_name?.length > 10 ? tenant.full_name.substring(0, 8) + '...' : tenant.full_name}</h2>
                <p>Room {tenant.room?.room_number || 'N/A'}</p>
                <div className={styles.tdPillsWrapper}>
                  <span className={tenant.is_active === false ? styles.tdBadgeDarkBlue : tenant.status === 'notice_period' ? styles.tdBadgeTeal : styles.tdBadgeGreen}>
                    {tenant.is_active === false ? 'VACATED' : tenant.status === 'notice_period' ? 'NOTICE PERIOD' : 'ACTIVE'}
                  </span>
                  <span className={styles.tdBadgeDarkBlue}>Paid</span>
                </div>
              </div>
            </div>
            <div className={styles.tdActionButtons}>
              <button className={styles.tdActionBtn}><Bell size={16} /></button>
              <div style={{ position: 'relative' }}>
                <button className={styles.tdActionBtn} onClick={() => setShowMenu(!showMenu)} disabled={isUpdatingStatus}>
                  {isUpdatingStatus ? <Loader2 size={16} className="animate-spin" /> : <MoreVertical size={16} />}
                </button>
                <AnimatePresence>
                  {showMenu && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      style={{ position: 'absolute', top: '100%', right: 0, background: '#fff', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: '8px', zIndex: 100, minWidth: '180px', marginTop: '8px', border: '1px solid #e2e8f0' }}
                    >
                      <button onClick={handleVacate} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '0.85rem', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: '4px', marginBottom: '4px', color: '#ef4444', fontWeight: 500 }}>Vacate Tenant</button>
                      {tenant.status === 'notice_period' ? (
                        <button onClick={handleUndoNoticePeriod} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '0.85rem', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: '4px', color: '#10b981', fontWeight: 500 }}>Undo Notice Period</button>
                      ) : (
                        <button onClick={handleNoticePeriodClick} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '0.85rem', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: '4px', color: '#334155', fontWeight: 500 }}>Mark Notice Period</button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {showNoticeModal && (
              <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  style={{ background: '#fff', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '400px' }}
                >
                  <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#1e293b' }}>Mark Notice Period</h3>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: '#475569' }}>When will the tenant vacate?</label>
                  <input 
                    type="date" 
                    value={noticeDate}
                    onChange={(e) => setNoticeDate(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '20px', outline: 'none' }}
                  />
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button onClick={() => setShowNoticeModal(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={confirmNoticePeriod} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#4f46e5', color: '#fff', cursor: 'pointer' }} disabled={!noticeDate || isUpdatingStatus}>{isUpdatingStatus ? 'Saving...' : 'Confirm'}</button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <div className={styles.tdThinDivider}></div>

          <div className={styles.tdRentSection}>
            <div className={styles.tdRentItem}>
              <span className={styles.tdRentLabel}>Monthly Rent</span>
              <span className={styles.tdRentValue}>₹8000</span>
            </div>
            <div className={styles.tdRentItem} style={{ textAlign: 'right' }}>
              <span className={styles.tdRentLabel}>Security Deposit</span>
              <span className={styles.tdRentValue}>₹0</span>
            </div>
          </div>

          <div className={styles.tdThinDivider}></div>

          <div className={styles.tdAppStatusRow}>
            <span className={styles.tdAppStatusText}>Tenant app installed</span>
            <span className={styles.tdBadgeTeal}>Inactive</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className={styles.tdNewTabs}>
        {['Basic Details', 'Profile Details', 'Payment History', 'Activity Logs'].map((tab) => (
          <div 
            key={tab} 
            className={`${styles.tdNewTab} ${activeTab === tab ? styles.tdNewTabActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </div>
        ))}
      </div>

      {/* Tab Content */}
      <div className={styles.tdNewContentWrapper}>
        {activeTab === 'Basic Details' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={styles.tdNewContentCard}>
            <h3 className={styles.tdNewCardTitle}>Personal Information</h3>
            
            {isEditing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '4px', display: 'block' }}>Full Name</label>
                  <input 
                    type="text" 
                    value={editData.fullName}
                    onChange={(e) => setEditData({...editData, fullName: e.target.value})}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '4px', display: 'block' }}>Phone</label>
                  <input 
                    type="text" 
                    value={editData.mobile}
                    onChange={(e) => setEditData({...editData, mobile: e.target.value})}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '4px', display: 'block' }}>Email</label>
                  <input 
                    type="email" 
                    value={editData.email}
                    onChange={(e) => setEditData({...editData, email: e.target.value})}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className={styles.tdNewInfoRow}>
                  <Phone size={18} className={styles.tdNewInfoIcon} />
                  <div className={styles.tdNewInfoContent}>
                    <div className={styles.tdNewInfoLabel}>Phone</div>
                    <div className={styles.tdNewInfoValue}>{tenant.mobile || '-'}</div>
                  </div>
                </div>
                
                <div className={styles.tdNewInfoRow}>
                  <Mail size={18} className={styles.tdNewInfoIcon} />
                  <div className={styles.tdNewInfoContent}>
                    <div className={styles.tdNewInfoLabel}>Email</div>
                    <div className={styles.tdNewInfoValue}>{tenant.email || '-'}</div>
                  </div>
                </div>
              </>
            )}
            
            <div className={styles.tdNewInfoRow}>
              <MapPin size={18} className={styles.tdNewInfoIcon} />
              <div className={styles.tdNewInfoContent}>
                <div className={styles.tdNewInfoLabel}>Permanent Address</div>
                <div className={styles.tdNewInfoValue}>Hyderabad, Telangana, India</div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'Profile Details' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className={styles.tdNewContentCard}>
              <h3 className={styles.tdNewCardTitle}>Stay Details</h3>
              
              <div className={styles.tdNewInfoRow}>
                <Calendar size={18} className={styles.tdNewInfoIcon} />
                <div className={styles.tdNewInfoContent}>
                  <div className={styles.tdNewInfoLabel}>Stay Type</div>
                  <div className={styles.tdNewInfoValue}>Monthly</div>
                </div>
              </div>
              
              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px', marginLeft: '34px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '4px', display: 'block' }}>Check-In Date</label>
                    <input 
                      type="date" 
                      value={editData.moveInDate}
                      onChange={(e) => setEditData({...editData, moveInDate: e.target.value})}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.tdNewInfoRow}>
                    <LogIn size={18} className={styles.tdNewInfoIcon} />
                    <div className={styles.tdNewInfoContent}>
                      <div className={styles.tdNewInfoLabel}>Check-In</div>
                      <div className={styles.tdNewInfoValue}>
                        {tenant.move_in_date 
                          ? new Date(tenant.move_in_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                          : tenant.created_at ? new Date(tenant.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                      </div>
                    </div>
                  </div>
                </>
              )}
              
              <div className={styles.tdNewInfoRow}>
                <Clock size={18} className={styles.tdNewInfoIcon} />
                <div className={styles.tdNewInfoContent}>
                  <div className={styles.tdNewInfoLabel}>Duration</div>
                  <div className={styles.tdNewInfoValue}>
                    {(() => {
                      if (!tenant.move_in_date && !tenant.created_at) return '-';
                      const startDate = new Date(tenant.move_in_date || tenant.created_at);
                      const today = new Date();
                      let months = (today.getFullYear() - startDate.getFullYear()) * 12 + today.getMonth() - startDate.getMonth();
                      if (today.getDate() < startDate.getDate()) months--;
                      if (months <= 0) {
                        const diffDays = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                        return diffDays > 0 ? `${diffDays} days` : 'Just joined';
                      }
                      return `${months} month${months > 1 ? 's' : ''}`;
                    })()}
                  </div>
                </div>
              </div>
              
              <div className={styles.tdNewInfoRow}>
                <Building2 size={18} className={styles.tdNewInfoIcon} />
                <div className={styles.tdNewInfoContent}>
                  <div className={styles.tdNewInfoLabel}>Room</div>
                  <div className={styles.tdNewInfoValue}>{tenant.room?.room_number || '-'} - Standard</div>
                </div>
              </div>
            </div>

            <div className={styles.tdNewContentCard}>
              <h3 className={styles.tdNewCardTitle}>ID Proofs</h3>
              <div className={styles.tdIdProofsGrid}>
                <div className={styles.tdIdProofItem}>
                  <div className={styles.tdIdProofImage}></div>
                  <span className={styles.tdIdProofLabel}>Govt ID Front</span>
                </div>
                <div className={styles.tdIdProofItem}>
                  <div className={styles.tdIdProofImage}></div>
                  <span className={styles.tdIdProofLabel}>Govt ID Back</span>
                </div>
                <div className={styles.tdIdProofItem}>
                  <div className={styles.tdIdProofImage}></div>
                  <span className={styles.tdIdProofLabel}>Photo</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'Payment History' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className={styles.tdNewContentCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 className={styles.tdNewCardTitle} style={{ marginBottom: 0 }}>Fee Payment History</h3>
                <button className={styles.tdPrimaryButton} style={{ padding: '8px 16px', fontSize: '0.85rem', width: 'auto' }}>
                  Add Payment
                </button>
              </div>
              
              {isPaymentsLoading ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>Loading history...</div>
              ) : paymentHistory.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>No payment history found.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {paymentHistory.map((payment, idx) => {
                    // Analytics Calculation
                    let analysisText = '';
                    let analysisColor = '#64748b'; // default gray
                    
                    if (tenant?.move_in_date) {
                      const paymentDate = new Date(payment.payment_date || payment.created_at);
                      paymentDate.setHours(0, 0, 0, 0);
                      
                      let dueDate = new Date(paymentDate);
                      
                      if (payment.month) {
                        // e.g. "January 2026"
                        const parsedMonth = new Date(payment.month);
                        if (!isNaN(parsedMonth.getTime())) {
                          dueDate = new Date(parsedMonth.getFullYear(), parsedMonth.getMonth(), 1);
                        }
                      }
                      
                      const moveInDay = new Date(tenant.move_in_date).getDate();
                      dueDate.setDate(moveInDay);
                      dueDate.setHours(0, 0, 0, 0);
                      
                      const diffTime = paymentDate.getTime() - dueDate.getTime();
                      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                      
                      if (diffDays === 0) {
                        analysisText = 'Paid on time';
                        analysisColor = '#10b981'; // Green
                      } else if (diffDays > 0) {
                        analysisText = `Paid ${diffDays} day${diffDays > 1 ? 's' : ''} late`;
                        analysisColor = '#ef4444'; // Red
                      } else {
                        const earlyDays = Math.abs(diffDays);
                        analysisText = `Paid ${earlyDays} day${earlyDays > 1 ? 's' : ''} before`;
                        analysisColor = '#10b981'; // Green
                      }
                    }

                    return (
                      <div key={idx} className={styles.tdPaymentCard} style={{ position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <h4 className={styles.tdPaymentAmount}>₹{payment.amount_paid || payment.amount}</h4>
                            <p className={styles.tdPaymentDate}>
                              Paid on {new Date(payment.payment_date || payment.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} 
                              {payment.month ? ` • For ${payment.month}` : ''}
                            </p>
                          </div>
                          <div className={styles.tdPaymentBadge}>Success</div>
                        </div>
                        {analysisText && (
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: analysisColor, marginTop: '8px' }}>
                            {analysisText}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
        
        {activeTab === 'Activity Logs' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={styles.tdNewContentCard} style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
            No activity logs found.
          </motion.div>
        )}
      </div>

      {/* Floating Action Button (Only show on Basic Details or Profile Details if needed, but screenshot shows it on Basic Details) */}
      {(activeTab === 'Basic Details' || activeTab === 'Profile Details') && !isEditing && (
        <div className={styles.tdFixedBottomBtnWrapper}>
          <button className={styles.tdFixedBottomBtn} onClick={handleEditClick}>
            <Edit size={18} /> Edit Basic Details
          </button>
        </div>
      )}
      
      {isEditing && (
        <div className={styles.tdFixedBottomBtnWrapper} style={{ display: 'flex', gap: '12px' }}>
          <button 
            className={styles.tdFixedBottomBtn} 
            style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#64748b' }}
            onClick={() => setIsEditing(false)}
          >
            Cancel
          </button>
          <button 
            className={styles.tdFixedBottomBtn} 
            style={{ flex: 1 }}
            onClick={handleSaveEdit}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}
