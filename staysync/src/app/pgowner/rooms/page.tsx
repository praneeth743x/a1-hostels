"use client";

import { toast } from 'react-hot-toast';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BedDouble, Home, Users, Search, ChevronDown, ChevronUp, ChevronRight, X, Save, Building2, Plus, Edit, SlidersHorizontal, Trash2 } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { globalAppCache, saveToCache, getFromCache } from '@/lib/cache';
import { useRouter } from 'next/navigation';
import { rpcCall } from '@/lib/rpc';
import { useHostel, usePermissions } from '@/context/HostelContext';
import { PERMISSIONS } from '@/constants/permissions';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useHostelData } from '@/hooks/useHostelData';
import { SelectHostelPrompt } from '@/components/SelectHostelPrompt';
import { perfLogger } from '@/lib/perfLogger';
import styles from './rooms.module.css';
import { AnimatedButton } from '@/components/AnimatedButton';
import { AvatarImage } from '@/components/AvatarImage';

export interface ExtraChargeItem {
  id: string;
  name: string;
  amount: number | '';
  type: 'monthly' | 'onetime';
  effectFrom: 'next' | 'current';
}

export default function RoomsManager() {
  const { selectedProperty, selectedPgId, pageStates, setPageState } = useHostel();
  const { hasPermission } = usePermissions();
  const { data: hostelData } = useHostelData(selectedPgId);
  const storeRooms = hostelData?.rooms;
  const storeTenants = hostelData?.tenants;
  const savedState = pageStates['rooms'] || {};

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const canManageRooms = hasPermission(PERMISSIONS.MANAGE_ROOMS);
  const [floors, setFloors] = useState<any[]>([]);
  const router = useRouter();

  const [totalRooms, setTotalRooms] = useState(0);
  const [vacantRooms, setVacantRooms] = useState(0);
  const [partialRooms, setPartialRooms] = useState(0);
  const [fullRooms, setFullRooms] = useState(0);
  const [totalBeds, setTotalBeds] = useState(0);
  const [occupiedBeds, setOccupiedBeds] = useState(0);
  
  // Accordion state
  const [openFloors, setOpenFloors] = useState<Record<string, boolean>>({});
  const [expandedRooms, setExpandedRooms] = useState<Record<string, boolean>>({});

  const toggleRoom = (roomId: string) => {
    setExpandedRooms(prev => ({ ...prev, [roomId]: !prev[roomId] }));
  };

  // Filter state
  const [activeFilter, setActiveFilter] = useState<string>(savedState.filter || 'All');
  const [localFilters, setLocalFilters] = useState<string>(savedState.filter || 'All');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Auto-expand all floors when a filter or search query is active so matching rooms list out immediately
  useEffect(() => {
    if (activeFilter !== 'All' || searchQuery) {
      const allOpen: Record<string, boolean> = {};
      floors.forEach(f => {
        allOpen[f.floor] = true;
      });
      setOpenFloors(prev => ({ ...prev, ...allOpen }));
    }
  }, [activeFilter, searchQuery, floors]);

  useEffect(() => {
    perfLogger.logNavigationStart('/pgowner/rooms');
    perfLogger.logRenderStart('RoomsManager');
    perfLogger.logPageSummary('Rooms');
    return () => {
      perfLogger.logRenderEnd('RoomsManager');
    };
  }, []);

  useEffect(() => {
    setPageState('rooms', { filter: activeFilter });
  }, [activeFilter, setPageState]);

  // Modal state
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [editBeds, setEditBeds] = useState<number | ''>(1);
  const [extraCharges, setExtraCharges] = useState<ExtraChargeItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const handleAddExtraCharge = () => {
    setExtraCharges(prev => [
      ...prev,
      {
        id: 'charge_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        name: '',
        amount: '',
        type: 'monthly',
        effectFrom: 'next'
      }
    ]);
  };

  const handleUpdateExtraCharge = (id: string, field: keyof ExtraChargeItem, val: any) => {
    setExtraCharges(prev => prev.map(c => c.id === id ? { ...c, [field]: val } : c));
  };

  const handleRemoveExtraCharge = (id: string) => {
    setExtraCharges(prev => prev.filter(c => c.id !== id));
  };

  // Manage Charges Modal state
  const [chargeTenant, setChargeTenant] = useState<any>(null);
  const [chargeType, setChargeType] = useState<'monthly' | 'onetime'>('monthly');
  const [chargeAmount, setChargeAmount] = useState<number | ''>('');
  const [chargeDesc, setChargeDesc] = useState<string>('');
  const [isSavingCharge, setIsSavingCharge] = useState<boolean>(false);




  useEffect(() => {
    if (!storeRooms || storeRooms.length === 0) {
      setIsLoading(false);
      return;
    }
    
    const floorMap: Record<string, any[]> = {};
    storeRooms.forEach((r: any) => {
      const floorName = r.floor || 'Floor 1';
      if (!floorMap[floorName]) floorMap[floorName] = [];

      const roomTenants = (storeTenants || []).filter((t: any) => (t.room_id === r.room_id || t.room === r.room_number) && (t.is_active !== false || t.status === 'Active' || t.status === 'notice_period' || t.status === 'Notice Period'));
      const occ = roomTenants.length;
      const beds = Number(r.total_beds || r.beds || 2);
      const status = occ >= beds ? 'occupied' : occ === 0 ? 'available' : 'partial';

      const roomNum = r.num || r.room_number || r.room || r.number || r.name || (r.id ? `Room ${r.id}` : 'Room');

      floorMap[floorName].push({
        ...r,
        num: roomNum,
        beds,
        occ,
        status,
        tenants: roomTenants
      });
    });

    const formattedFloorData = Object.keys(floorMap).map(floor => {
      const sortedRooms = [...floorMap[floor]].sort((a: any, b: any) => {
        const numA = parseInt(String(a.num).replace(/[^0-9]/g, ''), 10);
        const numB = parseInt(String(b.num).replace(/[^0-9]/g, ''), 10);
        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
          return numA - numB;
        }
        return String(a.num).localeCompare(String(b.num), undefined, { numeric: true, sensitivity: 'base' });
      });

      return {
        floor,
        rooms: sortedRooms
      };
    }).sort((a: any, b: any) => {
      const floorA = parseInt(String(a.floor).replace(/[^0-9]/g, ''), 10);
      const floorB = parseInt(String(b.floor).replace(/[^0-9]/g, ''), 10);
      if (!isNaN(floorA) && !isNaN(floorB) && floorA !== floorB) {
        return floorA - floorB;
      }
      return String(a.floor).localeCompare(String(b.floor), undefined, { numeric: true, sensitivity: 'base' });
    });

    setFloors(formattedFloorData);

    let tRooms = 0, vRooms = 0, pRooms = 0, fRooms = 0;
    let tBeds = 0, oBeds = 0;
    const oFloors: Record<string, boolean> = {};

    formattedFloorData.forEach((f: any) => {
      oFloors[f.floor] = false;
      f.rooms.forEach((r: any) => {
        tRooms++;
        if (r.status === 'available') vRooms++;
        else if (r.status === 'partial') pRooms++;
        else if (r.status === 'occupied') fRooms++;
        tBeds += (r.beds || 0);
        oBeds += (r.occ || 0);
      });
    });

    setTotalRooms(tRooms);
    setVacantRooms(vRooms);
    setPartialRooms(pRooms);
    setFullRooms(fRooms);
    setTotalBeds(tBeds);
    setOccupiedBeds(oBeds);
    setOpenFloors(oFloors);
    setIsLoading(false);
  }, [storeRooms, storeTenants]);



  const toggleFloor = (floor: string) => {
    setOpenFloors(prev => ({ ...prev, [floor]: !prev[floor] }));
  };

  const handleOpenModal = (room: any) => {
    setSelectedRoom(room);
    setEditBeds(room.beds || 1);

    const savedCharges = room.extra_charges || room.extraCharges || [];
    if (Array.isArray(savedCharges) && savedCharges.length > 0) {
      setExtraCharges(savedCharges.map((c: any) => ({
        id: c.id || 'c_' + Math.random().toString(36).substring(2, 9),
        name: c.name || c.reason || 'Extra Fee',
        amount: c.amount !== undefined ? c.amount : '',
        type: c.type || 'monthly',
        effectFrom: c.effectFrom || 'next'
      })));
    } else {
      const savedFee = Number(room.extraFee ?? room.extra_fee ?? 0);
      if (savedFee > 0) {
        setExtraCharges([{
          id: 'c_1',
          name: 'Extra Fee',
          amount: savedFee,
          type: 'monthly',
          effectFrom: 'next'
        }]);
      } else {
        setExtraCharges([{
          id: 'c_' + Date.now(),
          name: '',
          amount: '',
          type: 'monthly',
          effectFrom: 'next'
        }]);
      }
    }
  };

  const handleCloseModal = () => {
    setSelectedRoom(null);
  };

  const handleOpenChargeModal = (tenant: any) => {
    setChargeTenant(tenant);
    setChargeType('monthly');
    // Pre-fill with current monthly rent (try all backend field variants)
    const currentRent = tenant.fee ?? tenant.rent_amount ?? tenant.monthly_rent ?? tenant.rent ?? '';
    setChargeAmount(currentRent !== '' ? Number(currentRent) : '');
    setChargeDesc('');
  };

  const handleCloseChargeModal = () => {
    setChargeTenant(null);
  };

  const handleSaveCharge = async () => {
    if (!chargeTenant) return;
    setIsSavingCharge(true);
    try {
      const amt = chargeAmount === '' ? 0 : Number(chargeAmount);
      let res;
      if (chargeType === 'monthly') {
        // Update the tenant's monthly rent
        res = await rpcCall('updateTenantRent', chargeTenant.id ?? chargeTenant.tenant_id, amt);
        if (res.success) {
          // Reflect updated rent in local UI
          setFloors(floors.map(floor => ({
            ...floor,
            rooms: floor.rooms.map((r: any) => ({
              ...r,
              tenants: r.tenants ? r.tenants.map((t: any) =>
                (t.id === chargeTenant.id || t.tenant_id === chargeTenant.tenant_id)
                  ? { ...t, fee: amt, rent_amount: amt, monthly_rent: amt }
                  : t
              ) : []
            }))
          })));
          setChargeTenant(null);
        } else {
          toast.error('Failed to update monthly rent: ' + res.error);
        }
      } else {
        if (!chargeDesc || !chargeDesc.trim()) {
          toast.error('Please enter a name/description for this charge.');
          setIsSavingCharge(false);
          return;
        }
        res = await rpcCall('addTenantOneTimeCharge', chargeTenant.pg_id, chargeTenant.id ?? chargeTenant.tenant_id, amt, chargeDesc.trim());
        if (res.success) {
          toast.success('One-time charge added successfully to current month.');
          setChargeTenant(null);
        } else {
          toast.error('Failed to add one-time charge: ' + res.error);
        }
      }
    } catch (e: any) {
      toast.error('Error: ' + e.message);
    } finally {
      setIsSavingCharge(false);
    }
  };

  const handleSaveRoom = async () => {
    if (!selectedRoom) return;
    setIsSaving(true);

    const finalBeds = editBeds === '' ? 1 : Number(editBeds);

    // Clean valid charges
    const validCharges = extraCharges
      .map(c => ({ ...c, amount: c.amount === '' ? 0 : Number(c.amount) }))
      .filter(c => c.amount > 0);

    // Sum monthly charges
    const totalMonthlyExtra = validCharges
      .filter(c => c.type === 'monthly')
      .reduce((sum, c) => sum + c.amount, 0);

    try {
      const res = await rpcCall('updateRoomDetails', selectedRoom.id, finalBeds, totalMonthlyExtra, validCharges);
      if (res.success) {
        // Update local floor/room state
        setFloors(floors.map(floor => ({
          ...floor,
          rooms: floor.rooms.map((r: any) =>
            r.id === selectedRoom.id
              ? {
                  ...r,
                  beds: finalBeds,
                  extraFee: totalMonthlyExtra,
                  extra_fee: totalMonthlyExtra,
                  extra_charges: validCharges,
                  status: r.occ >= finalBeds ? 'occupied' : r.occ > 0 ? 'partial' : 'available'
                }
              : r
          )
        })));

        // Update KPIs
        let tRooms = 0, vRooms = 0, pRooms = 0, fRooms = 0;
        let tBeds = 0, oBeds = 0;
        floors.forEach(f => {
          f.rooms.forEach((r: any) => {
            let rStatus = r.status;
            let rBeds = r.beds || 0;
            let rOcc = r.occ || 0;
            if (r.id === selectedRoom.id) {
              rStatus = r.occ >= finalBeds ? 'occupied' : r.occ > 0 ? 'partial' : 'available';
              rBeds = finalBeds;
            }
            tRooms++;
            if (rStatus === 'available') vRooms++;
            else if (rStatus === 'partial') pRooms++;
            else if (rStatus === 'occupied') fRooms++;
            tBeds += rBeds;
            oBeds += rOcc;
          });
        });
        setTotalRooms(tRooms);
        setVacantRooms(vRooms);
        setPartialRooms(pRooms);
        setFullRooms(fRooms);
        setTotalBeds(tBeds);
        setOccupiedBeds(oBeds);

        // Apply charges for one-time or current period items
        if (selectedRoom.tenants && selectedRoom.tenants.length > 0) {
          const roomLabel = selectedRoom.num ?? selectedRoom.room_number ?? selectedRoom.id;
          for (const charge of validCharges) {
            const amt = Number(charge.amount);
            const feeReason = charge.name.trim() || 'Extra Room Fee';

            if (charge.type === 'onetime') {
              const periodText = charge.effectFrom === 'next' ? 'starting next due date' : 'current period';
              for (const t of selectedRoom.tenants) {
                const tenantId = t.id ?? t.tenant_id;
                const pgId = t.pg_id ?? selectedPgId;
                if (!tenantId || !pgId) continue;
                const desc = `Room ${roomLabel} — ${feeReason} (₹${amt}) (${periodText})`;
                await rpcCall('addTenantOneTimeCharge', pgId, tenantId, amt, desc);
              }
            } else if (charge.type === 'monthly' && charge.effectFrom === 'current') {
              for (const t of selectedRoom.tenants) {
                const tenantId = t.id ?? t.tenant_id;
                const pgId = t.pg_id ?? selectedPgId;
                if (!tenantId || !pgId) continue;
                const desc = `Room ${roomLabel} — ${feeReason} (₹${amt}) — current month`;
                await rpcCall('addTenantOneTimeCharge', pgId, tenantId, amt, desc);
              }
            }
          }
        }

        handleCloseModal();
      } else {
        toast.error("Failed to save room details.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Error saving room settings: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (errorMsg) {
    return <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', color: 'red' }}>Error: {errorMsg}</div>;
  }

  if (isLoading && floors.length === 0 && !hostelData) {
    return (
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} style={{ height: '70px', backgroundColor: '#f1f5f9', borderRadius: '10px' }} />
          ))}
        </div>
        <div style={{ height: '200px', backgroundColor: '#f8fafc', borderRadius: '12px' }} />
      </div>
    );
  }

  if (!selectedPgId && !selectedProperty) {
    return <SelectHostelPrompt pageTitle="Rooms Management" />;
  }

  return (
    <ProtectedRoute permission={PERMISSIONS.VIEW_ROOMS}>
      <div className={styles.dashboardPage}>
      {/* ─── Stats Panel ─── */}
      <div className={styles.statsPanel}>
        <div className={styles.statsGrid}>

          {/* Total Rooms */}
          <div className={`${styles.statCard} ${styles.statBlue}`}>
            <div className={styles.statEmoji}>🏢</div>
            <div className={styles.statNumber} style={{ color: '#3730a3' }}>{totalRooms}</div>
            <div className={styles.statLabel}>Total Rooms</div>
          </div>

          {/* Tenants Housed (active tenants) */}
          <div className={`${styles.statCard} ${styles.statGreen}`}>
            <div className={styles.statEmoji}>👥</div>
            <div className={styles.statNumber} style={{ color: '#15803d' }}>{occupiedBeds}</div>
            <div className={styles.statLabel}>Tenants Housed</div>
          </div>

          {/* Total Beds */}
          <div className={`${styles.statCard} ${styles.statIndigo}`}>
            <div className={styles.statEmoji}>📦</div>
            <div className={styles.statNumber} style={{ color: '#1d4ed8' }}>{totalBeds}</div>
            <div className={styles.statLabel}>Total Beds</div>
          </div>

          {/* Fully Occupied (Clickable Filter) */}
          <div
            className={`${styles.statCard} ${styles.statRed} ${styles.clickableStatCard} ${activeFilter === 'Full' ? styles.activeCard : ''}`}
            onClick={() => setActiveFilter(prev => prev === 'Full' ? 'All' : 'Full')}
          >
            <div className={styles.statEmoji}>🔒</div>
            <div className={styles.statNumber} style={{ color: '#dc2626' }}>{fullRooms}</div>
            <div className={styles.statLabel}>Fully Occupied</div>
            <div className={styles.filterBadgeHint}>{activeFilter === 'Full' ? '✓ Filtered' : 'Tap to filter'}</div>
          </div>

          {/* Partially Filled (Clickable Filter) */}
          <div
            className={`${styles.statCard} ${styles.statYellow} ${styles.clickableStatCard} ${activeFilter === 'Partial' ? styles.activeCard : ''}`}
            onClick={() => setActiveFilter(prev => prev === 'Partial' ? 'All' : 'Partial')}
          >
            <div className={styles.statEmoji}>🟠</div>
            <div className={styles.statNumber} style={{ color: '#d97706' }}>{partialRooms}</div>
            <div className={styles.statLabel}>Partially Filled</div>
            <div className={styles.filterBadgeHint}>{activeFilter === 'Partial' ? '✓ Filtered' : 'Tap to filter'}</div>
          </div>

          {/* Vacant (Clickable Filter) */}
          <div
            className={`${styles.statCard} ${styles.statGray} ${styles.clickableStatCard} ${activeFilter === 'Vacant' ? styles.activeCard : ''}`}
            onClick={() => setActiveFilter(prev => prev === 'Vacant' ? 'All' : 'Vacant')}
          >
            <div className={styles.statEmoji}>⚪</div>
            <div className={styles.statNumber} style={{ color: '#059669' }}>{vacantRooms}</div>
            <div className={styles.statLabel}>Vacant</div>
            <div className={styles.filterBadgeHint}>{activeFilter === 'Vacant' ? '✓ Filtered' : 'Tap to filter'}</div>
          </div>
        </div>

        {/* Occupancy Progress Bar */}
        <div className={styles.occupancyRow}>
          <span className={styles.occupancyLabel}>Occupancy</span>
          <div className={styles.occupancyBarTrack}>
            <div
              className={styles.occupancyBarFill}
              style={{ width: `${totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0}%` }}
            />
          </div>
          <span className={styles.occupancyPercent}>
            {totalBeds > 0 ? ((occupiedBeds / totalBeds) * 100).toFixed(1) : '0.0'}%
          </span>
        </div>
      </div>

      {/* Search and Filter */}
      <div className={styles.searchRow}>
        <div className={styles.searchBar}>
          <Search size={18} color="#94a3b8" />
          <input 
            type="text" 
            placeholder="Search by room number..." 
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className={styles.filterBtn} onClick={() => { setLocalFilters(activeFilter); setIsFilterOpen(true); }}>
          <SlidersHorizontal size={20} color="#64748b" />
        </div>
      </div>

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
                <button className={styles.resetBtn} onClick={() => { setLocalFilters('All'); setActiveFilter('All'); setIsFilterOpen(false); }}>Reset</button>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.filterSection}>
                  <h3>Room Status</h3>
                  <div className={styles.optionsGrid}>
                    {['All', 'Vacant', 'Partial', 'Full', 'Extra Fee'].map(status => (
                      <button 
                        key={status}
                        className={`${styles.filterOptionBtn} ${localFilters === status ? styles.selected : ''}`}
                        onClick={() => setLocalFilters(status)}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button className={styles.cancelBtn} onClick={() => setIsFilterOpen(false)}>Cancel</button>
                <button 
                  className={styles.applyBtn} 
                  onClick={() => {
                    setActiveFilter(localFilters);
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

      {activeFilter !== 'All' && (
        <div className={styles.activeFiltersRow}>
          <div className={styles.activeFiltersScroll}>
            <div className={styles.activeFilterChip}>
              {activeFilter} <button onClick={() => setActiveFilter('All')}><X size={12}/></button>
            </div>
          </div>
          <button className={styles.clearAllFilters} onClick={() => setActiveFilter('All')}>
            Clear
          </button>
        </div>
      )}



      {(() => {
        const filteredFloors = floors.map(floor => {
          const filteredRooms = floor.rooms.filter((r: any) => {
            if (searchQuery) {
              const query = searchQuery.toLowerCase();
              const matchesRoom = r.num.toString().toLowerCase().includes(query);
              const matchesTenant = (r.tenants || []).some((t: any) => 
                (t.name || t.full_name || '').toLowerCase().includes(query) ||
                (t.phone || t.mobile || '').includes(query)
              );
              if (!matchesRoom && !matchesTenant) return false;
            }

            if (activeFilter === 'Vacant' && r.status !== 'available') return false;
            if (activeFilter === 'Partial' && r.status !== 'partial') return false;
            if (activeFilter === 'Full' && r.status !== 'occupied') return false;
            if (activeFilter === 'Extra Fee' && (!r.extraFee || r.extraFee <= 0)) return false;

            return true;
          });

          return { ...floor, rooms: filteredRooms };
        }).filter(floor => floor.rooms.length > 0);

        return (
          <>
            {filteredFloors.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No rooms found.</div>
            )}

            {filteredFloors.map((floor) => (
              <section key={floor.floor} className={styles.floorSection}>
                <div className={styles.floorHeader} onClick={() => toggleFloor(floor.floor)}>
                  <div className={styles.floorTitleWrapper}>
                    <div className={styles.floorIconSquare}>
                      <Building2 size={24} color="#2563eb" strokeWidth={2} />
                    </div>
                    <span className={styles.floorTitleText}>{floor.floor}</span>
                  </div>
                  <div className={styles.floorRight}>
                    <span className={styles.floorPill}>{floor.rooms.length} Rooms</span>
                    {openFloors[floor.floor] ? <ChevronUp size={20} color="#64748b" /> : <ChevronDown size={20} color="#64748b" />}
                  </div>
                </div>

                {openFloors[floor.floor] && (
                  <div
                    style={{ overflow: 'hidden' }}
                  >
                    <div className={styles.roomList}>
                      {floor.rooms.map((room: any, index: number) => {
                        const occPct = room.beds > 0 ? Math.round((room.occ / room.beds) * 100) : 0;
                        return (
                          <div
                            key={room.id || room.room_id || `room_${floor.floor}_${index}`}
                            className={styles.roomCard}
                            onClick={() => toggleRoom(room.id)}
                          >
                            <div className={`${styles.roomBorder} ${styles[room.status]}`}></div>
                            <div className={styles.roomContent}>
                              <div className={styles.col1}>
                                <h3 className={styles.roomNumber}>{room.num || room.room_number || room.room || room.number || room.name || 'Room'}</h3>
                                <span className={styles.occSubText}>{room.occ}/{room.beds}</span>
                              </div>

                              <div className={styles.bedsRow}>
                                {Array.from({ length: room.beds || 1 }).map((_, bIdx) => {
                                  const isOccupied = bIdx < room.occ;
                                  const totalBedsCount = room.beds || 1;
                                  const iconSize = totalBedsCount > 4 ? 13 : 15;
                                  return (
                                    <div
                                      key={bIdx}
                                      className={`${styles.bedCard} ${isOccupied ? styles.bedOccupied : styles.bedVacant}`}
                                    >
                                      <BedDouble size={iconSize} strokeWidth={2.5} color={isOccupied ? '#ef4444' : '#10b981'} />
                                    </div>
                                  );
                                })}
                              </div>

                              <div className={styles.col3}>
                                {canManageRooms && (
                                  <div
                                    className={styles.addTenantBtn}
                                    style={{
                                      opacity: room.status === 'occupied' ? 0.3 : 1,
                                      cursor: room.status === 'occupied' ? 'not-allowed' : 'pointer'
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (room.status === 'occupied') {
                                        toast.error('This room is fully occupied. Cannot add more tenants.');
                                        return;
                                      }
                                      router.push(`/pgowner/tenants?add=true&roomId=${room.id}&returnUrl=/pgowner/rooms`);
                                    }}
                                  >
                                    <Plus size={16} strokeWidth={2.5} color="#2563eb" />
                                  </div>
                                )}
                              </div>
                            </div>

                            {expandedRooms[room.id] && (
                              <div style={{ overflow: 'hidden' }}>
                                <div className={styles.expandedSection}>
                                  {room.tenants && room.tenants.length > 0 ? (
                                    room.tenants.map((t: any) => {
                                      const fee = t.fee ?? t.rent_amount ?? t.monthly_rent ?? t.rent ?? 0;
                                      const deposit = t.securityDeposit ?? t.security_deposit ?? t.deposit ?? 0;
                                      const extra = t.extraFee ?? t.extra_fee ?? 0;
                                      return (
                                        <div key={t.id || t.tenant_id} className={styles.tenantCard}>
                                          <div className={styles.tenantCardHeader}>
                                            <AvatarImage src={t.face_picture || t.facePicture || t.documents?.photo || t.documents?.facePicture || t.documents?.photo_url || t.avatar || t.photo_url || t.photoUrl} alt={t.name || t.full_name || 'Tenant'} name={t.name || t.full_name || '?'} size={36} />
                                            <div className={styles.tenantCardMeta}>
                                              <span className={styles.tenantName}>{t.name || t.full_name || 'Unnamed'}</span>
                                              {extra > 0 && (
                                                <span className={styles.extraFeeTag}>+₹{extra} extra</span>
                                              )}
                                            </div>
                                            <button
                                              className={styles.manageChargesBtn}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenChargeModal(t);
                                              }}
                                            >
                                              Manage Charges
                                            </button>
                                          </div>
                                          <div className={styles.tenantFeeRow}>
                                            <div className={styles.feeBlock}>
                                              <span className={styles.feeBlockLabel}>Monthly Rent</span>
                                              <span className={styles.feeBlockValue}>₹{Number(fee).toLocaleString('en-IN')}</span>
                                            </div>
                                            <div className={styles.feeDivider} />
                                            <div className={styles.feeBlock}>
                                              <span className={styles.feeBlockLabel}>Security Deposit</span>
                                              <span className={styles.feeBlockValue}>₹{Number(deposit).toLocaleString('en-IN')}</span>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <div className={styles.emptyTenants}>
                                      <span>🛏️ No tenants — room is vacant</span>
                                    </div>
                                  )}

                                      {/* Room Extra Fee */}
                                      <div className={styles.roomExtraFeeRow}>
                                        <span className={styles.roomExtraFeeLabel}>Room Extra Fee</span>
                                        <span className={styles.roomExtraFeeVal}>
                                          ₹{Number(room.extraFee ?? room.extra_fee ?? 0).toLocaleString('en-IN')}
                                        </span>
                                      </div>

                                      {canManageRooms && (
                                        <button
                                          className={styles.editRoomBtn}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenModal(room);
                                          }}
                                        >
                                          <Edit size={15} /> Edit Room
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
              </section>
            ))}
          </>
        );
      })()}

      {/* Edit Room Modal */}
      <AnimatePresence>
        {selectedRoom && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCloseModal}
          >
            <motion.div
              className={styles.modalContent}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h2>Room {selectedRoom.num} Settings</h2>
                <button className={styles.closeBtn} onClick={handleCloseModal}><X size={18} /></button>
              </div>

              <div className={styles.modalBody}>
                <div className={styles.inputGroup}>
                  <label>Sharing (Total Beds)</label>
                  <input
                    type="number"
                    className={styles.styledInput}
                    value={editBeds}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '') setEditBeds('');
                      else setEditBeds(parseInt(val));
                    }}
                    min="1"
                    max="10"
                  />
                  {editBeds < selectedRoom.occ && (
                    <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>Cannot be less than occupied beds ({selectedRoom.occ}).</span>
                  )}
                </div>

                {/* ─── MULTIPLE EXTRA ROOM CHARGES SECTION ─── */}
                <div className={styles.inputGroup} style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ margin: 0, fontWeight: 800, fontSize: '0.92rem', color: '#0f172a' }}>
                      Extra Room Charges
                    </label>
                    <button
                      type="button"
                      onClick={handleAddExtraCharge}
                      style={{
                        background: '#eff6ff',
                        color: '#2563eb',
                        border: '1.5px solid #bfdbfe',
                        borderRadius: '10px',
                        padding: '6px 14px',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      + Add Charge
                    </button>
                  </div>

                  {extraCharges.length === 0 ? (
                    <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', textAlign: 'center', fontSize: '0.8rem', color: '#64748b' }}>
                      No extra charges. Tap "+ Add Charge" above to add AC, Parking, Maintenance, etc.
                    </div>
                  ) : (
                    extraCharges.map((charge) => (
                      <div
                        key={charge.id}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '16px',
                          padding: '16px',
                          marginBottom: '12px',
                          position: 'relative'
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleRemoveExtraCharge(charge.id)}
                          style={{
                            position: 'absolute',
                            right: '12px',
                            top: '12px',
                            background: '#fee2e2',
                            color: '#ef4444',
                            border: 'none',
                            borderRadius: '8px',
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '12px', marginBottom: '16px', paddingRight: '32px' }}>
                          <div>
                            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '6px', display: 'block' }}>Charge Name</label>
                            <input
                              type="text"
                              placeholder="e.g. AC Fee"
                              className={styles.styledInput}
                              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: '0.85rem' }}
                              value={charge.name}
                              onChange={e => handleUpdateExtraCharge(charge.id, 'name', e.target.value)}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '6px', display: 'block' }}>Amount</label>
                            <div style={{ position: 'relative' }}>
                              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: '#2563eb', fontSize: '0.9rem' }}>₹</span>
                              <input
                                type="number"
                                placeholder="0"
                                className={styles.styledInput}
                                style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '28px', paddingRight: '12px', paddingTop: '10px', paddingBottom: '10px', fontSize: '0.9rem', fontWeight: 800 }}
                                value={charge.amount}
                                onChange={e => {
                                  const val = e.target.value;
                                  handleUpdateExtraCharge(charge.id, 'amount', val === '' ? '' : Number(val));
                                }}
                                min="0"
                              />
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                          <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '10px', padding: '4px', flex: 1 }}>
                            <button
                              type="button"
                              onClick={() => handleUpdateExtraCharge(charge.id, 'type', 'monthly')}
                              style={{
                                flex: 1, padding: '6px', borderRadius: '8px', border: 'none',
                                background: charge.type === 'monthly' ? '#ffffff' : 'transparent',
                                color: charge.type === 'monthly' ? '#0f172a' : '#64748b',
                                fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer',
                                boxShadow: charge.type === 'monthly' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                transition: 'all 0.2s'
                              }}
                            >
                              Monthly
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateExtraCharge(charge.id, 'type', 'onetime')}
                              style={{
                                flex: 1, padding: '6px', borderRadius: '8px', border: 'none',
                                background: charge.type === 'onetime' ? '#ffffff' : 'transparent',
                                color: charge.type === 'onetime' ? '#0f172a' : '#64748b',
                                fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer',
                                boxShadow: charge.type === 'onetime' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                transition: 'all 0.2s'
                              }}
                            >
                              One-Time
                            </button>
                          </div>

                          <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '10px', padding: '4px', flex: 1 }}>
                            <button
                              type="button"
                              onClick={() => handleUpdateExtraCharge(charge.id, 'effectFrom', 'next')}
                              style={{
                                flex: 1, padding: '6px', borderRadius: '8px', border: 'none',
                                background: charge.effectFrom === 'next' ? '#ffffff' : 'transparent',
                                color: charge.effectFrom === 'next' ? '#0f172a' : '#64748b',
                                fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer',
                                boxShadow: charge.effectFrom === 'next' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                transition: 'all 0.2s'
                              }}
                            >
                              Next Bill
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateExtraCharge(charge.id, 'effectFrom', 'current')}
                              style={{
                                flex: 1, padding: '6px', borderRadius: '8px', border: 'none',
                                background: charge.effectFrom === 'current' ? '#ffffff' : 'transparent',
                                color: charge.effectFrom === 'current' ? '#0f172a' : '#64748b',
                                fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer',
                                boxShadow: charge.effectFrom === 'current' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                transition: 'all 0.2s'
                              }}
                            >
                              Current
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button className={styles.cancelBtn} onClick={handleCloseModal}>Cancel</button>
                <AnimatedButton
                  className={styles.saveBtn}
                  isLoading={isSaving}
                  onClick={handleSaveRoom}
                  disabled={editBeds < selectedRoom.occ}
                >
                  <Save size={18} />
                  Save Changes
                </AnimatedButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manage Charges Modal */}
      <AnimatePresence>
        {chargeTenant && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCloseChargeModal}
          >
            <motion.div
              className={styles.modalContent}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h2>Charges: {chargeTenant.name}</h2>
                <button className={styles.closeBtn} onClick={handleCloseChargeModal}><X size={18} /></button>
              </div>

              <div className={styles.modalBody}>
                {/* Tab switcher */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: '#f1f5f9', borderRadius: '10px', padding: '4px' }}>
                  <button
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '7px', border: 'none', backgroundColor: chargeType === 'monthly' ? '#fff' : 'transparent', color: chargeType === 'monthly' ? '#0f172a' : '#64748b', fontWeight: 700, cursor: 'pointer', boxShadow: chargeType === 'monthly' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.2s', fontSize: '0.85rem' }}
                    onClick={() => {
                      setChargeType('monthly');
                      const currentRent = chargeTenant?.fee ?? chargeTenant?.rent_amount ?? chargeTenant?.monthly_rent ?? chargeTenant?.rent ?? '';
                      setChargeAmount(currentRent !== '' ? Number(currentRent) : '');
                    }}
                  >
                    💰 Monthly Fee
                  </button>
                  <button
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '7px', border: 'none', backgroundColor: chargeType === 'onetime' ? '#fff' : 'transparent', color: chargeType === 'onetime' ? '#0f172a' : '#64748b', fontWeight: 700, cursor: 'pointer', boxShadow: chargeType === 'onetime' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.2s', fontSize: '0.85rem' }}
                    onClick={() => {
                      setChargeType('onetime');
                      setChargeAmount('');
                    }}
                  >
                    ⚡ One-Time
                  </button>
                </div>

                {chargeType === 'monthly' && (
                  <div style={{ marginBottom: '8px', padding: '10px 14px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                    <span style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600 }}>Current rent: </span>
                    <span style={{ fontSize: '0.9rem', color: '#15803d', fontWeight: 800 }}>₹{Number(chargeTenant?.fee ?? chargeTenant?.rent_amount ?? chargeTenant?.monthly_rent ?? 0).toLocaleString('en-IN')}</span>
                  </div>
                )}

                <div className={styles.inputGroup}>
                  <label>{chargeType === 'monthly' ? 'New Monthly Rent (₹)' : 'Amount (₹)'}</label>
                  <input
                    type="number"
                    className={styles.styledInput}
                    value={chargeAmount}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '') setChargeAmount('');
                      else setChargeAmount(parseInt(val));
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {chargeType === 'monthly' ? 'Sets the recurring monthly rent for this tenant.' : 'Added once to the current pending bill.'}
                  </span>
                </div>

                {chargeType === 'onetime' && (
                  <div className={styles.inputGroup} style={{ marginTop: '12px' }}>
                    <label>Charge Name <span style={{ color: '#EF4444' }}>*</span></label>
                    <input
                      type="text"
                      className={styles.styledInput}
                      placeholder="e.g. Electricity Bill - Aug"
                      value={chargeDesc}
                      onChange={e => setChargeDesc(e.target.value)}
                      required
                    />
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px', display: 'block' }}>Required — this name will appear in the dues breakdown.</span>
                  </div>
                )}

                <div className={styles.modalActions}>
                  <button className={styles.cancelBtn} onClick={handleCloseChargeModal}>Cancel</button>
                  <AnimatedButton
                    onClick={handleSaveCharge}
                    isLoading={isSavingCharge}
                  >
                    <Save size={16} style={{ marginRight: '8px' }} /> Apply Charge
                  </AnimatedButton>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  </ProtectedRoute>
  );
}
