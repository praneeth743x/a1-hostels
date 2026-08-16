"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from '@/app/pgowner/luxury.module.css';
import { IndianRupee, BedDouble } from 'lucide-react';

interface Room {
  num: string;
  status: 'available' | 'occupied' | 'partial';
  occ: number;
  beds: number;
  tenantName?: string;
  rent?: number;
  dueDate?: string;
}

interface FloorData {
  floor: string;
  rooms: Room[];
}

export const LuxuryBuildingMap = ({ roomData, hostels }: { roomData: FloorData[], hostels: any[] }) => {
  const [activeFloor, setActiveFloor] = useState<string>('all');
  
  // Coordinates for balconies in the sample image to absolute position the room badges
  // Format: [x%, y%]
  const balconyPositions: Record<number, Record<number, [number, number]>> = {
    0: { 0: [40, 25], 1: [75, 25] }, // Floor 4 (Top)
    1: { 0: [40, 45], 1: [75, 45] }, // Floor 3
    2: { 0: [40, 65], 1: [75, 65] }, // Floor 2
    3: { 0: [40, 85], 1: [75, 85] }  // Floor 1 (Bottom)
  };

  const floors = roomData?.length ? roomData : [
    { floor: 'Floor 4', rooms: [{ num: '401', status: 'occupied', occ: 2, beds: 2 }, { num: '402', status: 'occupied', occ: 2, beds: 2 }] },
    { floor: 'Floor 3', rooms: [{ num: '301', status: 'partial', occ: 1, beds: 2 }, { num: '302', status: 'occupied', occ: 2, beds: 2 }] },
    { floor: 'Floor 2', rooms: [{ num: '201', status: 'available', occ: 0, beds: 2 }, { num: '202', status: 'occupied', occ: 2, beds: 2 }] },
    { floor: 'Floor 1', rooms: [{ num: '101', status: 'occupied', occ: 2, beds: 2 }, { num: '102', status: 'available', occ: 0, beds: 2 }] },
  ] as FloorData[];

  return (
    <div className={styles.masterMapCard}>
      <div className={styles.mapHeader}>
        <div>
          <h2 className={styles.mapTitle}>{hostels?.[0]?.name || 'Raliving Elite Residency'}</h2>
          <span className={styles.mapSubtitle}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            123, Green Avenue, Koramangala, Bangalore
          </span>
        </div>
        <div className={styles.mapActions}>
          <button className={styles.btnSecondary}>
            <IndianRupee size={16} /> View Analytics
          </button>
          <button className={styles.btnPrimary}>
            Add New Room
          </button>
        </div>
      </div>

      <div className={styles.viewerContainer}>
        {/* Luxury Real Estate Image */}
        <img 
          src="https://images.unsplash.com/photo-1613490900233-141c5560d75d?auto=format&fit=crop&w=1200&q=80" 
          alt="Luxury Building" 
          className={styles.viewerImage}
        />

        {/* Floor Navigation Overlay */}
        <div className={styles.floorSelector}>
          {floors.map((floor) => (
             <button 
                key={floor.floor}
                className={`${styles.floorBtn} ${activeFloor === floor.floor ? styles.active : ''}`}
                onClick={() => setActiveFloor(floor.floor)}
             >
                {floor.floor} {activeFloor === floor.floor ? '›' : ''}
             </button>
          ))}
          <button 
             className={`${styles.floorBtn} ${activeFloor === 'all' ? styles.active : ''}`}
             onClick={() => setActiveFloor('all')}
          >
             All Floors {activeFloor === 'all' ? '›' : ''}
          </button>
        </div>

        {/* Absolute positioned room badges over balconies */}
        <AnimatePresence>
          {floors.map((floor, floorIndex) => {
            if (activeFloor !== 'all' && activeFloor !== floor.floor) return null;
            
            return floor.rooms.map((room, roomIndex) => {
              // Ensure we have a valid position mapping, otherwise fallback to center
              const position = balconyPositions[floorIndex]?.[roomIndex] || [50 + (roomIndex * 15), 25 + (floorIndex * 20)];
              const color = room.status === 'occupied' ? 'var(--lx-text-main)' : room.status === 'available' ? 'var(--lx-green)' : 'var(--lx-orange)';

              return (
                <motion.div 
                  key={room.num}
                  className={styles.roomBadgeOverlay}
                  style={{ left: `${position[0]}%`, top: `${position[1]}%` }}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  whileHover={{ scale: 1.1, zIndex: 100 }}
                >
                  <span className={styles.badgeNum} style={{ color }}>{room.num}</span>
                  <span className={styles.badgeBeds}>
                    <BedDouble size={12} color="var(--lx-green)" /> {room.occ}/{room.beds} Beds
                  </span>
                </motion.div>
              );
            });
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
