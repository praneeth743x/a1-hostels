"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { IndianRupee, AlertCircle, BedDouble } from 'lucide-react';
import styles from './pgowner.module.css';

const ROOM_DATA = [
  { floor: 'Ground Floor', rooms: [
    { num: 'G1', status: 'available', beds: 2, occ: 0 },
    { num: 'G2', status: 'occupied', beds: 3, occ: 3 },
    { num: 'G3', status: 'partial', beds: 4, occ: 2 },
  ]},
  { floor: 'First Floor', rooms: [
    { num: '101', status: 'occupied', beds: 2, occ: 2 },
    { num: '102', status: 'occupied', beds: 2, occ: 2 },
    { num: '103', status: 'available', beds: 3, occ: 0 },
    { num: '104', status: 'partial', beds: 3, occ: 1 },
  ]}
];

export default function PGOwnerDashboard() {
  return (
    <div className={styles.dashboardPage}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Command Center</h1>
          <p className={styles.pageSubtitle}>Balaji Elite PG (Hostel ID: B-001)</p>
        </div>
      </header>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <motion.div 
          className={`${styles.kpiCard} glass-card`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <IndianRupee className={`${styles.kpiIcon} text-indigo`} size={64} />
          <h3 className={styles.kpiLabel}>Rent Collected</h3>
          <div className={`${styles.kpiValue} text-indigo`}>₹1,45,000</div>
          <div className={`${styles.kpiTrend} text-success-green`}>85% of expected this month</div>
        </motion.div>

        <motion.div 
          className={`${styles.kpiCard} glass-card`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <AlertCircle className={`${styles.kpiIcon} text-danger-red`} size={64} />
          <h3 className={styles.kpiLabel}>Overdue Payments</h3>
          <div className={`${styles.kpiValue} text-danger-red`}>₹24,500</div>
          <div className={styles.kpiTrend}>From 4 tenants</div>
        </motion.div>

        <motion.div 
          className={`${styles.kpiCard} glass-card`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <BedDouble className={`${styles.kpiIcon} text-cyan`} size={64} />
          <h3 className={styles.kpiLabel}>Bed Availability</h3>
          <div className={`${styles.kpiValue} text-cyan`}>8 / 45</div>
          <div className={styles.kpiTrend}>Beds empty across 3 rooms</div>
        </motion.div>
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
          {ROOM_DATA.map((floorData, i) => (
            <div key={i} className={styles.floorRow}>
              <h3 className={styles.floorLabel}>{floorData.floor}</h3>
              <div className={styles.roomGrid}>
                {floorData.rooms.map((room, j) => {
                  let statusClass = styles.roomAvailable;
                  if (room.status === 'occupied') statusClass = styles.roomOccupied;
                  if (room.status === 'partial') statusClass = styles.roomPartial;

                  return (
                    <motion.div 
                      key={room.num}
                      className={`${styles.roomCard} ${statusClass}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + (i * 0.1) + (j * 0.05) }}
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
