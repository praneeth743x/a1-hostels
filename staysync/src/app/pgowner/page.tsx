"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Wallet, 
  AlertCircle, 
  BedDouble, 
  Users, 
  Calendar,
  UserPlus, 
  CreditCard, 
  Receipt, 
  BarChart2, 
  BellRing 
} from 'lucide-react';
import styles from './dashboard.module.css';

export default function PGOwnerDashboard() {
  const [timeFilter, setTimeFilter] = useState<'Day' | 'Month' | 'Year'>('Month');
  const [selectedDate, setSelectedDate] = useState<string>('July, 2026');

  // Dynamic values depending on filter selection
  const getPeriodTitle = () => {
    if (timeFilter === 'Day') return 'Daily View';
    if (timeFilter === 'Year') return 'Yearly View';
    return 'Monthly View';
  };

  const getDateDisplayText = () => {
    if (timeFilter === 'Day') return '22 July, 2026';
    if (timeFilter === 'Year') return 'Year 2026';
    return selectedDate;
  };

  return (
    <div className={styles.dashboardContainer}>
      <div className={styles.desktopPageHeader}>
        <h1 className={styles.desktopPageTitle}>Command Center</h1>
        <p className={styles.desktopPageSubtitle}>Overview of all your managed hostels</p>
      </div>

      <div className={styles.contentArea}>
        {/* 1. Day / Month / Year Segmented Control */}
        <div className={styles.filterSegmentContainer}>
          {(['Day', 'Month', 'Year'] as const).map((filter) => (
            <button
              key={filter}
              className={`${styles.segmentBtn} ${timeFilter === filter ? styles.segmentBtnActive : ''}`}
              onClick={() => {
                setTimeFilter(filter);
              }}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* 2. Date Picker Selector */}
        <div className={styles.dateSelectorBox}>
          <span className={styles.dateSelectorText}>{getDateDisplayText()}</span>
          <Calendar size={18} className={styles.dateIcon} />
        </div>

        {/* 3. 2x2 Grid of Dashboard Cards (Matching Screenshot 1) */}
        <div className={styles.dashboardGrid}>
          {/* Card 1: Monthly View / Collected Rent */}
          <motion.div 
            className={styles.statCard}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
          >
            <div>
              <div className={styles.cardHeader}>
                <div className={`${styles.iconBadge} ${styles.iconBadgeGreen}`}>
                  <Wallet size={20} />
                </div>
                <span className={styles.cardTitle}>{getPeriodTitle()}</span>
              </div>
              <div className={styles.mainValueDark}>₹40,099</div>
              <div className={styles.subLabel}>Collected Rent</div>
              <div className={styles.progressBarTrack}>
                <div className={styles.progressBarFillGreen} style={{ width: '53%' }} />
              </div>
            </div>

            <div className={styles.cardBottomRow}>
              <div className={styles.bottomCol}>
                <span className={styles.bottomLabel}>Expected</span>
                <span className={styles.bottomValue}>₹75,599</span>
              </div>
              <div className={styles.bottomColRight}>
                <span className={styles.bottomLabel}>Collection Rate</span>
                <span className={styles.bottomValueGreen}>53%</span>
              </div>
            </div>
          </motion.div>

          {/* Card 2: Outstanding / Pending Rent Payments */}
          <motion.div 
            className={styles.statCard}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <div>
              <div className={styles.cardHeader}>
                <div className={`${styles.iconBadge} ${styles.iconBadgeRed}`}>
                  <AlertCircle size={20} />
                </div>
                <span className={styles.cardTitle}>Outstanding</span>
              </div>
              <div className={styles.mainValueRed}>₹35,500</div>
              <div className={styles.subLabel}>Pending Rent Payments</div>
            </div>

            <div>
              <div className={styles.cardDivider} />
              <div className={styles.cardBottomRow}>
                <div className={styles.bottomCol}>
                  <span className={styles.bottomLabel}>Defaulters</span>
                  <span className={styles.bottomValueRed}>4 Tenants</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Card 3: Capacity / Live Occupancy Rate */}
          <motion.div 
            className={styles.statCard}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            <div>
              <div className={styles.cardHeader}>
                <div className={`${styles.iconBadge} ${styles.iconBadgeBlue}`}>
                  <BedDouble size={20} />
                </div>
                <span className={styles.cardTitle}>Capacity</span>
              </div>
              <div className={styles.mainValueDark}>67%</div>
              <div className={styles.subLabel}>Live Occupancy Rate</div>
              <div className={styles.progressBarTrack}>
                <div className={styles.progressBarFillBlue} style={{ width: '67%' }} />
              </div>
            </div>

            <div className={styles.bedsGrid}>
              <div className={styles.bedPill}>
                <span className={styles.bedPillLabel}>Filled Beds</span>
                <span className={styles.bedPillValueBlue}>6</span>
              </div>
              <div className={styles.bedPill}>
                <span className={styles.bedPillLabel}>Vacant Beds</span>
                <span className={styles.bedPillValueDark}>3</span>
              </div>
            </div>
          </motion.div>

          {/* Card 4: Tenant Base / Total Tenants */}
          <motion.div 
            className={styles.statCard}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <div>
              <div className={styles.cardHeader}>
                <div className={`${styles.iconBadge} ${styles.iconBadgePurple}`}>
                  <Users size={20} />
                </div>
                <span className={styles.cardTitle}>Tenant Base</span>
              </div>
              <div className={styles.mainValueDark}>8</div>
              <div className={styles.subLabel}>Total Tenants (All Time)</div>
            </div>

            <div>
              <div className={styles.cardDivider} />
              <div className={styles.cardBottomRow}>
                <div className={styles.bottomCol}>
                  <span className={styles.bottomLabel}>Currently Active</span>
                  <span className={styles.bottomValueGreen}>6</span>
                </div>
                <div className={styles.bottomColRight}>
                  <span className={styles.bottomLabel}>Inactive / Past</span>
                  <span className={styles.bottomValue}>2</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Quick Actions (Optional Section) */}
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>QUICK ACTIONS</h2>
        </div>

        <div className={styles.quickActionsGrid}>
          <div className={styles.actionCard}>
            <div className={`${styles.actionIconWrapper} ${styles.iconBlue}`}>
              <UserPlus size={22} />
            </div>
            <span className={styles.actionText}>Add Tenant</span>
          </div>

          <div className={styles.actionCard}>
            <div className={`${styles.actionIconWrapper} ${styles.iconGreen}`}>
              <CreditCard size={22} />
            </div>
            <span className={styles.actionText}>Add Payment</span>
          </div>

          <div className={styles.actionCard}>
            <div className={`${styles.actionIconWrapper} ${styles.iconRed}`}>
              <Receipt size={22} />
            </div>
            <span className={styles.actionText}>Add Expense</span>
          </div>

          <div className={styles.actionCard}>
            <div className={`${styles.actionIconWrapper} ${styles.iconPurple}`}>
              <BarChart2 size={22} />
            </div>
            <span className={styles.actionText}>Reports</span>
          </div>

          <div className={styles.actionCard}>
            <div className={`${styles.actionIconWrapper} ${styles.iconYellow}`}>
              <BellRing size={22} />
            </div>
            <span className={styles.actionText}>Send Reminders</span>
          </div>

          <div className={styles.actionCard}>
            <div className={`${styles.actionIconWrapper} ${styles.iconBlueDark}`}>
              <BedDouble size={22} />
            </div>
            <span className={styles.actionText}>Room Management</span>
          </div>
        </div>
      </div>
    </div>
  );
}

