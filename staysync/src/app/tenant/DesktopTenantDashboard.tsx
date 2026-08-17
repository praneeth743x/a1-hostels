import React, { useState, useEffect } from 'react';
import { 
  Home, CreditCard, Bell, User, 
  Wallet, ShieldCheck, ArrowRight, AlertTriangle, 
  LogOut, Building,
  Search, HelpCircle, Download, CheckCircle2, QrCode,
  ChevronDown, ChevronRight, Lock, Calendar, MessageSquare, MessageCircle, Send, KeyRound, X,
  FileText, FileX, Zap, Droplet, Sparkles, Wifi, Utensils, Plus, Loader2, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { getTenantComplaints, submitComplaint, addTenantComplaintReply, clearTenantChat } from '@/app/actions/complaints';
import { sendPasswordResetAction } from '@/app/actions/tenant';
import { useRouter } from 'next/navigation';
import styles from './DesktopTenantDashboard.module.css';

interface DesktopTenantDashboardProps {
  tenant: any;
  payments: any[];
  pendingDues: any[];
  notices: any[];
  tenantPaymentsEnabled?: boolean;
  activityLogs?: any[];
  paidDueIds: Set<string>;
  loading: boolean;
  handlePayment: (due: any) => void;
  isProcessing: boolean;
  errorMsg: string;
}

export default function DesktopTenantDashboard({
  tenant = {},
  payments = [],
  pendingDues = [],
  notices = [],
  tenantPaymentsEnabled = true,
  activityLogs = [],
  paidDueIds,
  loading,
  handlePayment,
  isProcessing,
  errorMsg
}: DesktopTenantDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'Dashboard' | 'Payments' | 'Notices' | 'Complaints' | 'Settings'>('Dashboard');

  // Toolbar & Table Controls State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'amount'>('newest');
  const [currentPage, setCurrentPage] = useState(1);

  // Zero Latency Complaints State
  const [complaintsList, setComplaintsList] = useState<any[]>([]);
  const [complaintsSearch, setComplaintsSearch] = useState('');
  const [complaintCategoryFilter, setComplaintCategoryFilter] = useState('All');
  const [complaintStatusFilter, setComplaintStatusFilter] = useState('All');
  
  // Issue Form State
  const [newCat, setNewCat] = useState('Electrical');
  const [newUrg, setNewUrg] = useState('Medium');
  const [newDesc, setNewDesc] = useState('');
  const [submittingIssue, setSubmittingIssue] = useState(false);
  const [issueErr, setIssueErr] = useState('');

  // Chat Box State
  const [selectedChatThreadId, setSelectedChatThreadId] = useState<string | null>(null);
  const [chatReplyInput, setChatReplyInput] = useState('');
  const [complaintReplyInput, setComplaintReplyInput] = useState('');
  
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [resetModalStatus, setResetModalStatus] = useState<{ type: 'success' | 'error' | null; msg: string }>({ type: null, msg: '' });
  const [sendingChatReply, setSendingChatReply] = useState(false);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [localChatClearedAt, setLocalChatClearedAt] = useState<string | null>(null);
  const effectiveChatClearedAt = localChatClearedAt || tenant?.chat_cleared_at || null;
  const [showClearChatConfirm, setShowClearChatConfirm] = useState(false);

  const categories = ['Electrical', 'Plumbing', 'Cleaning', 'Internet/WiFi', 'Food', 'Others'];
  const urgencies = ['Low', 'Medium', 'High'];

  const globalMessages = React.useMemo(() => {
    const msgs: any[] = [];
    const clearedTime = effectiveChatClearedAt ? new Date(effectiveChatClearedAt).getTime() : 0;
    complaintsList.forEach(c => {
      if (!c.messages || !Array.isArray(c.messages) || c.messages.length === 0) {
        const initTime = new Date(c.created_at || 0).getTime();
        if (initTime > clearedTime && c.description) {
          msgs.push({
            id: `init-${c.id}`,
            sender: 'tenant',
            message: c.description,
            timestamp: c.created_at,
            attachedComplaint: c,
            isInitial: true
          });
        }
      }
      if (c.resolution_comment) {
        const resTime = new Date(c.updated_at || c.created_at).getTime();
        if (resTime > clearedTime) {
          msgs.push({
            id: `res-${c.id}`,
            sender: 'owner',
            message: c.resolution_comment,
            timestamp: c.updated_at || c.created_at,
            attachedComplaint: c,
            isOwnerResolution: true
          });
        }
      }
      if (c.messages) {
        c.messages.forEach((m: any, idx: number) => {
          if (new Date(m.timestamp || 0).getTime() > clearedTime) {
            msgs.push({
              ...m,
              id: `msg-${c.id}-${idx}`,
              attachedComplaint: c
            });
          }
        });
      }
    });
    return msgs.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
  }, [complaintsList, effectiveChatClearedAt]);

  useEffect(() => {
    const userEmail = tenant.email || auth.currentUser?.email;
    if (userEmail) {
      getTenantComplaints(userEmail).then(res => {
        if (res.success) setComplaintsList(res.data || []);
      });
    }
  }, [tenant.email]);

  const activeDues = pendingDues.filter((d: any) => !paidDueIds.has(d.id));
  const pastPayments = payments
    .filter((d: any) => d.status === 'paid' || paidDueIds.has(d.id))
    .sort((a: any, b: any) => {
      const dateA = a.payment_date ? new Date(a.payment_date).getTime() : new Date(a.created_at || 0).getTime();
      const dateB = b.payment_date ? new Date(b.payment_date).getTime() : new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });
  const totalPendingAmount = activeDues.reduce((sum: number, due: any) => sum + Number(due.amount || 0), 0);
  
  const currentMonthPaid = pastPayments
    .filter(p => new Date(p.created_at || Date.now()).getMonth() === new Date().getMonth())
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const nextDueDate = new Date();
  nextDueDate.setDate(5);
  nextDueDate.setMonth(nextDueDate.getMonth() + 1);

  const primaryDue = activeDues.length > 0 ? activeDues[0] : null;

  const getDueDetails = (due: any) => {
    if (!due) return { dueDateStr: '-', overdueDays: 0, dueDateObj: new Date() };

    let dueDateObj: Date;
    if (due.due_date) {
      dueDateObj = new Date(due.due_date);
    } else if (due.created_at) {
      const created = new Date(due.created_at);
      dueDateObj = new Date(created.getFullYear(), created.getMonth(), 5);
    } else {
      const now = new Date();
      dueDateObj = new Date(now.getFullYear(), now.getMonth(), 5);
    }

    const now = new Date();
    const diffTime = now.getTime() - dueDateObj.getTime();
    const overdueDays = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

    const dueDateStr = dueDateObj.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

    return { dueDateStr, overdueDays, dueDateObj };
  };

  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesc.trim()) {
      setIssueErr('Please describe your issue.');
      return;
    }

    setSubmittingIssue(true);
    setIssueErr('');

    try {
      const userEmail = tenant.email || auth.currentUser?.email;
      const currentUid = auth.currentUser?.uid;
      if (!userEmail || !currentUid) throw new Error('Not authenticated');

      const res = await submitComplaint({
        tenantId: currentUid,
        tenantEmail: userEmail,
        category: newCat,
        description: newDesc,
        urgency: newUrg
      });

      if (!res.success) throw new Error(res.error || 'Failed to submit issue');

      // Zero-Latency Optimistic Update
      const newIssueObj = {
        id: res.id || Math.random().toString(),
        category: newCat,
        description: newDesc,
        urgency: newUrg,
        status: 'pending',
        created_at: new Date().toISOString(),
        tenant_name: tenant.full_name || 'Tenant'
      };

      setComplaintsList(prev => [newIssueObj, ...prev]);
      setNewDesc('');
      setNewCat('Electrical');
      setNewUrg('Medium');

    } catch (err: any) {
      setIssueErr(err.message || 'Submission error');
    } finally {
      setSubmittingIssue(false);
    }
  };

  const getCatIcon = (cat: string) => {
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

  const getCatBg = (cat: string) => {
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

  // Filtered Complaints for Complaints Tab
  const filteredComplaintsList = complaintsList.filter(c => {
    if (complaintCategoryFilter !== 'All' && c.category?.toLowerCase() !== complaintCategoryFilter.toLowerCase()) return false;
    if (complaintStatusFilter !== 'All' && c.status?.toLowerCase() !== complaintStatusFilter.toLowerCase()) return false;
    if (complaintsSearch) {
      const term = complaintsSearch.toLowerCase();
      const desc = (c.description || '').toLowerCase();
      const cat = (c.category || '').toLowerCase();
      if (!desc.includes(term) && !cat.includes(term)) return false;
    }
    return true;
  });

  const pendingComplaintsCount = complaintsList.filter(c => c.status !== 'resolved').length;
  const resolvedComplaintsCount = complaintsList.filter(c => c.status === 'resolved').length;

  // Filter & Sort Invoices
  const allInvoices = [
    ...activeDues.map((d: any) => ({ ...d, isPending: true })),
    ...pastPayments.map((p: any) => ({ ...p, isPending: false }))
  ];

  const filteredInvoices = allInvoices.filter((inv: any) => {
    if (statusFilter === 'pending' && !inv.isPending) return false;
    if (statusFilter === 'paid' && inv.isPending) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const invNum = `INV-${inv.month ? inv.month.toUpperCase() : '01'}`;
      const desc = (inv.description || inv.type || 'Rent Payment').toLowerCase();
      if (!invNum.toLowerCase().includes(term) && !desc.includes(term)) return false;
    }
    return true;
  });

  if (sortBy === 'oldest') {
    filteredInvoices.sort((a: any, b: any) => new Date(a.created_at || Date.now()).getTime() - new Date(b.created_at || Date.now()).getTime());
  } else if (sortBy === 'amount') {
    filteredInvoices.sort((a: any, b: any) => Number(b.amount || 0) - Number(a.amount || 0));
  } else {
    filteredInvoices.sort((a: any, b: any) => new Date(b.created_at || Date.now()).getTime() - new Date(a.created_at || Date.now()).getTime());
  }

  const pageSize = 8;
  const totalPages = Math.ceil(filteredInvoices.length / pageSize) || 1;
  const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error logging out:", error);
    } finally {
      localStorage.clear();
      sessionStorage.clear();
      sessionStorage.setItem('loggedOut', 'true');
      window.location.href = '/';
    }
  };

  const handleSendResetLink = async () => {
    setResetModalStatus({ type: null, msg: '' });
    const targetEmail = tenant?.email || auth.currentUser?.email;
    if (!targetEmail) {
      setResetModalStatus({ type: 'error', msg: 'No email address found for this account.' });
      return;
    }
    
    setResetModalStatus({ type: 'success', msg: 'Generating secure reset link...' });
    try {
      const appUrl = window.location.origin;
      const res = await sendPasswordResetAction(targetEmail, appUrl);
      if (res.success) {
        setResetModalStatus({ type: 'success', msg: '✅ Reset link sent! Check your inbox.' });
      } else {
        setResetModalStatus({ type: 'error', msg: res.error || 'Failed to send reset link.' });
      }
    } catch (err: any) {
      setResetModalStatus({ type: 'error', msg: 'An unexpected error occurred.' });
    }
  };

  const navGroups = [
    {
      title: "WORKSPACE",
      items: [
        { id: 'Dashboard', label: 'Overview', icon: Home },
        { id: 'Payments', label: 'Invoices & Billing', icon: CreditCard },
      ]
    },
    {
      title: "RESOURCES",
      items: [
        { id: 'Notices', label: 'Messages & Chat Box', icon: MessageCircle },
        { id: 'Complaints', label: 'Complaints & Issues', icon: MessageSquare },
      ]
    }
  ];

  // DASHBOARD SKELETON SHIMMER VIEW
  const renderDashboardSkeleton = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className={styles.kpiStrip}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={styles.kpiCard}>
            <div className={styles.kpiHeaderRow}>
              <div className={styles.skeleton} style={{ width: '40px', height: '40px', borderRadius: '10px' }} />
              <div className={styles.skeleton} style={{ width: '16px', height: '16px', borderRadius: '50%' }} />
            </div>
            <div className={styles.kpiContent} style={{ marginTop: '12px' }}>
              <div className={styles.skeleton} style={{ width: '100px', height: '14px', marginBottom: '8px' }} />
              <div className={styles.skeleton} style={{ width: '80px', height: '28px', marginBottom: '8px' }} />
              <div className={styles.skeleton} style={{ width: '130px', height: '12px' }} />
            </div>
          </div>
        ))}
      </div>

      <div className={styles.grid12}>
        <div className={styles.colSpan8}>
          <div className={styles.panel} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className={styles.skeleton} style={{ width: '200px', height: '24px' }} />
            <div className={styles.skeleton} style={{ width: '100%', height: '48px', borderRadius: '8px' }} />
            <div className={styles.skeleton} style={{ width: '100%', height: '48px', borderRadius: '8px' }} />
            <div className={styles.skeleton} style={{ width: '100%', height: '48px', borderRadius: '8px' }} />
          </div>
        </div>

        <div className={styles.colSpan4}>
          <div className={styles.panel} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className={styles.skeleton} style={{ width: '140px', height: '22px' }} />
            <div className={styles.skeleton} style={{ width: '100%', height: '120px', borderRadius: '12px' }} />
          </div>
        </div>
      </div>
    </div>
  );

  const handleReceiptAction = (paymentId: string) => {
    const isMobile = window.innerWidth < 768 || /Android|iPhone|iPad/i.test(navigator.userAgent);

    if (isMobile) {
      const link = document.createElement('a');
      link.href = `/api/receipt/pdf/${paymentId}`;
      link.download = `Fee_Receipt_${paymentId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      iframe.src = `/receipt/${paymentId}`;
      document.body.appendChild(iframe);

      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (e) {
            console.error("Print error:", e);
          } finally {
            setTimeout(() => {
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
            }, 2000);
          }
        }, 300);
      };
    }
  };

  // RENDER CLEAN INVOICES & BILLING HISTORY PANEL (FITS 100% WITH ZERO SCROLLING)
  const renderInvoiceTablePanel = () => (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>Invoices & Billing History</h3>
        <button className={styles.btnGhost} style={{ padding: '6px 12px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
          <span style={{ color: 'var(--text-main)' }}>All Status</span> <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} />
        </button>
      </div>
      
      <div className={styles.panelBodyNoPad}>
        <div className={styles.tableContainer}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Due Date</th>
                <th>Invoice</th>
                <th>Description</th>
                <th>Status</th>
                <th>Amount</th>
                <th className={styles.textRight}>Action</th>
              </tr>
            </thead>
            <tbody>
              {/* Active Dues */}
              {activeDues.map((due: any) => {
                const { dueDateStr, overdueDays } = getDueDetails(due);
                return (
                  <tr key={due.id}>
                    <td className={styles.fontMedium}>{dueDateStr}</td>
                    <td><span className={styles.invoiceBadge}>INV-{due.month ? due.month.toUpperCase() : 'RENT'}-01</span></td>
                    <td><span style={{textTransform: 'capitalize'}}>{due.description || due.type || 'Rent Payment'}</span></td>
                    <td><span className={`${styles.statusChip} ${styles.chipDanger}`}>Overdue by {overdueDays} day(s)</span></td>
                    <td className={styles.fontMedium}>₹{Number(due.amount).toLocaleString('en-IN')}</td>
                    <td className={styles.textRight}>
                      <button 
                        className={styles.btnOutline} 
                        onClick={() => handlePayment(due)}
                        disabled={!tenantPaymentsEnabled}
                        style={{ opacity: tenantPaymentsEnabled ? 1 : 0.5, cursor: tenantPaymentsEnabled ? 'pointer' : 'not-allowed' }}
                      >
                        {tenantPaymentsEnabled ? 'Pay Now' : 'Locked'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              
              {/* Past Payments */}
              {pastPayments.map((payment: any, index: number) => {
                const { dueDateStr, dueDateObj } = getDueDetails(payment);
                const paymentIdStr = payment.id || payment.payment_id || 'SS-RECEIPT';
                
                const payDate = payment.payment_date ? new Date(payment.payment_date) : new Date(payment.created_at || Date.now());
                const diffTime = payDate.getTime() - dueDateObj.getTime();
                const paidLateDays = diffTime > 0 ? Math.floor(diffTime / (1000 * 60 * 60 * 24)) : 0;

                return (
                  <tr key={payment.id || index}>
                    <td className={styles.fontMedium}>{dueDateStr}</td>
                    <td><span className={styles.invoiceBadge}>INV-{payment.month ? payment.month.toUpperCase() : 'PAID'}-{index + 1}</span></td>
                    <td><span style={{textTransform: 'capitalize'}}>{payment.description || payment.type || 'Rent Payment'}</span></td>
                    <td>
                      <span className={`${styles.statusChip} ${styles.chipSuccess}`}>Paid</span>
                      {paidLateDays > 0 && (
                        <span style={{ fontSize: '0.7rem', color: '#ef4444', marginLeft: '6px', fontWeight: 600 }}>({paidLateDays} days late)</span>
                      )}
                    </td>
                    <td className={styles.fontMedium}>₹{Number(payment.amount).toLocaleString('en-IN')}</td>
                    <td className={styles.textRight}>
                      <button 
                        className={styles.btnGhost} 
                        onClick={() => handleReceiptAction(paymentIdStr)}
                      >
                        <Download size={14} /> Receipt
                      </button>
                    </td>
                  </tr>
                );
              })}

              {activeDues.length === 0 && pastPayments.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-tertiary)' }}>
                    No payment history found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {activeTab === 'Dashboard' && (
        <div style={{ padding: '14px', textAlign: 'center', borderTop: '1px solid var(--border-light)' }}>
          <button className={styles.btnGhost} onClick={() => setActiveTab('Payments')}>View all invoices</button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <AnimatePresence>
        {showClearChatConfirm && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              style={{ background: 'white', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
                  <AlertTriangle size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.125rem', color: 'var(--text-main)', fontWeight: 600 }}>Clear Chat History</h3>
              </div>
              <p style={{ margin: '0 0 24px 0', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                Are you sure you want to clear your chat history? This will hide all previous messages for you, but they will still be visible to the PG owner.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowClearChatConfirm(false)}
                  style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const userEmail = tenant.email || auth.currentUser?.email;
                    if (userEmail) {
                      const now = new Date().toISOString();
                      setLocalChatClearedAt(now);
                      await clearTenantChat(userEmail);
                    }
                    setShowClearChatConfirm(false);
                  }}
                  style={{ padding: '8px 16px', background: '#dc2626', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 500, cursor: 'pointer' }}
                >
                  Clear Chat
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <div className={styles.layout}>
      {/* BRANDED SIDEBAR */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.brandLogo}>
            <Building size={16} />
          </div>
          <div className={styles.brandNameContainer}>
            <span className={styles.brandName}>{tenant?.pg_name || 'StaySync'}</span>
            <span className={styles.brandSubtitle}>Tenant Portal</span>
          </div>
        </div>
        
        <div className={styles.navContainer}>
          {navGroups.map((group, idx) => (
            <div key={idx} className={styles.navGroup} style={{ marginBottom: '16px' }}>
              <div className={styles.navGroupTitle}>{group.title}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
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
              onClick={() => setActiveTab('Settings')}
              className={`${styles.navItem} ${activeTab === 'Settings' ? styles.navItemActive : ''}`}
            >
              <User size={16} />
              <span>Settings</span>
            </button>
          </div>
        </div>

        <div className={styles.sidebarFooter} onClick={() => setActiveTab('Settings')}>
          <img 
            src={tenant.face_picture || `https://ui-avatars.com/api/?name=${tenant.full_name || 'T'}&background=e5e7eb&color=111827`} 
            alt="Profile" 
            className={styles.avatar}
          />
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {tenant.full_name || 'Praneeth'}
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
        
        {/* WORLD-CLASS DESKTOP HEADER WITH PAGE NAME IN CENTER */}
        <header className={styles.header}>
          
          {/* LEFT: Spotlight Search */}
          <div className={styles.headerSearchContainer}>
            <div className={styles.searchBar}>
              <Search size={16} color="var(--text-tertiary)" />
              <input type="text" className={styles.searchInput} placeholder="Search anything..." />
              <div className={styles.searchShortcut}>Ctrl + K</div>
            </div>
          </div>

          {/* CENTER: PAGE TITLE MARKED BY USER */}
          <div className={styles.headerSpacer}>
            <div className={styles.headerTitleCenter}>
              <span className={styles.headerTitleText}>{activeTab === 'Dashboard' ? 'Overview' : activeTab === 'Payments' ? 'Invoices & Billing' : activeTab === 'Notices' ? 'Messages & Chat Box' : activeTab === 'Complaints' ? 'Complaints & Issues' : activeTab}</span>
            </div>
          </div>

          {/* RIGHT: Action Cluster */}
          <div className={styles.headerActionCluster}>
            <button className={styles.iconBtn} title="Notifications">
              <Bell size={18} strokeWidth={2} />
              {notices.length > 0 && <span className={styles.badge} />}
            </button>
            
            <button className={styles.iconBtn} title="Help">
              <HelpCircle size={18} strokeWidth={2} />
            </button>
            
            <div className={styles.headerDivider}></div>
            
            <div className={styles.headerProfileTrigger}>
              <div className={styles.headerAvatar}>
                {tenant.full_name ? tenant.full_name.charAt(0).toUpperCase() : 'P'}
              </div>
              <div className={styles.headerProfileInfo}>
                <span className={styles.headerProfileName}>{tenant.full_name?.split(' ')[0] || 'Praneeth'}</span>
                <span className={styles.headerProfileRole}>Tenant</span>
              </div>
              <ChevronDown size={14} className={styles.headerProfileChevron} />
            </div>
          </div>
        </header>

        {/* DYNAMIC PAGE CONTENT */}
        <div className={styles.pageContainer}>
          
          {loading ? (
            renderDashboardSkeleton()
          ) : (
            <>
              {activeTab === 'Dashboard' && (
            <>
              {/* KPI STRIP - CLEAN ROBUST CARDS */}
              <div className={styles.kpiStrip}>
                <div className={styles.kpiCard}>
                  <div className={styles.kpiHeaderRow}>
                    <div className={`${styles.kpiIconWrapper} ${styles.bgDangerSoft}`}>
                      <CreditCard size={20} />
                    </div>
                    <ChevronRight size={16} className={styles.kpiChevron} />
                  </div>
                  <div className={styles.kpiContent}>
                    <div className={styles.kpiLabel}>Amount Due</div>
                    <div className={`${styles.kpiValue} ${activeDues.length > 0 ? styles.kpiValueDanger : ''}`}>
                      ₹{totalPendingAmount.toLocaleString('en-IN')}
                    </div>
                    <div className={`${styles.kpiContext} ${activeDues.length > 0 ? styles.kpiContextDanger : ''}`}>
                      {activeDues.length > 0 ? `Overdue by ${getDueDetails(primaryDue).overdueDays} day(s)` : 'No pending dues'}
                    </div>
                  </div>
                </div>

                <div className={styles.kpiCard}>
                  <div className={styles.kpiHeaderRow}>
                    <div className={`${styles.kpiIconWrapper} ${styles.bgSuccessSoft}`}>
                      <Wallet size={20} />
                    </div>
                    <ChevronRight size={16} className={styles.kpiChevron} />
                  </div>
                  <div className={styles.kpiContent}>
                    <div className={styles.kpiLabel}>Paid This Month</div>
                    <div className={styles.kpiValue}>₹{currentMonthPaid.toLocaleString('en-IN')}</div>
                    <div className={styles.kpiContext}>
                      Cleared for {new Date().toLocaleDateString('default', { month: 'short' })}
                    </div>
                  </div>
                </div>

                <div className={styles.kpiCard}>
                  <div className={styles.kpiHeaderRow}>
                    <div className={`${styles.kpiIconWrapper} ${styles.bgPrimarySoft}`}>
                      <Calendar size={20} />
                    </div>
                    <ChevronRight size={16} className={styles.kpiChevron} />
                  </div>
                  <div className={styles.kpiContent}>
                    <div className={styles.kpiLabel}>Next Due</div>
                    <div className={styles.kpiValue}>{nextDueDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</div>
                    <div className={styles.kpiContext}>Standard rent cycle</div>
                  </div>
                </div>

                <div className={styles.kpiCard} onClick={() => router.push('/tenant/complaints')}>
                  <div className={styles.kpiHeaderRow}>
                    <div className={`${styles.kpiIconWrapper} ${styles.bgPrimarySoft}`}>
                      <MessageSquare size={20} />
                    </div>
                    <ChevronRight size={16} className={styles.kpiChevron} />
                  </div>
                  <div className={styles.kpiContent}>
                    <div className={styles.kpiLabel}>COMPLAINTS</div>
                    <div className={styles.kpiValue} style={{ fontSize: '1.25rem' }}>
                      Raise / Track
                    </div>
                    <div className={styles.kpiContext}>Support & Maintenance</div>
                  </div>
                </div>
              </div>

              {/* 12-COLUMN MAIN SPLIT (8/4) */}
              <div className={styles.grid12}>
                
                {/* 8 COLUMNS: INVOICE TABLE PANEL */}
                <div className={styles.colSpan8}>
                  {renderInvoiceTablePanel()}
                </div>

                {/* 4 COLUMNS: PAYMENT DETAILS & UTILITIES */}
                <div className={styles.colSpan4}>
                  
                  <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                       <h3 className={styles.panelTitle}>Payment Details</h3>
                    </div>
                    <div className={styles.panelBody}>
                      {primaryDue ? (
                        <div className={styles.paymentCard}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span className={styles.fontSemibold} style={{ color: 'var(--text-main)', fontSize: '0.875rem' }}>{primaryDue.month} Due</span>
                            <span className={`${styles.statusChip} ${styles.chipWarning}`}>Pending</span>
                          </div>
                          <div style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '20px', letterSpacing: '-0.02em', color: 'var(--text-main)' }}>
                            ₹{Number(primaryDue.amount).toLocaleString('en-IN')}
                          </div>
                          
                          {errorMsg && <div style={{ color: 'var(--danger-text)', fontSize: '0.8125rem', marginBottom: '12px' }}>{errorMsg}</div>}
                          
                          <button 
                            className={styles.btnPrimary} 
                            onClick={() => handlePayment(primaryDue)}
                            disabled={isProcessing || !tenantPaymentsEnabled}
                            style={!tenantPaymentsEnabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                          >
                            <CreditCard size={18} /> {!tenantPaymentsEnabled ? 'Payments Locked' : (isProcessing ? 'Processing...' : 'Pay via Razorpay')}
                          </button>
                        </div>
                      ) : tenantPaymentsEnabled ? (
                        <div className={styles.paymentCard} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px', textAlign: 'center', background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)', color: 'white' }}>
                          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                            <CheckCircle2 size={22} color="#ffffff" />
                          </div>
                          <div className={styles.fontSemibold} style={{ color: '#ffffff' }}>No Pending Dues</div>
                          <div style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: '2px', marginBottom: '14px' }}>Online payments enabled by your hostel.</div>
                          <button 
                            className={styles.btnPrimary} 
                            onClick={() => handlePayment({ 
                              id: `custom_${Date.now()}`, 
                              amount: tenant?.monthly_rent || tenant?.rent_amount || 1170, 
                              month: 'Rent Payment', 
                              type: 'advance' 
                            })}
                            disabled={isProcessing}
                            style={{ width: '100%', background: '#ffffff', color: '#059669', fontWeight: 700, borderRadius: '12px', padding: '10px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                          >
                            <CreditCard size={16} /> Pay Rent / Advance (₹{Number(tenant?.monthly_rent || tenant?.rent_amount || 1170).toLocaleString('en-IN')})
                          </button>
                        </div>
                      ) : (
                        <div className={styles.paymentCard} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px', textAlign: 'center' }}>
                          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                            <CheckCircle2 size={24} color="var(--success-text)" />
                          </div>
                          <div className={styles.fontSemibold}>All Caught Up</div>
                          <div className={styles.textMuted} style={{ fontSize: '0.875rem', marginTop: '4px' }}>No pending invoices at this time.</div>
                        </div>
                      )}

                      <div style={{ marginTop: '20px' }}>
                         <div className={styles.quickLinkRow} onClick={() => setActiveTab('Payments')}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                               <CreditCard size={16} color="var(--text-secondary)" />
                               <span>View Payment History</span>
                            </div>
                            <ChevronRight size={16} color="var(--text-tertiary)" />
                         </div>
                         <div className={styles.quickLinkRow}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                               <Download size={16} color="var(--text-secondary)" />
                               <span>Download Receipts</span>
                            </div>
                            <ChevronRight size={16} color="var(--text-tertiary)" />
                         </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </>
          )}

          {/* INVOICES & BILLING TAB - FULL 12 COLUMNS */}
          {activeTab === 'Payments' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* BILLING SUMMARY STRIP */}
              <div className={styles.kpiStrip}>
                <div className={styles.kpiCard}>
                  <div className={styles.kpiHeaderRow}>
                    <div className={`${styles.kpiIconWrapper} ${styles.bgDangerSoft}`}>
                      <CreditCard size={20} />
                    </div>
                    <ChevronRight size={16} className={styles.kpiChevron} />
                  </div>
                  <div className={styles.kpiContent}>
                    <div className={styles.kpiLabel}>Total Pending Dues</div>
                    <div className={`${styles.kpiValue} ${activeDues.length > 0 ? styles.kpiValueDanger : ''}`}>
                      ₹{totalPendingAmount.toLocaleString('en-IN')}
                    </div>
                    <div className={`${styles.kpiContext} ${activeDues.length > 0 ? `${styles.kpiContextDanger}` : ''}`}>
                      {activeDues.length > 0 ? `${activeDues.length} invoice(s) outstanding` : 'All dues paid'}
                    </div>
                  </div>
                </div>

                <div className={styles.kpiCard}>
                  <div className={styles.kpiHeaderRow}>
                    <div className={`${styles.kpiIconWrapper} ${styles.bgSuccessSoft}`}>
                      <Wallet size={20} />
                    </div>
                    <ChevronRight size={16} className={styles.kpiChevron} />
                  </div>
                  <div className={styles.kpiContent}>
                    <div className={styles.kpiLabel}>Total Paid Amount</div>
                    <div className={styles.kpiValue}>
                      ₹{pastPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0).toLocaleString('en-IN')}
                    </div>
                    <div className={styles.kpiContext}>
                      {pastPayments.length} completed transaction(s)
                    </div>
                  </div>
                </div>

                <div className={styles.kpiCard}>
                  <div className={styles.kpiHeaderRow}>
                    <div className={`${styles.kpiIconWrapper} ${styles.bgPrimarySoft}`}>
                      <Calendar size={20} />
                    </div>
                    <ChevronRight size={16} className={styles.kpiChevron} />
                  </div>
                  <div className={styles.kpiContent}>
                    <div className={styles.kpiLabel}>Total Invoices</div>
                    <div className={styles.kpiValue}>
                      {activeDues.length + pastPayments.length}
                    </div>
                    <div className={styles.kpiContext}>
                      Billing history count
                    </div>
                  </div>
                </div>
              </div>

              {/* FULL WIDTH INVOICE TABLE (12 COLUMNS - NO SQUEEZING, 100% VISIBLE) */}
              <div className={styles.colSpan12}>
                {renderInvoiceTablePanel()}
              </div>
            </div>
          )}

          {/* MESSAGES & CHAT BOX TAB - ATTACHED COMPLAINTS & OWNER RESPONSES */}
          {activeTab === 'Notices' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', minHeight: '620px', alignItems: 'stretch' }}>
              
              {/* RIGHT COLUMN: ACTIVE CHAT WINDOW */}
              {(() => {
                const activeComplaint = selectedChatThreadId ? complaintsList.find(c => c.id === selectedChatThreadId) : null;

                return (
                  <div className={styles.panel} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', background: 'white', zIndex: 10 }}>
                      <button 
                        className={styles.btnGhost} 
                        style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#dc2626', border: '1px solid #fecdd3', borderRadius: '6px', background: '#fef2f2' }}
                        onClick={() => setShowClearChatConfirm(true)}
                      >
                        Clear Chat
                      </button>
                    </div>

                    {/* CHAT MESSAGES CANVAS */}
                    <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', background: '#fafafa' }}>
                      {loading ? (
                        <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                          <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                          <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Loading messages...</div>
                        </div>
                      ) : globalMessages.length === 0 ? (
                        <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                          <MessageSquare size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
                          <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>No messages yet</div>
                          <div style={{ fontSize: '0.8rem' }}>Send a message to start chatting</div>
                        </div>
                      ) : (
                        globalMessages.map((msg: any) => {
                        const isTenant = msg.sender === 'tenant';
                        return (
                          <div key={msg.id} style={{ alignSelf: isTenant ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                            {!isTenant && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#16a34a', color: 'white', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  O
                                </div>
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#15803d' }}>PG Owner</span>
                              </div>
                            )}
                            <div
                              style={{
                                background: isTenant ? '#4f46e5' : '#ffffff',
                                color: isTenant ? 'white' : 'var(--text-main)',
                                padding: '12px 16px',
                                borderRadius: isTenant ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                border: isTenant ? 'none' : '1px solid var(--border-light)',
                                fontSize: '0.9rem',
                                lineHeight: 1.5,
                                boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                              }}
                            >
                              {msg.isInitial && <div style={{ fontSize: '0.72rem', color: isTenant ? '#c7d2fe' : '#4f46e5', marginBottom: '4px', fontWeight: 600 }}>Original Complaint:</div>}
                              {msg.isOwnerResolution && <div style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={13} /> Official Owner Reply:</div>}
                              {!msg.isInitial && !msg.isOwnerResolution && msg.attachedComplaint && msg.attachedComplaint.category !== 'General Chat' && (
                                <div style={{ background: isTenant ? 'rgba(255,255,255,0.1)' : '#f8fafc', borderLeft: `4px solid ${isTenant ? '#c7d2fe' : '#4f46e5'}`, borderRadius: '4px 8px 8px 4px', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: isTenant ? '#c7d2fe' : '#4f46e5', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      {getCatIcon(msg.attachedComplaint.category)} {msg.attachedComplaint.category} Issue
                                    </span>
                                    <span style={{ fontSize: '0.65rem', color: isTenant ? 'rgba(255,255,255,0.7)' : 'var(--text-tertiary)' }}>
                                      ID: {msg.attachedComplaint.id?.substring(0, 8).toUpperCase()}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.8rem', color: isTenant ? 'rgba(255,255,255,0.9)' : 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {msg.attachedComplaint.description}
                                  </div>
                                </div>
                              )}
                              {msg.message}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textAlign: isTenant ? 'right' : 'left', marginTop: '4px' }}>
                              {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        );
                      }))}
                    </div>

                    {/* REPLY INPUT BAR */}
                    <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-light)', background: 'white', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      
                      {/* QUOTED COMPLAINT PREVIEW (WhatsApp style) */}
                      {activeComplaint && (
                        <div style={{ background: '#f8fafc', borderLeft: '4px solid #4f46e5', borderRadius: '4px 8px 8px 4px', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#4f46e5', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {getCatIcon(activeComplaint.category)} {activeComplaint.category} Issue
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                                ID: {activeComplaint.id?.substring(0, 8).toUpperCase()}
                              </span>
                              <button type="button" onClick={() => setSelectedChatThreadId(null)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '0', display: 'flex', alignItems: 'center' }}>
                                <FileX size={14} />
                              </button>
                            </div>
                          </div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {activeComplaint.description}
                          </div>
                        </div>
                      )}
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!chatReplyInput.trim()) return;
                          const text = chatReplyInput;
                          setChatReplyInput('');
                          setSendingChatReply(true);

                          const newMsg = { sender: 'tenant', message: text, timestamp: new Date().toISOString() };

                          if (activeComplaint) {
                            setComplaintsList(prev => prev.map(c => c.id === activeComplaint.id ? { ...c, messages: [...(c.messages || []), newMsg] } : c));
                            await addTenantComplaintReply(activeComplaint.id, text);
                            setSelectedChatThreadId(null);
                          } else {
                            let generalChat = complaintsList.find(c => c.category === 'General Chat');
                            if (generalChat) {
                              setComplaintsList(prev => prev.map(c => c.id === generalChat.id ? { ...c, messages: [...(c.messages || []), newMsg] } : c));
                              await addTenantComplaintReply(generalChat.id, text);
                            } else {
                              const tempId = 'temp-' + Date.now();
                              const newComplaint = {
                                id: tempId,
                                category: 'General Chat',
                                description: text,
                                status: 'open',
                                created_at: new Date().toISOString(),
                                messages: []
                              };
                              setComplaintsList(prev => [newComplaint, ...prev]);

                              const res = await submitComplaint({
                                tenantId: tenant.id || tenant.tenant_id,
                                tenantEmail: tenant.email,
                                category: 'General Chat',
                                urgency: 'Low',
                                description: text
                              });
                              if (res.success && res.id) {
                                setComplaintsList(prev => prev.map(c => c.id === tempId ? { ...c, id: res.id } : c));
                              }
                            }
                          }

                          setSendingChatReply(false);
                        }}
                        style={{ display: 'flex', gap: '10px', position: 'relative', alignItems: 'center' }}
                      >
                        {/* ATTACH BUTTON & MENU */}
                        <div style={{ position: 'relative' }}>
                          <button 
                            type="button" 
                            onClick={() => setIsAttachMenuOpen(!isAttachMenuOpen)}
                            style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'transparent', border: '2px solid #4f46e5', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s' }}
                          >
                            <Plus size={20} style={{ transform: isAttachMenuOpen ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                          </button>
                          
                          <AnimatePresence>
                            {isAttachMenuOpen && (
                              <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                transition={{ duration: 0.15 }}
                                style={{ position: 'absolute', bottom: 'calc(100% + 14px)', left: 0, width: '280px', background: 'white', borderRadius: '14px', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', border: '1px solid var(--border-light)', padding: '10px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '6px' }}
                              >
                                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-tertiary)', padding: '4px 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  Switch / Attach Issue
                                </div>
                                <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {complaintsList.filter(c => c.category !== 'General Chat').length === 0 ? (
                                    <div style={{ padding: '10px', fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>No active issues</div>
                                  ) : (
                                    complaintsList.filter(c => c.category !== 'General Chat').map(c => (
                                      <div 
                                        key={c.id} 
                                        onClick={() => { setSelectedChatThreadId(c.id); setIsAttachMenuOpen(false); }} 
                                        style={{ padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', background: selectedChatThreadId === c.id ? '#eef2ff' : 'transparent', display: 'flex', flexDirection: 'column', gap: '4px', transition: 'background 0.2s' }}
                                      >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: selectedChatThreadId === c.id ? '#4f46e5' : 'var(--text-main)' }}>
                                            {c.category} Issue
                                          </span>
                                          <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{c.status.toUpperCase()}</span>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                          {c.description}
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* TEXT INPUT (Takes up majority space) */}
                        <input
                          type="text"
                          placeholder="Type your message here..."
                          value={chatReplyInput}
                          onChange={e => setChatReplyInput(e.target.value)}
                          style={{ flex: 1, padding: '12px 18px', borderRadius: '24px', border: '1px solid var(--border-light)', fontSize: '0.9rem', outline: 'none', background: '#f8fafc' }}
                        />

                        {/* COMPACT SEND BUTTON */}
                        <button 
                          type="submit" 
                          className={styles.btnPrimary} 
                          disabled={sendingChatReply || !chatReplyInput.trim()} 
                          style={{ width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          {sendingChatReply ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} style={{ marginLeft: '2px' }} />}
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* COMPLAINTS & ISSUES TAB - FAST ZERO LATENCY */}
          {activeTab === 'Complaints' && (
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
                    <div className={styles.kpiValue}>{complaintsList.length}</div>
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
                    <div className={`${styles.kpiValue} ${pendingComplaintsCount > 0 ? styles.kpiValueDanger : ''}`}>
                      {pendingComplaintsCount}
                    </div>
                    <div className={`${styles.kpiContext} ${pendingComplaintsCount > 0 ? styles.kpiContextDanger : ''}`}>
                      {pendingComplaintsCount > 0 ? `${pendingComplaintsCount} awaiting resolution` : 'No open complaints'}
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
                    <div className={styles.kpiValue}>{resolvedComplaintsCount}</div>
                    <div className={styles.kpiContext}>Successfully completed</div>
                  </div>
                </div>
              </div>

              {/* 12-COLUMN MAIN SPLIT */}
              <div className={styles.grid12}>
                
                {/* LEFT COLUMN: ISSUES LIST & FILTERS */}
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
                          value={complaintsSearch}
                          onChange={(e) => setComplaintsSearch(e.target.value)}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        className={styles.toolbarSelect}
                        value={complaintCategoryFilter}
                        onChange={(e) => setComplaintCategoryFilter(e.target.value)}
                      >
                        <option value="All">All Categories</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>

                      <select
                        className={styles.toolbarSelect}
                        value={complaintStatusFilter}
                        onChange={(e) => setComplaintStatusFilter(e.target.value)}
                      >
                        <option value="All">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="in-progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </div>
                  </div>

                  {/* ISSUES CARDS LIST */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {filteredComplaintsList.length === 0 ? (
                      <div style={{ background: 'white', borderRadius: '16px', padding: '48px 24px', textAlign: 'center', border: '1px solid var(--border-light)' }}>
                        <FileX size={44} color="var(--border-strong)" style={{ margin: '0 auto 12px auto' }} />
                        <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 700, margin: 0 }}>No Issues Logged</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
                          Everything looks good! Use the form on the right to submit maintenance requests.
                        </p>
                      </div>
                    ) : (
                      filteredComplaintsList.map((complaint, index) => (
                        <div 
                          key={complaint.id || index}
                          style={{ background: 'white', borderRadius: '16px', padding: '20px', border: '1px solid var(--border-light)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: getCatBg(complaint.category), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {getCatIcon(complaint.category)}
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
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* RIGHT COLUMN: QUICK RAISE ISSUE FORM */}
                <div className={styles.colSpan4}>
                  <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                      <h3 className={styles.panelTitle}>Raise Maintenance Issue</h3>
                    </div>
                    <div className={styles.panelBody}>
                      <form onSubmit={handleIssueSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</label>
                          <select 
                            value={newCat} 
                            onChange={e => setNewCat(e.target.value)}
                            className={styles.toolbarSelect}
                            style={{ width: '100%' }}
                          >
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Urgency Level</label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                            {urgencies.map(u => (
                              <div 
                                key={u}
                                onClick={() => setNewUrg(u)}
                                style={{ 
                                  textAlign: 'center', padding: '10px 8px', borderRadius: '8px', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
                                  background: newUrg === u ? 'var(--primary)' : 'var(--bg-app)',
                                  color: newUrg === u ? 'white' : 'var(--text-secondary)',
                                  border: `1px solid ${newUrg === u ? 'var(--primary)' : 'var(--border-light)'}`,
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
                            value={newDesc}
                            onChange={e => setNewDesc(e.target.value)}
                            placeholder="Describe your issue clearly..."
                            rows={4}
                            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-light)', fontSize: '0.875rem', color: 'var(--text-main)', resize: 'none', outline: 'none', fontFamily: 'inherit' }}
                          />
                        </div>

                        {issueErr && (
                          <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8125rem', fontWeight: 600 }}>
                            {issueErr}
                          </div>
                        )}

                        <button 
                          type="submit"
                          disabled={submittingIssue}
                          className={styles.btnPrimary}
                          style={{ width: '100%', padding: '12px' }}
                        >
                          {submittingIssue ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                          <span>{submittingIssue ? 'Submitting...' : 'Submit Issue'}</span>
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SETTINGS / PROFILE TAB */}
          {activeTab === 'Settings' && (
            <div className={`${styles.panel} ${styles.colSpan12}`}>
              <div className={styles.panelHeader}>
                <h3 className={styles.panelTitle}>Account Settings & Profile</h3>
              </div>
              <div className={styles.panelBody}>
                <div style={{ display: 'flex', gap: '24px', alignItems: 'center', marginBottom: '32px' }}>
                  <img 
                    src={tenant.face_picture || `https://ui-avatars.com/api/?name=${tenant.full_name || 'Tenant'}&background=4f46e5&color=fff`} 
                    alt="Tenant Profile" 
                    style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary-light)' }}
                  />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>{tenant.full_name || 'Tenant User'}</h3>
                    <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{tenant.email || auth.currentUser?.email || 'N/A'}</p>
                    <span className={styles.statusChip} style={{ background: 'var(--primary-light)', color: 'var(--primary)', marginTop: '8px' }}>Verified Tenant</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div style={{ padding: '16px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>MOBILE NUMBER</span>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '4px' }}>{tenant.mobile || tenant.phone || 'N/A'}</div>
                  </div>

                  <div style={{ padding: '16px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>HOSTEL / PROPERTY</span>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '4px' }}>{tenant.pg_name || 'StaySync Managed Property'}</div>
                  </div>

                  <div style={{ padding: '16px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>ROOM NUMBER</span>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '4px' }}>{tenant.room?.room_number || tenant.room?.number || tenant.room_number || tenant.room_id || 'N/A'}</div>
                  </div>

                  <div style={{ padding: '16px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>CHECK-IN DATE</span>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '4px' }}>
                      {tenant.date_of_joining ? new Date(tenant.date_of_joining).toLocaleDateString('en-IN') : (tenant.created_at ? new Date(tenant.created_at).toLocaleDateString('en-IN') : 'N/A')}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '32px', display: 'flex', gap: '12px' }}>
                  <button className={styles.btnOutline} onClick={() => setIsPasswordModalOpen(true)} style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}>
                    <KeyRound size={16} /> Reset Password
                  </button>
                  <button className={styles.btnOutline} onClick={handleLogout}>
                    <LogOut size={16} /> Sign Out of Account
                  </button>
                </div>

                {/* ACTIVITY LOGS SECTION */}
                {activityLogs && activityLogs.length > 0 && (
                  <div style={{ marginTop: '40px', borderTop: '1px solid var(--border-light)', paddingTop: '32px' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock color="var(--primary)" size={18} /> Recent Activity
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {activityLogs.map((log: any, index: number) => (
                        <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', paddingBottom: '12px', borderBottom: index < activityLogs.length - 1 ? '1px dashed var(--border-light)' : 'none' }}>
                          <div style={{ padding: '8px', background: 'var(--bg-app)', borderRadius: '50%', color: 'var(--primary)' }}>
                            <Clock size={14} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 500 }}>{log.details || log.action || 'Activity Recorded'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                              {log.created_at ? new Date(log.created_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown Date'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          </>
          )}

        </div>
      </div>
    </div>

    <AnimatePresence>
      {isPasswordModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsPasswordModalOpen(false)}>
          <motion.div 
            className={styles.modalContent}
            style={{ maxWidth: '400px', width: '90%' }}
            initial={{ scale: 0.9, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 15 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <KeyRound size={20} color="var(--primary)" />
                Reset Password
              </h3>
              <button 
                onClick={() => setIsPasswordModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} color="var(--text-secondary)" />
              </button>
            </div>

            <div className={styles.modalBody}>
              <p style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Account: <strong>{tenant?.email || auth.currentUser?.email || 'N/A'}</strong>
              </p>

              {resetModalStatus.msg && (
                <div style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  marginBottom: '16px',
                  background: resetModalStatus.type === 'success' ? '#ECFDF5' : '#FEF2F2',
                  color: resetModalStatus.type === 'success' ? '#065F46' : '#991B1B',
                  border: `1px solid ${resetModalStatus.type === 'success' ? '#A7F3D0' : '#FECACA'}`
                }}>
                  {resetModalStatus.msg}
                </div>
              )}

              <p style={{ margin: '0 0 20px 0', fontSize: '0.9rem', color: 'var(--text-tertiary)' }}>
                Choose a method to reset your password. The email link will expire in exactly 1 minute.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button 
                  className={styles.btnPrimary} 
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => {
                    const email = tenant?.email || auth.currentUser?.email;
                    if(email) window.open(`https://accounts.google.com/signin/recovery?Email=${encodeURIComponent(email)}`, '_blank');
                  }}
                >
                  Verify with Google Account
                </button>
                
                <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: '4px 0', fontWeight: 600 }}>OR</div>
                
                <button 
                  className={styles.btnOutline} 
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={handleSendResetLink}
                >
                  Send Reset Link to Email
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>
  );
}



