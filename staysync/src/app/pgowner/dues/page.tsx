"use client";



import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';

import { motion, AnimatePresence } from 'framer-motion';

import { Bell, CheckCircle, Search, Filter, Phone, Building2, MessageCircle, AlertCircle, Calendar, Play, Check, Loader2, Lock, Banknote } from 'lucide-react';

import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';

import { getPendingDues } from '@/app/actions/pgowner';

import { useRouter, useSearchParams } from 'next/navigation';

import styles from './dues.module.css';

import { sendRentReminderAction } from '@/app/actions/whatsapp';
import { useHostelData, notifyHostelDataChanged } from '@/hooks/useHostelData';
import { useHostel } from '@/context/HostelContext';
import { getAppState } from '@/lib/appStateStore';
import { getTenantPaymentStatus } from '@/lib/paymentStatus';

import { AnimatedButton } from '@/components/AnimatedButton';

import { IndianRupee, X, XCircle } from 'lucide-react';

import { markPaymentPaid, recordPartialPayment, getTenants, collectUpcomingPayment, collectFIFOPayment, getPaymentHistory, updateTenantStatus } from '@/app/actions/pgowner';
import { rpcCall } from '@/lib/rpc';
import { 
  parseMoneyToPaise, 
  formatPaiseToINR, 
  paiseToRupees, 
  calculateTenantFinancialState 
} from '@/lib/financialEngine';

import { CustomSelect } from '@/components/CustomSelect';
import { PaymentSuccessModal } from '@/components/PaymentSuccessModal';
import { useConfirm, useAlert } from '@/context/ConfirmContext';

import { Users, Clock } from 'lucide-react';



const WhatsappIcon = ({ size = 24, color = "currentColor", fill = "currentColor" }) => (

  <svg viewBox="0 0 24 24" width={size} height={size} fill={fill} xmlns="http://www.w3.org/2000/svg">

    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.82 9.82 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>

  </svg>

);



const getSortPriority = (d: any) => {
  const isPaused = d.tenantStatus === 'Paused' || d.tenantStatus === 'PAUSED';
  const isVacated = d.tenantStatus === 'Vacated' || d.tenantStatus === 'vacated' || d.tenantStatus === 'VACATED';
  
  const dueDays = d.dueDays ?? d.oldestDueDays ?? 0;
  
  if (dueDays === 0) {
    return { category: 1, subRank: 0 };
  }
  if (dueDays > 0 || d.isOverdue) {
    return { category: 2, subRank: dueDays };
  }
  if (isPaused) {
    return { category: 3, subRank: 0 };
  }
  if (isVacated) {
    return { category: 3.5, subRank: 0 };
  }
  return { category: 4, subRank: Math.abs(dueDays) };
};

const sortDuesList = (list: any[]) => {
  return [...list].sort((a, b) => {
    const pA = getSortPriority(a);
    const pB = getSortPriority(b);
    if (pA.category !== pB.category) {
      return pA.category - pB.category;
    }
    return pA.subRank - pB.subRank;
  });
};

const processDuesData = (rawPendingData: any[], rawTenantsData: any[], rawPaidData: any[] = []) => {
  const tenantsList = rawTenantsData || [];
  if (tenantsList.length === 0) return [];

  const duesList: any[] = [];

  tenantsList.forEach((t: any) => {
    const tid = t.id || t.tenant_id;
    if (!tid) return;

    const state = calculateTenantFinancialState(t, rawPendingData || [], rawPaidData || []);
    
    // Only show tenants with positive outstanding balance
    if (state.outstandingPaise <= 0) return;

    const tenantStatus = t.is_active === false || t.status === 'Vacated' || t.status === 'VACATED' ? 'Vacated' : (t.status === 'notice_period' || t.status === 'Notice Period' ? 'Notice Period' : (t.status === 'PAUSED' || t.status === 'Paused' ? 'Paused' : 'Active'));
    const isPaused = tenantStatus === 'Paused';
    const isVacated = tenantStatus === 'Vacated';

    const facePicture = t.face_picture || t.facePicture || t.documents?.photo || t.documents?.facePicture || t.documents?.photo_url || t.avatar || t.photo_url || t.photoUrl || null;

    const charges = state.charges
      .filter(c => c.remainingPaise > 0)
      .map(c => ({
        ...c,
        id: c.chargeId,
        payment_id: c.chargeId,
        amount: paiseToRupees(c.remainingPaise),
        amount_paise: c.remainingPaise,
        original_amount: paiseToRupees(c.amountPaise),
        original_amount_paise: c.amountPaise,
        amount_paid: paiseToRupees(c.paidPaise),
        amount_paid_paise: c.paidPaise,
        dueDays: c.dueDays,
        isOverdue: c.isOverdue,
        month: c.billingPeriod || c.description
      }));

    if (charges.length === 0) return;

    const outstandingRupees = paiseToRupees(state.outstandingPaise);
    const oldestDueDays = state.daysOverdue;

    duesList.push({
      tenant_id: tid,
      tenant_name: t.full_name || t.name || 'Tenant',
      tenant_phone: t.mobile || t.phone || '',
      room_number: t.room_number || t.room || 'N/A',
      tenantStatus,
      isPaused,
      isVacated,
      facePicture,
      totalAmount: outstandingRupees,
      amount: outstandingRupees,
      amount_paise: state.outstandingPaise,
      oldestDueDays,
      dueDays: oldestDueDays,
      isOverdue: oldestDueDays > 0,
      payment_id: tid,
      month: charges.length > 1 ? `${charges.length} Pending Charges` : charges[0]?.month || 'Rent',
      charges
    });
  });

  return sortDuesList(duesList);
};

function DuesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedPgId: contextPgId } = useHostel();
  const confirm = useConfirm();
  const alert = useAlert();

  const activePgId = searchParams.get('pgId') || contextPgId || (typeof localStorage !== 'undefined' ? localStorage.getItem('activePgId') : null);
  const { data: hostelData, isLoading: isHostelLoading, mutate } = useHostelData(activePgId);

  const memCache = typeof window !== 'undefined' && activePgId ? getAppState(`hostelData_${activePgId}`)?.data : null;
  const effectiveHostelData = hostelData || memCache;

  const storeDues = effectiveHostelData?.dues;
  const storeTenants = effectiveHostelData?.tenants;
  const storePayments = effectiveHostelData?.payments;

  const dues = useMemo(() => {
    if (storeDues && storeTenants) {
      return processDuesData(storeDues, storeTenants, storePayments || []);
    }
    return [];
  }, [storeDues, storeTenants, storePayments]);

  const showSkeleton = isHostelLoading && !effectiveHostelData && !!activePgId;
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [paidPayments, setPaidPayments] = useState<any[]>([]);
  const [successModalData, setSuccessModalData] = useState<any>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [confirmingAction, setConfirmingAction] = useState<{ id: string, type: 'full' | 'settle' | 'partial' } | null>(null);
  const [collectedAmount, setCollectedAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [selectedChargesMap, setSelectedChargesMap] = useState<Record<string, number[]>>({});
  const [isCollecting, setIsCollecting] = useState(false);
  const [remindingTenantId, setRemindingTenantId] = useState<string | null>(null);
  const [remindedTenantId, setRemindedTenantId] = useState<string | null>(null);
  const [remindFailedId, setRemindFailedId] = useState<string | null>(null);

  const getSelectedChargeIndices = (due: any): number[] => {
    if (!due.charges || due.charges.length === 0) return [];
    const key = due.payment_id;
    if (selectedChargesMap[key] !== undefined) {
      return selectedChargesMap[key];
    }
    return due.charges.map((_: any, idx: number) => idx);
  };

  const handleToggleCharge = (due: any, chargeIdx: number) => {
    const key = due.payment_id;
    const currentSelected = getSelectedChargeIndices(due);
    let updated: number[];
    if (currentSelected.includes(chargeIdx)) {
      updated = currentSelected.filter(i => i !== chargeIdx);
    } else {
      updated = [...currentSelected, chargeIdx];
    }
    setSelectedChargesMap(prev => ({ ...prev, [key]: updated }));
    const newTotal = updated.reduce((sum, i) => sum + Number(due.charges[i]?.amount || 0), 0);
    setCollectedAmount(newTotal);
  };
  const [tenants, setTenants] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ status: 'All', duration: 'All', month: '' });
  const [localFilters, setLocalFilters] = useState({ status: 'All', duration: 'All', month: '' });

  // Bulk Remind Modal states
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [bulkSendResult, setBulkSendResult] = useState<{ success: number; fail: number } | null>(null);

  const overdue15Dues = useMemo(() => {
    return dues.filter((d: any) => d.isOverdue && (d.dueDays > 15 || d.oldestDueDays > 15));
  }, [dues]);

  const hasRealtimeSnapshot = React.useRef(false);

  // Load fresh dues directly from server / snapshot without flashing stale SWR cache



  // Real-time Firestore listener for instant live Dues update (Authoritative Source of Truth)
  useEffect(() => {
    const targetUid = ownerId || auth.currentUser?.uid;
    if (!targetUid) return;
    try {
      const q = activePgId
        ? query(collection(db, 'payments'), where('pg_id', '==', activePgId), where('status', '==', 'pending'))
        : query(collection(db, 'payments'), where('owner_id', '==', targetUid), where('status', '==', 'pending'));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        hasRealtimeSnapshot.current = true;
        if (activePgId) {
          notifyHostelDataChanged(activePgId);
          mutate();
        }
      }, (err) => {
        // Fallback gracefully without console error noise
      });
      return () => unsubscribe();
    } catch (e) {}
  }, [ownerId, activePgId, mutate]);

  const fetchDues = async (uid?: string) => {
    try {
      if (activePgId) {
        notifyHostelDataChanged(activePgId);
        mutate();
      }
    } catch (e) {
      console.error(e);
    }
  };



  const getNextUnpaidMonthAndDate = (t: any, tenantPaidPayments: any[]) => {

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const shortMonthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];



    let targetDay = 5;

    if (t.move_in_date) {

      const checkin = new Date(t.move_in_date);

      if (!isNaN(checkin.getTime())) targetDay = checkin.getDate();

    } else if (t.created_at) {

      const created = new Date(t.created_at);

      if (!isNaN(created.getTime())) targetDay = created.getDate();

    }



    const today = new Date();

    today.setHours(0,0,0,0);



    let nextDueDate = new Date(today);

    if (today.getDate() < targetDay) {

      nextDueDate.setDate(targetDay);

    } else {

      nextDueDate.setMonth(today.getMonth() + 1);

      nextDueDate.setDate(targetDay);

    }



    if (tenantPaidPayments && tenantPaidPayments.length > 0) {

      const paidMonths = tenantPaidPayments.map((p: any) => p.month).filter(Boolean);



      let maxIterations = 24;

      while (maxIterations > 0) {

        const currentMonthFull = monthNames[nextDueDate.getMonth()];

        const currentMonthShort = shortMonthNames[nextDueDate.getMonth()];



        const isAlreadyPaid = paidMonths.some((m: string) => {

          if (!m) return false;

          const lowerM = m.toLowerCase();

          return (

            lowerM.includes(currentMonthFull.toLowerCase()) || 

            lowerM.includes(currentMonthShort.toLowerCase())

          );

        });



        if (isAlreadyPaid) {

          nextDueDate.setMonth(nextDueDate.getMonth() + 1);

          maxIterations--;

        } else {

          break;

        }

      }

    }



    nextDueDate.setHours(0,0,0,0);

    const diffTime = nextDueDate.getTime() - today.getTime();

    const dueDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));



    return {

      dueDays,

      monthShort: nextDueDate.toLocaleString('default', { month: 'short' })

    };

  };



  const handleRemind = useCallback(async (due: any) => {
    const tenantId = due.tenant_id || due.payment_id;
    if (remindingTenantId) return; // prevent double-click

    if (!due.tenant_phone) {
      alert("Tenant does not have a valid mobile number recorded.");
      setRemindFailedId(tenantId);
      setTimeout(() => setRemindFailedId(null), 2500);
      return;
    }

    setRemindingTenantId(tenantId);
    setRemindedTenantId(null);
    setRemindFailedId(null);

    try {
      let statusType: 'STANDARD' | 'DUE_TODAY' | 'DUE_TOMORROW' | 'OVERDUE' = 'STANDARD';
      let overdueDays = 0;

      if (due.isOverdue || (due.dueDays && due.dueDays > 0)) {
        statusType = 'OVERDUE';
        overdueDays = Math.max(1, due.dueDays || 1);
      } else if (due.dueDays === 0) {
        statusType = 'DUE_TODAY';
      } else if (due.dueDays === -1) {
        statusType = 'DUE_TOMORROW';
      }

      const res = await sendRentReminderAction(
        due.tenant_phone,
        due.tenant_name || 'Tenant',
        due.amount,
        due.month || 'this month',
        due.payment_id || `INV-${Date.now().toString().slice(-6)}`,
        statusType,
        overdueDays,
        due.room_number || 'N/A',
        due.dueDateStr || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        due.pg_name || 'A1 Hostels'
      );

      if (res.success) {
        setRemindedTenantId(tenantId);
        setTimeout(() => setRemindedTenantId(null), 3000);
      } else {
        alert("Failed to send WhatsApp reminder: " + (res.error || 'Please check number in Meta manager.'));
        setRemindFailedId(tenantId);
        setTimeout(() => setRemindFailedId(null), 3000);
      }
    } catch (err: any) {
      alert("Failed to send WhatsApp reminder: " + (err.message || 'Please try again.'));
      setRemindFailedId(tenantId);
      setTimeout(() => setRemindFailedId(null), 3000);
    } finally {
      setRemindingTenantId(null);
    }
  }, [remindingTenantId]);



  const handleResumeTenant = async (due: any) => {
    const isConfirmed = await confirm(`Are you sure you want to resume stay for ${due.tenant_name}?`);
    if (!isConfirmed) return;

    const res = await rpcCall('resumeTenant', due.tenant_id, { chargeMaintenanceFee: 0 });

    if (res && res.success) {
      alert(`Successfully resumed stay for ${due.tenant_name}`);
      if (ownerId) fetchDues(ownerId);
      notifyHostelDataChanged();
    } else {
      alert(`Failed to resume tenant: ${res?.error || 'Unknown error'}`);
    }
  };



  const handleBulkRemind = () => {
    setBulkSendResult(null);
    setShowBulkModal(true);
  };

  const executeBulkRemind = async () => {
    setIsBulkSending(true);
    let successCount = 0;
    let failCount = 0;

    for (const due of overdue15Dues) {
      if (due.tenant_phone) {
        let statusType: 'STANDARD' | 'DUE_TODAY' | 'DUE_TOMORROW' | 'OVERDUE' = 'OVERDUE';
        let overdueDays = Math.max(1, due.dueDays || 1);

        const res = await sendRentReminderAction(
          due.tenant_phone,
          due.tenant_name,
          due.amount,
          due.month || 'this month',
          due.payment_id,
          statusType,
          overdueDays,
          due.room_number || 'N/A',
          due.dueDateStr || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
          due.pg_name || 'A1 Hostels'
        );
        if (res.success) successCount++;
        else failCount++;
      } else {
        failCount++;
      }
    }

    setIsBulkSending(false);
    setBulkSendResult({ success: successCount, fail: failCount });
  };



  const handleSettle = async (e: React.MouseEvent | React.FormEvent, due: any, type: 'full' | 'settle') => {
    e.preventDefault();
    if (isCollecting) return;

    if (!confirmingAction || confirmingAction.id !== due.payment_id || confirmingAction.type !== type) {
      setConfirmingAction({ id: due.payment_id, type });
      return;
    }

    setIsCollecting(true);
    const amountPaise = parseMoneyToPaise(collectedAmount !== '' ? collectedAmount : due.amount);
    if (amountPaise <= 0) {
      alert("Please enter a valid amount greater than zero.");
      setIsCollecting(false);
      return;
    }

    const pgId = tenants.find(t => t.tenant_id === due.tenant_id)?.pg_id || localStorage.getItem('activePgId') || '';
    const selectedIndices = getSelectedChargeIndices(due);

    if (selectedIndices.length === 0) {
      alert("Please select at least one charge item to record payment.");
      setIsCollecting(false);
      return;
    }

    const selectedChargesSum = selectedIndices.reduce((sum, idx) => sum + Number(due.charges[idx]?.amount || 0), 0);
    const selectedChargesSumPaise = parseMoneyToPaise(selectedChargesSum);
    const isAllSelectedByLength = selectedIndices.length === due.charges.length;

    if (!isAllSelectedByLength && amountPaise > selectedChargesSumPaise) {
      alert(`Specific fee overpayment is not allowed. The maximum amount you can collect for the selected fees is ₹${selectedChargesSum.toLocaleString('en-IN')}. Please select all charges or reduce the amount.`);
      setIsCollecting(false);
      return;
    }

    const finalCollectedRupees = paiseToRupees(amountPaise);

    try {
      const collectorUid = auth.currentUser?.uid || '';
      const selectedIndices = getSelectedChargeIndices(due);
      const selectedCharges = selectedIndices.map(idx => due.charges?.[idx]).filter(Boolean);
      let feeType = 'Rent Payment';

      if (selectedCharges.length > 0) {
        feeType = selectedCharges.map((c: any) => {
          if (c.type === 'security_deposit' || c.type === 'security-deposit' || c.type === 'deposit') return 'Security Deposit';
          if (c.type === 'one-time') return c.description || c.name || 'Extra Charge';
          if (c.type === 'opening-fee') return `${c.month} (Opening Balance)`;
          return c.month || c.description || 'Rent';
        }).join(', ');
      } else if (due.description) {
        feeType = due.description;
      } else if (due.month) {
        feeType = `${due.month} Rent`;
      }

      const selectedPaymentIds = selectedIndices.map(idx => due.charges?.[idx]?.payment_id || due.charges?.[idx]?.id).filter(Boolean);
      const idempotencyKey = `idemp_${due.tenant_id}_${amountPaise}_${Date.now()}`;

      const res = await rpcCall('collectFIFOPayment', due.tenant_id, finalCollectedRupees, paymentMethod, pgId, selectedPaymentIds, collectorUid, 'Owner', 0, idempotencyKey);

      if (res?.success) {
        setExpandedCardId(null);
        setConfirmingAction(null);
        setCollectedAmount('');
        if (ownerId) fetchDues(ownerId);
        notifyHostelDataChanged(pgId);
        setSuccessModalData({
          amount: finalCollectedRupees,
          tenantName: due.tenant_name || due.full_name || 'Tenant',
          roomNumber: due.room_number || due.room || '',
          paymentMethod: paymentMethod,
          feeType: feeType
        });
      } else {
        alert("Failed to collect payment: " + (res?.error || 'Unknown error'));
      }
    } catch (err: any) {
      alert("Error collecting payment. Please try again.");
    } finally {
      setIsCollecting(false);
    }
  };

  const handlePartial = async (e: React.MouseEvent, due: any) => {
    e.preventDefault();
    if (isCollecting) return;

    const amountPaise = parseMoneyToPaise(collectedAmount);
    if (amountPaise <= 0) {
      alert("Please enter a valid amount greater than zero.");
      return;
    }

    if (!confirmingAction || confirmingAction.id !== due.payment_id || confirmingAction.type !== 'partial') {
      setConfirmingAction({ id: due.payment_id, type: 'partial' });
      return;
    }

    const selectedIndices = getSelectedChargeIndices(due);
    if (selectedIndices.length === 0) {
      alert("Please select at least one charge item to record payment.");
      return;
    }

    const selectedChargesSum = selectedIndices.reduce((sum, idx) => sum + Number(due.charges[idx]?.amount || 0), 0);
    const selectedChargesSumPaise = parseMoneyToPaise(selectedChargesSum);
    const isAllSelectedByLength = selectedIndices.length === due.charges.length;

    if (!isAllSelectedByLength && amountPaise > selectedChargesSumPaise) {
      alert(`Specific fee overpayment is not allowed. The maximum amount you can collect for the selected fees is ₹${selectedChargesSum.toLocaleString('en-IN')}. Please select all charges or reduce the amount.`);
      return;
    }

    setIsCollecting(true);
    const amountToCollectRupees = paiseToRupees(amountPaise);
    const pgId = tenants.find(t => t.tenant_id === due.tenant_id)?.pg_id || localStorage.getItem('activePgId') || '';

    try {
      const collectorUid = auth.currentUser?.uid || '';
      const selectedIndices = getSelectedChargeIndices(due);
      const selectedCharges = selectedIndices.map(idx => due.charges?.[idx]).filter(Boolean);
      let feeType = 'Rent Payment';

      if (selectedCharges.length > 0) {
        feeType = selectedCharges.map((c: any) => {
          if (c.type === 'security_deposit' || c.type === 'security-deposit' || c.type === 'deposit') return 'Security Deposit';
          if (c.type === 'one-time') return c.description || c.name || 'Extra Charge';
          if (c.type === 'opening-fee') return `${c.month} (Opening Balance)`;
          return c.month || c.description || 'Rent';
        }).join(', ');
      } else if (due.description) {
        feeType = due.description;
      } else if (due.month) {
        feeType = `${due.month} Rent`;
      }

      const selectedPaymentIds = selectedIndices.map(idx => due.charges?.[idx]?.payment_id || due.charges?.[idx]?.id).filter(Boolean);
      const idempotencyKey = `idemp_${due.tenant_id}_${amountPaise}_${Date.now()}`;

      const res = await rpcCall('collectFIFOPayment', due.tenant_id, amountToCollectRupees, paymentMethod, pgId, selectedPaymentIds, collectorUid, 'Owner', 0, idempotencyKey);

      if (res?.success) {
        setExpandedCardId(null);
        setConfirmingAction(null);
        setCollectedAmount('');
        if (ownerId) fetchDues(ownerId);
        notifyHostelDataChanged(pgId);
        setSuccessModalData({
          amount: amountToCollectRupees,
          tenantName: due.tenant_name || due.full_name || 'Tenant',
          roomNumber: due.room_number || due.room || '',
          paymentMethod: paymentMethod,
          feeType: feeType
        });
      } else {
        alert("Failed to record partial payment: " + (res?.error || 'Unknown error'));
      }
    } catch (err: any) {
      alert("Error recording partial payment. Please try again.");
    } finally {
      setIsCollecting(false);
    }
  };



  const getTenantStatus = (t: any) => {
    if (!t) return 'Active';
    if (t.is_active === false || t.status === 'Vacated' || t.status === 'VACATED') return 'Vacated';
    if (t.status === 'Notice Period' || t.status === 'notice_period' || t.status === 'NOTICE' || t.status === 'NOTICE_PERIOD') return 'Notice Period';
    if (t.status === 'PAUSED' || t.status === 'Paused') return 'Paused';
    return 'Active';
  };

  const activeTenants = tenants;

  const pendingDueTenantIds = new Set(dues.map(d => d.tenant_id));

  

  
  

  


  const combinedList = [...dues];



  activeTenants.forEach(t => {

    if (!pendingDueTenantIds.has(t.tenant_id)) {

      const tenantPaid = paidPayments.filter((p: any) => p.tenant_id === t.tenant_id);

      const { dueDays, monthShort } = getNextUnpaidMonthAndDate(t, tenantPaid);



      combinedList.push({

        payment_id: `paid-${t.tenant_id}`,

        tenant_id: t.tenant_id,

        tenant_name: t.full_name,

        room_number: t.rooms?.room_number || 'N/A',

        amount: t.rent_amount || 0,

        month: monthShort,

        dueDays,

        tenantStatus: getTenantStatus(t),

        isOverdue: false,

        isFullyPaid: false,

        tenant_phone: t.mobile

      });

    }

  });



  const filteredList = combinedList.filter(item => {

     const matchesSearch = item.tenant_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||

                           item.room_number?.toString().toLowerCase().includes(searchTerm.toLowerCase());

     

     let matchesStatus = false;

     if (filters.status === 'All') {

       if (item.tenantStatus === 'Vacated' && !pendingDueTenantIds.has(item.tenant_id)) {

         matchesStatus = false;

       } else {

         matchesStatus = true;

       }

     } else {

       matchesStatus = item.tenantStatus === filters.status;

     }

     

     let matchesDuration = true;

     if (filters.duration === 'Overdue') {
       matchesDuration = item.isOverdue === true;
     } else if (filters.duration === 'Due Today') {
       matchesDuration = item.dueDays === 0;
     } else if (filters.duration === 'Due Tomorrow') {
       matchesDuration = item.dueDays === -1;
     } else if (filters.duration === 'Over 1 week') {
       matchesDuration = item.isOverdue === true && item.dueDays > 7;
     } else if (filters.duration === 'Over 2 weeks') {
       matchesDuration = item.isOverdue === true && item.dueDays > 14;
     } else if (filters.duration === 'Over 1 month') {
       matchesDuration = item.isOverdue === true && item.dueDays > 30;
     }



     let matchesMonth = true;

     if (filters.month) {

       const date = new Date(filters.month + "-01");

       const longMonth = date.toLocaleString('default', { month: 'long' }).toLowerCase();

       const shortMonth = date.toLocaleString('default', { month: 'short' }).toLowerCase();

       const itemMonth = (item.month || '').toLowerCase();

       matchesMonth = itemMonth.includes(longMonth) || itemMonth.includes(shortMonth);

     }



     return matchesSearch && matchesStatus && matchesDuration && matchesMonth;

  });



  const totalPendingFee = dues.reduce((sum, d) => sum + (d.amount || 0), 0);

  if (!mounted || showSkeleton) {
    return <SkeletonDuesPage />;
  }

  return (
    <div className={styles.container}>
      <AnimatePresence>

        {isFilterOpen && (

          <>

            <motion.div 

              className={styles.modalOverlay}

              initial={{ opacity: 0 }} 

              animate={{ opacity: 1 }} 

              exit={{ opacity: 0 }}

              onClick={() => setIsFilterOpen(false)}

            />

            <motion.div

              className={styles.filterModal}

              initial={{ y: '100%' }} 

              animate={{ y: 0 }} 

              exit={{ y: '100%' }}

              transition={{ type: 'spring', damping: 25, stiffness: 200 }}

            >

              <div className={styles.modalHeader}>

                <h2>Filters</h2>

                <button 

                  onClick={() => setLocalFilters({ status: 'All', duration: 'All', month: '' })} 

                  className={styles.resetBtn}

                >

                  Reset

                </button>

              </div>



              <div className={styles.modalBody}>

                <div className={styles.filterSection}>

                  <h3>Tenant Status</h3>

                  <div className={styles.optionsGrid}>

                    {['All', 'Active', 'Notice Period', 'Vacated'].map(opt => (

                      <button 

                        key={opt} 

                        className={`${styles.filterOptionBtn} ${localFilters.status === opt ? styles.selected : ''}`}

                        onClick={() => setLocalFilters({...localFilters, status: opt})}

                      >

                        {opt === 'All' ? 'All Status' : opt}

                      </button>

                    ))}

                  </div>

                </div>



                <div className={styles.filterSection}>

                  <h3>Due Duration</h3>

                  <div className={styles.optionsGrid}>

                    {['All', 'Overdue', 'Over 1 week', 'Over 2 weeks', 'Over 1 month'].map(opt => (

                      <button 

                        key={opt} 

                        className={`${styles.filterOptionBtn} ${localFilters.duration === opt ? styles.selected : ''}`}

                        onClick={() => setLocalFilters({...localFilters, duration: opt})}

                      >

                        {opt === 'All' ? 'Any Duration' : opt}

                      </button>

                    ))}

                  </div>

                </div>



                <div className={styles.filterSection}>

                  <h3>Select Month</h3>

                  <input 

                    type="month" 

                    value={localFilters.month} 

                    onChange={(e) => setLocalFilters({...localFilters, month: e.target.value})}

                    style={{ padding: '10px 14px', borderRadius: '12px', border: '1px solid #e2e8f0', width: '100%', fontSize: '0.9rem', color: '#0f172a', outline: 'none' }}

                  />

                </div>

              </div>



              <div className={styles.modalFooter}>

                <button className={styles.cancelBtn} onClick={() => setIsFilterOpen(false)}>Cancel</button>

                <button 

                  className={styles.applyBtn} 

                  onClick={() => {

                    setFilters(localFilters);

                    setIsFilterOpen(false);

                  }}

                >

                  Apply Filters

                </button>

              </div>

            </motion.div>

          </>

        )}

      </AnimatePresence>



      <div className={styles.statsContainer}>

        <div className={styles.totalCardHalf}>

          <div className={styles.totalTitle}>Total Pending Fee</div>

          <div className={styles.totalAmount}>₹{totalPendingFee.toLocaleString('en-IN')}</div>

        </div>

        <button 

          className={styles.bulkRemindBtn} 

          onClick={handleBulkRemind}

          title="Remind All Overdue"

        >

          <WhatsappIcon size={24} color="white" />

        </button>

      </div>





      {/* Payment Status (3 Summary Cards with Toggle Filter Logic) */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        {/* OVERDUE Card */}
        <div 
          style={{ 
            flex: 1, 
            background: filters.duration === 'Overdue' ? '#FFE4E6' : '#FFF5F5', 
            borderRadius: '16px', 
            border: filters.duration === 'Overdue' ? '2px solid #ef4444' : '1px solid #FECDD3', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '12px 4px', 
            textAlign: 'center', 
            cursor: 'pointer', 
            boxShadow: filters.duration === 'Overdue' ? '0 6px 16px rgba(239,68,68,0.2)' : '0 4px 12px rgba(239,68,68,0.06)' 
          }}
          onClick={() => setFilters(prev => ({ ...prev, duration: prev.duration === 'Overdue' ? 'All' : 'Overdue' }))}
        >
          <div style={{ color: '#ef4444', marginBottom: 4 }}><AlertCircle size={20} strokeWidth={2.5} /></div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#ef4444', lineHeight: 1, marginBottom: '4px' }}>
            {dues.filter((d: any) => d.isOverdue || (d.dueDays && d.dueDays > 0)).length}
          </div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.3px' }}>OVERDUE</div>
        </div>

        {/* DUE TODAY Card */}
        <div 
          style={{ 
            flex: 1, 
            background: filters.duration === 'Due Today' ? '#FEF3C7' : '#FFFBEB', 
            borderRadius: '16px', 
            border: filters.duration === 'Due Today' ? '2px solid #f59e0b' : '1px solid #FDE68A', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '12px 4px', 
            textAlign: 'center', 
            cursor: 'pointer', 
            boxShadow: filters.duration === 'Due Today' ? '0 6px 16px rgba(245,158,11,0.2)' : '0 4px 12px rgba(245,158,11,0.06)' 
          }}
          onClick={() => setFilters(prev => ({ ...prev, duration: prev.duration === 'Due Today' ? 'All' : 'Due Today' }))}
        >
          <div style={{ color: '#f59e0b', marginBottom: 4 }}><Clock size={20} strokeWidth={2.5} /></div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#f59e0b', lineHeight: 1, marginBottom: '4px' }}>
            {dues.filter((d: any) => d.dueDays === 0).length}
          </div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.3px' }}>DUE TODAY</div>
        </div>

        {/* DUE TOMORROW Card */}
        <div 
          style={{ 
            flex: 1, 
            background: filters.duration === 'Due Tomorrow' ? '#FEF3C7' : '#FFFBEB', 
            borderRadius: '16px', 
            border: filters.duration === 'Due Tomorrow' ? '2px solid #d97706' : '1px solid #FDE68A', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '12px 4px', 
            textAlign: 'center', 
            cursor: 'pointer', 
            boxShadow: filters.duration === 'Due Tomorrow' ? '0 6px 16px rgba(217,119,6,0.2)' : '0 4px 12px rgba(217,119,6,0.06)' 
          }}
          onClick={() => setFilters(prev => ({ ...prev, duration: prev.duration === 'Due Tomorrow' ? 'All' : 'Due Tomorrow' }))}
        >
          <div style={{ color: '#d97706', marginBottom: 4 }}><Calendar size={20} strokeWidth={2.5} /></div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#d97706', lineHeight: 1, marginBottom: '4px' }}>
            {dues.filter((d: any) => d.dueDays === -1).length}
          </div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.3px' }}>DUE TOMORROW</div>
        </div>
      </div>



      <div style={{ marginTop: '8px' }}>

        {(filters.status !== 'All' || filters.duration !== 'All' || filters.month !== '') && (

          <div className={styles.activeFiltersRow}>

            <div className={styles.activeFiltersScroll}>

              {filters.status !== 'All' && (

                <div className={styles.activeFilterChip}>

                  {filters.status} <button onClick={() => setFilters({...filters, status: 'All'})}><X size={12}/></button>

                </div>

              )}

              {filters.duration !== 'All' && (

                <div className={styles.activeFilterChip}>

                  {filters.duration} <button onClick={() => setFilters({...filters, duration: 'All'})}><X size={12}/></button>

                </div>

              )}

              {filters.month !== '' && (

                <div className={styles.activeFilterChip}>

                  {new Date(filters.month + "-01").toLocaleString('default', { month: 'short', year: 'numeric' })} <button onClick={() => setFilters({...filters, month: ''})}><X size={12}/></button>

                </div>

              )}

            </div>

            <button className={styles.clearAllFilters} onClick={() => setFilters({ status: 'All', duration: 'All', month: '' })}>

              Clear All

            </button>

          </div>

        )}



        <div className={styles.searchRow}>

          <div className={styles.searchWrapper}>

            <Search size={18} className={styles.searchIcon} />

            <input 

              type="text" 

              placeholder="Search by name or room..." 

              value={searchTerm}

              onChange={(e) => setSearchTerm(e.target.value)}

              className={styles.searchInput}

            />

          </div>

          <button className={styles.filterBtnSmall} onClick={() => { setLocalFilters(filters); setIsFilterOpen(true); }}>

            <Filter size={20} />

          </button>

        </div>

      </div>



      {filteredList.length === 0 ? (

        <div className={styles.emptyState}>

          <CheckCircle size={48} color="#10b981" />

          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0, color: '#0f172a' }}>All Clear!</h2>

          <p style={{ margin: 0 }}>No tenants or dues match your search.</p>

        </div>

      ) : (

        <div className={styles.list}>

          <AnimatePresence>

            {filteredList.map((due) => {
              const isPaused = due.tenantStatus === 'Paused' || due.tenantStatus === 'PAUSED';
              const isVacated = due.tenantStatus === 'Vacated' || due.tenantStatus === 'vacated' || due.tenantStatus === 'VACATED';
              const accentColor = isVacated ? '#94A3B8'
                                : isPaused ? '#F59E0B'
                                : due.isOverdue ? '#EF4444'
                                : due.tenantStatus === 'Notice Period' || due.tenantStatus === 'notice_period' ? '#8B5CF6'
                                : '#3B82F6';

              const isRemindEligible = due.isOverdue || due.dueDays === 0 || due.dueDays === -1;

              return (
                <div
                  key={due.payment_id}
                  className={`${styles.card} ${due.isOverdue ? styles.cardOverdue : due.isFullyPaid ? styles.cardPaid : styles.cardUpcoming}`}
                  style={{ borderLeft: `5px solid ${accentColor}` }}
                >
                  <div className={styles.cardTop}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className={styles.avatarCircle} style={{ 
                         background: isVacated ? '#f1f5f9' : isPaused ? '#FFFBEB' : due.isOverdue ? '#fef2f2' : due.isFullyPaid ? '#eff6ff' : '#fffbeb',
                         color: isVacated ? '#64748b' : isPaused ? '#F59E0B' : due.isOverdue ? '#ef4444' : due.isFullyPaid ? '#3b82f6' : '#f59e0b',
                         overflow: 'hidden',
                         position: 'relative'
                      }}>
                        {due.facePicture ? (
                          <img 
                            src={due.facePicture} 
                            alt={due.tenant_name} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <span>{due.tenant_name?.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className={styles.tenantInfo}>
                        <h3 className={styles.tenantName}>{due.tenant_name}</h3>
                        <div className={styles.roomInfo}>
                          Room {due.room_number} &bull; {due.month}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div className={styles.amount} style={{ color: isVacated ? '#64748b' : isPaused ? '#b45309' : due.isOverdue ? '#ef4444' : '#0f172a' }}>₹{due.amount}</div>
                      <div className={styles.badge} style={{
                        background: isVacated ? '#f1f5f9' : isPaused ? '#FFFBEB' : due.isOverdue ? '#FEE2E2' : '#EFF6FF',
                        color: isVacated ? '#475569' : isPaused ? '#2563EB' : due.isOverdue ? '#DC2626' : '#2563EB',
                        border: isVacated ? '1px solid #cbd5e1' : isPaused ? '1px solid #FDE68A' : 'none',
                        fontWeight: 600,
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {isVacated ? `Vacated (${due.isOverdue ? `Overdue by ${due.dueDays} days` : `Pending Due`})`
                         : isPaused ? `⏸ Paused (${due.isOverdue ? `Overdue by ${due.dueDays} days` : `Due in ${Math.abs(due.dueDays)} days`})`
                         : due.isOverdue ? `Overdue by ${due.dueDays} days`
                         : due.dueDays === 0 ? `Due Today`
                         : `Next Due in ${Math.abs(due.dueDays)} days`}
                      </div>
                    </div>
                  </div>

                  {!due.isFullyPaid && (
                    <div className={styles.cardBottom}>
                      <button 
                        className={`${styles.remindBtn} ${remindedTenantId === (due.tenant_id || due.payment_id) ? styles.remindSuccess : ''} ${remindFailedId === (due.tenant_id || due.payment_id) ? styles.remindFailed : ''}`}
                        onClick={() => handleRemind(due)}
                        disabled={remindingTenantId === (due.tenant_id || due.payment_id)}
                        title={!due.tenant_phone ? 'No phone number' : 'Send WhatsApp Reminder'}
                      >
                        {remindingTenantId === (due.tenant_id || due.payment_id) ? (
                          <>
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                              style={{ display: 'flex', alignItems: 'center' }}
                            >
                              <Loader2 size={15} />
                            </motion.div>
                            Sending...
                          </>
                        ) : remindedTenantId === (due.tenant_id || due.payment_id) ? (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            <Check size={15} strokeWidth={3} />
                            Sent!
                          </motion.div>
                        ) : remindFailedId === (due.tenant_id || due.payment_id) ? (
                          <motion.div
                            initial={{ x: -5 }}
                            animate={{ x: [0, -3, 3, -3, 3, 0] }}
                            transition={{ duration: 0.4 }}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            <XCircle size={15} />
                            {!due.tenant_phone ? 'No Phone' : 'Failed'}
                          </motion.div>
                        ) : (
                          <>
                            <WhatsappIcon size={15} fill="#25D366" />
                            Remind
                          </>
                        )}
                      </button>

                      {isPaused && (
                        <button 
                          className={styles.resumeBtn}
                          onClick={() => handleResumeTenant(due)}
                        >
                          <Play size={14} fill="#047857" />
                          Resume Stay
                        </button>
                      )}

                      <button 
                        className={styles.collectBtn}
                        onClick={() => {
                          if (expandedCardId === due.payment_id) {
                            setExpandedCardId(null);
                            setConfirmingAction(null);
                          } else {
                            setExpandedCardId(due.payment_id);
                            setConfirmingAction(null);
                            if (due.charges && due.charges.length > 0) {
                              const allIndices = due.charges.map((_: any, idx: number) => idx);
                              setSelectedChargesMap(prev => ({ ...prev, [due.payment_id]: allIndices }));
                              const total = due.charges.reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);
                              setCollectedAmount(total);
                            } else {
                              setCollectedAmount(due.amount);
                            }
                          }
                        }}
                      >

                      <IndianRupee size={14} />

                      Collect

                    </button>

                  </div>
                )}

                

                {/* Expanding Collect Form */}

                <AnimatePresence>

                  {expandedCardId === due.payment_id && (

                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      style={{ overflow: 'visible' }}
                    >

                      <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '16px', paddingTop: '16px' }}>

                        {due.charges && due.charges.length > 0 && (() => {
                          const selectedIndices = getSelectedChargeIndices(due);
                          const allSelected = selectedIndices.length === due.charges.length;

                          const toggleAll = (e: React.MouseEvent) => {
                            e.stopPropagation();
                            const key = due.payment_id;
                            if (allSelected) {
                              setSelectedChargesMap(prev => ({ ...prev, [key]: [] }));
                              setCollectedAmount(0);
                            } else {
                              const allIndices = due.charges.map((_: any, idx: number) => idx);
                              setSelectedChargesMap(prev => ({ ...prev, [key]: allIndices }));
                              const total = due.charges.reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);
                              setCollectedAmount(total);
                            }
                          };

                          return (
                            <div style={{ marginBottom: '16px', background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', margin: 0 }}>Outstanding Breakdown</h4>
                                <button 
                                  type="button"
                                  onClick={toggleAll}
                                  style={{ background: 'none', border: 'none', color: '#4F46E5', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                                >
                                  {allSelected ? 'Deselect All' : 'Select All'}
                                </button>
                              </div>

                              {due.charges.map((charge: any, idx: number) => {
                                const isChecked = selectedIndices.includes(idx);
                                return (
                                  <div 
                                    key={idx} 
                                    onClick={() => handleToggleCharge(due, idx)}
                                    style={{ 
                                      display: 'flex', 
                                      justifyContent: 'space-between', 
                                      alignItems: 'center', 
                                      fontSize: '0.85rem', 
                                      color: isChecked ? '#0f172a' : '#94a3b8', 
                                      padding: '8px 10px',
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      userSelect: 'none',
                                      background: isChecked ? '#ffffff' : 'transparent',
                                      border: isChecked ? '1px solid #cbd5e1' : '1px solid transparent',
                                      marginBottom: '6px',
                                      transition: 'all 0.12s ease'
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <input 
                                        type="checkbox"
                                        checked={isChecked}
                                        readOnly
                                        style={{
                                          width: '16px',
                                          height: '16px',
                                          accentColor: '#4F46E5',
                                          cursor: 'pointer'
                                        }}
                                      />
                                      <span style={{ fontWeight: isChecked ? 600 : 400, color: isChecked ? '#0f172a' : '#94a3b8' }}>
                                        {charge.type === 'security_deposit' || charge.type === 'security-deposit' || charge.type === 'deposit'
                                          ? 'Security Deposit'
                                          : charge.type === 'maintenance' || charge.type === 'maintenance-fee'
                                            ? (charge.description || 'Maintenance Fee')
                                            : charge.type === 'one-time'
                                              ? (charge.description || charge.name || 'Extra Charge')
                                              : charge.type === 'opening-fee'
                                                ? (charge.month ? `${charge.month} (Opening Balance)` : 'Opening Balance')
                                                : (charge.description || (charge.month ? (charge.month.includes('Rent') ? charge.month : `${charge.month} Rent`) : 'Pending Fee'))}
                                      </span>
                                    </div>

                                    <span style={{ fontWeight: 600, color: isChecked ? '#0f172a' : '#94a3b8' }}>
                                      ₹{charge.amount}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}

                        <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>

                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Amount to Collect (₹)</label>
                              <input 
                                type="number" 
                                placeholder={due.amount.toString()}
                                value={collectedAmount}
                                min="0"
                                onChange={(e) => setCollectedAmount(e.target.value === '' ? '' : Number(e.target.value))}
                                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }}
                              />
                            </div>

                            <div style={{ gridColumn: '1 / -1' }}>
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Payment Method</label>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                {[
                                  { id: 'UPI', label: 'UPI', icon: '⚡' },
                                  { id: 'Cash', label: 'Cash', icon: '💵' },
                                  { id: 'Bank Transfer', label: 'Bank', icon: '🏦' }
                                ].map((m) => (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => setPaymentMethod(m.id)}
                                    style={{
                                      padding: '10px 6px',
                                      borderRadius: '10px',
                                      border: paymentMethod === m.id ? '2px solid #6366f1' : '1px solid #e2e8f0',
                                      background: paymentMethod === m.id ? '#eef2ff' : '#ffffff',
                                      color: paymentMethod === m.id ? '#4338ca' : '#475569',
                                      fontWeight: paymentMethod === m.id ? 700 : 600,
                                      fontSize: '0.82rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '4px',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease',
                                      boxShadow: paymentMethod === m.id ? '0 2px 8px rgba(99,102,241,0.18)' : 'none'
                                    }}
                                  >
                                    <span>{m.icon}</span>
                                    <span>{m.label}</span>
                                  </button>
                                ))}
                              </div>
                            </div>

                          </div>



                          {typeof collectedAmount === 'number' && collectedAmount < due.amount ? (

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

                              {confirmingAction?.id === due.payment_id && confirmingAction?.type === 'settle' ? (

                                <div style={{ display: 'flex', gap: '10px' }}>

                                  <AnimatedButton variant="danger" type="button" onClick={(e) => handleSettle(e, due, 'settle')} isLoading={isCollecting} style={{ flex: 1 }}>

                                    Confirm Settle

                                  </AnimatedButton>

                                  <AnimatedButton variant="outline" type="button" onClick={() => setConfirmingAction(null)} style={{ flex: 1 }}>

                                    Cancel

                                  </AnimatedButton>

                                </div>

                              ) : confirmingAction?.id === due.payment_id && confirmingAction?.type === 'partial' ? (

                                <div style={{ display: 'flex', gap: '10px' }}>

                                  <AnimatedButton variant="primary" type="button" onClick={(e) => handlePartial(e, due)} isLoading={isCollecting} style={{ flex: 1 }}>

                                    Confirm Partial

                                  </AnimatedButton>

                                  <AnimatedButton variant="outline" type="button" onClick={() => setConfirmingAction(null)} style={{ flex: 1 }}>

                                    Cancel

                                  </AnimatedButton>

                                </div>

                              ) : (

                                <>

                                  <AnimatedButton variant="primary" type="button" onClick={(e) => handlePartial(e, due)} isLoading={isCollecting} style={{ width: '100%' }}>

                                    Record Partial Payment

                                  </AnimatedButton>

                                  <AnimatedButton variant="secondary" type="button" onClick={(e) => handleSettle(e, due, 'settle')} isLoading={isCollecting} style={{ width: '100%' }}>

                                    Settle Month

                                  </AnimatedButton>

                                </>

                              )}

                            </div>

                          ) : (

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

                              {confirmingAction?.id === due.payment_id && confirmingAction?.type === 'full' ? (

                                <div style={{ display: 'flex', gap: '10px' }}>

                                  <AnimatedButton variant="success" type="button" onClick={(e) => handleSettle(e, due, 'full')} isLoading={isCollecting} style={{ flex: 1 }}>

                                    Confirm Payment

                                  </AnimatedButton>

                                  <AnimatedButton variant="outline" type="button" onClick={() => setConfirmingAction(null)} style={{ flex: 1 }}>

                                    Cancel

                                  </AnimatedButton>

                                </div>

                              ) : (

                                <AnimatedButton variant="success" type="button" onClick={(e) => handleSettle(e, due, 'full')} isLoading={isCollecting} style={{ width: '100%' }}>

                                  Confirm Payment

                                </AnimatedButton>

                              )}

                            </div>

                          )}

                        </form>

                      </div>

                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
          </AnimatePresence>
        </div>
      )}

      {/* Custom Bulk WhatsApp Reminders Modal (Overdue > 15 Days) */}
      <AnimatePresence>
        {showBulkModal && (
          <motion.div 
            className={styles.modalOverlay}
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
              backdropFilter: 'blur(8px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
            onClick={() => {
              if (!isBulkSending) setShowBulkModal(false);
            }}
          >
            <motion.div 
              className={styles.modalContent}
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              style={{
                background: '#ffffff',
                borderRadius: '24px',
                padding: '24px',
                maxWidth: '420px',
                width: '100%',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                border: '1px solid #E2E8F0'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ background: '#DCFCE7', padding: '10px', borderRadius: '14px', color: '#16A34A', display: 'flex' }}>
                    <WhatsappIcon size={24} fill="#16A34A" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0F172A' }}>WhatsApp Bulk Reminders</h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B' }}>Overdue &gt; 15 Days</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowBulkModal(false)}
                  disabled={isBulkSending}
                  style={{ background: '#F1F5F9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <X size={18} color="#64748B" />
                </button>
              </div>

              {bulkSendResult ? (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <CheckCircle size={32} />
                  </div>
                  <h4 style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 700, color: '#0F172A' }}>Reminders Sent!</h4>
                  <p style={{ margin: '0 0 20px', fontSize: '0.9rem', color: '#64748B' }}>
                    Successfully sent <strong>{bulkSendResult.success}</strong> WhatsApp reminder(s). {bulkSendResult.fail > 0 && `(${bulkSendResult.fail} failed)`}
                  </p>
                  <button
                    onClick={() => setShowBulkModal(false)}
                    style={{ width: '100%', padding: '12px', background: '#16A34A', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer' }}
                  >
                    Done
                  </button>
                </div>
              ) : overdue15Dues.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <AlertCircle size={32} />
                  </div>
                  <h4 style={{ margin: '0 0 8px', fontSize: '1.05rem', fontWeight: 700, color: '#0F172A' }}>No Tenants Overdue &gt; 15 Days</h4>
                  <p style={{ margin: '0 0 20px', fontSize: '0.85rem', color: '#64748B' }}>
                    There are currently no tenants with pending dues overdue for more than 15 days.
                  </p>
                  <button
                    onClick={() => setShowBulkModal(false)}
                    style={{ width: '100%', padding: '12px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '14px', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>
              ) : (
                <div>
                  <p style={{ margin: '0 0 14px', fontSize: '0.88rem', color: '#475569', lineHeight: 1.4 }}>
                    Send automated WhatsApp rent reminders to <strong>{overdue15Dues.length} tenant(s)</strong> whose pending dues are overdue for <strong>more than 15 days</strong>?
                  </p>

                  <div style={{ maxHeight: '180px', overflowY: 'auto', background: '#F8FAFC', borderRadius: '16px', padding: '12px', border: '1px solid #F1F5F9', marginBottom: '20px' }}>
                    {overdue15Dues.map((d: any, idx: number) => (
                      <div key={d.payment_id || idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: idx < overdue15Dues.length - 1 ? '1px solid #E2E8F0' : 'none' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0F172A' }}>{d.tenant_name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Room {d.room_number} &bull; Overdue {d.dueDays} days</div>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#DC2626' }}>₹{d.amount}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => setShowBulkModal(false)}
                      disabled={isBulkSending}
                      style={{ flex: 1, padding: '12px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '14px', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={executeBulkRemind}
                      disabled={isBulkSending}
                      style={{ flex: 1.5, padding: '12px', background: '#16A34A', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      {isBulkSending ? (
                        <span>Sending...</span>
                      ) : (
                        <>
                          <WhatsappIcon size={16} fill="white" />
                          <span>Send ({overdue15Dues.length})</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Success Window */}
      <PaymentSuccessModal
        isOpen={!!successModalData}
        onClose={() => setSuccessModalData(null)}
        data={successModalData}
      />
    </div>
  );
}

export function SkeletonDuesPage() {
  return (
    <div className={styles.container} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Total Pending Fee Card Skeleton */}
      <div style={{ background: '#EF4444', borderRadius: '20px', padding: '16px 20px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 8px 24px rgba(239, 68, 68, 0.25)', opacity: 0.85, animation: 'pulse 1.2s infinite ease-in-out' }}>
        <div>
          <div style={{ fontSize: '0.8rem', opacity: 0.9, fontWeight: 600 }}>Total Pending Fee</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '4px' }}>₹...</div>
        </div>
        <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Banknote size={22} color="white" />
        </div>
      </div>

      {/* 3 Summary Pills Skeleton */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <div style={{ flex: 1, background: '#FFF5F5', borderRadius: '16px', border: '1px solid #FECDD3', padding: '12px 4px', textAlign: 'center', animation: 'pulse 1.2s infinite ease-in-out' }}>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#ef4444' }}>-</div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#b91c1c' }}>OVERDUE</div>
        </div>
        <div style={{ flex: 1, background: '#FFFBEB', borderRadius: '16px', border: '1px solid #FDE68A', padding: '12px 4px', textAlign: 'center', animation: 'pulse 1.2s infinite ease-in-out' }}>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#f59e0b' }}>-</div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#d97706' }}>DUE TODAY</div>
        </div>
        <div style={{ flex: 1, background: '#FFFBEB', borderRadius: '16px', border: '1px solid #FDE68A', padding: '12px 4px', textAlign: 'center', animation: 'pulse 1.2s infinite ease-in-out' }}>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#d97706' }}>-</div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#b45309' }}>DUE TOMORROW</div>
        </div>
      </div>

      {/* Search Input Bar Skeleton */}
      <div style={{ height: '46px', width: '100%', backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', animation: 'pulse 1.2s infinite ease-in-out' }} />

      {/* Card Shimmer Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ height: '100px', width: '100%', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', borderLeft: i % 2 === 0 ? '5px solid #ef4444' : '5px solid #3b82f6', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', animation: 'pulse 1.2s infinite ease-in-out' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#F1F5F9' }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ width: '50%', height: '14px', background: '#F1F5F9', borderRadius: '4px' }} />
              <div style={{ width: '35%', height: '12px', background: '#F8FAFC', borderRadius: '4px' }} />
            </div>
            <div style={{ width: '60px', height: '20px', background: '#F1F5F9', borderRadius: '6px' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DuesPage() {
  return (
    <Suspense fallback={<SkeletonDuesPage />}>
      <DuesPageContent />
    </Suspense>
  );
}

