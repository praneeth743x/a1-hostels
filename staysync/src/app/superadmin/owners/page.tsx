"use client";

import { toast } from 'react-hot-toast';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Power, PowerOff, Search, Plus, X, Building2, Users as UsersIcon, ShieldCheck, Mail, Phone, MapPin, UserCheck, ChevronDown, ChevronUp, Pencil, Image as ImageIcon, Sparkles, Trash2, Upload, FolderOpen, Eye, EyeOff, KeyRound, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { FloatingInput } from '@/components/FloatingInput';
import { AnimatedButton } from '@/components/AnimatedButton';
import { registerNewPGOwner, getOwners, updatePGOwner, togglePGOwnerCascadeStatus, getLandingSettings, updateLandingSettings } from '@/app/actions/superadmin';
import { rpcCall } from '@/lib/rpc';
import { useRouter } from 'next/navigation';
import styles from '../superadmin.module.css';

interface HostelItem {
  id: string;
  name: string;
  address: string;
  tenantCount: number;
  is_active: boolean;
}

interface OwnerData {
  id: string;
  name: string;
  email: string;
  phone: string;
  password?: string;
  hostels: number;
  tenants: number;
  status: 'active' | 'disabled';
  payment: string;
  hostelList?: HostelItem[];
  created_at: string;
}

export default function PGOwnersPage() {
  const router = useRouter();
  const [owners, setOwners] = useState<OwnerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [expandedOwnerId, setExpandedOwnerId] = useState<string | null>(null);
  
  // Edit Owner States
  const [editingOwner, setEditingOwner] = useState<OwnerData | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Landing Settings State
  const [showLandingModal, setShowLandingModal] = useState(false);
  const [landingLogoUrl, setLandingLogoUrl] = useState('/himalaya_logo.png');
  const [landingSiteName, setLandingSiteName] = useState('Himalaya Hostels');
  const [selectedTransition, setSelectedTransition] = useState('gradient_depixelate');
  const [slideDurationSeconds, setSlideDurationSeconds] = useState(1);
  const [headerOutlineColor, setHeaderOutlineColor] = useState('rgba(217, 119, 6, 0.3)');
  const [headerOutlineThickness, setHeaderOutlineThickness] = useState(2);
  const [landingSlides, setLandingSlides] = useState<any[]>([]);
  const [isSavingLanding, setIsSavingLanding] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  const worldClassTransitions = [
    { value: 'gradient_depixelate',  icon: '🌋', title: 'Himalayan Depixelate',    desc: 'Signature mosaic dissolve with hue drift & contrast crystallisation' },
    { value: 'liquid_aurora',        icon: '🌌', title: 'Liquid Aurora',            desc: 'Multi-layer chromatic blur with aurora hue-rotate breathe' },
    { value: 'shattered_glass',      icon: '💎', title: 'Shattered Glass',          desc: 'Diagonal shard slice with dual-skew + contrast crack' },
    { value: 'cosmic_portal',        icon: '🔮', title: 'Cosmic Portal',            desc: 'Deep 3-D rotateX flip through a glowing dimensional gate' },
    { value: 'neon_glitch_storm',    icon: '⚡', title: 'Neon Glitch Storm',        desc: 'Cyberpunk hue-invert + skewY chaos with elastic overshoot' },
    { value: 'obsidian_mirror',      icon: '🖤', title: 'Obsidian Mirror',          desc: 'Full rotateY 180° flip with deep black mirror depth' },
    { value: 'supernova_burst',      icon: '💥', title: 'Supernova Burst',          desc: 'Overexposed radial scale 5× flash explosion implosion' },
    { value: 'silk_veil_drop',       icon: '🧣', title: 'Silk Veil Drop',           desc: 'Curtain-fall vertical curtain with springy overshoot' },
    { value: 'diamond_crystallize',  icon: '💠', title: 'Diamond Crystallize',      desc: 'Contrast 500% crystallisation + hue spin + tilt rotate' },
    { value: 'quantum_fold',         icon: '🌀', title: 'Quantum Fold',             desc: 'Dual-axis 3-D fold — rotateX + rotateZ + scaleX collapse' },
    { value: 'molten_lava',          icon: '🌋', title: 'Molten Lava Drip',         desc: 'Sepia 600% + scaleY drip with overshoot spring ease' },
    { value: 'time_warp',            icon: '⏱️', title: 'Time Warp Speed',          desc: 'Warp-speed scaleX×6 stretch with chromatic aberration blur' },
    { value: 'venetian_blinds',      icon: '🪟', title: 'Venetian Blinds',          desc: 'Accordion scaleY collapse + brightness strobe + skew' },
    { value: 'ethereal_ghost',       icon: '👻', title: 'Ethereal Ghost Float',     desc: 'Soft luminous glow blur + vertical float + diffuse halo' },
    { value: 'kaleidoscope_spin',    icon: '🎡', title: 'Kaleidoscope Spin',        desc: 'Full 720° rainbow hue-spin with scale 0→1 bloom' },
    { value: 'ice_shatter',         icon: '🧊', title: 'Ice Shatter Freeze',       desc: 'Invert freeze + contrast 400% + rotateZ shard elastic' },
    { value: 'velvet_slide',         icon: '🎭', title: 'Velvet Cinema Slide',      desc: 'Off-screen cinematic slide with warm sepia motion blur' },
    { value: 'blackhole_absorb',     icon: '🕳️', title: 'Black Hole Absorb',        desc: 'Gravity implosion scale→0 + 540° spin + darkness drain' },
    { value: 'retro_vhs',           icon: '📼', title: 'Retro VHS Scanline',       desc: 'Desaturate jitter + scanline skew + CRT contrast strobe' },
    { value: 'graviton_sweep',       icon: '🚀', title: 'Graviton Diagonal Sweep',  desc: 'Full diagonal X+Y translate + rotateZ + luminous glow' },
  ];

  // Registration Form State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regMobile, setRegMobile] = useState('');

  const compressImageFile = (file: File, maxWidth = 1200, maxHeight = 800, quality = 0.82): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawResult = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(compressedDataUrl);
          } else {
            resolve(rawResult);
          }
        };
        img.onerror = () => resolve(rawResult);
        img.src = rawResult;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Small icon badge compression (300x300 at 0.85 quality -> ~20 KB)
      const compressed = await compressImageFile(file, 300, 300, 0.85);
      setLandingLogoUrl(compressed);
    } catch (err) {
      console.error("Logo compression error:", err);
    }
  };

  const handleSlideFileUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Slide hero image compression (1280x720 at 0.78 quality -> ~90 KB)
      const compressed = await compressImageFile(file, 1280, 720, 0.78);
      const updated = [...landingSlides];
      updated[index].imageUrl = compressed;
      setLandingSlides(updated);
    } catch (err) {
      console.error("Slide compression error:", err);
    }
  };

  const fetchOwnersData = async () => {
    try {
      setIsLoading(true);
      const res = await rpcCall('getOwners');
      if (res?.success && res?.data) {
        setOwners(res.data as OwnerData[]);
      }
    } catch (err) {
      console.error("Error fetching owners:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOwnersData();
  }, []);

  const toggleStatus = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ownerToToggle = owners.find(o => o.id === id);
    if (!ownerToToggle) return;
    
    const previousStatus = ownerToToggle.status;
    const newStatus = previousStatus === 'active' ? 'disabled' : 'active';
    const isNowActive = newStatus === 'active';
    
    setOwners(prev => prev.map(owner => {
      if (owner.id === id) {
        return { ...owner, status: newStatus };
      }
      return owner;
    }));

    try {
      const res = await rpcCall('togglePGOwnerCascadeStatus', id, isNowActive);
      if (res?.success) {
        toast.success(isNowActive ? 'PG Owner & all associated properties/users are now ACTIVE' : 'PG Owner & all associated properties/users are now INACTIVE');
        fetchOwnersData();
      } else {
        setOwners(prev => prev.map(owner => {
          if (owner.id === id) return { ...owner, status: previousStatus };
          return owner;
        }));
        toast.error(`Failed to update status: ${res?.error || 'Error'}`);
      }
    } catch (err: any) {
      console.error("Failed to update status", err);
      setOwners(prev => prev.map(owner => {
        if (owner.id === id) return { ...owner, status: previousStatus };
        return owner;
      }));
      toast.error("Status update error");
    }
  };

  const handleOpenEdit = (owner: OwnerData, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingOwner(owner);
    setEditName(owner.name || '');
    setEditEmail(owner.email || '');
    setEditPhone(owner.phone || '');
    setEditPassword(owner.password || '');
    setShowEditPassword(false);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOwner) return;
    setIsUpdating(true);
    try {
      const res = await rpcCall('updatePGOwner', editingOwner.id, {
        name: editName,
        email: editEmail,
        phone: editPhone,
        password: editPassword
      });
      if (!res?.success) throw new Error(res?.error || 'Failed to update');

      toast.success("PG Owner updated successfully!");
      await fetchOwnersData();
      setEditingOwner(null);
    } catch (err: any) {
      toast.error("Failed to update PG Owner: " + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedOwnerId(prev => (prev === id ? null : id));
  };

  const filteredOwners = owners.filter(o => {
    const query = (searchTerm || '').toLowerCase();
    const nameStr = (o?.name || '').toLowerCase();
    const emailStr = (o?.email || '').toLowerCase();
    const phoneStr = (o?.phone || '');
    return nameStr.includes(query) || emailStr.includes(query) || phoneStr.includes(query);
  });

  const totalHostels = owners.reduce((sum, o) => sum + (o?.hostels || 0), 0);
  const totalTenants = owners.reduce((sum, o) => sum + (o?.tenants || 0), 0);
  const activeOwnersCount = owners.filter(o => o?.status === 'active').length;

  const handleRegisterOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegistering(true);
    try {
      const res = await rpcCall('registerNewPGOwner', {
        name: regName,
        email: regEmail,
        mobile: regMobile,
      });

      if (!res?.success) throw new Error(res?.error || 'Registration failed');

      await fetchOwnersData();
      setIsRegistering(false);
      setShowModal(false);
      setRegName(''); setRegEmail(''); setRegMobile('');
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to register PG Owner: " + err.message);
      setIsRegistering(false);
    }
  };

  const handleOpenLandingModal = async () => {
    try {
      const res = await rpcCall('getLandingSettings');
      if (res?.success && res?.data) {
        if (res.data.logoUrl) {
          setLandingLogoUrl(res.data.logoUrl);
          if (typeof window !== 'undefined') {
            localStorage.setItem('cachedLogoUrl', res.data.logoUrl);
            let iconLink = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
            if (iconLink) iconLink.href = res.data.logoUrl;
          }
        }
        if (res.data.siteName) setLandingSiteName(res.data.siteName);
        if (res.data.selectedTransition) setSelectedTransition(res.data.selectedTransition);
        if (res.data.slideDurationSeconds !== undefined) setSlideDurationSeconds(res.data.slideDurationSeconds);
        if (res.data.slides) setLandingSlides(res.data.slides);
        if (res.data.headerOutlineColor) setHeaderOutlineColor(res.data.headerOutlineColor);
        if (res.data.headerOutlineThickness !== undefined) setHeaderOutlineThickness(res.data.headerOutlineThickness);
      }
    } catch (err: any) {
      console.error("getLandingSettings error:", err);
    } finally {
      setShowLandingModal(true);
    }
  };

  const compressBase64Url = (dataUrl: string, maxDim = 1000, quality = 0.75): Promise<string> => {
    if (!dataUrl || !dataUrl.startsWith('data:image/')) return Promise.resolve(dataUrl);
    if (dataUrl.length < 80000) return Promise.resolve(dataUrl);

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const handleSaveLandingSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingLanding(true);
    try {
      // Auto-compress logo and all slides to ensure total payload size is well below 1MB
      const cleanLogo = await compressBase64Url(landingLogoUrl, 300, 0.85);
      const cleanSlides = await Promise.all(
        landingSlides.map(async (slide) => {
          if (slide.imageUrl && slide.imageUrl.startsWith('data:image/')) {
            const compressedUrl = await compressBase64Url(slide.imageUrl, 1000, 0.72);
            return { ...slide, imageUrl: compressedUrl };
          }
          return slide;
        })
      );

      const res = await rpcCall('updateLandingSettings', {
        logoUrl: cleanLogo,
        siteName: landingSiteName,
        selectedTransition: selectedTransition,
        slideDurationSeconds: slideDurationSeconds,
        slides: cleanSlides,
        headerOutlineColor: headerOutlineColor,
        headerOutlineThickness: headerOutlineThickness
      });
      if (!res?.success) throw new Error(res?.error || 'Failed to update');
      
      setLandingLogoUrl(cleanLogo);
      setLandingSlides(cleanSlides);

      if (typeof window !== 'undefined') {
        localStorage.setItem('cachedLogoUrl', cleanLogo);
        let iconLink = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (iconLink) {
          iconLink.href = cleanLogo;
        }
      }

      toast.success("Landing Settings & Real-Time Transitions saved successfully!");
      setShowLandingModal(false);
    } catch (err: any) {
      toast.error("Failed to update Landing Settings: " + err.message);
    } finally {
      setIsSavingLanding(false);
    }
  };

  const handleAddSlide = () => {
    const newSlide = {
      id: Date.now().toString(),
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB1ybc4RDJcJCi0vesS4Kdhno7cvHG0nV0SrX9qYRRAuNE74f3AT9fvhQZSh6QXDC0MTiIjZfRyKlpYhZYt3nwU-m4ryDwg9eKqZfmuw8pDCIdLe0qvQnHSFWF_cQMaYigYn9TFDVs1fDCRbIqTnsPlQtDgbeuyyP5PQI5oNXy3bLkwMzLqMMLzwWcqn5GmEWcloVC5iheKI9ghf6sKn6QYheYdxLVQyrvIIHSDSfDzjTF7tulkyPnH',
      title: 'New Himalayan Suite',
      subtitle: 'Premium Living & Serene Views'
    };
    setLandingSlides([...landingSlides, newSlide]);
  };

  const handleRemoveSlide = (id: string) => {
    setLandingSlides(landingSlides.filter(s => s.id !== id));
  };

  return (
    <div className={styles.dashboardPage}>
      {/* Top Banner Card matching PG Owner / Tenant Header */}
      <div className={styles.heroBanner}>
        <div className={styles.heroBannerInner}>
          <div>
            <span className={styles.heroBadge}>SUPER ADMIN PORTAL</span>
            <h1 className={styles.heroTitle}>PG Owners Management</h1>
            <p className={styles.heroSubtitle}>Manage PG owner credentials, view properties, control kill switches, and edit details.</p>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button 
              className={styles.registerPrimaryBtn}
              onClick={handleOpenLandingModal}
              style={{ background: 'linear-gradient(135deg, #d97706, #b45309)', borderColor: '#d97706' }}
              type="button"
            >
              <ImageIcon size={18} />
              <span>Manage Logo & Slides</span>
            </button>

            <button 
              className={styles.registerPrimaryBtn}
              onClick={() => setShowModal(true)}
              type="button"
            >
              <Plus size={20} />
              <span>Register New Owner</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Metrics Row */}
      <div className={styles.metricsRow}>
        <div className={styles.metricCard}>
          <div className={styles.metricIconBox} style={{ background: '#e0e7ff', color: '#4338ca' }}>
            <UserCheck size={22} />
          </div>
          <div>
            <div className={styles.metricLabel}>Total PG Owners</div>
            <div className={styles.metricValue}>{owners.length}</div>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricIconBox} style={{ background: '#ecfdf5', color: '#10b981' }}>
            <Building2 size={22} />
          </div>
          <div>
            <div className={styles.metricLabel}>Active Hostels</div>
            <div className={styles.metricValue}>{totalHostels}</div>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricIconBox} style={{ background: '#eff6ff', color: '#3b82f6' }}>
            <UsersIcon size={22} />
          </div>
          <div>
            <div className={styles.metricLabel}>Total Tenants</div>
            <div className={styles.metricValue}>{totalTenants}</div>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricIconBox} style={{ background: '#fef3c7', color: '#d97706' }}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className={styles.metricLabel}>Active Subscriptions</div>
            <div className={styles.metricValue}>{activeOwnersCount} / {owners.length}</div>
          </div>
        </div>
      </div>

      {/* Main Owners List Table */}
      <div className={styles.tableCard}>
        <div className={styles.tableToolbar}>
          <div className={styles.tableToolbarLeft}>
            <h2 className={styles.tableSectionTitle}>All Registered Owners</h2>
            <span className={styles.tableCountBadge}>{filteredOwners.length} Owners</span>
          </div>

          <div className={styles.searchWrapper}>
            <Search size={18} className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Search by name, email, phone..." 
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
                <th style={{ width: '40px' }}></th>
                <th>PG Owner</th>
                <th>Contact Info</th>
                <th>Properties</th>
                <th>Total Tenants</th>
                <th>SaaS Payment</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid #e2e8f0', borderTopColor: '#6366f1', animation: 'spin 1s linear infinite' }} />
                      <span style={{ fontSize: '0.88rem', color: '#64748b', fontWeight: 600 }}>Loading PG Owners...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredOwners.map((owner, index) => {
                const isExpanded = expandedOwnerId === owner.id;
                return (
                  <React.Fragment key={owner.id}>
                    <motion.tr 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                      onClick={() => toggleExpand(owner.id)}
                      style={{ cursor: 'pointer', background: isExpanded ? 'rgba(99, 102, 241, 0.04)' : undefined }}
                    >
                      <td style={{ textAlign: 'center' }}>
                        {isExpanded ? <ChevronUp size={18} className="text-muted" /> : <ChevronDown size={18} className="text-muted" />}
                      </td>
                      <td>
                        <div className={styles.ownerCell}>
                          <div className={styles.ownerAvatar}>
                            {owner.name?.charAt(0).toUpperCase() || 'P'}
                          </div>
                          <div className={styles.ownerMeta}>
                            <span className={styles.ownerName}>{owner.name}</span>
                            <span className={styles.ownerSub}>ID: {owner.id.substring(0, 8)}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.85rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155' }}>
                            <Mail size={13} style={{ color: '#6366f1' }} /> {owner.email || 'N/A'}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b' }}>
                            <Phone size={13} style={{ color: '#10b981' }} /> {owner.phone || 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={styles.propertyPill}>
                          <Building2 size={14} /> {owner.hostels} {owner.hostels === 1 ? 'Hostel' : 'Hostels'}
                        </span>
                      </td>
                      <td>
                        <span className={styles.tenantPill}>
                          <UsersIcon size={14} /> {owner.tenants} Tenants
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${owner.payment === 'PAID' ? styles.badgePaid : styles.badgePending}`}>
                          {owner.payment}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            className={styles.editOwnerBtn}
                            onClick={(e) => handleOpenEdit(owner, e)}
                            title="Edit Owner Details"
                            type="button"
                          >
                            <Pencil size={15} /> Edit
                          </button>
                          <button 
                            className={`${styles.killSwitchBtn} ${owner.status === 'active' ? styles.killSwitchActive : styles.killSwitchDisabled}`}
                            onClick={(e) => toggleStatus(owner.id, e)}
                            title={owner.status === 'active' ? 'Disable Access' : 'Enable Access'}
                            type="button"
                          >
                            {owner.status === 'active' ? <Power size={16} /> : <PowerOff size={16} />}
                            <span>{owner.status === 'active' ? 'Active' : 'Disabled'}</span>
                          </button>
                        </div>
                      </td>
                    </motion.tr>

                    {/* Expanded Hostels Section */}
                    {isExpanded && (
                      <tr style={{ background: '#f8fafc' }}>
                        <td colSpan={7} style={{ padding: '1rem 1.5rem' }}>
                          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Building2 size={16} style={{ color: '#4338ca' }} /> Hostels Managed by {owner.name}
                              </h3>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '2px 10px', borderRadius: '12px' }}>
                                {owner.hostelList?.length || 0} Hostels
                              </span>
                            </div>

                            {owner.hostelList && owner.hostelList.length > 0 ? (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
                                {owner.hostelList.map((h) => (
                                  <div key={h.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{h.name}</span>
                                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: h.is_active ? '#dcfce7' : '#fee2e2', color: h.is_active ? '#15803d' : '#b91c1c' }}>
                                        {h.is_active ? 'ACTIVE' : 'INACTIVE'}
                                      </span>
                                    </div>
                                    <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <MapPin size={13} /> {h.address}
                                    </span>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#2563eb', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <UsersIcon size={13} /> {h.tenantCount} Active Tenants
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ color: '#94a3b8', fontSize: '0.88rem', fontStyle: 'italic' }}>No hostels registered for this owner yet.</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          {/* Mobile Card Layout for < 768px */}
          <div className={styles.mobileCardList}>
            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[1, 2].map(i => (
                  <div key={i} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ width: '50%', height: '18px', background: '#e2e8f0', borderRadius: '6px', animation: 'pulse 1.5s infinite' }} />
                    <div style={{ width: '80%', height: '14px', background: '#f1f5f9', borderRadius: '4px' }} />
                    <div style={{ width: '60%', height: '14px', background: '#f1f5f9', borderRadius: '4px' }} />
                  </div>
                ))}
              </div>
            ) : filteredOwners.map((owner) => (
              <div key={owner.id} className={styles.mobileCard}>
                <div className={styles.mobileCardHeader}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>
                    {owner.name || 'Unnamed Owner'}
                  </div>
                  <span style={{ 
                    fontSize: '0.72rem', fontWeight: 800, padding: '4px 10px', borderRadius: '12px', letterSpacing: '0.05em',
                    background: owner.status === 'active' ? '#ecfdf5' : '#fef2f2', 
                    color: owner.status === 'active' ? '#10b981' : '#ef4444',
                    border: `1px solid ${owner.status === 'active' ? '#a7f3d0' : '#fecaca'}`
                  }}>
                    {(owner.status || 'disabled').toUpperCase()}
                  </span>
                </div>
                <div className={styles.mobileCardBody}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Mail size={14} color="#64748b" /> {owner.email || 'No email'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Phone size={14} color="#64748b" /> {owner.phone || 'No phone'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <Building2 size={14} color="#4338ca" /> {owner.hostels || 0} Properties
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <UsersIcon size={14} color="#3b82f6" /> {owner.tenants || 0} Tenants
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={14} color="#d97706" /> Payment: {owner.payment === 'PAID' ? 'Paid' : 'Pending'}
                  </div>
                </div>
                <div className={styles.mobileCardActions}>
                  <button onClick={(e) => handleOpenEdit(owner, e)} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }} type="button">
                    <Pencil size={18} />
                  </button>
                  <button onClick={(e) => toggleStatus(owner.id, e)} style={{ background: owner.status === 'active' ? '#fee2e2' : '#dcfce7', color: owner.status === 'active' ? '#dc2626' : '#16a34a', border: 'none' }} type="button">
                    {owner.status === 'active' ? <PowerOff size={18} /> : <Power size={18} />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredOwners.length === 0 && !isLoading && (
            <div className={styles.emptyState}>No owners found matching your search query.</div>
          )}
        </div>
      </div>

      {/* Edit Owner Details Modal */}
      <AnimatePresence>
        {editingOwner && (
          <div className={styles.modalOverlay}>
            <motion.div 
              className={styles.modalCard}
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              style={{ maxWidth: '480px', width: '100%', borderRadius: '24px', overflow: 'hidden' }}
            >
              <div className={styles.modalHeader} style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)', padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    <Pencil size={20} />
                  </div>
                  <div>
                    <h2 className={styles.modalTitle} style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white', margin: 0 }}>Edit PG Owner Details</h2>
                    <p className={styles.modalSubtitle} style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', margin: '2px 0 0 0' }}>Update info & login credentials for {editingOwner.name}</p>
                  </div>
                </div>
                <button onClick={() => setEditingOwner(null)} className={styles.modalCloseBtn} type="button">
                  <X size={20} />
                </button>
              </div>
              
              <div className={styles.modalBody} style={{ padding: '24px' }}>
                <form id="edit-pg-owner-form" onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <FloatingInput 
                    label="PG Owner Full Name" 
                    value={editName} 
                    onChange={e => setEditName(e.target.value)} 
                    required 
                  />

                  <FloatingInput 
                    label="Email Address" 
                    type="email" 
                    value={editEmail} 
                    onChange={e => setEditEmail(e.target.value)} 
                    required 
                  />

                  <FloatingInput 
                    label="Phone Number" 
                    type="tel" 
                    value={editPhone} 
                    onChange={e => setEditPhone(e.target.value)} 
                    required 
                  />

                  <div style={{ position: 'relative' }}>
                    <FloatingInput 
                      label="Account Password" 
                      type={showEditPassword ? "text" : "password"} 
                      value={editPassword} 
                      onChange={e => setEditPassword(e.target.value)} 
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '6px',
                        zIndex: 10
                      }}
                      title={showEditPassword ? "Hide password" : "Show password"}
                    >
                      {showEditPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </form>
              </div>
              
              <div className={styles.modalFooter} style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button onClick={() => setEditingOwner(null)} className={styles.modalCancelBtn} type="button">
                  Cancel
                </button>
                <AnimatedButton type="submit" form="edit-pg-owner-form" isLoading={isUpdating} style={{ background: 'linear-gradient(135deg, #4338ca, #6366f1)', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '12px', fontWeight: 700 }}>
                  Save Changes
                </AnimatedButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Register New PG Owner Modal */}
      <AnimatePresence>
        {showModal && (
          <div className={styles.modalOverlay}>
            <motion.div 
              className={styles.modalCard}
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
            >
              <div className={styles.modalHeader}>
                <div>
                  <h2 className={styles.modalTitle}>Register New PG Owner</h2>
                  <p className={styles.modalSubtitle}>Create PG owner account credentials & workspace</p>
                </div>
                <button onClick={() => setShowModal(false)} className={styles.modalCloseBtn} type="button">
                  <X size={20} />
                </button>
              </div>
              
              <div className={styles.modalBody}>
                <form id="register-pg-form" onSubmit={handleRegisterOwner} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <FloatingInput 
                    label="PG Owner Full Name" 
                    value={regName} 
                    onChange={e => setRegName(e.target.value)} 
                    required 
                  />
                  <FloatingInput 
                    label="Email Address" 
                    type="email" 
                    value={regEmail} 
                    onChange={e => setRegEmail(e.target.value)} 
                    required 
                  />
                  <FloatingInput 
                    label="Mobile Phone Number" 
                    type="tel" 
                    value={regMobile} 
                    onChange={e => setRegMobile(e.target.value)} 
                    required 
                  />
                </form>
              </div>
              
              <div className={styles.modalFooter}>
                <button onClick={() => setShowModal(false)} className={styles.modalCancelBtn} type="button">
                  Cancel
                </button>
                <AnimatedButton type="submit" form="register-pg-form" isLoading={isRegistering} style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '10px', fontWeight: 700 }}>
                  Create Account
                </AnimatedButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Landing Page Settings & Logo Management Modal */}
      <AnimatePresence>
        {showLandingModal && (
          <div className={styles.modalOverlay}>
            <motion.div 
              className={styles.modalCard}
              style={{ maxWidth: '650px' }}
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
            >
              <div className={styles.modalHeader}>
                <div>
                  <h2 className={styles.modalTitle}>Manage Logo & Landing Slides</h2>
                  <p className={styles.modalSubtitle}>Update public website logo, brand title, and hero slideshow</p>
                </div>
                <button onClick={() => setShowLandingModal(false)} className={styles.modalCloseBtn} type="button">
                  <X size={20} />
                </button>
              </div>
              
              <div className={styles.modalBody} style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <form id="landing-settings-form" onSubmit={handleSaveLandingSettings} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* Logo Section - stacked vertically for mobile */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <img 
                        src={landingLogoUrl || '/himalaya_logo.png'} 
                        alt="Logo Preview" 
                        style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #d97706', boxShadow: '0 4px 12px rgba(217, 119, 6, 0.25)', flexShrink: 0 }} 
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <FloatingInput 
                          label="Official Logo Image URL" 
                          value={landingLogoUrl} 
                          onChange={e => setLandingLogoUrl(e.target.value)} 
                          required 
                        />
                      </div>
                    </div>
                    <label 
                      style={{ padding: '10px 16px', borderRadius: '10px', background: 'linear-gradient(135deg, #d97706, #b45309)', color: 'white', border: 'none', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(217,119,6,0.25)', width: '100%' }}
                    >
                      <input 
                        type="file" 
                        accept="image/*" 
                        style={{ display: 'none' }} 
                        onChange={handleLogoFileUpload} 
                      />
                      <Upload size={16} /> Upload Logo File
                    </label>
                  </div>

                  <FloatingInput 
                    label="Website Name / Brand Title" 
                    value={landingSiteName} 
                    onChange={e => setLandingSiteName(e.target.value)} 
                    required 
                  />

                  {/* Header Outline Settings - stacked on mobile */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      ✨ Header Outline Style
                    </div>
                    
                    {/* Outline Color */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569' }}>OUTLINE COLOR</label>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input 
                          type="color" 
                          value={headerOutlineColor} 
                          onChange={e => setHeaderOutlineColor(e.target.value)}
                          style={{ width: '38px', height: '38px', padding: '2px', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', background: 'none', flexShrink: 0 }}
                        />
                        <input 
                          type="text" 
                          value={headerOutlineColor} 
                          onChange={e => setHeaderOutlineColor(e.target.value)}
                          placeholder="#fb923c"
                          style={{ flex: 1, padding: '9px 10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, color: '#334155', minWidth: 0 }}
                        />
                      </div>
                    </div>

                    {/* Outline Thickness */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                        <span>THICKNESS</span>
                        <span style={{ fontWeight: 800, color: '#d97706' }}>{headerOutlineThickness}px</span>
                      </label>
                      <input 
                        type="range" 
                        min="1" 
                        max="8" 
                        value={headerOutlineThickness} 
                        onChange={e => setHeaderOutlineThickness(parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: '#d97706', cursor: 'pointer', height: '6px' }}
                      />
                    </div>
                  </div>

                  {/* Image Display Stop Time Control */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Image Display / Stop Time</span>
                      <span style={{ color: '#d97706', fontWeight: 900 }}>{slideDurationSeconds}s</span>
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                      {[1, 2, 3, 5, 8].map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => setSlideDurationSeconds(sec)}
                          style={{
                            padding: '8px 4px',
                            borderRadius: '8px',
                            border: slideDurationSeconds === sec ? '2px solid #d97706' : '1px solid #cbd5e1',
                            background: slideDurationSeconds === sec ? 'linear-gradient(135deg, #fffbeb, #fef3c7)' : '#ffffff',
                            color: slideDurationSeconds === sec ? '#b45309' : '#475569',
                            fontWeight: 700,
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: slideDurationSeconds === sec ? '0 4px 12px rgba(217,119,6,0.18)' : 'none',
                            textAlign: 'center'
                          }}
                        >
                          {sec}s
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* World-Class Interactive Animation Preset Grid */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Slide Transition Preset
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                      {worldClassTransitions.map((t) => {
                        const isSelected = selectedTransition === t.value;
                        return (
                          <div
                            key={t.value}
                            onClick={() => setSelectedTransition(t.value)}
                            style={{
                              padding: '10px 12px',
                              borderRadius: '10px',
                              border: isSelected ? '2px solid #d97706' : '1px solid #e2e8f0',
                              background: isSelected ? 'linear-gradient(135deg, #fff7ed, #ffedd5)' : '#ffffff',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '3px',
                              transition: 'all 0.2s ease',
                              boxShadow: isSelected ? '0 4px 14px rgba(217, 119, 6, 0.2)' : '0 2px 6px rgba(0,0,0,0.03)'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '1rem' }}>{t.icon}</span>
                              <span style={{
                                width: '14px',
                                height: '14px',
                                borderRadius: '50%',
                                border: isSelected ? '4px solid #d97706' : '2px solid #cbd5e1',
                                background: '#ffffff',
                                flexShrink: 0
                              }}></span>
                            </div>
                            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: isSelected ? '#9a3412' : '#1e293b' }}>
                              {t.title}
                            </span>
                            <span style={{ fontSize: '0.65rem', color: isSelected ? '#c2410c' : '#64748b', lineHeight: '1.2' }}>
                              {t.desc}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Hero Slideshow Images */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700 }}>Hero Slides ({landingSlides.length})</h4>
                      <button 
                        type="button" 
                        onClick={handleAddSlide}
                        style={{ padding: '6px 12px', borderRadius: '8px', background: '#e0e7ff', color: '#4338ca', border: 'none', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Plus size={14} /> Add Slide
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {landingSlides.map((slide, index) => (
                        <div key={slide.id || index} style={{ padding: '12px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>SLIDE #{index + 1}</span>
                            {landingSlides.length > 1 && (
                              <button 
                                type="button" 
                                onClick={() => handleRemoveSlide(slide.id)} 
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <FloatingInput 
                                label="Image URL or Base64" 
                                value={slide.imageUrl} 
                                onChange={e => {
                                  const updated = [...landingSlides];
                                  updated[index].imageUrl = e.target.value;
                                  setLandingSlides(updated);
                                }} 
                                required 
                              />
                            </div>
                            <label 
                              style={{ padding: '8px 12px', borderRadius: '8px', background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}
                            >
                              <input 
                                type="file" 
                                accept="image/*" 
                                style={{ display: 'none' }} 
                                onChange={e => handleSlideFileUpload(index, e)} 
                              />
                              <FolderOpen size={14} /> Upload
                            </label>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <FloatingInput 
                              label="Slide Title" 
                              value={slide.title} 
                              onChange={e => {
                                const updated = [...landingSlides];
                                updated[index].title = e.target.value;
                                setLandingSlides(updated);
                              }} 
                            />
                            <FloatingInput 
                              label="Slide Subtitle" 
                              value={slide.subtitle} 
                              onChange={e => {
                                const updated = [...landingSlides];
                                updated[index].subtitle = e.target.value;
                                setLandingSlides(updated);
                              }} 
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </form>
              </div>
              
              <div className={styles.modalFooter}>
                <button onClick={() => setShowLandingModal(false)} className={styles.modalCancelBtn} type="button">
                  Cancel
                </button>
                <AnimatedButton type="submit" form="landing-settings-form" isLoading={isSavingLanding} style={{ background: 'linear-gradient(135deg, #d97706, #b45309)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 700, fontSize: '0.88rem' }}>
                  Save Settings
                </AnimatedButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
