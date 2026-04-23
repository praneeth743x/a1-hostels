"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Power, PowerOff, Search, Plus, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { FloatingInput } from '@/components/FloatingInput';
import { AnimatedButton } from '@/components/AnimatedButton';
import { registerNewPGHostel, getOwners } from '@/app/actions/superadmin';
import { useRouter } from 'next/navigation';
import styles from '../superadmin.module.css';

interface OwnerData {
  id: string;
  name: string;
  hostels: number;
  tenants: number;
  status: string;
  payment: string;
}

export default function OwnerManagement() {
  const [owners, setOwners] = useState<OwnerData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();
  
  // Registration Form State
  const [regName, setRegName] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regLocation, setRegLocation] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    async function fetchOwners() {
      try {
        const res = await getOwners();
        if (res.success && res.data) {
          setOwners(res.data);
        }
      } catch (err) {
        console.error("Error fetching owners:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchOwners();
  }, []);

  const toggleStatus = async (id: string) => {
    // Optimistic UI update
    const ownerToToggle = owners.find(o => o.id === id);
    if (!ownerToToggle) return;
    
    const newStatus = ownerToToggle.status === 'active' ? 'disabled' : 'active';
    const isNowActive = newStatus === 'active';
    
    setOwners(owners.map(owner => {
      if (owner.id === id) {
        return { ...owner, status: newStatus };
      }
      return owner;
    }));

    // Actual DB update
    try {
      await supabase
        .from('properties')
        .update({ is_active: isNowActive })
        .eq('owner_id', id);
      
      router.refresh(); // Invalidate Next.js Client Router Cache
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  const filteredOwners = owners.filter(o => o.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleRegisterPG = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegistering(true);
    try {
      const res = await registerNewPGHostel({
        name: regName,
        mobile: regMobile,
        location: regLocation
      });

      if (!res.success) throw new Error(res.error);

      // Fetch true state from backend
      const freshData = await getOwners();
      if (freshData.success && freshData.data) {
        setOwners(freshData.data);
      }
      
      router.refresh();

      setIsRegistering(false);
      setShowModal(false);
      // Reset form
      setRegName(''); setRegMobile(''); setRegLocation('');
    } catch (err: any) {
      console.error(err);
      alert("Failed to add PG: " + err.message);
      setIsRegistering(false);
    }
  };

  return (
    <div className={styles.dashboardPage}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>PG Owners</h1>
          <p className={styles.pageSubtitle}>Manage access and billing for all property owners</p>
        </div>
        <div>
          <button 
            className={styles.addTenantBtn} // Reusing the button style from pgowner
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '10px 16px', borderRadius: '8px', backgroundColor: 'var(--primary-indigo)', color: 'white', fontWeight: 600, border: 'none', cursor: 'pointer' }}
            onClick={() => setShowModal(true)}
          >
            <Plus size={18} /> Register New PG
          </button>
        </div>
      </header>

      <div className={`${styles.tableContainer} glass-card`}>
        <div className={styles.tableHeaderActions}>
          <div className={styles.searchBar}>
            <Search size={18} className={`${styles.searchIcon} text-muted`} />
            <input 
              type="text" 
              placeholder="Search owners..." 
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
                <th>Owner Name</th>
                <th>Properties</th>
                <th>Total Tenants</th>
                <th>SaaS Payment</th>
                <th>Kill Switch</th>
              </tr>
            </thead>
            <tbody>
              {filteredOwners.map((owner, index) => (
                <motion.tr 
                  key={owner.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <td className="font-semibold">{owner.name}</td>
                  <td>{owner.hostels}</td>
                  <td>{owner.tenants}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${styles[`payment${owner.payment}`]}`}>
                      {owner.payment}
                    </span>
                  </td>
                  <td>
                    <button 
                      className={`${styles.killSwitch} ${styles[owner.status]}`}
                      onClick={() => toggleStatus(owner.id)}
                      title={owner.status === 'active' ? 'Disable Access' : 'Enable Access'}
                    >
                      {owner.status === 'active' ? <Power size={18} /> : <PowerOff size={18} />}
                      <span>{owner.status === 'active' ? 'Active' : 'Disabled'}</span>
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {filteredOwners.length === 0 && !isLoading && (
            <div className={`${styles.emptyState} text-muted`}>No owners found matching your search.</div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <div className={styles.modalOverlay} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
            <motion.div 
              className={styles.modalContent}
              style={{ width: '100%', maxWidth: '500px', backgroundColor: 'var(--bg-white)', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
            >
              <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Register New PG Hostel</h2>
                <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  <X size={24} />
                </button>
              </div>
              
              <div style={{ padding: '1.5rem', overflowY: 'auto', maxHeight: '70vh' }}>
                <form id="register-pg-form" onSubmit={handleRegisterPG} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <FloatingInput 
                    label="PG Owner Name" 
                    value={regName} 
                    onChange={e => setRegName(e.target.value)} 
                    required 
                  />
                  <FloatingInput 
                    label="Mobile Number" 
                    type="tel" 
                    value={regMobile} 
                    onChange={e => setRegMobile(e.target.value)} 
                    required 
                  />
                  <FloatingInput 
                    label="Hostel Map Location (URL or Address)" 
                    value={regLocation} 
                    onChange={e => setRegLocation(e.target.value)} 
                    required 
                  />
                </form>
              </div>
              
              <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end' }}>
                <AnimatedButton type="submit" form="register-pg-form" isLoading={isRegistering}>
                  Complete Registration
                </AnimatedButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
