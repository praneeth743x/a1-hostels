"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, CheckCircle, Clock, AlertTriangle, RefreshCw, Send, ShieldCheck, 
  Smartphone, Zap, Search, Activity, Play, X, Image as ImageIcon, UploadCloud
} from 'lucide-react';
import { 
  fetchWhatsAppLogsAction, 
  fetchWhatsAppMetricsAction, 
  testWhatsAppConnectionAction,
  getWhatsAppBannersAction,
  saveWhatsAppBannerAction
} from '@/app/actions/whatsappActions';
import { WhatsAppLogEntry } from '@/lib/whatsappConfig';
import { CustomSelect } from '@/components/CustomSelect';
import { toast } from 'react-hot-toast';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import imageCompression from 'browser-image-compression';

const DEFAULT_BANNER_URL = 'https://lh3.googleusercontent.com/aida-public/AB6AXuB1ybc4RDJcJCi0vesS4Kdhno7cvHG0nV0SrX9qYRRAuNE74f3AT9fvhQZSh6QXDC0MTiIjZfRyKlpYhZYt3nwU-m4ryDwg9eKqZfmuw8pDCIdLe0qvQnHSFWF_cQMaYigYn9TFDVs1fDCRbIqTnsPlQtDgbeuyyP5PQI5oNXy3bLkwMzLqMMLzwWcqn5GmEWcloVC5iheKI9ghf6sKn6QYheYdxLVQyrvIIHSDSfDzjTF7tulkyPnH';

export default function WhatsAppDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [metrics, setMetrics] = useState({
    totalMessages: 0,
    todayMessages: 0,
    deliveredCount: 0,
    readCount: 0,
    failedCount: 0,
    successRate: 100,
    deliveredRate: 0,
    readRate: 0,
    failedRate: 0,
    templateUsage: {} as Record<string, number>
  });

  const [logs, setLogs] = useState<WhatsAppLogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Banner State for 3 Templates (Welcome, Due Today, Overdue)
  const [banners, setBanners] = useState<{
    welcomeBannerUrl?: string | null;
    dueBannerUrl?: string | null;
    overdueBannerUrl?: string | null;
  }>({});
  const [activeTemplateTab, setActiveTemplateTab] = useState<'welcome' | 'due' | 'overdue'>('welcome');
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  // Mobile Header Tab Switcher ('api' | 'templates')
  const [mobileHeaderTab, setMobileHeaderTab] = useState<'api' | 'templates'>('api');

  // Test Connection State
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testPhone, setTestPhone] = useState('919876543210');
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    stepResults: { step: string; status: 'SUCCESS' | 'FAILED'; details?: any }[];
    overallError?: string;
  } | null>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [mRes, lRes, bRes] = await Promise.all([
        fetchWhatsAppMetricsAction(),
        fetchWhatsAppLogsAction(100),
        getWhatsAppBannersAction()
      ]);

      if (mRes.success && mRes.metrics) {
        setMetrics(mRes.metrics);
      }
      if (lRes.success && lRes.logs) {
        setLogs(lRes.logs);
      }
      if (bRes.success && bRes.banners) {
        setBanners(bRes.banners);
      }
    } catch (e) {
      console.error('Error loading WhatsApp dashboard:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(false);
    const interval = setInterval(() => loadData(false), 10000); // Polling every 10s
    return () => clearInterval(interval);
  }, []);

  const templateConfigMap = {
    welcome: {
      key: 'welcome' as const,
      label: 'Welcome Message',
      code: 'tenant_welcome_v1',
      desc: 'Sent automatically when a new tenant moves in',
      badgeColor: '#a7f3d0',
      currentUrl: banners.welcomeBannerUrl || DEFAULT_BANNER_URL
    },
    due: {
      key: 'due' as const,
      label: 'Due Today Reminder',
      code: 'due_day_reminderv1',
      desc: 'Sent on rent due date with payment link',
      badgeColor: '#bae6fd',
      currentUrl: banners.dueBannerUrl || DEFAULT_BANNER_URL
    },
    overdue: {
      key: 'overdue' as const,
      label: 'Overdue Reminder',
      code: 'overdue_v1',
      desc: 'Sent when tenant rent payment is overdue',
      badgeColor: '#fef08a',
      currentUrl: banners.overdueBannerUrl || DEFAULT_BANNER_URL
    }
  };

  const selectedTemplate = templateConfigMap[activeTemplateTab];

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>, templateKey: 'welcome' | 'due' | 'overdue') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingBanner(true);
    try {
      const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1200, useWebWorker: true };
      let fileToUpload = file;
      try {
        fileToUpload = await imageCompression(file, options);
      } catch (err) {
        console.warn('Compression failed, uploading original:', err);
      }

      const storageRef = ref(storage, `whatsapp_banners/${templateKey}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '')}`);
      await uploadBytes(storageRef, fileToUpload);
      const downloadedUrl = await getDownloadURL(storageRef);

      const saveRes = await saveWhatsAppBannerAction({ templateKey, bannerUrl: downloadedUrl });
      if (saveRes.success) {
        setBanners(prev => ({
          ...prev,
          [`${templateKey}BannerUrl`]: downloadedUrl
        }));
        toast.success(`✅ ${templateConfigMap[templateKey].label} image header updated!`);
      } else {
        toast.error('Failed to save banner URL: ' + saveRes.error);
      }
    } catch (err: any) {
      console.error('Banner upload error:', err);
      toast.error('Image upload failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleRunTest = async () => {
    setTestRunning(true);
    setTestResult(null);
    try {
      const res = await testWhatsAppConnectionAction(testPhone);
      setTestResult(res);
    } catch (error: any) {
      setTestResult({
        success: false,
        stepResults: [{ step: 'Execution', status: 'FAILED', details: error.message }],
        overallError: error.message
      });
    } finally {
      setTestRunning(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      (log.tenantName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.phoneNumber || '').includes(searchTerm) ||
      (log.templateName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.messageId || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || log.status.toUpperCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'read':
        return <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}><CheckCircle size={11} /> Read</span>;
      case 'delivered':
        return <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}><CheckCircle size={11} /> Delivered</span>;
      case 'sent':
        return <span style={{ background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Clock size={11} /> Sent</span>;
      case 'failed':
        return <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '3px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}><AlertTriangle size={11} /> Failed</span>;
      default:
        return <span style={{ background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700 }}>{status}</span>;
    }
  };

  return (
    <div style={{ padding: isMobile ? '12px 14px 100px 14px' : '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      
      {/* ── MOBILE HORIZONTAL TOGGLE BAR (2 BUTTONS: CLOUD API & MESSAGE TEMPLATES) ── */}
      {isMobile && (
        <div style={{
          display: 'flex',
          gap: '6px',
          background: '#e2e8f0',
          padding: '4px',
          borderRadius: '14px',
          marginBottom: '14px',
          border: '1px solid #cbd5e1'
        }}>
          <button
            onClick={() => setMobileHeaderTab('api')}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: '10px',
              border: 'none',
              background: mobileHeaderTab === 'api' ? 'linear-gradient(135deg, #075e54, #128c7e)' : 'transparent',
              color: mobileHeaderTab === 'api' ? '#ffffff' : '#475569',
              fontWeight: 800,
              fontSize: '0.8rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: mobileHeaderTab === 'api' ? '0 4px 12px rgba(7, 94, 84, 0.3)' : 'none'
            }}
          >
            <MessageSquare size={16} />
            Cloud API Suite
          </button>

          <button
            onClick={() => setMobileHeaderTab('templates')}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: '10px',
              border: 'none',
              background: mobileHeaderTab === 'templates' ? 'linear-gradient(135deg, #0f766e, #115e59)' : 'transparent',
              color: mobileHeaderTab === 'templates' ? '#ffffff' : '#475569',
              fontWeight: 800,
              fontSize: '0.8rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: mobileHeaderTab === 'templates' ? '0 4px 12px rgba(15, 118, 110, 0.3)' : 'none'
            }}
          >
            <ImageIcon size={16} />
            Message Templates
          </button>
        </div>
      )}

      {/* ── HEADER GRID (DESKTOP: SIDE-BY-SIDE 2 BOXES | MOBILE: SHOW SELECTED TOGGLE TAB) ── */}
      <div style={{
        display: isMobile ? 'block' : 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
        gap: isMobile ? '14px' : '20px',
        marginBottom: isMobile ? '16px' : '28px'
      }}>

        {/* BOX 1 (LEFT): WhatsApp Cloud API Suite */}
        {(!isMobile || mobileHeaderTab === 'api') && (
          <div style={{
            background: 'linear-gradient(135deg, #075e54 0%, #128c7e 100%)',
            borderRadius: isMobile ? '16px' : '24px',
            padding: isMobile ? '18px' : '24px',
            color: '#ffffff',
            boxShadow: '0 10px 25px rgba(7, 94, 84, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '200px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#25D366', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', flexShrink: 0 }}>
                  <MessageSquare size={24} />
                </div>
                <div>
                  <h1 style={{ fontSize: isMobile ? '1.25rem' : '1.45rem', fontWeight: 800, margin: 0, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                    WhatsApp Cloud API Suite
                  </h1>
                  <p style={{ fontSize: '0.8rem', opacity: 0.9, margin: '3px 0 0 0' }}>
                    Meta WABA outbound messaging & webhook analytics
                  </p>
                </div>
              </div>

              {/* Badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                <span style={{ fontSize: '0.72rem', color: '#ffffff', fontWeight: 700, background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)', padding: '3px 10px', borderRadius: '999px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <ShieldCheck size={12} color="#a7f3d0" /> Meta WABA Verified
                </span>
                <span style={{ fontSize: '0.72rem', color: '#ffffff', fontWeight: 700, background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)', padding: '3px 10px', borderRadius: '999px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Smartphone size={12} color="#bae6fd" /> Coexistence Active
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                onClick={() => setIsTestModalOpen(true)}
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '10px 16px',
                  borderRadius: '12px',
                  background: '#ffffff',
                  color: '#075e54',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.2s ease'
                }}
              >
                <Zap size={16} color="#075e54" />
                Test Connection
              </button>

              <button
                onClick={() => loadData(true)}
                disabled={refreshing}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '10px 16px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
                {refreshing ? 'Syncing...' : 'Sync'}
              </button>
            </div>
          </div>
        )}

        {/* BOX 2 (RIGHT): Message Template Image Manager (3 Image Templates) */}
        {(!isMobile || mobileHeaderTab === 'templates') && (
          <div style={{
            background: 'linear-gradient(135deg, #0f766e 0%, #115e59 100%)',
            borderRadius: isMobile ? '16px' : '24px',
            padding: isMobile ? '18px' : '24px',
            color: '#ffffff',
            boxShadow: '0 10px 25px rgba(15, 118, 110, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '200px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(255,255,255,0.2)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ImageIcon size={22} />
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: isMobile ? '1.25rem' : '1.45rem', fontWeight: 800, margin: 0, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                    Template Image Manager
                  </h2>
                  <p style={{ fontSize: '0.78rem', opacity: 0.9, margin: '2px 0 0 0' }}>
                    Manage header images for 3 WhatsApp templates
                  </p>
                </div>
              </div>

              {/* Template Selector Tabs (Welcome, Due Today, Overdue) */}
              <div style={{ display: 'flex', gap: '4px', background: 'rgba(0, 0, 0, 0.25)', padding: '4px', borderRadius: '12px', marginBottom: '12px' }}>
                {(['welcome', 'due', 'overdue'] as const).map((key) => {
                  const isActive = activeTemplateTab === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveTemplateTab(key)}
                      style={{
                        flex: 1,
                        padding: '6px 4px',
                        borderRadius: '8px',
                        border: 'none',
                        background: isActive ? '#ffffff' : 'transparent',
                        color: isActive ? '#0f766e' : '#ffffff',
                        fontWeight: isActive ? 800 : 600,
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        textAlign: 'center',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {key === 'welcome' && '👋 Welcome'}
                      {key === 'due' && '⏰ Due Today'}
                      {key === 'overdue' && '🚨 Overdue'}
                    </button>
                  );
                })}
              </div>

              {/* Image Preview & Active Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(0, 0, 0, 0.2)', padding: '10px 14px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.15)', marginBottom: '14px' }}>
                <div style={{ width: '56px', height: '38px', borderRadius: '8px', overflow: 'hidden', background: '#042f2e', flexShrink: 0, border: '1px solid rgba(255, 255, 255, 0.3)' }}>
                  <img src={selectedTemplate.currentUrl} alt={selectedTemplate.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{selectedTemplate.label}</span>
                    <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.2)', color: '#99f6e4', padding: '1px 6px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 700 }}>
                      {selectedTemplate.code}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                    {selectedTemplate.desc}
                  </div>
                </div>
              </div>
            </div>

            {/* Upload Button */}
            <div>
              <label style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                padding: '10px 16px',
                borderRadius: '12px',
                background: '#ffffff',
                color: '#0f766e',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: isUploadingBanner ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box'
              }}>
                {isUploadingBanner ? <RefreshCw size={16} className="spin" /> : <UploadCloud size={16} color="#0f766e" />}
                <span>{isUploadingBanner ? 'Uploading Banner...' : `Upload Image for ${selectedTemplate.label}`}</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={isUploadingBanner}
                  onChange={(e) => handleBannerUpload(e, activeTemplateTab)}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>
        )}

      </div>

      {/* ── METRICS GRID (2x2 on Mobile, 4x1 on Desktop) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? '10px' : '18px', marginBottom: isMobile ? '16px' : '32px' }}>
        
        {/* Card 1: Today's Messages */}
        <div style={{ background: '#ffffff', padding: isMobile ? '14px' : '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: isMobile ? '0.7rem' : '0.82rem', fontWeight: 700 }}>
            <span>TODAY'S MSGS</span>
            <Send size={16} color="#0284c7" />
          </div>
          <div style={{ fontSize: isMobile ? '1.5rem' : '1.9rem', fontWeight: 800, color: '#0f172a', marginTop: '6px' }}>
            {metrics.todayMessages}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
            Total Lifetime: {metrics.totalMessages}
          </div>
        </div>

        {/* Card 2: Success Rate */}
        <div style={{ background: '#ffffff', padding: isMobile ? '14px' : '20px', borderRadius: '16px', border: '1px solid #bbf7d0', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#166534', fontSize: isMobile ? '0.7rem' : '0.82rem', fontWeight: 700 }}>
            <span>SUCCESS RATE</span>
            <CheckCircle size={16} color="#16a34a" />
          </div>
          <div style={{ fontSize: isMobile ? '1.5rem' : '1.9rem', fontWeight: 800, color: '#15803d', marginTop: '6px' }}>
            {metrics.successRate}%
          </div>
          <div style={{ fontSize: '0.7rem', color: '#166534', marginTop: '2px' }}>
            Sent + Delivered + Read
          </div>
        </div>

        {/* Card 3: Delivered & Read */}
        <div style={{ background: '#ffffff', padding: isMobile ? '14px' : '20px', borderRadius: '16px', border: '1px solid #bae6fd', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#0369a1', fontSize: isMobile ? '0.7rem' : '0.82rem', fontWeight: 700 }}>
            <span>DELIVERED/READ</span>
            <Activity size={16} color="#0284c7" />
          </div>
          <div style={{ fontSize: isMobile ? '1.5rem' : '1.9rem', fontWeight: 800, color: '#0369a1', marginTop: '6px' }}>
            {metrics.deliveredRate}%
          </div>
          <div style={{ fontSize: '0.7rem', color: '#0369a1', marginTop: '2px' }}>
            Delivered: {metrics.deliveredCount} | Read: {metrics.readCount}
          </div>
        </div>

        {/* Card 4: Failed Messages */}
        <div style={{ background: '#ffffff', padding: isMobile ? '14px' : '20px', borderRadius: '16px', border: '1px solid #fecaca', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#991b1b', fontSize: isMobile ? '0.7rem' : '0.82rem', fontWeight: 700 }}>
            <span>FAILED MSGS</span>
            <AlertTriangle size={16} color="#dc2626" />
          </div>
          <div style={{ fontSize: isMobile ? '1.5rem' : '1.9rem', fontWeight: 800, color: '#b91c1c', marginTop: '6px' }}>
            {metrics.failedCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#991b1b', marginTop: '2px' }}>
            Failure Rate: {metrics.failedRate}%
          </div>
        </div>

      </div>

      {/* ── RECENT ACTIVITY LOGS CONTAINER ── */}
      <div style={{ background: '#ffffff', borderRadius: isMobile ? '16px' : '24px', border: '1px solid #e2e8f0', boxShadow: '0 8px 30px rgba(0,0,0,0.04)', padding: isMobile ? '14px' : '24px' }}>
        
        {/* Logs Section Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: isMobile ? '1rem' : '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Recent WhatsApp Logs
            </h2>
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0 0' }}>
              Real-time outbound notification & webhook logs
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', width: isMobile ? '100%' : 'auto' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search tenant, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px 8px 30px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.8rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Filter Dropdown */}
            <div style={{ width: '140px' }}>
              <CustomSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'ALL', label: 'All' },
                  { value: 'SENT', label: 'Sent' },
                  { value: 'DELIVERED', label: 'Delivered' },
                  { value: 'READ', label: 'Read' },
                  { value: 'FAILED', label: 'Failed' },
                ]}
              />
            </div>
          </div>
        </div>

        {/* ── MOBILE AUDIT CARDS (FOR MOBILE SCREENS) ── */}
        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>
                {loading ? 'Loading logs...' : 'No WhatsApp logs matching search.'}
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id || log.messageId || Math.random()}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '14px',
                    border: '1px solid #f1f5f9',
                    background: '#f8fafc',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                      {log.tenantName || 'Tenant'}
                    </span>
                    {getStatusBadge(log.status)}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#475569' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>+{log.phoneNumber}</span>
                    <span style={{ background: '#e0f2fe', color: '#0284c7', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>
                      {log.templateName}
                    </span>
                  </div>

                  {log.failedReason && (
                    <div style={{ fontSize: '0.72rem', color: '#dc2626', background: '#fee2e2', padding: '4px 8px', borderRadius: '6px', fontWeight: 600 }}>
                      ⚠️ {log.failedReason}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px', paddingTop: '4px', borderTop: '1px dashed #e2e8f0' }}>
                    <span>By: {log.triggeredBy || 'system'}</span>
                    <span>{new Date(log.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* ── DESKTOP LOGS TABLE (FOR DESKTOP SCREENS) ── */
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                  <th style={{ padding: '12px 16px', borderRadius: '10px 0 0 10px' }}>TENANT / RECIPIENT</th>
                  <th style={{ padding: '12px 16px' }}>PHONE NUMBER</th>
                  <th style={{ padding: '12px 16px' }}>TEMPLATE / TYPE</th>
                  <th style={{ padding: '12px 16px' }}>STATUS</th>
                  <th style={{ padding: '12px 16px' }}>TRIGGERED BY</th>
                  <th style={{ padding: '12px 16px', borderRadius: '0 10px 10px 0' }}>TIMESTAMP</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8', fontWeight: 600 }}>
                      {loading ? 'Loading logs...' : 'No WhatsApp logs matching filter.'}
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id || log.messageId || Math.random()} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s ease' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: '#0f172a' }}>
                        {log.tenantName || 'N/A'}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#334155', fontFamily: 'monospace' }}>
                        +{log.phoneNumber}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ background: '#f1f5f9', color: '#0284c7', padding: '3px 8px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700 }}>
                          {log.templateName}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {getStatusBadge(log.status)}
                        {log.failedReason && (
                          <div style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: '4px', maxWidth: '220px' }}>
                            ⚠️ {log.failedReason}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '0.78rem' }}>
                        {log.triggeredBy || 'system'}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                        {new Date(log.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* ── TEST CONNECTION MODAL ── */}
      <AnimatePresence>
        {isTestModalOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              style={{ background: '#ffffff', width: '100%', maxWidth: '540px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 25px 50px rgba(0,0,0,0.2)', padding: isMobile ? '18px' : '28px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}
            >
              <button
                onClick={() => setIsTestModalOpen(false)}
                style={{ position: 'absolute', right: '16px', top: '16px', background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={16} color="#64748b" />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <Zap size={22} color="#0284c7" />
                <h3 style={{ fontSize: isMobile ? '1.05rem' : '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Test Connection & Meta WABA Diagnostic
                </h3>
              </div>

              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 16px 0', lineHeight: 1.4 }}>
                Verifies access token authentication, Phone Number ID status, WABA reachability, and sends a live test notification.
              </p>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Test Mobile Number (E.164 format)
                </label>
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="919876543210"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <button
                onClick={handleRunTest}
                disabled={testRunning}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #075e54, #128c7e)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {testRunning ? <RefreshCw size={16} className="spin" /> : <Play size={16} />}
                {testRunning ? 'Running Meta Diagnostics...' : 'Run Connection Test'}
              </button>

              {/* Diagnostic Results */}
              {testResult && (
                <div style={{ marginTop: '16px', background: '#f8fafc', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: testResult.success ? '#15803d' : '#b91c1c', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {testResult.success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                    {testResult.success ? 'WhatsApp Cloud API Connected & Working!' : 'Diagnostic Error Detected'}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {testResult.stepResults.map((step, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', background: '#ffffff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                        <span style={{ fontWeight: 700, color: '#334155' }}>{step.step}</span>
                        <span style={{ color: step.status === 'SUCCESS' ? '#16a34a' : '#dc2626', fontWeight: 800 }}>
                          {step.status}
                        </span>
                      </div>
                    ))}
                  </div>

                  {testResult.overallError && (
                    <div style={{ marginTop: '8px', padding: '8px', background: '#fee2e2', borderRadius: '6px', color: '#991b1b', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                      {testResult.overallError}
                    </div>
                  )}
                </div>
              )}
            </motion.div>

          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
