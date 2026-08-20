"use client";

// Force Next.js to rebuild JS

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { rpcCall } from '@/lib/rpc';
import { getTeamMembersAction } from '@/app/actions/teamActions';
import { globalAppCache, saveToCache, getFromCache } from '@/lib/cache';
import { useRouter } from 'next/navigation';
import styles from './history.module.css';
import { CustomSelect } from '@/components/CustomSelect';
import { AvatarImage } from '@/components/AvatarImage';
import { IndianRupee, Clock, Calendar, DoorClosed, AlertCircle, Download, Search, Filter, X, Check, ChevronDown, Wallet, User } from 'lucide-react';
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval, parseISO, getMonth, getYear } from 'date-fns';

type FilterType = 'today' | 'week' | 'month' | 'custom_month' | 'custom_year';

interface FilterState {
  dateRange: string;
  customMonth?: number;
  customYear?: number;
  paymentStatus: string[];
  paymentMethod: string[];
  collectedBy: string[];
}

import { useHostel } from '@/context/HostelContext';
import { getTenantPaymentStatus } from '@/lib/paymentStatus';
import { useHostelData, notifyHostelDataChanged } from '@/hooks/useHostelData';
import { getAppState } from '@/lib/appStateStore';

import { Suspense } from 'react';
function HistoryPageContent() {
  const router = useRouter();
  const { selectedPgId, pageStates, setPageState, userProfile } = useHostel();
  const { data: hostelData, isLoading: swrLoading } = useHostelData(selectedPgId);
  const memCache = typeof window !== 'undefined' && selectedPgId ? getAppState(`hostelData_${selectedPgId}`)?.data : null;
  const effectiveHostelData = hostelData || memCache;

  const storePayments = effectiveHostelData?.payments;
  const storeTenants = effectiveHostelData?.tenants;
  const storeRooms = effectiveHostelData?.rooms;
  const savedState = pageStates['history'] || {};

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);


  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(savedState.filter || {
    dateRange: 'All Time',
    customMonth: new Date().getMonth(),
    customYear: new Date().getFullYear(),
    paymentStatus: [],
    paymentMethod: [],
    collectedBy: [],
  });

  useEffect(() => {
    setPageState('history', { filter: filters });
  }, [filters, setPageState]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const uid = localStorage.getItem('userUid') || auth.currentUser?.uid;
      if (uid) setOwnerId(uid);
    }
  }, []);

  useEffect(() => {
    if (ownerId) {
      getTeamMembersAction(ownerId).then(res => {
        if (res.success && res.data) {
          setTeamMembers(res.data);
        }
      });
    }
  }, [ownerId]);

  const [realtimePayments, setRealtimePayments] = useState<any[]>([]);

  // Real-time Firestore listener for instant live payment history sync across all logged-in devices
  useEffect(() => {
    const targetUid = ownerId || auth.currentUser?.uid || (typeof window !== 'undefined' ? localStorage.getItem('userUid') : null);
    if (!targetUid && !selectedPgId) return;

    try {
      const q = selectedPgId
        ? query(collection(db, 'payments'), where('pg_id', '==', selectedPgId), limit(200))
        : query(collection(db, 'payments'), where('owner_id', '==', targetUid), limit(200));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs
          .map(d => ({ payment_id: d.id, ...d.data() }))
          .filter((p: any) => p.status === 'paid');
        
        setRealtimePayments(docs);
        notifyHostelDataChanged(selectedPgId);
      }, (err) => {
        console.warn('Realtime payments listener:', err?.code);
      });

      return () => unsubscribe();
    } catch (e) {
      console.warn('Failed to attach realtime payments listener:', e);
    }
  }, [ownerId, selectedPgId]);

  // Combine real-time Firestore payments stream with storePayments seamlessly
  const rawPayments = useMemo(() => {
    const map = new Map<string, any>();
    (storePayments || []).forEach((p: any) => {
      const id = p.payment_id || p.id;
      if (id) map.set(id, p);
    });
    realtimePayments.forEach((p: any) => {
      const id = p.payment_id || p.id;
      if (id) map.set(id, { ...(map.get(id) || {}), ...p });
    });
    return Array.from(map.values());
  }, [realtimePayments, storePayments]);

  const payments = useMemo<any[]>(() => {
    if (!rawPayments || rawPayments.length === 0) return [];

    const parseAmount = (val: any) => {
      if (!val) return 0;
      if (typeof val === 'number') return val;
      return Number(val.toString().replace(/,/g, '')) || 0;
    };

    const tenantsMap: Record<string, any> = {};
    (storeTenants || []).forEach((t: any) => {
      const tid = t.tenant_id || t.id;
      if (tid) tenantsMap[tid] = t;
    });

    const roomsMap: Record<string, any> = {};
    (storeRooms || []).forEach((r: any) => {
      const rid = r.room_id || r.id;
      if (rid) roomsMap[rid] = r;
    });

    // Build duesMap: for each tenant, compute total outstanding balance
    const duesMap: Record<string, number> = {};
    const storeDues = effectiveHostelData?.dues || [];
    const allStorePayments = effectiveHostelData?.payments || [];

    // Method 1: Use getTenantPaymentStatus for tenants we know about
    (storeTenants || []).forEach((t: any) => {
      const statusInfo = getTenantPaymentStatus(t, storeDues, allStorePayments, new Date());
      let totalDue = parseAmount(statusInfo.pendingAmount);
      if (statusInfo.isVirtual && ['OVERDUE', 'CRITICAL', 'DUE_TODAY'].includes(statusInfo.status)) {
        totalDue += parseAmount(statusInfo.virtualRentRemaining !== undefined ? statusInfo.virtualRentRemaining : t.rent_amount);
      }
      
      const tid = t.tenant_id || t.id;
      if (tid) duesMap[tid] = totalDue;
    });

    // Method 2: For any tenant_id found in payments but NOT in storeTenants,
    // compute their pending directly from storeDues
    const allPaymentTenantIds = new Set(rawPayments.map((p: any) => p.tenant_id || p.tenantId).filter(Boolean));
    allPaymentTenantIds.forEach(tid => {
      if (duesMap[tid] !== undefined) return; // already computed above
      const explicitDues = storeDues.filter((d: any) => d.tenant_id === tid && (d.status === 'pending' || d.status === 'overdue'))
                                    .reduce((sum: number, d: any) => {
                                      const rem = d.pending_balance !== undefined ? parseAmount(d.pending_balance) : Math.max(0, parseAmount(d.amount) - parseAmount(d.amount_paid));
                                      return sum + rem;
                                    }, 0);
      duesMap[tid] = explicitDues;
    });

    const enriched = rawPayments.map((p: any) => {
      const tenantId = p.tenant_id || p.tenantId;
      const tenant = tenantsMap[tenantId] || {};
      const room = roomsMap[p.room_id] || roomsMap[tenant.room_id] || (typeof tenant.rooms === 'object' ? tenant.rooms : {}) || {};

      // Prioritize payment's own recorded pending_balance on the transaction receipt
      const pendingTotal = p.pending_balance !== undefined 
        ? parseAmount(p.pending_balance) 
        : (duesMap[tenantId] !== undefined ? duesMap[tenantId] : 0);

      return {
        ...p,
        tenant_name: p.tenant_name || tenant.full_name || tenant.name || 'Tenant',
        room_number: p.room_number || room.room_number || tenant.room_number || tenant.room || 'N/A',
        payment_date: p.payment_date || p.created_at || p.date || new Date().toISOString(),
        facePicture: p.facePicture || tenant.face_picture || tenant.facePicture || tenant.documents?.photo || tenant.documents?.facePicture || tenant.documents?.photo_url || tenant.avatar || tenant.photo_url || tenant.photoUrl || null,
        current_pending_total: pendingTotal
      };
    });

    return enriched.sort((a: any, b: any) => 
      new Date(b.payment_date || b.created_at || 0).getTime() - new Date(a.payment_date || a.created_at || 0).getTime()
    );
  }, [rawPayments, storeTenants, storeRooms, effectiveHostelData]);

  const baseFilteredPayments = useMemo(() => {
    return payments.filter((p: any) => {
      // Search logic
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          (p.tenant_name?.toLowerCase().includes(query)) ||
          (p.room_number?.toString().toLowerCase().includes(query)) ||
          (p.payment_id?.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }

      // Status logic
      if (filters.paymentStatus.length > 0) {
        const status = p.is_partial ? 'Partial' : (p.status === 'paid' ? 'Paid' : 'Pending');
        if (!filters.paymentStatus.includes(status)) return false;
      }

      // Collected By logic
      if (filters.collectedBy && filters.collectedBy.length > 0) {
        const isOwnerSelected = ownerId && filters.collectedBy.includes(ownerId);
        if (!p.collected_by_uid) {
          // Treat legacy payments (no UID) as collected by the Owner
          if (!isOwnerSelected) return false;
        } else if (!filters.collectedBy.includes(p.collected_by_uid)) {
          return false;
        }
      }

      // Method logic
      if (filters.paymentMethod.length > 0) {
        const method = p.payment_method || 'Other';
        if (!filters.paymentMethod.includes(method)) return false;
      }

      return true;
    });
  }, [payments, searchQuery, filters, ownerId]);

  const filteredPayments = useMemo(() => {
    const now = new Date();
    return baseFilteredPayments.filter((p: any) => {
      if (!p.payment_date) return false;
      const paymentDate = parseISO(p.payment_date);

      // Date logic
      let dateMatch = true;
      switch (filters.dateRange) {
        case 'Today': dateMatch = isWithinInterval(paymentDate, { start: startOfDay(now), end: endOfDay(now) }); break;
        case 'Yesterday': dateMatch = isWithinInterval(paymentDate, { start: startOfDay(subDays(now, 1)), end: endOfDay(subDays(now, 1)) }); break;
        case 'This Week': dateMatch = isWithinInterval(paymentDate, { start: startOfWeek(now), end: endOfWeek(now) }); break;
        case 'Last Week': dateMatch = isWithinInterval(paymentDate, { start: startOfWeek(subWeeks(now, 1)), end: endOfWeek(subWeeks(now, 1)) }); break;
        case 'This Quarter': dateMatch = isWithinInterval(paymentDate, { start: startOfQuarter(now), end: endOfQuarter(now) }); break;
        case 'This Year': dateMatch = isWithinInterval(paymentDate, { start: startOfYear(now), end: endOfYear(now) }); break;
        case 'Month': 
          if (filters.customMonth !== undefined && filters.customYear !== undefined) {
            dateMatch = getMonth(paymentDate) === filters.customMonth && getYear(paymentDate) === filters.customYear;
          }
          break;
        default: break;
      }
      return dateMatch;
    });
  }, [baseFilteredPayments, filters.dateRange, filters.customMonth, filters.customYear]);

  const totalCollectedToday = useMemo(() => {
    const now = new Date();
    return baseFilteredPayments.reduce((sum: number, p: any) => {
      if (!p.payment_date) return sum;
      const paymentDate = parseISO(p.payment_date);
      if (isWithinInterval(paymentDate, { start: startOfDay(now), end: endOfDay(now) })) {
        return sum + (p.amount_paid || p.amount || 0);
      }
      return sum;
    }, 0);
  }, [baseFilteredPayments]);

  const myCollectionToday = useMemo(() => {
    const now = new Date();
    return baseFilteredPayments.reduce((sum: number, p: any) => {
      if (!p.payment_date) return sum;
      const paymentDate = parseISO(p.payment_date);
      if (isWithinInterval(paymentDate, { start: startOfDay(now), end: endOfDay(now) })) {
        const isMine = p.collected_by_uid === ownerId || (!p.collected_by_uid && userProfile?.role !== 'team_member');
        if (isMine) {
          return sum + (p.amount_paid || p.amount || 0);
        }
      }
      return sum;
    }, 0);
  }, [baseFilteredPayments, ownerId, userProfile]);

  const totalCollectedFiltered = useMemo(() => {
    return filteredPayments.reduce((sum: number, p: any) => sum + (p.amount_paid || p.amount || 0), 0);
  }, [filteredPayments]);

  const totalCollectedThisMonth = useMemo(() => {
    const now = new Date();
    return baseFilteredPayments.reduce((sum: number, p: any) => {
      if (!p.payment_date) return sum;
      const paymentDate = parseISO(p.payment_date);
      if (isWithinInterval(paymentDate, { start: startOfMonth(now), end: endOfMonth(now) })) {
        return sum + (p.amount_paid || p.amount || 0);
      }
      return sum;
    }, 0);
  }, [baseFilteredPayments]);

  const handlePrintReceipt = (payment: any) => {
    const formatDateTime = (isoString: string) => {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) + ', ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const pendingFee = payment.current_pending_total !== undefined ? payment.current_pending_total : (payment.pending_balance ? Number(payment.pending_balance) : 0);
    const amountPaid = Number(payment.amount_paid || payment.amount);
    
    // Generate QR code data
    const qrData = encodeURIComponent(`Raliving Receipt\nID: ${payment.payment_id ? payment.payment_id.substring(0,8).toUpperCase() : 'N/A'}\nTenant: ${payment.tenant_name}\nAmount: ₹${amountPaid}\nPending: ₹${pendingFee}\nStatus: Successful`);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrData}`;

    const receiptHtml = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payment Receipt</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
          <style>
            :root {
              --primary: #3b82f6;
              --text-main: #0f172a;
              --text-muted: #64748b;
              --bg-page: #f1f5f9;
              --bg-card: #ffffff;
              --border: #e2e8f0;
              --success: #16a34a;
              --success-bg: #dcfce7;
            }
            body { 
              font-family: 'Inter', sans-serif; 
              background-color: var(--bg-page); 
              margin: 0; 
              padding: 2rem; 
              display: flex; 
              justify-content: center;
              color: var(--text-main);
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .receipt-wrapper {
              background: var(--bg-card);
              width: 100%;
              max-width: 600px;
              border-radius: 12px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.05);
              position: relative;
              overflow: hidden;
            }
            .receipt-content {
              padding: 2.5rem;
              position: relative;
              z-index: 2;
            }
            /* Header */
            .header-bar {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 2rem;
            }
            .brand {
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .brand-icon {
              width: 32px;
              height: 32px;
              background: var(--primary);
              border-radius: 8px 8px 8px 2px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: 800;
              font-size: 20px;
              font-style: italic;
            }
            .brand-name {
              font-weight: 700;
              font-size: 1.125rem;
              line-height: 1;
            }
            .brand-sub {
              font-size: 0.65rem;
              color: var(--text-muted);
              margin-top: 4px;
              letter-spacing: 0.5px;
            }
            .receipt-meta {
              text-align: right;
            }
            .receipt-badge {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              color: var(--primary);
              font-size: 0.75rem;
              font-weight: 600;
              background: #eff6ff;
              padding: 4px 10px;
              border-radius: 20px;
            }
            .receipt-id {
              font-size: 0.65rem;
              color: var(--text-muted);
              margin-top: 8px;
            }
            /* Title */
            .title-section {
              text-align: center;
              margin-bottom: 2rem;
            }
            .title-section h1 {
              margin: 0;
              font-size: 1.75rem;
              font-weight: 800;
              letter-spacing: -0.5px;
            }
            .title-section h1 span {
              color: var(--primary);
            }
            .title-section p {
              margin: 8px 0 0;
              font-size: 0.875rem;
              color: var(--text-muted);
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 12px;
              font-weight: 500;
            }
            .title-section p::before, .title-section p::after {
              content: '';
              display: block;
              width: 6px;
              height: 6px;
              border-radius: 50%;
              background: var(--primary);
              opacity: 0.5;
            }
            /* Main Details Card */
            .details-card {
              background: #ffffff;
              border: 1px solid var(--border);
              border-radius: 16px;
              padding: 1.5rem;
              box-shadow: 0 4px 12px rgba(0,0,0,0.02);
              margin-bottom: 1.5rem;
            }
            .detail-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 0.875rem 0;
              border-bottom: 1px dashed var(--border);
            }
            .detail-row:last-child {
              border-bottom: none;
            }
            .detail-label {
              display: flex;
              align-items: center;
              gap: 12px;
              font-size: 0.875rem;
              font-weight: 500;
              color: var(--text-muted);
            }
            .icon-circle {
              width: 28px;
              height: 28px;
              border-radius: 50%;
              background: #eff6ff;
              display: flex;
              align-items: center;
              justify-content: center;
              color: var(--primary);
            }
            .detail-value {
              font-weight: 600;
              font-size: 0.9375rem;
            }
            /* Amount Box */
            .amount-box {
              background: var(--success-bg);
              border-radius: 12px;
              padding: 1rem 1.5rem;
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-top: 0.5rem;
            }
            .amount-box .detail-label {
              color: var(--text-main);
              font-weight: 600;
            }
            .amount-box .icon-circle {
              background: #bbf7d0;
              color: var(--success);
            }
            .amount-box .amount-value {
              font-size: 1.75rem;
              font-weight: 700;
              color: var(--success);
            }
            /* Success & Verification Box */
            .success-box {
              background: #f8fafc;
              border-radius: 16px;
              padding: 1.5rem;
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 2rem;
            }
            .success-left {
              display: flex;
              align-items: center;
              gap: 16px;
            }
            .success-check {
              width: 48px;
              height: 48px;
              background: var(--success-bg);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              position: relative;
            }
            .success-check::after {
              content: '';
              position: absolute;
              width: 60px;
              height: 60px;
              border-radius: 50%;
              border: 2px dashed #bbf7d0;
              animation: spin 10s linear infinite;
            }
            .success-check svg {
              width: 24px;
              height: 24px;
              color: var(--success);
            }
            .success-text h3 {
              margin: 0 0 4px;
              font-size: 1rem;
              font-weight: 600;
              color: var(--success);
            }
            .success-text p {
              margin: 0;
              font-size: 0.75rem;
              color: var(--text-muted);
              line-height: 1.4;
            }
            .qr-code {
              text-align: center;
              background: white;
              padding: 8px;
              border-radius: 8px;
              border: 1px solid var(--border);
            }
            .qr-code img {
              width: 60px;
              height: 60px;
              display: block;
              margin: 0 auto;
            }
            .qr-code p {
              margin: 4px 0 0;
              font-size: 0.6rem;
              color: var(--text-muted);
              font-weight: 600;
            }
            /* Footer */
            .receipt-footer {
              text-align: center;
              font-size: 0.75rem;
              color: var(--text-muted);
              position: relative;
              z-index: 2;
            }
            .receipt-footer strong {
              color: var(--text-main);
            }
            .receipt-footer .brand-text {
              color: var(--primary);
              font-weight: 600;
            }
            /* Background Skyline */
            .skyline-bg {
              position: absolute;
              bottom: 0;
              left: 0;
              width: 100%;
              height: 120px;
              background-image: url('data:image/svg+xml;utf8,<svg viewBox="0 0 1000 200" xmlns="http://www.w3.org/2000/svg"><path fill="%23e2e8f0" opacity="0.4" d="M0 200V120h40v-30h30v30h20v-50h40v-40h50v90h30v-20h40v20h20v-70h40v70h30v-40h40v40h20v-60h40v60h30v-80h50v80h20v-30h40v30h30v-50h40v50h20v-20h40v20h30v-40h40v40h20v-60h40v60h30v-80h50v80h20v-30h40v30h30v-50h40v50h20v-20h40v20h30v-40h40v40h20v-60h40v200H0z"/></svg>');
              background-size: cover;
              background-position: bottom;
              z-index: 1;
              pointer-events: none;
            }
            /* Zig-zag bottom */
            .zig-zag {
              position: absolute;
              bottom: -10px;
              left: 0;
              width: 100%;
              height: 20px;
              background: linear-gradient(135deg, transparent 25%, transparent 25%) -10px 0, linear-gradient(225deg, transparent 25%, transparent 25%) -10px 0, linear-gradient(315deg, var(--bg-page) 25%, transparent 25%), linear-gradient(45deg, var(--bg-page) 25%, transparent 25%);
              background-size: 20px 20px;
              z-index: 3;
            }
            @media print {
              body { background: transparent; padding: 0; }
              .receipt-wrapper { max-width: 100%; box-shadow: none; border-radius: 0; }
              .zig-zag { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="receipt-wrapper">
            <div class="receipt-content">
              
              <!-- Header -->
              <div class="header-bar">
                <div class="brand">
                  <img src="${window.location.origin}/himalaya_logo_premium.png" alt="Logo" style="width: 34px; height: 34px; object-fit: contain; border-radius: 6px; margin-right: 12px;" />
                  <div>
                    <div class="brand-name">${payment.pg_name || 'A1 Hostels'}</div>
                    <div class="brand-sub">Smart PG Management</div>
                  </div>
                </div>
                <div class="receipt-meta">
                  <div class="receipt-badge">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    Payment Receipt
                  </div>
                  <div class="receipt-id">Receipt ID: SS-${payment.payment_id ? payment.payment_id.substring(0, 8).toUpperCase() : 'N/A'}</div>
                </div>
              </div>

              <!-- Title -->
              <div class="title-section">
                <h1>PAYMENT <span>RECEIPT</span></h1>
                <p>Official record of payment</p>
              </div>

              <!-- Details Card -->
              <div class="details-card">
                <div class="detail-row">
                  <div class="detail-label">
                    <div class="icon-circle">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    </div>
                    Date & Time
                  </div>
                  <div class="detail-value">${formatDateTime(payment.payment_date)}</div>
                </div>
                <div class="detail-row">
                  <div class="detail-label">
                    <div class="icon-circle">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    </div>
                    Tenant Name
                  </div>
                  <div class="detail-value">${payment.tenant_name}</div>
                </div>
                <div class="detail-row">
                  <div class="detail-label">
                    <div class="icon-circle">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14h18"></path><path d="M3 10h18"></path><path d="M3 6h18"></path><path d="M3 18h18"></path></svg>
                    </div>
                    Room Number
                  </div>
                  <div class="detail-value">${payment.room_number}</div>
                </div>
                <div class="detail-row">
                  <div class="detail-label">
                    <div class="icon-circle">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
                    </div>
                    Hostel Name
                  </div>
                  <div class="detail-value">${payment.pg_name || 'N/A'}</div>
                </div>
                <div class="detail-row">
                  <div class="detail-label">
                    <div class="icon-circle">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
                    </div>
                    Payment Method
                  </div>
                  <div class="detail-value">${payment.payment_method || 'N/A'}${payment.is_partial ? ' (Partial)' : ''}</div>
                </div>
                <div class="detail-row" style="background: #f0fdf4; margin: 4px -8px; padding: 10px 8px; border-radius: 8px;">
                  <div class="detail-label">
                    <div class="icon-circle" style="background:#dcfce7; color:#16a34a">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    Paid Fee Type(s)
                  </div>
                  <div class="detail-value" style="color:#16a34a; font-weight:700">
                    ${payment.paid_fee_summary || payment.description || 'Rent Payment'}
                  </div>
                </div>
                <div class="detail-row" style="${pendingFee > 0 ? 'background: #fef2f2; margin: 4px -8px; padding: 10px 8px; border-radius: 8px;' : ''}">
                  <div class="detail-label">
                    <div class="icon-circle" style="${pendingFee > 0 ? 'background:#fee2e2; color:#dc2626' : 'background:#dcfce7; color:#16a34a'}">
                      ${pendingFee > 0 ? 
                        `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>` : 
                        `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
                      }
                    </div>
                    Pending Fee Types
                  </div>
                  <div class="detail-value" style="${pendingFee > 0 ? 'color:#dc2626; font-weight:700' : 'color:#16a34a; font-weight:700'}">
                    ${pendingFee > 0 ? 
                      `${payment.pending_fee_summary || 'Remaining Dues'} (Total: ₹${pendingFee.toLocaleString('en-IN')})` : 
                      `<span style="font-size:0.75rem; background:#dcfce7; color:#15803d; padding:2px 8px; border-radius:10px; font-weight:600">Paid in Full (Clear)</span>`
                    }
                  </div>
                </div>
                
                <div class="amount-box">
                  <div class="detail-label">
                    <div class="icon-circle">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                    </div>
                    Amount Paid
                  </div>
                  <div class="amount-value">₹${amountPaid.toLocaleString('en-IN')}</div>
                </div>
              </div>

              <!-- Success Box -->
              <div class="success-box">
                <div class="success-left">
                  <div class="success-check">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                  <div class="success-text">
                    <h3>Payment Successful</h3>
                    <p>Thank you! Your payment has been<br>received successfully.</p>
                  </div>
                </div>
                <div class="qr-code">
                  <img src="${qrUrl}" alt="QR">
                  <p>Scan to Verify</p>
                </div>
              </div>

              <!-- Footer -->
              <div class="receipt-footer">
                <div style="margin-bottom: 4px;">Generated by <span class="brand-text">Raliven Innovations</span></div>
                <div>Thank you for your payment!</div>
              </div>
            </div>
            
            <div class="skyline-bg"></div>
            <div class="zig-zag"></div>
          </div>
          
          <script>
            window.onload = function() { 
              setTimeout(function() { window.print(); }, 500);
            }
          </script>
        </body>
      </html>
    `;
    const isDesktop = window.matchMedia("(min-width: 769px)").matches;
    if (isDesktop) {
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(receiptHtml);
        win.document.close();
      }
    } else {
      const blob = new Blob([receiptHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Receipt_${payment.tenant_name.replace(/\s+/g, '_')}_${payment.payment_id?.substring(0,8) || 'SS'}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };



  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const years = [new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2];

  if (!isMounted) return null;

  return (
    <div className={styles.container}>

      <div className={styles.statsContainer}>
        <div className={styles.summaryCardBlue}>
          <div className={styles.summaryContent}>
            <div className={styles.summaryTitleWhite}>Today's Collection</div>
            <div className={styles.summaryAmountWhite}>₹{totalCollectedToday.toLocaleString('en-IN')}</div>
          </div>
        </div>
        <div className={styles.summaryCardPurple}>
          <div className={styles.summaryContent}>
            <div className={styles.summaryTitleWhite}>My Collection Today</div>
            <div className={styles.summaryAmountWhite}>₹{myCollectionToday.toLocaleString('en-IN')}</div>
          </div>
        </div>
        <div className={styles.summaryCardGreen}>
          <div className={styles.summaryContent}>
            <div className={styles.summaryTitleWhite}>
              {searchQuery ? 'Search Results' : 
               (filters.dateRange === 'Month' && filters.customMonth !== undefined && filters.customYear !== undefined ? `${months[filters.customMonth]} ${filters.customYear}` :
               (filters.dateRange !== 'All Time' ? filters.dateRange : 
               (filters.paymentStatus.length > 0 || filters.paymentMethod.length > 0 ? 'Filtered' : `${months[new Date().getMonth()]} ${new Date().getFullYear()}`)))}
            </div>
            <div className={styles.summaryAmountWhite}>
              ₹{((filters.dateRange !== 'All Time' || filters.paymentStatus.length > 0 || filters.paymentMethod.length > 0 || searchQuery !== '') 
                  ? totalCollectedFiltered 
                  : totalCollectedThisMonth).toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.searchFilterRow}>
        <div className={styles.searchWrapper}>
          <Search size={18} className={styles.searchIcon} />
          <input 
            type="text" 
            placeholder="Search tenant, room, mobile, receipt..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        <button className={styles.filterBtn} onClick={() => setIsFilterOpen(true)} style={{ position: 'relative' }}>
          <Filter size={18} />
          {(filters.dateRange !== 'All Time' || filters.paymentStatus.length > 0 || filters.paymentMethod.length > 0 || filters.collectedBy.length > 0) && (
            <div style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, backgroundColor: '#ea580c', borderRadius: '50%' }} />
          )}
        </button>
      </div>

      {(filters.dateRange !== 'All Time' || filters.paymentStatus.length > 0 || filters.paymentMethod.length > 0 || filters.collectedBy.length > 0) && (
        <div className={styles.activeFiltersRow}>
          <div className={styles.activeFiltersScroll}>
            {filters.dateRange !== 'All Time' && (
              <div className={styles.activeFilterChip}>
                {filters.dateRange === 'Month' && filters.customMonth !== undefined && filters.customYear !== undefined ? `${months[filters.customMonth]} ${filters.customYear}` : filters.dateRange} <button onClick={() => setFilters({...filters, dateRange: 'All Time'})}><X size={12}/></button>
              </div>
            )}
            {filters.paymentStatus.map(st => (
              <div key={st} className={styles.activeFilterChip}>
                {st} <button onClick={() => setFilters({...filters, paymentStatus: filters.paymentStatus.filter(s => s !== st)})}><X size={12}/></button>
              </div>
            ))}
            {filters.paymentMethod.map(method => (
              <div key={method} className={styles.activeFilterChip}>
                {method} <button onClick={() => setFilters({...filters, paymentMethod: filters.paymentMethod.filter(m => m !== method)})}><X size={12}/></button>
              </div>
            ))}
            {filters.collectedBy.map(collector => {
              const name = teamMembers?.find(m => (m.auth_uid || m.id) === collector)?.name || (collector === ownerId ? 'Owner' : 'Collector');
              return (
                <div key={collector} className={styles.activeFilterChip}>
                  {name} <button onClick={() => setFilters({...filters, collectedBy: filters.collectedBy.filter(c => c !== collector)})}><X size={12}/></button>
                </div>
              );
            })}
          </div>
          <button className={styles.clearAllFilters} onClick={() => setFilters({ dateRange: 'All Time', paymentStatus: [], paymentMethod: [], collectedBy: [], customMonth: new Date().getMonth(), customYear: new Date().getFullYear() })}>
            Clear All
          </button>
        </div>
      )}

      <div className={styles.transactionList}>
        {(swrLoading && !effectiveHostelData && !!selectedPgId) && payments.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ height: '80px', backgroundColor: '#f1f5f9', borderRadius: '16px', animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        ) : filteredPayments.length > 0 ? (
          filteredPayments.map((payment: any) => {
            const pendingBal = payment.current_pending_total !== undefined ? payment.current_pending_total : Number(payment.pending_balance || 0);
            const isClear = pendingBal <= 0;
            const isExpanded = expandedCardId === payment.payment_id;

            return (
              <div 
                key={payment.payment_id} 
                className={styles.transactionCard}
                onClick={() => setExpandedCardId(prev => prev === payment.payment_id ? null : payment.payment_id)}
                style={{ cursor: 'pointer', flexDirection: 'column', alignItems: 'stretch' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <AvatarImage 
                    src={payment.facePicture} 
                    name={payment.tenant_name || 'T'} 
                    alt={payment.tenant_name || 'T'} 
                    size={42} 
                  />
                  
                  <div className={styles.cardCenterContent}>
                    <div className={styles.tenantInfoRow}>
                      <span className={styles.tenantName}>{payment.tenant_name}</span>
                      <span className={styles.upiBadge}>{payment.payment_method || 'UPI'}</span>
                    </div>
                    
                    <div className={styles.dateTimeRow}>
                      <span>{new Date(payment.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                      <span>•</span>
                      <span>{new Date(payment.payment_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                    </div>

                    <div className={styles.collectorRow} style={{ marginTop: '4px' }}>
                      <User size={12} />
                      <span>Collected by: <span className={styles.collectorName}>{payment.collected_by_name || 'System'}</span></span>
                    </div>
                  </div>

                  <div className={styles.cardRightSide}>
                    <div className={styles.amountStatusCol}>
                      <span className={isClear ? styles.amountClear : styles.amountPositive}>
                        +₹{Number(payment.amount_paid || payment.amount || 0).toLocaleString('en-IN')}
                      </span>
                      <span className={isClear ? styles.pendingBadgeClear : styles.pendingBadgeDue}>
                        {isClear ? 'Clear' : `Due: ₹${pendingBal.toLocaleString('en-IN')}`}
                      </span>
                    </div>
                    
                    <div className={styles.verticalDivider} />
                    
                    <div className={styles.downloadActionCol}>
                      <span className={styles.roomBadge}>Rm {payment.room_number}</span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrintReceipt(payment);
                        }} 
                        className={styles.downloadIconBtn} 
                        title="Download / Print Receipt"
                        aria-label="Download Receipt"
                      >
                        <Download size={14} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Pure CSS GPU-Accelerated Accordion Panel */}
                <div style={{
                  display: 'grid',
                  gridTemplateRows: isExpanded ? '1fr' : '0fr',
                  transition: 'grid-template-rows 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
                  overflow: 'hidden',
                  width: '100%'
                }}>
                  <div style={{
                    minHeight: 0,
                    opacity: isExpanded ? 1 : 0,
                    transform: isExpanded ? 'translateY(0)' : 'translateY(-6px)',
                    transition: 'opacity 0.22s ease, transform 0.22s ease',
                    borderTop: isExpanded ? '1px solid #f1f5f9' : '1px solid transparent',
                    marginTop: isExpanded ? '10px' : '0px',
                    paddingTop: isExpanded ? '10px' : '0px'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#f8fafc', padding: '12px 14px', borderRadius: '12px', fontSize: '0.82rem', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#047857', fontWeight: 600 }}>🟢 Fee Paid:</span>
                        <span style={{ color: '#065f46', fontWeight: 700 }}>{payment.paid_fee_summary || payment.description || 'Rent'}</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: isClear ? '#475569' : '#dc2626', fontWeight: 600 }}>
                          {isClear ? '⚪ Pending Fees:' : '🔴 Pending Fees Remaining:'}
                        </span>
                        <span style={{ color: isClear ? '#475569' : '#b91c1c', fontWeight: 700 }}>
                          {isClear ? 'None (Fully Cleared)' : `Remaining Balance (₹${pendingBal.toLocaleString('en-IN')})`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <AlertCircle size={24} />
            </div>
            <h3>No payments found</h3>
            <p>No fees were collected during this period.</p>
          </div>
        )}
      </div>
      <AnimatePresence>
        {isFilterOpen && (
          <FilterModal 
            isOpen={isFilterOpen} 
            onClose={() => setIsFilterOpen(false)} 
            filters={filters} 
            setFilters={setFilters} 
            teamMembers={teamMembers}
            ownerId={ownerId}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterModal({ isOpen, onClose, filters, setFilters, teamMembers, ownerId }: { isOpen: boolean, onClose: () => void, filters: FilterState, setFilters: (f: FilterState) => void, teamMembers?: any[], ownerId?: string | null }) {
  const [localFilters, setLocalFilters] = useState<FilterState>(filters);

  const applyFilters = () => {
    setFilters(localFilters);
    onClose();
  };

  const toggleArrayItem = (array: string[], item: string) => {
    if (array.includes(item)) return array.filter(i => i !== item);
    return [...array, item];
  };

  const collectorOptions = [
    { uid: ownerId, name: 'Owner' },
    ...(teamMembers || []).filter(m => m.permissions?.collectPayments).map(m => ({ uid: m.auth_uid || m.id, name: m.name || m.full_name }))
  ].filter(c => c.uid);

  const dateOptions = ['All Time', 'Today', 'Yesterday', 'This Week', 'Last Week', 'Month', 'This Quarter', 'This Year'];
  const statusOptions = ['Paid', 'Partial', 'Pending', 'Overdue', 'Refunded'];
  const methodOptions = ['UPI', 'Cash', 'Bank', 'Card', 'Other'];

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const years = [new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2];

  return (
    <>
      <motion.div 
        className={styles.modalOverlay}
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        onClick={onClose}
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
            onClick={() => setLocalFilters({ dateRange: 'All Time', customMonth: new Date().getMonth(), customYear: new Date().getFullYear(), paymentStatus: [], paymentMethod: [], collectedBy: [] })} 
            className={styles.resetBtn}
          >
            Reset
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.filterSection}>
            <h3>Date</h3>
            <div className={styles.optionsGrid}>
              {dateOptions.map(opt => (
                <button 
                  key={opt} 
                  className={`${styles.filterOptionBtn} ${localFilters.dateRange === opt ? styles.selected : ''}`}
                  onClick={() => setLocalFilters({
                    ...localFilters, 
                    dateRange: opt,
                    ...(opt === 'Month' && localFilters.customMonth === undefined ? { customMonth: new Date().getMonth(), customYear: new Date().getFullYear() } : {})
                  })}
                >
                  {opt}
                </button>
              ))}
            </div>
            {localFilters.dateRange === 'Month' && (
              <div className={styles.customDateContainer}>
                <div style={{ width: '140px' }}>
                  <CustomSelect 
                    value={localFilters.customMonth?.toString() || new Date().getMonth().toString()} 
                    onChange={(val) => setLocalFilters({...localFilters, customMonth: Number(val)})}
                    options={months.map((m, i) => ({ value: i.toString(), label: m }))}
                  />
                </div>
                <div style={{ width: '100px' }}>
                  <CustomSelect 
                    value={localFilters.customYear?.toString() || new Date().getFullYear().toString()} 
                    onChange={(val) => setLocalFilters({...localFilters, customYear: Number(val)})}
                    options={years.map((y) => ({ value: y.toString(), label: y.toString() }))}
                  />
                </div>
              </div>
            )}
          </div>

          <div className={styles.filterSection}>
            <h3>Payment Status</h3>
            <div className={styles.optionsGrid}>
              {statusOptions.map(opt => (
                <button 
                  key={opt} 
                  className={`${styles.filterOptionBtn} ${localFilters.paymentStatus.includes(opt) ? styles.selected : ''}`}
                  onClick={() => setLocalFilters({...localFilters, paymentStatus: toggleArrayItem(localFilters.paymentStatus, opt)})}
                >
                  {localFilters.paymentStatus.includes(opt) && <Check size={12} />}
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterSection}>
            <h3>Payment Method</h3>
            <div className={styles.optionsGrid}>
              {methodOptions.map(opt => (
                <button 
                  key={opt} 
                  className={`${styles.filterOptionBtn} ${localFilters.paymentMethod.includes(opt) ? styles.selected : ''}`}
                  onClick={() => setLocalFilters({...localFilters, paymentMethod: toggleArrayItem(localFilters.paymentMethod, opt)})}
                >
                  {localFilters.paymentMethod.includes(opt) && <Check size={12} />}
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterSection}>
            <h3>Collected By</h3>
            <div className={styles.optionsGrid}>
              {collectorOptions.map(opt => (
                <button 
                  key={opt.uid as string} 
                  className={`${styles.filterOptionBtn} ${(localFilters.collectedBy || []).includes(opt.uid as string) ? styles.selected : ''}`}
                  onClick={() => setLocalFilters({...localFilters, collectedBy: toggleArrayItem(localFilters.collectedBy || [], opt.uid as string)})}
                >
                  {(localFilters.collectedBy || []).includes(opt.uid as string) && <Check size={12} />}
                  {opt.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.applyBtn} onClick={applyFilters}>Apply Filters</button>
        </div>
      </motion.div>
    </>
  );
}

export default function HistoryPage() { return <Suspense fallback={<div>Loading...</div>}><HistoryPageContent /></Suspense>; }
