"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Home, CreditCard, Bell, User, Phone, Mail, MapPin, Calendar, 
  Loader2, Wallet, ShieldCheck, Receipt, ArrowRight, AlertCircle, 
  CheckCircle2, ChevronRight, ShieldAlert, LogOut, Shield, FileText, Building, KeyRound, Eye, EyeOff, Lock, X,
  MessageSquare, Plus, Send, Zap, Droplet, Sparkles, Wifi, Utensils, Clock, MessageCircle, Settings, Download, AlertTriangle
} from 'lucide-react';
import { AnimatedButton } from '@/components/AnimatedButton';
import Script from 'next/script';
import { createRazorpayOrder, verifyRazorpaySignature } from '@/app/actions/razorpay';
import { getTenantDashboardData } from '@/app/actions/tenant';
import { getTenantComplaints, submitComplaint, addTenantComplaintReply, clearTenantChat } from '@/app/actions/complaints';
import styles from './tenantDashboard.module.css';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function MobileTenantDashboard() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paidDueIds, setPaidDueIds] = useState<Set<string>>(new Set());
  const searchParams = useSearchParams();
  const activeTabFromUrl = searchParams.get('tab') || 'Dashboard';
  const [optimisticTab, setOptimisticTab] = useState<string>(activeTabFromUrl);

  useEffect(() => {
    setOptimisticTab(activeTabFromUrl);
  }, [activeTabFromUrl]);

  const activeTab = optimisticTab;
  const router = useRouter();

  // Complaints state
  const [complaintsList, setComplaintsList] = useState<any[]>([]);
  const [showNewComplaintForm, setShowNewComplaintForm] = useState(false);
  const [newComplaintCat, setNewComplaintCat] = useState('Electrical');
  const [newComplaintUrg, setNewComplaintUrg] = useState('Medium');
  const [newComplaintDesc, setNewComplaintDesc] = useState('');
  const [submittingComplaint, setSubmittingComplaint] = useState(false);
  const [complaintError, setComplaintError] = useState('');
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [complaintReplyInput, setComplaintReplyInput] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // General Chat state (Notices Tab)
  const [selectedChatThreadId, setSelectedChatThreadId] = useState<string | null>(null);
  const [chatReplyInput, setChatReplyInput] = useState('');
  const [sendingChatReply, setSendingChatReply] = useState(false);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [localChatClearedAt, setLocalChatClearedAt] = useState<string | null>(null);
  const effectiveChatClearedAt = localChatClearedAt || dashboardData?.tenant?.chat_cleared_at || null;
  const [showClearChatConfirm, setShowClearChatConfirm] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user || !user.email) {
        setLoading(false);
        return;
      }

      const res = await getTenantDashboardData(user.email);
      if (!res.success) {
        if (res.error === 'ACCOUNT_DISABLED' || res.message?.includes('disabled') || res.message?.includes('suspended')) {
          localStorage.clear();
          sessionStorage.clear();
          const { signOut } = await import('firebase/auth');
          await signOut(auth).catch(() => {});
          window.location.href = '/?error=account_disabled';
          return;
        }
      } else {
        setDashboardData(res.data);
      }

      const compRes = await getTenantComplaints(user.email);
      if (compRes.success) {
        setComplaintsList(compRes.data || []);
      }

      setLoading(false);
    });
    return unsub;
  }, []);

  const globalMessages = React.useMemo(() => {
    const msgs: any[] = [];
    const clearedTime = effectiveChatClearedAt ? new Date(effectiveChatClearedAt).getTime() : 0;
    complaintsList.forEach(c => {
      if (!c.messages || !Array.isArray(c.messages) || c.messages.length === 0) {
        const initTime = new Date(c.created_at || 0).getTime();
        if (initTime > clearedTime && c.description) {
          msgs.push({
            id: `init-${c.id}`,
            sender: 'tenant',
            message: c.description,
            timestamp: c.created_at,
            attachedComplaint: c,
            isInitial: true
          });
        }
      }
      if (c.resolution_comment) {
        const resTime = new Date(c.updated_at || c.created_at).getTime();
        if (resTime > clearedTime) {
          msgs.push({
            id: `res-${c.id}`,
            sender: 'owner',
            message: c.resolution_comment,
            timestamp: c.updated_at || c.created_at,
            attachedComplaint: c,
            isOwnerResolution: true
          });
        }
      }
      if (c.messages) {
        c.messages.forEach((m: any, idx: number) => {
          if (new Date(m.timestamp || 0).getTime() > clearedTime) {
            msgs.push({
              ...m,
              id: `msg-${c.id}-${idx}`,
              attachedComplaint: c
            });
          }
        });
      }
    });
    return msgs.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
  }, [complaintsList, effectiveChatClearedAt]);

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState<boolean>(false);
  const [isGoogleVerified, setIsGoogleVerified] = useState<boolean>(false);
  const [isVerifyingGoogle, setIsVerifyingGoogle] = useState<boolean>(false);
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [modalStatus, setModalStatus] = useState<{ type: 'success' | 'error' | null; msg: string }>({ type: null, msg: '' });
  const [isSubmittingPassword, setIsSubmittingPassword] = useState<boolean>(false);
  const [isSendingReset, setIsSendingReset] = useState<boolean>(false);

  const handleSendResetLink = async () => {
    setModalStatus({ type: null, msg: '' });
    const targetEmail = dashboardData?.tenant?.email || auth.currentUser?.email;
    if (!targetEmail) {
      setModalStatus({ type: 'error', msg: 'No registered email address found for this account.' });
      return;
    }

    setIsSendingReset(true);
    try {
      const { sendPasswordResetAction } = await import('@/app/actions/tenant');
      const res = await sendPasswordResetAction(targetEmail, window.location.origin);
      if (res.success) {
        setModalStatus({ type: 'success', msg: res.message || `Password reset link sent to ${targetEmail}! Check your inbox.` });
      } else {
        setModalStatus({ type: 'error', msg: res.error || 'Failed to send password reset email.' });
      }
    } catch (err: any) {
      console.warn("sendPasswordResetAction error:", err);
      setModalStatus({ type: 'error', msg: 'Failed to send reset email.' });
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleVerifyGoogle = async () => {
    setIsVerifyingGoogle(true);
    setModalStatus({ type: null, msg: '' });
    try {
      const { GoogleAuthProvider, signInWithPopup, reauthenticateWithPopup } = await import('firebase/auth');
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      
      if (auth.currentUser) {
        try {
          await reauthenticateWithPopup(auth.currentUser, provider);
        } catch (reauthErr) {
          console.warn("reauthenticate failed, fallback to signInWithPopup", reauthErr);
          await signInWithPopup(auth, provider);
        }
      } else {
        await signInWithPopup(auth, provider);
      }
      
      setIsGoogleVerified(true);
      setModalStatus({ type: 'success', msg: 'Google identity verified! Set your new password below.' });
    } catch (err: any) {
      console.error("Google verification error:", err);
      setModalStatus({ type: 'error', msg: err?.message || 'Google authentication failed. Please try again.' });
    } finally {
      setIsVerifyingGoogle(false);
    }
  };

  const handleUpdatePasswordInApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setModalStatus({ type: 'error', msg: 'Password must be at least 6 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setModalStatus({ type: 'error', msg: 'Passwords do not match.' });
      return;
    }

    setIsSubmittingPassword(true);
    setModalStatus({ type: null, msg: '' });

    try {
      const targetEmail = tenant?.email || auth.currentUser?.email || 'praneeth743x@gmail.com';
      const { resetTenantPasswordAdmin } = await import('@/app/actions/tenant');
      const res = await resetTenantPasswordAdmin(targetEmail, newPassword);
      if (res.success) {
        setModalStatus({ type: 'success', msg: 'Password updated successfully! 🎉' });
        setTimeout(() => {
          setIsPasswordModalOpen(false);
          setIsGoogleVerified(false);
          setNewPassword('');
          setConfirmPassword('');
          setModalStatus({ type: null, msg: '' });
        }, 1800);
      } else {
        setModalStatus({ type: 'error', msg: res.error || 'Failed to update password.' });
      }
    } catch (err: any) {
      setModalStatus({ type: 'error', msg: err?.message || 'Failed to update password.' });
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { signOut } = await import('firebase/auth');
      await signOut(auth);
    } catch (error) {
      console.error("Error logging out:", error);
    } finally {
      localStorage.clear();
      sessionStorage.clear();
      sessionStorage.setItem('loggedOut', 'true');
      window.location.href = '/';
    }
  };

  useEffect(() => {
    const userEmail = dashboardData?.tenant?.email || auth.currentUser?.email;
    if (userEmail) {
      getTenantComplaints(userEmail).then(res => {
        if (res.success) setComplaintsList(res.data || []);
      });
    }
  }, [dashboardData?.tenant?.email]);

  const complaintCategories = ['Electrical', 'Plumbing', 'Cleaning', 'Internet/WiFi', 'Food', 'Others'];
  const complaintUrgencies = ['Low', 'Medium', 'High'];
  const categoryIcons: Record<string, React.ReactNode> = {
    'Electrical': <Zap size={16} />,
    'Plumbing': <Droplet size={16} />,
    'Cleaning': <Sparkles size={16} />,
    'Internet/WiFi': <Wifi size={16} />,
    'Food': <Utensils size={16} />,
    'Others': <MessageSquare size={16} />
  };

  const handleSubmitComplaint = async () => {
    if (!newComplaintDesc.trim()) {
      setComplaintError('Please describe the issue.');
      return;
    }
    setSubmittingComplaint(true);
    setComplaintError('');
    try {
      const tenantId = dashboardData?.tenant?.tenant_id || dashboardData?.tenant?.id || auth.currentUser?.uid || '';
      const tenantEmail = dashboardData?.tenant?.email || auth.currentUser?.email || '';
      const res = await submitComplaint({
        tenantId,
        tenantEmail,
        category: newComplaintCat,
        urgency: newComplaintUrg,
        description: newComplaintDesc
      });
      if (res.success) {
        setNewComplaintDesc('');
        setShowNewComplaintForm(false);
        const refreshed = await getTenantComplaints(tenantEmail);
        if (refreshed.success) setComplaintsList(refreshed.data || []);
      } else {
        setComplaintError(res.error || 'Failed to submit.');
      }
    } catch (err: any) {
      setComplaintError(err.message || 'Error submitting complaint.');
    } finally {
      setSubmittingComplaint(false);
    }
  };

  const handleSendReply = async () => {
    if (!complaintReplyInput.trim() || !selectedComplaintId) return;
    setSendingReply(true);
    try {
      const tenantName = dashboardData?.tenant?.full_name || 'Tenant';
      await addTenantComplaintReply(selectedComplaintId, complaintReplyInput.trim(), tenantName);
      setComplaintReplyInput('');
      const tenantEmail = dashboardData?.tenant?.email || auth.currentUser?.email || '';
      const refreshed = await getTenantComplaints(tenantEmail);
      if (refreshed.success) setComplaintsList(refreshed.data || []);
    } catch (err) {
      console.error('Reply failed:', err);
    } finally {
      setSendingReply(false);
    }
  };

  const handleSendChatReply = async () => {
    if (!chatReplyInput.trim()) return;
    setSendingChatReply(true);
    try {
      const tenantEmail = dashboardData?.tenant?.email || auth.currentUser?.email || '';
      const tenantName = dashboardData?.tenant?.full_name || 'Tenant';
      
      let targetId = selectedChatThreadId;

      if (!targetId) {
        const res = await submitComplaint({
          tenantId: dashboardData?.tenant?.tenant_id || dashboardData?.tenant?.id || auth.currentUser?.uid || '',
          tenantEmail,
          category: 'General Chat',
          urgency: 'Low',
          description: chatReplyInput.trim()
        });
        if (!res.success) throw new Error(res.error);
      } else {
        await addTenantComplaintReply(targetId, chatReplyInput.trim(), tenantName);
      }

      setChatReplyInput('');
      setSelectedChatThreadId(null);
      setIsAttachMenuOpen(false);
      
      const refreshed = await getTenantComplaints(tenantEmail);
      if (refreshed.success) setComplaintsList(refreshed.data || []);
      
    } catch (err) {
      console.error('Chat send failed:', err);
    } finally {
      setSendingChatReply(false);
    }
  };

  const handlePayment = async (due: any) => {
    setIsProcessing(true);
    setErrorMsg('');
    
    try {
      const amountPaise = due.amount * 100;
      const res = await createRazorpayOrder(amountPaise, due.id);
      if (!res.success) throw new Error(res.error || 'Failed to create order');

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: res.amount,
        currency: res.currency,
        name: "Raliving",
        description: `${due.month} ${due.type === 'opening-fee' ? 'Opening Balance' : 'Rent Payment'}`,
        order_id: res.order_id,
        handler: async function (response: any) {
          try {
            const verifyRes = await verifyRazorpaySignature(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature
            );

            if (verifyRes.success) {
              setPaidDueIds(prev => new Set(prev).add(due.id));
            } else {
              setErrorMsg('Payment verification failed.');
            }
          } catch (err: any) {
            setErrorMsg(err.message || 'Verification error');
          }
        },
        prefill: {
          name: dashboardData?.tenant?.full_name || "Tenant",
          email: auth.currentUser?.email || "",
          contact: dashboardData?.tenant?.mobile || ""
        },
        theme: {
          color: "#4F46E5"
        }
      };

      const rzp1 = new window.Razorpay(options);
      rzp1.on('payment.failed', function (response: any) {
        setErrorMsg(`Payment failed: ${response.error.description}`);
      });
      
      rzp1.open();
      
    } catch (err: any) {
      setErrorMsg(err.message || 'Checkout failed');
    } finally {
      setIsProcessing(false);
    }
  };

function TenantSkeletonLoader() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '70px' }}>
      {/* 1. Greeting Shimmer Card */}
      <div className={styles.skeletonGreeting}>
        <div className={`${styles.skeletonAvatar} ${styles.skeletonBase}`} />
        <div className={styles.skeletonGreetingLines}>
          <div className={`${styles.skeletonLineTitle} ${styles.skeletonBase}`} />
          <div className={`${styles.skeletonLineSub} ${styles.skeletonBase}`} />
        </div>
      </div>

      {/* 2. Pending Due Hero Shimmer Card */}
      <div className={styles.skeletonDueCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className={`${styles.skeletonBase}`} style={{ height: '14px', width: '100px' }} />
          <div className={`${styles.skeletonBase}`} style={{ height: '18px', width: '60px', borderRadius: '12px' }} />
        </div>
        <div className={`${styles.skeletonBase}`} style={{ height: '36px', width: '130px', margin: '12px 0' }} />
        <div className={`${styles.skeletonBase}`} style={{ height: '44px', width: '100%', borderRadius: '14px' }} />
      </div>

      {/* 3. Quick Actions Shimmer Grid */}
      <div className={styles.skeletonQuickGrid}>
        <div className={styles.skeletonQuickCard}>
          <div className={`${styles.skeletonBase}`} style={{ height: '20px', width: '20px', borderRadius: '6px', marginBottom: '8px' }} />
          <div className={`${styles.skeletonBase}`} style={{ height: '14px', width: '90px' }} />
        </div>
        <div className={styles.skeletonQuickCard}>
          <div className={`${styles.skeletonBase}`} style={{ height: '20px', width: '20px', borderRadius: '6px', marginBottom: '8px' }} />
          <div className={`${styles.skeletonBase}`} style={{ height: '14px', width: '90px' }} />
        </div>
      </div>

      {/* 4. Info List Shimmer Card */}
      <div style={{ background: '#ffffff', borderRadius: '20px', padding: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className={`${styles.skeletonBase}`} style={{ width: '38px', height: '38px', borderRadius: '12px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
              <div className={`${styles.skeletonBase}`} style={{ height: '12px', width: '60px' }} />
              <div className={`${styles.skeletonBase}`} style={{ height: '16px', width: '140px' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

  const getDueDetails = (due: any) => {
    if (!due) return { dueDateStr: '-', overdueDays: 0, dueDateObj: new Date() };
    let dueDateObj: Date;
    if (due.due_date) {
      dueDateObj = new Date(due.due_date);
    } else if (due.created_at) {
      const created = new Date(due.created_at);
      dueDateObj = new Date(created.getFullYear(), created.getMonth(), 5);
    } else {
      const now = new Date();
      dueDateObj = new Date(now.getFullYear(), now.getMonth(), 5);
    }
    const now = new Date();
    const diffTime = now.getTime() - dueDateObj.getTime();
    const overdueDays = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    const dueDateStr = dueDateObj.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    return { dueDateStr, overdueDays, dueDateObj };
  };

  const { tenant = {}, payments = [], pendingDues = [], notices = [], tenantPaymentsEnabled = true } = dashboardData || {};
  const activeDues = pendingDues.filter((d: any) => !paidDueIds.has(d.id));
  const pastPayments = payments
    .filter((d: any) => d.status === 'paid' || paidDueIds.has(d.id))
    .sort((a: any, b: any) => {
      const dateA = a.payment_date ? new Date(a.payment_date).getTime() : new Date(a.created_at || 0).getTime();
      const dateB = b.payment_date ? new Date(b.payment_date).getTime() : new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });
  
  const totalPendingAmount = activeDues.reduce((sum: number, due: any) => sum + Number(due.amount || 0), 0);
  const primaryDue = activeDues.length > 0 ? activeDues[0] : null;

  const currentMonthPaid = pastPayments
    .filter((p: any) => new Date(p.created_at || Date.now()).getMonth() === new Date().getMonth())
    .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

  const nextDueDate = new Date();
  nextDueDate.setDate(5);
  nextDueDate.setMonth(nextDueDate.getMonth() + 1);

  const pendingComplaintsCount = complaintsList.filter(c => (c.status || '').toLowerCase() !== 'resolved').length;

  const handleReceiptAction = (paymentId: string) => {
    const link = document.createElement('a');
    link.href = `/api/receipt/pdf/${paymentId}`;
    link.download = `Fee_Receipt_${paymentId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <AnimatePresence>
        {showClearChatConfirm && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              style={{ background: 'white', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
                  <AlertTriangle size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.125rem', color: 'var(--text-main)', fontWeight: 600 }}>Clear Chat History</h3>
              </div>
              <p style={{ margin: '0 0 24px 0', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                Are you sure you want to clear your chat history? This will hide all previous messages for you, but they will still be visible to the PG owner.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowClearChatConfirm(false)}
                  style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const userEmail = tenant.email || auth.currentUser?.email;
                    if (userEmail) {
                      const now = new Date().toISOString();
                      setLocalChatClearedAt(now);
                      await clearTenantChat(userEmail);
                    }
                    setShowClearChatConfirm(false);
                  }}
                  style={{ padding: '8px 16px', background: '#dc2626', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 500, cursor: 'pointer' }}
                >
                  Clear Chat
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isPasswordModalOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} style={{ background: 'white', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 700 }}>Reset Password</h3>
                <button onClick={() => setIsPasswordModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
              </div>

              {modalStatus.msg && (
                <div style={{ padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.875rem', background: modalStatus.type === 'error' ? '#fef2f2' : '#f0fdf4', color: modalStatus.type === 'error' ? '#b91c1c' : '#15803d' }}>
                  {modalStatus.msg}
                </div>
              )}

              {!isGoogleVerified ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <p style={{ margin: '0 0 16px 0', color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    Account: <strong>{tenant.email || auth.currentUser?.email || 'Not Provided'}</strong><br/>
                    Choose a method to reset your password.
                  </p>
                  <button
                    onClick={handleVerifyGoogle}
                    disabled={isVerifyingGoogle}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '12px', background: '#4F46E5', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {isVerifyingGoogle ? 'Verifying...' : 'Verify with Google Account'}
                  </button>
                  
                  <div style={{ textAlign: 'center', margin: '8px 0', color: '#94a3b8', fontSize: '0.85rem' }}>OR</div>
                  
                  <button
                    onClick={handleSendResetLink}
                    disabled={isSendingReset}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '12px', background: 'transparent', color: '#4F46E5', border: '1px solid #4F46E5', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {isSendingReset ? 'Sending...' : 'Send Reset Link to Email'}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleUpdatePasswordInApp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 500, color: '#334155' }}>New Password</label>
                    <div style={{ position: 'relative' }}>
                      <input type={showPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} placeholder="Min 6 characters" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 500, color: '#334155' }}>Confirm Password</label>
                    <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} placeholder="Must match new password" />
                  </div>
                  <button type="submit" disabled={isSubmittingPassword} style={{ width: '100%', padding: '12px', background: '#4F46E5', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', marginTop: '8px' }}>
                    {isSubmittingPassword ? 'Updating...' : 'Update Password'}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    <div className={styles.appContainer}>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <AnimatePresence mode="wait">
        {loading && (
          <motion.div
            key="global-loading-skeleton"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <TenantSkeletonLoader />
          </motion.div>
        )}

        {/* VIEW 1: OVERVIEW DASHBOARD */}
        {!loading && activeTab === 'Dashboard' && (
          <motion.div 
            key="dashboard-view"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            {/* KPI GRID (2x2) */}
            <div className={styles.mobileKpiGrid}>
              <div className={styles.mobileKpiCard}>
                <div className={styles.mobileKpiHeader}>
                  <CreditCard size={14} className={styles.iconDanger} /> Amount Due
                </div>
                <div className={`${styles.mobileKpiVal} ${activeDues.length > 0 ? styles.textDanger : ''}`}>
                  ₹{totalPendingAmount.toLocaleString('en-IN')}
                </div>
                <div className={styles.mobileKpiSub}>
                  {activeDues.length > 0 ? `Overdue by ${getDueDetails(primaryDue).overdueDays} day(s)` : 'No pending dues'}
                </div>
              </div>

              <div className={styles.mobileKpiCard}>
                <div className={styles.mobileKpiHeader}>
                  <Wallet size={14} className={styles.iconSuccess} /> Paid This Month
                </div>
                <div className={styles.mobileKpiVal}>
                  ₹{currentMonthPaid.toLocaleString('en-IN')}
                </div>
                <div className={styles.mobileKpiSub}>
                  Cleared for {new Date().toLocaleDateString('default', { month: 'short' })}
                </div>
              </div>

              <div className={styles.mobileKpiCard}>
                <div className={styles.mobileKpiHeader}>
                  <Calendar size={14} className={styles.iconPrimary} /> Next Due
                </div>
                <div className={styles.mobileKpiVal}>
                  {nextDueDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                </div>
                <div className={styles.mobileKpiSub}>Standard rent cycle</div>
              </div>

              <div className={styles.mobileKpiCard} onClick={() => router.push('/tenant?tab=Complaints')} role="button" tabIndex={0}>
                <div className={styles.mobileKpiHeader}>
                  <MessageSquare size={14} className={styles.iconPrimary} /> Complaints
                </div>
                <div className={styles.mobileKpiVal}>{pendingComplaintsCount} Open</div>
                <div className={styles.mobileKpiSub}>Raise / Track</div>
              </div>
            </div>

            {/* PAYMENT DETAILS HERO CARD */}
            {activeDues.length > 0 ? (
              <div className={styles.mobilePaymentDetailsHero}>
                <div className={styles.mobilePaymentHeroHeader}>
                  <span className={styles.mobilePaymentHeroTitle}>{primaryDue?.month || 'Current'} Due</span>
                  <span className={styles.mobilePaymentHeroBadge}>
                    <span className={styles.dotWarning}></span> Pending
                  </span>
                </div>
                <div className={styles.mobilePaymentHeroAmount}>
                  ₹{Number(primaryDue?.amount || 0).toLocaleString('en-IN')}
                </div>
                <AnimatedButton 
                  className={styles.payBtn}
                  onClick={() => handlePayment(primaryDue)}
                  isLoading={isProcessing}
                  disabled={isProcessing || !tenantPaymentsEnabled}
                  style={{ width: '100%', marginTop: '12px', opacity: tenantPaymentsEnabled ? 1 : 0.5 }}
                >
                  <CreditCard size={16} style={{ marginRight: '6px' }} />
                  <span>{!tenantPaymentsEnabled ? 'Payments Locked' : 'Pay via Razorpay'}</span>
                </AnimatedButton>
              </div>
            ) : tenantPaymentsEnabled ? (
              <div className={styles.mobilePaymentDetailsHero} style={{ background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)' }}>
                <div className={styles.mobilePaymentHeroHeader}>
                  <span className={styles.mobilePaymentHeroTitle} style={{ color: '#ffffff' }}>Online Rent Payment</span>
                  <span className={styles.mobilePaymentHeroBadge} style={{ backgroundColor: 'rgba(255, 255, 255, 0.25)', color: '#ffffff' }}>
                    ✓ Enabled
                  </span>
                </div>
                <div className={styles.mobilePaymentHeroAmount} style={{ fontSize: '1.25rem', margin: '4px 0 8px' }}>
                  No Pending Dues
                </div>
                <button 
                  className={styles.payBtn}
                  onClick={() => handlePayment({ 
                    id: `custom_${Date.now()}`, 
                    amount: tenant?.monthly_rent || tenant?.rent_amount || 1170, 
                    month: 'Rent Payment', 
                    type: 'advance' 
                  })}
                  disabled={isProcessing}
                  style={{ width: '100%', marginTop: '8px', background: '#ffffff', color: '#059669', fontWeight: 700, borderRadius: '14px', padding: '12px', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}
                >
                  <CreditCard size={16} />
                  <span>Pay Rent / Advance (₹{Number(tenant?.monthly_rent || tenant?.rent_amount || 1170).toLocaleString('en-IN')})</span>
                </button>
              </div>
            ) : null}

            {/* INVOICES & BILLING HISTORY (Mobile Cards List) */}
            <div className={styles.mobileInvoiceSection}>
              <div className={styles.mobileInvoiceHeader}>
                <h3 className={styles.mobileInvoiceTitle}>Invoices & Billing History</h3>
              </div>
              
              <div className={styles.mobileInvoiceList}>
                {/* Active Dues */}
                {activeDues.map((due: any) => {
                  const { dueDateStr, overdueDays } = getDueDetails(due);
                  return (
                    <div key={due.id} className={styles.mobileInvoiceCard}>
                      <div className={styles.mobileInvoiceCardTop}>
                        <div>
                          <div className={styles.mobileInvoiceBadge}>INV-{due.month ? due.month.toUpperCase() : 'RENT'}-01</div>
                          <div className={styles.mobileInvoiceDesc}>Rent Payment</div>
                        </div>
                        <div className={styles.mobileInvoiceAmount}>₹{Number(due.amount).toLocaleString('en-IN')}</div>
                      </div>
                      <div className={styles.mobileInvoiceCardMid}>
                        <div className={styles.mobileInvoiceMeta}>
                          <Calendar size={12} /> {dueDateStr}
                        </div>
                        <span className={`${styles.statusChip} ${styles.chipDanger}`}>Overdue by {overdueDays} day(s)</span>
                      </div>
                      <div className={styles.mobileInvoiceCardBot}>
                        <button 
                          className={styles.btnOutlineFull} 
                          onClick={() => handlePayment(due)}
                          disabled={!tenantPaymentsEnabled}
                          style={{ opacity: tenantPaymentsEnabled ? 1 : 0.5 }}
                        >
                          {!tenantPaymentsEnabled ? 'Locked' : 'Pay Now'}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Past Payments */}
                {pastPayments.slice(0, 5).map((payment: any, index: number) => {
                  const { dueDateStr, dueDateObj } = getDueDetails(payment);
                  const paymentIdStr = payment.id || payment.payment_id || 'SS-RECEIPT';
                  const payDate = payment.payment_date ? new Date(payment.payment_date) : new Date(payment.created_at || Date.now());
                  const diffTime = payDate.getTime() - dueDateObj.getTime();
                  const paidLateDays = diffTime > 0 ? Math.floor(diffTime / (1000 * 60 * 60 * 24)) : 0;

                  return (
                    <div key={payment.id || index} className={styles.mobileInvoiceCard}>
                      <div className={styles.mobileInvoiceCardTop}>
                        <div>
                          <div className={styles.mobileInvoiceBadge}>INV-{payment.month ? payment.month.toUpperCase() : 'PAID'}-{index + 1}</div>
                          <div className={styles.mobileInvoiceDesc}>Rent Payment</div>
                        </div>
                        <div className={styles.mobileInvoiceAmount}>₹{Number(payment.amount).toLocaleString('en-IN')}</div>
                      </div>
                      <div className={styles.mobileInvoiceCardMid}>
                        <div className={styles.mobileInvoiceMeta}>
                          <Calendar size={12} /> {dueDateStr}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className={`${styles.statusChip} ${styles.chipSuccess}`}>Paid</span>
                          {paidLateDays > 0 && <span style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: 700 }}>({paidLateDays} days late)</span>}
                        </div>
                      </div>
                      <div className={styles.mobileInvoiceCardBot}>
                        <button className={styles.btnGhostFull} onClick={() => handleReceiptAction(paymentIdStr)}>
                          <Download size={14} /> Receipt
                        </button>
                      </div>
                    </div>
                  );
                })}
                
                {activeDues.length === 0 && pastPayments.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b', background: '#fff', borderRadius: '16px' }}>
                    No payment history found.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* VIEW 2: PAYMENTS TAB */}
        {!loading && activeTab === 'Payments' && (
          <motion.div 
            key="payments-view"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className={styles.tabViewCard}
          >
            <div className={styles.tabViewHeader}>
              <h2 className={styles.tabViewTitle}>
                <CreditCard size={20} className="text-indigo-600" />
                Payments & Dues
              </h2>
            </div>

            {/* Pending Section */}
            <div>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', marginBottom: '10px' }}>Pending Dues</h3>
              {activeDues.length > 0 ? (
                activeDues.map((due: any) => (
                  <div key={due.id} style={{ background: '#fffafa', border: '1px solid #fee2e2', borderRadius: '12px', padding: '14px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>{due.month} {due.type === 'opening-fee' ? 'Opening Balance' : 'Rent'}</span>
                      <span style={{ fontWeight: 800, color: '#dc2626' }}>₹{due.amount.toLocaleString()}</span>
                    </div>
                    <AnimatedButton 
                      className={styles.payBtn}
                      onClick={() => handlePayment(due)}
                      isLoading={isProcessing}
                      disabled={isProcessing || !tenantPaymentsEnabled}
                      style={{ opacity: tenantPaymentsEnabled ? 1 : 0.5 }}
                    >
                      <span>{!tenantPaymentsEnabled ? 'Payments Locked' : 'Pay Now via Razorpay'}</span>
                      <ArrowRight size={16} />
                    </AnimatedButton>
                  </div>
                ))
              ) : (
                <div style={{ color: '#64748b', fontSize: '0.85rem', padding: '8px 0' }}>No pending dues. All payments up to date!</div>
              )}
            </div>

            {/* Past Section */}
            <div style={{ marginTop: '12px' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '10px' }}>Payment History</h3>
              {pastPayments.length > 0 ? (
                pastPayments.map((payment: any, index: number) => {
                  const { dueDateObj } = getDueDetails(payment);
                  const payDate = payment.payment_date ? new Date(payment.payment_date) : new Date(payment.created_at || Date.now());
                  const diffTime = payDate.getTime() - dueDateObj.getTime();
                  const paidLateDays = diffTime > 0 ? Math.floor(diffTime / (1000 * 60 * 60 * 24)) : 0;
                  
                  return (
                  <div key={payment.id || index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f8fafc' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0f172a' }}>{payment.month} {payment.type === 'opening-fee' ? 'Opening Fee' : 'Rent'}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Date(payment.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>₹{Number(payment.amount).toLocaleString('en-IN')}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', marginTop: '2px' }}>
                        <span className={styles.paidBadge}>PAID</span>
                        {paidLateDays > 0 && <span style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: 700 }}>({paidLateDays}d late)</span>}
                      </div>
                    </div>
                  </div>
                  );
                })
              ) : (
                <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No past payment records found.</div>
              )}
            </div>
          </motion.div>
        )}

        {/* VIEW 3: NOTICES TAB (Now Chat) */}
        {!loading && activeTab === 'Notices' && (
          <motion.div 
            key="notices-view"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              height: 'calc(100vh - 167px - env(safe-area-inset-top) - env(safe-area-inset-bottom))', 
              overflow: 'hidden',
              margin: '-5px -16px -24px -16px',
              background: '#ffffff'
            }}
          >
            <div style={{ padding: '12px 16px 4px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', background: 'transparent', flexShrink: 0 }}>
              <button 
                className={styles.btnGhost} 
                style={{ padding: '4px 10px', fontSize: '0.75rem', color: '#dc2626', border: '1px solid #fecdd3', borderRadius: '6px', background: '#fef2f2' }}
                onClick={() => setShowClearChatConfirm(true)}
              >
                Clear Chat
              </button>
            </div>

            {/* CHAT MESSAGES CANVAS */}
            <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', background: '#fafafa' }}>
              {loading ? (
                <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                  <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Loading messages...</div>
                </div>
              ) : globalMessages.length === 0 ? (
                <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  <MessageSquare size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
                  <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>No messages yet</div>
                  <div style={{ fontSize: '0.8rem' }}>Send a message to start chatting</div>
                </div>
              ) : (
                globalMessages.map((msg: any) => {
                  const isTenant = msg.sender === 'tenant';
                  return (
                    <div key={msg.id} style={{ alignSelf: isTenant ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                      {!isTenant && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#16a34a', color: 'white', fontSize: '0.65rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            O
                          </div>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#15803d' }}>PG Owner</span>
                        </div>
                      )}
                      <div
                      style={{
                        background: isTenant ? '#4f46e5' : '#ffffff',
                        color: isTenant ? 'white' : 'var(--text-main)',
                        padding: '10px 14px',
                        borderRadius: isTenant ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        border: isTenant ? 'none' : '1px solid var(--border-light)',
                        fontSize: '0.85rem',
                        lineHeight: 1.5,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                      }}
                    >
                      {msg.isInitial && <div style={{ fontSize: '0.7rem', color: isTenant ? '#c7d2fe' : '#4f46e5', marginBottom: '4px', fontWeight: 600 }}>Original Complaint:</div>}
                      {msg.isOwnerResolution && <div style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={12} /> Official Owner Reply:</div>}
                      {!msg.isInitial && !msg.isOwnerResolution && msg.attachedComplaint && msg.attachedComplaint.category !== 'General Chat' && (
                        <div style={{ background: isTenant ? 'rgba(255,255,255,0.1)' : '#f8fafc', borderLeft: `3px solid ${isTenant ? '#c7d2fe' : '#4f46e5'}`, borderRadius: '4px 8px 8px 4px', padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: isTenant ? '#c7d2fe' : '#4f46e5', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {categoryIcons[msg.attachedComplaint.category]} {msg.attachedComplaint.category}
                            </span>
                            <span style={{ fontSize: '0.6rem', color: isTenant ? 'rgba(255,255,255,0.7)' : 'var(--text-tertiary)' }}>
                              ID: {msg.attachedComplaint.id?.substring(0, 8).toUpperCase()}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: isTenant ? 'rgba(255,255,255,0.9)' : 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {msg.attachedComplaint.description}
                          </div>
                        </div>
                      )}
                      {msg.message}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textAlign: isTenant ? 'right' : 'left', marginTop: '4px' }}>
                      {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })
              )}
            </div>
            {/* INPUT FOOTER FOR MOBILE */}
            <div style={{ background: 'white', padding: '12px', borderTop: '1px solid var(--border-light)', zIndex: 50, flexShrink: 0 }}>
              
              {(() => {
                const activeComplaint = selectedChatThreadId ? complaintsList.find(c => c.id === selectedChatThreadId) : null;
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    
                    {/* Attach Menu (Slide Up) */}
                    <AnimatePresence>
                      {isAttachMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, height: 0 }}
                          animate={{ opacity: 1, y: 0, height: 'auto' }}
                          exit={{ opacity: 0, y: 10, height: 0 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border-light)', padding: '12px', marginBottom: '8px' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>Attach an active complaint</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto' }}>
                              {complaintsList.filter(c => c.category !== 'General Chat' && (c.status || '').toLowerCase() !== 'resolved').map(c => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => { setSelectedChatThreadId(c.id); setIsAttachMenuOpen(false); }}
                                  style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '8px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', textAlign: 'left' }}
                                >
                                  <div style={{ color: '#4f46e5' }}>{categoryIcons[c.category] || <AlertCircle size={16} />}</div>
                                  <div style={{ flex: 1, overflow: 'hidden' }}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.description}</div>
                                  </div>
                                </button>
                              ))}
                              {complaintsList.filter(c => c.category !== 'General Chat' && (c.status || '').toLowerCase() !== 'resolved').length === 0 && (
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontStyle: 'italic', padding: '8px 0' }}>No active complaints to attach.</div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Active Complaint Badge */}
                    {activeComplaint && (
                      <div style={{ background: '#f8fafc', borderLeft: '4px solid #4f46e5', borderRadius: '4px 8px 8px 4px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#4f46e5' }}>Replying to {activeComplaint.category}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeComplaint.description}</span>
                        </div>
                        <button type="button" onClick={() => setSelectedChatThreadId(null)} style={{ padding: '6px', background: 'none', border: 'none', color: 'var(--text-tertiary)' }}>
                          <X size={16} />
                        </button>
                      </div>
                    )}

                    <form onSubmit={(e) => { e.preventDefault(); handleSendChatReply(); }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button 
                        type="button" 
                        onClick={() => setIsAttachMenuOpen(!isAttachMenuOpen)}
                        style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f1f5f9', border: 'none', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Plus size={20} />
                      </button>
                      <input 
                        type="text" 
                        placeholder="Type a message..."
                        value={chatReplyInput}
                        onChange={(e) => setChatReplyInput(e.target.value)}
                        disabled={sendingChatReply}
                        style={{ flex: 1, padding: '10px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '24px', fontSize: '0.9rem', outline: 'none' }}
                      />
                      <button 
                        type="submit" 
                        disabled={!chatReplyInput.trim() || sendingChatReply}
                        style={{ width: '44px', height: '44px', borderRadius: '50%', background: chatReplyInput.trim() ? '#4f46e5' : '#e2e8f0', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: sendingChatReply ? 0.7 : 1 }}
                      >
                        {sendingChatReply ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} style={{ transform: 'translateX(-1px) translateY(1px)' }} />}
                      </button>
                    </form>
                  </div>
                );
              })()}
            </div>
          </motion.div>
        )}

        {/* VIEW 4: COMPLAINTS TAB */}
        {!loading && activeTab === 'Complaints' && (
          <motion.div 
            key="complaints-view"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '80px' }}
          >
            {/* Header with Raise Issue button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={20} color="#4F46E5" />
                Complaints & Issues
              </h2>
              <button
                onClick={() => { setShowNewComplaintForm(true); setSelectedComplaintId(null); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', borderRadius: '12px',
                  background: '#4F46E5', color: '#fff', border: 'none',
                  fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer'
                }}
              >
                <Plus size={14} /> Raise Issue
              </button>
            </div>

            {/* New Complaint Form (Slide-up Card) */}
            <AnimatePresence>
              {showNewComplaintForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{
                    background: '#fff', borderRadius: '16px', padding: '16px',
                    border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>New Issue</h3>
                      <button onClick={() => setShowNewComplaintForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                        <X size={18} color="#64748b" />
                      </button>
                    </div>

                    {/* Category pills */}
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Category</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {complaintCategories.map(cat => (
                          <button
                            key={cat}
                            onClick={() => setNewComplaintCat(cat)}
                            style={{
                              padding: '6px 12px', borderRadius: '20px', border: '1px solid',
                              borderColor: newComplaintCat === cat ? '#4F46E5' : '#e2e8f0',
                              background: newComplaintCat === cat ? '#EEF2FF' : '#fff',
                              color: newComplaintCat === cat ? '#4F46E5' : '#64748b',
                              fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: '4px'
                            }}
                          >
                            {categoryIcons[cat]} {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Urgency pills */}
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Urgency</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {complaintUrgencies.map(urg => (
                          <button
                            key={urg}
                            onClick={() => setNewComplaintUrg(urg)}
                            style={{
                              padding: '6px 16px', borderRadius: '20px', border: '1px solid',
                              borderColor: newComplaintUrg === urg ? (urg === 'High' ? '#dc2626' : urg === 'Medium' ? '#f59e0b' : '#16a34a') : '#e2e8f0',
                              background: newComplaintUrg === urg ? (urg === 'High' ? '#fef2f2' : urg === 'Medium' ? '#fffbeb' : '#f0fdf4') : '#fff',
                              color: newComplaintUrg === urg ? (urg === 'High' ? '#dc2626' : urg === 'Medium' ? '#d97706' : '#16a34a') : '#64748b',
                              fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer'
                            }}
                          >
                            {urg}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Description</label>
                      <textarea
                        value={newComplaintDesc}
                        onChange={(e) => setNewComplaintDesc(e.target.value)}
                        placeholder="Describe the issue in detail..."
                        rows={3}
                        style={{
                          width: '100%', padding: '12px', borderRadius: '12px',
                          border: '1px solid #e2e8f0', fontSize: '0.85rem', fontFamily: 'inherit',
                          resize: 'none', outline: 'none', boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    {complaintError && (
                      <div style={{ color: '#dc2626', fontSize: '0.78rem', fontWeight: 600 }}>{complaintError}</div>
                    )}

                    <button
                      onClick={handleSubmitComplaint}
                      disabled={submittingComplaint}
                      style={{
                        width: '100%', padding: '12px', borderRadius: '12px',
                        background: '#4F46E5', color: '#fff', border: 'none',
                        fontWeight: 700, fontSize: '0.9rem', cursor: submittingComplaint ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        opacity: submittingComplaint ? 0.7 : 1
                      }}
                    >
                      {submittingComplaint ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      {submittingComplaint ? 'Submitting...' : 'Submit Issue'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Complaints List */}
            {complaintsList.filter((c: any) => c.category !== 'General Chat').length > 0 ? (
              complaintsList.filter((c: any) => c.category !== 'General Chat').map((complaint: any) => {
                const isExpanded = selectedComplaintId === complaint.id;
                const statusColor = complaint.status === 'Resolved' ? '#16a34a' : complaint.status === 'In Progress' ? '#f59e0b' : '#dc2626';
                const statusBg = complaint.status === 'Resolved' ? '#f0fdf4' : complaint.status === 'In Progress' ? '#fffbeb' : '#fef2f2';
                
                return (
                  <div key={complaint.id} style={{
                    background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0',
                    overflow: 'hidden'
                  }}>
                    {/* Complaint summary row */}
                    <div
                      onClick={() => setSelectedComplaintId(isExpanded ? null : complaint.id)}
                      style={{
                        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '12px',
                        background: '#EEF2FF', color: '#4F46E5',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        {categoryIcons[complaint.category] || <MessageSquare size={18} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>{complaint.category}</span>
                          <span style={{
                            fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px',
                            borderRadius: '10px', background: statusBg, color: statusColor,
                            textTransform: 'uppercase'
                          }}>
                            {complaint.status || 'Open'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {complaint.description}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Clock size={10} />
                            {complaint.created_at ? new Date(complaint.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Today'}
                          </span>
                          <span style={{
                            fontSize: '0.68rem', fontWeight: 700, padding: '2px 6px', borderRadius: '6px',
                            background: complaint.urgency === 'High' ? '#fef2f2' : complaint.urgency === 'Medium' ? '#fffbeb' : '#f0fdf4',
                            color: complaint.urgency === 'High' ? '#dc2626' : complaint.urgency === 'Medium' ? '#d97706' : '#16a34a'
                          }}>
                            {complaint.urgency || 'Medium'}
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={16} color="#94a3b8" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                    </div>

                    {/* Expanded chat thread */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div style={{ borderTop: '1px solid #f1f5f9', padding: '12px 16px' }}>
                            {/* Full description */}
                            <div style={{ fontSize: '0.82rem', color: '#334155', marginBottom: '12px', lineHeight: 1.5 }}>
                              {complaint.description}
                            </div>

                            {/* Replies */}
                            {complaint.replies && complaint.replies.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                                {complaint.replies.map((reply: any, idx: number) => (
                                  <div key={idx} style={{
                                    padding: '10px 12px', borderRadius: '12px',
                                    background: reply.from === 'tenant' || reply.sender === 'tenant' ? '#EEF2FF' : '#f8fafc',
                                    alignSelf: reply.from === 'tenant' || reply.sender === 'tenant' ? 'flex-end' : 'flex-start',
                                    maxWidth: '85%'
                                  }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', marginBottom: '2px' }}>
                                      {reply.sender_name || reply.from || 'Owner'}
                                    </div>
                                    <div style={{ fontSize: '0.82rem', color: '#0f172a' }}>{reply.message || reply.text}</div>
                                    <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '3px' }}>
                                      {reply.created_at ? new Date(reply.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Reply input */}
                            {complaint.status !== 'Resolved' && (
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input
                                  type="text"
                                  value={complaintReplyInput}
                                  onChange={(e) => setComplaintReplyInput(e.target.value)}
                                  placeholder="Type a reply..."
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendReply(); }}
                                  style={{
                                    flex: 1, padding: '10px 14px', borderRadius: '12px',
                                    border: '1px solid #e2e8f0', fontSize: '0.85rem',
                                    outline: 'none', fontFamily: 'inherit'
                                  }}
                                />
                                <button
                                  onClick={handleSendReply}
                                  disabled={sendingReply || !complaintReplyInput.trim()}
                                  style={{
                                    width: '40px', height: '40px', borderRadius: '12px',
                                    background: '#4F46E5', color: '#fff', border: 'none',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', flexShrink: 0,
                                    opacity: sendingReply || !complaintReplyInput.trim() ? 0.5 : 1
                                  }}
                                >
                                  {sendingReply ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                </button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            ) : (
              <div style={{
                background: '#fff', borderRadius: '16px', padding: '32px 20px',
                border: '1px solid #e2e8f0', textAlign: 'center'
              }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
                  <CheckCircle2 size={24} />
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', marginBottom: '4px' }}>All Clear!</div>
                <div style={{ fontSize: '0.82rem', color: '#64748b' }}>No complaints raised yet. Tap &quot;Raise Issue&quot; if you need help.</div>
              </div>
            )}
          </motion.div>
        )}

        {/* VIEW 5: PROFILE TAB (Matching Reference Mockup) */}
        {activeTab === 'Profile' && (
          <motion.div 
            key="profile-view"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
          >
            {/* 1. Tenant Hero Profile Card */}
            <div className={styles.profileHeroCard}>
              <div className={styles.profileAvatarWrapper}>
                {tenant.face_picture ? (
                  <img src={tenant.face_picture} alt={tenant.full_name} className={styles.profileAvatarImg} />
                ) : (
                  <div className={styles.profileAvatarFallback}>
                    {tenant.full_name?.charAt(0).toUpperCase() || 'T'}
                  </div>
                )}
                <div className={styles.profileVerifiedBadge}>
                  <ShieldCheck size={14} />
                </div>
              </div>

              <div className={styles.profileInfoRight}>
                <h2 className={styles.profileName}>{tenant.full_name || 'Tenant Name'}</h2>
                <div className={styles.profileRoom}>
                  {tenant.room_number ? `Room ${tenant.room_number}` : tenant.room?.room_number ? `Room ${tenant.room.room_number}` : 'Room Info'}
                </div>
                
                <div className={styles.profileBadgeRow}>
                  <div className={styles.profileActivePill}>
                    <span className={styles.activeDot}></span> Active
                  </div>
                </div>

                <div className={styles.profileHostelName}>
                  <Building size={14} />
                  <span>{tenant.pg_name || 'A1 Hostels'}</span>
                </div>
              </div>
            </div>

            {/* 2. Information List Card (4 Rows with Right Chevrons) */}
            <div className={styles.profileInfoCard}>
              {/* Phone */}
              <div className={styles.profileInfoRow}>
                <div className={styles.profileInfoLeft}>
                  <div className={styles.profileIconBox}>
                    <Phone size={18} />
                  </div>
                  <div>
                    <div className={styles.profileInfoLabel}>Phone</div>
                    <div className={styles.profileInfoValue}>{tenant.mobile || 'Not Provided'}</div>
                  </div>
                </div>
                <ChevronRight size={16} color="#94A3B8" />
              </div>

              {/* Email */}
              <div className={styles.profileInfoRow}>
                <div className={styles.profileInfoLeft}>
                  <div className={styles.profileIconBox}>
                    <Mail size={18} />
                  </div>
                  <div>
                    <div className={styles.profileInfoLabel}>Email</div>
                    <div className={styles.profileInfoValue}>{tenant.email || 'Not Provided'}</div>
                  </div>
                </div>
                <ChevronRight size={16} color="#94A3B8" />
              </div>

              {/* Address */}
              <div className={styles.profileInfoRow}>
                <div className={styles.profileInfoLeft}>
                  <div className={styles.profileIconBox}>
                    <MapPin size={18} />
                  </div>
                  <div>
                    <div className={styles.profileInfoLabel}>Address</div>
                    <div className={styles.profileInfoValue}>{tenant.address || 'Not Provided'}</div>
                  </div>
                </div>
                <ChevronRight size={16} color="#94A3B8" />
              </div>

              {/* Check-in Date */}
              <div className={styles.profileInfoRow}>
                <div className={styles.profileInfoLeft}>
                  <div className={styles.profileIconBox}>
                    <Calendar size={18} />
                  </div>
                  <div>
                    <div className={styles.profileInfoLabel}>Check-in Date</div>
                    <div className={styles.profileInfoValue}>
                      {tenant.move_in_date ? new Date(tenant.move_in_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not Provided'}
                    </div>
                  </div>
                </div>
                <ChevronRight size={16} color="#94A3B8" />
              </div>
            </div>

            {/* 3. Quick Actions Section */}
            <div className={styles.quickActionsSection}>
              <h3 className={styles.quickActionsTitle}>Quick Actions</h3>
              <div 
                className={styles.quickActionItem} 
                onClick={() => setIsPasswordModalOpen(true)}
              >
                <div className={styles.quickActionLeft}>
                  <div className={styles.quickActionIconBox} style={{ color: '#4F46E5', background: '#EEF2FF' }}>
                    <KeyRound size={18} />
                  </div>
                  <div>
                    <div className={styles.quickActionLabel}>Reset Password</div>
                    <div className={styles.quickActionSub}>Update your login credentials</div>
                  </div>
                </div>
                <ChevronRight size={16} color="#94A3B8" />
              </div>
            </div>

            {/* 4. Logout Button */}
            <button 
              className={styles.logoutBtn}
              onClick={handleLogout}
              type="button"
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>


      <AnimatePresence>
        {isPasswordModalOpen && (
          <div className={styles.modalOverlay} onClick={() => setIsPasswordModalOpen(false)}>
            <motion.div 
              className={styles.passwordModalContent}
              initial={{ scale: 0.9, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 15 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.passwordModalHeader}>
                <h3 className={styles.passwordModalTitle}>
                  <KeyRound size={20} color="#4F46E5" />
                  <span>Reset Password</span>
                </h3>
                <button 
                  onClick={() => setIsPasswordModalOpen(false)}
                  style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={18} />
                </button>
              </div>

              <p className={styles.passwordModalSubtext}>
                Account: <strong>{tenant?.email || auth.currentUser?.email || 'praneeth743x@gmail.com'}</strong>
              </p>

              {modalStatus.msg && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '12px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  marginBottom: '14px',
                  background: modalStatus.type === 'success' ? '#ECFDF5' : '#FEF2F2',
                  color: modalStatus.type === 'success' ? '#065F46' : '#991B1B',
                  border: `1px solid ${modalStatus.type === 'success' ? '#A7F3D0' : '#FECACA'}`
                }}>
                  {modalStatus.msg}
                </div>
              )}

              {!isGoogleVerified ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '8px 0' }}>
                  <div style={{
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '16px',
                    padding: '16px',
                    textAlign: 'center'
                  }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#EEF2FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px auto' }}>
                      <ShieldCheck size={24} />
                    </div>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', fontWeight: 800, color: '#0F172A' }}>Google Verification Required</h4>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748B', lineHeight: 1.4 }}>
                      To protect your account, please sign in with your Google account (<strong>{tenant?.email || 'praneeth743x@gmail.com'}</strong>) to authorize resetting your password.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleVerifyGoogle}
                    disabled={isVerifyingGoogle}
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: '14px',
                      background: '#4F46E5',
                      color: 'white',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      cursor: isVerifyingGoogle ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)'
                    }}
                  >
                    {isVerifyingGoogle ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>Verifying Google Account...</span>
                      </>
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24">
                          <path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#ffffff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#ffffff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                          <path fill="#ffffff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                        </svg>
                        <span>Verify with Google Account</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleUpdatePasswordInApp}>
                  <div className={styles.passwordModalInputGroup}>
                    <label className={styles.passwordModalLabel}>New Password</label>
                    <div className={styles.passwordModalInputWrapper}>
                      <input 
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password (min 6 chars)"
                        className={styles.passwordInput}
                        required
                      />
                      <button 
                        type="button" 
                        className={styles.eyeToggleBtn}
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className={styles.passwordModalInputGroup}>
                    <label className={styles.passwordModalLabel}>Confirm New Password</label>
                    <div className={styles.passwordModalInputWrapper}>
                      <input 
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className={styles.passwordInput}
                        required
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className={styles.submitPasswordBtn}
                    disabled={isSubmittingPassword}
                  >
                    {isSubmittingPassword ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <>
                        <Lock size={18} />
                        <span>Save New Password</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    </>
  );
}
