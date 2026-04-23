"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Users, BedDouble, Building2 } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { getPropertyMap } from '@/app/actions/pgowner';
import styles from '../../pgowner.module.css';

export default function PropertyVisualMap() {
  const router = useRouter();
  const params = useParams();
  const pgId = params.pgId as string;
  
  const [isLoading, setIsLoading] = useState(true);
  const [propertyInfo, setPropertyInfo] = useState<any>(null);
  const [roomData, setRoomData] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalRooms: 0, totalBeds: 0, occupiedBeds: 0 });

  useEffect(() => {
    async function fetchPropertyMap() {
      if (!pgId) return;
      try {
        const res = await getPropertyMap(pgId);
        if (!res.success || !res.data) throw new Error(res.error);
        
        const { property, rooms, tenants } = res.data;
        setPropertyInfo(property);

        // Aggregate Room Map Data
        const floorMap: Record<string, any[]> = {};
        let tRooms = 0;
        let tBeds = 0;
        let oBeds = tenants?.length || 0;

        if (rooms) {
          rooms.forEach(room => {
            tRooms++;
            tBeds += room.total_beds;
            
            const tenantsInRoom = tenants?.filter(t => t.room_id === room.room_id) || [];
            
            let status = 'available';
            if (tenantsInRoom.length >= room.total_beds) status = 'occupied';
            else if (tenantsInRoom.length > 0) status = 'partial';
            
            if (!floorMap[room.floor]) floorMap[room.floor] = [];
            floorMap[room.floor].push({
              num: room.room_number,
              status,
              beds: room.total_beds,
              occ: tenantsInRoom.length,
              tenantNames: tenantsInRoom.map(t => t.full_name)
            });
          });
        }

        const formattedRoomData = Object.keys(floorMap).map(floor => ({
          floor,
          rooms: floorMap[floor].sort((a, b) => a.num.localeCompare(b.num))
        }));

        setStats({ totalRooms: tRooms, totalBeds: tBeds, occupiedBeds: oBeds });
        setRoomData(formattedRoomData);
      } catch (e) {
        console.error("Error fetching map:", e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchPropertyMap();
  }, [pgId]);

  return (
    <div className={styles.dashboardPage}>
      <header className={styles.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            onClick={() => router.push('/pgowner/properties')}
            style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-white)', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className={styles.pageTitle}>{propertyInfo?.name || 'Loading Map...'}</h1>
            <p className={styles.pageSubtitle}>Interactive Visual Layout & Live Occupancy</p>
          </div>
        </div>
      </header>

      {/* Mini Stats Banner */}
      <motion.div 
        className="glass-card" 
        style={{ display: 'flex', gap: '3rem', padding: '1.5rem 2rem', borderRadius: '1rem' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: 'rgba(63, 81, 181, 0.1)', color: 'var(--primary-indigo)' }}>
            <Building2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL ROOMS</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.totalRooms}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: 'rgba(0, 209, 255, 0.1)', color: 'var(--secondary-cyan-dark)' }}>
            <BedDouble size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL BEDS</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.totalBeds}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: 'rgba(76, 175, 80, 0.1)', color: 'var(--success-green)' }}>
            <Users size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>CURRENT TENANTS</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.occupiedBeds}</div>
          </div>
        </div>
      </motion.div>

      {/* Massive Visual Room Map */}
      <motion.div 
        className={`${styles.roomMapSection} glass-card`}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        style={{ minHeight: '600px' }}
      >
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Floor Layouts</h2>
          <div className={styles.roomLegend}>
            <div className={styles.legendItem}>
              <div className={`${styles.legendDot} ${styles.dotAvailable}`}></div> Available
            </div>
            <div className={styles.legendItem}>
              <div className={`${styles.legendDot} ${styles.dotPartial}`}></div> Partially Filled
            </div>
            <div className={styles.legendItem}>
              <div className={`${styles.legendDot} ${styles.dotOccupied}`}></div> Full
            </div>
          </div>
        </div>

        <div className={styles.floorPlan}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading architectural map...</div>
          ) : roomData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No rooms generated for this property yet.</div>
          ) : (
            roomData.map((floorData, i) => (
              <motion.div 
                key={i} 
                className={styles.floorRow}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + (i * 0.1) }}
                style={{ padding: '1.5rem', backgroundColor: 'var(--bg-offwhite)', borderRadius: '1rem', border: '1px solid var(--border-light)' }}
              >
                <h3 className={styles.floorLabel} style={{ fontSize: '1.25rem', paddingBottom: '1rem', borderBottom: '2px solid rgba(0,0,0,0.05)' }}>
                  {floorData.floor}
                </h3>
                <div className={styles.roomGrid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', marginTop: '1.5rem' }}>
                  {floorData.rooms.map((room: any, j: number) => {
                    let statusClass = styles.roomAvailable;
                    if (room.status === 'occupied') statusClass = styles.roomOccupied;
                    if (room.status === 'partial') statusClass = styles.roomPartial;

                    return (
                      <motion.div 
                        key={room.num}
                        className={`${styles.roomCard} ${statusClass}`}
                        whileHover={{ scale: 1.05, y: -5 }}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', delay: 0.1 + (i * 0.1) + (j * 0.05) }}
                        style={{ padding: '1.5rem', minHeight: '140px', justifyContent: 'center' }}
                      >
                        <span className={styles.roomNumber} style={{ fontSize: '1.75rem' }}>{room.num}</span>
                        <span className={styles.roomStatus} style={{ marginTop: '0.5rem', marginBottom: '1rem', padding: '4px 12px' }}>{room.status}</span>
                        
                        <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(room.occ / room.beds) * 100}%`, backgroundColor: room.status === 'available' ? 'var(--success-green)' : room.status === 'occupied' ? 'var(--danger-red)' : '#F57C00' }}></div>
                        </div>
                        <span className="text-muted text-sm" style={{ marginTop: '0.5rem', fontWeight: 600 }}>{room.occ} / {room.beds} Beds Filled</span>
                      </motion.div>
                    )
                  })}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
