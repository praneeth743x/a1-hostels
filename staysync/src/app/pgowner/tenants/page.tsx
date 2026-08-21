/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Camera, X, Building2, MoreVertical, Filter, Users, ChevronRight, ChevronLeft, Save, CheckCircle2, Menu, Bell, BedDouble, IndianRupee, Home, Calendar, AlertTriangle, AlertCircle, User, Phone, Mail, Briefcase, PhoneCall } from 'lucide-react';
import { FloatingInput } from '@/components/FloatingInput';
import { AnimatedButton } from '@/components/AnimatedButton';
import { CustomDatePicker } from '@/components/CustomDatePicker';
import { getTenants, addTenant, getPropertiesWithRooms, getPendingDues, getPaymentHistory } from '@/app/actions/pgowner';
import { storage, auth } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import imageCompression from 'browser-image-compression';
import styles from './tenantsList.module.css';
import { CustomSelect } from '@/components/CustomSelect';
import { useHostelData, notifyHostelDataChanged } from '@/hooks/useHostelData';
import { useHostel } from '@/context/HostelContext';
import { AvatarImage } from '@/components/AvatarImage';
import { rpcCall } from '@/lib/rpc';

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
    nextDueDate,
    monthShort: nextDueDate.toLocaleString('default', { month: 'short' })
  };
};

function TenantDirectoryContent() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterHostel, setFilterHostel] = useState('all');
  const [tenantStatusFilter, setTenantStatusFilter] = useState('Active');
  const [showModal, setShowModal] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedPgId: contextPgId, properties: contextProperties, userProfile } = useHostel();
  const activePgId = searchParams.get('pgId') || (filterHostel !== 'all' ? filterHostel : contextPgId || (typeof localStorage !== 'undefined' ? localStorage.getItem('activePgId') : null));
  const { data: hostelData, isLoading } = useHostelData(activePgId);

  const roomsMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    if (hostelData?.rooms && Array.isArray(hostelData.rooms)) {
      hostelData.rooms.forEach((r: any) => {
        if (r.id) map[r.id] = r.room_number;
        if (r.room_id) map[r.room_id] = r.room_number;
      });
    }
    return map;
  }, [hostelData?.rooms]);

  const processedFromCache = React.useMemo(() => {
    if (hostelData?.tenants && Array.isArray(hostelData.tenants)) {
      return hostelData.tenants.map((t: any) => {
        const dues = (hostelData.dues || []).filter((d: any) => d.tenant_id === t.tenant_id);
        dues.sort((a: any, b: any) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
        const due = dues.length > 0 ? dues[0] : null;

        let nextDueDate = new Date();
        let paymentState = 'empty';
        let daysDiff = 0;

        let targetDay = 5;
        if (t.move_in_date) {
          const checkin = new Date(t.move_in_date);
          if (!isNaN(checkin.getTime())) targetDay = checkin.getDate();
        }

        const today = new Date();
        today.setHours(0,0,0,0);

        if (due) {
          const createdAt = new Date(due.created_at || Date.now());
          nextDueDate = new Date(createdAt);
          nextDueDate.setDate(targetDay);
          nextDueDate.setHours(0,0,0,0);

          const diffTime = today.getTime() - nextDueDate.getTime();
          daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (daysDiff > 30) {
            paymentState = 'critical';
          } else if (daysDiff > 0) {
            paymentState = 'overdue';
          } else if (daysDiff === 0) {
            paymentState = 'today';
          } else {
            paymentState = 'upcoming';
            daysDiff = Math.abs(daysDiff);
          }
        } else {
          const tenantPaid = (hostelData.payments || []).filter((p: any) => p.tenant_id === t.tenant_id);
          const unpaidInfo = getNextUnpaidMonthAndDate(t, tenantPaid);
          daysDiff = unpaidInfo.dueDays;
          nextDueDate = unpaidInfo.nextDueDate;
          paymentState = daysDiff === 0 ? 'today' : 'upcoming';
        }

        const isVacated = t.is_active === false || t.status === 'vacated' || t.status === 'VACATED';
        const isNotice = t.status === 'notice_period' || t.status === 'notice';
        const isPaused = t.status === 'PAUSED' || t.status === 'paused';
        const statusLabel = isVacated ? 'Vacated' : (isPaused ? 'Paused' : (isNotice ? 'Notice Period' : 'Active'));
        const resolvedRoom = t.rooms?.room_number || t.room_number || (t.room_id ? roomsMap[t.room_id] : null) || (t.room ? roomsMap[t.room] : null) || t.room || 'N/A';

        if (isVacated || isPaused) {
          paymentState = 'paused';
        }

        return {
          id: t.tenant_id || t.id,
          name: t.full_name || t.name,
          hostel: t.pg_name || t.hostel,
          pg_id: t.pg_id,
          room: resolvedRoom,
          phone: t.mobile || t.phone,
          status: statusLabel,
          paymentState,
          daysDiff,
          face_picture: t.face_picture,
          facePicture: t.facePicture,
          documents: t.documents,
          avatar: t.avatar,
          photo_url: t.photo_url,
          photoUrl: t.photoUrl
        };
      });
    }
    return [];
  }, [hostelData, roomsMap]);

  const displayTenantsList = processedFromCache;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlPgId = searchParams.get('pgId');
      if (urlPgId) {
        setFilterHostel(urlPgId);
      }
      if (searchParams.get('add') === 'true') {
        setShowModal(true);
        const roomId = searchParams.get('roomId');
        if (roomId) setSelectedRoom(roomId);
        const rUrl = searchParams.get('returnUrl');
        if (rUrl) setReturnUrl(rUrl);
      }
    }
  }, [searchParams]);
  
  // Form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [workStatus, setWorkStatus] = useState('student');
  const [selectedPg, setSelectedPg] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [returnUrl, setReturnUrl] = useState<string | null>(null);
  const [moveInDate, setMoveInDate] = useState<Date | null>(null);
  const [rentAmount, setRentAmount] = useState<number | ''>('');
  const [securityDeposit, setSecurityDeposit] = useState<number | ''>('');
  const [openingPendingFee, setOpeningPendingFee] = useState<number | ''>('');
  const [hasOldPendingFee, setHasOldPendingFee] = useState<boolean>(false);
  const [documents, setDocuments] = useState<any>({
    facePicture: null,
    govtFront: null,
    govtBack: null,
    collegeFront: null,
    collegeBack: null,
  });
  const [uploadProgress, setUploadProgress] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [openingTenantId, setOpeningTenantId] = useState<string | null>(null);

  const effectivePgId = selectedPg || (activePgId && activePgId !== 'all' ? activePgId : '') || (contextPgId && contextPgId !== 'all' ? contextPgId : '') || (contextProperties && contextProperties.length > 0 ? (contextProperties[0].pg_id || contextProperties[0].id) : '');
  const { data: modalHostelData } = useHostelData(effectivePgId);
  const targetHostelData = (effectivePgId === activePgId ? hostelData : modalHostelData) || hostelData;

  useEffect(() => {
    if (effectivePgId && selectedRoom && targetHostelData) {
      const r = targetHostelData.rooms?.find((room: any) => room.room_id === selectedRoom || room.id === selectedRoom);
      const prop = targetHostelData.property;
      if (r) {
        const directPrice = r.price || r.rent || r.monthly_rent;
        if (directPrice) {
          setRentAmount(Math.round(Number(directPrice)));
        } else if (prop?.theme_primary_color) {
          try {
            const pricing = JSON.parse(prop.theme_primary_color);
            const fee = pricing[r.total_beds || r.beds || 1];
            if (fee) {
              setRentAmount(Math.round(Number(fee)));
            }
          } catch (e) {
            console.error("Failed to parse pricing", e);
          }
        }
      }
    }
  }, [selectedRoom, effectivePgId, targetHostelData]);

  const [previews, setPreviews] = useState<Record<string, string>>({});

  const handleAddTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentOwnerId = userProfile?.owner_id || userProfile?.uid || auth.currentUser?.uid || (typeof localStorage !== 'undefined' ? localStorage.getItem('userUid') : '');
    const currentPgId = effectivePgId;
    if (!currentOwnerId) {
      alert("Unable to determine account owner. Please refresh and try again.");
      return;
    }
    if (!currentPgId) {
      alert("Please select a Hostel.");
      return;
    }
    if (!selectedRoom) {
      alert("Please select a Room.");
      return;
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
      alert("Please enter a valid 10-digit phone number.");
      return;
    }

    setIsSaving(true);
    setUploadProgress('Saving tenant...');

    try {
      // Hardware-accelerated Canvas image compression with safety fallback
      const compressFast = (file: File): Promise<Blob> => {
        if (file.size <= 300 * 1024) return Promise.resolve(file);
        return new Promise((resolve) => {
          const timeout = setTimeout(() => resolve(file), 1200);
          try {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
              clearTimeout(timeout);
              URL.revokeObjectURL(url);
              const canvas = document.createElement('canvas');
              const maxDim = 800;
              let w = img.width, h = img.height;
              if (w > maxDim || h > maxDim) {
                if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
                else { w = Math.round((w * maxDim) / h); h = maxDim; }
              }
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0, w, h);
              canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.7);
            };
            img.onerror = () => {
              clearTimeout(timeout);
              URL.revokeObjectURL(url);
              resolve(file);
            };
            img.src = url;
          } catch {
            clearTimeout(timeout);
            resolve(file);
          }
        });
      };

      const uploadFile = async (file: File, path: string) => {
        try {
          const blobToUpload = await compressFast(file);
          const storageRef = ref(storage, path);
          const uploadPromise = uploadBytes(storageRef, blobToUpload);
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500));
          await Promise.race([uploadPromise, timeoutPromise]);
          return await getDownloadURL(storageRef);
        } catch (err) {
          console.warn('Fast upload skipped file', err);
          return '';
        }
      };

      let documentUrls: any = {};
      const keysToUpload = Object.keys(documents).filter(key => documents[key] instanceof File);

      if (keysToUpload.length > 0) {
        try {
          const uploadTasks = keysToUpload.map(async (key) => {
            const file = documents[key];
            const path = `tenants/${currentOwnerId}/${Date.now()}_${key}.jpg`;
            const url = await uploadFile(file, path);
            return { key, url };
          });

          const results = await Promise.all(uploadTasks);
          results.forEach(({ key, url }) => {
            if (url) documentUrls[key] = url;
          });
        } catch (error: any) {
          console.warn("Upload finished with warnings:", error);
        }
      }
      
      const res = await rpcCall('addTenant', { 
        ownerId: currentOwnerId, 
        pgId: currentPgId, 
        roomId: selectedRoom, 
        fullName, 
        phone, 
        email: tenantEmail,
        parentPhone, 
        workStatus, 
        moveInDate: moveInDate ? moveInDate.toISOString() : new Date().toISOString(),
        rentAmount: rentAmount === '' ? 0 : Math.round(Number(rentAmount)),
        securityDeposit: securityDeposit === '' ? 0 : Math.round(Number(securityDeposit)),
        openingPendingFee: hasOldPendingFee && openingPendingFee !== '' ? Math.round(Number(openingPendingFee)) : 0,
        openingBalanceDueDate: hasOldPendingFee && moveInDate ? moveInDate.toISOString() : undefined,
        documents: documentUrls
      });
      
      if (res?.success) {
        notifyHostelDataChanged(currentPgId);
        
        if (returnUrl) {
          router.push(returnUrl);
        } else {
          setShowModal(false);
        }
        setFullName(''); setPhone(''); setTenantEmail(''); setParentPhone(''); setMoveInDate(null);
        setRentAmount(''); setSecurityDeposit(''); setOpeningPendingFee(''); setHasOldPendingFee(false);
        setDocuments({ facePicture: null, govtFront: null, govtBack: null, collegeFront: null, collegeBack: null, empFront: null, empBack: null });
        setPreviews({});
        setUploadProgress('');
        router.refresh();
      } else {
        alert("Failed to add tenant: " + (res?.error || "Unknown error"));
      }
    } catch (err: any) {
      console.error("Error adding tenant:", err);
      alert("Failed to add tenant: " + (err?.message || "An unexpected error occurred. Please try again."));
    } finally {
      setIsSaving(false);
      setUploadProgress('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setDocuments((prev: any) => ({ ...prev, [type]: file }));
      setPreviews((prev: any) => ({ ...prev, [type]: URL.createObjectURL(file) }));
    }
  };

  const currentRooms = React.useMemo(() => {
    const rooms = [...(targetHostelData?.rooms || [])];
    return rooms.sort((a: any, b: any) => {
      // 1. Sort by floor number
      const floorA = parseInt(String(a.floor || '0').replace(/[^0-9]/g, ''), 10) || 0;
      const floorB = parseInt(String(b.floor || '0').replace(/[^0-9]/g, ''), 10) || 0;
      
      if (floorA !== floorB) {
        return floorA - floorB;
      }
      
      // 2. Sort by room number
      const numA = parseInt(String(a.room_number || a.num || a.id || '').replace(/[^0-9]/g, ''), 10);
      const numB = parseInt(String(b.room_number || b.num || b.id || '').replace(/[^0-9]/g, ''), 10);
      
      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
        return numA - numB;
      }
      
      return String(a.room_number || '').localeCompare(String(b.room_number || ''), undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [targetHostelData?.rooms]);

  const filteredTenants = React.useMemo(() => {
    return displayTenantsList.filter((t: any) => {
      const matchesSearch = !searchTerm || t.name?.toLowerCase().includes(searchTerm.toLowerCase()) || String(t.phone || '').includes(searchTerm) || String(t.room || '').includes(searchTerm);
      const matchesHostel = filterHostel === 'all' || !filterHostel || t.pg_id === filterHostel;
      const matchesStatus = tenantStatusFilter === 'All' || t.status === tenantStatusFilter;
      return matchesSearch && matchesHostel && matchesStatus;
    });
  }, [displayTenantsList, searchTerm, filterHostel, tenantStatusFilter]);

  return (
    <div className={styles.mobileDashContainer} style={{ paddingTop: showModal ? '0' : '1rem' }}>
      <AnimatePresence mode="wait">
        {!showModal ? (
          <div 
            key="list"
          >
            <div className={styles.dashboardContent} style={{ marginTop: '-16px' }}>
              {/* Floating Cards */}
              <div className={styles.premiumCardsContainer}>
                {/* Row 1 */}
                <div 
                  className={styles.statsOverviewCard}
                >
                  <div 
                    className={styles.statColumn}
                    onClick={() => setTenantStatusFilter(tenantStatusFilter === 'Active' ? 'All' : 'Active')}
                    style={{
                      cursor: 'pointer',
                      padding: '8px 4px',
                      borderRadius: '10px',
                      transition: 'all 0.15s ease',
                      background: tenantStatusFilter === 'Active' ? '#eff6ff' : 'transparent',
                      border: tenantStatusFilter === 'Active' ? '1.5px solid #2563eb' : '1.5px solid transparent',
                      boxShadow: tenantStatusFilter === 'Active' ? '0 2px 6px rgba(37, 99, 235, 0.15)' : 'none'
                    }}
                  >
                    <div className={styles.statValue} style={{ color: '#2563eb', fontWeight: tenantStatusFilter === 'Active' ? 800 : 700 }}>
                      {displayTenantsList.filter((t: any) => t.status === 'Active').length}
                    </div>
                    <div className={styles.statLabel} style={{ fontWeight: tenantStatusFilter === 'Active' ? 700 : 500, color: tenantStatusFilter === 'Active' ? '#1d4ed8' : '#64748b' }}>
                      Active<br/>Tenants
                    </div>
                  </div>
                  
                  <div className={styles.statDivider} />

                  <div 
                    className={styles.statColumn}
                    onClick={() => setTenantStatusFilter(tenantStatusFilter === 'Paused' ? 'All' : 'Paused')}
                    style={{
                      cursor: 'pointer',
                      padding: '8px 4px',
                      borderRadius: '10px',
                      transition: 'all 0.15s ease',
                      background: tenantStatusFilter === 'Paused' ? '#fffbeb' : 'transparent',
                      border: tenantStatusFilter === 'Paused' ? '1.5px solid #d97706' : '1.5px solid transparent',
                      boxShadow: tenantStatusFilter === 'Paused' ? '0 2px 6px rgba(217, 119, 6, 0.15)' : 'none'
                    }}
                  >
                    <div className={styles.statValue} style={{ color: '#d97706', fontWeight: tenantStatusFilter === 'Paused' ? 800 : 700 }}>
                      {displayTenantsList.filter((t: any) => t.status === 'Paused').length}
                    </div>
                    <div className={styles.statLabel} style={{ fontWeight: tenantStatusFilter === 'Paused' ? 700 : 500, color: tenantStatusFilter === 'Paused' ? '#b45309' : '#64748b' }}>
                      Paused<br/>Tenants
                    </div>
                  </div>
                  
                  <div className={styles.statDivider} />
                  
                  <div 
                    className={styles.statColumn}
                    onClick={() => setTenantStatusFilter(tenantStatusFilter === 'Notice Period' ? 'All' : 'Notice Period')}
                    style={{
                      cursor: 'pointer',
                      padding: '8px 4px',
                      borderRadius: '10px',
                      transition: 'all 0.15s ease',
                      background: tenantStatusFilter === 'Notice Period' ? '#faf5ff' : 'transparent',
                      border: tenantStatusFilter === 'Notice Period' ? '1.5px solid #8b5cf6' : '1.5px solid transparent',
                      boxShadow: tenantStatusFilter === 'Notice Period' ? '0 2px 6px rgba(139, 92, 246, 0.15)' : 'none'
                    }}
                  >
                    <div className={styles.statValue} style={{ color: '#8b5cf6', fontWeight: tenantStatusFilter === 'Notice Period' ? 800 : 700 }}>
                      {displayTenantsList.filter((t: any) => t.status === 'Notice Period').length}
                    </div>
                    <div className={styles.statLabel} style={{ fontWeight: tenantStatusFilter === 'Notice Period' ? 700 : 500, color: tenantStatusFilter === 'Notice Period' ? '#6d28d9' : '#64748b' }}>
                      Notice<br/>Period
                    </div>
                  </div>

                  <div className={styles.statDivider} />
                  
                  <div 
                    className={styles.statColumn}
                    onClick={() => setTenantStatusFilter(tenantStatusFilter === 'Vacated' ? 'All' : 'Vacated')}
                    style={{
                      cursor: 'pointer',
                      padding: '8px 4px',
                      borderRadius: '10px',
                      transition: 'all 0.15s ease',
                      background: tenantStatusFilter === 'Vacated' ? '#f1f5f9' : 'transparent',
                      border: tenantStatusFilter === 'Vacated' ? '1.5px solid #475569' : '1.5px solid transparent',
                      boxShadow: tenantStatusFilter === 'Vacated' ? '0 2px 6px rgba(71, 85, 105, 0.15)' : 'none'
                    }}
                  >
                    <div className={styles.statValue} style={{ color: '#475569', fontWeight: tenantStatusFilter === 'Vacated' ? 800 : 700 }}>
                      {displayTenantsList.filter((t: any) => t.status === 'Vacated').length}
                    </div>
                    <div className={styles.statLabel} style={{ fontWeight: tenantStatusFilter === 'Vacated' ? 700 : 500, color: tenantStatusFilter === 'Vacated' ? '#334155' : '#64748b' }}>
                      Vacated<br/>Tenants
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Search & Active Filter Row */}
        <div className={styles.tenantSearchRow} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} className={styles.tenantSearchIcon} />
            <input 
              type="text" 
              placeholder="Search by name, room, or phone..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.tenantSearchInput}
            />
          </div>
          <div style={{ width: '48px', flex: 'none' }}>
            <CustomSelect 
              value={tenantStatusFilter} 
              onChange={(val: any) => setTenantStatusFilter(val)}
              icon={<Filter size={20} />}
              iconOnly={true}
              options={[
                { value: 'Active', label: 'Active' },
                { value: 'Paused', label: 'Paused' },
                { value: 'Notice Period', label: 'Notice Period' },
                { value: 'Vacated', label: 'Vacated' },
                { value: 'All', label: 'All Tenants' }
              ]}
            />
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className={styles.tenantActionRow}>
          <button className={`${styles.tenantMainAction} ${styles.blue}`} style={{ width: '100%', maxWidth: '100%' }} onClick={() => setShowModal(true)}>
            <div style={{backgroundColor: 'white', color: '#0f4a66', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
               <Plus size={12} strokeWidth={3} />
            </div>
            Add Tenant
          </button>
        </div>

        {/* List Header */}
        <div className={styles.tenantListHeader}>
          <div className={styles.tenantListCount}>{filteredTenants.length} Tenant{filteredTenants.length !== 1 && 's'}</div>
          <button className={styles.tenantListClear} style={{background: 'none', border: 'none'}} onClick={() => setSearchTerm('')}>Clear filters</button>
        </div>

        {/* Tenant Cards */}
        {filteredTenants.length === 0 && !isLoading && (
          <div className="text-center py-4 text-muted">No tenants found</div>
        )}
        <div className={styles.tenantGrid}>
        {filteredTenants.map((t: any, index: number) => (
          <div 
            key={t.id}
            className={styles.mobileTenantCard}
            onClick={() => {
              setOpeningTenantId(t.id);
              router.push(`/pgowner/tenants/${t.id}`);
            }}
            style={{ 
              cursor: 'pointer',
              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              transform: openingTenantId === t.id ? 'scale(1.03)' : 'scale(1)',
              borderColor: openingTenantId === t.id ? '#4F46E5' : undefined,
              boxShadow: openingTenantId === t.id ? '0 12px 28px rgba(79, 70, 229, 0.18)' : undefined
            }}
          >
            <div className={styles.tenantCardTop}>
              <div className={styles.tenantCardLeft}>
                <AvatarImage 
                  src={t.face_picture || t.facePicture || t.documents?.photo || t.documents?.facePicture || t.documents?.photo_url || t.avatar || t.photo_url || t.photoUrl} 
                  alt={t.name || t.full_name || 'Tenant'} 
                  name={t.name || t.full_name || '?'} 
                  size={44} 
                />
                <div>
                  <h3 className={styles.tenantCardName}>{t.name}</h3>
                  <div className={styles.tenantCardPhone}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                    {t.phone}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {t.phone && (
                  <a
                    href={`tel:${t.phone.replace(/\D/g, '')}`}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: '#ecfdf5',
                      color: '#059669',
                      border: '1px solid #a7f3d0',
                      textDecoration: 'none',
                      boxShadow: '0 2px 6px rgba(5, 150, 105, 0.15)',
                      transition: 'all 0.15s ease',
                      flexShrink: 0
                    }}
                    title={`Call ${t.name || 'Tenant'}`}
                  >
                    <PhoneCall size={15} />
                  </a>
                )}
                <div 
                  className={styles.tenantStatusPill}
                  style={{
                    background: t.status === 'Paused' ? '#fef3c7' : (t.status === 'Vacated' ? '#f1f5f9' : (t.status === 'Notice Period' ? '#f3e8ff' : '#ecfdf5')),
                    color: t.status === 'Paused' ? '#b45309' : (t.status === 'Vacated' ? '#475569' : (t.status === 'Notice Period' ? '#7e22ce' : '#047857')),
                    borderColor: t.status === 'Paused' ? '#fde68a' : (t.status === 'Vacated' ? '#cbd5e1' : (t.status === 'Notice Period' ? '#d8b4fe' : '#a7f3d0'))
                  }}
                >
                  <div 
                    className={styles.tenantStatusDot}
                    style={{
                      background: t.status === 'Paused' ? '#d97706' : (t.status === 'Vacated' ? '#64748b' : (t.status === 'Notice Period' ? '#9333ea' : '#10b981'))
                    }}
                  />
                  {t.status}
                </div>
              </div>
            </div>
            
            <div className={styles.tenantCardBottom}>
              <div className={styles.tenantRoomInfo}>
                <Building2 size={16} className={styles.tenantRoomIcon} />
                <div className={styles.tenantRoomText}>
                  <span className={styles.tenantRoomLabel}>ROOM</span>
                  <span className={styles.tenantRoomNumber}>{t.room}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {t.paymentState === 'upcoming' && (
                  <div className={`${styles.tenantPill} ${styles.tenantPillUpcoming}`}>
                    <Calendar size={14} />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: '1.2' }}>
                      <span>Next Due</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 500 }}>{t.daysDiff === 1 ? 'Tomorrow' : `in ${t.daysDiff} days`}</span>
                    </div>
                  </div>
                )}
                {t.paymentState === 'today' && (
                  <div className={`${styles.tenantPill} ${styles.tenantPillToday}`}>
                    <AlertTriangle size={14} />
                    Due Today
                  </div>
                )}
                {t.paymentState === 'overdue' && (
                  <div className={`${styles.tenantPill} ${styles.tenantPillOverdue}`}>
                    <AlertCircle size={14} />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: '1.2' }}>
                      <span>Overdue</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 500 }}>{t.daysDiff === 30 ? '1 month' : `${t.daysDiff} days`}</span>
                    </div>
                  </div>
                )}
                {t.paymentState === 'critical' && (
                  <div className={`${styles.tenantPill} ${styles.tenantPillCritical}`}>
                    <AlertCircle size={14} />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: '1.2' }}>
                      <span>Critical</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 500 }}>
                        {t.daysDiff >= 60 ? `${Math.floor(t.daysDiff/30)} months overdue` : `${t.daysDiff} days overdue`}
                      </span>
                    </div>
                  </div>
                )}
                {t.paymentState === 'empty' && (
                  <div className={`${styles.tenantPill} ${styles.tenantPillEmpty}`}>
                    No Payment Recorded
                  </div>
                )}
              </div>
              
              <ChevronRight size={18} className={styles.tenantCardChevron} />
            </div>
          </div>
        ))}
        </div>
            </div>
          </div>
        ) : (
          <div 
            key="form"
            style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '80px' }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', backgroundColor: '#ffffff', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, zIndex: 50 }}>
              <button 
                onClick={() => {
                  if (returnUrl) {
                    router.push(returnUrl);
                  } else {
                    setShowModal(false);
                  }
                }} 
                style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '50%', width: '36px', height: '36px', color: '#6366f1', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                type="button"
              >
                <ChevronLeft size={18} />
              </button>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 0 14px', color: '#1e1b4b' }}>Add New Tenant</h2>
            </div>

            <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '520px', margin: '0 auto', width: '100%' }}>
              
              <form id="add-tenant-form" onSubmit={handleAddTenant} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Card 1: Personal Information */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #edf2f7', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <User size={16} color="#6366f1" />
                    </div>
                    <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#4338ca' }}>Personal Information</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: '#334155' }}>
                        Full Name <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                          <User size={15} />
                        </div>
                        <input 
                          type="text"
                          placeholder="Enter full name"
                          style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#fff', fontSize: '0.88rem', color: '#0f172a', outline: 'none' }}
                          value={fullName}
                          onChange={e => setFullName(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: '#334155' }}>
                        Phone Number <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                          <Phone size={15} />
                        </div>
                        <input 
                          type="tel"
                          placeholder="Enter 10-digit mobile number"
                          style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#fff', fontSize: '0.88rem', color: '#0f172a', outline: 'none' }}
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: '#334155' }}>
                        Alternate Phone Number <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 400 }}>(Optional)</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                          <Phone size={15} />
                        </div>
                        <input 
                          type="tel"
                          placeholder="Enter alternate mobile number"
                          style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#fff', fontSize: '0.88rem', color: '#0f172a', outline: 'none' }}
                          value={parentPhone}
                          onChange={e => setParentPhone(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: '#334155' }}>
                        Email Address <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                          <Mail size={15} />
                        </div>
                        <input 
                          type="email"
                          placeholder="Enter email address"
                          style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#fff', fontSize: '0.88rem', color: '#0f172a', outline: 'none' }}
                          value={tenantEmail}
                          onChange={e => setTenantEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 2: Allocate Room */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #edf2f7', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Home size={16} color="#6366f1" />
                    </div>
                    <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#4338ca' }}>Allocate Room</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {contextProperties && contextProperties.length > 1 && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: '#334155' }}>
                          Choose Hostel <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <CustomSelect 
                          value={effectivePgId}
                          onChange={(val: any) => {
                            setSelectedPg(val);
                            setSelectedRoom('');
                          }}
                          options={contextProperties.map((p: any) => ({
                            value: p.pg_id || p.id,
                            label: p.name || 'Hostel'
                          }))}
                          placeholder="Select a hostel"
                          icon={<Building2 size={15} color="#94a3b8" />}
                        />
                      </div>
                    )}

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: '#334155' }}>
                        Choose Room <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <CustomSelect 
                        searchable
                        value={selectedRoom}
                        onChange={setSelectedRoom}
                        options={currentRooms.map((r: any) => {
                          const tenantsList = targetHostelData?.tenants || [];
                          const occupiedCount = tenantsList.filter((t: any) => (t.status === 'Active' || t.is_active !== false) && (t.room === r.room_number || t.room_id === r.room_id || t.room_id === r.id)).length;
                          const totalBeds = r.total_beds || r.beds || 1;
                          
                          return { 
                            value: r.room_id || r.id, 
                            disabled: occupiedCount >= totalBeds,
                            searchKey: String(r.room_number || r.num || ''),
                            label: (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingRight: '8px' }}>
                                <span style={{ fontWeight: 600 }}>{r.floor ? `${r.floor} - ` : ''}Room {r.room_number} {occupiedCount >= totalBeds ? '(Full)' : ''}</span>
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                  {Array.from({ length: totalBeds }).map((_, i) => (
                                    <BedDouble 
                                      key={i} 
                                      size={14} 
                                      color={i < occupiedCount ? "#ef4444" : "#10b981"} 
                                    />
                                  ))}
                                </div>
                              </div>
                            ) 
                          };
                        })}
                        placeholder="Select a room"
                        icon={<Home size={15} color="#94a3b8" />}
                      />
                    </div>
                  </div>
                </div>

                {/* Card 3: Rent & Deposits */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #edf2f7', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IndianRupee size={16} color="#6366f1" />
                    </div>
                    <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#4338ca' }}>Rent & Deposits</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: '#334155' }}>
                        Monthly Rent (₹) <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                          <IndianRupee size={14} />
                        </div>
                        <input 
                          type="number"
                          placeholder="e.g. 8500"
                          style={{ width: '100%', padding: '10px 10px 10px 30px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#fff', fontSize: '0.85rem', color: '#0f172a', outline: 'none' }}
                          value={rentAmount}
                          onChange={e => {
                            const val = e.target.value;
                            if (val === '') setRentAmount('');
                            else setRentAmount(parseInt(val) || 0);
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: '#334155' }}>
                        Security Deposit (₹) <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                          <IndianRupee size={14} />
                        </div>
                        <input 
                          type="number"
                          placeholder="e.g. 15000"
                          style={{ width: '100%', padding: '10px 10px 10px 30px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#fff', fontSize: '0.85rem', color: '#0f172a', outline: 'none' }}
                          value={securityDeposit}
                          onChange={e => {
                            const val = e.target.value;
                            if (val === '') setSecurityDeposit('');
                            else setSecurityDeposit(parseInt(val) || 0);
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Old Pending Fee Container */}
                  <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        id="hasOldPendingFee"
                        checked={hasOldPendingFee}
                        onChange={(e) => setHasOldPendingFee(e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: '#6366f1', cursor: 'pointer' }}
                      />
                      <label htmlFor="hasOldPendingFee" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                        Tenant has an old pending fee
                      </label>
                    </div>

                    {hasOldPendingFee && (
                      <div style={{ marginTop: '10px' }}>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: '#334155' }}>Opening Pending Fee (₹)</label>
                        <div style={{ position: 'relative' }}>
                          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                            <IndianRupee size={15} />
                          </div>
                          <input 
                            type="number"
                            placeholder="e.g. 500"
                            style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#fff', fontSize: '0.88rem', color: '#0f172a', outline: 'none' }}
                            value={openingPendingFee}
                            onChange={e => {
                              const val = e.target.value;
                              if (val === '') setOpeningPendingFee('');
                              else setOpeningPendingFee(parseInt(val) || 0);
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card 4: Other Details */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #edf2f7', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Calendar size={16} color="#6366f1" />
                    </div>
                    <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#4338ca' }}>Other Details</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: '#334155' }}>
                        {hasOldPendingFee ? 'Opening Pending Date / Check-in Date *' : 'Check-in Date *'}
                      </label>
                      <CustomDatePicker 
                        selectedDate={moveInDate}
                        onChange={(date: Date | null) => setMoveInDate(date)}
                        placeholder="Select check-in date"
                        required={true}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: '#334155' }}>Work/Study Status</label>
                      <CustomSelect 
                        value={workStatus}
                        onChange={setWorkStatus}
                        options={[
                          { value: 'student', label: 'Student' },
                          { value: 'employed', label: 'Employed' },
                          { value: 'other', label: 'Other' }
                        ]}
                        icon={<Briefcase size={15} color="#94a3b8" />}
                      />
                    </div>

                    {workStatus === 'student' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: '#334155' }}>College Name & Details</label>
                        <div style={{ position: 'relative' }}>
                          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                            <Building2 size={15} />
                          </div>
                          <input 
                            type="text"
                            placeholder="Enter college name & details"
                            style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#fff', fontSize: '0.88rem', color: '#0f172a', outline: 'none' }}
                          />
                        </div>
                      </div>
                    )}
                    
                    {workStatus === 'employed' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: '#334155' }}>Workplace Name & Details</label>
                        <div style={{ position: 'relative' }}>
                          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                            <Building2 size={15} />
                          </div>
                          <input 
                            type="text"
                            placeholder="Enter workplace name & details"
                            style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#fff', fontSize: '0.88rem', color: '#0f172a', outline: 'none' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card 5: Document Uploads */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #edf2f7', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Camera size={16} color="#6366f1" />
                    </div>
                    <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#4338ca' }}>Document Uploads</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                    {/* Face Picture */}
                    <label style={{ backgroundColor: '#faf5ff', border: documents.facePicture ? '2px solid #10b981' : '1px dashed #c084fc', borderRadius: '14px', height: '135px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '10px', position: 'relative', overflow: 'hidden', transition: 'all 0.2s ease' }}>
                      <input type="file" accept="image/*" capture="user" onChange={(e) => handleFileChange(e, 'facePicture')} style={{ display: 'none' }} />
                      {documents.facePicture && (
                        <div style={{ position: 'absolute', top: '6px', right: '6px', zIndex: 10, backgroundColor: '#10b981', color: 'white', borderRadius: '50%', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CheckCircle2 size={15} />
                        </div>
                      )}
                      {previews.facePicture ? (
                        <div style={{ position: 'relative', width: '100%', height: '65px', borderRadius: '8px', overflow: 'hidden', marginBottom: '6px' }}>
                          <img src={previews.facePicture} alt="Face Picture" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ) : (
                        <div style={{ width: 38, height: 38, borderRadius: '50%', backgroundColor: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                          <Camera size={18} color="#6366f1" />
                        </div>
                      )}
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e293b', textAlign: 'center' }}>Face Picture</span>
                      <span style={{ fontSize: '0.7rem', color: documents.facePicture ? '#10b981' : '#7c3aed', textAlign: 'center', fontWeight: documents.facePicture ? 600 : 400 }}>
                        {documents.facePicture ? '✓ Selected' : 'Upload photo'}
                      </span>
                    </label>

                    {/* Govt Proof Front */}
                    <label style={{ backgroundColor: '#faf5ff', border: documents.govtFront ? '2px solid #10b981' : '1px dashed #c084fc', borderRadius: '14px', height: '135px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '10px', position: 'relative', overflow: 'hidden', transition: 'all 0.2s ease' }}>
                      <input type="file" accept="image/*" capture="environment" onChange={(e) => handleFileChange(e, 'govtFront')} style={{ display: 'none' }} />
                      {documents.govtFront && (
                        <div style={{ position: 'absolute', top: '6px', right: '6px', zIndex: 10, backgroundColor: '#10b981', color: 'white', borderRadius: '50%', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CheckCircle2 size={15} />
                        </div>
                      )}
                      {previews.govtFront ? (
                        <div style={{ position: 'relative', width: '100%', height: '65px', borderRadius: '8px', overflow: 'hidden', marginBottom: '6px' }}>
                          <img src={previews.govtFront} alt="Govt Front" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ) : (
                        <div style={{ width: 38, height: 38, borderRadius: '50%', backgroundColor: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                          <Camera size={18} color="#6366f1" />
                        </div>
                      )}
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e293b', textAlign: 'center' }}>Govt Proof (Front)</span>
                      <span style={{ fontSize: '0.7rem', color: documents.govtFront ? '#10b981' : '#7c3aed', textAlign: 'center', fontWeight: documents.govtFront ? 600 : 400 }}>
                        {documents.govtFront ? '✓ Selected' : 'Upload front'}
                      </span>
                    </label>

                    {/* Govt Proof Back */}
                    <label style={{ backgroundColor: '#faf5ff', border: documents.govtBack ? '2px solid #10b981' : '1px dashed #c084fc', borderRadius: '14px', height: '135px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '10px', position: 'relative', overflow: 'hidden', transition: 'all 0.2s ease' }}>
                      <input type="file" accept="image/*" capture="environment" onChange={(e) => handleFileChange(e, 'govtBack')} style={{ display: 'none' }} />
                      {documents.govtBack && (
                        <div style={{ position: 'absolute', top: '6px', right: '6px', zIndex: 10, backgroundColor: '#10b981', color: 'white', borderRadius: '50%', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CheckCircle2 size={15} />
                        </div>
                      )}
                      {previews.govtBack ? (
                        <div style={{ position: 'relative', width: '100%', height: '65px', borderRadius: '8px', overflow: 'hidden', marginBottom: '6px' }}>
                          <img src={previews.govtBack} alt="Govt Back" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ) : (
                        <div style={{ width: 38, height: 38, borderRadius: '50%', backgroundColor: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                          <Camera size={18} color="#6366f1" />
                        </div>
                      )}
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e293b', textAlign: 'center' }}>Govt Proof (Back)</span>
                      <span style={{ fontSize: '0.7rem', color: documents.govtBack ? '#10b981' : '#7c3aed', textAlign: 'center', fontWeight: documents.govtBack ? 600 : 400 }}>
                        {documents.govtBack ? '✓ Selected' : 'Upload back'}
                      </span>
                    </label>

                    {workStatus === 'student' && (
                      <>
                        <label style={{ backgroundColor: '#faf5ff', border: documents.collegeFront ? '2px solid #10b981' : '1px dashed #c084fc', borderRadius: '14px', height: '135px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '10px', position: 'relative', overflow: 'hidden', transition: 'all 0.2s ease' }}>
                          <input type="file" accept="image/*" capture="environment" onChange={(e) => handleFileChange(e, 'collegeFront')} style={{ display: 'none' }} />
                          {documents.collegeFront && (
                            <div style={{ position: 'absolute', top: '6px', right: '6px', zIndex: 10, backgroundColor: '#10b981', color: 'white', borderRadius: '50%', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <CheckCircle2 size={15} />
                            </div>
                          )}
                          {previews.collegeFront ? (
                            <div style={{ position: 'relative', width: '100%', height: '65px', borderRadius: '8px', overflow: 'hidden', marginBottom: '6px' }}>
                              <img src={previews.collegeFront} alt="College Front" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          ) : (
                            <div style={{ width: 38, height: 38, borderRadius: '50%', backgroundColor: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                              <Camera size={18} color="#6366f1" />
                            </div>
                          )}
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e293b', textAlign: 'center' }}>College ID (Front)</span>
                          <span style={{ fontSize: '0.7rem', color: documents.collegeFront ? '#10b981' : '#7c3aed', textAlign: 'center', fontWeight: documents.collegeFront ? 600 : 400 }}>
                            {documents.collegeFront ? '✓ Selected' : 'Upload front'}
                          </span>
                        </label>
                        
                        <label style={{ backgroundColor: '#faf5ff', border: documents.collegeBack ? '2px solid #10b981' : '1px dashed #c084fc', borderRadius: '14px', height: '135px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '10px', position: 'relative', overflow: 'hidden', transition: 'all 0.2s ease' }}>
                          <input type="file" accept="image/*" capture="environment" onChange={(e) => handleFileChange(e, 'collegeBack')} style={{ display: 'none' }} />
                          {documents.collegeBack && (
                            <div style={{ position: 'absolute', top: '6px', right: '6px', zIndex: 10, backgroundColor: '#10b981', color: 'white', borderRadius: '50%', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <CheckCircle2 size={15} />
                            </div>
                          )}
                          {previews.collegeBack ? (
                            <div style={{ position: 'relative', width: '100%', height: '65px', borderRadius: '8px', overflow: 'hidden', marginBottom: '6px' }}>
                              <img src={previews.collegeBack} alt="College Back" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          ) : (
                            <div style={{ width: 38, height: 38, borderRadius: '50%', backgroundColor: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                              <Camera size={18} color="#6366f1" />
                            </div>
                          )}
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e293b', textAlign: 'center' }}>College ID (Back)</span>
                          <span style={{ fontSize: '0.7rem', color: documents.collegeBack ? '#10b981' : '#7c3aed', textAlign: 'center', fontWeight: documents.collegeBack ? 600 : 400 }}>
                            {documents.collegeBack ? '✓ Selected' : 'Upload back'}
                          </span>
                        </label>
                      </>
                    )}
                    
                    {workStatus === 'employed' && (
                      <>
                        <label style={{ backgroundColor: '#faf5ff', border: documents.empFront ? '2px solid #10b981' : '1px dashed #c084fc', borderRadius: '14px', height: '135px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '10px', position: 'relative', overflow: 'hidden', transition: 'all 0.2s ease' }}>
                          <input type="file" accept="image/*" capture="environment" onChange={(e) => handleFileChange(e, 'empFront')} style={{ display: 'none' }} />
                          {documents.empFront && (
                            <div style={{ position: 'absolute', top: '6px', right: '6px', zIndex: 10, backgroundColor: '#10b981', color: 'white', borderRadius: '50%', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <CheckCircle2 size={15} />
                            </div>
                          )}
                          {previews.empFront ? (
                            <div style={{ position: 'relative', width: '100%', height: '65px', borderRadius: '8px', overflow: 'hidden', marginBottom: '6px' }}>
                              <img src={previews.empFront} alt="Emp Front" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          ) : (
                            <div style={{ width: 38, height: 38, borderRadius: '50%', backgroundColor: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                              <Camera size={18} color="#6366f1" />
                            </div>
                          )}
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e293b', textAlign: 'center' }}>Emp ID (Front)</span>
                          <span style={{ fontSize: '0.7rem', color: documents.empFront ? '#10b981' : '#7c3aed', textAlign: 'center', fontWeight: documents.empFront ? 600 : 400 }}>
                            {documents.empFront ? '✓ Selected' : 'Upload front'}
                          </span>
                        </label>

                        <label style={{ backgroundColor: '#faf5ff', border: documents.empBack ? '2px solid #10b981' : '1px dashed #c084fc', borderRadius: '14px', height: '135px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '10px', position: 'relative', overflow: 'hidden', transition: 'all 0.2s ease' }}>
                          <input type="file" accept="image/*" capture="environment" onChange={(e) => handleFileChange(e, 'empBack')} style={{ display: 'none' }} />
                          {documents.empBack && (
                            <div style={{ position: 'absolute', top: '6px', right: '6px', zIndex: 10, backgroundColor: '#10b981', color: 'white', borderRadius: '50%', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <CheckCircle2 size={15} />
                            </div>
                          )}
                          {previews.empBack ? (
                            <div style={{ position: 'relative', width: '100%', height: '65px', borderRadius: '8px', overflow: 'hidden', marginBottom: '6px' }}>
                              <img src={previews.empBack} alt="Emp Back" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          ) : (
                            <div style={{ width: 38, height: 38, borderRadius: '50%', backgroundColor: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                              <Camera size={18} color="#6366f1" />
                            </div>
                          )}
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e293b', textAlign: 'center' }}>Emp ID (Back)</span>
                          <span style={{ fontSize: '0.7rem', color: documents.empBack ? '#10b981' : '#7c3aed', textAlign: 'center', fontWeight: documents.empBack ? 600 : 400 }}>
                            {documents.empBack ? '✓ Selected' : 'Upload back'}
                          </span>
                        </label>
                      </>
                    )}
                  </div>
                </div>

                {uploadProgress && (
                  <div style={{ textAlign: 'center', padding: '10px', fontSize: '0.85rem', color: '#6366f1', fontWeight: 700, background: '#f5f3ff', borderRadius: '12px', border: '1px solid #ddd6fe' }}>
                    {uploadProgress}
                  </div>
                )}

                {/* Submit Action Button */}
                <div style={{ padding: '8px 0 24px 0' }}>
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      width: '100%', 
                      background: isSaving ? '#94a3b8' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', 
                      color: 'white', 
                      padding: '14px 20px', 
                      borderRadius: '14px', 
                      border: 'none', 
                      fontWeight: 700, 
                      fontSize: '0.95rem', 
                      cursor: isSaving ? 'not-allowed' : 'pointer', 
                      transition: 'all 0.2s ease', 
                      boxShadow: isSaving ? 'none' : '0 6px 18px rgba(99, 102, 241, 0.35)',
                      gap: '8px'
                    }}
                  >
                    {isSaving ? (
                      <span>{uploadProgress || 'Saving Tenant...'}</span>
                    ) : (
                      <>
                        <Save size={18} />
                        <span>Save Tenant Details</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function TenantDirectory() {
  return (
    <Suspense fallback={null}>
      <TenantDirectoryContent />
    </Suspense>
  );
}
