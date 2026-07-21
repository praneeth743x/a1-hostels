"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Phone, Shield, Building, CreditCard, MapPin, Users, Camera, Edit2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { FloatingInput } from '@/components/FloatingInput';
import { AnimatedButton } from '@/components/AnimatedButton';
import { useRouter } from 'next/navigation';
import styles from './profile.module.css';

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/');
        return;
      }

      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setProfile({
        phone: user.phone,
        ...userProfile,
        aadhar: userProfile?.aadhar || 'Not Provided',
        location: userProfile?.location || 'Not Provided',
        parent_details: userProfile?.parent_details || 'Not Provided',
      });
      setEditForm({
        full_name: userProfile?.full_name || '',
        aadhar: userProfile?.aadhar || '',
        location: userProfile?.location || '',
        parent_details: userProfile?.parent_details || ''
      });
      setLoading(false);
    }
    loadProfile();
  }, [router]);

  const handleSave = async () => {
    setIsSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('user_profiles').update({
        full_name: editForm.full_name,
        aadhar: editForm.aadhar,
        location: editForm.location,
        parent_details: editForm.parent_details
      }).eq('id', user.id);
      
      setProfile({ ...profile, ...editForm });
    }
    setIsEditing(false);
    setIsSaving(false);
  };

  const handleLogout = async () => {
    localStorage.clear();
    sessionStorage.clear();
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <div className={styles.profilePage}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>My Profile</h1>
          <p className={styles.pageSubtitle}>Manage your personal information and settings</p>
        </div>
        {profile?.role === 'super_admin' && !isEditing && (
          <button onClick={() => setIsEditing(true)} className={styles.editBtn}>
            <Edit2 size={16} /> Edit Profile
          </button>
        )}
      </header>

      <motion.div 
        className={styles.profileCard}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className={styles.cardDecoration}></div>

        <div className={styles.profileLayout}>
          <div className={styles.photoSection}>
            <div className={styles.photoCircle}>
              {profile?.photo_url ? (
                <img src={profile.photo_url} alt="Profile" className={styles.photoImage} />
              ) : (
                <User size={60} />
              )}
              {isEditing && (
                <div className={styles.photoOverlay}>
                  <Camera color="white" size={24} />
                </div>
              )}
            </div>
            <span className={styles.photoLabel}>Profile Photo</span>
          </div>
          
          <div className={styles.detailsSection}>
            <div className={styles.nameBlock}>
              {isEditing ? (
                <div className={styles.editFormGroup}>
                  <FloatingInput label="Full Name" value={editForm.full_name} onChange={e => setEditForm({...editForm, full_name: e.target.value})} />
                </div>
              ) : (
                <h2 className={styles.userName}>{profile?.full_name || 'System User'}</h2>
              )}
              
              {!isEditing && (
                <div className={styles.badges}>
                  <span className={styles.roleBadge}>
                    <Shield size={14} />
                    {profile?.role?.replace('_', ' ')}
                  </span>
                  <span className={styles.statusBadge}>
                    Active
                  </span>
                </div>
              )}
            </div>

            <div className={styles.gridDetails}>
              <div className={styles.detailItem}>
                <div className={styles.detailLabel}><Phone size={14} /> Mobile Number</div>
                <div className={styles.detailValue}>{profile?.phone}</div>
              </div>
              
              <div className={styles.detailItem}>
                <div className={styles.detailLabel}><CreditCard size={14} /> Aadhar Identity</div>
                {isEditing ? (
                  <div className={styles.editFormGroup}>
                    <FloatingInput label="Aadhar Number" value={editForm.aadhar} onChange={e => setEditForm({...editForm, aadhar: e.target.value})} />
                  </div>
                ) : (
                  <div className={styles.detailValue}>{profile?.aadhar}</div>
                )}
              </div>

              <div className={styles.detailItem}>
                <div className={styles.detailLabel}><MapPin size={14} /> Location / Address</div>
                {isEditing ? (
                  <div className={styles.editFormGroup}>
                    <FloatingInput label="Location" value={editForm.location} onChange={e => setEditForm({...editForm, location: e.target.value})} />
                  </div>
                ) : (
                  <div className={styles.detailValue}>{profile?.location}</div>
                )}
              </div>

              {profile?.role === 'tenant' && (
                <div className={styles.detailItem}>
                  <div className={styles.detailLabel}><Users size={14} /> Parent Details</div>
                  {isEditing ? (
                    <div className={styles.editFormGroup}>
                      <FloatingInput label="Parent Info (Name & Phone)" value={editForm.parent_details} onChange={e => setEditForm({...editForm, parent_details: e.target.value})} />
                    </div>
                  ) : (
                    <div className={styles.detailValue}>{profile?.parent_details}</div>
                  )}
                </div>
              )}
              
              {!isEditing && (
                <div className={styles.detailItem}>
                  <div className={styles.detailLabel}><Building size={14} /> Account Created</div>
                  <div className={styles.detailValue}>
                    {new Date(profile?.created_at || Date.now()).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </div>
              )}
            </div>

            {isEditing ? (
              <div className={styles.actionsSection}>
                <AnimatedButton onClick={handleSave} isLoading={isSaving} className="flex-1">
                  Save Changes
                </AnimatedButton>
                <button onClick={() => setIsEditing(false)} className={styles.cancelBtn}>
                  Cancel
                </button>
              </div>
            ) : (
              <div className={styles.actionsSection}>
                <AnimatedButton onClick={handleLogout} className={styles.logoutBtn}>
                  Sign Out Securely
                </AnimatedButton>
                <button onClick={() => router.back()} className={styles.cancelBtn}>
                  Back to Dashboard
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
