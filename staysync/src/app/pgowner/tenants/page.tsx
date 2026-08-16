/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Camera, X, Building2, MoreVertical, Filter, Users, ChevronRight, ChevronLeft, Save, CheckCircle2, Menu, Bell, BedDouble, IndianRupee, Home, Calendar, AlertTriangle, AlertCircle } from 'lucide-react';
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
import { useHostelData } from '@/hooks/useHostelData';
import { useHostel } from '@/context/HostelContext';
import { AvatarImage } from '@/components/AvatarImage';

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

export default function TenantDirectory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterHostel, setFilterHostel] = useState('all');
  const [tenantStatusFilter, setTenantStatusFilter] = useState('Active');
  const [showModal, setShowModal] = useState(false);
  const [tenants, setTenants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();

  const { selectedPgId: contextPgId } = useHostel();
  const activePgId = searchParams.get('pgId') || (filterHostel !== 'all' ? filterHostel : contextPgId || (typeof localStorage !== 'undefined' ? localStorage.getItem('activePgId') : null));
  const { data: hostelData } = useHostelData(activePgId);

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

        return {
          id: t.tenant_id || t.id,
          name: t.full_name || t.name,
          hostel: t.pg_name || t.hostel,
          pg_id: t.pg_id,
          room: resolvedRoom,
          phone: t.mobile || t.phone,
          status: statusLabel,
          paymentState,
          daysDiff
        };
      });
    }
    return [];
  }, [hostelData, roomsMap]);

  const displayTenantsList = processedFromCache.length > 0 ? processedFromCache : tenants;

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setOwnerId(user.uid);
        const propsRes = await getPropertiesWithRooms(user.uid);
        const currentId = localStorage.getItem('activePgId');
        if (propsRes.success && propsRes.data) {
          setProperties(propsRes.data);
          if (currentId && propsRes.data.some((p: any) => p.pg_id === currentId)) {
            setSelectedPg(currentId);
          } else if (propsRes.data.length > 0) {
            setSelectedPg((propsRes.data[0] as any).pg_id);
          }
        }
        const res = await getTenants(user.uid, currentId);
        const duesRes = await getPendingDues(user.uid, currentId);
        const historyRes = await getPaymentHistory(user.uid, currentId);
        
        if (res.success && res.data) {
          const dues = duesRes.success && duesRes.data ? duesRes.data : [];
          const paidPayments = historyRes.success && historyRes.data ? historyRes.data : [];
          
          setTenants(res.data.map((t: any) => {
            const tenantDues = dues.filter((d: any) => d.tenant_id === t.tenant_id);
            tenantDues.sort((a: any, b: any) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
            const due = tenantDues.length > 0 ? tenantDues[0] : null;
            
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
              const tenantPaid = paidPayments.filter((p: any) => p.tenant_id === t.tenant_id);
              const unpaidInfo = getNextUnpaidMonthAndDate(t, tenantPaid);
              daysDiff = unpaidInfo.dueDays;
              nextDueDate = unpaidInfo.nextDueDate;
              paymentState = daysDiff === 0 ? 'today' : 'upcoming';
            }

            return {
              id: t.tenant_id,
              name: t.full_name,
              hostel: t.pg_name,
              pg_id: t.pg_id,
              room: t.rooms?.room_number || 'N/A',
              phone: t.mobile,
              status: t.is_active === false ? 'Vacated' : (t.status === 'notice_period' ? 'Notice Period' : 'Active'),
              paymentState,
              daysDiff
            };
          }));
        }
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedPg && selectedRoom && properties.length > 0) {
      const p = properties.find((prop: any) => prop.pg_id === selectedPg);
      if (p) {
        const r = p.rooms.find((room: any) => room.room_id === selectedRoom);
        if (r && p.theme_primary_color) {
          try {
            const pricing = JSON.parse(p.theme_primary_color);
            const fee = pricing[r.total_beds];
            if (fee) {
              setRentAmount(parseInt(fee));
            }
          } catch (e) {
            console.error("Failed to parse pricing", e);
          }
        }
      }
    }
  }, [selectedRoom, selectedPg, properties]);

  const handleAddTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerId || !selectedPg || !selectedRoom) {
      alert("Please select a Hostel and Room.");
      return;
    }
    if (!tenantEmail.trim() || !tenantEmail.includes('@')) {
      alert("Please enter a valid email address.");
      return;
    }
    setIsSaving(true);
    setUploadProgress('Uploading documents...');

    let documentUrls: any = {};
    const uploadFile = async (file: File, path: string) => {
      // Compress image before uploading to save time and bandwidth
      const options = {
        maxSizeMB: 0.2, // Max 200KB
        maxWidthOrHeight: 1024,
        useWebWorker: true,
      };
      
      let fileToUpload = file;
      try {
        setUploadProgress(`Compressing ${file.name}...`);
        fileToUpload = await imageCompression(file, options);
      } catch (err) {
        console.warn('Compression failed, using original file', err);
      }
      
      setUploadProgress('Uploading...');
      const storageRef = ref(storage, path);
      // Timeout after 10 seconds to prevent hanging
      const uploadPromise = uploadBytes(storageRef, fileToUpload);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Upload timeout')), 10000));
      
      await Promise.race([uploadPromise, timeoutPromise]);
      return await getDownloadURL(storageRef);
    };

    try {
      if (documents.facePicture) documentUrls.facePicture = await uploadFile(documents.facePicture, `tenants/${ownerId}/${Date.now()}_face.jpg`);
      if (documents.govtFront) documentUrls.govtFront = await uploadFile(documents.govtFront, `tenants/${ownerId}/${Date.now()}_govF.jpg`);
      if (documents.govtBack) documentUrls.govtBack = await uploadFile(documents.govtBack, `tenants/${ownerId}/${Date.now()}_govB.jpg`);
      if (documents.collegeFront) documentUrls.collegeFront = await uploadFile(documents.collegeFront, `tenants/${ownerId}/${Date.now()}_colF.jpg`);
      if (documents.collegeBack) documentUrls.collegeBack = await uploadFile(documents.collegeBack, `tenants/${ownerId}/${Date.now()}_colB.jpg`);
      if (documents.empFront) documentUrls.empFront = await uploadFile(documents.empFront, `tenants/${ownerId}/${Date.now()}_empF.jpg`);
      if (documents.empBack) documentUrls.empBack = await uploadFile(documents.empBack, `tenants/${ownerId}/${Date.now()}_empB.jpg`);
    } catch (error: any) {
      console.error("Upload error", error);
      alert("Failed to upload some documents: " + error.message + ". The tenant will be saved without documents.");
      // reset progress and let it continue saving
    }
    
    setUploadProgress('Saving tenant...');
    const res = await addTenant({ 
      ownerId, 
      pgId: selectedPg, 
      roomId: selectedRoom, 
      fullName, 
      phone, 
      email: tenantEmail,
      parentPhone, 
      workStatus, 
      moveInDate: moveInDate ? moveInDate.toISOString() : new Date().toISOString(),
      rentAmount: rentAmount === '' ? 0 : rentAmount,
      securityDeposit: securityDeposit === '' ? 0 : securityDeposit,
      openingPendingFee: hasOldPendingFee && openingPendingFee !== '' ? openingPendingFee : 0,
      openingBalanceDueDate: hasOldPendingFee && moveInDate ? moveInDate.toISOString() : undefined,
      documents: documentUrls
    });
    
    if (res.success && res.data) {
      const selectedHostelName = properties.find(p => p.pg_id === selectedPg)?.name || '';
      const selectedRoomName = properties.find(p => p.pg_id === selectedPg)?.rooms.find((r:any) => r.room_id === selectedRoom)?.room_number || '';
      
      setTenants([{
        id: res.data[0].tenant_id,
        name: fullName,
        hostel: selectedHostelName,
        pg_id: selectedPg,
        room: selectedRoomName,
        phone: phone,
        status: 'Active'
      }, ...tenants]);
      
      if (returnUrl) {
        router.push(returnUrl);
      } else {
        setShowModal(false);
      }
      setFullName(''); setPhone(''); setTenantEmail(''); setParentPhone(''); setMoveInDate(null);
      setRentAmount(''); setSecurityDeposit(''); setOpeningPendingFee(''); setHasOldPendingFee(false);
      setDocuments({ facePicture: null, govtFront: null, govtBack: null, collegeFront: null, collegeBack: null });
      setUploadProgress('');
      router.refresh();
    } else {
      alert("Failed to add tenant: " + res.error);
    }
    setIsSaving(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    if (e.target.files && e.target.files[0]) {
      setDocuments((prev: any) => ({ ...prev, [type]: e.target.files![0] }));
    }
  };

  const currentRooms = properties.find(p => p.pg_id === selectedPg)?.rooms || [];

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
            style={{ display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', backgroundColor: 'transparent', zIndex: 50 }}>
              <button 
                onClick={() => {
                  if (returnUrl) {
                    router.push(returnUrl);
                  } else {
                    setShowModal(false);
                  }
                }} 
                style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: '40px', height: '40px', color: '#0f172a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                type="button"
              >
                <ChevronLeft size={20} />
              </button>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0 16px', color: '#0f172a' }}>Add New Tenant</h2>
            </div>

            <div className={styles.dashboardContent} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '32px' }}>
                


                {/* Tenant Information Section */}
                <section>
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>Tenant Information</h3>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>Enter tenant details accurately</p>
                  </div>

                  <form id="add-tenant-form" onSubmit={handleAddTenant} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                      <div style={{ zIndex: 49 }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', color: '#334155' }}>Allocate Room</label>
                        <CustomSelect 
                          value={selectedRoom}
                          onChange={setSelectedRoom}
                          options={currentRooms.map((r: any) => {
                            const selectedHostelName = properties.find(p => p.pg_id === selectedPg)?.name;
                            const occupiedCount = tenants.filter(t => t.status === 'Active' && t.room === r.room_number && t.hostel === selectedHostelName).length;
                            const totalBeds = r.total_beds || 1;
                            
                            return { 
                              value: r.room_id, 
                              disabled: occupiedCount >= totalBeds,
                              label: (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingRight: '8px' }}>
                                  <span style={{ fontWeight: 600 }}>{r.room_number} {occupiedCount >= totalBeds ? '(Full)' : ''}</span>
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
                          placeholder="Choose Room"
                          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>}
                        />
                      </div>
                      
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', color: '#334155' }}>Monthly Rent (₹)</label>
                        <div style={{ position: 'relative' }}>
                          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                            <IndianRupee size={16} />
                          </div>
                          <input 
                            type="number"
                            placeholder="e.g. 8500"
                            style={{ width: '100%', padding: '12px 12px 12px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '0.9rem', color: '#0f172a', outline: 'none' }}
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
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', color: '#334155' }}>Security Deposit (₹)</label>
                        <div style={{ position: 'relative' }}>
                          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                            <IndianRupee size={16} />
                          </div>
                          <input 
                            type="number"
                            placeholder="e.g. 15000"
                            style={{ width: '100%', padding: '12px 12px 12px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '0.9rem', color: '#0f172a', outline: 'none' }}
                            value={securityDeposit}
                            onChange={e => {
                              const val = e.target.value;
                              if (val === '') setSecurityDeposit('');
                              else setSecurityDeposit(parseInt(val) || 0);
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <input
                            type="checkbox"
                            id="hasOldPendingFee"
                            checked={hasOldPendingFee}
                            onChange={(e) => setHasOldPendingFee(e.target.checked)}
                            style={{ width: '16px', height: '16px', accentColor: '#10b981' }}
                          />
                          <label htmlFor="hasOldPendingFee" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                            Tenant has an old pending fee
                          </label>
                        </div>

                        {hasOldPendingFee && (
                          <div style={{ marginTop: '8px' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', color: '#334155' }}>Opening Pending Fee (₹)</label>
                            <div style={{ position: 'relative' }}>
                              <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                                <IndianRupee size={16} />
                              </div>
                              <input 
                                type="number"
                                placeholder="e.g. 500"
                                style={{ width: '100%', padding: '12px 12px 12px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '0.9rem', color: '#0f172a', outline: 'none' }}
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

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', color: '#334155' }}>Full Name</label>
                        <div style={{ position: 'relative' }}>
                          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                          </div>
                          <input 
                            type="text"
                            placeholder="Enter full name"
                            style={{ width: '100%', padding: '12px 12px 12px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '0.9rem', color: '#0f172a', outline: 'none' }}
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', color: '#334155' }}>
                          {hasOldPendingFee ? 'Opening Pending Date / Check-in Date' : 'Check-in Date'}
                        </label>
                        <CustomDatePicker 
                          selectedDate={moveInDate}
                          onChange={(date: Date | null) => setMoveInDate(date)}
                          placeholder="Select check-in date"
                          required={true}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', color: '#334155' }}>Phone Number</label>
                      <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                        </div>
                        <input 
                          type="tel"
                          placeholder="Enter phone number"
                          style={{ width: '100%', padding: '12px 12px 12px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '0.9rem', color: '#0f172a', outline: 'none' }}
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', color: '#334155' }}>Email Address</label>
                      <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                        </div>
                        <input 
                          type="email"
                          placeholder="Enter email address"
                          style={{ width: '100%', padding: '12px 12px 12px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '0.9rem', color: '#0f172a', outline: 'none' }}
                          value={tenantEmail}
                          onChange={e => setTenantEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div style={{ zIndex: 48 }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', color: '#334155' }}>Work/Study Status</label>
                      <CustomSelect 
                        value={workStatus}
                        onChange={setWorkStatus}
                        options={[
                          { value: 'student', label: 'Student' },
                          { value: 'employed', label: 'Employed' },
                          { value: 'other', label: 'Other' }
                        ]}
                        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>}
                      />
                    </div>

                    {workStatus === 'student' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', color: '#334155' }}>College Name & Details</label>
                        <div style={{ position: 'relative' }}>
                          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                          </div>
                          <input 
                            type="text"
                            placeholder="Enter college name & details"
                            style={{ width: '100%', padding: '12px 12px 12px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '0.9rem', color: '#0f172a', outline: 'none' }}
                          />
                        </div>
                      </div>
                    )}
                    
                    {workStatus === 'employed' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', color: '#334155' }}>Workplace Name & Details</label>
                        <div style={{ position: 'relative' }}>
                          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                          </div>
                          <input 
                            type="text"
                            placeholder="Enter workplace name & details"
                            style={{ width: '100%', padding: '12px 12px 12px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '0.9rem', color: '#0f172a', outline: 'none' }}
                          />
                        </div>
                      </div>
                    )}

                    <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '16px', display: 'flex', gap: '12px' }}>
                      <div style={{ color: '#3b82f6', marginTop: '2px' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                      </div>
                      <div>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '0.85rem', fontWeight: 700, color: '#1e3a8a' }}>Information</h4>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#1e40af', lineHeight: '1.4' }}>Please ensure all details are correct before saving. You can edit them later if needed.</p>
                      </div>
                    </div>
                  </form>
                </section>

                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: 0 }} />
                
                {/* Document Uploads Section Moved to Bottom */}
                <section>
                  <div style={{ marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>Document Uploads</h3>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>Upload clear images of required documents</p>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
                    <label style={{ backgroundColor: 'white', border: documents.facePicture ? '1px solid #10b981' : '1px solid #e2e8f0', borderRadius: '12px', height: '140px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', position: 'relative' }}>
                      <input type="file" accept="image/*" capture="user" onChange={(e) => handleFileChange(e, 'facePicture')} style={{ display: 'none' }} />
                      {documents.facePicture && <div style={{ position: 'absolute', top: '8px', right: '8px', color: '#10b981' }}><CheckCircle2 size={18} /></div>}
                      <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: documents.facePicture ? '#d1fae5' : '#f0f5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                        <Camera size={20} color={documents.facePicture ? "#10b981" : "#3b82f6"} />
                      </div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>Face Picture</span>
                      <span style={{ fontSize: '0.75rem', color: documents.facePicture ? '#10b981' : '#64748b', textAlign: 'center' }}>{documents.facePicture ? 'Selected' : 'Upload clear face photo'}</span>
                    </label>

                    <label style={{ backgroundColor: 'white', border: documents.govtFront ? '1px solid #10b981' : '1px solid #e2e8f0', borderRadius: '12px', height: '140px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', position: 'relative' }}>
                      <input type="file" accept="image/*" capture="environment" onChange={(e) => handleFileChange(e, 'govtFront')} style={{ display: 'none' }} />
                      {documents.govtFront && <div style={{ position: 'absolute', top: '8px', right: '8px', color: '#10b981' }}><CheckCircle2 size={18} /></div>}
                      <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: documents.govtFront ? '#d1fae5' : '#f0f5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                        <Camera size={20} color={documents.govtFront ? "#10b981" : "#3b82f6"} />
                      </div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>Govt Proof (Front)</span>
                      <span style={{ fontSize: '0.75rem', color: documents.govtFront ? '#10b981' : '#64748b', textAlign: 'center' }}>{documents.govtFront ? 'Selected' : 'Upload front side'}</span>
                    </label>

                    <label style={{ backgroundColor: 'white', border: documents.govtBack ? '1px solid #10b981' : '1px solid #e2e8f0', borderRadius: '12px', height: '140px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', position: 'relative' }}>
                      <input type="file" accept="image/*" capture="environment" onChange={(e) => handleFileChange(e, 'govtBack')} style={{ display: 'none' }} />
                      {documents.govtBack && <div style={{ position: 'absolute', top: '8px', right: '8px', color: '#10b981' }}><CheckCircle2 size={18} /></div>}
                      <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: documents.govtBack ? '#d1fae5' : '#f0f5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                        <Camera size={20} color={documents.govtBack ? "#10b981" : "#3b82f6"} />
                      </div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>Govt Proof (Back)</span>
                      <span style={{ fontSize: '0.75rem', color: documents.govtBack ? '#10b981' : '#64748b', textAlign: 'center' }}>{documents.govtBack ? 'Selected' : 'Upload back side'}</span>
                    </label>

                    {workStatus === 'student' && (
                      <>
                        <label style={{ backgroundColor: 'white', border: documents.collegeFront ? '1px solid #10b981' : '1px solid #e2e8f0', borderRadius: '12px', height: '140px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', position: 'relative' }}>
                          <input type="file" accept="image/*" capture="environment" onChange={(e) => handleFileChange(e, 'collegeFront')} style={{ display: 'none' }} />
                          {documents.collegeFront && <div style={{ position: 'absolute', top: '8px', right: '8px', color: '#10b981' }}><CheckCircle2 size={18} /></div>}
                          <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: documents.collegeFront ? '#d1fae5' : '#f0f5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                            <Camera size={20} color={documents.collegeFront ? "#10b981" : "#3b82f6"} />
                          </div>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>College ID (Front)</span>
                          <span style={{ fontSize: '0.75rem', color: documents.collegeFront ? '#10b981' : '#64748b', textAlign: 'center' }}>{documents.collegeFront ? 'Selected' : 'Upload front side'}</span>
                        </label>
                        
                        <label style={{ backgroundColor: 'white', border: documents.collegeBack ? '1px solid #10b981' : '1px solid #e2e8f0', borderRadius: '12px', height: '140px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', position: 'relative' }}>
                          <input type="file" accept="image/*" capture="environment" onChange={(e) => handleFileChange(e, 'collegeBack')} style={{ display: 'none' }} />
                          {documents.collegeBack && <div style={{ position: 'absolute', top: '8px', right: '8px', color: '#10b981' }}><CheckCircle2 size={18} /></div>}
                          <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: documents.collegeBack ? '#d1fae5' : '#f0f5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                            <Camera size={20} color={documents.collegeBack ? "#10b981" : "#3b82f6"} />
                          </div>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>College ID (Back)</span>
                          <span style={{ fontSize: '0.75rem', color: documents.collegeBack ? '#10b981' : '#64748b', textAlign: 'center' }}>{documents.collegeBack ? 'Selected' : 'Upload back side'}</span>
                        </label>
                      </>
                    )}
                    
                    {workStatus === 'employed' && (
                      <>
                        <label style={{ backgroundColor: 'white', border: documents.empFront ? '1px solid #10b981' : '1px solid #e2e8f0', borderRadius: '12px', height: '140px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', position: 'relative' }}>
                          <input type="file" accept="image/*" capture="environment" onChange={(e) => handleFileChange(e, 'empFront')} style={{ display: 'none' }} />
                          {documents.empFront && <div style={{ position: 'absolute', top: '8px', right: '8px', color: '#10b981' }}><CheckCircle2 size={18} /></div>}
                          <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: documents.empFront ? '#d1fae5' : '#f0f5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                            <Camera size={20} color={documents.empFront ? "#10b981" : "#3b82f6"} />
                          </div>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>Emp ID (Front)</span>
                          <span style={{ fontSize: '0.75rem', color: documents.empFront ? '#10b981' : '#64748b', textAlign: 'center' }}>{documents.empFront ? 'Selected' : 'Upload front side'}</span>
                        </label>
                        <label style={{ backgroundColor: 'white', border: documents.empBack ? '1px solid #10b981' : '1px solid #e2e8f0', borderRadius: '12px', height: '140px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', position: 'relative' }}>
                          <input type="file" accept="image/*" capture="environment" onChange={(e) => handleFileChange(e, 'empBack')} style={{ display: 'none' }} />
                          {documents.empBack && <div style={{ position: 'absolute', top: '8px', right: '8px', color: '#10b981' }}><CheckCircle2 size={18} /></div>}
                          <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: documents.empBack ? '#d1fae5' : '#f0f5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                            <Camera size={20} color={documents.empBack ? "#10b981" : "#3b82f6"} />
                          </div>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>Emp ID (Back)</span>
                          <span style={{ fontSize: '0.75rem', color: documents.empBack ? '#10b981' : '#64748b', textAlign: 'center' }}>{documents.empBack ? 'Selected' : 'Upload back side'}</span>
                        </label>
                      </>
                    )}
                  </div>
                </section>

                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: 0 }} />


                {uploadProgress && (
                  <div style={{ textAlign: 'center', padding: '8px', fontSize: '0.85rem', color: '#3b82f6', fontWeight: 600 }}>
                    {uploadProgress}
                  </div>
                )}
              </div>
              
              {/* Bottom Action */}
              <div style={{ padding: '16px 20px', backgroundColor: 'transparent', zIndex: 50, marginTop: 'auto' }}>
                <button 
                  type="submit" 
                  form="add-tenant-form"
                  disabled={isSaving}
                  style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', backgroundColor: '#3b82f6', color: 'white', padding: '16px', borderRadius: '12px', border: 'none', fontWeight: 600, fontSize: '1rem', cursor: 'pointer', transition: 'background-color 0.2s', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}
                >
                  <div style={{ position: 'absolute', left: '8px', width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: '1.2rem', fontWeight: 700 }}>
                    N
                  </div>
                  {isSaving ? 'Saving...' : 'Save Tenant Details'}
                </button>
              </div>

            </div>
        )}
      </AnimatePresence>
    </div>
  );
}
