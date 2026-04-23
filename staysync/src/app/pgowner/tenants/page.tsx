"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Camera, X } from 'lucide-react';
import { FloatingInput } from '@/components/FloatingInput';
import { AnimatedButton } from '@/components/AnimatedButton';
import { getTenants, addTenant, getPropertiesWithRooms } from '@/app/actions/pgowner';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import styles from '../pgowner.module.css';

export default function TenantDirectory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [tenants, setTenants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const router = useRouter();
  
  // Form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [workStatus, setWorkStatus] = useState('student');
  const [selectedPg, setSelectedPg] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [moveInDate, setMoveInDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setOwnerId(user.id);
        const propsRes = await getPropertiesWithRooms(user.id);
        if (propsRes.success && propsRes.data) {
          setProperties(propsRes.data);
          if (propsRes.data.length > 0) setSelectedPg(propsRes.data[0].pg_id);
        }

        const res = await getTenants(user.id);
        if (res.success && res.data) {
          setTenants(res.data.map((t: any) => ({
            id: t.tenant_id,
            name: t.full_name,
            hostel: t.pg_name,
            room: t.rooms?.room_number || 'N/A',
            phone: t.mobile,
            status: t.is_active ? 'Active' : 'Inactive'
          })));
        }
      }
      setIsLoading(false);
    }
    init();
  }, []);

  const handleAddTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerId || !selectedPg || !selectedRoom) {
      alert("Please select a Hostel and Room.");
      return;
    }
    setIsSaving(true);
    const res = await addTenant({ 
      ownerId, 
      pgId: selectedPg, 
      roomId: selectedRoom, 
      fullName, 
      phone, 
      parentPhone, 
      workStatus, 
      moveInDate 
    });
    
    if (res.success && res.data) {
      const selectedHostelName = properties.find(p => p.pg_id === selectedPg)?.name || '';
      const selectedRoomName = properties.find(p => p.pg_id === selectedPg)?.rooms.find((r:any) => r.room_id === selectedRoom)?.room_number || '';
      
      setTenants([{
        id: res.data[0].tenant_id,
        name: fullName,
        hostel: selectedHostelName,
        room: selectedRoomName,
        phone: phone,
        status: 'Active'
      }, ...tenants]);
      
      setShowModal(false);
      setFullName(''); setPhone(''); setParentPhone(''); setMoveInDate('');
      router.refresh();
    } else {
      alert("Failed to add tenant: " + res.error);
    }
    setIsSaving(false);
  };

  const currentRooms = properties.find(p => p.pg_id === selectedPg)?.rooms || [];

  const filteredTenants = tenants.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));

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
                <th>Hostel</th>
                <th>Room No</th>
                <th>Phone</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredTenants.length === 0 && !isLoading && (
                <tr><td colSpan={4} className="text-center py-4 text-muted">No tenants found</td></tr>
              )}
              {filteredTenants.map((t, index) => (
                <motion.tr 
                  key={t.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <td className="font-semibold">{t.name}</td>
                  <td>{t.hostel}</td>
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
              <div className={styles.modalBody} style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className={styles.cameraCaptureArea} style={{ padding: '20px' }}>
                    <Camera size={32} />
                    <span style={{ fontSize: '0.875rem' }}>Face Picture</span>
                  </div>
                  <div className={styles.cameraCaptureArea} style={{ padding: '20px' }}>
                    <Camera size={32} />
                    <span style={{ fontSize: '0.875rem' }}>Aadhar Card</span>
                  </div>
                </div>
                
                <form id="add-tenant-form" onSubmit={handleAddTenant} className={styles.formSection} style={{ gap: '1rem' }}>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Select Hostel</label>
                      <select 
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)' }}
                        value={selectedPg}
                        onChange={(e) => { setSelectedPg(e.target.value); setSelectedRoom(''); }}
                        required
                      >
                        <option value="">Choose Hostel...</option>
                        {properties.map(p => (
                          <option key={p.pg_id} value={p.pg_id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Allocate Room</label>
                      <select 
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)' }}
                        value={selectedRoom}
                        onChange={(e) => setSelectedRoom(e.target.value)}
                        required
                        disabled={!selectedPg}
                      >
                        <option value="">Choose Room...</option>
                        {currentRooms.map((r: any) => (
                          <option key={r.room_id} value={r.room_id}>{r.room_number} ({r.floor})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <FloatingInput label="Full Name" value={fullName} onChange={e=>setFullName(e.target.value)} required />
                    <FloatingInput label="Move-in Date" type="date" value={moveInDate} onChange={e=>setMoveInDate(e.target.value)} required />
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <FloatingInput label="Phone Number" type="tel" value={phone} onChange={e=>setPhone(e.target.value)} required />
                    <FloatingInput label="Parent Mobile" type="tel" value={parentPhone} onChange={e=>setParentPhone(e.target.value)} required />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Work/Study Status</label>
                    <select 
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)' }}
                      value={workStatus}
                      onChange={(e) => setWorkStatus(e.target.value)}
                      required
                    >
                      <option value="student">Student</option>
                      <option value="employed">Employed</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </form>
              </div>
              <div className={styles.modalFooter}>
                <AnimatedButton type="submit" form="add-tenant-form" isLoading={isSaving}>
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
