"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IndianRupee, AlertCircle, BedDouble } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSearchParams } from 'next/navigation';
import styles from './pgowner.module.css';

export default function PGOwnerDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [kpi, setKpi] = useState({ collected: 0, overdue: 0, overdueCount: 0, bedsAvailable: 0, totalBeds: 0, availableRooms: 0 });
  const [roomData, setRoomData] = useState<any[]>([]);
  const [dashboardTitle, setDashboardTitle] = useState('Overview of all your managed hostels');
  const searchParams = useSearchParams();
  const selectedPgId = searchParams.get('pg_id');

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch properties for this owner
        let query = supabase.from('properties').select('pg_id, name').eq('owner_id', user.id);
        if (selectedPgId) {
          query = query.eq('pg_id', selectedPgId);
        }
        
        const { data: properties } = await query;
        
        if (!properties || properties.length === 0) {
          setKpi({ collected: 0, overdue: 0, overdueCount: 0, bedsAvailable: 0, totalBeds: 0, availableRooms: 0 });
          setRoomData([]);
          return;
        }

        if (selectedPgId && properties.length > 0) {
          setDashboardTitle(`${properties[0].name} (Hostel ID: ${selectedPgId.split('-')[0]})`);
        } else {
          setDashboardTitle('Overview of all your managed hostels');
        }

        const pgIds = properties.map(p => p.pg_id);

        // Fetch Rooms
        const { data: rooms } = await supabase.from('rooms').select('*').in('pg_id', pgIds);
        
        // Fetch Tenants
        const { data: tenants } = await supabase.from('tenants').select('tenant_id, room_id').in('pg_id', pgIds).eq('is_active', true);
        
        // Fetch Payments
        const { data: payments } = await supabase.from('payments').select('amount, status').in('pg_id', pgIds);

        // Calculate KPIs
        let totalBeds = 0;
        let occupiedBeds = tenants?.length || 0;
        let availableRoomsCount = 0;

        // Aggregate Room Map Data
        const floorMap: Record<string, any[]> = {};

        if (rooms) {
          rooms.forEach(room => {
            totalBeds += room.total_beds;
            const tenantsInRoom = tenants?.filter(t => t.room_id === room.room_id).length || 0;
            
            let status = 'available';
            if (tenantsInRoom >= room.total_beds) status = 'occupied';
            else if (tenantsInRoom > 0) status = 'partial';
            
            if (status === 'available') availableRoomsCount++;

            if (!floorMap[room.floor]) floorMap[room.floor] = [];
            floorMap[room.floor].push({
              num: room.room_number,
              status,
              beds: room.total_beds,
              occ: tenantsInRoom
            });
          });
        }

        const formattedRoomData = Object.keys(floorMap).map(floor => ({
          floor,
          rooms: floorMap[floor].sort((a, b) => a.num.localeCompare(b.num))
        }));

        let collected = 0;
        let overdue = 0;
        let overdueCount = 0;

        if (payments) {
          payments.forEach(p => {
            if (p.status === 'paid') collected += p.amount;
            else if (p.status === 'pending' || p.status === 'overdue') {
              overdue += p.amount;
              overdueCount++;
            }
          });
        }

        setKpi({
          collected,
          overdue,
          overdueCount,
          bedsAvailable: totalBeds - occupiedBeds,
          totalBeds,
          availableRooms: availableRoomsCount
        });

        setRoomData(formattedRoomData);
        
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);
  return (
    <div className={styles.dashboardPage}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Command Center</h1>
          <p className={styles.pageSubtitle}>{dashboardTitle}</p>
        </div>
      </header>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <AnimatePresence mode="wait">
          {isLoading ? (
            // SKELETON SCREENS
            <>
              {[1, 2, 3].map((item) => (
                <motion.div 
                  key={`skeleton-${item}`}
                  className={`${styles.kpiCard} glass-card`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{ background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }}
                >
                  <div style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.5)', marginBottom: 16 }}></div>
                  <div style={{ width: '60%', height: 24, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)', marginBottom: 8 }}></div>
                  <div style={{ width: '80%', height: 32, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.6)', marginBottom: 8 }}></div>
                  <div style={{ width: '40%', height: 16, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)' }}></div>
                </motion.div>
              ))}
            </>
          ) : (
            // ACTUAL DATA CARDS
            <>
              <motion.div 
                className={`${styles.kpiCard} glass-card`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <IndianRupee className={`${styles.kpiIcon} text-indigo`} size={64} />
                <h3 className={styles.kpiLabel}>Rent Collected</h3>
                <div className={`${styles.kpiValue} text-indigo`}>₹{kpi.collected.toLocaleString()}</div>
                <div className={`${styles.kpiTrend} text-success-green`}>All time total</div>
              </motion.div>

              <motion.div 
                className={`${styles.kpiCard} glass-card`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <AlertCircle className={`${styles.kpiIcon} text-danger-red`} size={64} />
                <h3 className={styles.kpiLabel}>Overdue Payments</h3>
                <div className={`${styles.kpiValue} text-danger-red`}>₹{kpi.overdue.toLocaleString()}</div>
                <div className={styles.kpiTrend}>From {kpi.overdueCount} tenants</div>
              </motion.div>

              <motion.div 
                className={`${styles.kpiCard} glass-card`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <BedDouble className={`${styles.kpiIcon} text-cyan`} size={64} />
                <h3 className={styles.kpiLabel}>Bed Availability</h3>
                <div className={`${styles.kpiValue} text-cyan`}>{kpi.bedsAvailable} / {kpi.totalBeds}</div>
                <div className={styles.kpiTrend}>Beds empty across {kpi.availableRooms} rooms</div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Room Map */}
      <motion.div 
        className={`${styles.roomMapSection} glass-card`}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Visual Room Map</h2>
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
          {!isLoading && roomData.map((floorData, i) => (
            <div key={i} className={styles.floorRow}>
              <h3 className={styles.floorLabel}>{floorData.floor}</h3>
              <div className={styles.roomGrid}>
                {floorData.rooms.map((room: any, j: number) => {
                  let statusClass = styles.roomAvailable;
                  if (room.status === 'occupied') statusClass = styles.roomOccupied;
                  if (room.status === 'partial') statusClass = styles.roomPartial;

                  return (
                    <motion.div 
                      key={room.num}
                      className={`${styles.roomCard} ${statusClass}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + (i * 0.1) + (j * 0.05) }}
                    >
                      <span className={styles.roomNumber}>{room.num}</span>
                      <span className={styles.roomStatus}>{room.status}</span>
                      <span className="text-muted text-sm">{room.occ}/{room.beds} Beds</span>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
