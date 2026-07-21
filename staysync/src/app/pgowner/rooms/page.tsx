"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BedDouble, Home, Users, Search, LayoutGrid, ChevronDown, ChevronUp, ChevronRight, X, Save, Building2, Plus, Edit, SlidersHorizontal } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { getDashboardStats, updateRoomDetails, addTenantConstantFee, addTenantOneTimeCharge } from '@/app/actions/pgowner';
import styles from './rooms.module.css';
import { AnimatedButton } from '@/components/AnimatedButton';

export default function RoomsManager() {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [floors, setFloors] = useState<any[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();

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
  const [activeFilter, setActiveFilter] = useState('All');
  const [localFilters, setLocalFilters] = useState('All');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [editBeds, setEditBeds] = useState<number | ''>(1);
  const [editFee, setEditFee] = useState<number | ''>(0);
  const [isSaving, setIsSaving] = useState(false);

  // Manage Charges Modal state
  const [chargeTenant, setChargeTenant] = useState<any>(null);
  const [chargeType, setChargeType] = useState<'constant' | 'onetime'>('constant');
  const [chargeAmount, setChargeAmount] = useState<number | ''>('');
  const [chargeDesc, setChargeDesc] = useState('');
  const [isSavingCharge, setIsSavingCharge] = useState(false);

  const fetchRooms = async (uid: string) => {
    try {
      let currentId = searchParams.get('pgId');
      if (!currentId && typeof localStorage !== 'undefined') {
         currentId = localStorage.getItem('activePgId');
      }
      const res = await getDashboardStats(uid, currentId ? [currentId] : null);
      if (res.success && res.data) {
        const floorData = res.data.formattedRoomData || [];
        setFloors(floorData);

        let tRooms = 0, vRooms = 0, pRooms = 0, fRooms = 0;
        let tBeds = 0, oBeds = 0;
        const oFloors: Record<string, boolean> = {};

        floorData.forEach((f: any) => {
          oFloors[f.floor] = false; // closed by default
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
      } else if (!res.success) {
        setErrorMsg(res.error || 'Failed to fetch room stats');
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsLoading(true);
        await fetchRooms(user.uid);
      } else {
        router.push('/');
      }
    });
    return () => unsubscribe();
  }, []);

  const toggleFloor = (floor: string) => {
    setOpenFloors(prev => ({ ...prev, [floor]: !prev[floor] }));
  };

  const handleOpenModal = (room: any) => {
    setSelectedRoom(room);
    setEditBeds(room.beds || 1);
    setEditFee(room.extraFee || 0);
  };

  const handleCloseModal = () => {
    setSelectedRoom(null);
  };

  const handleOpenChargeModal = (tenant: any) => {
    setChargeTenant(tenant);
    setChargeType('constant');
    setChargeAmount(tenant.extraFee || '');
    setChargeDesc('');
  };

  const handleCloseChargeModal = () => {
    setChargeTenant(null);
  };

  const handleSaveCharge = async () => {
    if (!chargeTenant) return;
    setIsSavingCharge(true);
    try {
      const amt = chargeAmount === '' ? 0 : chargeAmount;
      if (chargeType === 'constant') {
        const res = await addTenantConstantFee(chargeTenant.id, amt);
        if (res.success) {
          // Update local state
          setFloors(floors.map(floor => ({
            ...floor,
            rooms: floor.rooms.map((r: any) => ({
              ...r,
              tenants: r.tenants ? r.tenants.map((t: any) =>
                t.id === chargeTenant.id ? { ...t, extraFee: amt } : t
              ) : []
            }))
          })));
          setChargeTenant(null);
        } else {
          alert('Failed to save constant fee: ' + res.error);
        }
      } else {
        const pgId = localStorage.getItem('activePgId') || '';
        const res = await addTenantOneTimeCharge(pgId, chargeTenant.id, amt, chargeDesc || 'One-time charge');
        if (res.success) {
          alert('One-time charge added successfully to current month.');
          setChargeTenant(null);
        } else {
          alert('Failed to add one-time charge: ' + res.error);
        }
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setIsSavingCharge(false);
    }
  };

  const handleSaveRoom = async () => {
    if (!selectedRoom) return;
    setIsSaving(true);

    const finalBeds = editBeds === '' ? 1 : editBeds;
    const finalFee = editFee === '' ? 0 : editFee;

    try {
      const res = await updateRoomDetails(selectedRoom.roomId, finalBeds, finalFee);
      if (res.success) {
        setFloors(floors.map(floor => ({
          ...floor,
          rooms: floor.rooms.map((r: any) =>
            r.roomId === selectedRoom.roomId
              ? { ...r, beds: finalBeds, extraFee: finalFee, status: r.occ >= finalBeds ? 'occupied' : r.occ > 0 ? 'partial' : 'available' }
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
            if (r.roomId === selectedRoom.roomId) {
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

        handleCloseModal();
      } else {
        alert("Failed to save room details.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (errorMsg) {
    return <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', color: 'red' }}>Error: {errorMsg}</div>;
  }

  if (isLoading) {
    return <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Loading...</div>;
  }

  return (
    <div className={styles.dashboardPage}>
      {/* KPIs */}
      <div className={styles.topCardsRow}>
        <div className={styles.topCardFull}>
          <div className={styles.totalRoomsLeft}>
            <LayoutGrid size={28} strokeWidth={2} />
          </div>
          <div className={styles.totalRoomsMiddle}>
            <div className={styles.cardTitle}>Total Rooms</div>
            <div className={styles.totalRoomsNumber}>{totalRooms}</div>
          </div>
          <div className={`${styles.circularProgress} ${styles.progressBlue}`}>
            <div className={styles.progressContainer}>
              <svg viewBox="0 0 64 64" className={styles.svgCircle}>
                <circle cx="32" cy="32" r="28" className={styles.svgCircleBg} />
                <circle cx="32" cy="32" r="28" className={styles.svgCirclePath}
                  style={{ strokeDasharray: 2 * Math.PI * 28, strokeDashoffset: 2 * Math.PI * 28 * (1 - ((totalRooms - vacantRooms) / (totalRooms || 1))) }} />
              </svg>
              <div className={styles.progressTextWrapper}>
                <span className={styles.progressPercent}>{Math.round(((totalRooms - vacantRooms) / (totalRooms || 1)) * 100)}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.topCardsHalfRow}>
          <div className={styles.topCardHalf}>
            <div className={styles.cardTitle}>Rooms Occupancy</div>
            <div className={styles.occColumns}>
              <div className={styles.occCol}>
                <span className={`${styles.occVal} ${styles.vacant}`}>{vacantRooms}</span>
                <span className={styles.occLabel}>Vacant</span>
                <span className={`${styles.dot} ${styles.vacant}`}></span>
              </div>
              <div className={styles.occDivider} />
              <div className={styles.occCol}>
                <span className={`${styles.occVal} ${styles.partial}`}>{partialRooms}</span>
                <span className={styles.occLabel}>Partial</span>
                <span className={`${styles.dot} ${styles.partial}`}></span>
              </div>
              <div className={styles.occDivider} />
              <div className={styles.occCol}>
                <span className={`${styles.occVal} ${styles.full}`}>{fullRooms}</span>
                <span className={styles.occLabel}>Full</span>
                <span className={`${styles.dot} ${styles.full}`}></span>
              </div>
            </div>
          </div>

          <div className={styles.topCardHalf}>
            <div className={styles.cardTitle}>Beds</div>
            <div className={styles.bedsContent}>
              <div className={styles.bedsLeft}>
                <div className={styles.bedsIconSquare}>
                  <BedDouble size={24} strokeWidth={2} />
                </div>
                <div className={styles.bedsNumberWrapper}>
                  <span className={styles.bedsNumber}>{totalBeds}</span>
                </div>
              </div>
              <div className={`${styles.circularProgress} ${styles.progressGreen}`}>
                <div className={styles.progressContainer}>
                  <svg viewBox="0 0 64 64" className={styles.svgCircle}>
                    <circle cx="32" cy="32" r="28" className={styles.svgCircleBg} />
                    <circle cx="32" cy="32" r="28" className={styles.svgCirclePath}
                      style={{ strokeDasharray: 2 * Math.PI * 28, strokeDashoffset: 2 * Math.PI * 28 * (1 - (occupiedBeds / (totalBeds || 1))) }} />
                  </svg>
                  <div className={styles.progressTextWrapper}>
                    <span className={styles.progressPercent}>{Math.round((occupiedBeds / (totalBeds || 1)) * 100)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
            if (searchQuery && !r.num.toString().includes(searchQuery)) return false;

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

                <AnimatePresence>
                  {openFloors[floor.floor] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className={styles.roomList}>
                        {floor.rooms.map((room: any) => {
                          const occPct = room.beds > 0 ? Math.round((room.occ / room.beds) * 100) : 0;
                          return (
                            <motion.div
                              key={room.roomId}
                              className={styles.roomCard}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => toggleRoom(room.roomId)}
                            >
                              <div className={`${styles.roomBorder} ${styles[room.status]}`}></div>
                              <div className={styles.roomContent}>
                                <div className={styles.col1}>
                                  <h3 className={styles.roomNumber}>{room.num}</h3>
                                  <span className={`${styles.statusBadge} ${styles[room.status]}`}>
                                    {room.status === 'occupied' ? 'FULL' : room.status === 'available' ? 'VACANT' : room.status.toUpperCase()}
                                  </span>
                                </div>

                                <div className={styles.col2}>
                                  <div className={styles.bedsInfo}>
                                    <BedDouble size={16} color="#64748b" />
                                    {room.occ} / {room.beds} Beds
                                  </div>
                                  <div className={styles.progressBar}>
                                    <div
                                      className={`${styles.progressFill} ${styles[room.status]}`}
                                      style={{ width: `${Math.max(occPct, 5)}%` }}
                                    ></div>
                                  </div>
                                  <div className={styles.occText}>{occPct}% Occupied</div>
                                </div>

                                <div className={styles.col3}>
                                  <div
                                    className={styles.addTenantBtn}
                                    style={{
                                      opacity: room.status === 'occupied' ? 0.3 : 1,
                                      cursor: room.status === 'occupied' ? 'not-allowed' : 'pointer'
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (room.status === 'occupied') {
                                        alert('This room is fully occupied. Cannot add more tenants.');
                                        return;
                                      }
                                      router.push(`/pgowner/tenants?add=true&roomId=${room.roomId}&returnUrl=/pgowner/rooms`);
                                    }}
                                  >
                                    <Plus size={16} strokeWidth={3} />
                                  </div>
                                </div>
                              </div>

                              <AnimatePresence>
                                {expandedRooms[room.roomId] && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    style={{ overflow: 'hidden' }}
                                  >
                                    <div className={styles.expandedSection}>
                                      {room.tenants && room.tenants.length > 0 ? (
                                        room.tenants.map((t: any) => (
                                          <div key={t.id} className={styles.tenantItem}>
                                            <div className={styles.tenantInfo}>
                                              <span className={styles.tenantName}>{t.name}</span>
                                              <span className={styles.tenantFees}>
                                                Fee: ₹{t.fee} | Deposit: ₹{t.securityDeposit}
                                              </span>
                                            </div>
                                            <span className={styles.tenantFeeHighlight}>
                                              {t.extraFee > 0 ? `+₹${t.extraFee}` : '-'}
                                            </span>
                                            <button
                                              className={styles.editRoomBtn}
                                              style={{ padding: '4px 8px', fontSize: '0.75rem', marginTop: 0 }}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenChargeModal(t);
                                              }}
                                            >
                                              Manage Charges
                                            </button>
                                          </div>
                                        ))
                                      ) : (
                                        <div style={{ padding: '8px 0', color: '#64748b', fontSize: '0.8rem', textAlign: 'center' }}>No tenants in this room.</div>
                                      )}

                                      <div className={styles.roomExtraFeeRow}>
                                        <span>Room Extra Fee</span>
                                        <span className={styles.roomExtraFeeVal}>₹{room.extraFee}</span>
                                      </div>

                                      <button
                                        className={styles.editRoomBtn}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenModal(room);
                                        }}
                                      >
                                        <Edit size={16} /> Edit Room
                                      </button>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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

                <div className={styles.inputGroup}>
                  <label>Extra Room Fee (₹)</label>
                  <input
                    type="number"
                    className={styles.styledInput}
                    value={editFee}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '') setEditFee('');
                      else setEditFee(parseInt(val));
                    }}
                    min="0"
                  />
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
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <button
                    style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: chargeType === 'constant' ? '#3b82f6' : '#fff', color: chargeType === 'constant' ? '#fff' : '#475569', fontWeight: 600, cursor: 'pointer' }}
                    onClick={() => setChargeType('constant')}
                  >
                    Constant Fee
                  </button>
                  <button
                    style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: chargeType === 'onetime' ? '#3b82f6' : '#fff', color: chargeType === 'onetime' ? '#fff' : '#475569', fontWeight: 600, cursor: 'pointer' }}
                    onClick={() => setChargeType('onetime')}
                  >
                    One-Time
                  </button>
                </div>

                <div className={styles.inputGroup}>
                  <label>Amount (₹)</label>
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
                    {chargeType === 'constant' ? 'Added to rent every month. Set 0 to remove.' : 'Added once to the current pending bill.'}
                  </span>
                </div>

                {chargeType === 'onetime' && (
                  <div className={styles.inputGroup} style={{ marginTop: '12px' }}>
                    <label>Description</label>
                    <input
                      type="text"
                      className={styles.styledInput}
                      placeholder="e.g. Electricity Bill - Aug"
                      value={chargeDesc}
                      onChange={e => setChargeDesc(e.target.value)}
                    />
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
  );
}
