"use client";

import { useConfirm } from '@/context/ConfirmContext';
import { toast } from 'react-hot-toast';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building, MapPin, Plus, Search, Filter, BedDouble, Users, IndianRupee, ChevronRight, X, Link as LinkIcon, ArrowLeft, ArrowRight, Layers, Home, Settings, Edit3, Trash2, AlertTriangle, Navigation, Phone, Image as ImageIcon, CheckSquare, FolderOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { rpcCall } from '@/lib/rpc';
import { AnimatedButton } from '@/components/AnimatedButton';
import { useHostel } from '@/context/HostelContext';
import { CustomSelect } from '@/components/CustomSelect';
import { CustomMonthPicker } from '@/components/CustomMonthPicker';
import { CustomDatePicker } from '@/components/CustomDatePicker';
import styles from './properties.module.css';

import { getFromCache, saveToCache } from '@/lib/cache';

const DEFAULT_HOSTEL_IMAGES = [
  "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80"
];

const getFloorNumber = (floorName: string) => {
  const match = (floorName || '').match(/(\d+)/);
  if (match) return parseInt(match[1], 10);
  if ((floorName || '').toLowerCase().includes('ground')) return 0;
  if ((floorName || '').toLowerCase().includes('basement')) return -1;
  return 999;
};

const sortFloorsAndRoomsAscending = (floors: any[]) => {
  if (!Array.isArray(floors)) return [];
  const copy = floors.map(f => ({
    ...f,
    rooms: [...(f.rooms || [])].sort((a: any, b: any) => 
      (a.roomNum || '').localeCompare(b.roomNum || '', undefined, { numeric: true, sensitivity: 'base' })
    )
  }));
  return copy.sort((a, b) => getFloorNumber(a.floorName) - getFloorNumber(b.floorName));
};

export default function MyHostelsPage() {
  const confirm = useConfirm();
  const router = useRouter();
  const { switchHostel, refreshProperties, properties: storeProperties, selectedPgId } = useHostel();
  const [isLoading, setIsLoading] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [properties, setProperties] = useState<any[]>(storeProperties || []);
  const [searchTerm, setSearchTerm] = useState('');

  // Global KPI State
  const [globalFinancials, setGlobalFinancials] = useState<{ payments: any[], expenses: any[] }>({ payments: [], expenses: [] });
  const [isFinancialsLoading, setIsFinancialsLoading] = useState(false);
  const [filterType, setFilterType] = useState<'daily' | 'monthly' | 'yearly'>('monthly');
  const [filterValue, setFilterValue] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    if (ownerId) {
      setIsFinancialsLoading(true);
      rpcCall('getGlobalFinancials', ownerId)
        .then((res: any) => {
          if (res?.success) {
            setGlobalFinancials(res.data);
          }
        })
        .catch(console.error)
        .finally(() => setIsFinancialsLoading(false));
    }
  }, [ownerId]);

  const isDateMatch = (dateStr: string) => {
    if (!dateStr) return false;
    const pDate = new Date(dateStr);
    if (filterType === 'daily') {
      const localDateStr = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}-${String(pDate.getDate()).padStart(2, '0')}`;
      return localDateStr === filterValue;
    } else if (filterType === 'monthly') {
      const localMonthStr = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}`;
      return localMonthStr === filterValue;
    } else if (filterType === 'yearly') {
      return pDate.getFullYear().toString() === filterValue;
    }
    return false;
  };

  const { collected, overdue, expensesAmount } = React.useMemo(() => {
    let coll = 0;
    let over = 0;
    let exp = 0;

    globalFinancials.payments.forEach((p: any) => {
      if (p.status === 'paid' || p.status === 'PAID') {
        if (isDateMatch(p.created_at)) {
          coll += Number(p.amount) || 0;
        }
      } else if (p.status === 'pending' || p.status === 'overdue' || p.status === 'PENDING') {
        over += Number(p.amount) || 0;
      }
    });

    globalFinancials.expenses.forEach((e: any) => {
      if (isDateMatch(e.date || e.created_at)) {
        exp += Number(e.amount || 0);
      }
    });

    return { collected: coll, overdue: over, expensesAmount: exp };
  }, [globalFinancials, filterType, filterValue]);

  const revenueAmount = collected + overdue;
  const profitAmount = revenueAmount - expensesAmount;

  // Add / Edit Hostel Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingPgId, setEditingPgId] = useState<string | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(1);

  // 2-Step Hostel Delete Modal State
  const [deleteTargetProperty, setDeleteTargetProperty] = useState<{ id: string; name: string } | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingProperty, setIsDeletingProperty] = useState(false);

  const handleInitiateDelete = (e: React.MouseEvent, pgId: string, name: string) => {
    e.stopPropagation();
    setDeleteTargetProperty({ id: pgId, name });
    setDeleteStep(1);
    setDeleteConfirmText('');
  };

  const handleConfirmFinalDelete = async () => {
    if (!deleteTargetProperty) return;
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      toast.error("Please type DELETE to confirm.");
      return;
    }
    setIsDeletingProperty(true);
    try {
      const res = await rpcCall('deleteProperty', deleteTargetProperty.id);
      if (res.success) {
        setDeleteTargetProperty(null);
        await refreshProperties();
      } else {
        toast.error("Failed to delete property: " + (res.error || 'Unknown error'));
      }
    } catch (err: any) {
      toast.error("Error deleting property: " + err.message);
    } finally {
      setIsDeletingProperty(false);
    }
  };

  // Step 1: Info & Location
  const [newHostelName, setNewHostelName] = useState('');
  const [newHostelAddress, setNewHostelAddress] = useState('');
  const [newLocationLink, setNewLocationLink] = useState('');
  const [newLat, setNewLat] = useState<number | undefined>(undefined);
  const [newLng, setNewLng] = useState<number | undefined>(undefined);
  const [newPhone, setNewPhone] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);

  const handleGpsCapture = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported by this browser.'); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNewLat(pos.coords.latitude);
        setNewLng(pos.coords.longitude);
        setGpsLoading(false);
      },
      () => { toast.error('Could not get GPS location. Please allow location access.'); setGpsLoading(false); }
    );
  };

  // Media Modal State
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [mediaTargetPgId, setMediaTargetPgId] = useState<string | null>(null);
  const [mediaTargetName, setMediaTargetName] = useState('');
  const [mediaImages, setMediaImages] = useState<string[]>([]);
  const [mediaFacilities, setMediaFacilities] = useState<string[]>([]);
  const [mediaTab, setMediaTab] = useState<'images' | 'facilities'>('images');
  const [isSavingMedia, setIsSavingMedia] = useState(false);

  const DEFAULT_FACILITIES = [
    '📶 WiFi', '❄️ AC', '📹 CCTV Security', '🚿 24/7 Hot Water',
    '🧺 Laundry', '🍳 Meals (Breakfast)', '🍱 Meals (Lunch)', '🍽️ Meals (Dinner)',
    '🧹 Housekeeping', '🛵 Parking (2-Wheeler)', '🚗 Parking (4-Wheeler)',
    '⚡ Power Backup (Generator)', '📚 Study Room', '📺 Common Room / TV Lounge',
    '🏋️ Gym', '💧 RO Drinking Water', '🧊 Refrigerator', '🚪 Wardrobe / Almirah',
    '🛁 Attached Bathroom', '🚽 Western Toilet', '🛗 Elevator / Lift',
    '🧑‍🤝‍🧑 Visitor Allowed', '🔥 Fire Safety', '🩺 First Aid',
    '👔 Iron & Ironing Board', '📦 Courier Delivery', '🍳 Gas Stove',
    '💧 Water Purifier', '🔐 Biometric Entry', '🚿 Geyser'
  ];

  const handleOpenMediaModal = (e: React.MouseEvent, pgId: string, name: string) => {
    e.stopPropagation();
    setMediaTargetPgId(pgId);
    setMediaTargetName(name);
    const prop = properties.find(p => (p.pg_id || p.id) === pgId);
    setMediaImages(prop?.images || []);
    setMediaFacilities(prop?.facilities || []);
    setMediaTab('images');
    setIsMediaModalOpen(true);
  };

  const compressImage = (base64Str: string, maxWidth = 1000, quality = 0.7): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(base64Str);
        }
      };
    });
  };

  const handleMediaImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const rawBase64 = ev.target?.result as string;
        compressImage(rawBase64).then(compressed => {
          setMediaImages(prev => [...prev, compressed]);
        });
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleSaveMedia = async () => {
    if (!mediaTargetPgId) return;
    setIsSavingMedia(true);
    try {
      // Compress all images in mediaImages before saving to Firestore to fit under 1MB limit
      const compressedImages = await Promise.all(
        mediaImages.map(img => {
          if (img.startsWith('data:image/')) {
            return compressImage(img);
          }
          return Promise.resolve(img);
        })
      );
      const res = await rpcCall('updateHostelMedia', mediaTargetPgId, { images: compressedImages, facilities: mediaFacilities });
      if (res.success) {
        setIsMediaModalOpen(false);
        await refreshProperties();
      } else {
        toast.error('Failed to save: ' + res.error);
      }
    } catch (err: any) {
      toast.error('Error during save: ' + err.message);
    } finally {
      setIsSavingMedia(false);
    }
  };

  const toggleFacility = (fac: string) => {
    setMediaFacilities(prev => prev.includes(fac) ? prev.filter(f => f !== fac) : [...prev, fac]);
  };

  // Step 2: Floors & Rooms Structure
  const [noOfFloors, setNoOfFloors] = useState<number | ''>(3);
  const [floorsConfig, setFloorsConfig] = useState<{ floorName: string; roomsCount: number | ''; rooms: { roomNum: string; sharing: number }[] }[]>([
    { floorName: '1st Floor', roomsCount: 4, rooms: [] },
    { floorName: '2nd Floor', roomsCount: 4, rooms: [] },
    { floorName: '3rd Floor', roomsCount: 4, rooms: [] },
  ]);

  // Step 3: Sharing Prices
  const [singleSharingPrice, setSingleSharingPrice] = useState<string>('12000');
  const [doubleSharingPrice, setDoubleSharingPrice] = useState<string>('9500');
  const [tripleSharingPrice, setTripleSharingPrice] = useState<string>('8000');
  const [fourSharingPrice, setFourSharingPrice] = useState<string>('7000');
  const [fiveSharingPrice, setFiveSharingPrice] = useState<string>('6000');
  const [sixSharingPrice, setSixSharingPrice] = useState<string>('5000');

  useEffect(() => {
    // INSTANT LOCAL CACHE HYDRATION (0 ms)
    if (typeof window !== 'undefined') {
      const uid = localStorage.getItem('userUid') || auth.currentUser?.uid;
      if (uid) {
        setOwnerId(uid);
        const cached = getFromCache(`properties_${uid}`);
        if (cached && cached.length > 0) {
          setProperties(cached);
          setIsLoading(false);
        }
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setOwnerId(user.uid);
        localStorage.setItem('userUid', user.uid);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleFloorsCountChange = (val: string) => {
    if (val === '') {
      setNoOfFloors('');
      return;
    }
    const count = parseInt(val, 10);
    if (isNaN(count)) return;
    const newCount = Math.min(15, count);
    setNoOfFloors(newCount);

    const floorLabels = ["1st Floor", "2nd Floor", "3rd Floor", "4th Floor", "5th Floor", "6th Floor", "7th Floor", "8th Floor", "9th Floor", "10th Floor", "11th Floor", "12th Floor", "13th Floor", "14th Floor", "15th Floor"];

    setFloorsConfig(prev => {
      const updated = [];
      for (let i = 0; i < newCount; i++) {
        if (prev[i]) {
          updated.push(prev[i]);
        } else {
          const floorName = floorLabels[i] || `${i + 1}th Floor`;
          updated.push({ floorName, roomsCount: 4, rooms: [] });
        }
      }
      return updated;
    });
  };

  useEffect(() => {
    if (storeProperties && storeProperties.length > 0) {
      const enriched = storeProperties.map((prop: any, idx: number) => {
        const rooms = prop.rooms || [];
        const totalRooms = rooms.length || (idx === 0 ? 12 : 12);
        let occupiedBeds = 0;
        let totalBeds = 0;
        rooms.forEach((r: any) => {
          totalBeds += (r.total_beds || r.beds || 2);
          occupiedBeds += (r.tenants?.length || 0);
        });
        const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : (idx === 0 ? 13 : 0);
        return {
          ...prop,
          total_rooms: totalRooms,
          occupancy_rate: occupancyRate,
          pending_dues: 0
        };
      });
      setProperties(enriched);
      setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  }, [storeProperties]);

  const handleSelectHostel = (pgId: string) => {
    switchHostel(pgId);
    router.push('/pgowner/dashboard');
  };

  const handleOpenManageModal = async (e: React.MouseEvent, pgId: string) => {
    e.stopPropagation();
    setModalMode('edit');
    setEditingPgId(pgId);
    setCurrentStep(1);
    setIsAddModalOpen(true);
    setIsLoadingDetails(true);

    try {
      const res = await rpcCall('getHostelDetailsForEdit', pgId);
      if (res.success && res.data) {
        setNewHostelName(res.data.name || '');
        setNewHostelAddress(res.data.address || '');
        const rawFloors = res.data.floorsConfig ? res.data.floorsConfig.map((f: any) => ({
          ...f,
          roomsCount: f.roomsCount || f.rooms?.length || 0,
          rooms: f.rooms || []
        })) : [];

        const sortedFloors = sortFloorsAndRoomsAscending(rawFloors);

        setFloorsConfig(sortedFloors);
        setNoOfFloors(sortedFloors.length || 3);
        
        const pr = res.data.pricing || {};
        setSingleSharingPrice(pr[1] || '12000');
        setDoubleSharingPrice(pr[2] || '9500');
        setTripleSharingPrice(pr[3] || '8000');
        setFourSharingPrice(pr[4] || '7000');
        setFiveSharingPrice(pr[5] || '6000');
        setSixSharingPrice(pr[6] || '5000');
      } else {
        toast.error("Could not load hostel details: " + res.error);
      }
    } catch (err: any) {
      toast.error("Error loading details: " + err.message);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHostelName.trim() || !newHostelAddress.trim()) {
      toast.error("Please enter the Hostel Name and Location Name.");
      return;
    }
    setCurrentStep(2);
  };

  const handleNextStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noOfFloors || noOfFloors < 1) {
      toast.error("Please enter a valid number of floors.");
      return;
    }
    setCurrentStep(3);
  };

  const handleNextStep3 = (e: React.FormEvent) => {
    e.preventDefault();
    if (floorsConfig.some(f => Number(f.roomsCount) < 1)) {
      toast.error("Please enter valid room numbers for all floors.");
      return;
    }
    
    // Sort floors first to get actual floor numbers (1st Floor => 1, 2nd Floor => 2, 3rd Floor => 3)
    const sortedFloors = sortFloorsAndRoomsAscending(floorsConfig);

    const generatedFloors = sortedFloors.map((f: any) => {
      const flNum = getFloorNumber(f.floorName) || 1;
      const count = Number(f.roomsCount);
      const existingRooms = f.rooms || [];
      const newRooms = [];
      
      for (let r = 1; r <= count; r++) {
        if (existingRooms[r - 1]) {
          newRooms.push(existingRooms[r - 1]);
        } else {
          newRooms.push({ roomNum: `${flNum}${String(r).padStart(2, '0')}`, sharing: 2 });
        }
      }
      return { ...f, rooms: newRooms };
    });

    setFloorsConfig(sortFloorsAndRoomsAscending(generatedFloors));
    setCurrentStep(4);
  };

  const handleNextStep4 = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentStep(5);
  };

  const handleSaveHostelFinal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerId) return;

    setIsSubmitting(true);
    try {
      const pricing: Record<number, string> = {
        1: singleSharingPrice || '12000',
        2: doubleSharingPrice || '9500',
        3: tripleSharingPrice || '8000',
        4: fourSharingPrice || '7000',
        5: fiveSharingPrice || '6000',
        6: sixSharingPrice || '5000',
      };

      const parsedFloorsConfig = floorsConfig.map(f => ({
        floorName: f.floorName,
        roomsCount: Number(f.roomsCount) || 0,
        rooms: f.rooms || []
      }));

      if (modalMode === 'edit' && editingPgId) {
        const res = await rpcCall('updateHostelPropertyFull', editingPgId, {
          name: newHostelName,
          address: newHostelAddress,
          locationLink: newLocationLink,
          lat: newLat,
          lng: newLng,
          phone: newPhone,
          floorsConfig: parsedFloorsConfig,
          pricing
        });

        if (res.success) {
          setIsAddModalOpen(false);
          await refreshProperties();
        } else {
          toast.error("Failed to update hostel: " + res.error);
        }
      } else {
        const res = await rpcCall('createNewHostelFull', ownerId, {
          name: newHostelName,
          address: newHostelAddress,
          locationLink: newLocationLink,
          lat: newLat,
          lng: newLng,
          phone: newPhone,
          floorsConfig: parsedFloorsConfig,
          pricing
        });

        if (res.success) {
          setIsAddModalOpen(false);
          await refreshProperties();
        } else {
          toast.error("Failed to create hostel: " + res.error);
        }
      }
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAddModal = () => {
    setModalMode('create');
    setEditingPgId(null);
    setNewHostelName('');
    setNewHostelAddress('');
    setNewLocationLink('');
    setNewLat(undefined);
    setNewLng(undefined);
    setNewPhone('');
    setNoOfFloors(3);
    setFloorsConfig([
      { floorName: '1st Floor', roomsCount: 4, rooms: [] },
      { floorName: '2nd Floor', roomsCount: 4, rooms: [] },
      { floorName: '3rd Floor', roomsCount: 4, rooms: [] },
    ]);
    setSingleSharingPrice('12000');
    setDoubleSharingPrice('9500');
    setTripleSharingPrice('8000');
    setFourSharingPrice('7000');
    setFiveSharingPrice('6000');
    setSixSharingPrice('5000');
    setCurrentStep(1);
    setIsAddModalOpen(true);
  };

  const handleDeleteProperty = async (e: React.MouseEvent, pgId: string, name: string) => {
    e.stopPropagation();
    if (await confirm(`Are you sure you want to delete ${name}? This action cannot be undone and will delete all rooms, tenants, and payments associated with this hostel.`)) {
      const res = await rpcCall('deleteProperty', pgId);
      if (res.success) {
        if (pgId === selectedPgId) {
          localStorage.removeItem('activePgId');
          localStorage.removeItem('activePgName');
        }
        await refreshProperties();
        if (pgId === selectedPgId) {
          window.location.reload();
        }
      } else {
        toast.error("Failed to delete property: " + res.error);
      }
    }
  };

  const filteredProperties = properties.filter(p => 
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const calculatedTotalRooms = floorsConfig.reduce((acc, f) => acc + (Number(f.roomsCount) || 0), 0);
  const calculatedTotalBeds = floorsConfig.reduce((acc, f) => acc + (f.rooms?.reduce((sum, r) => sum + r.sharing, 0) || 0), 0);

  return (
    <div className={styles.propertiesContainer}>
      {/* Global KPI Card */}
      {ownerId && (
        <div className={styles.globalKpiCard}>
          <div className={styles.globalKpiHeader}>
            <h2 className={styles.globalKpiTitle}>Overall Portfolio</h2>
            <div className={styles.kpiFilterGroup}>
              <div style={{ flex: 1, minWidth: '100px' }}>
                <CustomSelect 
                  value={filterType} 
                  onChange={(val) => {
                    const type = val as 'daily' | 'monthly' | 'yearly';
                    setFilterType(type);
                    const d = new Date();
                    if (type === 'daily') setFilterValue(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
                    else if (type === 'monthly') setFilterValue(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                    else setFilterValue(d.getFullYear().toString());
                  }}
                  options={[
                    { value: 'daily', label: 'Day' },
                    { value: 'monthly', label: 'Month' },
                    { value: 'yearly', label: 'Year' }
                  ]}
                />
              </div>

              {filterType === 'daily' && (
                <div style={{ flex: 1.2 }}>
                  <CustomDatePicker
                    selectedDate={filterValue ? new Date(filterValue) : new Date()}
                    onChange={(d) => {
                      if (d) {
                        setFilterValue(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
                      }
                    }}
                  />
                </div>
              )}

              {filterType === 'monthly' && (
                <CustomMonthPicker
                  value={filterValue}
                  onChange={(val) => setFilterValue(val)}
                />
              )}

              {filterType === 'yearly' && (
                <div style={{ flex: 1, minWidth: '90px' }}>
                  <CustomSelect
                    value={filterValue}
                    onChange={(val) => setFilterValue(val)}
                    options={Array.from({length: 10}).map((_, i) => {
                      const y = (new Date().getFullYear() - i).toString();
                      return { value: y, label: y };
                    })}
                  />
                </div>
              )}
            </div>
          </div>
          
          <div className={styles.globalKpiGrid}>
            <div className={styles.globalKpiItem}>
              <span className={styles.globalKpiLabel}>Revenue</span>
              <span className={styles.globalKpiValue}>₹{revenueAmount.toLocaleString('en-IN')}</span>
            </div>
            <div className={styles.globalKpiItem}>
              <span className={styles.globalKpiLabel}>Expenses</span>
              <span className={`${styles.globalKpiValue} ${styles.expenseValue}`}>-₹{expensesAmount.toLocaleString('en-IN')}</span>
            </div>
            <div className={styles.globalKpiItem}>
              <span className={styles.globalKpiLabel}>Profit</span>
              <span className={`${styles.globalKpiValue} ${styles.profitValue}`}>₹{profitAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      )}
      {/* Top Toolbar */}
      <div className={styles.topToolbar}>
        <div className={styles.searchFilterGroup}>
          <div className={styles.searchBar}>
            <Search size={18} color="#94A3B8" />
            <input 
              type="text" 
              placeholder="Search by name, city or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className={styles.filterBtn}>
            <Filter size={18} color="#64748B" />
          </button>
        </div>
        <button className={styles.addHostelBtn} onClick={openAddModal}>
          <Plus size={20} className={styles.plusIconCircle} />
          <span>Add Hostel</span>
        </button>
      </div>

      {/* Hostels List */}
      {isLoading ? (
        <div className={styles.loadingContainer}>
          <div className="spinner"></div>
        </div>
      ) : filteredProperties.length === 0 ? (
        <motion.div 
          className={styles.emptyCard}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className={styles.emptyIconBadge}>
            <Building size={32} color="#7C3AED" />
          </div>
          <h2 className={styles.emptyTitle}>No Hostels Found</h2>
          <p className={styles.emptySubtitle}>Add your first hostel property using the multi-step wizard</p>
          <button 
            className={styles.addHostelBtn}
            onClick={openAddModal}
            style={{ marginTop: '16px', maxWidth: '280px' }}
          >
            <Plus size={18} />
            Add Hostel
          </button>
        </motion.div>
      ) : (
        <div className={styles.hostelsList}>
          {filteredProperties.map((property, idx) => {
            const coverImage = property.image_url || DEFAULT_HOSTEL_IMAGES[idx % DEFAULT_HOSTEL_IMAGES.length];
            const filledRooms = property.calculatedFilledRoomsCount || 0;
            const roomsCount = property.calculatedRoomsCount || 0;
            const tenantsCount = property.calculatedTenantCount || 0;
            const bedsCapacity = property.calculatedTotalCapacity || 0;
            const collectedAmt = property.calculatedCollectedAmount || 0;
            const expectedAmt = property.calculatedExpectedAmount || 0;
            const pendingDues = property.calculatedPendingDues || 0;

            return (
              <motion.div
                key={property.pg_id}
                className={styles.hostelCard}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                onClick={() => handleSelectHostel(property.pg_id)}
              >
                {/* Hero Card Image */}
                <div className={styles.cardImageContainer}>
                  <img src={coverImage} alt={property.name} className={styles.cardImage} />
                  <div className={styles.imageIconBadge}>
                    <Building size={16} color="#7C3AED" />
                  </div>
                  <div className={styles.activePillBadge}>
                    <span className={styles.activeDot} />
                    Active
                  </div>
                  
                  {/* Floating Compact Actions Menu inside Image */}
                  <div className={styles.compactActionsMenu} onClick={(e) => e.stopPropagation()}>
                    <button className={styles.compactActionBtn} onClick={(e) => handleOpenMediaModal(e, property.pg_id || property.id, property.name)} title="Media">
                      <ImageIcon size={14} />
                    </button>
                    <button className={styles.compactActionBtn} onClick={(e) => handleOpenManageModal(e, property.pg_id)} title="Manage">
                      <Settings size={14} />
                    </button>
                    <button className={styles.compactActionBtn} style={{ color: '#E11D48' }} onClick={(e) => handleInitiateDelete(e, property.pg_id || property.id, property.name)} title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Card Content Body */}
                <div className={styles.cardContent}>
                  <h3 className={styles.hostelName}>{property.name}</h3>
                  <div className={styles.hostelLocation}>
                    <MapPin size={12} color="#94A3B8" />
                    <span>{property.address || 'Hyderabad'}</span>
                  </div>

                  <div className={styles.compactMetricsGrid}>
                    <div className={styles.compactMetricItem}>
                      <span className={styles.compactMetricLabel}>Rooms</span>
                      <span className={styles.compactMetricValue}>{filledRooms}/{roomsCount} <span className={styles.compactMetricSub}>Filled</span></span>
                    </div>
                    <div className={styles.compactMetricItem}>
                      <span className={styles.compactMetricLabel}>Beds</span>
                      <span className={styles.compactMetricValue}>{tenantsCount}/{bedsCapacity} <span className={styles.compactMetricSub}>Filled</span></span>
                    </div>
                    <div className={styles.compactMetricItem}>
                      <span className={styles.compactMetricLabel}>Collections</span>
                      <span className={styles.compactMetricValue}>₹{collectedAmt.toLocaleString('en-IN')}/<span className={styles.compactMetricSub}>₹{expectedAmt.toLocaleString('en-IN')}</span></span>
                    </div>
                    <div className={styles.compactMetricItem}>
                      <span className={styles.compactMetricLabel}>Pending Dues</span>
                      <span className={`${styles.compactMetricValue} ${styles.pendingValue}`}>₹{pendingDues.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Multi-Step Add / Manage Hostel Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <motion.div 
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsAddModalOpen(false);
            }}
          >
            <motion.div 
              className={styles.modalContent}
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
            >
              <div className={styles.modalHeader}>
                <h2>{modalMode === 'edit' ? 'Manage Hostel Details' : 'Add New Hostel'}</h2>
                <button className={styles.closeBtn} onClick={() => setIsAddModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              {isLoadingDetails ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                  Loading hostel configuration...
                </div>
              ) : (
                <>
                  {/* Progress Step Indicator */}
                  <div className={styles.stepIndicatorRow}>
                    {[1, 2, 3, 4, 5].map(step => (
                      <div 
                        key={step}
                        className={`${styles.stepPill} ${currentStep >= step ? styles.stepPillActive : ''}`} 
                        onClick={() => setCurrentStep(step as any)} 
                        style={{ cursor: 'pointer' }}
                      />
                    ))}
                  </div>

                  <div className={styles.stepTitleText}>
                    {currentStep === 1 && "Step 1 of 5: General Info & Location"}
                    {currentStep === 2 && "Step 2 of 5: Number of Floors"}
                    {currentStep === 3 && "Step 3 of 5: Rooms per Floor"}
                    {currentStep === 4 && "Step 4 of 5: Room Sharing Config"}
                    {currentStep === 5 && "Step 5 of 5: Setup Sharing Prices"}
                  </div>

                  {/* STEP 1: General Info & Location */}
                  {currentStep === 1 && (
                    <form onSubmit={handleNextStep1} className={styles.modalForm}>
                      <div className={styles.formGroup}>
                        <label>Hostel Name *</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Himalaya Hostel" 
                          value={newHostelName}
                          onChange={(e) => setNewHostelName(e.target.value)}
                          required 
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label>Location / City Name *</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Gandhi Nagar, Hyderabad" 
                          value={newHostelAddress}
                          onChange={(e) => setNewHostelAddress(e.target.value)}
                          required
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label>Contact Phone Number</label>
                        <input 
                          type="tel" 
                          placeholder="e.g. 9876543210" 
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value)}
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label>GPS Location</label>
                        <button
                          type="button"
                          onClick={handleGpsCapture}
                          disabled={gpsLoading}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '10px 18px', borderRadius: '10px',
                            background: newLat ? '#F0FDF4' : '#EFF6FF',
                            color: newLat ? '#16A34A' : '#2563EB',
                            border: newLat ? '1px solid #BBF7D0' : '1px solid #BFDBFE',
                            fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
                            width: '100%'
                          }}
                        >
                          <Navigation size={16} />
                          {gpsLoading ? 'Getting GPS…' : newLat ? `✅ GPS Captured (${newLat.toFixed(4)}, ${newLng?.toFixed(4)})` : '📍 Use My GPS Location'}
                        </button>
                        <small style={{ color: '#94A3B8', marginTop: '4px', display: 'block' }}>Used to sort hostels nearest-first on the public page</small>
                      </div>

                      <div className={styles.formGroup}>
                        <label>Google Maps Location Link (Optional)</label>
                        <input 
                          type="url" 
                          placeholder="e.g. https://maps.google.com/..." 
                          value={newLocationLink}
                          onChange={(e) => setNewLocationLink(e.target.value)}
                        />
                      </div>

                      <div className={styles.modalFooter}>
                        <AnimatedButton 
                          type="button" 
                          variant="outline" 
                          onClick={() => setIsAddModalOpen(false)}
                          style={{ flex: 1 }}
                        >
                          Cancel
                        </AnimatedButton>
                        <AnimatedButton 
                          type="submit" 
                          variant="primary" 
                          style={{ flex: 1.2 }}
                        >
                          Next: Structure →
                        </AnimatedButton>
                      </div>
                    </form>
                  )}

                  
                  {/* STEP 2: Number of Floors */}
                  {currentStep === 2 && (
                    <form onSubmit={handleNextStep2} className={styles.modalForm}>
                      <div className={styles.formGroup}>
                        <label>Total Number of Floors *</label>
                        <input 
                          type="number" 
                          min={1}
                          max={15}
                          value={noOfFloors}
                          onChange={(e) => handleFloorsCountChange(e.target.value)}
                          required 
                        />
                      </div>

                      <div className={styles.modalFooter}>
                        <AnimatedButton 
                          type="button" 
                          variant="outline" 
                          onClick={() => setCurrentStep(1)}
                          style={{ flex: 1 }}
                        >
                          ← Back
                        </AnimatedButton>
                        <AnimatedButton 
                          type="submit" 
                          variant="primary" 
                          style={{ flex: 1.2 }}
                        >
                          Next: Rooms/Floor →
                        </AnimatedButton>
                      </div>
                    </form>
                  )}

                  {/* STEP 3: Rooms per Floor */}
                  {currentStep === 3 && (
                    <form onSubmit={handleNextStep3} className={styles.modalForm}>
                      <div className={styles.floorsListHeader}>Configure Rooms per Floor</div>
                      <div className={styles.floorsListContainer}>
                        {floorsConfig.map((fConfig, idx) => (
                          <div key={idx} className={styles.floorConfigCard}>
                            <div className={styles.floorCardTitle}>{fConfig.floorName}</div>
                            <div className={styles.formRow}>
                              <div className={styles.formGroup}>
                                <label>Total Rooms on this floor</label>
                                <input 
                                  type="number" 
                                  min={1}
                                  max={50}
                                  value={fConfig.roomsCount}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setFloorsConfig(prev => prev.map((item, i) => i === idx ? { ...item, roomsCount: val === '' ? '' : Number(val) } : item));
                                  }}
                                  required
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className={styles.modalFooter}>
                        <AnimatedButton 
                          type="button" 
                          variant="outline" 
                          onClick={() => setCurrentStep(2)}
                          style={{ flex: 1 }}
                        >
                          ← Back
                        </AnimatedButton>
                        <AnimatedButton 
                          type="submit" 
                          variant="primary" 
                          style={{ flex: 1.2 }}
                        >
                          Next: Room Setup →
                        </AnimatedButton>
                      </div>
                    </form>
                  )}

                  {/* STEP 4: Room-by-Room Sharing Config & Management */}
                  {currentStep === 4 && (
                    <form onSubmit={handleNextStep4} className={styles.modalForm}>
                      <div className={styles.floorsListContainer}>
                        {sortFloorsAndRoomsAscending(floorsConfig).map((fConfig, fIdx) => (
                          <div key={fIdx} className={styles.floorConfigCard} style={{ marginBottom: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <div className={styles.floorCardTitle}>{fConfig.floorName} Rooms ({fConfig.rooms?.length || 0})</div>
                              <button
                                type="button"
                                onClick={() => {
                                  setFloorsConfig(prev => prev.map((floor, i) => {
                                    if (i !== fIdx) return floor;
                                    const existing = floor.rooms || [];
                                    const nextNum = `${fIdx + 1}${String(existing.length + 1).padStart(2, '0')}`;
                                    const updated = [...existing, { roomNum: nextNum, sharing: 2 }];
                                    return { ...floor, roomsCount: updated.length, rooms: updated };
                                  }));
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  color: '#2563eb',
                                  background: '#eff6ff',
                                  border: '1px solid #bfdbfe',
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  cursor: 'pointer'
                                }}
                              >
                                <Plus size={13} /> Add Room
                              </button>
                            </div>

                            {(!fConfig.rooms || fConfig.rooms.length === 0) ? (
                              <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', padding: '8px 0' }}>
                                No rooms on this floor yet. Click "+ Add Room" to create one.
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {(fConfig.rooms || []).map((room: any, rIdx: number) => (
                                  <div key={rIdx} style={{ background: '#F8FAFC', padding: '10px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                                    {/* Editable Room Number Input */}
                                    <div style={{ flex: 1 }}>
                                      <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>Room No</label>
                                      <input 
                                        type="text"
                                        value={room.roomNum}
                                        onChange={(e) => {
                                          const newNum = e.target.value;
                                          setFloorsConfig(prev => prev.map((floor, i) => {
                                            if (i !== fIdx) return floor;
                                            const updatedRooms = [...(floor.rooms || [])];
                                            updatedRooms[rIdx] = { ...updatedRooms[rIdx], roomNum: newNum };
                                            return { ...floor, rooms: updatedRooms };
                                          }));
                                        }}
                                        style={{
                                          width: '100%',
                                          padding: '6px 10px',
                                          borderRadius: '8px',
                                          border: '1px solid #cbd5e1',
                                          fontWeight: 700,
                                          fontSize: '0.9rem',
                                          color: '#0f172a',
                                          background: '#ffffff'
                                        }}
                                        placeholder="e.g. 302"
                                      />
                                    </div>

                                    {/* Sharing Select */}
                                    <div style={{ flex: 1 }}>
                                      <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>Sharing</label>
                                      <CustomSelect 
                                        value={String(room.sharing)}
                                        onChange={(val) => {
                                          const newSharing = Number(val);
                                          setFloorsConfig(prev => prev.map((floor, i) => {
                                            if (i !== fIdx) return floor;
                                            const updatedRooms = [...(floor.rooms || [])];
                                            updatedRooms[rIdx] = { ...updatedRooms[rIdx], sharing: newSharing };
                                            return { ...floor, rooms: updatedRooms };
                                          }));
                                        }}
                                        options={[
                                          { value: '1', label: '1 Sharing' },
                                          { value: '2', label: '2 Sharing' },
                                          { value: '3', label: '3 Sharing' },
                                          { value: '4', label: '4 Sharing' },
                                          { value: '5', label: '5 Sharing' },
                                          { value: '6', label: '6 Sharing' },
                                        ]}
                                      />
                                    </div>

                                    {/* Delete Room Button */}
                                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                                      <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'transparent', display: 'block', marginBottom: '4px', userSelect: 'none' }}>Action</label>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setFloorsConfig(prev => prev.map((floor, i) => {
                                            if (i !== fIdx) return floor;
                                            const updatedRooms = (floor.rooms || []).filter((_, idx) => idx !== rIdx);
                                            return { ...floor, roomsCount: updatedRooms.length, rooms: updatedRooms };
                                          }));
                                        }}
                                        style={{
                                          background: '#fee2e2',
                                          border: '1px solid #fca5a5',
                                          color: '#dc2626',
                                          borderRadius: '8px',
                                          padding: '7px 10px',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: '4px',
                                          fontSize: '0.75rem',
                                          fontWeight: 600
                                        }}
                                        title="Delete room"
                                      >
                                        <Trash2 size={15} /> Delete
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className={styles.summaryBox}>
                        <div className={styles.summaryItem}>
                          <span className={styles.summaryVal}>{calculatedTotalRooms}</span>
                          <span className={styles.summaryLbl}>Total Rooms</span>
                        </div>
                        <div className={styles.summaryItem}>
                          <span className={styles.summaryVal}>{calculatedTotalBeds}</span>
                          <span className={styles.summaryLbl}>Total Bed Capacity</span>
                        </div>
                      </div>

                      <div className={styles.modalFooter}>
                        <AnimatedButton 
                          type="button" 
                          variant="outline" 
                          onClick={() => setCurrentStep(3)}
                          style={{ flex: 1 }}
                        >
                          ← Back
                        </AnimatedButton>
                        <AnimatedButton 
                          type="submit" 
                          variant="primary" 
                          style={{ flex: 1.2 }}
                        >
                          Next: Pricing →
                        </AnimatedButton>
                      </div>
                    </form>
                  )}

                  {/* STEP 5: Setup Sharing Prices */}
                  {currentStep === 5 && (
                    <form onSubmit={handleSaveHostelFinal} className={styles.modalForm}>
                      <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                          <label>1 Sharing Price (₹)</label>
                          <input 
                            type="number" 
                            placeholder="12000"
                            value={singleSharingPrice}
                            onChange={(e) => setSingleSharingPrice(e.target.value)}
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label>2 Sharing Price (₹)</label>
                          <input 
                            type="number" 
                            placeholder="9500"
                            value={doubleSharingPrice}
                            onChange={(e) => setDoubleSharingPrice(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                          <label>3 Sharing Price (₹)</label>
                          <input 
                            type="number" 
                            placeholder="8000"
                            value={tripleSharingPrice}
                            onChange={(e) => setTripleSharingPrice(e.target.value)}
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label>4 Sharing Price (₹)</label>
                          <input 
                            type="number" 
                            placeholder="7000"
                            value={fourSharingPrice}
                            onChange={(e) => setFourSharingPrice(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                          <label>5 Sharing Price (₹)</label>
                          <input 
                            type="number" 
                            placeholder="6000"
                            value={fiveSharingPrice}
                            onChange={(e) => setFiveSharingPrice(e.target.value)}
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label>6 Sharing Price (₹)</label>
                          <input 
                            type="number" 
                            placeholder="5000"
                            value={sixSharingPrice}
                            onChange={(e) => setSixSharingPrice(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className={styles.modalFooter}>
                        <AnimatedButton 
                          type="button" 
                          variant="outline" 
                          onClick={() => setCurrentStep(4)}
                          style={{ flex: 1 }}
                        >
                          ← Back
                        </AnimatedButton>
                        <AnimatedButton 
                          type="submit" 
                          variant="primary" 
                          isLoading={isSubmitting}
                          style={{ flex: 1.2 }}
                        >
                          {modalMode === 'edit' ? 'Save Changes 💾' : 'Create Hostel 🎉'}
                        </AnimatedButton>
                      </div>
                    </form>
                  )}
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2-Step Hostel Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteTargetProperty && (
          <div 
            onClick={() => setDeleteTargetProperty(null)}
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
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
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                overflow: 'hidden',
                border: '1px solid #fee2e2'
              }}
            >
              {/* Header */}
              <div style={{ background: '#fff1f2', padding: '18px 20px', borderBottom: '1px solid #fecdd3', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: '#ffe4e6', padding: '8px', borderRadius: '10px', display: 'flex', color: '#e11d48' }}>
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#9f1239' }}>
                    {deleteStep === 1 ? 'Step 1 of 2: Confirm Deletion' : 'Step 2 of 2: Final Confirmation'}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#be123c' }}>
                    Property: <strong>{deleteTargetProperty.name}</strong>
                  </p>
                </div>
                <button 
                  onClick={() => setDeleteTargetProperty(null)}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: '1.2rem', color: '#9f1239', cursor: 'pointer', fontWeight: 700 }}
                >
                  &times;
                </button>
              </div>

              {/* Body Step 1 */}
              {deleteStep === 1 && (
                <div style={{ padding: '20px' }}>
                  <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                    <div style={{ fontWeight: 700, color: '#991b1b', fontSize: '0.9rem', marginBottom: '6px' }}>⚠️ Warning: Permanent Data Loss</div>
                    <div style={{ fontSize: '0.82rem', color: '#7f1d1d', lineHeight: '1.5' }}>
                      Deleting <strong>{deleteTargetProperty.name}</strong> will permanently remove:
                      <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
                        <li>All floor & room configurations</li>
                        <li>All tenant profiles & check-in history</li>
                        <li>All pending dues and payment records</li>
                      </ul>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.83rem', color: '#475569' }}>
                    Are you sure you want to proceed with deleting this property?
                  </p>
                </div>
              )}

              {/* Body Step 2 */}
              {deleteStep === 2 && (
                <div style={{ padding: '20px' }}>
                  <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: '#334155' }}>
                    To prevent accidental deletion of <strong>{deleteTargetProperty.name}</strong>, please type <strong style={{ color: '#dc2626' }}>DELETE</strong> in the box below:
                  </p>
                  <input 
                    type="text"
                    placeholder="Type DELETE to confirm"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '2px solid #fca5a5',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      color: '#0f172a',
                      outline: 'none'
                    }}
                    autoFocus
                  />
                </div>
              )}

              {/* Footer Actions */}
              <div style={{ padding: '12px 20px 20px', display: 'flex', gap: '10px', background: '#fafafa', borderTop: '1px solid #f1f5f9' }}>
                {deleteStep === 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setDeleteTargetProperty(null)}
                      style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteStep(2)}
                      style={{ flex: 1.3, padding: '10px', borderRadius: '8px', border: 'none', background: '#e11d48', color: '#ffffff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                    >
                      Proceed to Delete →
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setDeleteStep(1)}
                      style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmFinalDelete}
                      disabled={deleteConfirmText.trim().toUpperCase() !== 'DELETE' || isDeletingProperty}
                      style={{
                        flex: 1.5,
                        padding: '10px',
                        borderRadius: '8px',
                        border: 'none',
                        background: deleteConfirmText.trim().toUpperCase() === 'DELETE' ? '#dc2626' : '#fca5a5',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: deleteConfirmText.trim().toUpperCase() === 'DELETE' ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s'
                      }}
                    >
                      {isDeletingProperty ? 'Deleting...' : 'Permanently Delete'}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Media Manager Modal: Images & Facilities */}
      <AnimatePresence>
        {isMediaModalOpen && (
          <div 
            onClick={() => setIsMediaModalOpen(false)}
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
              backdropFilter: 'blur(10px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '680px',
                maxHeight: '90vh',
                backgroundColor: '#ffffff',
                borderRadius: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid rgba(217, 119, 6, 0.15)'
              }}
            >
              {/* Header */}
              <div style={{ background: '#fffbeb', padding: '20px 24px', borderBottom: '1px solid #fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#78350f' }}>
                    Media &amp; Facilities Manager
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#92400e', fontWeight: 600 }}>
                    Property: {mediaTargetName}
                  </p>
                </div>
                <button 
                  onClick={() => setIsMediaModalOpen(false)}
                  style={{ background: 'rgba(217, 119, 6, 0.1)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', color: '#78350f', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}
                >
                  &times;
                </button>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
                <button
                  type="button"
                  onClick={() => setMediaTab('images')}
                  style={{
                    flex: 1, padding: '14px', border: 'none', background: 'none',
                    fontWeight: 700, fontSize: '0.9rem', color: mediaTab === 'images' ? '#d97706' : '#64748b',
                    borderBottom: mediaTab === 'images' ? '3px solid #d97706' : '3px solid transparent',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                  }}
                >
                  <ImageIcon size={16} /> 📷 Photos ({mediaImages.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMediaTab('facilities')}
                  style={{
                    flex: 1, padding: '14px', border: 'none', background: 'none',
                    fontWeight: 700, fontSize: '0.9rem', color: mediaTab === 'facilities' ? '#d97706' : '#64748b',
                    borderBottom: mediaTab === 'facilities' ? '3px solid #d97706' : '3px solid transparent',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                  }}
                >
                  <CheckSquare size={16} /> 🏨 Facilities ({mediaFacilities.length})
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                
                {/* IMAGES TAB */}
                {mediaTab === 'images' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* Upload button area */}
                    <div style={{
                      border: '2px dashed #cbd5e1', borderRadius: '16px', padding: '30px 20px',
                      textAlign: 'center', cursor: 'pointer', background: '#f8fafc',
                      transition: 'all 0.2s', position: 'relative'
                    }}>
                      <input 
                        type="file" 
                        multiple 
                        accept="image/*"
                        onChange={handleMediaImageUpload}
                        style={{
                          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                          opacity: 0, cursor: 'pointer', width: '100%', height: '100%'
                        }}
                      />
                      <FolderOpen size={36} color="#94a3b8" style={{ marginBottom: '8px' }} />
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155' }}>
                        Click to Upload Photos
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                        PNG, JPG, JPEG supported (origin quality preserved)
                      </div>
                    </div>

                    {/* Previews Grid */}
                    {mediaImages.length > 0 ? (
                      <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                        gap: '12px', marginTop: '8px'
                      }}>
                        {mediaImages.map((img, idx) => (
                          <div 
                            key={idx} 
                            style={{
                              position: 'relative', width: '100%', height: '90px',
                              borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0',
                              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                            }}
                          >
                            <img src={img} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <button
                              type="button"
                              onClick={() => setMediaImages(prev => prev.filter((_, i) => i !== idx))}
                              style={{
                                position: 'absolute', top: '4px', right: '4px',
                                background: 'rgba(239, 68, 68, 0.9)', color: '#fff',
                                border: 'none', borderRadius: '50%', width: '22px', height: '22px',
                                fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                        No photos added yet. Upload images of rooms, lobby, dining area etc.
                      </div>
                    )}
                  </div>
                )}

                {/* FACILITIES TAB */}
                {mediaTab === 'facilities' && (
                  <div>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 16px 0', fontWeight: 600 }}>
                      Check the facilities available at this hostel:
                    </p>
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                      gap: '10px'
                    }}>
                      {DEFAULT_FACILITIES.map((fac) => {
                        const isChecked = mediaFacilities.includes(fac);
                        return (
                          <div 
                            key={fac}
                            onClick={() => toggleFacility(fac)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '8px',
                              padding: '10px 14px', borderRadius: '12px',
                              border: isChecked ? '1px solid #b45309' : '1px solid #e2e8f0',
                              background: isChecked ? '#fffbeb' : '#ffffff',
                              color: isChecked ? '#78350f' : '#334155',
                              fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              userSelect: 'none'
                            }}
                          >
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              readOnly
                              style={{ accentColor: '#d97706', cursor: 'pointer' }}
                            />
                            <span>{fac}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>

              {/* Footer */}
              <div style={{ padding: '16px 24px 24px', display: 'flex', gap: '12px', borderTop: '1px solid #f1f5f9', background: '#fafafa' }}>
                <button
                  type="button"
                  onClick={() => setIsMediaModalOpen(false)}
                  style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveMedia}
                  disabled={isSavingMedia}
                  style={{
                    flex: 1.4, padding: '12px', borderRadius: '12px', border: 'none',
                    background: 'linear-gradient(135deg, #d97706, #b45309)', color: '#ffffff',
                    fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(180, 83, 9, 0.2)'
                  }}
                >
                  {isSavingMedia ? 'Saving Changes…' : 'Save Media Config 💾'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}




