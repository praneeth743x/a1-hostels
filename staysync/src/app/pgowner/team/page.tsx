"use client";

import { useConfirm } from '@/context/ConfirmContext';
import { toast } from 'react-hot-toast';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useHostel, usePermissions } from '@/context/HostelContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { 
  Users, UserPlus, Shield, ShieldCheck, CheckCircle2, Clock, AlertTriangle, 
  Search, Filter, Plus, Edit3, Trash2, Power, Eye, Lock, CheckSquare, 
  ChevronRight, Building, Mail, Phone, Calendar, RefreshCw, Layers, 
  TrendingUp, Award, Activity, FileText, Check, X, Sliders, ChevronDown, 
  ArrowRight, ShieldAlert, Sparkles, MessageSquare, Camera
} from 'lucide-react';
import { rpcCall } from '@/lib/rpc';
import type { TeamMember, TaskItem, ActivityLogEntry } from '@/app/actions/teamActions';
import { PERMISSIONS, type TeamMemberPermissions } from '@/constants/permissions';
import styles from '../dashboard.module.css';

export default function PGOwnerTeamPage() {
  const confirm = useConfirm();
  const { properties, selectedProperty } = useHostel();
  const [userUid, setUserUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobileView, setIsMobileView] = useState(false);

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<'directory' | 'tasks' | 'timeline' | 'performance'>('directory');

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Data states
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Modals & Drawers
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [editingPermissionsMember, setEditingPermissionsMember] = useState<TeamMember | null>(null);

  // Form states for Edit Member Permissions & Hostels
  const [editPermissions, setEditPermissions] = useState<TeamMemberPermissions>({
    viewDashboard: true, viewTenants: true, manageTenants: true, addTenant: true, editTenant: true, deleteTenant: false,
    viewRooms: true, manageRooms: true, deleteRooms: false, resolveComplaints: true, editMenu: false, viewReports: true, exportReports: false,
    addExpense: true, deleteExpense: false, sendWhatsAppMessages: true, approveTemplates: false,
    createNotices: true, deleteNotices: false, generateDues: true, collectPayments: true, printReceipts: true,
    viewHistory: true, deleteHistory: false, viewMembers: false, manageMembers: false, manageProperty: false
  });
  const [editPropertyPermissions, setEditPropertyPermissions] = useState<Record<string, TeamMemberPermissions>>({});
  const [selectedPermissionScope, setSelectedPermissionScope] = useState<string>('GLOBAL'); // 'GLOBAL' or pg_id
  const [editAssignedProps, setEditAssignedProps] = useState<string[]>([]);
  const [editRoleTitle, setEditRoleTitle] = useState<string>('');
  const [savingPermissions, setSavingPermissions] = useState(false);

  const DEFAULT_ROLE_PRESETS = ['Manager', 'Accountant', 'Receptionist', 'Maintenance', 'Security', 'Cleaner', 'Custom Role'];
  const [rolePresets, setRolePresets] = useState<string[]>(DEFAULT_ROLE_PRESETS);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('staySync_rolePresets');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) setRolePresets(parsed);
        } catch (e) {}
      }
    }
  }, []);
  const [isAddingNewPreset, setIsAddingNewPreset] = useState(false);
  const [newPresetInput, setNewPresetInput] = useState('');
  const [customRoleTitle, setCustomRoleTitle] = useState('Manager');

  const handleSavePermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPermissionsMember?.id) return;
    setSavingPermissions(true);

    try {
      const { rpcCall } = await import('@/lib/rpc');
      const res = await rpcCall('updateTeamMemberPermissionsAction', {
        memberId: editingPermissionsMember.id,
        permissions: editPermissions,
        propertyPermissions: editPropertyPermissions,
        role: editRoleTitle.trim() || editingPermissionsMember.role,
        assignedProperties: editAssignedProps
      });

      if (res.success) {
        setEditingPermissionsMember(null);
        if (selectedMember && selectedMember.id === editingPermissionsMember.id) {
          setSelectedMember({
            ...selectedMember,
            role: editRoleTitle.trim() || selectedMember.role,
            permissions: editPermissions,
            property_permissions: editPropertyPermissions,
            assigned_properties: editAssignedProps
          });
        }
        if (userUid) fetchData(userUid);
        toast.success("✅ Permissions & Hostel scoping updated!");
      } else {
        toast.error(res.error || 'Failed to update member permissions');
      }
    } catch (err: any) {
      toast.error(err.message || 'Update failed');
    } finally {
      setSavingPermissions(false);
    }
  };

  // Form states for Add Member
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [role, setRole] = useState<string>('Manager');
  const [notes, setNotes] = useState('');
  const [assignedProps, setAssignedProps] = useState<string[]>([]);
  const [memberPhotoUrl, setMemberPhotoUrl] = useState<string>('');
  const [govtIdType, setGovtIdType] = useState<string>('Aadhaar Card');
  const [govtIdNumber, setGovtIdNumber] = useState<string>('');
  const [govtIdUrl, setGovtIdUrl] = useState<string>('');
  const [govtIdBackUrl, setGovtIdBackUrl] = useState<string>('');
  const [isUploadingGovtId, setIsUploadingGovtId] = useState<boolean>(false);
  const [profileTab, setProfileTab] = useState<'personal' | 'logs' | 'documents'>('personal');

  // Form states for Drawer Govt ID Edit / Upload
  const [drawerGovtIdType, setDrawerGovtIdType] = useState<string>('Aadhaar Card');
  const [drawerGovtIdNumber, setDrawerGovtIdNumber] = useState<string>('');
  const [drawerGovtIdUrl, setDrawerGovtIdUrl] = useState<string>('');
  const [drawerGovtIdBackUrl, setDrawerGovtIdBackUrl] = useState<string>('');
  const [isSavingDrawerDoc, setIsSavingDrawerDoc] = useState<boolean>(false);
  const [isEditingDrawerDoc, setIsEditingDrawerDoc] = useState<boolean>(false);

  useEffect(() => {
    if (selectedMember) {
      setDrawerGovtIdType(selectedMember.govt_id_type || 'Aadhaar Card');
      setDrawerGovtIdNumber(selectedMember.govt_id_number || '');
      setDrawerGovtIdUrl(selectedMember.govt_id_url || '');
      setDrawerGovtIdBackUrl(selectedMember.govt_id_back_url || '');
      setIsEditingDrawerDoc(false);
    }
  }, [selectedMember]);
  const [formPermissions, setFormPermissions] = useState<TeamMemberPermissions>({
    viewDashboard: true, viewTenants: true, manageTenants: true, addTenant: true, editTenant: true, deleteTenant: false,
    viewRooms: true, manageRooms: true, deleteRooms: false, resolveComplaints: true, editMenu: false, viewReports: true, exportReports: false,
    addExpense: true, deleteExpense: false, sendWhatsAppMessages: true, approveTemplates: false,
    createNotices: true, deleteNotices: false, generateDues: true, collectPayments: true, printReceipts: true,
    viewHistory: true, deleteHistory: false, viewMembers: false, manageMembers: false, manageProperty: false
  });
  const [submittingMember, setSubmittingMember] = useState(false);
  const [memberFormError, setMemberFormError] = useState<string | null>(null);

  // Form states for Add Task
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('Medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskAssignedTo, setTaskAssignedTo] = useState('');
  const [taskPgId, setTaskPgId] = useState('');
  const [submittingTask, setSubmittingTask] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserUid(user.uid);
        fetchData(user.uid);
      } else {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const fetchData = async (uid: string) => {
    setLoading(true);

    // 1. Fetch team members and update UI immediately
    rpcCall('getTeamMembersAction', uid).then(async (mRes) => {
      if (mRes?.success && Array.isArray(mRes.data) && mRes.data.length > 0) {
        setMembers(mRes.data);
      } else {
        // Client Firestore fallback if RPC returns empty or fails
        try {
          const { db } = await import('@/lib/firebase');
          const { collection, query, where, getDocs } = await import('firebase/firestore');
          const snap = await getDocs(query(collection(db, 'team_members'), where('owner_id', '==', uid)));
          if (!snap.empty) {
            const clientMembers: any[] = [];
            snap.forEach(doc => clientMembers.push({ id: doc.id, ...doc.data() }));
            setMembers(clientMembers);
          }
        } catch (e) {
          console.warn('Client Firestore fallback for team members:', e);
        }
      }
      setLoading(false); // Unblock UI immediately after members load
    }).catch(err => {
      console.error('fetchData RPC error:', err);
      setLoading(false);
    });

    // 2. Fetch Tasks and Activity Logs in the background silently
    rpcCall('getTasksAction', uid).then(tRes => {
      if (tRes?.success && Array.isArray(tRes.data)) setTasks(tRes.data);
    }).catch(console.error);

    rpcCall('getActivityLogsAction', uid).then(lRes => {
      if (lRes?.success && Array.isArray(lRes.data)) setLogs(lRes.data);
    }).catch(console.error);
  };

  // Role preset handler
  const handleRoleChange = async (newRole: string) => {
    setRole(newRole);
    if (newRole !== 'Custom Role') {
      setCustomRoleTitle(newRole);
    }
    const res = await rpcCall('getDefaultPermissionsForRole', newRole);
    if (res && typeof res === 'object' && !res.error) {
      setFormPermissions(res);
    }
  };

  // Handle Add Member submit
  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userUid || !fullName || !email || !phone) {
      setMemberFormError('Please fill in Name, Email, and Phone');
      return;
    }
    setSubmittingMember(true);
    setMemberFormError(null);

    const finalRoleTitle = customRoleTitle.trim() || role;

    const res = await rpcCall('createTeamMemberAction', {
      ownerId: userUid,
      fullName,
      email,
      phone,
      employeeId,
      role: finalRoleTitle,
      assignedProperties: assignedProps.length > 0 ? assignedProps : (selectedProperty ? [selectedProperty.pg_id] : []),
      permissions: formPermissions,
      notes,
      photoUrl: memberPhotoUrl,
      govtIdType,
      govtIdNumber,
      govtIdUrl,
      govtIdBackUrl
    });

    if (res.success) {
      setIsAddMemberOpen(false);
      resetMemberForm();
      if (userUid) await fetchData(userUid);
      toast.success("✅ Team member created successfully!");
    } else {
      setMemberFormError(res.error || 'Failed to add team member');
      toast.error(res.error || 'Failed to add team member');
    }
    setSubmittingMember(false);
  };

  const resetMemberForm = () => {
    setFullName(''); setEmail(''); setPhone(''); setEmployeeId(''); setRole('Manager');
    setNotes(''); setAssignedProps([]); setMemberFormError(null); setMemberPhotoUrl('');
    setGovtIdType('Aadhaar Card'); setGovtIdNumber(''); setGovtIdUrl(''); setGovtIdBackUrl('');
  };

  const compressImageFile = (file: File, maxWidth = 1024, maxHeight = 1024, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(compressedDataUrl);
          } else {
            resolve(event.target?.result as string);
          }
        };
        img.onerror = (err) => reject(err);
        img.src = event.target?.result as string;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const handleGovtIdUpload = async (e: React.ChangeEvent<HTMLInputElement>, isBack: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingGovtId(true);
    try {
      const compressed = await compressImageFile(file, 1024, 1024, 0.7);
      if (isBack) {
        setGovtIdBackUrl(compressed);
      } else {
        setGovtIdUrl(compressed);
      }
      toast.success(isBack ? "Govt ID Back document uploaded!" : "Govt ID Front document uploaded!");
    } catch (err: any) {
      toast.error("Failed to process document image");
    } finally {
      setIsUploadingGovtId(false);
    }
  };

  const compressBase64 = (base64Str: string, maxWidth = 800, quality = 0.6): Promise<string> => {
    return new Promise((resolve) => {
      if (!base64Str || !base64Str.startsWith('data:image')) {
        resolve(base64Str);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(base64Str);
        }
      };
      img.onerror = () => resolve(base64Str);
      img.src = base64Str;
    });
  };

  const handleSaveMemberGovtId = async () => {
    if (!selectedMember?.id) return;
    setIsSavingDrawerDoc(true);
    try {
      let finalUrl = drawerGovtIdUrl;
      let finalBackUrl = drawerGovtIdBackUrl;

      if (finalUrl && finalUrl.startsWith('data:image') && finalUrl.length > 200000) {
        finalUrl = await compressBase64(finalUrl, 800, 0.6);
      }
      if (finalBackUrl && finalBackUrl.startsWith('data:image') && finalBackUrl.length > 200000) {
        finalBackUrl = await compressBase64(finalBackUrl, 800, 0.6);
      }

      const res = await rpcCall('updateTeamMemberGovtIdAction', {
        memberId: selectedMember.id,
        govtIdType: drawerGovtIdType || 'Aadhaar Card',
        govtIdNumber: drawerGovtIdNumber || '',
        govtIdUrl: finalUrl,
        govtIdBackUrl: finalBackUrl
      });

      if (res.success) {
        const updated = {
          ...selectedMember,
          govt_id_type: drawerGovtIdType,
          govt_id_number: drawerGovtIdNumber,
          govt_id_url: finalUrl || selectedMember.govt_id_url,
          govt_id_back_url: finalBackUrl || selectedMember.govt_id_back_url
        };
        setSelectedMember(updated);
        setMembers(prev => prev.map(m => m.id === selectedMember.id ? updated : m));
        if (userUid) fetchData(userUid);
        toast.success("✅ Govt ID documents updated successfully!");
        setIsEditingDrawerDoc(false);
      } else {
        toast.error(res.error || 'Failed to update documents');
      }
    } catch (err: any) {
      toast.error(err.message || 'Update failed');
    } finally {
      setIsSavingDrawerDoc(false);
    }
  };

  const handleDrawerGovtIdUpload = async (e: React.ChangeEvent<HTMLInputElement>, isBack: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 1024, 1024, 0.7);
      if (isBack) {
        setDrawerGovtIdBackUrl(compressed);
      } else {
        setDrawerGovtIdUrl(compressed);
      }
      toast.success(isBack ? "Back photo selected! Click Save Document Changes." : "Front photo selected! Click Save Document Changes.");
    } catch (err: any) {
      toast.error("Failed to process document image");
    }
  };

  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedMember?.id) return;
    try {
      const compressed = await compressImageFile(file, 600, 600, 0.8);
      const res = await rpcCall('updateTeamMemberPhotoAction', {
        memberId: selectedMember.id,
        photoUrl: compressed
      });
      if (res.success) {
        const updated = { ...selectedMember, photo_url: compressed };
        setSelectedMember(updated);
        setMembers(prev => prev.map(m => m.id === selectedMember.id ? updated : m));
        if (userUid) fetchData(userUid);
        toast.success("✅ Profile picture updated!");
      } else {
        toast.error(res.error || 'Failed to update profile photo');
      }
    } catch (err: any) {
      toast.error("Failed to process photo");
    }
  };

  // Handle Add Task submit
  const handleAddTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userUid || !taskTitle || !taskAssignedTo) return;
    setSubmittingTask(true);

    const assignedMember = members.find(m => m.id === taskAssignedTo);
    const pg = properties.find((p: any) => p.pg_id === taskPgId) || selectedProperty;

    const res = await rpcCall('createTaskAction', {
      ownerId: userUid,
      title: taskTitle,
      description: taskDesc,
      priority: taskPriority,
      dueDate: taskDueDate || new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      pgId: pg?.pg_id || 'all',
      pgName: pg?.name || 'All Hostels',
      assignedToId: taskAssignedTo,
      assignedToName: assignedMember?.full_name || 'Staff Member'
    });

    if (res.success) {
      setIsAddTaskOpen(false);
      setTaskTitle(''); setTaskDesc(''); setTaskAssignedTo('');
      if (userUid) await fetchData(userUid);
    }
    setSubmittingTask(false);
  };

  // Handle Member Status Toggle
  const handleToggleStatus = async (memberId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'Active' ? 'Suspended' : 'Active';
    const res = await rpcCall('toggleTeamMemberStatusAction', memberId, nextStatus);
    if (res.success && userUid) {
      fetchData(userUid);
    }
  };

  // Handle Member Delete
  const handleDeleteMember = async (memberId: string) => {
    if (!await confirm('Are you sure you want to delete this staff member?')) return;
    const res = await rpcCall('deleteTeamMemberAction', memberId);
    if (res.success && userUid) {
      fetchData(userUid);
    }
  };

  // Handle Task Stage Update
  const handleTaskStageMove = async (taskId: string, currentStatus: string) => {
    const stages: TaskItem['status'][] = ['Pending', 'In Progress', 'Review', 'Completed'];
    const currIdx = stages.indexOf(currentStatus as any);
    if (currIdx < stages.length - 1) {
      const nextStage = stages[currIdx + 1];
      const res = await rpcCall('updateTaskStatusAction', taskId, nextStage);
      if (res.success && userUid) {
        fetchData(userUid);
      }
    }
  };

  const filteredMembers = members.filter(m => {
    const matchesSearch = m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          m.phone.includes(searchQuery);
    const matchesRole = roleFilter === 'all' || m.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getPriorityColor = (p: string) => {
    switch(p) {
      case 'Urgent': return '#EF4444';
      case 'High': return '#F97316';
      case 'Medium': return '#F59E0B';
      default: return '#10B981';
    }
  };

  const getRoleBadgeStyle = (r: string) => {
    switch(r) {
      case 'Manager': return { bg: '#EEF2FF', color: '#4338CA' };
      case 'Accountant': return { bg: '#ECFDF5', color: '#047857' };
      case 'Receptionist': return { bg: '#FDF2F8', color: '#BE185D' };
      case 'Maintenance': return { bg: '#FFFBEB', color: '#B45309' };
      case 'Security': return { bg: '#F1F5F9', color: '#475569' };
      default: return { bg: '#F3E8FF', color: '#6B21A8' };
    }
  };

  return (
    <ProtectedRoute permission="viewMembers">
      <div style={{ padding: '24px', maxWidth: '1300px', margin: '0 auto' }}>
      
      {/* ── TOP ACTION BAR ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '16px', gap: '10px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setIsAddTaskOpen(true)}
          style={{
            flex: 1,
            minWidth: '130px',
            padding: '10px 14px',
            borderRadius: '12px',
            background: '#FFFFFF',
            border: '1px solid #CBD5E1',
            color: '#334155',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
          }}
        >
          <Plus size={16} /> Assign Task
        </button>

        <button
          onClick={() => {
            setIsAddMemberOpen(true);
            setMemberFormError(null);
          }}
          style={{
            flex: 1,
            minWidth: '150px',
            padding: '10px 16px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #4F46E5, #4338CA)',
            color: '#FFFFFF',
            border: 'none',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)'
          }}
        >
          <UserPlus size={16} /> Add Team Member
        </button>
      </div>

      {/* ── STATS CARDS GRID (REDESIGNED 2x2 MATRIX) ── */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(2, 1fr)', 
        gap: '12px', 
        marginBottom: '20px' 
      }}>
        {[
          { title: 'Total Members', value: members.length, label: 'Registered Staff', icon: Users, color: '#4F46E5', bg: '#EEF2FF' },
          { title: 'Active Staff', value: members.filter(m => m.status === 'Active').length, label: 'Full Access', icon: CheckCircle2, color: '#10B981', bg: '#ECFDF5' },
          { title: 'Active Tasks', value: tasks.filter(t => t.status !== 'Completed').length, label: 'In Progress', icon: Clock, color: '#F59E0B', bg: '#FFFBEB' },
          { title: 'Completed Today', value: tasks.filter(t => t.status === 'Completed').length, label: 'Verified Done', icon: Award, color: '#8B5CF6', bg: '#F3E8FF' }
        ].map((stat, i) => (
          <motion.div
            key={i}
            whileHover={{ y: -2 }}
            style={{
              background: '#FFFFFF',
              padding: '14px',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#64748B', lineHeight: 1.2 }}>{stat.title}</span>
              <div style={{ background: stat.bg, padding: '6px', borderRadius: '10px', color: stat.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <stat.icon size={16} />
              </div>
            </div>

            <div>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', display: 'block', lineHeight: 1 }}>{stat.value}</span>
              <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 500, display: 'block', marginTop: '4px' }}>{stat.label}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── NAVIGATION TABS (SEGMENTED PILL BAR - 100% FIT GRID) ── */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        background: '#F1F5F9', 
        padding: '4px', 
        borderRadius: '16px', 
        border: '1px solid #E2E8F0', 
        marginBottom: '20px', 
        gap: '4px'
      }}>
        {[
          { id: 'directory', label: 'Members', icon: Users },
          { id: 'tasks', label: 'Tasks', icon: CheckSquare },
          { id: 'timeline', label: 'Audit', icon: Activity },
          { id: 'performance', label: 'Stats', icon: TrendingUp }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '9px 2px',
              borderRadius: '12px',
              border: 'none',
              background: activeTab === tab.id ? '#FFFFFF' : 'transparent',
              color: activeTab === tab.id ? '#4F46E5' : '#64748B',
              fontWeight: activeTab === tab.id ? 800 : 600,
              fontSize: '0.74rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              boxShadow: activeTab === tab.id ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s',
              textAlign: 'center'
            }}
          >
            <tab.icon size={14} color={activeTab === tab.id ? '#4F46E5' : '#64748B'} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── TAB 1: MEMBERS DIRECTORY ── */}
      {activeTab === 'directory' && (
        <div style={{ background: '#FFFFFF', borderRadius: '20px', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
          
          {/* Controls Bar */}
          <div style={{ padding: '16px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#F8FAFC', padding: '8px 14px', borderRadius: '12px', border: '1px solid #E2E8F0', flex: 1, minWidth: '200px' }}>
              <Search size={16} color="#94A3B8" />
              <input
                type="text"
                placeholder="Search staff by name, email, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.85rem', width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={16} color="#64748B" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '0.82rem', fontWeight: 600, color: '#334155', background: '#FFFFFF', outline: 'none' }}
              >
                <option value="all">All Roles</option>
                <option value="Manager">Manager</option>
                <option value="Accountant">Accountant</option>
                <option value="Receptionist">Receptionist</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Security">Security</option>
                <option value="Cleaner">Cleaner</option>
              </select>
            </div>
          </div>

          {/* Directory Content */}
          {filteredMembers.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748B' }}>
              <Users size={48} color="#CBD5E1" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#334155', margin: 0 }}>No Team Members Found</h3>
              <p style={{ fontSize: '0.85rem', color: '#94A3B8', marginTop: '4px' }}>Click "Add Team Member" above to invite staff to your PG platform.</p>
            </div>
          ) : isMobileView ? (
            /* 📱 WORLD-CLASS MOBILE CARD VIEW (Active ONLY on Mobile Screens) */
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {filteredMembers.map(m => {
                const badge = getRoleBadgeStyle(m.role);
                const rawPhone = (m.phone || '').replace(/[^0-9]/g, '');
                return (
                  <div
                    key={m.id}
                    style={{
                      background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
                      borderRadius: '20px',
                      border: '1px solid #E2E8F0',
                      padding: '16px',
                      boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)',
                      position: 'relative'
                    }}
                  >
                    {/* Top Row: Avatar + Name + Badges */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ position: 'relative' }}>
                          <div
                            onClick={() => setSelectedMember(m)}
                            style={{ width: '46px', height: '46px', borderRadius: '50%', background: m.avatar_color || '#4F46E5', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', overflow: 'hidden', border: '2.5px solid #E0E7FF', cursor: 'pointer' }}
                            title="View Profile"
                          >
                            {m.photo_url ? (
                              <img src={m.photo_url} alt={m.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              m.full_name.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div style={{ position: 'absolute', bottom: 0, right: 0, width: '12px', height: '12px', borderRadius: '50%', background: m.status === 'Active' ? '#10B981' : '#EF4444', border: '2px solid #FFFFFF', zIndex: 2 }} />
                        </div>
                        <div>
                          <span style={{ fontWeight: 800, color: '#0F172A', fontSize: '1rem', display: 'block', letterSpacing: '-0.01em' }}>{m.full_name}</span>
                          <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>ID: {m.employee_id || 'STAFF'}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <span style={{ background: badge.bg, color: badge.color, padding: '4px 10px', borderRadius: '16px', fontWeight: 700, fontSize: '0.72rem' }}>
                          {m.role}
                        </span>
                        <span style={{ background: m.status === 'Active' ? '#DCFCE7' : '#FEE2E2', color: m.status === 'Active' ? '#166534' : '#991B1B', padding: '2px 8px', borderRadius: '10px', fontWeight: 700, fontSize: '0.68rem' }}>
                          {m.status}
                        </span>
                      </div>
                    </div>

                    {/* Quick Contact & Hostel Pills */}
                    <div style={{ background: '#FFFFFF', padding: '12px', borderRadius: '14px', border: '1px solid #F1F5F9', marginBottom: '12px', fontSize: '0.8rem' }}>
                      <div style={{ color: '#334155', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <Mail size={14} color="#6366F1" />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</span>
                      </div>

                      <div style={{ color: '#334155', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        <Phone size={14} color="#10B981" />
                        <span>{m.phone}</span>
                      </div>

                      {/* 1-Tap Communication Bar */}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                        <a
                          href={`tel:${rawPhone}`}
                          style={{ flex: 1, padding: '6px', borderRadius: '8px', background: '#ECFDF5', color: '#047857', fontSize: '0.72rem', fontWeight: 700, textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                        >
                          <Phone size={12} /> Call
                        </a>
                        <a
                          href={`https://wa.me/${rawPhone.startsWith('91') ? rawPhone : '91' + rawPhone}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ flex: 1, padding: '6px', borderRadius: '8px', background: '#DCFCE7', color: '#166534', fontSize: '0.72rem', fontWeight: 700, textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                        >
                          <MessageSquare size={12} /> WhatsApp
                        </a>
                      </div>

                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #E2E8F0' }}>
                        <span style={{ color: '#64748B', fontWeight: 700, fontSize: '0.72rem' }}>Hostels:</span>
                        {m.assigned_properties?.length > 0 ? (
                          m.assigned_properties.map((pId, idx) => {
                            const propName = properties.find((p: any) => p.pg_id === pId)?.name || 'Hostel';
                            return (
                              <span key={idx} style={{ background: '#EEF2FF', color: '#4338CA', padding: '2px 8px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 700 }}>
                                {propName}
                              </span>
                            );
                          })
                        ) : (
                          <span style={{ color: '#94A3B8', fontSize: '0.72rem' }}>All Hostels</span>
                        )}
                      </div>
                    </div>

                    {/* Card Action Bar */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <button
                        onClick={() => { setSelectedMember(m); setProfileTab('personal'); }}
                        style={{ padding: '8px 10px', background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)', border: '1px solid #C7D2FE', borderRadius: '10px', color: '#4338CA', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                      >
                        <Eye size={14} /> View Profile
                      </button>

                      <button
                        onClick={async () => {
                          setEditingPermissionsMember(m);
                          setEditRoleTitle(m.role || 'Custom Role');
                          const defaultP = await rpcCall('getDefaultPermissionsForRole', m.role);
                          setEditPermissions(m.permissions || defaultP);
                          setEditAssignedProps(m.assigned_properties || []);
                        }}
                        style={{ padding: '8px 10px', background: 'linear-gradient(135deg, #4F46E5, #4338CA)', border: 'none', borderRadius: '10px', color: '#FFFFFF', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                      >
                        <Edit3 size={14} /> Edit Permissions
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleToggleStatus(m.id!, m.status)}
                        style={{ flex: 1, padding: '8px', background: m.status === 'Active' ? '#FEF3C7' : '#DCFCE7', border: 'none', borderRadius: '10px', color: m.status === 'Active' ? '#D97706' : '#166534', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', textAlign: 'center' }}
                      >
                        {m.status === 'Active' ? 'Suspend' : 'Activate'}
                      </button>

                      <button
                        onClick={() => handleDeleteMember(m.id!)}
                        style={{ padding: '8px 12px', background: '#FEE2E2', border: 'none', borderRadius: '10px', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Delete Staff Member"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* 💻 DESKTOP TABLE VIEW (Active ONLY on Desktop Screens) */
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '14px 20px' }}>Member</th>
                    <th style={{ padding: '14px 20px' }}>Role</th>
                    <th style={{ padding: '14px 20px' }}>Contact</th>
                    <th style={{ padding: '14px 20px' }}>Assigned Hostels</th>
                    <th style={{ padding: '14px 20px' }}>Status</th>
                    <th style={{ padding: '14px 20px' }}>Last Active</th>
                    <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map(m => {
                    const badge = getRoleBadgeStyle(m.role);
                    return (
                      <tr key={m.id} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.15s' }}>
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div
                              onClick={() => setSelectedMember(m)}
                              style={{ width: '40px', height: '40px', borderRadius: '50%', background: m.avatar_color || '#4F46E5', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', overflow: 'hidden', border: '2.5px solid #E0E7FF', boxShadow: '0 0 0 1px rgba(79,70,229,0.15), 0 2px 6px rgba(0,0,0,0.08)', cursor: 'pointer', transition: 'box-shadow 0.2s, border-color 0.2s' }}
                              title="View Profile"
                            >
                              {m.photo_url ? (
                                <img src={m.photo_url} alt={m.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                m.full_name.slice(0, 2).toUpperCase()
                              )}
                            </div>
                            <div>
                              <span style={{ fontWeight: 700, color: '#0F172A', display: 'block' }}>{m.full_name}</span>
                              <span style={{ fontSize: '0.75rem', color: '#64748B' }}>ID: {m.employee_id || 'STAFF'}</span>
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '14px 20px' }}>
                          <span style={{ background: badge.bg, color: badge.color, padding: '4px 10px', borderRadius: '20px', fontWeight: 700, fontSize: '0.75rem' }}>
                            {m.role}
                          </span>
                        </td>

                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ fontSize: '0.8rem', color: '#334155' }}>
                            <div>{m.email}</div>
                            <div style={{ color: '#64748B' }}>{m.phone}</div>
                          </div>
                        </td>

                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {m.assigned_properties?.length > 0 ? (
                              m.assigned_properties.map((pId, idx) => {
                                const propName = properties.find((p: any) => p.pg_id === pId)?.name || 'Hostel';
                                return (
                                  <span key={idx} style={{ background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600 }}>
                                    {propName}
                                  </span>
                                );
                              })
                            ) : (
                              <span style={{ color: '#94A3B8', fontSize: '0.78rem' }}>All Properties</span>
                            )}
                          </div>
                        </td>

                        <td style={{ padding: '14px 20px' }}>
                          <span style={{
                            background: m.status === 'Active' ? '#DCFCE7' : '#FEE2E2',
                            color: m.status === 'Active' ? '#166534' : '#991B1B',
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontWeight: 700,
                            fontSize: '0.72rem'
                          }}>
                            {m.status}
                          </span>
                        </td>

                        <td style={{ padding: '14px 20px', color: '#64748B', fontSize: '0.8rem' }}>
                          {m.last_active || 'Recently'}
                        </td>

                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            <button
                              onClick={() => { setSelectedMember(m); setProfileTab('personal'); }}
                              style={{ padding: '6px 12px', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '8px', color: '#4338CA', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                              title="View Member Profile"
                            >
                              <Eye size={14} /> Profile
                            </button>

                            <button
                              onClick={async () => {
                                setEditingPermissionsMember(m);
                                setEditRoleTitle(m.role || 'Custom Role');
                                const defaultP = await rpcCall('getDefaultPermissionsForRole', m.role);
                                setEditPermissions(m.permissions || defaultP);
                                setEditAssignedProps(m.assigned_properties || []);
                              }}
                              style={{ padding: '6px 12px', background: '#4F46E5', border: 'none', borderRadius: '8px', color: '#FFFFFF', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                              title="Edit Permissions & Hostels"
                            >
                              <Edit3 size={14} /> Permissions
                            </button>

                            <button
                              onClick={() => handleToggleStatus(m.id!, m.status)}
                              style={{ padding: '6px', background: m.status === 'Active' ? '#FEF3C7' : '#DCFCE7', border: 'none', borderRadius: '8px', color: m.status === 'Active' ? '#D97706' : '#166534', cursor: 'pointer' }}
                              title={m.status === 'Active' ? 'Suspend Access' : 'Activate Access'}
                            >
                              <Power size={16} />
                            </button>

                            <button
                              onClick={() => handleDeleteMember(m.id!)}
                              style={{ padding: '6px', background: '#FEE2E2', border: 'none', borderRadius: '8px', color: '#EF4444', cursor: 'pointer' }}
                              title="Delete Team Member"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: TASK DELEGATION KANBAN BOARD ── */}
      {activeTab === 'tasks' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {[
              { status: 'Pending', label: 'Pending Tasks', color: '#EF4444', bg: '#FEF2F2' },
              { status: 'In Progress', label: 'In Progress', color: '#F59E0B', bg: '#FFFBEB' },
              { status: 'Review', label: 'Under Review', color: '#3B82F6', bg: '#EFF6FF' },
              { status: 'Completed', label: 'Completed', color: '#10B981', bg: '#ECFDF5' }
            ].map(col => {
              const colTasks = tasks.filter(t => t.status === col.status);
              return (
                <div key={col.status} style={{ background: '#F8FAFC', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '16px', minHeight: '400px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: col.color }} />
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>{col.label}</h3>
                    </div>
                    <span style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#334155', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                      {colTasks.length}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {colTasks.map(t => (
                      <motion.div
                        key={t.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{
                          background: '#FFFFFF',
                          borderRadius: '14px',
                          border: '1px solid #E2E8F0',
                          padding: '14px',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <span style={{
                            background: `${getPriorityColor(t.priority)}15`,
                            color: getPriorityColor(t.priority),
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            textTransform: 'uppercase'
                          }}>
                            {t.priority}
                          </span>

                          <button
                            onClick={async () => {
                              await rpcCall('deleteTaskAction', t.id!);
                              if (userUid) fetchData(userUid);
                            }}
                            style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                          >
                            <X size={14} />
                          </button>
                        </div>

                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A', margin: '0 0 4px 0' }}>{t.title}</h4>
                        <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0 0 12px 0', lineHeight: 1.4 }}>{t.description}</p>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#64748B', borderTop: '1px solid #F1F5F9', paddingTop: '8px' }}>
                          <span>Assigned: <strong>{t.assigned_to_name}</strong></span>
                          <span>Due: {t.due_date}</span>
                        </div>

                        {col.status !== 'Completed' && (
                          <button
                            onClick={() => handleTaskStageMove(t.id!, col.status)}
                            style={{
                              width: '100%',
                              marginTop: '10px',
                              padding: '6px',
                              background: '#F1F5F9',
                              border: '1px solid #CBD5E1',
                              borderRadius: '8px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: '#334155',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px'
                            }}
                          >
                            Advance Stage <ArrowRight size={12} />
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 3: ACTIVITY AUDIT LOG ── */}
      {activeTab === 'timeline' && (
        <div style={{ background: '#FFFFFF', borderRadius: '20px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', marginBottom: '16px' }}>Staff Activity Timeline</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {logs.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94A3B8', padding: '40px' }}>No staff activities recorded yet.</div>
            ) : (
              logs.map((log, idx) => (
                <div key={log.id || idx} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <div style={{ background: '#EEF2FF', padding: '8px', borderRadius: '50%', color: '#4F46E5', marginTop: '2px' }}>
                    <Activity size={16} />
                  </div>
                  <div style={{ flex: 1, background: '#F8FAFC', padding: '12px 16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.88rem' }}>{log.action}</span>
                      <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: '#475569', margin: 0 }}>{log.details}</p>
                    <span style={{ fontSize: '0.72rem', color: '#6366F1', fontWeight: 600, display: 'block', marginTop: '4px' }}>
                      Performed by: {log.performed_by_name} ({log.performed_by_role})
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── TAB 4: STAFF PERFORMANCE ── */}
      {activeTab === 'performance' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {members.map(m => {
            const memberTasks = tasks.filter(t => t.assigned_to_id === m.id);
            const completed = memberTasks.filter(t => t.status === 'Completed').length;
            const rate = memberTasks.length > 0 ? Math.round((completed / memberTasks.length) * 100) : 100;
            return (
              <div key={m.id} style={{ background: '#FFFFFF', borderRadius: '20px', border: '1px solid #E2E8F0', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: m.avatar_color || '#4F46E5', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                    {m.full_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontWeight: 800, color: '#0F172A', fontSize: '1rem' }}>{m.full_name}</h4>
                    <span style={{ fontSize: '0.78rem', color: '#64748B' }}>{m.role}</span>
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    <span>Task Completion Rate</span>
                    <span>{rate}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${rate}%`, height: '100%', background: 'linear-gradient(90deg, #4F46E5, #10B981)', borderRadius: '4px' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.8rem', background: '#F8FAFC', padding: '10px', borderRadius: '12px' }}>
                  <div>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '0.72rem' }}>Assigned Tasks</span>
                    <strong style={{ color: '#0F172A', fontSize: '1rem' }}>{memberTasks.length}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '0.72rem' }}>Completed</span>
                    <strong style={{ color: '#10B981', fontSize: '1rem' }}>{completed}</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL 1: ADD TEAM MEMBER WITH PERMISSION BUILDER ── */}
      <AnimatePresence>
        {isAddMemberOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              style={{ background: '#FFFFFF', width: '100%', maxWidth: '720px', maxHeight: '88vh', borderRadius: '24px', border: '1px solid #E2E8F0', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', padding: '20px', overflowY: 'auto' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ background: '#EEF2FF', padding: '8px', borderRadius: '10px' }}>
                    <UserPlus size={20} color="#4F46E5" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Add Team Member</h3>
                    <p style={{ fontSize: '0.78rem', color: '#64748B', margin: 0 }}>Create staff credentials and configure module permissions.</p>
                  </div>
                </div>
                <button onClick={() => setIsAddMemberOpen(false)} style={{ background: '#F1F5F9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={16} color="#64748B" />
                </button>
              </div>

              {memberFormError && (
                <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '10px 14px', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 600, marginBottom: '14px' }}>
                  {memberFormError}
                </div>
              )}

              <form onSubmit={handleAddMemberSubmit}>
                {/* Profile Photo Uploader Section */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px', background: '#F8FAFC', padding: '12px 14px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
                  <div style={{ position: 'relative', width: '54px', height: '54px', borderRadius: '50%', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', border: '2px solid #CBD5E1' }}>
                    {memberPhotoUrl ? (
                      <img src={memberPhotoUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Users size={24} color="#6366F1" />
                    )}
                  </div>
                  <div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0F172A', display: 'block', marginBottom: '2px' }}>Staff Profile Photo (Optional)</span>
                    <label style={{ fontSize: '0.75rem', color: '#4F46E5', fontWeight: 700, cursor: 'pointer', display: 'inline-block' }}>
                      + Upload Profile Picture
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const comp = await compressImageFile(file, 600, 600, 0.8);
                          setMemberPhotoUrl(comp);
                        }
                      }} />
                    </label>
                  </div>
                </div>

                {/* Basic Inputs Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Full Name *</label>
                    <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Ramesh Kumar" style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Email Address *</label>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ramesh@staysync.com" style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Phone Number *</label>
                    <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Employee ID (Optional)</label>
                    <input type="text" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="e.g. EMP-102" style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>

                {/* Govt ID Upload Section (Tenant Profile Style) */}
                <div style={{ background: '#F8FAFC', borderRadius: '14px', padding: '14px', border: '1px solid #E2E8F0', marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0F172A', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={16} color="#4F46E5" /> Identity & Verification Documents
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Govt ID Type *</label>
                      <select
                        value={govtIdType}
                        onChange={(e) => setGovtIdType(e.target.value)}
                        style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.85rem', outline: 'none', background: '#FFFFFF', boxSizing: 'border-box' }}
                      >
                        <option value="Aadhaar Card">Aadhaar Card</option>
                        <option value="PAN Card">PAN Card</option>
                        <option value="Voter ID">Voter ID</option>
                        <option value="Driving License">Driving License</option>
                        <option value="Passport">Passport</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Govt ID Number *</label>
                      <input
                        type="text"
                        required
                        value={govtIdNumber}
                        onChange={(e) => setGovtIdNumber(e.target.value)}
                        placeholder="e.g. 1234-5678-9012"
                        style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {/* Front Upload Card */}
                    <label style={{ backgroundColor: '#FFFFFF', border: govtIdUrl ? '2px solid #10b981' : '1px dashed #CBD5E1', borderRadius: '12px', height: '130px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '12px', position: 'relative', overflow: 'hidden' }}>
                      <input type="file" accept="image/*,.pdf" onChange={(e) => handleGovtIdUpload(e, false)} style={{ display: 'none' }} />
                      {govtIdUrl ? (
                        <img src={govtIdUrl} alt="Govt Front Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                      ) : (
                        <>
                          <div style={{ width: 38, height: 38, borderRadius: '50%', backgroundColor: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                            <Camera size={20} color="#4F46E5" />
                          </div>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E293B', marginBottom: '2px' }}>Govt Proof (Front)</span>
                          <span style={{ fontSize: '0.72rem', color: '#64748B', textAlign: 'center' }}>Click to upload front photo</span>
                        </>
                      )}
                      {govtIdUrl && <div style={{ position: 'absolute', top: '8px', right: '8px', color: '#10b981', background: '#FFFFFF', borderRadius: '50%', padding: 2 }}><CheckCircle2 size={18} /></div>}
                    </label>

                    {/* Back Upload Card */}
                    <label style={{ backgroundColor: '#FFFFFF', border: govtIdBackUrl ? '2px solid #10b981' : '1px dashed #CBD5E1', borderRadius: '12px', height: '130px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '12px', position: 'relative', overflow: 'hidden' }}>
                      <input type="file" accept="image/*,.pdf" onChange={(e) => handleGovtIdUpload(e, true)} style={{ display: 'none' }} />
                      {govtIdBackUrl ? (
                        <img src={govtIdBackUrl} alt="Govt Back Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                      ) : (
                        <>
                          <div style={{ width: 38, height: 38, borderRadius: '50%', backgroundColor: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                            <Camera size={20} color="#4F46E5" />
                          </div>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E293B', marginBottom: '2px' }}>Govt Proof (Back)</span>
                          <span style={{ fontSize: '0.72rem', color: '#64748B', textAlign: 'center' }}>Click to upload back photo</span>
                        </>
                      )}
                      {govtIdBackUrl && <div style={{ position: 'absolute', top: '8px', right: '8px', color: '#10b981', background: '#FFFFFF', borderRadius: '50%', padding: 2 }}><CheckCircle2 size={18} /></div>}
                    </label>
                  </div>
                </div>

                {/* Role Preset Chips & Custom Role Title */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>Role Preset *</label>
                    {!isAddingNewPreset && (
                      <button
                        type="button"
                        onClick={() => setIsAddingNewPreset(true)}
                        style={{ background: 'none', border: 'none', color: '#4F46E5', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                      >
                        <Plus size={12} /> Add Preset
                      </button>
                    )}
                  </div>

                  {/* Inline Add New Preset Input */}
                  {isAddingNewPreset && (
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                      <input
                        type="text"
                        placeholder="Role preset name (e.g. Warden)..."
                        value={newPresetInput}
                        onChange={(e) => setNewPresetInput(e.target.value)}
                        style={{ flex: 1, padding: '6px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.8rem', outline: 'none' }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (newPresetInput.trim()) {
                              const name = newPresetInput.trim();
                              const updated = Array.from(new Set([...rolePresets, name]));
                              setRolePresets(updated);
                              if (typeof window !== 'undefined') localStorage.setItem('staySync_rolePresets', JSON.stringify(updated));
                              setRole('Custom Role');
                              setCustomRoleTitle(name);
                              setNewPresetInput('');
                              setIsAddingNewPreset(false);
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newPresetInput.trim()) {
                            const name = newPresetInput.trim();
                            const updated = Array.from(new Set([...rolePresets, name]));
                            setRolePresets(updated);
                            if (typeof window !== 'undefined') localStorage.setItem('staySync_rolePresets', JSON.stringify(updated));
                            setRole('Custom Role');
                            setCustomRoleTitle(name);
                            setNewPresetInput('');
                            setIsAddingNewPreset(false);
                          }
                        }}
                        style={{ padding: '6px 12px', background: '#4F46E5', color: '#FFF', border: 'none', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => { setIsAddingNewPreset(false); setNewPresetInput(''); }}
                        style={{ padding: '6px 10px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', fontSize: '0.78rem', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Preset Chips */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    {rolePresets.map(r => {
                      const isSel = role === r || customRoleTitle === r;
                      return (
                        <div key={r} style={{ display: 'inline-flex', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRoleChange(r)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: r !== 'Custom Role' && rolePresets.length > 1 ? '20px 0 0 20px' : '20px',
                              border: isSel ? '1px solid #4F46E5' : '1px solid #CBD5E1',
                              background: isSel ? '#4F46E5' : '#F8FAFC',
                              color: isSel ? '#FFFFFF' : '#475569',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                          >
                            {r}
                          </button>
                          {r !== 'Custom Role' && (
                            <button
                              type="button"
                              title={`Delete ${r} preset`}
                              onClick={(e) => {
                                e.stopPropagation();
                                const updated = rolePresets.filter(p => p !== r);
                                setRolePresets(updated);
                                if (typeof window !== 'undefined') localStorage.setItem('staySync_rolePresets', JSON.stringify(updated));
                                if (role === r) {
                                  setRole('Custom Role');
                                }
                              }}
                              style={{
                                padding: '6px 6px',
                                borderRadius: '0 20px 20px 0',
                                border: isSel ? '1px solid #4F46E5' : '1px solid #CBD5E1',
                                borderLeft: 'none',
                                background: isSel ? '#4338CA' : '#F1F5F9',
                                color: isSel ? '#FFFFFF' : '#94A3B8',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Role Title Input */}
                  <div style={{ marginTop: '8px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                      Role Title / Display Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={customRoleTitle}
                      onChange={(e) => setCustomRoleTitle(e.target.value)}
                      placeholder="e.g. Accountant, Night Warden, Custom Role..."
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '10px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                {/* Assigned Hostels */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>Assigned Hostels</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {properties.map((p: any) => {
                      const isSel = assignedProps.includes(p.pg_id);
                      return (
                        <button
                          key={p.pg_id}
                          type="button"
                          onClick={() => setAssignedProps(prev => isSel ? prev.filter(id => id !== p.pg_id) : [...prev, p.pg_id])}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            border: isSel ? '1px solid #10B981' : '1px solid #CBD5E1',
                            background: isSel ? '#ECFDF5' : '#F8FAFC',
                            color: isSel ? '#047857' : '#475569',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                        >
                          {isSel ? '✓ ' : ''}{p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Granular Permission Builder */}
                <div style={{ background: '#F8FAFC', borderRadius: '16px', padding: '14px', border: '1px solid #E2E8F0', marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0F172A', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sliders size={14} color="#4F46E5" /> Custom Module Permissions
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '8px' }}>
                    {[
                      { key: 'viewDashboard', label: 'View Dashboard' },
                      { key: 'viewTenants', label: 'View Tenants' },
                      { key: 'manageTenants', label: 'Manage Tenants' },
                      { key: 'addTenant', label: 'Add Tenant' },
                      { key: 'editTenant', label: 'Edit Tenant' },
                      { key: 'deleteTenant', label: 'Delete Tenant' },
                      { key: 'viewRooms', label: 'View Rooms' },
                      { key: 'manageRooms', label: 'Manage Rooms' },
                      { key: 'deleteRooms', label: 'Delete Rooms' },
                      { key: 'resolveComplaints', label: 'Resolve Complaints' },
                      { key: 'editMenu', label: 'Edit Food Menu' },
                      { key: 'viewReports', label: 'View Reports' },
                      { key: 'exportReports', label: 'Export Reports' },
                      { key: 'addExpense', label: 'Add Expenses' },
                      { key: 'deleteExpense', label: 'Delete Expenses' },
                      { key: 'sendWhatsAppMessages', label: 'Send WhatsApp' },
                      { key: 'createNotices', label: 'Create Notices' },
                      { key: 'generateDues', label: 'Generate Rent Dues' },
                      { key: 'collectPayments', label: 'Collect Payments' },
                      { key: 'viewHistory', label: 'View History & Print Receipts' }
                    ].map(item => {
                      const val = (formPermissions as any)[item.key] || false;
                      return (
                        <label
                          key={item.key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '6px 10px',
                            background: val ? '#EEF2FF' : '#FFFFFF',
                            border: val ? '1px solid #C7D2FE' : '1px solid #E2E8F0',
                            borderRadius: '10px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: val ? '#4338CA' : '#475569',
                            cursor: 'pointer'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={val}
                            onChange={(e) => setFormPermissions(prev => ({ ...prev, [item.key]: e.target.checked }))}
                            style={{ accentColor: '#4F46E5', width: '15px', height: '15px' }}
                          />
                          {item.label}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setIsAddMemberOpen(false)} style={{ padding: '10px 16px', borderRadius: '12px', background: '#F1F5F9', border: 'none', fontWeight: 600, color: '#475569', fontSize: '0.85rem', cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" disabled={submittingMember} style={{ padding: '10px 20px', borderRadius: '12px', background: 'linear-gradient(135deg, #4F46E5, #4338CA)', color: '#FFFFFF', border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                    {submittingMember ? 'Adding...' : 'Create Account & Send Invite'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL 2: ASSIGN TASK DIALOG ── */}
      <AnimatePresence>
        {isAddTaskOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{ background: '#FFFFFF', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '24px', border: '1px solid #E2E8F0', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', padding: '20px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Assign Task to Staff</h3>
                <button onClick={() => setIsAddTaskOpen(false)} style={{ background: '#F1F5F9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={16} color="#64748B" />
                </button>
              </div>

              <form onSubmit={handleAddTaskSubmit}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Task Title *</label>
                  <input type="text" required value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="e.g. Inspect Room 102 Plumbing" style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Description</label>
                  <textarea value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} rows={2} placeholder="Task instructions..." style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
                </div>

                {/* Interactive Staff Picker Chips */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>Assign To Staff Member *</label>
                  {members.length === 0 ? (
                    <div style={{ padding: '8px', background: '#F8FAFC', borderRadius: '10px', fontSize: '0.78rem', color: '#64748B', textAlign: 'center' }}>
                      No active staff found. Add a member first!
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', maxHeight: '120px', overflowY: 'auto', padding: '2px' }}>
                      {members.map(m => {
                        const isSel = taskAssignedTo === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setTaskAssignedTo(m.id!)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '20px',
                              border: isSel ? '2px solid #4F46E5' : '1px solid #CBD5E1',
                              background: isSel ? '#EEF2FF' : '#F8FAFC',
                              color: isSel ? '#4338CA' : '#475569',
                              fontWeight: 700,
                              fontSize: '0.76rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'all 0.15s'
                            }}
                          >
                            <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: m.avatar_color || '#4F46E5', color: '#FFF', fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                              {m.full_name.slice(0, 1).toUpperCase()}
                            </span>
                            {m.full_name} ({m.role})
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Priority Level Chips */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>Priority Level</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                    {[
                      { level: 'Low', color: '#10B981', bg: '#ECFDF5' },
                      { level: 'Medium', color: '#3B82F6', bg: '#EFF6FF' },
                      { level: 'High', color: '#F59E0B', bg: '#FEF3C7' },
                      { level: 'Urgent', color: '#EF4444', bg: '#FEE2E2' }
                    ].map(p => {
                      const isSel = taskPriority === p.level;
                      return (
                        <button
                          key={p.level}
                          type="button"
                          onClick={() => setTaskPriority(p.level as any)}
                          style={{
                            padding: '8px 2px',
                            borderRadius: '10px',
                            border: isSel ? `2px solid ${p.color}` : '1px solid #CBD5E1',
                            background: isSel ? p.bg : '#F8FAFC',
                            color: isSel ? p.color : '#64748B',
                            fontWeight: 800,
                            fontSize: '0.74rem',
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.15s'
                          }}
                        >
                          {isSel ? '✓ ' : ''}{p.level}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Due Date</label>
                  <input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setIsAddTaskOpen(false)} style={{ padding: '10px 16px', borderRadius: '12px', background: '#F1F5F9', border: 'none', fontWeight: 600, color: '#475569', fontSize: '0.85rem', cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" disabled={submittingTask || !taskAssignedTo} style={{ padding: '10px 20px', borderRadius: '12px', background: 'linear-gradient(135deg, #4F46E5, #4338CA)', color: '#FFFFFF', border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', opacity: !taskAssignedTo ? 0.6 : 1 }}>
                    {submittingTask ? 'Creating...' : 'Assign Task'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── CENTERED CONSTANT-HEIGHT MEMBER DETAIL MODAL ── */}
      <AnimatePresence>
        {selectedMember && (
          <div onClick={() => setSelectedMember(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{
                background: '#FFFFFF',
                width: '100%',
                maxWidth: '480px',
                height: 'min(640px, 85vh)',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <button onClick={() => setSelectedMember(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: '#F1F5F9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', zIndex: 10 }}>
                <X size={16} color="#64748B" />
              </button>

              {/* Fixed Header Section */}
              <div style={{ textAlign: 'center', marginBottom: '14px', paddingTop: '4px', flexShrink: 0 }}>
                <div style={{ position: 'relative', width: '72px', height: '72px', margin: '0 auto 10px auto' }}>
                  {selectedMember.photo_url ? (
                    <img
                      src={selectedMember.photo_url}
                      alt={selectedMember.full_name}
                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '3px solid #EEF2FF', boxShadow: '0 4px 10px rgba(0,0,0,0.08)' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: selectedMember.avatar_color || '#4F46E5', color: '#FFFFFF', fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.08)' }}>
                      {selectedMember.full_name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <label style={{ position: 'absolute', bottom: 0, right: 0, width: '26px', height: '26px', borderRadius: '50%', background: '#4F46E5', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.2)', border: '2px solid #FFFFFF' }} title="Upload / Change Profile Picture">
                    <Camera size={13} />
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleProfilePhotoUpload} />
                  </label>
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>{selectedMember.full_name}</h3>
                <span style={{ fontSize: '0.82rem', color: '#6366F1', fontWeight: 700 }}>{selectedMember.role}</span>
              </div>

              {/* Profile Navigation Tabs (Fixed) */}
              <div style={{ display: 'flex', gap: '4px', background: '#F1F5F9', padding: '4px', borderRadius: '12px', marginBottom: '16px', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setProfileTab('personal')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    border: 'none',
                    background: profileTab === 'personal' ? '#FFFFFF' : 'transparent',
                    color: profileTab === 'personal' ? '#4F46E5' : '#64748B',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    boxShadow: profileTab === 'personal' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none'
                  }}
                >
                  Personal Details
                </button>
                <button
                  type="button"
                  onClick={() => setProfileTab('logs')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    border: 'none',
                    background: profileTab === 'logs' ? '#FFFFFF' : 'transparent',
                    color: profileTab === 'logs' ? '#4F46E5' : '#64748B',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    boxShadow: profileTab === 'logs' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none'
                  }}
                >
                  Activity Logs
                </button>
                <button
                  type="button"
                  onClick={() => setProfileTab('documents')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    border: 'none',
                    background: profileTab === 'documents' ? '#FFFFFF' : 'transparent',
                    color: profileTab === 'documents' ? '#4F46E5' : '#64748B',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    boxShadow: profileTab === 'documents' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none'
                  }}
                >
                  Documents
                </button>
              </div>

              {/* Scrollable Modal Content Body */}
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>

              {/* TAB 1: PERSONAL DETAILS */}
              {profileTab === 'personal' && (
                <div>
                  <div style={{ background: '#F8FAFC', borderRadius: '14px', padding: '14px', border: '1px solid #E2E8F0', marginBottom: '20px', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: '#64748B' }}>Email:</span> <strong style={{ color: '#0F172A' }}>{selectedMember.email}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: '#64748B' }}>Phone:</span> <strong style={{ color: '#0F172A' }}>{selectedMember.phone}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: '#64748B' }}>Employee ID:</span> <strong style={{ color: '#0F172A' }}>{selectedMember.employee_id}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: '#64748B' }}>Status:</span> <span style={{ background: selectedMember.status === 'Active' ? '#DCFCE7' : '#FEE2E2', color: selectedMember.status === 'Active' ? '#166534' : '#991B1B', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, fontSize: '0.75rem' }}>{selectedMember.status}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748B' }}>Joined:</span> <strong style={{ color: '#0F172A' }}>{new Date(selectedMember.joined_date).toLocaleDateString()}</strong></div>
                  </div>

                  <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>Assigned Hostels</h4>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    {selectedMember.assigned_properties && selectedMember.assigned_properties.length > 0 ? (
                      selectedMember.assigned_properties.map(pId => {
                        const pObj = properties.find((p: any) => p.pg_id === pId || p.id === pId);
                        return (
                          <span key={pId} style={{ background: '#ECFDF5', color: '#047857', padding: '4px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Building size={12} /> {pObj?.name || pId}
                          </span>
                        );
                      })
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>All Owner Hostels</span>
                    )}
                  </div>

                  <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0F172A', marginBottom: '10px' }}>Active Permissions</h4>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px' }}>
                    {Object.entries(selectedMember.permissions || {}).map(([key, val]) => {
                      if (!val || key === 'printReceipts') return null;
                      let displayLabel = key;
                      if (key === 'viewHistory') displayLabel = 'View History & Print Receipts';
                      else if (key === 'viewDashboard') displayLabel = 'View Dashboard';
                      else if (key === 'viewTenants') displayLabel = 'View Tenants (Read Only)';
                      else if (key === 'manageTenants') displayLabel = 'View & Manage Tenants';
                      else if (key === 'viewRooms') displayLabel = 'View Rooms (Read Only)';
                      else if (key === 'manageRooms') displayLabel = 'View & Manage Rooms';
                      return (
                        <span key={key} style={{ background: '#EEF2FF', color: '#4338CA', padding: '3px 8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 700 }}>
                          ✓ {displayLabel}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: ACTIVITY LOGS */}
              {profileTab === 'logs' && (
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0F172A', marginBottom: '12px' }}>Staff Activity Timeline</h4>
                  {(() => {
                    const memberLogs = logs.filter(l =>
                      (l.performed_by_name && l.performed_by_name.toLowerCase().includes(selectedMember.full_name.toLowerCase())) ||
                      (l.details && l.details.toLowerCase().includes(selectedMember.full_name.toLowerCase()))
                    );
                    if (memberLogs.length === 0) {
                      return (
                        <div style={{ textAlign: 'center', color: '#94A3B8', padding: '30px 10px', background: '#F8FAFC', borderRadius: '14px', border: '1px dashed #CBD5E1', fontSize: '0.82rem' }}>
                          No activity recorded for {selectedMember.full_name} yet.
                        </div>
                      );
                    }
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {memberLogs.map((log, idx) => {
                          const createdByName = log.performed_by_name || (log as any).created_by_name || 'Property Owner';
                          const grantedPerms: string[] = (log as any).granted_permissions || [];

                          return (
                            <div key={log.id || idx} style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '0.8rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>
                                <span>{log.action}</span>
                                <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{new Date(log.created_at).toLocaleDateString()}</span>
                              </div>

                              <p style={{ margin: '0 0 6px 0', color: '#475569', fontSize: '0.78rem', lineHeight: '1.4' }}>{log.details}</p>

                              {/* Performed By / Created By Info */}
                              <div style={{ fontSize: '0.73rem', color: '#6366F1', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span>👤 Created / Performed by:</span> <strong>{createdByName} ({log.performed_by_role || 'Owner'})</strong>
                              </div>

                              {/* Granted Permissions List */}
                              {(grantedPerms.length > 0 || (log.action === 'Added Team Member' && selectedMember.permissions)) && (
                                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #CBD5E1' }}>
                                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Granted Permissions:</span>
                                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                    {(grantedPerms.length > 0 ? grantedPerms : Object.entries(selectedMember.permissions || {}).filter(([_, v]) => Boolean(v) && _ !== 'printReceipts').map(([k]) => {
                                      if (k === 'viewHistory') return 'View History & Receipts';
                                      if (k === 'viewDashboard') return 'View Dashboard';
                                      if (k === 'viewTenants') return 'View Tenants';
                                      if (k === 'manageTenants') return 'Manage Tenants';
                                      if (k === 'viewRooms') return 'View Rooms';
                                      if (k === 'manageRooms') return 'Manage Rooms';
                                      if (k === 'resolveComplaints') return 'Resolve Complaints';
                                      if (k === 'collectPayments') return 'Collect Payments';
                                      if (k === 'addExpense') return 'Add Expenses';
                                      if (k === 'createNotices') return 'Create Notices';
                                      return k;
                                    })).map((perm, pIdx) => (
                                      <span key={pIdx} style={{ background: '#EEF2FF', color: '#4338CA', padding: '2px 6px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700 }}>
                                        ✓ {perm}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* TAB 3: DOCUMENTS (MATCHES TENANTS PROFILE EXPERIENCE) */}
              {profileTab === 'documents' && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Government Verification Documents</h4>
                    {!isEditingDrawerDoc && (
                      <button
                        type="button"
                        onClick={() => setIsEditingDrawerDoc(true)}
                        style={{ background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE', padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Edit3 size={12} /> Edit Details
                      </button>
                    )}
                  </div>

                  {/* Govt ID Meta Header Card */}
                  <div style={{ background: '#F8FAFC', borderRadius: '14px', padding: '14px', border: '1px solid #E2E8F0', marginBottom: '16px', fontSize: '0.82rem' }}>
                    {isEditingDrawerDoc ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Govt ID Type</label>
                          <select
                            value={drawerGovtIdType}
                            onChange={(e) => setDrawerGovtIdType(e.target.value)}
                            style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.8rem', background: '#FFFFFF' }}
                          >
                            <option value="Aadhaar Card">Aadhaar Card</option>
                            <option value="PAN Card">PAN Card</option>
                            <option value="Voter ID">Voter ID</option>
                            <option value="Driving License">Driving License</option>
                            <option value="Passport">Passport</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Govt ID Number</label>
                          <input
                            type="text"
                            value={drawerGovtIdNumber}
                            onChange={(e) => setDrawerGovtIdNumber(e.target.value)}
                            placeholder="e.g. 1234-5678-9012"
                            style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.8rem', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ color: '#64748B' }}>Govt ID Type:</span>
                          <strong style={{ color: '#0F172A' }}>{selectedMember.govt_id_type || 'Aadhaar Card'}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748B' }}>Govt ID Number:</span>
                          <strong style={{ color: '#0F172A' }}>{selectedMember.govt_id_number || 'Not Provided'}</strong>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Tenant-Style Document Upload Cards List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                    {/* Govt ID Front Item */}
                    <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '12px', border: '1px dashed #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '8px', overflow: 'hidden', background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {drawerGovtIdUrl ? (
                            <img src={drawerGovtIdUrl} alt="Govt Front" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <Camera size={20} color="#64748B" />
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1E293B' }}>Govt ID Proof (Front)</div>
                          <div style={{ fontSize: '0.75rem', color: drawerGovtIdUrl ? '#10B981' : '#64748B', fontWeight: drawerGovtIdUrl ? 700 : 400 }}>
                            {drawerGovtIdUrl ? '✓ Document Uploaded' : 'No front document uploaded'}
                          </div>
                        </div>
                      </div>
                      <label style={{ padding: '6px 14px', background: '#4F46E5', color: '#FFF', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'inline-block' }}>
                        {drawerGovtIdUrl ? 'Change' : 'Upload'}
                        <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={(e) => handleDrawerGovtIdUpload(e, false)} />
                      </label>
                    </div>

                    {/* Govt ID Back Item */}
                    <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '12px', border: '1px dashed #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '8px', overflow: 'hidden', background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {drawerGovtIdBackUrl ? (
                            <img src={drawerGovtIdBackUrl} alt="Govt Back" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <Camera size={20} color="#64748B" />
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1E293B' }}>Govt ID Proof (Back)</div>
                          <div style={{ fontSize: '0.75rem', color: drawerGovtIdBackUrl ? '#10B981' : '#64748B', fontWeight: drawerGovtIdBackUrl ? 700 : 400 }}>
                            {drawerGovtIdBackUrl ? '✓ Document Uploaded' : 'No back document uploaded'}
                          </div>
                        </div>
                      </div>
                      <label style={{ padding: '6px 14px', background: '#4F46E5', color: '#FFF', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'inline-block' }}>
                        {drawerGovtIdBackUrl ? 'Change' : 'Upload'}
                        <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={(e) => handleDrawerGovtIdUpload(e, true)} />
                      </label>
                    </div>
                  </div>

                  {/* Save Changes Button */}
                  {(isEditingDrawerDoc || drawerGovtIdUrl !== (selectedMember.govt_id_url || '') || drawerGovtIdBackUrl !== (selectedMember.govt_id_back_url || '') || drawerGovtIdNumber !== (selectedMember.govt_id_number || '')) && (
                    <button
                      type="button"
                      disabled={isSavingDrawerDoc}
                      onClick={handleSaveMemberGovtId}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '12px',
                        background: '#10B981',
                        color: '#FFFFFF',
                        border: 'none',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                      }}
                    >
                      <CheckCircle2 size={16} />
                      {isSavingDrawerDoc ? 'Saving Document Changes...' : 'Save Document Changes'}
                    </button>
                  )}
                </div>
              )}
              </div>

              {/* Fixed Footer Action Button */}
              <div style={{ flexShrink: 0, paddingTop: '10px' }}>
                <button
                  onClick={() => {
                    setEditingPermissionsMember(selectedMember);
                    setEditPermissions(selectedMember.permissions || formPermissions);
                    setEditPropertyPermissions(selectedMember.property_permissions || {});
                    setEditAssignedProps(selectedMember.assigned_properties || []);
                    setSelectedPermissionScope('GLOBAL');
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '14px',
                    background: '#4F46E5',
                    color: '#FFFFFF',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)'
                  }}
                >
                  <Edit3 size={16} />
                  <span>Edit Permissions & Hostels</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL 3: EDIT PERMISSIONS & HOSTEL ASSIGNMENT DIALOG ── */}
      <AnimatePresence>
        {editingPermissionsMember && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              style={{ background: '#FFFFFF', width: '100%', maxWidth: '720px', maxHeight: '88vh', borderRadius: '24px', border: '1px solid #E2E8F0', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', padding: '24px', overflowY: 'auto' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ background: '#EEF2FF', padding: '8px', borderRadius: '10px' }}>
                    <Edit3 size={20} color="#4F46E5" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Edit Staff Account & Permissions</h3>
                    <p style={{ fontSize: '0.78rem', color: '#64748B', margin: 0 }}>{editingPermissionsMember.full_name} ({editingPermissionsMember.email})</p>
                  </div>
                </div>
                <button onClick={() => setEditingPermissionsMember(null)} style={{ background: '#F1F5F9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={16} color="#64748B" />
                </button>
              </div>

              <form onSubmit={handleSavePermissions}>
                {/* 0. Edit Role Title */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px' }}>Role Title / Display Name</label>
                  <input 
                    type="text"
                    value={editRoleTitle}
                    onChange={(e) => setEditRoleTitle(e.target.value)}
                    placeholder="e.g. Accountant, Night Warden, Custom Role..."
                    style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                {/* 1. Assign to Hostels */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '8px' }}>Assign Hostels</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {properties.map((p: any) => {
                      const isSel = editAssignedProps.includes(p.pg_id);
                      return (
                        <button
                          key={p.pg_id}
                          type="button"
                          onClick={() => setEditAssignedProps(prev => isSel ? prev.filter(id => id !== p.pg_id) : [...prev, p.pg_id])}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '14px',
                            border: isSel ? '2px solid #10B981' : '1px solid #CBD5E1',
                            background: isSel ? '#ECFDF5' : '#F8FAFC',
                            color: isSel ? '#047857' : '#475569',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          {isSel ? <Check size={14} /> : <Building size={14} />}
                          <span>{p.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. PER-HOSTEL PERMISSION SCOPE SELECTOR TABS */}
                <div style={{ background: '#F8FAFC', borderRadius: '16px', padding: '16px', border: '1px solid #E2E8F0', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sliders size={16} color="#4F46E5" /> Configurable Module Permissions
                    </h4>
                    {selectedPermissionScope !== 'GLOBAL' && (
                      <button
                        type="button"
                        onClick={() => {
                          const pgId = selectedPermissionScope;
                          setEditPropertyPermissions(prev => ({
                            ...prev,
                            [pgId]: { ...editPermissions }
                          }));
                          toast.success(`Copied global permissions to ${properties.find((p: any) => p.pg_id === pgId)?.name || 'Hostel'}`);
                        }}
                        style={{ background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE', padding: '4px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Copy Global Permissions
                      </button>
                    )}
                  </div>

                  {/* Hostel Permission Scope Pills */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px', background: '#E2E8F0', padding: '4px', borderRadius: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedPermissionScope('GLOBAL')}
                      style={{
                        flex: '1 1 auto',
                        padding: '7px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        background: selectedPermissionScope === 'GLOBAL' ? '#4F46E5' : 'transparent',
                        color: selectedPermissionScope === 'GLOBAL' ? '#FFFFFF' : '#475569',
                        fontWeight: 800,
                        fontSize: '0.76rem',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s'
                      }}
                    >
                      🌐 All Hostels (Default)
                    </button>

                    {editAssignedProps.map(pId => {
                      const propObj = properties.find((p: any) => p.pg_id === pId);
                      const pName = propObj?.name || 'Hostel';
                      const isSel = selectedPermissionScope === pId;
                      const hasCustom = Boolean(editPropertyPermissions[pId] && Object.keys(editPropertyPermissions[pId]).length > 0);
                      return (
                        <button
                          key={pId}
                          type="button"
                          onClick={() => {
                            setSelectedPermissionScope(pId);
                            if (!editPropertyPermissions[pId]) {
                              setEditPropertyPermissions(prev => ({
                                ...prev,
                                [pId]: { ...editPermissions }
                              }));
                            }
                          }}
                          style={{
                            flex: '1 1 auto',
                            padding: '7px 12px',
                            borderRadius: '8px',
                            border: 'none',
                            background: isSel ? '#10B981' : 'transparent',
                            color: isSel ? '#FFFFFF' : '#475569',
                            fontWeight: 800,
                            fontSize: '0.76rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            transition: 'all 0.15s'
                          }}
                        >
                          <Building size={13} />
                          <span>{pName}</span>
                          {hasCustom && (
                            <span style={{ fontSize: '0.62rem', background: isSel ? '#047857' : '#10B981', color: '#FFF', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>
                              Custom
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {selectedPermissionScope !== 'GLOBAL' && (
                    <div style={{ fontSize: '0.75rem', color: '#047857', background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '6px 10px', borderRadius: '8px', marginBottom: '12px', fontWeight: 700 }}>
                      ⚡ Customizing permissions specifically for <strong>{properties.find((p: any) => p.pg_id === selectedPermissionScope)?.name || 'selected hostel'}</strong>.
                    </div>
                  )}

                  {/* Module Checkbox Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '10px' }}>
                    {[
                      { key: 'viewDashboard', label: 'View Dashboard' },
                      { key: 'viewTenants', label: 'View Tenants (Read Only)' },
                      { key: 'manageTenants', label: 'View & Manage Tenants' },
                      { key: 'viewRooms', label: 'View Rooms (Read Only)' },
                      { key: 'manageRooms', label: 'View & Manage Rooms' },
                      { key: 'deleteRooms', label: 'Delete Rooms' },
                      { key: 'collectPayments', label: 'Collect Payments & Dues' },
                      { key: 'generateDues', label: 'Generate Rent Dues' },
                      { key: 'resolveComplaints', label: 'Resolve Complaints' },
                      { key: 'viewHistory', label: 'View History & Print Receipts' },
                      { key: 'viewReports', label: 'View Reports & Analytics' },
                      { key: 'addExpense', label: 'Manage Expenses' },
                      { key: 'editMenu', label: 'Edit Food Menu' },
                      { key: 'createNotices', label: 'Create Notices' },
                      { key: 'sendWhatsAppMessages', label: 'Send WhatsApp Suite' }
                    ].map(item => {
                      const activePermsObj = selectedPermissionScope === 'GLOBAL' 
                        ? editPermissions 
                        : (editPropertyPermissions[selectedPermissionScope] || editPermissions);

                      const val = (activePermsObj as any)[item.key] || false;

                      return (
                        <label
                          key={item.key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            background: val ? (selectedPermissionScope === 'GLOBAL' ? '#EEF2FF' : '#ECFDF5') : '#FFFFFF',
                            border: val ? (selectedPermissionScope === 'GLOBAL' ? '1.5px solid #818CF8' : '1.5px solid #34D399') : '1px solid #E2E8F0',
                            borderRadius: '12px',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            color: val ? (selectedPermissionScope === 'GLOBAL' ? '#4338CA' : '#047857') : '#475569',
                            cursor: 'pointer'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={val}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              if (selectedPermissionScope === 'GLOBAL') {
                                setEditPermissions(prev => ({ ...prev, [item.key]: isChecked }));
                              } else {
                                const pgId = selectedPermissionScope;
                                setEditPropertyPermissions(prev => ({
                                  ...prev,
                                  [pgId]: {
                                    ...(prev[pgId] || editPermissions),
                                    [item.key]: isChecked
                                  }
                                }));
                              }
                            }}
                            style={{ accentColor: selectedPermissionScope === 'GLOBAL' ? '#4F46E5' : '#10B981', width: '16px', height: '16px' }}
                          />
                          {item.label}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setEditingPermissionsMember(null)} style={{ padding: '10px 16px', borderRadius: '12px', background: '#F1F5F9', border: 'none', fontWeight: 600, color: '#475569', fontSize: '0.85rem', cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" disabled={savingPermissions} style={{ padding: '10px 20px', borderRadius: '12px', background: 'linear-gradient(135deg, #4F46E5, #4338CA)', color: '#FFFFFF', border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                    {savingPermissions ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      </div>
    </ProtectedRoute>
  );
}
