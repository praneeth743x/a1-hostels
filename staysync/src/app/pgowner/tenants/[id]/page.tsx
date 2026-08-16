"use client";

import { useConfirm } from '@/context/ConfirmContext';
import { toast } from 'react-hot-toast';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { rpcCall } from '@/lib/rpc';
import { auth, db, storage } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import styles from './tenantDetails.module.css';
import { Bell, Download, MoreVertical, Phone, Mail, MapPin, Briefcase, Building2, Calendar, ArrowLeft, Edit, LogIn, LogOut, Clock, Plus, Loader2, Pause, Play, CreditCard, CheckCircle2, Receipt, Printer, MessageSquare, Send, AlertTriangle, ChevronDown, User, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sendManualTenantNotificationAction, toggleTenantWhatsAppAction } from '@/app/actions/whatsappActions';
import { AvatarImage } from '@/components/AvatarImage';
import { useHostel } from '@/context/HostelContext';
import { notifyHostelDataChanged } from '@/hooks/useHostelData';

export default function TenantDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const confirm = useConfirm();
  const router = useRouter();
  const resolvedParams = React.use(params);
  const { currentUser, userProfile } = useHostel();
  const [tenant, setTenant] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Basic Details');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [noticeDate, setNoticeDate] = useState('');
  const [showPauseModal, setShowPauseModal] = useState(false);

  // WhatsApp Suite State
  const [waSending, setWaSending] = useState(false);
  const [showCustomNoticeModal, setShowCustomNoticeModal] = useState(false);
  const [customNoticeText, setCustomNoticeText] = useState('');

  const handleSendWhatsApp = async (triggerType: 'WELCOME' | 'DUE_REMINDER' | 'OVERDUE_REMINDER' | 'PAYMENT_CONFIRMATION' | 'CUSTOM', customMsg?: string) => {
    setWaSending(true);
    try {
      const res = await sendManualTenantNotificationAction({
        tenantId: resolvedParams.id,
        triggerType,
        customMessage: customMsg
      });

      if (res.success) {
        toast.success('✅ WhatsApp message dispatched successfully!');
        if (triggerType === 'CUSTOM') {
          setShowCustomNoticeModal(false);
          setCustomNoticeText('');
        }
      } else {
        toast.error('⚠️ Failed to send WhatsApp message: ' + (res.error || 'Unknown error'));
      }
    } catch (e: any) {
      toast.error('Error sending WhatsApp message: ' + e.message);
    } finally {
      setWaSending(false);
    }
  };
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [selectedPauseClearDueIds, setSelectedPauseClearDueIds] = useState<string[]>([]);
  const [pauseMaintenanceOption, setPauseMaintenanceOption] = useState<'none' | 'charge'>('none');
  const [pauseMaintenanceFee, setPauseMaintenanceFee] = useState<string>('');
  const [resumeMaintenanceOption, setResumeMaintenanceOption] = useState<'none' | 'charge'>('none');
  const [resumeMaintenanceFee, setResumeMaintenanceFee] = useState<string>('');
  const [resumeCollectChoice, setResumeCollectChoice] = useState<'now' | 'later'>('now');
  const [resumePaymentMethod, setResumePaymentMethod] = useState<string>('UPI');
  const [isPausing, setIsPausing] = useState(false);
  const [pauseHistory, setPauseHistory] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(true);
  const [editData, setEditData] = useState({
    fullName: '',
    mobile: '',
    email: '',
    moveInDate: '',
    checkOutDate: '',
    rentAmount: 0
  });
  const [documentsToUpload, setDocumentsToUpload] = useState<{
    facePicture: File | null;
    govtFront: File | null;
    govtBack: File | null;
  }>({ facePicture: null, govtFront: null, govtBack: null });

  const [previews, setPreviews] = useState<{
    facePicture: string | null;
    govtFront: string | null;
    govtBack: string | null;
  }>({ facePicture: null, govtFront: null, govtBack: null });

  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [tenantDues, setTenantDues] = useState<any[]>([]);
  const [isPaymentsLoading, setIsPaymentsLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<any>(null);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [addPaymentAmount, setAddPaymentAmount] = useState('');
  const [addPaymentCategory, setAddPaymentCategory] = useState<'rent' | 'maintenance-fee' | 'security-deposit' | 'one-time'>('rent');
  const [addPaymentMethod, setAddPaymentMethod] = useState('UPI');
  const [addPaymentMonth, setAddPaymentMonth] = useState('');
  useEffect(() => {
    setAddPaymentMonth(new Date().toLocaleString('default', { month: 'long', year: 'numeric' }));
  }, []);
  const [addPaymentNotes, setAddPaymentNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  const handleRecordPaymentSubmit = async () => {
    if (!addPaymentAmount || Number(addPaymentAmount) <= 0) {
      toast.error("Please enter a valid payment amount.");
      return;
    }
    setIsSubmittingPayment(true);
    const collectorUid = currentUser?.uid || '';
    const collectorName = userProfile?.full_name || userProfile?.name || currentUser?.displayName || 'Staff';

    const amount = Number(addPaymentAmount);

    try {
      const res = await rpcCall('recordTenantPayment', resolvedParams.id, {
        amount,
        category: addPaymentCategory,
        paymentMethod: addPaymentMethod,
        month: addPaymentMonth,
        notes: addPaymentNotes,
        collectedByUid: collectorUid,
        collectedByName: collectorName
      });

      if (res?.success) {
        setShowAddPaymentModal(false);
        setAddPaymentAmount('');
        setAddPaymentNotes('');
        toast.success(`₹${amount.toLocaleString('en-IN')} payment recorded successfully!`);
        loadPaymentsAndLogs();
        notifyHostelDataChanged();
      } else {
        toast.error("Failed to record payment: " + (res?.error || 'Unknown error'));
      }
    } catch (err: any) {
      toast.error("Payment recording failed. Please try again.");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleFileSelect = (key: 'facePicture' | 'govtFront' | 'govtBack', file: File | null) => {
    if (file) {
      setDocumentsToUpload(prev => ({ ...prev, [key]: file }));
      setPreviews(prev => ({ ...prev, [key]: URL.createObjectURL(file) }));
    }
  };

  const handleEditClick = () => {
    setEditData({
      fullName: tenant?.full_name || '',
      mobile: tenant?.mobile || '',
      email: tenant?.email || '',
      moveInDate: tenant?.move_in_date || (tenant?.created_at ? new Date(tenant.created_at).toISOString().split('T')[0] : ''),
      checkOutDate: tenant?.check_out_date || (tenant?.created_at ? new Date(new Date(tenant.created_at).getTime() + 365*24*60*60*1000).toISOString().split('T')[0] : ''),
      rentAmount: Number(tenant?.rent_amount ?? tenant?.monthly_rent ?? tenant?.rent ?? tenant?.fee ?? tenant?.room?.price ?? tenant?.room?.rent ?? 0)
    });
    setPreviews({
      facePicture: tenant?.documents?.facePicture || tenant?.face_picture || null,
      govtFront: tenant?.documents?.govtFront || tenant?.govt_front || null,
      govtBack: tenant?.documents?.govtBack || tenant?.govt_back || null,
    });
    setDocumentsToUpload({ facePicture: null, govtFront: null, govtBack: null });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    setIsSaving(true);
    let documentUrls: any = { ...(tenant?.documents || {}) };
    const ownerId = localStorage.getItem('userUid') || auth.currentUser?.uid || 'owner';

    const uploadSingleFile = async (file: File, path: string) => {
      const options = { maxSizeMB: 0.2, maxWidthOrHeight: 1024, useWebWorker: true };
      let fileToUpload = file;
      try {
        fileToUpload = await imageCompression(file, options);
      } catch (err) {
        console.warn('Compression failed, using original file', err);
      }
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, fileToUpload);
      return await getDownloadURL(storageRef);
    };

    try {
      if (documentsToUpload.facePicture) {
        documentUrls.facePicture = await uploadSingleFile(documentsToUpload.facePicture, `tenants/${ownerId}/${Date.now()}_face.jpg`);
      }
      if (documentsToUpload.govtFront) {
        documentUrls.govtFront = await uploadSingleFile(documentsToUpload.govtFront, `tenants/${ownerId}/${Date.now()}_govF.jpg`);
      }
      if (documentsToUpload.govtBack) {
        documentUrls.govtBack = await uploadSingleFile(documentsToUpload.govtBack, `tenants/${ownerId}/${Date.now()}_govB.jpg`);
      }
    } catch (e: any) {
      console.warn('Error uploading documents:', e);
    }

    const payload = {
      ...editData,
      documents: documentUrls,
      performedByUid: auth.currentUser?.uid || localStorage.getItem('userUid') || '',
      performedByName: auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'PG Staff/Owner'
    };

    const res = await rpcCall('updateTenantBasicDetails', resolvedParams.id, payload);
    if (res.success) {
      setTenant({
        ...tenant,
        full_name: editData.fullName,
        mobile: editData.mobile,
        email: editData.email,
        move_in_date: editData.moveInDate,
        check_out_date: editData.checkOutDate,
        rent_amount: editData.rentAmount,
        documents: documentUrls,
        face_picture: documentUrls.facePicture || tenant.face_picture
      });
      setIsEditing(false);
      loadPaymentsAndLogs();
      toast.success("✅ Tenant details updated!");
    } else {
      toast.error("Failed to update details: " + res.error);
    }
    setIsSaving(false);
  };

  const handleDeleteTenant = async () => {
    if (!await confirm('Are you sure you want to delete this tenant? A confirmation email will be sent to you.')) return;
    const ownerEmail = userProfile?.email || currentUser?.email;
    if (!ownerEmail) {
      toast.error("Owner email not found. Please relogin.");
      return;
    }
    const res = await rpcCall('requestTenantDeletion', resolvedParams.id, ownerEmail);
    if (res.success) {
      toast.success("Confirmation email sent! Check your inbox.");
      setTenant({...tenant, deletion_requested_at: new Date().toISOString()});
    } else {
      toast.error(res.error || "Failed to request deletion.");
    }
  };

  const handleVacate = async () => {
    setShowMenu(false);
    if (!await confirm('Are you sure you want to vacate this tenant?')) return;
    setIsUpdatingStatus(true);
    const res = await rpcCall('updateTenantStatus', resolvedParams.id, 'vacated');
    if (res.success) {
      setTenant({...tenant, status: 'vacated', is_active: false});
    } else {
      toast.error("Failed to update status");
    }
    setIsUpdatingStatus(false);
  };

  const handleReVacate = async () => {
    setShowMenu(false);
    if (!await confirm('Are you sure you want to re-vacate this tenant (restore to active)?')) return;
    setIsUpdatingStatus(true);
    const res = await rpcCall('updateTenantStatus', resolvedParams.id, 'ACTIVE');
    if (res.success) {
      setTenant({...tenant, status: 'ACTIVE', is_active: true});
      toast.success("Tenant restored successfully!");
    } else {
      toast.error("Failed to update status");
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
    const res = await rpcCall('updateTenantStatus', resolvedParams.id, 'notice_period', { check_out_date: d.toISOString() });
    if (res.success) {
      setTenant({...tenant, status: 'notice_period', check_out_date: d.toISOString()});
      setShowNoticeModal(false);
    } else {
      toast.error("Failed to update status");
    }
    setIsUpdatingStatus(false);
  };
  
  const handleUndoNoticePeriod = async () => {
    setShowMenu(false);
    setIsUpdatingStatus(true);
    const res = await rpcCall('updateTenantStatus', resolvedParams.id, 'active', { check_out_date: null });
    if (res.success) {
      setTenant({...tenant, status: 'active', check_out_date: null});
    } else {
      toast.error("Failed to update status");
    }
    setIsUpdatingStatus(false);
  };

  const handlePauseSubmit = async () => {
    setIsPausing(true);
    const maintFee = pauseMaintenanceOption === 'charge' ? Number(pauseMaintenanceFee || 0) : 0;

    const res = await rpcCall('pauseTenant', resolvedParams.id, {
      pauseType: 'indefinite',
      pauseUntilDate: undefined,
      maintenanceFee: maintFee,
      clearedPaymentIds: selectedPauseClearDueIds
    });

    if (res.success) {
      setTenant({
        ...tenant, 
        status: 'PAUSED',
        paused_at: new Date().toISOString(),
        pause_type: 'indefinite',
        expected_resume_date: null,
        maintenance_fee_on_pause: maintFee
      });
      setShowPauseModal(false);
      setSelectedPauseClearDueIds([]);
      setPauseMaintenanceOption('none');
      setPauseMaintenanceFee('');
      loadPaymentsAndLogs();
    } else {
      toast.error("Failed to pause tenant: " + (res.error || 'Unknown error'));
    }
    setIsPausing(false);
  };

  const handleResumeSubmit = async () => {
    setIsPausing(true);
    const maintFee = resumeMaintenanceOption === 'charge' ? Number(resumeMaintenanceFee || 0) : 0;
    
    const res = await rpcCall('resumeTenant', resolvedParams.id, {
      chargeMaintenanceFee: maintFee,
      collectNow: maintFee > 0 ? resumeCollectChoice === 'now' : false,
      paymentMethod: resumePaymentMethod
    });

    if (res.success) {
      setTenant({
        ...tenant, 
        status: 'ACTIVE', 
        original_move_in_date: tenant.original_move_in_date || tenant.old_check_in_date || tenant.move_in_date || tenant.created_at,
        move_in_date: new Date().toISOString(),
        expected_resume_date: null
      });
      setShowResumeModal(false);
      setResumeMaintenanceOption('none');
      setResumeMaintenanceFee('');
      loadPaymentsAndLogs();
    } else {
      toast.error("Failed to resume tenant: " + (res.error || 'Unknown error'));
    }
    setIsPausing(false);
  };

  const handleCancelPauseSubmit = async () => {
    if (!await confirm("Are you sure you want to cancel this pause? This will restore the tenant's active status and restore all cleared dues with their original dates.")) {
      return;
    }
    setIsPausing(true);
    const res = await rpcCall('cancelTenantPause', resolvedParams.id);
    if (res.success) {
      setShowResumeModal(false);
      loadPaymentsAndLogs();
      const tenantRes = await rpcCall('getTenantById', resolvedParams.id);
      if (tenantRes.success && tenantRes.data) {
        setTenant(tenantRes.data);
      }
    } else {
      toast.error("Failed to cancel pause: " + (res.error || 'Unknown error'));
    }
    setIsPausing(false);
  };

  const loadPaymentsAndLogs = async () => {
    setIsPaymentsLoading(true);
    setIsLogsLoading(true);
    const [paymentsRes, duesRes, histRes, logsRes] = await Promise.all([
      rpcCall('getTenantPayments', resolvedParams.id),
      rpcCall('getTenantDues', resolvedParams.id),
      rpcCall('getTenantPauseHistory', resolvedParams.id),
      rpcCall('getTenantActivityLogs', resolvedParams.id)
    ]);
    if (paymentsRes.success && paymentsRes.data) setPaymentHistory(paymentsRes.data);
    if (duesRes.success && duesRes.data) setTenantDues(duesRes.data);
    if (histRes.success && histRes.data) setPauseHistory(histRes.data);
    if (logsRes.success && logsRes.data) setActivityLogs(logsRes.data);
    setIsPaymentsLoading(false);
    setIsLogsLoading(false);
  };

  useEffect(() => {
    async function load() {
      const res = await rpcCall('getTenantById', resolvedParams.id);
      if (res.success && res.data) {
        setTenant(res.data);
      }
      setIsLoading(false);
      loadPaymentsAndLogs();
    }
    load();
  }, [resolvedParams.id]);

  let rentStatus = 'Pending';
  const isVacated = tenant?.is_active === false || tenant?.status === 'vacated' || tenant?.status === 'VACATED';
  const presentDueAmount = tenantDues.filter((d: any) => d.status === 'pending').reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

  if (isVacated || presentDueAmount === 0) {
    rentStatus = 'Paid';
  } else if (paymentHistory && paymentHistory.length > 0) {
    const currentMonthStr = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    const hasPaidCurrentMonth = paymentHistory.some((p: any) => p.month === currentMonthStr && p.status === 'paid');
    const hasPartialCurrentMonth = paymentHistory.some((p: any) => p.month === currentMonthStr && p.is_partial);
    
    if (hasPaidCurrentMonth) rentStatus = 'Paid';
    else if (hasPartialCurrentMonth) rentStatus = 'Partial';
  }

  const combinedTimeline = useMemo(() => {
    const events: any[] = [];

    // 1. Tenant Creation / Check-in
    const checkInDate = tenant?.move_in_date || tenant?.created_at;
    if (checkInDate) {
      events.push({
        id: 'checkin',
        type: 'CHECK_IN',
        title: 'Tenant Joined & Stay Started',
        timestamp: new Date(checkInDate).getTime(),
        dateStr: new Date(checkInDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        timeStr: new Date(checkInDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        description: `Tenant checked into Room ${tenant.room?.room_number || 'N/A'}. Base monthly rent set to ₹${Number(tenant.rent_amount ?? tenant.fee ?? tenant.monthly_rent ?? 0).toLocaleString('en-IN')}. Added by ${tenant.added_by_name || 'Owner'}.`,
        badgeColor: '#10b981',
        badgeBg: '#ecfdf5',
        iconType: 'CHECKIN'
      });
    }

    // 2. Activity Logs
    (activityLogs || []).forEach((log: any) => {
      const ts = new Date(log.timestamp || log.created_at || Date.now()).getTime();
      let badgeColor = '#3b82f6';
      let badgeBg = '#eff6ff';
      let iconType = 'LOG';

      if (log.event_type?.includes('PAUSED')) {
        badgeColor = '#d97706';
        badgeBg = '#fffbeb';
        iconType = 'PAUSE';
      } else if (log.event_type?.includes('RESUMED')) {
        badgeColor = '#059669';
        badgeBg = '#ecfdf5';
        iconType = 'RESUME';
      } else if (log.event_type?.includes('CHARGE') || log.event_type?.includes('ONE_TIME')) {
        badgeColor = '#8b5cf6';
        badgeBg = '#f5f3ff';
        iconType = 'PAYMENT';
      }

      events.push({
        id: log.id || log.log_id || `log-${ts}`,
        type: log.event_type || 'LOG',
        title: log.title || log.event_type || 'Activity Log',
        timestamp: ts,
        dateStr: new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        timeStr: new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        description: log.description,
        performedBy: log.performed_by || 'Owner',
        badgeColor,
        badgeBg,
        iconType
      });
    });

    // 3. Pause History Records
    (pauseHistory || []).forEach((ph: any) => {
      const startTs = new Date(ph.paused_at || ph.timestamp || Date.now()).getTime();
      const resumeTs = ph.actual_resume_date ? new Date(ph.actual_resume_date).getTime() : null;

      let durationStr = 'Active Pause';
      if (resumeTs) {
        const diffDays = Math.max(1, Math.ceil((resumeTs - startTs) / (1000 * 60 * 60 * 24)));
        durationStr = `${diffDays} day${diffDays > 1 ? 's' : ''}`;
      } else {
        const diffDays = Math.max(1, Math.ceil((Date.now() - startTs) / (1000 * 60 * 60 * 24)));
        durationStr = `Paused for ${diffDays} day${diffDays > 1 ? 's' : ''} (Ongoing)`;
      }

      const alreadyExists = events.some(e => Math.abs(e.timestamp - startTs) < 5000 && String(e.type).includes('PAUSED'));
      if (!alreadyExists) {
        events.push({
          id: ph.id || ph.history_id || `ph-${startTs}`,
          type: 'PAUSE_RECORD',
          title: `Tenant Paused (${ph.pause_type || 'indefinite'})`,
          timestamp: startTs,
          dateStr: new Date(startTs).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
          timeStr: new Date(startTs).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          description: `Tenant stay paused (${ph.pause_type || 'indefinite'}). Duration: ${durationStr}. ${ph.cleared_due_amount > 0 ? `Cleared ₹${Number(ph.cleared_due_amount).toLocaleString('en-IN')} pending dues on pause.` : ''} ${ph.maintenance_fee_created > 0 ? `Maintenance fee of ₹${Number(ph.maintenance_fee_created).toLocaleString('en-IN')} charged.` : ''}`,
          badgeColor: '#d97706',
          badgeBg: '#fffbeb',
          iconType: 'PAUSE'
        });
      }
    });

    // 4. Paid Payments
    (paymentHistory || []).forEach((p: any) => {
      if (p.status === 'paid' || p.is_paid) {
        const ts = new Date(p.payment_date || p.created_at || Date.now()).getTime();
        const alreadyExists = events.some(e => Math.abs(e.timestamp - ts) < 5000 && (String(e.type).includes('PAID') || e.type === 'PAYMENT_RECEIVED'));
        if (!alreadyExists) {
          events.push({
            id: p.id || p.payment_id || `pay-${ts}`,
            type: 'PAYMENT_RECEIVED',
            title: `Payment Received: ₹${Number(p.amount_paid || p.amount || 0).toLocaleString('en-IN')}`,
            timestamp: ts,
            dateStr: new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
            timeStr: new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
            description: `Payment collected via ${p.payment_method || 'UPI'} ${p.month ? `for ${p.month}` : ''} ${p.type === 'maintenance-fee' ? '(Maintenance Fee)' : '(Monthly Rent)'}${p.collected_by_name ? ` by ${p.collected_by_name}` : ''}.`,
            badgeColor: '#059669',
            badgeBg: '#ecfdf5',
            iconType: 'PAYMENT'
          });
        }
      }
    });

    return events.sort((a, b) => b.timestamp - a.timestamp);
  }, [tenant, activityLogs, pauseHistory, paymentHistory]);

  // userProfile is now coming from useHostel()

  const isTeamMember = userProfile?.role === 'team_member';
  const perms = userProfile?.permissions || {};
  const canAccessDetails = !isTeamMember || perms.manageTenants || perms.editTenant;
  const canDeleteTenant = userProfile?.role === 'super_admin' || userProfile?.role === 'pg_owner' || perms.deleteTenant;

  if (userProfile && isTeamMember && !canAccessDetails) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '65vh', padding: '24px', textAlign: 'center' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#FEF2F2', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', border: '1px solid #FCA5A5' }}>
          <AlertTriangle size={32} />
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>Access Restricted</h2>
        <p style={{ fontSize: '0.88rem', color: '#64748B', maxWidth: '360px', margin: '0 auto 20px auto' }}>
          You do not have permission to view tenant detail pages. Please contact your PG Owner to grant access.
        </p>
        <button onClick={() => router.push('/pgowner/tenants')} style={{ padding: '10px 20px', borderRadius: '12px', background: '#4F46E5', color: '#FFFFFF', border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
          Back to Tenants Directory
        </button>
      </div>
    );
  }

  if (isLoading || !tenant) {
    return (
      <div className={styles.tdRevampedContainer} style={{ padding: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '65vh' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <Loader2 size={32} color="#4F46E5" style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ color: '#64748B', fontWeight: 500 }}>Loading tenant details...</span>
          </div>
        ) : (
          <div>Tenant not found.</div>
        )}
      </div>
    );
  }

  const isLockedForDeletion = tenant.deletion_requested_at && (new Date().getTime() - new Date(tenant.deletion_requested_at).getTime() < 60000);

  return (
    <div className={styles.tdRevampedContainer}>
      <div style={{ padding: '16px 20px 8px', display: 'flex', alignItems: 'center' }}>
        <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#64748b', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>
          <ArrowLeft size={18} />
          Back to Tenants
        </button>
      </div>

      {isLockedForDeletion && (
        <div style={{ margin: '0 20px 16px', padding: '12px 16px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertTriangle size={24} color="#d97706" />
          <div>
            <h4 style={{ margin: 0, color: '#92400e', fontSize: '0.95rem', fontWeight: 700 }}>Tenant Locked for Deletion</h4>
            <p style={{ margin: '4px 0 0', color: '#b45309', fontSize: '0.85rem' }}>A confirmation email was sent to the owner. Editing and payments are disabled for 1 minute.</p>
          </div>
        </div>
      )}

      {/* Main Profile Card */}
      <div className={styles.tdMainCardWrapper}>
        <div className={styles.tdMainCard}>
          <div className={styles.tdProfileSection}>
            <div className={styles.tdProfileLeft}>
              <AvatarImage 
                src={tenant.documents?.facePicture || tenant.face_picture || tenant.facePicture || tenant.documents?.photo || tenant.avatar || tenant.photo_url || tenant.photoUrl} 
                alt={tenant.full_name || 'Tenant'} 
                name={tenant.full_name || '?'} 
                size={50} 
              />
              <div className={styles.tdProfileInfo}>
                <h2>{tenant.full_name?.length > 10 ? tenant.full_name.substring(0, 8) + '...' : tenant.full_name}</h2>
                <p>Room {tenant.room?.room_number || 'N/A'}</p>
                <div className={styles.tdPillsWrapper}>
                  <span className={tenant.is_active === false ? styles.tdBadgeDarkBlue : tenant.status === 'notice_period' ? styles.tdBadgeTeal : tenant.status === 'PAUSED' ? styles.tdBadgeDarkBlue : styles.tdBadgeGreen}>
                    {tenant.is_active === false ? 'VACATED' : tenant.status === 'notice_period' ? 'NOTICE PERIOD' : tenant.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE'}
                  </span>
                  <span 
                    className={rentStatus === 'Paid' ? styles.tdBadgeGreen : styles.tdBadgeDarkBlue}
                    style={rentStatus === 'Pending' ? { backgroundColor: '#ef4444' } : rentStatus === 'Partial' ? { backgroundColor: '#f59e0b' } : {}}
                  >
                    {rentStatus}
                  </span>
                </div>
              </div>
            </div>
            <div className={styles.tdActionButtons}>
              {tenant.status === 'PAUSED' ? (
                <button className={styles.tdActionBtn} onClick={() => setShowResumeModal(true)} disabled={isPausing || isLockedForDeletion} style={{ color: '#10b981' }}>
                  {isPausing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
                </button>
              ) : (
                <button className={styles.tdActionBtn} onClick={() => setShowPauseModal(true)} disabled={isPausing || tenant.is_active === false || isLockedForDeletion}>
                  {isPausing ? <Loader2 size={16} className="animate-spin" /> : <Pause size={16} fill="currentColor" />}
                </button>
              )}
              <div style={{ position: 'relative' }}>
                <button className={styles.tdActionBtn} onClick={() => setShowMenu(!showMenu)} disabled={isUpdatingStatus || isLockedForDeletion}>
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
                      {tenant.status === 'PAUSED' && (
                        <button 
                          onClick={() => { setShowMenu(false); handleCancelPauseSubmit(); }} 
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '0.85rem', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: '4px', marginBottom: '4px', color: '#ef4444', fontWeight: 600 }}
                        >
                          🚫 Cancel Pause (Restore Dues)
                        </button>
                      )}
                      {tenant.status === 'vacated' || tenant.status === 'VACATED' ? (
                        <button onClick={handleReVacate} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '0.85rem', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: '4px', marginBottom: '4px', color: '#10b981', fontWeight: 500 }}>Re Vacate</button>
                      ) : (
                        <button onClick={handleVacate} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '0.85rem', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: '4px', marginBottom: '4px', color: '#eab308', fontWeight: 500 }}>Vacate Tenant</button>
                      )}
                      {tenant.status === 'notice_period' ? (
                        <button onClick={handleUndoNoticePeriod} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '0.85rem', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: '4px', color: '#10b981', fontWeight: 500 }}>Undo Notice Period</button>
                      ) : (
                        <button onClick={handleNoticePeriodClick} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '0.85rem', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: '4px', color: '#334155', fontWeight: 500 }}>Mark Notice Period</button>
                      )}
                      {canDeleteTenant && (
                        <button onClick={handleDeleteTenant} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '0.85rem', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: '4px', color: '#ef4444', fontWeight: 500, marginTop: '4px' }}>
                          🗑️ Delete Tenant
                        </button>
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
                    className={styles.tdInput}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <div className={styles.tdModalActions} style={{ marginTop: '24px' }}>
                    <button onClick={() => setShowNoticeModal(false)} className={styles.tdCancelBtn}>Cancel</button>
                    <button onClick={confirmNoticePeriod} className={styles.tdSaveBtn} disabled={!noticeDate}>Confirm</button>
                  </div>
                </motion.div>
              </div>
            )}

            {showPauseModal && (
              <div className={styles.tdModalOverlay}>
                <motion.div 
                  className={styles.tdModalContent}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                >
                  <h3>Pause Tenant Stay</h3>
                  <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: '18px', lineHeight: 1.4 }}>
                    Pausing stops future recurring rent cycles. Billing will restart when manually resumed.
                  </p>

                  <div style={{ padding: '12px 16px', background: '#fffbeb', borderRadius: '10px', border: '1px solid #fef3c7', marginBottom: '18px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#b45309', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>♾️</span> Tenant stay will be paused indefinitely until resumed.
                    </span>
                  </div>

                  {(() => {
                    const allPendingSources = [...(tenantDues || []), ...(paymentHistory || [])];
                    const map = new Map();
                    allPendingSources.forEach((p: any) => {
                      if (p && (p.status === 'pending' || p.status === 'PENDING')) {
                        const key = p.payment_id || p.id || `${p.month}_${p.amount}`;
                        if (!map.has(key)) {
                          map.set(key, p);
                        }
                      }
                    });
                    const pendingPayments = Array.from(map.values());

                    if (pendingPayments.length === 0) return null;

                    // Calculate dueDays for each pending payment
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    const enrichedPending = pendingPayments.map((p: any) => {
                      let createdAt = new Date(p.created_at || Date.now());

                      if (p.type !== 'one-time' && p.type !== 'maintenance-fee' && tenant?.move_in_date) {
                        const moveIn = new Date(tenant.move_in_date);
                        if (!isNaN(moveIn.getTime()) && moveIn.getTime() > createdAt.getTime()) {
                          createdAt = moveIn;
                        }
                      }

                      const dueDate = new Date(createdAt);
                      if (p.type !== 'one-time' && p.type !== 'maintenance-fee' && tenant?.status !== 'PAUSED') {
                        let targetDay = 5;
                        const moveInDateStr = tenant?.move_in_date || p.move_in_date;
                        if (moveInDateStr) {
                          const checkin = new Date(moveInDateStr);
                          if (!isNaN(checkin.getTime())) targetDay = checkin.getDate();
                        }
                        dueDate.setDate(targetDay);
                      }
                      dueDate.setHours(0, 0, 0, 0);
                      const dueDays = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                      return { ...p, dueDays };
                    });

                    // Sort by dueDays ascending (least overdue days first)
                    enrichedPending.sort((a, b) => a.dueDays - b.dueDays);

                    // Filter to display ONLY the fee(s) with the minimum dueDays (least overdue fee)
                    const minDueDays = enrichedPending[0]?.dueDays;
                    const displayingPayments = enrichedPending.filter(p => p.dueDays === minDueDays);

                    return (
                      <div style={{ marginBottom: '18px', background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                          Recent Pending Due (Check to CLEAR on pause):
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                          {displayingPayments.map((p: any) => {
                            const pId = p.payment_id || p.id;
                            const isChecked = selectedPauseClearDueIds.includes(pId);
                            const label = p.month ? `${p.month} Rent` : (p.description || 'Pending Fee');
                            const dueDays = p.dueDays;

                            return (
                              <label 
                                key={pId}
                                style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'space-between',
                                  padding: '10px 12px',
                                  borderRadius: '8px',
                                  border: `1px solid ${isChecked ? '#fca5a5' : '#cbd5e1'}`,
                                  background: isChecked ? '#fef2f2' : '#ffffff',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <input 
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedPauseClearDueIds(prev => [...prev, pId]);
                                      } else {
                                        setSelectedPauseClearDueIds(prev => prev.filter(id => id !== pId));
                                      }
                                    }}
                                    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#dc2626' }}
                                  />
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>{label}</span>
                                      {dueDays > 0 && (
                                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#b91c1c', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fca5a5' }}>
                                          {dueDays} days overdue
                                        </span>
                                      )}
                                      {dueDays === 0 && (
                                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#c2410c', background: '#ffedd5', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fed7aa' }}>
                                          Due Today
                                        </span>
                                      )}
                                      {dueDays < 0 && (
                                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#2563eb', background: '#dbeafe', padding: '2px 6px', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
                                          Due in {Math.abs(dueDays)} days
                                        </span>
                                      )}
                                    </div>
                                    <span style={{ display: 'block', fontSize: '0.75rem', color: isChecked ? '#dc2626' : '#64748b' }}>
                                      {isChecked ? 'Will be cleared on pause' : 'Will remain overdue'}
                                    </span>
                                  </div>
                                </div>
                                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: isChecked ? '#dc2626' : '#0f172a' }}>
                                  ₹{Number(p.amount || 0).toLocaleString('en-IN')}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  <div style={{ marginBottom: '18px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                      Charge Maintenance Fee on Pause?
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setPauseMaintenanceOption('none')}
                        style={{
                          flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                          background: pauseMaintenanceOption === 'none' ? '#eff6ff' : '#ffffff',
                          color: pauseMaintenanceOption === 'none' ? '#2563eb' : '#64748b',
                          borderColor: pauseMaintenanceOption === 'none' ? '#2563eb' : '#e2e8f0'
                        }}
                      >
                        No Maintenance Fee
                      </button>
                      <button
                        type="button"
                        onClick={() => setPauseMaintenanceOption('charge')}
                        style={{
                          flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                          background: pauseMaintenanceOption === 'charge' ? '#eff6ff' : '#ffffff',
                          color: pauseMaintenanceOption === 'charge' ? '#2563eb' : '#64748b',
                          borderColor: pauseMaintenanceOption === 'charge' ? '#2563eb' : '#e2e8f0'
                        }}
                      >
                        Charge Maintenance
                      </button>
                    </div>
                  </div>

                  {pauseMaintenanceOption === 'charge' && (
                    <div style={{ background: '#f1f5f9', padding: '12px', borderRadius: '10px', marginBottom: '18px' }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Maintenance Amount (₹)</label>
                      <input 
                        type="number" 
                        placeholder="e.g. 500"
                        value={pauseMaintenanceFee} 
                        onChange={(e) => setPauseMaintenanceFee(e.target.value)} 
                        className={styles.tdInput}
                      />
                      <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                        Will be added directly as a pending Maintenance Due.
                      </span>
                    </div>
                  )}

                  <div className={styles.tdModalActions} style={{ marginTop: '24px' }}>
                    <button onClick={() => setShowPauseModal(false)} className={styles.tdCancelBtn}>Cancel</button>
                    <button 
                      onClick={() => handlePauseSubmit()} 
                      className={styles.tdSaveBtn} 
                      disabled={isPausing} 
                      style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                    >
                      {isPausing ? 'Pausing...' : 'Confirm Pause'}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Resume Summary Modal */}
            {showResumeModal && (
              <div className={styles.tdModalOverlay}>
                <motion.div 
                  className={styles.tdModalContent}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                >
                  <h3>Resume Tenant Stay</h3>
                  <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: '16px' }}>
                    Resuming will restart the monthly rent cycle from <strong>Today</strong>.
                  </p>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Pause Start Date:</span>
                      <strong>{tenant.paused_at ? new Date(tenant.paused_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Today's Date (Resumption):</span>
                      <strong>{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Total Paused Duration:</span>
                      <strong>
                        {tenant.paused_at 
                          ? `${Math.max(1, Math.floor((Date.now() - new Date(tenant.paused_at).getTime()) / (1000 * 60 * 60 * 24)))} Days` 
                          : '1 Day'}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Pre-Pause Pending Due:</span>
                      <strong style={{ color: '#dc2626' }}>
                        ₹{paymentHistory.filter(p => p.status === 'pending').reduce((sum, p) => sum + Number(p.amount || 0), 0).toLocaleString('en-IN')}
                      </strong>
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Charge Maintenance Fee for Paused Period?
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setResumeMaintenanceOption('none')}
                        style={{
                          flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                          background: resumeMaintenanceOption === 'none' ? '#eff6ff' : '#ffffff',
                          color: resumeMaintenanceOption === 'none' ? '#2563eb' : '#64748b',
                          borderColor: resumeMaintenanceOption === 'none' ? '#2563eb' : '#e2e8f0'
                        }}
                      >
                        Resume Without Maintenance
                      </button>
                      <button
                        type="button"
                        onClick={() => setResumeMaintenanceOption('charge')}
                        style={{
                          flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                          background: resumeMaintenanceOption === 'charge' ? '#eff6ff' : '#ffffff',
                          color: resumeMaintenanceOption === 'charge' ? '#2563eb' : '#64748b',
                          borderColor: resumeMaintenanceOption === 'charge' ? '#2563eb' : '#e2e8f0'
                        }}
                      >
                        Charge Maintenance
                      </button>
                    </div>
                  </div>

                  {resumeMaintenanceOption === 'charge' && (
                    <div style={{ background: '#f1f5f9', padding: '12px', borderRadius: '10px', marginBottom: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Maintenance Amount (₹)</label>
                        <input 
                          type="number" 
                          placeholder="e.g. 500"
                          value={resumeMaintenanceFee} 
                          onChange={(e) => setResumeMaintenanceFee(e.target.value)} 
                          className={styles.tdInput}
                        />
                        <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                          Will be added directly as a pending Maintenance Due for the new billing cycle.
                        </span>
                      </div>
                    </div>
                  )}

                  <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', padding: '12px 14px', borderRadius: '10px', marginTop: '18px', marginBottom: '14px' }}>
                    <div style={{ fontSize: '0.8rem', color: '#9f1239', fontWeight: 700, marginBottom: '4px' }}>Did tenant cancel their home trip?</div>
                    <div style={{ fontSize: '0.76rem', color: '#be123c', lineHeight: 1.4, marginBottom: '10px' }}>
                      If the tenant decided not to go home, click below to restore active stay and restore all cleared dues with their original dates.
                    </div>
                    <button
                      type="button"
                      onClick={handleCancelPauseSubmit}
                      disabled={isPausing}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        background: '#e11d48',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      🚫 Cancel Pause (Restore Dues & Dates)
                    </button>
                  </div>

                  <div className={styles.tdModalActions} style={{ marginTop: '16px' }}>
                    <button onClick={() => setShowResumeModal(false)} className={styles.tdCancelBtn}>Close Modal</button>
                    <button onClick={handleResumeSubmit} className={styles.tdSaveBtn} disabled={isPausing} style={{ background: '#10b981' }}>
                      {isPausing ? 'Resuming...' : 'Confirm Resume'}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <div className={styles.tdThinDivider}></div>

          {(() => {
            const rentVal = Number(tenant.rent_amount ?? tenant.monthly_rent ?? tenant.rent ?? tenant.fee ?? tenant.room?.price ?? tenant.room?.rent ?? 0);
            const roomExtraFee = Number(tenant.room?.extra_fee ?? tenant.extra_fee ?? 0);
            const depositVal = Number(tenant.security_deposit ?? tenant.deposit ?? tenant.advance ?? 0);
            
            const depositPayment = paymentHistory?.find((p: any) => p.type === 'security_deposit' || p.type === 'security-deposit' || p.type === 'deposit');
            const isDepositPaid = depositPayment ? (depositPayment.status === 'paid' || depositPayment.status === 'PAID') : false;
            const hasDepositRecord = !!depositPayment || depositVal > 0;

            return (
              <div className={styles.tdRentSection}>
                <div className={styles.tdRentItem}>
                  <span className={styles.tdRentLabel}>Monthly Rent</span>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className={styles.tdRentValue}>₹{rentVal.toLocaleString('en-IN')}</span>
                    {roomExtraFee > 0 && (
                      <span style={{ fontSize: '0.7rem', color: '#93c5fd', fontWeight: 600, marginTop: '2px' }}>
                        + ₹{roomExtraFee.toLocaleString('en-IN')} Extra Fee (Total ₹{(rentVal + roomExtraFee).toLocaleString('en-IN')})
                      </span>
                    )}
                  </div>
                </div>
                <div className={styles.tdRentItem} style={{ textAlign: 'right' }}>
                  <span className={styles.tdRentLabel}>Security Deposit</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                    <span className={styles.tdRentValue}>₹{depositVal.toLocaleString('en-IN')}</span>
                    {hasDepositRecord && (
                      isDepositPaid ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#dcfce7', color: '#16a34a', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800 }}>
                          <CheckCircle2 size={12} style={{ marginRight: '2px' }} /> PAID
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#fee2e2', color: '#b91c1c', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800 }}>
                          <Clock size={12} style={{ marginRight: '2px' }} /> PENDING
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {(() => {
            const pendingPayments = tenantDues.filter((d: any) => d.status === 'pending');
            
            // Present Due Amount
            const presentDueVal = pendingPayments.reduce((sum: number, p: any) => {
              const total = Number(p.amount || 0);
              const paid = Number(p.paid_amount || 0);
              return sum + Math.max(0, total - paid);
            }, 0);

            // Overdue Days Calculation
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let maxOverdueDays = 0;

            if (presentDueVal > 0) {
              const today = new Date();
              today.setHours(0,0,0,0);
              
              // Calculate targetDay based on move in date
              let targetDay = 5;
              if (tenant?.move_in_date) {
                const checkin = new Date(tenant.move_in_date);
                if (!isNaN(checkin.getTime())) targetDay = checkin.getDate();
              }
              
              pendingPayments.forEach((p: any) => {
                let createdDate = new Date(p.created_at || Date.now());
                let dueDate = new Date(createdDate.getFullYear(), createdDate.getMonth(), targetDay);
                dueDate.setHours(0,0,0,0);
                
                const diffTime = today.getTime() - dueDate.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays > maxOverdueDays) {
                  maxOverdueDays = diffDays;
                }
              });
            }

            // Next Due Date Calculation
            let nextDueDateStr = 'N/A';
            if (tenant?.status === 'PAUSED') {
              nextDueDateStr = 'Paused';
            } else if (tenant?.is_active === false) {
              nextDueDateStr = 'Vacated';
            } else {
              const moveIn = tenant?.move_in_date ? new Date(tenant.move_in_date) : new Date();
              const dueDay = !isNaN(moveIn.getDate()) ? moveIn.getDate() : 1;
              const now = new Date();
              now.setHours(0,0,0,0);
              
              let target = new Date(now.getFullYear(), now.getMonth(), dueDay);
              if (now.getTime() >= target.getTime() || rentStatus === 'Paid') {
                target = new Date(now.getFullYear(), now.getMonth() + 1, dueDay);
              }

              const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
              const shortMonthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
              const paidMonths = (paymentHistory || []).filter((p: any) => p.status === 'PAID' || p.status === 'paid').map((p: any) => p.month || p.billing_month || p.period).filter(Boolean);

              let maxIterations = 24;
              while (maxIterations > 0) {
                const currentMonthFull = monthNames[target.getMonth()];
                const currentMonthShort = shortMonthNames[target.getMonth()];
                const isAlreadyPaid = paidMonths.some((m: string) => {
                  if (!m) return false;
                  const lowerM = String(m).toLowerCase();
                  return lowerM.includes(currentMonthFull.toLowerCase()) || lowerM.includes(currentMonthShort.toLowerCase());
                });

                if (isAlreadyPaid) {
                  target.setMonth(target.getMonth() + 1);
                  maxIterations--;
                } else {
                  break;
                }
              }
              
              nextDueDateStr = target.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            }

            return (
              <>
                <div className={styles.tdThinDivider}></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', padding: '4px 0', alignItems: 'stretch' }}>
                  {/* Present Due */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '8px 8px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.15)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <span style={{ fontSize: '0.62rem', color: 'rgba(255, 255, 255, 0.75)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Present Due
                    </span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: presentDueVal > 0 ? '#fca5a5' : '#86efac', marginTop: '2px', whiteSpace: 'nowrap' }}>
                      ₹{presentDueVal.toLocaleString('en-IN')}
                    </span>
                  </div>

                  {/* Overdue Days */}
                  <div style={{ background: maxOverdueDays > 0 ? 'rgba(239, 68, 68, 0.18)' : 'rgba(255, 255, 255, 0.08)', padding: '8px 8px', borderRadius: '10px', border: maxOverdueDays > 0 ? '1px solid rgba(248, 113, 113, 0.5)' : '1px solid rgba(255, 255, 255, 0.15)', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.62rem', color: maxOverdueDays > 0 ? '#fca5a5' : 'rgba(255, 255, 255, 0.75)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Overdue
                    </span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: maxOverdueDays > 0 ? '#f87171' : '#86efac', marginTop: '2px', whiteSpace: 'nowrap' }}>
                      {maxOverdueDays > 0 ? `${maxOverdueDays} Days` : '0 Days'}
                    </span>
                  </div>

                  {/* Next Due Date */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '8px 8px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.15)', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'right' }}>
                    <span style={{ fontSize: '0.62rem', color: 'rgba(255, 255, 255, 0.75)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Next Due Date
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#38bdf8', marginTop: '2px', whiteSpace: 'nowrap' }}>
                      {nextDueDateStr}
                    </span>
                  </div>
                </div>
              </>
            );
          })()}

          <div style={{ marginTop: '12px' }}>
            {!isEditing ? (
              <>
                <button 
                  onClick={isLockedForDeletion ? undefined : handleEditClick}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.18)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: isLockedForDeletion ? 'not-allowed' : 'pointer',
                    opacity: isLockedForDeletion ? 0.5 : 1,
                    transition: 'all 0.2s ease',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
                  }}
                >
                  <Edit size={16} /> Edit Basic Details
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                <button 
                  onClick={() => setIsEditing(false)}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.22)',
                    border: '1px solid rgba(255, 255, 255, 0.35)',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: '#10B981',
                    border: 'none',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                  }}
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            )}
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
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* ── WHATSAPP NOTIFICATION SUITE CARD ── */}
            <div className={styles.tdNewContentCard} style={{ border: '1px solid #bbf7d0', background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#25D366', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MessageSquare size={16} />
                  </div>
                  <h3 className={styles.tdNewCardTitle} style={{ margin: 0, color: '#166534' }}>
                    WhatsApp Notification Suite
                  </h3>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, color: tenant.whatsappEnabled !== false ? '#15803d' : '#64748b' }}>
                  <input
                    type="checkbox"
                    checked={tenant.whatsappEnabled !== false}
                    onChange={async (e) => {
                      const val = e.target.checked;
                      setTenant({ ...tenant, whatsappEnabled: val });
                      await toggleTenantWhatsAppAction(resolvedParams.id, val);
                    }}
                    style={{ width: '16px', height: '16px', accentColor: '#16a34a', cursor: 'pointer' }}
                  />
                  {tenant.whatsappEnabled !== false ? 'WhatsApp Enabled' : 'WhatsApp Disabled'}
                </label>
              </div>

              {tenant.whatsappEnabled === false ? (
                <div style={{ padding: '12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b', fontSize: '0.82rem', fontWeight: 600 }}>
                  ⚠️ WhatsApp notifications are currently disabled for this tenant. Check the toggle above to re-enable.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                  <button
                    onClick={() => handleSendWhatsApp('WELCOME')}
                    disabled={waSending}
                    style={{ padding: '12px', borderRadius: '12px', background: '#ffffff', border: '1px solid #86efac', color: '#15803d', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <Send size={16} /> Send Welcome Message
                  </button>
                </div>
              )}
            </div>

            <div className={styles.tdNewContentCard}>
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
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '4px', display: 'block' }}>Monthly Rent (₹)</label>
                  <input 
                    type="number" 
                    value={editData.rentAmount || ''}
                    onChange={(e) => setEditData({...editData, rentAmount: Number(e.target.value)})}
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
            </div>

            {/* Moved ID Proofs & Documents inside Basic Details */}
            <div className={styles.tdNewContentCard}>
              <h3 className={styles.tdNewCardTitle}>ID Proofs & Documents</h3>
            {isEditing && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#4F46E5', marginBottom: '2px' }}>
                  Upload / Replace Documents & Photos
                </div>

                {/* Face Photo Input */}
                <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '12px', border: '1px dashed #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '8px', overflow: 'hidden', background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {previews.facePicture ? <img src={previews.facePicture} alt="Face" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Plus size={20} color="#64748B" />}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1E293B' }}>Tenant Profile Photo</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{documentsToUpload.facePicture ? documentsToUpload.facePicture.name : previews.facePicture ? 'Uploaded' : 'No photo uploaded'}</div>
                    </div>
                  </div>
                  <label style={{ padding: '6px 14px', background: '#4F46E5', color: '#FFF', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                    Upload
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFileSelect('facePicture', e.target.files?.[0] || null)} />
                  </label>
                </div>

                {/* Govt ID Front */}
                <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '12px', border: '1px dashed #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '8px', overflow: 'hidden', background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {previews.govtFront ? <img src={previews.govtFront} alt="Govt Front" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Plus size={20} color="#64748B" />}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1E293B' }}>Govt ID Proof (Front)</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{documentsToUpload.govtFront ? documentsToUpload.govtFront.name : previews.govtFront ? 'Uploaded' : 'No ID front uploaded'}</div>
                    </div>
                  </div>
                  <label style={{ padding: '6px 14px', background: '#4F46E5', color: '#FFF', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                    Upload
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFileSelect('govtFront', e.target.files?.[0] || null)} />
                  </label>
                </div>

                {/* Govt ID Back */}
                <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '12px', border: '1px dashed #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '8px', overflow: 'hidden', background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {previews.govtBack ? <img src={previews.govtBack} alt="Govt Back" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Plus size={20} color="#64748B" />}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1E293B' }}>Govt ID Proof (Back)</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{documentsToUpload.govtBack ? documentsToUpload.govtBack.name : previews.govtBack ? 'Uploaded' : 'No ID back uploaded'}</div>
                    </div>
                  </div>
                  <label style={{ padding: '6px 14px', background: '#4F46E5', color: '#FFF', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                    Upload
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFileSelect('govtBack', e.target.files?.[0] || null)} />
                  </label>
                </div>
              </div>
            )}

            {(() => {
              const docs = tenant.documents || {};
              const docList = [
                { key: 'facePicture', label: 'Face Photo', url: docs.facePicture || tenant.face_picture },
                { key: 'govtFront', label: 'Govt Proof (Front)', url: docs.govtFront },
                { key: 'govtBack', label: 'Govt Proof (Back)', url: docs.govtBack },
                { key: 'collegeFront', label: 'College ID (Front)', url: docs.collegeFront },
                { key: 'collegeBack', label: 'College ID (Back)', url: docs.collegeBack },
                { key: 'empFront', label: 'Emp ID (Front)', url: docs.empFront },
                { key: 'empBack', label: 'Emp ID (Back)', url: docs.empBack },
              ].filter(d => Boolean(d.url));

              if (docList.length === 0) {
                return (
                  <div style={{ padding: '12px 0', fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center' }}>
                    No documents uploaded for this tenant yet.
                  </div>
                );
              }

              return (
                <div className={styles.tdIdProofsGrid}>
                  {docList.map(doc => (
                    <div 
                      key={doc.key} 
                      className={styles.tdIdProofItem}
                      onClick={() => setPreviewImage({ url: doc.url, title: doc.label })}
                    >
                      <div className={styles.tdIdProofImage}>
                        <img src={doc.url} alt={doc.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <span className={styles.tdIdProofLabel}>{doc.label}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
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
              
              <div className={styles.tdNewInfoRow}>
                <User size={18} className={styles.tdNewInfoIcon} />
                <div className={styles.tdNewInfoContent}>
                  <div className={styles.tdNewInfoLabel}>Added By</div>
                  <div className={styles.tdNewInfoValue}>{tenant.added_by_name || 'Owner'}</div>
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
                  {(() => {
                    const origDateStr = tenant.original_move_in_date || tenant.old_check_in_date;
                    const currDateStr = tenant.move_in_date || tenant.created_at;
                    const isResumedTenant = Boolean(
                      origDateStr && 
                      currDateStr && 
                      new Date(origDateStr).toDateString() !== new Date(currDateStr).toDateString()
                    );

                    if (isResumedTenant) {
                      return (
                        <div className={styles.tdNewInfoRow} style={{ alignItems: 'flex-start' }}>
                          <LogIn size={18} className={styles.tdNewInfoIcon} style={{ marginTop: '2px' }} />
                          <div className={styles.tdNewInfoContent}>
                            <div className={styles.tdNewInfoLabel}>Check-In Details</div>
                            
                            {/* Old Check-In Date */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', fontSize: '0.8125rem', color: '#64748b' }}>
                              <span>Old Check-In:</span>
                              <span style={{ textDecoration: 'line-through', color: '#94a3b8', fontWeight: 600 }}>
                                {new Date(origDateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                              <span style={{ fontSize: '0.68rem', background: '#f1f5f9', color: '#475569', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                Paused
                              </span>
                            </div>

                            {/* New Check-In Date (Glowing in Green Text) */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#047857' }}>
                                New Check-In (Resumed):
                              </span>
                              <span 
                                style={{ 
                                  fontSize: '0.925rem', 
                                  fontWeight: 800, 
                                  color: '#10b981', 
                                  background: '#ecfdf5', 
                                  padding: '2px 8px', 
                                  borderRadius: '6px', 
                                  border: '1px solid #a7f3d0',
                                  textShadow: '0 0 8px rgba(16, 185, 129, 0.3)'
                                }}
                              >
                                {new Date(currDateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
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
                    );
                  })()}
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
          </motion.div>
        )}

        {activeTab === 'Payment History' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className={styles.tdNewContentCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 className={styles.tdNewCardTitle} style={{ marginBottom: 0 }}>Fee Payments & Dues</h3>
                <button 
                  type="button"
                  onClick={() => {
                    if (isLockedForDeletion) return;
                    setAddPaymentAmount(String(tenant?.rent_amount ?? tenant?.monthly_rent ?? tenant?.fee ?? tenant?.room?.rent ?? ''));
                    setShowAddPaymentModal(true);
                  }} 
                  className={styles.tdPrimaryButton} 
                  style={{ padding: '8px 16px', fontSize: '0.85rem', width: 'auto', display: 'flex', alignItems: 'center', gap: '6px', cursor: isLockedForDeletion ? 'not-allowed' : 'pointer', opacity: isLockedForDeletion ? 0.5 : 1 }}
                >
                  <Plus size={16} /> Add Payment
                </button>
              </div>
              
              {isPaymentsLoading ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>Loading details...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Pending Dues Section */}
                  {(() => {
                    const pendingList = (paymentHistory || []).filter((p: any) => p.status === 'pending' || p.status === 'PENDING');
                    if (pendingList.length === 0) return null;

                    return (
                      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '16px' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '0.92rem', fontWeight: 700, color: '#991b1b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={16} /> Pending Dues & Unpaid Bills
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {pendingList.map((p, idx) => {
                            const title = p.description || (p.type === 'security_deposit' || p.type === 'security-deposit' ? 'Security Deposit' : `Monthly Rent (${p.month || 'Current'})`);
                            const amt = Number(p.amount || 0);
                            return (
                              <div key={idx} style={{ background: '#ffffff', border: '1px solid #fee2e2', borderRadius: '10px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                <div>
                                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>
                                    {title}
                                  </div>
                                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                                    Due Date: {new Date(p.created_at || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#dc2626' }}>
                                    ₹{amt.toLocaleString('en-IN')}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAddPaymentAmount(String(amt));
                                      if (p.type === 'security_deposit' || p.type === 'security-deposit') setAddPaymentCategory('security-deposit');
                                      else setAddPaymentCategory('rent');
                                      if (p.month) setAddPaymentMonth(p.month);
                                      setShowAddPaymentModal(true);
                                    }}
                                    style={{ padding: '6px 12px', borderRadius: '8px', background: '#dc2626', color: '#fff', border: 'none', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                                  >
                                    Collect Payment
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Payment History (Completed Transactions) */}
                  <div>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '0.92rem', fontWeight: 700, color: '#1e293b' }}>
                      Payment Transaction History
                    </h4>
                    {(() => {
                      const paidList = (paymentHistory || []).filter((p: any) => p.status === 'paid' || p.status === 'PAID' || p.is_paid === true);
                      if (paidList.length === 0) {
                        return (
                          <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', fontSize: '0.88rem' }}>
                            No completed payment transactions recorded yet.
                          </div>
                        );
                      }

                      // Calculate total current pending dues for accurate "Due After Payment" display
                      const totalCurrentPendingDues = (paymentHistory || [])
                        .filter((p: any) => p.status === 'pending' || p.status === 'PENDING')
                        .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {paidList.map((payment, idx) => {
                            // Analytics Calculation
                            let analysisText = '';
                            let analysisColor = '#64748b'; // default gray
                            
                            if (tenant?.move_in_date) {
                              const paymentDate = new Date(payment.payment_date || payment.created_at);
                              paymentDate.setHours(0, 0, 0, 0);
                              
                              let dueDate = new Date(paymentDate);
                              
                              if (payment.month) {
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
                                analysisColor = '#10b981';
                              } else if (diffDays > 0) {
                                analysisText = `Paid ${diffDays} day${diffDays > 1 ? 's' : ''} late`;
                                analysisColor = '#ef4444';
                              } else {
                                const earlyDays = Math.abs(diffDays);
                                analysisText = `Paid ${earlyDays} day${earlyDays > 1 ? 's' : ''} before`;
                                analysisColor = '#10b981';
                              }
                            }

                            const remainingDue = payment.remaining_due ?? payment.due_after_payment ?? (payment.is_partial ? Number(payment.pending_amount || 0) : totalCurrentPendingDues);

                            return (
                              <div key={idx} className={styles.tdPaymentCard} style={{ position: 'relative', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <h4 className={styles.tdPaymentAmount} style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                                        ₹{Number(payment.amount_paid || payment.amount || 0).toLocaleString('en-IN')}
                                      </h4>
                                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669', background: '#d1fae5', padding: '2px 8px', borderRadius: '12px' }}>
                                        Success
                                      </span>
                                    </div>
                                    <p className={styles.tdPaymentDate} style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                                      Paid on {new Date(payment.payment_date || payment.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} 
                                      {` • Fee Paid: ${payment.paid_fee_summary || payment.description || payment.month || 'Rent'}`} • via {payment.payment_method || 'UPI'}
                                    </p>
                                  </div>

                                  <button 
                                    type="button"
                                    onClick={() => setSelectedReceiptPayment({ ...payment, remainingDue })}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      padding: '6px 12px',
                                      borderRadius: '8px',
                                      border: '1px solid #cbd5e1',
                                      background: '#f8fafc',
                                      color: '#0f172a',
                                      fontSize: '0.78rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    <Receipt size={14} color="#2563eb" />
                                    View Receipt
                                  </button>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #f1f5f9' }}>
                                  {analysisText ? (
                                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: analysisColor }}>
                                      {analysisText}
                                    </div>
                                  ) : <div />}

                                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: remainingDue > 0 ? '#dc2626' : '#059669' }}>
                                    Due After Payment: {remainingDue > 0 ? `₹${remainingDue.toLocaleString('en-IN')}` : '₹0 (Settled)'}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
        
        {activeTab === 'Activity Logs' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={styles.tdNewContentCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 className={styles.tdNewCardTitle} style={{ marginBottom: '4px' }}>Tenant Activity & Timeline History</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Complete lifecycle history including stay check-in, pause periods, resumptions, dues, and payments.</p>
              </div>
            </div>

            {isLogsLoading ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px', display: 'block' }} />
                Loading activity history...
              </div>
            ) : combinedTimeline.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                No activity history recorded yet.
              </div>
            ) : (
              <div style={{ position: 'relative', paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '10px' }}>
                {/* Timeline Connecting Bar */}
                <div style={{ position: 'absolute', left: '11px', top: '12px', bottom: '12px', width: '2px', backgroundColor: '#cbd5e1' }} />

                {combinedTimeline.map((item: any, idx: number) => {
                  return (
                    <div key={item.id || idx} style={{ position: 'relative' }}>
                      {/* Timeline Icon Node */}
                      <div 
                        style={{
                          position: 'absolute',
                          left: '-24px',
                          top: '2px',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: item.badgeBg || '#eff6ff',
                          border: `2px solid ${item.badgeColor || '#3b82f6'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: item.badgeColor || '#3b82f6',
                          zIndex: 2
                        }}
                      >
                        {item.iconType === 'PAUSE' ? (
                          <Pause size={12} fill="currentColor" />
                        ) : item.iconType === 'RESUME' ? (
                          <Play size={12} fill="currentColor" />
                        ) : item.iconType === 'PAYMENT' ? (
                          <CreditCard size={12} />
                        ) : item.iconType === 'CHECKIN' ? (
                          <LogIn size={12} />
                        ) : (
                          <Clock size={12} />
                        )}
                      </div>

                      {/* Timeline Card */}
                      <div 
                        style={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '12px',
                          padding: '14px 16px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.92rem' }}>
                              {item.title}
                            </span>
                            <span 
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                color: item.badgeColor,
                                backgroundColor: item.badgeBg,
                                padding: '2px 8px',
                                borderRadius: '12px',
                                border: `1px solid ${item.badgeColor}33`
                              }}
                            >
                              {item.type}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={13} />
                            {item.dateStr} • {item.timeStr}
                          </span>
                        </div>

                        <p style={{ margin: 0, fontSize: '0.84rem', color: '#334155', lineHeight: 1.5 }}>
                          {item.description}
                        </p>

                        {item.performedBy && (
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '8px' }}>
                            Logged by {item.performedBy}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </div>


      


      {/* Fullscreen Lightbox Image Viewer Modal */}
      <AnimatePresence>
        {previewImage && (
          <div 
            onClick={() => setPreviewImage(null)}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              style={{ position: 'relative', maxWidth: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '12px', color: '#fff' }}>
                <span style={{ fontWeight: 600, fontSize: '1rem' }}>{previewImage.title}</span>
                <button 
                  onClick={() => setPreviewImage(null)}
                  style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 700 }}
                >
                  ✕
                </button>
              </div>
              <img 
                src={previewImage.url} 
                alt={previewImage.title} 
                style={{ width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '70vh', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', objectFit: 'contain' }} 
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payment Receipt Modal */}
      <AnimatePresence>
        {selectedReceiptPayment && (
          <div 
            onClick={() => setSelectedReceiptPayment(null)}
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(4px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '460px',
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                overflow: 'hidden'
              }}
            >
              {/* Receipt Header */}
              <div style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', padding: '20px', color: '#ffffff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Receipt size={22} color="#38bdf8" />
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.5px' }}>PAYMENT RECEIPT</span>
                  </div>
                  <button 
                    onClick={() => setSelectedReceiptPayment(null)}
                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', fontWeight: 700 }}
                  >
                    &times;
                  </button>
                </div>
                <div style={{ marginTop: '12px', fontSize: '0.8rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Receipt No: #{String(selectedReceiptPayment.id || 'REC-84920').substring(0, 8).toUpperCase()}</span>
                  <span>Date: {new Date(selectedReceiptPayment.payment_date || selectedReceiptPayment.created_at || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
              </div>

              {/* Receipt Body */}
              <div style={{ padding: '20px' }}>
                <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '14px', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Tenant Details</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{tenant?.full_name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '2px' }}>Room {tenant?.room?.room_number || 'N/A'} • {tenant?.mobile || '-'}</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px dashed #e2e8f0' }}>
                    <span style={{ color: '#64748b' }}>Payment Category</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedReceiptPayment.type === 'maintenance-fee' ? 'Maintenance Fee' : selectedReceiptPayment.type === 'security-deposit' ? 'Security Deposit' : 'Monthly Rent'}</span>
                  </div>
                  {selectedReceiptPayment.month && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px dashed #e2e8f0' }}>
                      <span style={{ color: '#64748b' }}>For Period</span>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedReceiptPayment.month}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px dashed #e2e8f0' }}>
                    <span style={{ color: '#64748b' }}>Payment Method</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedReceiptPayment.payment_method || 'UPI'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px dashed #e2e8f0' }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>Amount Paid</span>
                    <span style={{ fontWeight: 800, color: '#059669', fontSize: '1.05rem' }}>₹{Number(selectedReceiptPayment.amount_paid || selectedReceiptPayment.amount || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px' }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>Due Amount Remaining</span>
                    <span style={{ fontWeight: 700, color: (selectedReceiptPayment.remainingDue || 0) > 0 ? '#dc2626' : '#059669' }}>
                      {(selectedReceiptPayment.remainingDue || 0) > 0 ? `₹${Number(selectedReceiptPayment.remainingDue).toLocaleString('en-IN')}` : '₹0 (Settled)'}
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: '20px', background: '#ecfdf5', borderRadius: '10px', padding: '10px 14px', border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={18} color="#059669" />
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#065f46' }}>Verified Payment • Raliving Management System</span>
                </div>
              </div>

              {/* Modal Actions */}
              <div style={{ padding: '12px 20px 20px', display: 'flex', gap: '10px' }}>
                <button 
                  type="button"
                  onClick={() => window.print()}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#0f172a',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Printer size={16} /> Print Receipt
                </button>
                <button 
                  type="button"
                  onClick={() => setSelectedReceiptPayment(null)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Payment Modal */}
      <AnimatePresence>
        {showAddPaymentModal && (
          <div 
            onClick={() => setShowAddPaymentModal(false)}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%', maxWidth: '440px', backgroundColor: '#ffffff', borderRadius: '16px',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', overflow: 'hidden'
              }}
            >
              <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Record Payment</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b' }}>Record a fee payment for {tenant?.full_name}</p>
                </div>
                <button onClick={() => setShowAddPaymentModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: '#64748b', cursor: 'pointer' }}>
                  &times;
                </button>
              </div>

              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {(() => {
                  const pending = (paymentHistory || []).filter((p: any) => p.status === 'pending' || p.status === 'PENDING');
                  if (pending.length === 0) return null;
                  return (
                    <div style={{ padding: '12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#d97706', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertTriangle size={14} /> Quick Select Pending Due
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {pending.map((p: any) => {
                          const dueAmt = p.pending_amount || p.amount || 0;
                          const label = p.month ? `${p.month} ${p.type === 'rent' ? 'Rent' : p.type}` : p.type;
                          return (
                            <button
                              key={p.id}
                              onClick={() => {
                                setAddPaymentAmount(String(dueAmt));
                                setAddPaymentCategory(p.type as any || 'rent');
                                if (p.month) setAddPaymentMonth(p.month);
                              }}
                              style={{
                                padding: '6px 12px', background: '#ffffff', border: '1px solid #fcd34d', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, color: '#92400e', cursor: 'pointer', transition: 'all 0.2s',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#fef3c7'}
                              onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                            >
                              {label} - ₹{Number(dueAmt).toLocaleString('en-IN')}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Amount Paid (₹)*</label>
                  <input 
                    type="number"
                    placeholder="e.g. 9500"
                    value={addPaymentAmount}
                    onChange={(e) => setAddPaymentAmount(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}
                  />
                </div>

                <div style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Payment Category</label>
                  <div 
                    onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${isCategoryDropdownOpen ? '#4f46e5' : '#cbd5e1'}`, fontSize: '0.9rem', color: '#0f172a', background: '#fff', cursor: 'pointer', boxShadow: isCategoryDropdownOpen ? '0 0 0 3px rgba(79, 70, 229, 0.15)' : 'none', transition: 'all 0.2s' }}
                  >
                    <span>
                      {addPaymentCategory === 'rent' ? 'Monthly Rent' : 
                       addPaymentCategory === 'maintenance-fee' ? 'Maintenance Fee' :
                       addPaymentCategory === 'security-deposit' ? 'Security Deposit' : 'One-Time Fee / Other'}
                    </span>
                    <ChevronDown size={16} color="#64748b" style={{ transform: isCategoryDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                  </div>
                  
                  <AnimatePresence>
                    {isCategoryDropdownOpen && (
                      <>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setIsCategoryDropdownOpen(false)} />
                        <motion.div 
                          initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.15 }}
                          style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: '100%', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '10px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)', zIndex: 20, overflow: 'hidden' }}
                        >
                          {[
                            { val: 'rent', label: 'Monthly Rent' },
                            { val: 'maintenance-fee', label: 'Maintenance Fee' },
                            { val: 'security-deposit', label: 'Security Deposit' },
                            { val: 'one-time', label: 'One-Time Fee / Other' }
                          ].map((opt) => (
                            <div 
                              key={opt.val}
                              onClick={() => { setAddPaymentCategory(opt.val as any); setIsCategoryDropdownOpen(false); }}
                              style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: addPaymentCategory === opt.val ? 700 : 500, color: addPaymentCategory === opt.val ? '#4f46e5' : '#334155', background: addPaymentCategory === opt.val ? '#e0e7ff' : '#fff', borderBottom: opt.val !== 'one-time' ? '1px solid #f1f5f9' : 'none', transition: 'background 0.15s' }}
                              onMouseEnter={(e) => { if (addPaymentCategory !== opt.val) e.currentTarget.style.background = '#f8fafc'; }}
                              onMouseLeave={(e) => { if (addPaymentCategory !== opt.val) e.currentTarget.style.background = '#fff'; }}
                            >
                              {opt.label}
                            </div>
                          ))}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Billing Period / Month</label>
                  <input 
                    type="text"
                    placeholder="e.g. July 2026"
                    value={addPaymentMonth}
                    onChange={(e) => setAddPaymentMonth(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Payment Method</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['UPI', 'Cash', 'Bank Transfer', 'Card'].map(pm => (
                      <button
                        key={pm}
                        type="button"
                        onClick={() => setAddPaymentMethod(pm)}
                        style={{
                          flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                          background: addPaymentMethod === pm ? '#eff6ff' : '#ffffff',
                          color: addPaymentMethod === pm ? '#2563eb' : '#64748b',
                          borderColor: addPaymentMethod === pm ? '#2563eb' : '#cbd5e1'
                        }}
                      >
                        {pm}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ padding: '12px 20px 20px', display: 'flex', gap: '10px', borderTop: '1px solid #f1f5f9' }}>
                <button onClick={() => setShowAddPaymentModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button 
                  onClick={handleRecordPaymentSubmit} 
                  disabled={isSubmittingPayment}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#10b981', color: '#ffffff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  {isSubmittingPayment ? 'Recording...' : 'Confirm & Save Payment'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
