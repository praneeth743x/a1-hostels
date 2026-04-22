"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Camera, X } from 'lucide-react';
import { FloatingInput } from '@/components/FloatingInput';
import { AnimatedButton } from '@/components/AnimatedButton';
import styles from '../pgowner.module.css';

const MOCK_TENANTS = [
  { id: 'T1', name: 'Rahul Sharma', room: '101', phone: '+91 9876543210', status: 'Active' },
  { id: 'T2', name: 'Vikram Singh', room: '102', phone: '+91 8765432109', status: 'Active' },
  { id: 'T3', name: 'Arun Kumar', room: 'G2', phone: '+91 7654321098', status: 'Notice Period' },
];

export default function TenantDirectory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);

  return (
    <div className={styles.dashboardPage}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Tenant Directory</h1>
          <p className={styles.pageSubtitle}>Manage your residents</p>
        </div>
        <div className={styles.headerActions}>
          <button 
            className={styles.addTenantBtn}
            onClick={() => setShowModal(true)}
          >
            <Plus size={18} /> Add Tenant
          </button>
        </div>
      </header>

      <div className={`${styles.tableContainer} glass-card`}>
        <div className={styles.tableHeaderActions}>
          <div className={styles.searchBar}>
            <Search size={18} className={`${styles.searchIcon} text-muted`} />
            <input 
              type="text" 
              placeholder="Search tenants..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.adminTable}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Room No</th>
                <th>Phone</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_TENANTS.map((t, index) => (
                <motion.tr 
                  key={t.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <td className="font-semibold">{t.name}</td>
                  <td>{t.room}</td>
                  <td>{t.phone}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${t.status === 'Active' ? styles.paymentPaid : styles.paymentPending}`}>
                      {t.status}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <div className={styles.modalOverlay}>
            <motion.div 
              className={styles.modalContent}
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
            >
              <div className={styles.modalHeader}>
                <h2>Add New Tenant</h2>
                <button className={styles.closeBtn} onClick={() => setShowModal(false)}>
                  <X size={24} />
                </button>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.cameraCaptureArea}>
                  <Camera size={48} />
                  <span>Click to scan Aadhar Card</span>
                </div>
                
                <form className={styles.formSection}>
                  <FloatingInput label="Full Name" />
                  <FloatingInput label="Phone Number" />
                  
                  <div className={styles.formGrid}>
                    <FloatingInput label="Room Allocation" />
                    <FloatingInput label="Move-in Date" type="date" />
                  </div>
                </form>
              </div>
              <div className={styles.modalFooter}>
                <AnimatedButton onClick={() => setShowModal(false)}>
                  Save Tenant Profile
                </AnimatedButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
