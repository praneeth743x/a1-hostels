"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Phone, Shield, Building, CreditCard, MapPin, Users, Camera, Edit2, Monitor, LogOut, Loader2, ChevronLeft, Home, Building2, ClipboardList, History, LifeBuoy, Wallet, Mail, Activity, KeyRound, Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, updatePassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, collection, onSnapshot } from 'firebase/firestore';
import { rpcCall } from '@/lib/rpc';
import { FloatingInput } from '@/components/FloatingInput';
import { AnimatedButton } from '@/components/AnimatedButton';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TenantPrivacySection } from '@/components/TenantPrivacySection';
import { resetTenantPasswordAdmin } from '@/app/actions/tenant';
import styles from './profile.module.css';

export function ProfileView() {
  const [profile, setProfile] = useState<any>(() => {
    const user = auth.currentUser;
    return user ? { full_name: user.displayName || 'Owner', phone: user.phoneNumber || 'N/A' } : null;
  });
  const [devices, setDevices] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const [cachedRole, setCachedRole] = useState('PG Owner');

  // Password reset state
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);
  const [resetStatus, setResetStatus] = useState<{ type: 'success' | 'error' | null; msg: string }>({ type: null, msg: '' });

  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const role = localStorage.getItem('userRole');
      if (role === 'tenant') setCachedRole('Tenant');
      else if (role === 'super_admin') setCachedRole('Super Admin');
    }
    
    let unbindDeviceDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/');
        return;
      }
      setProfile((prev: any) => ({ ...prev, phone: user.phoneNumber || prev?.phone || 'N/A' }));

      // Ensure device is registered
      let deviceId = localStorage.getItem('deviceId');
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const deviceName = isMobile ? 'Mobile App' : 'Web Browser';
      
      if (!deviceId) {
        deviceId = Math.random().toString(36).substring(2, 15);
        localStorage.setItem('deviceId', deviceId);
      }
      await rpcCall('registerDevice', user.uid, deviceId, deviceName);

      const role = localStorage.getItem('userRole');
      
      if (role !== 'tenant') {
        // 1. Real-time Listener on THIS device's session status
        const deviceRef = doc(db, 'users', user.uid, 'devices', deviceId);
        unbindDeviceDoc = onSnapshot(
          deviceRef, 
          (snapshot) => {
            if (!snapshot.exists()) {
              localStorage.clear();
              sessionStorage.clear();
              auth.signOut().then(() => router.push('/'));
            }
          },
          (error) => {
            if (error.code !== 'permission-denied') {
              console.warn('Profile device listener error:', error.code);
            }
          }
        );

        // The real-time listener for ALL devices might be blocked by security rules.
        // We will fetch them securely via RPC instead.
        rpcCall('getUserDevices', user.uid).then(res => {
          if (res.success && res.data) {
            setDevices(res.data);
          }
        });
      }

      try {
        const profileRes = await rpcCall('getUserProfile', user.uid, user.email || '');
        if (profileRes.success) {
          const userProfile = profileRes.data;
          setProfile({
            ...userProfile,
            phone: userProfile?.mobile || userProfile?.phone || user.phoneNumber || 'Not Provided',
            email: userProfile?.email || user.email || 'Not Provided',
            aadhar: userProfile?.aadhar || 'Not Provided',
            location: userProfile?.location || 'Not Provided',
            parent_details: userProfile?.parent_details || 'Not Provided',
          });
          setEditForm({
            full_name: userProfile?.full_name || '',
            aadhar: userProfile?.aadhar || '',
            location: userProfile?.location || '',
            parent_details: userProfile?.parent_details || ''
          });
          
          try {
            const logsRes = await rpcCall('getActivityLogsAction', user.uid);
            if (logsRes.success && logsRes.data) {
              setActivityLogs(logsRes.data);
            }
          } catch (err) {
            console.warn("Failed to load activity logs:", err);
          }
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unbindDeviceDoc) unbindDeviceDoc();
    };
  }, [router]);

  const handleSave = async () => {
    setIsSaving(true);
    if (auth.currentUser) {
      await rpcCall('updateUserProfile', auth.currentUser.uid, editForm);
      setProfile({ ...profile, ...editForm });
    }
    setIsEditing(false);
    setIsSaving(false);
  };

  const handleSignOutDevice = async (deviceId: string) => {
    if (!auth.currentUser) return;
    
    const currentDeviceId = localStorage.getItem('deviceId');
    if (deviceId === currentDeviceId) {
      // Signing out current device
      localStorage.clear();
      sessionStorage.clear();
      sessionStorage.setItem('loggedOut', 'true');
      await auth.signOut();
      window.location.href = '/';
    } else {
      // Signing out remote device
      await rpcCall('removeDevice', auth.currentUser.uid, deviceId);
      setDevices(prev => prev.filter(d => d.deviceId !== deviceId));
    }
  };

  const handleLogoutAll = async () => {
    if (!auth.currentUser) return;
    // Remove all devices from DB
    await Promise.all(devices.map(d => rpcCall('removeDevice', auth.currentUser!.uid, d.deviceId)));
    
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem('loggedOut', 'true');
    await auth.signOut();
    window.location.href = '/';
  };

  const handleDirectPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetStatus({ type: null, msg: '' });

    if (!newPasswordInput || newPasswordInput.length < 6) {
      setResetStatus({ type: 'error', msg: 'Password must be at least 6 characters long.' });
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setResetStatus({ type: 'error', msg: 'Passwords do not match.' });
      return;
    }

    setIsResetSubmitting(true);
    try {
      if (auth.currentUser) {
        try {
          await updatePassword(auth.currentUser, newPasswordInput);
          setResetStatus({ type: 'success', msg: 'Password updated successfully! 🎉' });
          setNewPasswordInput('');
          setConfirmPasswordInput('');
          setIsResetSubmitting(false);
          return;
        } catch (firebaseErr: any) {
          console.warn("Client updatePassword error, falling back to Server Admin:", firebaseErr?.code || firebaseErr?.message);
        }
      }

      // Fallback via Admin Auth Action
      const targetEmail = profile?.email || auth.currentUser?.email;
      if (!targetEmail) {
        setResetStatus({ type: 'error', msg: 'No email found for account.' });
        setIsResetSubmitting(false);
        return;
      }

      const res = await resetTenantPasswordAdmin(targetEmail, newPasswordInput);
      if (res.success) {
        setResetStatus({ type: 'success', msg: 'Password updated successfully! 🎉' });
        setNewPasswordInput('');
        setConfirmPasswordInput('');
      } else {
        setResetStatus({ type: 'error', msg: res.error || 'Failed to update password.' });
      }
    } catch (err: any) {
      console.error("Failed to reset password:", err);
      setResetStatus({ type: 'error', msg: err?.message || 'Failed to reset password.' });
    } finally {
      setIsResetSubmitting(false);
    }
  };

  const handleSendResetEmail = async () => {
    setResetStatus({ type: null, msg: '' });
    const targetEmail = profile?.email || auth.currentUser?.email;
    if (!targetEmail || targetEmail === 'Not Provided') {
      setResetStatus({ type: 'error', msg: 'No registered email address found for this account.' });
      return;
    }

    setIsSendingResetEmail(true);
    try {
      await sendPasswordResetEmail(auth, targetEmail);
      setResetStatus({ type: 'success', msg: `Password reset link sent to ${targetEmail}! Check your inbox.` });
    } catch (err: any) {
      console.warn("sendPasswordResetEmail error:", err);
      setResetStatus({ type: 'error', msg: err?.message || 'Failed to send password reset email.' });
    } finally {
      setIsSendingResetEmail(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: '#f8fafc' }}>
        <Loader2 className="animate-spin text-blue-500" size={36} />
      </div>
    );
  }

  const isTenant = profile?.role ? profile.role === 'tenant' : cachedRole === 'Tenant';

  // If the fetched role differs from the cached role, update localStorage to fix any stale cache
  useEffect(() => {
    if (profile?.role && typeof window !== 'undefined') {
      const currentCache = localStorage.getItem('userRole');
      if (currentCache !== profile.role) {
        localStorage.setItem('userRole', profile.role);
        if (profile.role === 'pg_owner') setCachedRole('PG Owner');
        else if (profile.role === 'tenant') setCachedRole('Tenant');
        else if (profile.role === 'super_admin') setCachedRole('Super Admin');
      }
    }
  }, [profile?.role]);

  return (
    <div className={styles.profilePage} style={{ paddingBottom: '20px' }}>


      <div className={styles.pageHeader}>
        <div>
          <p className={styles.pageSubtitle}>Manage your account and active device sessions</p>
        </div>
        {profile?.role === 'super_admin' && !isEditing && (
          <button onClick={() => setIsEditing(true)} className={styles.editBtn}>
            <Edit2 size={14} /> Edit Profile
          </button>
        )}
      </div>

      <motion.div 
        className={styles.profileCard}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className={styles.cardDecoration}></div>

        <div className={styles.profileLayout}>
          <div className={styles.photoSection}>
            <div className={styles.photoCircle}>
              {profile?.photo_url ? (
                <img src={profile.photo_url} alt="Profile" className={styles.photoImage} />
              ) : (
                <User size={32} />
              )}
              {isEditing && (
                <div className={styles.photoOverlay}>
                  <Camera color="white" size={18} />
                </div>
              )}
            </div>
            <span className={styles.photoLabel}>Profile Photo</span>
          </div>
          
          <div className={styles.detailsSection}>
            <div className={styles.nameBlock}>
              {isEditing ? (
                <div className={styles.editFormGroup}>
                  <FloatingInput label="Full Name" value={editForm.full_name} onChange={e => setEditForm({...editForm, full_name: e.target.value})} />
                </div>
              ) : (
                <h2 className={styles.userName}>{profile?.full_name || 'System User'}</h2>
              )}
              
              {!isEditing && (
                <div className={styles.badges}>
                  <span className={styles.roleBadge}>
                    <Shield size={12} />
                    {profile?.role?.replace('_', ' ') || cachedRole}
                  </span>
                  <span className={styles.statusBadge}>
                    Active
                  </span>
                </div>
              )}
            </div>

            <div className={styles.gridDetails}>
              <div className={styles.detailItem}>
                <div className={styles.detailLabel}><Phone size={13} /> Mobile Number</div>
                <div className={styles.detailValue}>{profile?.phone}</div>
              </div>

              <div className={styles.detailItem}>
                <div className={styles.detailLabel}><Mail size={13} /> Email Address</div>
                <div className={styles.detailValue}>{profile?.email}</div>
              </div>
              
              <div className={styles.detailItem}>
                <div className={styles.detailLabel}><CreditCard size={13} /> Aadhar Identity</div>
                {isEditing ? (
                  <div className={styles.editFormGroup}>
                    <FloatingInput label="Aadhar Number" value={editForm.aadhar} onChange={e => setEditForm({...editForm, aadhar: e.target.value})} />
                  </div>
                ) : (
                  <div className={styles.detailValue}>{profile?.aadhar}</div>
                )}
              </div>

              <div className={styles.detailItem}>
                <div className={styles.detailLabel}><MapPin size={13} /> Location / Address</div>
                {isEditing ? (
                  <div className={styles.editFormGroup}>
                    <FloatingInput label="Location" value={editForm.location} onChange={e => setEditForm({...editForm, location: e.target.value})} />
                  </div>
                ) : (
                  <div className={styles.detailValue}>{profile?.location}</div>
                )}
              </div>

              {isTenant && (
                <div className={styles.detailItem}>
                  <div className={styles.detailLabel}><Users size={13} /> Parent Details</div>
                  {isEditing ? (
                    <div className={styles.editFormGroup}>
                      <FloatingInput label="Parent Info" value={editForm.parent_details} onChange={e => setEditForm({...editForm, parent_details: e.target.value})} />
                    </div>
                  ) : (
                    <div className={styles.detailValue}>{profile?.parent_details}</div>
                  )}
                </div>
              )}
              
              {!isEditing && (
                <div className={styles.detailItem}>
                  <div className={styles.detailLabel}><Building size={13} /> Account Created</div>
                  <div className={styles.detailValue}>
                    {new Date(profile?.created_at || Date.now()).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </div>
                </div>
              )}
            </div>

            {isEditing && (
              <div className={styles.actionsSection}>
                <AnimatedButton onClick={handleSave} isLoading={isSaving} className="flex-1">
                  Save Changes
                </AnimatedButton>
                <button onClick={() => setIsEditing(false)} className={styles.cancelBtn}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* PASSWORD & SECURITY SECTION CARD */}
      <motion.div 
        className={styles.profileCard}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 className={styles.userName} style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <KeyRound className="text-amber-600" size={18} /> Security & Password
            </h2>
            <p className={styles.pageSubtitle} style={{ marginTop: '4px', marginBottom: 0 }}>
              Request an official password reset link sent directly to your registered email address.
            </p>
          </div>

          <button 
            type="button"
            onClick={handleSendResetEmail}
            disabled={isSendingResetEmail}
            className={styles.editBtn}
            style={{ background: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, padding: '10px 18px', borderRadius: '12px', cursor: 'pointer' }}
          >
            {isSendingResetEmail ? <Loader2 className="animate-spin" size={16} /> : <Mail size={16} />}
            Send Reset Email Link
          </button>
        </div>

        {resetStatus.type === 'success' && (
          <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#047857', padding: '12px 16px', borderRadius: '12px', marginTop: '14px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', fontWeight: 600 }}>
            <CheckCircle2 size={16} /> {resetStatus.msg}
          </div>
        )}

        {resetStatus.type === 'error' && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', padding: '12px 16px', borderRadius: '12px', marginTop: '14px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', fontWeight: 600 }}>
            <AlertCircle size={16} /> {resetStatus.msg}
          </div>
        )}
      </motion.div>

      {/* TEAM MEMBER PERMISSIONS & HOSTELS CARD */}
      {profile?.role === 'team_member' && (
        <motion.div 
          className={styles.profileCard}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <h2 className={styles.userName} style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Shield className="text-indigo-600" size={18} /> Staff Permissions & Assigned Hostels
          </h2>

          {/* Assigned Hostels */}
          <div style={{ marginBottom: '16px' }}>
            <div className={styles.detailLabel} style={{ marginBottom: '6px' }}><Building size={13} /> Assigned Hostels</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {profile?.assigned_properties && profile.assigned_properties.length > 0 ? (
                profile.assigned_properties.map((pId: string) => (
                  <span key={pId} style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', padding: '6px 14px', borderRadius: '14px', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Building size={14} /> Assigned Hostel Property
                  </span>
                ))
              ) : (
                <span style={{ fontSize: '0.82rem', color: '#64748B' }}>All Owner Hostels</span>
              )}
            </div>
          </div>

          {/* Active Feature Permissions */}
          <div>
            <div className={styles.detailLabel} style={{ marginBottom: '8px' }}><Shield size={13} /> Active Feature Permissions</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {Object.entries(profile?.permissions || {}).map(([key, val]) => {
                if (!val || key === 'printReceipts') return null;
                let displayLabel = key;
                if (key === 'viewHistory') displayLabel = 'View History & Print Receipts';
                else if (key === 'viewDashboard') displayLabel = 'View Dashboard';
                else if (key === 'viewTenants') displayLabel = 'View Tenants (Read Only)';
                else if (key === 'manageTenants') displayLabel = 'View & Manage Tenants';
                else if (key === 'viewRooms') displayLabel = 'View Rooms (Read Only)';
                else if (key === 'manageRooms') displayLabel = 'View & Manage Rooms';
                else if (key === 'collectPayments') displayLabel = 'Collect Payments & Dues';
                else if (key === 'generateDues') displayLabel = 'Generate Rent Dues';
                else if (key === 'resolveComplaints') displayLabel = 'Resolve Complaints';
                else if (key === 'viewReports') displayLabel = 'View Reports & Analytics';
                else if (key === 'addExpense') displayLabel = 'Manage Expenses';
                else if (key === 'editMenu') displayLabel = 'Edit Food Menu';
                else if (key === 'createNotices') displayLabel = 'Create Notices';
                else if (key === 'sendWhatsAppMessages') displayLabel = 'Send WhatsApp Suite';

                return (
                  <span key={key} style={{ background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE', padding: '6px 12px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700 }}>
                    ✓ {displayLabel}
                  </span>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* TENANT PRIVACY & DATA SECTION */}
      {(cachedRole === 'Tenant' || profile?.role === 'tenant') && auth.currentUser && (
        <TenantPrivacySection tenantUid={auth.currentUser.uid} pgId={profile?.pg_id} />
      )}

      {/* ACTIVE SESSIONS SECTION */}
      <motion.div 
        className={styles.profileCard}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2 className={styles.userName} style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Monitor className="text-blue-500" size={18} /> Active Sessions ({devices.length})
        </h2>
        <p className={styles.pageSubtitle} style={{ marginTop: '-8px' }}>
          Manage logged in devices. Revoking a session will log out that device immediately in real-time.
        </p>

        <div className={styles.devicesList}>
          {devices.map((device, index) => {
            const isCurrentDevice = typeof window !== 'undefined' && localStorage.getItem('deviceId') === device.deviceId;
            return (
              <div key={index} className={styles.deviceItem}>
                <div className={styles.deviceInfo}>
                  <div className={styles.deviceIconBox}>
                    <Monitor size={16} />
                  </div>
                  <div>
                    <div className={styles.deviceName}>
                      {device.deviceName || 'Unknown Device'} 
                      {isCurrentDevice && <span className={styles.currentDeviceBadge}>This Device</span>}
                    </div>
                    <div className={styles.deviceMeta}>
                      Last Active: {new Date(device.lastActive || Date.now()).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
                <button 
                  className={styles.signOutDeviceBtn}
                  onClick={() => handleSignOutDevice(device.deviceId)}
                >
                  <LogOut size={12} /> Sign out
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleLogoutAll} className={styles.logoutBtn}>
            Sign Out All Devices
          </button>
        </div>
      </motion.div>
      {/* ACTIVITY LOGS SECTION */}
      <motion.div 
        className={styles.profileCard}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
          <h2 className={styles.userName} style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Activity className="text-blue-500" size={18} /> Recent Activity
          </h2>
          
          {activityLogs.length === 0 ? (
            <p className={styles.pageSubtitle}>No recent activity found.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activityLogs.map((log: any, index: number) => (
                <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', paddingBottom: '12px', borderBottom: index < activityLogs.length - 1 ? '1px dashed #e2e8f0' : 'none' }}>
                  <div style={{ padding: '8px', background: '#f1f5f9', borderRadius: '50%', color: '#3b82f6' }}>
                    <History size={14} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: 500 }}>{log.details || log.action || 'Activity Recorded'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                      {log.created_at ? new Date(log.created_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown Date'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
    </div>
  );
}

