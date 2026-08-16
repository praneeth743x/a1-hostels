"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  Plus, X, Loader2, CheckCircle2, Clock, AlertTriangle, ChevronDown, 
  Zap, Droplet, Sparkles, Wifi, Utensils, HelpCircle, ShieldAlert, ArrowLeft, MessageSquare,
  Home, CreditCard, Bell, User, Wallet, Building, Search, LogOut, Download, ChevronRight
} from 'lucide-react';
import { AnimatedButton } from '@/components/AnimatedButton';
import { submitComplaint, getTenantComplaints } from '@/app/actions/complaints';
import { getTenantDashboardData } from '@/app/actions/tenant';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import Link from 'next/link';
import styles from '../DesktopTenantDashboard.module.css';

export default function TenantComplaintsPage() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [tenantInfo, setTenantInfo] = useState<any>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // Form State
  const [category, setCategory] = useState('Electrical');
  const [urgency, setUrgency] = useState('Medium');
  const [description, setDescription] = useState('');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  const categories = ['Electrical', 'Plumbing', 'Cleaning', 'Internet/WiFi', 'Food', 'Others'];
  const urgencies = ['Low', 'Medium', 'High'];

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        setLoading(true);
        const fetch = async () => {
          const res = await getTenantComplaints(user.email!);
          if (res.success) {
            setComplaints(res.data || []);
          }
          const dashRes = await getTenantDashboardData(user.email!);
          if (dashRes.success && dashRes.data?.tenant) {
            setTenantInfo(dashRes.data.tenant);
          }
        };
        
        await fetch();
        setLoading(false);
        
        intervalId = setInterval(fetch, 5000);
      } else {
        setLoading(false);
      }
    });
    return () => {
      unsub();
      if (intervalId) clearInterval(intervalId);
    };
  }, []);
  
  const fetchComplaints = async (email: string) => {
    const res = await getTenantComplaints(email);
    if (res.success) setComplaints(res.data || []);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error logging out:", error);
    } finally {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setErrorMsg('Please describe your issue.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const email = auth.currentUser?.email;
      const currentUid = auth.currentUser?.uid;
      if (!email || !currentUid) throw new Error('Not authenticated');

      const res = await submitComplaint({
        tenantId: currentUid,
        tenantEmail: email,
        category,
        description,
        urgency
      });

      if (!res.success) throw new Error(res.error || 'Failed to submit complaint');

      setShowForm(false);
      setDescription('');
      setCategory('Electrical');
      setUrgency('Medium');
      await fetchComplaints(email);
      
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat?.toLowerCase()) {
      case 'electrical': return <Zap size={18} color="#d97706" />;
      case 'plumbing': return <Droplet size={18} color="#0284c7" />;
      case 'cleaning': return <Sparkles size={18} color="#16a34a" />;
      case 'internet/wifi':
      case 'wifi':
      case 'internet': return <Wifi size={18} color="#4f46e5" />;
      case 'food': return <Utensils size={18} color="#ea580c" />;
      default: return <HelpCircle size={18} color="#64748b" />;
    }
  };

  const getCategoryBg = (cat: string) => {
    switch (cat?.toLowerCase()) {
      case 'electrical': return '#fffbeb';
      case 'plumbing': return '#f0f9ff';
      case 'cleaning': return '#f0fdf4';
      case 'internet/wifi':
      case 'wifi':
      case 'internet': return '#eef2ff';
      case 'food': return '#fff7ed';
      default: return '#f8fafc';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
        return (
          <span style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '4px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={13} /> Resolved
          </span>
        );
      case 'in-progress':
        return (
          <span style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', padding: '4px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={13} /> In Progress
          </span>
        );
      default:
        return (
          <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecdd3', padding: '4px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <AlertTriangle size={13} /> Pending
          </span>
        );
    }
  };

  // Filtered Complaints
  const filteredComplaints = complaints.filter(c => {
    if (selectedCategory !== 'All' && c.category?.toLowerCase() !== selectedCategory.toLowerCase()) return false;
    if (selectedStatus !== 'All' && c.status?.toLowerCase() !== selectedStatus.toLowerCase()) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const desc = (c.description || '').toLowerCase();
      const cat = (c.category || '').toLowerCase();
      if (!desc.includes(term) && !cat.includes(term)) return false;
    }
    return true;
  });

  const pendingCount = complaints.filter(c => c.status !== 'resolved').length;
  const resolvedCount = complaints.filter(c => c.status === 'resolved').length;

  const navGroups = [
    {
      title: "WORKSPACE",
      items: [
        { id: 'Dashboard', label: 'Overview', icon: Home, href: '/tenant' },
        { id: 'Payments', label: 'Invoices & Billing', icon: CreditCard, href: '/tenant' },
      ]
    },
    {
      title: "RESOURCES",
      items: [
        { id: 'Notices', label: 'Announcements', icon: Bell, href: '/tenant' },
        { id: 'Complaints', label: 'Complaints & Issues', icon: MessageSquare, href: '/tenant/complaints' },
        { id: 'Support', label: 'Help Center', icon: HelpCircle, href: '/tenant' },
      ]
    }
  ];

  // SKELETON SHIMMER LOADING VIEW
  const renderSkeletonView = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 3 KPI SKELETON CARDS */}
      <div className={styles.kpiStrip}>
        {[1, 2, 3].map((i) => (
          <div key={i} className={styles.kpiCard}>
            <div className={styles.kpiHeaderRow}>
              <div className={styles.skeleton} style={{ width: '40px', height: '40px', borderRadius: '10px' }} />
              <div className={styles.skeleton} style={{ width: '16px', height: '16px', borderRadius: '50%' }} />
            </div>
            <div className={styles.kpiContent} style={{ marginTop: '12px' }}>
              <div className={styles.skeleton} style={{ width: '110px', height: '14px', marginBottom: '8px' }} />
              <div className={styles.skeleton} style={{ width: '70px', height: '28px', marginBottom: '8px' }} />
              <div className={styles.skeleton} style={{ width: '140px', height: '12px' }} />
            </div>
          </div>
        ))}
      </div>

      {/* 12-COLUMN SKELETON SPLIT */}
      <div className={styles.grid12}>
        {/* LEFT COLUMN SKELETON */}
        <div className={styles.colSpan8} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* TOOLBAR SKELETON */}
          <div style={{ background: 'white', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-light)', display: 'flex', gap: '12px' }}>
            <div className={styles.skeleton} style={{ flex: 1, height: '46px', borderRadius: '12px' }} />
            <div className={styles.skeleton} style={{ width: '140px', height: '46px', borderRadius: '12px' }} />
            <div className={styles.skeleton} style={{ width: '120px', height: '46px', borderRadius: '12px' }} />
          </div>

          {/* COMPLAINT CARDS SKELETONS */}
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ background: 'white', borderRadius: '16px', padding: '20px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className={styles.skeleton} style={{ width: '40px', height: '40px', borderRadius: '12px' }} />
                  <div>
                    <div className={styles.skeleton} style={{ width: '120px', height: '18px', marginBottom: '6px' }} />
                    <div className={styles.skeleton} style={{ width: '90px', height: '12px' }} />
                  </div>
                </div>
                <div className={styles.skeleton} style={{ width: '80px', height: '24px', borderRadius: '999px' }} />
              </div>
              <div className={styles.skeleton} style={{ width: '100%', height: '56px', borderRadius: '12px' }} />
            </div>
          ))}
        </div>

        {/* RIGHT COLUMN FORM SKELETON */}
        <div className={styles.colSpan4}>
          <div className={styles.panel} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div className={styles.skeleton} style={{ width: '160px', height: '22px' }} />
            <div className={styles.skeleton} style={{ width: '100%', height: '44px', borderRadius: '10px' }} />
            <div className={styles.skeleton} style={{ width: '100%', height: '40px', borderRadius: '10px' }} />
            <div className={styles.skeleton} style={{ width: '100%', height: '80px', borderRadius: '10px' }} />
            <div className={styles.skeleton} style={{ width: '100%', height: '46px', borderRadius: '10px' }} />
          </div>
        </div>
      </div>
    </div>
  );

  // CONTENT BODY RENDERER
  const renderMainContent = () => {
    if (loading) {
      return renderSkeletonView();
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* SUMMARY KPI STRIP */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeaderRow}>
            <div className={`${styles.kpiIconWrapper} ${styles.bgPrimarySoft}`}>
              <MessageSquare size={20} />
            </div>
            <ChevronRight size={16} className={styles.kpiChevron} />
          </div>
          <div className={styles.kpiContent}>
            <div className={styles.kpiLabel}>Total Issues Logged</div>
            <div className={styles.kpiValue}>{complaints.length}</div>
            <div className={styles.kpiContext}>Submitted issues history</div>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeaderRow}>
            <div className={`${styles.kpiIconWrapper} ${styles.bgDangerSoft}`}>
              <AlertTriangle size={20} />
            </div>
            <ChevronRight size={16} className={styles.kpiChevron} />
          </div>
          <div className={styles.kpiContent}>
            <div className={styles.kpiLabel}>Active & Pending</div>
            <div className={`${styles.kpiValue} ${pendingCount > 0 ? styles.kpiValueDanger : ''}`}>
              {pendingCount}
            </div>
            <div className={`${styles.kpiContext} ${pendingCount > 0 ? styles.kpiContextDanger : ''}`}>
              {pendingCount > 0 ? `${pendingCount} item(s) awaiting resolution` : 'No open complaints'}
            </div>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeaderRow}>
            <div className={`${styles.kpiIconWrapper} ${styles.bgSuccessSoft}`}>
              <CheckCircle2 size={20} />
            </div>
            <ChevronRight size={16} className={styles.kpiChevron} />
          </div>
          <div className={styles.kpiContent}>
            <div className={styles.kpiLabel}>Resolved Issues</div>
            <div className={styles.kpiValue}>{resolvedCount}</div>
            <div className={styles.kpiContext}>Successfully completed</div>
          </div>
        </div>
      </div>

      {/* 12-COLUMN MAIN SPLIT */}
      <div className={styles.grid12}>
        
        {/* LEFT COLUMN: ISSUES LIST & TOOLBAR */}
        <div className={styles.colSpan8} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* TOOLBAR */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', background: 'white', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '200px' }}>
              <div className={styles.toolbarInputWrapper} style={{ width: '100%', minWidth: 'auto' }}>
                <Search size={16} color="var(--text-tertiary)" />
                <input
                  type="text"
                  className={styles.toolbarInput}
                  placeholder="Search issues..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                className={styles.toolbarSelect}
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="All">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <select
                className={styles.toolbarSelect}
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="All">All Status</option>
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>

              {!isDesktop && (
                <button 
                  onClick={() => setShowForm(true)}
                  className={styles.actionBtnPrimary}
                  style={{ height: '46px' }}
                >
                  <Plus size={16} /> Raise Issue
                </button>
              )}
            </div>
          </div>

          {/* ISSUES CARDS LIST */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredComplaints.length === 0 ? (
              <div style={{ background: 'white', borderRadius: '16px', padding: '48px 24px', textAlign: 'center', border: '1px solid var(--border-light)' }}>
                <ShieldAlert size={44} color="var(--border-strong)" style={{ margin: '0 auto 12px auto' }} />
                <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 700, margin: 0 }}>No Issues Logged</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
                  {searchTerm || selectedCategory !== 'All' || selectedStatus !== 'All' ? 'No complaints match your filters.' : 'Everything looks good! Click "+ Raise Issue" if you need maintenance support.'}
                </p>
              </div>
            ) : (
              filteredComplaints.map((complaint, index) => (
                <motion.div 
                  key={complaint.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  style={{ background: 'white', borderRadius: '16px', padding: '20px', border: '1px solid var(--border-light)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: getCategoryBg(complaint.category), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {getCategoryIcon(complaint.category)}
                      </div>
                      <div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>{complaint.category}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                          Logged on {new Date(complaint.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={styles.statusChip} style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}>
                        Priority: {complaint.urgency || 'Medium'}
                      </span>
                      {getStatusBadge(complaint.status)}
                    </div>
                  </div>
                  
                  <div style={{ background: 'var(--bg-app)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
                    {complaint.description}
                  </div>

                  {complaint.resolution_comment && (
                    <div style={{ marginTop: '12px', background: '#f0fdf4', padding: '14px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <MessageSquare size={14} /> OWNER'S RESPONSE:
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#15803d', lineHeight: 1.4 }}>{complaint.resolution_comment}</div>
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: QUICK RAISE ISSUE FORM (DESKTOP) */}
        <div className={styles.colSpan4}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h3 className={styles.panelTitle}>Raise Maintenance Issue</h3>
            </div>
            <div className={styles.panelBody}>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</label>
                  <div style={{ position: 'relative' }}>
                    <div 
                      onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                      style={{ 
                        width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-light)', 
                        fontSize: '0.875rem', color: 'var(--text-main)', background: 'white', cursor: 'pointer',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {getCategoryIcon(category)} {category}
                      </span>
                      <motion.div animate={{ rotate: isCategoryOpen ? 180 : 0 }}>
                        <ChevronDown size={16} color="var(--text-tertiary)" />
                      </motion.div>
                    </div>
                    
                    <AnimatePresence>
                      {isCategoryOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          style={{
                            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '6px',
                            background: 'white', borderRadius: '12px', border: '1px solid var(--border-light)',
                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', overflow: 'hidden', zIndex: 50
                          }}
                        >
                          {categories.map(cat => (
                            <div 
                              key={cat} 
                              onClick={() => {
                                setCategory(cat);
                                setIsCategoryOpen(false);
                              }}
                              style={{ 
                                padding: '10px 14px', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-main)',
                                background: category === cat ? 'var(--bg-app)' : 'white',
                                fontWeight: category === cat ? 700 : 500,
                                display: 'flex', alignItems: 'center', gap: '8px',
                                borderBottom: '1px solid var(--border-light)'
                              }}
                            >
                              {getCategoryIcon(cat)} {cat}
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Urgency Level</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    {urgencies.map(u => (
                      <div 
                        key={u}
                        onClick={() => setUrgency(u)}
                        style={{ 
                          textAlign: 'center', padding: '10px 8px', borderRadius: '8px', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
                          background: urgency === u ? 'var(--primary)' : 'var(--bg-app)',
                          color: urgency === u ? 'white' : 'var(--text-secondary)',
                          border: `1px solid ${urgency === u ? 'var(--primary)' : 'var(--border-light)'}`,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {u}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</label>
                  <textarea 
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Describe your issue clearly..."
                    rows={4}
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-light)', fontSize: '0.875rem', color: 'var(--text-main)', resize: 'none', outline: 'none', fontFamily: 'inherit' }}
                  />
                </div>

                {errorMsg && (
                  <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8125rem', fontWeight: 600 }}>
                    {errorMsg}
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className={styles.btnPrimary}
                  style={{ width: '100%', padding: '12px' }}
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                  <span>{isSubmitting ? 'Submitting...' : 'Submit Maintenance Issue'}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

  // DESKTOP LAYOUT WRAPPER (Responsive)
  if (isDesktop) {
    return (
      <div className={styles.layout}>
        {/* BRANDED SIDEBAR */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <div className={styles.brandLogo}>
              <Building size={16} />
            </div>
            <div className={styles.brandNameContainer}>
              <span className={styles.brandName}>{tenantInfo?.pg_name || 'StaySync'}</span>
              <span className={styles.brandSubtitle}>Tenant Portal</span>
            </div>
          </div>
          
          <div className={styles.navContainer}>
            {navGroups.map((group, idx) => (
              <div key={idx} className={styles.navGroup} style={{ marginBottom: '16px' }}>
                <div className={styles.navGroupTitle}>{group.title}</div>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.id === 'Complaints';
                  return (
                    <button
                      key={item.id}
                      onClick={() => window.location.href = item.href}
                      className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                    >
                      <Icon size={16} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
            
            <div className={styles.navGroup} style={{ marginTop: 'auto' }}>
              <button
                onClick={() => window.location.href = '/tenant'}
                className={styles.navItem}
              >
                <User size={16} />
                <span>Settings</span>
              </button>
            </div>
          </div>

          <div className={styles.sidebarFooter} onClick={() => window.location.href = '/tenant'}>
            <img 
              src={tenantInfo?.face_picture || `https://ui-avatars.com/api/?name=${tenantInfo?.full_name || 'T'}&background=e5e7eb&color=111827`} 
              alt="Profile" 
              className={styles.avatar}
            />
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {tenantInfo?.full_name || 'Praneeth'}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                Tenant
              </span>
            </div>
            <LogOut size={16} color="var(--text-tertiary)" onClick={(e) => { e.stopPropagation(); handleLogout(); }} style={{ cursor: 'pointer' }} />
          </div>
        </aside>

        {/* RIGHT SIDE MAIN CANVAS CONTAINER */}
        <div className={styles.mainCanvas}>
          
          {/* TOP FIXED HEADER WITH CENTERED PAGE TITLE */}
          <header className={styles.header}>
            
            {/* LEFT: Spotlight Search */}
            <div className={styles.headerSearchContainer}>
              <div className={styles.searchBar}>
                <Search size={16} color="var(--text-tertiary)" />
                <input type="text" className={styles.searchInput} placeholder="Search anything..." />
                <div className={styles.searchShortcut}>Ctrl + K</div>
              </div>
            </div>

            {/* CENTER: PAGE TITLE */}
            <div className={styles.headerSpacer}>
              <div className={styles.headerTitleCenter}>
                <span className={styles.headerTitleText}>Complaints & Issues</span>
              </div>
            </div>

            {/* RIGHT: Action Cluster */}
            <div className={styles.headerActionCluster}>
              <button className={styles.iconBtn} title="Notifications">
                <Bell size={18} strokeWidth={2} />
              </button>
              
              <button className={styles.iconBtn} title="Help">
                <HelpCircle size={18} strokeWidth={2} />
              </button>
              
              <div className={styles.headerDivider}></div>
              
              <div className={styles.headerProfileTrigger}>
                <div className={styles.headerAvatar}>
                  {tenantInfo?.full_name ? tenantInfo.full_name.charAt(0).toUpperCase() : 'P'}
                </div>
                <div className={styles.headerProfileInfo}>
                  <span className={styles.headerProfileName}>{tenantInfo?.full_name?.split(' ')[0] || 'Praneeth'}</span>
                  <span className={styles.headerProfileRole}>Tenant</span>
                </div>
                <ChevronDown size={14} className={styles.headerProfileChevron} />
              </div>
            </div>
          </header>

          {/* DYNAMIC PAGE CONTENT */}
          <div className={styles.pageContainer}>
            {renderMainContent()}
          </div>
        </div>
      </div>
    );
  }

  // MOBILE LAYOUT FALLBACK
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px', margin: '0 auto', paddingBottom: '80px' }}>
      <div style={{ background: '#ffffff', borderRadius: '16px', padding: '16px 20px', border: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/tenant" style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Complaints & Issues</h1>
            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>
              Track & raise maintenance requests
            </div>
          </div>
        </div>

        <button 
          onClick={() => setShowForm(true)}
          style={{ background: '#4f46e5', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '10px', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
        >
          <Plus size={16} /> Raise Issue
        </button>
      </div>

      {renderMainContent()}

      {/* Modal for Mobile */}
      <AnimatePresence>
        {showForm && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '420px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}
            >
              <div style={{ background: '#ffffff', padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Raise an Issue</h3>
                <button onClick={() => setShowForm(false)} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
                  <X size={16} />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '6px', display: 'block', textTransform: 'uppercase' }}>Category</label>
                  <select 
                    value={category} 
                    onChange={e => setCategory(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '6px', display: 'block', textTransform: 'uppercase' }}>Urgency</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    {urgencies.map(u => (
                      <div 
                        key={u}
                        onClick={() => setUrgency(u)}
                        style={{ 
                          textAlign: 'center', padding: '8px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                          background: urgency === u ? '#4f46e5' : '#f1f5f9',
                          color: urgency === u ? 'white' : '#64748b'
                        }}
                      >
                        {u}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '6px', display: 'block', textTransform: 'uppercase' }}>Description</label>
                  <textarea 
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Describe the issue clearly..."
                    rows={3}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }}
                  />
                </div>

                {errorMsg && (
                  <div style={{ background: '#fef2f2', color: '#dc2626', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
                    {errorMsg}
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={isSubmitting}
                  style={{ background: '#4f46e5', color: 'white', padding: '12px', borderRadius: '10px', fontWeight: 600, fontSize: '0.95rem', border: 'none', cursor: 'pointer' }}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Issue'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

