"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building, Image as ImageIcon, Plus, MapPin, X, Settings, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { FloatingInput } from '@/components/FloatingInput';
import { AnimatedButton } from '@/components/AnimatedButton';
import { addSubHostel, getProperties, deleteProperty, updateProperty } from '@/app/actions/pgowner';
import { useRouter } from 'next/navigation';
import styles from '../pgowner.module.css';

export default function PropertiesManager() {
  const [properties, setProperties] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [step, setStep] = useState(1);
  const [hostelData, setHostelData] = useState({ name: '', address: '' });
  const [floorsCount, setFloorsCount] = useState(1);
  const [roomsPerFloor, setRoomsPerFloor] = useState<Record<number, number>>({ 1: 2 });
  const [roomShares, setRoomShares] = useState<Record<string, number>>({});
  const [pricing, setPricing] = useState<Record<number, string>>({ 1: '12000', 2: '8000', 3: '6500', 4: '5000', 5: '4500' });
  const [isSaving, setIsSaving] = useState(false);
  
  // Settings State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editPropId, setEditPropId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ name: '', address: '' });
  
  const router = useRouter();

  useEffect(() => {
    async function fetchProps() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const res = await getProperties(user.id);
        if (res.success && res.data) {
          setProperties(res.data);
        }
      }
      setIsLoading(false);
    }
    fetchProps();
  }, []);

  const handleAddSubHostel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      setStep(step + 1);
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const roomsToInsert = [];
      for (let f = 1; f <= floorsCount; f++) {
         const rCount = roomsPerFloor[f] || 1;
         for (let r = 1; r <= rCount; r++) {
           const roomNum = `${f}0${r}`;
           roomsToInsert.push({ floor: `Floor ${f}`, roomNum, beds: roomShares[roomNum] || 2 });
         }
      }

      if (editPropId) {
        const res = await updateProperty(editPropId, hostelData.name, hostelData.address, roomsToInsert, pricing);
        if (!res.success) throw new Error(res.error);
      } else {
        const res = await addSubHostel(user.id, hostelData.name, hostelData.address, roomsToInsert, pricing);
        if (!res.success) throw new Error(res.error);
      }
      
      // Fetch fresh list from database to ensure absolute sync
      const freshProps = await getProperties(user.id);
      if (freshProps.success && freshProps.data) {
        setProperties(freshProps.data);
      }
      
      router.refresh();
      
      // Reset Modal
      setShowAddModal(false);
      setStep(1);
      setEditPropId(null);
      setHostelData({ name: '', address: '' });
      setFloorsCount(1);
      setRoomsPerFloor({ 1: 2 });
      setRoomShares({});
    } catch (err: any) {
      alert("Failed to save hostel: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProperty = async (pgId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you absolutely sure? This will delete the hostel, ALL rooms, and ALL tenants inside it forever!")) return;
    
    try {
      const res = await deleteProperty(pgId);
      if (!res.success) throw new Error(res.error);
      
      setProperties(properties.filter(p => p.pg_id !== pgId));
      router.refresh();
    } catch (err: any) {
      alert("Failed to delete property: " + err.message);
    }
  };

  const openSettings = (prop: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditPropId(prop.pg_id);
    setHostelData({ name: prop.name, address: prop.address });
    
    // Try to parse existing pricing
    try {
      if (prop.theme_primary_color) {
        const parsed = JSON.parse(prop.theme_primary_color);
        if (parsed && typeof parsed === 'object') {
          setPricing(parsed);
        }
      }
    } catch (e) {}

    setStep(1);
    setShowAddModal(true);
  };

  const generateRoomInputs = () => {
    const inputs = [];
    for (let f = 1; f <= floorsCount; f++) {
       inputs.push(<h4 key={`f-${f}`} style={{ marginTop: '1rem', marginBottom: '0.5rem', fontWeight: 600 }}>Floor {f}</h4>);
       const floorRooms = [];
       const rCount = roomsPerFloor[f] || 1;
       for (let r = 1; r <= rCount; r++) {
         const roomNum = `${f}0${r}`;
         floorRooms.push(
           <div key={roomNum} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
             <span style={{ width: '60px', fontWeight: 500 }}>{roomNum}</span>
             <select 
               style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)' }}
               value={roomShares[roomNum] || 2}
               onChange={(e) => setRoomShares({...roomShares, [roomNum]: parseInt(e.target.value)})}
             >
               {[1, 2, 3, 4, 5, 6].map(num => (
                 <option key={num} value={num}>{num} Share</option>
               ))}
             </select>
           </div>
         );
       }
       inputs.push(<div key={`fg-${f}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>{floorRooms}</div>);
    }
    return inputs;
  };

  const handleMockImageUpload = (pgId: string) => {
    // In a real app, this would trigger a file picker and upload to Supabase Storage bucket.
    alert("In production, this will open the camera/gallery and securely upload the image to the Supabase Storage bucket.");
  };

  return (
    <div className={styles.dashboardPage}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>My Hostels</h1>
          <p className={styles.pageSubtitle}>Manage your properties and gallery</p>
        </div>
        <div className={styles.headerActions}>
          <button 
            className={styles.addTenantBtn}
            onClick={() => {
              setEditPropId(null);
              setHostelData({ name: '', address: '' });
              setStep(1);
              setShowAddModal(true);
            }}
          >
            <Plus size={18} /> Add Sub Hostel
          </button>
        </div>
      </header>

      <div className={styles.propertiesGrid}>
        {isLoading ? (
          <div className="animate-pulse bg-slate-200 h-64 rounded-2xl" style={{ backgroundColor: '#e2e8f0', height: '16rem', borderRadius: '1rem' }}></div>
        ) : properties.length === 0 ? (
          <div className={styles.emptyStateCard}>
            No hostels found. Click "Add Sub Hostel" to create one.
          </div>
        ) : (
          properties.map((prop, i) => (
            <motion.div 
              key={prop.pg_id}
              className={styles.propertyCard}
              onClick={() => router.push(`/pgowner/properties/${prop.pg_id}`)}
              style={{ cursor: 'pointer' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <div className={styles.propertyImageArea}>
                {/* Mock Image Placeholder */}
                <div className={styles.noImagePlaceholder}>
                  <ImageIcon size={40} />
                  <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>No Images Uploaded</span>
                </div>
                
                <button 
                  onClick={(e) => { e.stopPropagation(); handleMockImageUpload(prop.pg_id); }}
                  className={styles.uploadPhotoBtn}
                >
                  <Camera size={16} /> Upload Photo
                </button>
              </div>
              
              <div className={styles.propertyDetails}>
                <div className={styles.propertyHeader}>
                  <div>
                    <h3 className={styles.propertyName}>{prop.name}</h3>
                    <div className={styles.propertyAddress}>
                      <MapPin size={14} />
                      <span className={styles.addressText}>{prop.address || 'No address provided'}</span>
                    </div>
                  </div>
                  <span className={prop.is_active ? styles.activeStatus : styles.inactiveStatus}>
                    {prop.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                  <button 
                    onClick={(e) => openSettings(prop, e)}
                    style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-offwhite)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-main)' }}
                  >
                    <Settings size={14} /> Manage
                  </button>
                  <button 
                    onClick={(e) => handleDeleteProperty(prop.pg_id, e)}
                    style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(244, 67, 54, 0.2)', backgroundColor: 'rgba(244, 67, 54, 0.05)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--danger-red)' }}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <AnimatePresence>
        {showAddModal && (
          <div className={styles.modalOverlay}>
            <motion.div 
              className={styles.modalContent}
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
            >
              <div className={styles.modalHeader}>
                <h2>
                  {step === 1 ? (editPropId ? 'Edit Sub Hostel' : 'Add Sub Hostel') : 
                   step === 2 ? 'Room Configuration' : 'Pricing Configuration'}
                </h2>
                <button className={styles.closeBtn} onClick={() => { setShowAddModal(false); setStep(1); setEditPropId(null); }}>
                  <X size={24} />
                </button>
              </div>
              <div className={styles.modalBody} style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                <form id="add-hostel-form" onSubmit={handleAddSubHostel} className={styles.formSection}>
                  
                  {step === 1 && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                      <FloatingInput 
                        label="Hostel Name" 
                        value={hostelData.name} 
                        onChange={e => setHostelData({...hostelData, name: e.target.value})} 
                        required 
                      />
                      <FloatingInput 
                        label="Address / Location Link" 
                        value={hostelData.address} 
                        onChange={e => setHostelData({...hostelData, address: e.target.value})} 
                        required 
                      />
                      <div style={{ marginTop: '1rem' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Total Floors</label>
                        <input type="number" min="1" max="10" value={floorsCount} onChange={e => {
                          const val = parseInt(e.target.value) || 1;
                          setFloorsCount(val);
                          const newRoomsPerFloor = {...roomsPerFloor};
                          for(let i=1; i<=val; i++) { if(!newRoomsPerFloor[i]) newRoomsPerFloor[i] = 2; }
                          setRoomsPerFloor(newRoomsPerFloor);
                        }} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)' }} required />
                      </div>
                      <div style={{ marginTop: '1rem' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Rooms Per Floor Configuration</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                          {Array.from({length: floorsCount}).map((_, i) => (
                            <div key={`rf-${i+1}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.875rem' }}>Floor {i+1}:</span>
                              <input type="number" min="1" max="50" value={roomsPerFloor[i+1] || 2} onChange={e => setRoomsPerFloor({...roomsPerFloor, [i+1]: parseInt(e.target.value) || 1})} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)' }} required />
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                      <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>Configure the bed sharing capacity for each generated room.</p>
                      {generateRoomInputs()}
                    </motion.div>
                  )}

                  {step === 3 && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                      <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>Set the monthly rent for each share type.</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {[1, 2, 3, 4, 5].map(share => (
                          <div key={`share-${share}`} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <span style={{ width: '80px', fontWeight: 500 }}>{share} Share</span>
                            <div style={{ position: 'relative', flex: 1 }}>
                              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>₹</span>
                              <input 
                                type="number" 
                                value={pricing[share]} 
                                onChange={(e) => setPricing({...pricing, [share]: e.target.value})}
                                placeholder="Rent Amount"
                                style={{ width: '100%', padding: '10px 10px 10px 30px', borderRadius: '8px', border: '1px solid var(--border-light)' }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                  
                </form>
              </div>
              <div className={styles.modalFooter} style={{ display: 'flex', justifyContent: 'space-between' }}>
                {step > 1 ? (
                  <button type="button" onClick={() => setStep(step - 1)} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: 600 }}>Back</button>
                ) : <div></div>}
                <AnimatedButton type="submit" form="add-hostel-form" isLoading={isSaving}>
                  {step < 3 ? 'Next Step' : (editPropId ? 'Save Hostel Changes' : 'Create Hostel & Rooms')}
                </AnimatedButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
// Hack to get Camera icon since it wasn't imported from lucide-react initially
import { Camera } from 'lucide-react';
