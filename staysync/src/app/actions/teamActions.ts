"use server";
// Turbopack Cache Refreshed - Permissions Export Fix
import { adminDb } from '@/lib/firebase-admin';
import { getDefaultPermissionsForRole as getRolePermissions, type TeamMemberPermissions } from '@/permissions';
import type { Role } from '@/types/roles';

export interface TeamMember {
  id?: string;
  owner_id: string;
  full_name: string;
  email: string;
  phone: string;
  employee_id?: string;
  role: Role;
  assigned_properties: string[]; // pg_ids
  permissions: TeamMemberPermissions;
  property_permissions?: Record<string, TeamMemberPermissions>;
  status: 'Active' | 'Pending' | 'Suspended';
  notes?: string;
  joined_date: string;
  last_active?: string;
  avatar_color?: string;
  photo_url?: string;
  govt_id_type?: string;
  govt_id_number?: string;
  govt_id_url?: string;
  govt_id_back_url?: string;
}

export interface TaskItem {
  id?: string;
  owner_id: string;
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'Pending' | 'In Progress' | 'Review' | 'Completed' | 'Cancelled';
  progress: number; // 0 - 100
  due_date: string;
  pg_id: string;
  pg_name?: string;
  assigned_to_id: string;
  assigned_to_name: string;
  assigned_by_id: string;
  assigned_by_name: string;
  created_at: string;
  updated_at: string;
  comments_count?: number;
}

export interface ActivityLogEntry {
  id?: string;
  owner_id: string;
  pg_id?: string;
  pg_name?: string;
  action: string;
  performed_by_name: string;
  performed_by_role: string;
  details?: string;
  created_at: string;
}

export async function getDefaultPermissionsForRole(role: string): Promise<TeamMemberPermissions> {
  return getRolePermissions(role);
}

/**
 * Fetch all team members under an owner
 */
export async function getTeamMembersAction(ownerId: string) {
  try {
    const snap = await adminDb.collection('team_members')
      .where('owner_id', '==', ownerId)
      .get();

    const members: TeamMember[] = snap.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as TeamMember)
    }));

    return { success: true, data: members };
  } catch (error: any) {
    console.error('getTeamMembersAction error:', error);
    return { success: false, error: error.message || 'Failed to fetch team members', data: [] };
  }
}

/**
 * Create/Invite a new team member
 */
export async function createTeamMemberAction(params: {
  ownerId: string;
  fullName: string;
  email: string;
  phone: string;
  employeeId?: string;
  role: Role;
  assignedProperties: string[];
  permissions: TeamMemberPermissions;
  propertyPermissions?: Record<string, TeamMemberPermissions>;
  notes?: string;
  govtIdType?: string;
  govtIdNumber?: string;
  govtIdUrl?: string;
  govtIdBackUrl?: string;
}) {
  try {
    const cleanEmail = params.email.toLowerCase().trim();
    
    // Global duplicate check across ALL users (tenants, team_members, owners)
    const { validateDuplicateEmailPhone } = await import('@/lib/repository');
    const dupCheck = await validateDuplicateEmailPhone({
      email: cleanEmail,
      phone: params.phone
    });
    if (!dupCheck.allowed) {
      return { success: false, error: dupCheck.error || 'Email or phone number already exists in the system.' };
    }

    const avatarColors = ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4'];
    const avatarColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];

    // 1. Auto-create Firebase Auth User if not existing
    const { adminAuth } = await import('@/lib/firebase-admin');
    let authUid: string | undefined;
    const initialPassword = params.phone ? `Sync@${params.phone.replace(/\D/g, '').slice(-6)}` : 'StaySync@123';

    try {
      const userRecord = await adminAuth.getUserByEmail(cleanEmail);
      authUid = userRecord.uid;
    } catch (e: any) {
      const newUser = await adminAuth.createUser({
        email: cleanEmail,
        password: initialPassword,
        displayName: params.fullName
      });
      authUid = newUser.uid;
    }

    // 2. Write team_members document
    const newMemberData: TeamMember & { auth_uid?: string; initial_password?: string } = {
      owner_id: params.ownerId,
      full_name: params.fullName,
      email: cleanEmail,
      phone: params.phone,
      employee_id: params.employeeId || `EMP-${Date.now().toString().slice(-4)}`,
      role: params.role,
      assigned_properties: params.assignedProperties,
      permissions: params.permissions,
      property_permissions: params.propertyPermissions || {},
      status: 'Active',
      notes: params.notes || '',
      joined_date: new Date().toISOString(),
      last_active: 'Just now',
      avatar_color: avatarColor,
      photo_url: (params as any).photoUrl || '',
      auth_uid: authUid,
      initial_password: initialPassword,
      govt_id_type: params.govtIdType || '',
      govt_id_number: params.govtIdNumber || '',
      govt_id_url: params.govtIdUrl || '',
      govt_id_back_url: params.govtIdBackUrl || ''
    };

    const docRef = await adminDb.collection('team_members').add(newMemberData);

    // 3. Write user_profiles document for role routing
    if (authUid) {
      await adminDb.collection('user_profiles').doc(authUid).set({
        email: cleanEmail,
        full_name: params.fullName,
        role: 'team_member',
        staff_role: params.role,
        owner_id: params.ownerId,
        permissions: params.permissions,
        property_permissions: params.propertyPermissions || {},
        assigned_properties: params.assignedProperties,
        status: 'Active',
        accountInitialized: true,
        updated_at: new Date().toISOString()
      }, { merge: true });
    }

    // Lookup owner name for audit log
    let creatorName = 'Property Owner';
    try {
      const ownerSnap = await adminDb.collection('user_profiles').doc(params.ownerId).get();
      if (ownerSnap.exists) {
        creatorName = ownerSnap.data()?.full_name || creatorName;
      }
    } catch (e) {}

    const grantedPermsList = Object.entries(params.permissions || {})
      .filter(([k, v]) => Boolean(v) && k !== 'printReceipts')
      .map(([k]) => {
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
        return k.replace(/([A-Z])/g, ' $1').trim();
      });

    const permsSummary = grantedPermsList.length > 0 ? grantedPermsList.join(', ') : 'Default Permissions';

    // Audit log with creator name & permissions
    await adminDb.collection('activity_logs').add({
      owner_id: params.ownerId,
      action: 'Added Team Member',
      performed_by_name: creatorName,
      performed_by_role: 'Owner',
      created_by_name: creatorName,
      details: `Created account for ${params.fullName} (${params.role}) by ${creatorName}. Permissions granted: ${permsSummary}`,
      granted_permissions: grantedPermsList,
      created_at: new Date().toISOString()
    });

    return { success: true, id: docRef.id, initialPassword };
  } catch (error: any) {
    console.error('createTeamMemberAction error:', error);
    return { success: false, error: error.message || 'Failed to create team member' };
  }
}

/**
 * Update member permissions
 */
export async function updateTeamMemberPermissionsAction(params: {
  memberId: string;
  permissions: TeamMemberPermissions;
  propertyPermissions?: Record<string, TeamMemberPermissions>;
  role?: Role;
  assignedProperties?: string[];
}) {
  try {
    const updatePayload: any = {
      permissions: params.permissions,
      updated_at: new Date().toISOString()
    };
    if (params.propertyPermissions) updatePayload.property_permissions = params.propertyPermissions;
    if (params.role) updatePayload.role = params.role;
    if (params.assignedProperties) updatePayload.assigned_properties = params.assignedProperties;

    const memberRef = adminDb.collection('team_members').doc(params.memberId);
    const memberDoc = await memberRef.get();
    await memberRef.update(updatePayload);

    if (memberDoc.exists) {
      const mData = memberDoc.data();
      const authUid = mData?.auth_uid;
      const email = (mData?.email || '').trim().toLowerCase();
      const memberName = mData?.full_name || 'Staff Member';
      const ownerId = mData?.owner_id;

      let editorName = 'Property Owner';
      if (ownerId) {
        try {
          const ownerSnap = await adminDb.collection('user_profiles').doc(ownerId).get();
          if (ownerSnap.exists) editorName = ownerSnap.data()?.full_name || editorName;
        } catch (e) {}
      }

      const grantedPermsList = Object.entries(params.permissions || {})
        .filter(([k, v]) => Boolean(v) && k !== 'printReceipts')
        .map(([k]) => {
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
          return k.replace(/([A-Z])/g, ' $1').trim();
        });

      const profilePayload: any = {
        permissions: params.permissions,
        updated_at: new Date().toISOString()
      };
      if (params.propertyPermissions) profilePayload.property_permissions = params.propertyPermissions;
      if (params.role) profilePayload.staff_role = params.role;
      if (params.assignedProperties) profilePayload.assigned_properties = params.assignedProperties;

      if (authUid) {
        await adminDb.collection('user_profiles').doc(authUid).set(profilePayload, { merge: true });
      }
      if (email) {
        const uSnap = await adminDb.collection('user_profiles').get();
        for (const uDoc of uSnap.docs) {
          const uData = uDoc.data();
          if ((uData.email || '').trim().toLowerCase() === email) {
            await uDoc.ref.set(profilePayload, { merge: true });
          }
        }
      }

      // Add audit log for permission update
      if (ownerId) {
        await adminDb.collection('activity_logs').add({
          owner_id: ownerId,
          action: 'Updated Member Permissions',
          performed_by_name: editorName,
          performed_by_role: 'Owner',
          details: `Updated permissions for ${memberName} by ${editorName}. Granted permissions: ${grantedPermsList.join(', ')}`,
          granted_permissions: grantedPermsList,
          created_at: new Date().toISOString()
        });
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('updateTeamMemberPermissionsAction error:', error);
    return { success: false, error: error.message || 'Failed to update permissions' };
  }
}

/**
 * Toggle member status (Active / Suspended)
 */
export async function toggleTeamMemberStatusAction(memberId: string, status: 'Active' | 'Suspended') {
  try {
    const memberRef = adminDb.collection('team_members').doc(memberId);
    const memberSnap = await memberRef.get();

    await memberRef.update({
      status,
      updated_at: new Date().toISOString()
    });

    if (memberSnap.exists) {
      const data = memberSnap.data();
      const authUid = data?.auth_uid;
      const cleanEmail = (data?.email || '').trim().toLowerCase();

      const profileUpdate = {
        status: status,
        is_active: status === 'Active',
        updated_at: new Date().toISOString()
      };

      if (authUid) {
        await adminDb.collection('user_profiles').doc(authUid).set(profileUpdate, { merge: true });
      }
      if (cleanEmail) {
        const uSnap = await adminDb.collection('user_profiles').where('email', '==', cleanEmail).get();
        for (const uDoc of uSnap.docs) {
          await uDoc.ref.set(profileUpdate, { merge: true });
        }
      }
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update status' };
  }
}

/**
 * Update team member profile picture photo_url
 */
export async function updateTeamMemberPhotoAction(arg1: any, arg2?: string) {
  try {
    const memberId = (typeof arg1 === 'string' ? arg1 : arg1?.memberId || '').trim();
    const photoUrl = typeof arg1 === 'string' ? (arg2 || '') : (arg1?.photoUrl || '');

    if (!memberId) {
      return { success: false, error: 'Member ID is required' };
    }

    await adminDb.collection('team_members').doc(memberId).update({
      photo_url: photoUrl,
      updated_at: new Date().toISOString()
    });

    const memberSnap = await adminDb.collection('team_members').doc(memberId).get();
    if (memberSnap.exists) {
      const authUid = memberSnap.data()?.auth_uid;
      if (authUid && typeof authUid === 'string' && authUid.trim() !== '') {
        await adminDb.collection('user_profiles').doc(authUid.trim()).set({
          photo_url: photoUrl,
          updated_at: new Date().toISOString()
        }, { merge: true });
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('updateTeamMemberPhotoAction error:', error);
    return { success: false, error: error.message || 'Failed to update profile photo' };
  }
}

/**
 * Update team member Govt ID details & documents post-creation
 */
export async function updateTeamMemberGovtIdAction(params: {
  memberId: string;
  govtIdType: string;
  govtIdNumber: string;
  govtIdUrl?: string;
  govtIdBackUrl?: string;
}) {
  try {
    const updatePayload: any = {
      govt_id_type: params.govtIdType,
      govt_id_number: params.govtIdNumber,
      updated_at: new Date().toISOString()
    };
    if (params.govtIdUrl !== undefined && params.govtIdUrl !== '') updatePayload.govt_id_url = params.govtIdUrl;
    if (params.govtIdBackUrl !== undefined && params.govtIdBackUrl !== '') updatePayload.govt_id_back_url = params.govtIdBackUrl;

    await adminDb.collection('team_members').doc(params.memberId).update(updatePayload);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update Govt ID documents' };
  }
}

/**
 * Delete a team member
 */
export async function deleteTeamMemberAction(memberId: string) {
  try {
    await adminDb.collection('team_members').doc(memberId).delete();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to delete member' };
  }
}

/**
 * Fetch tasks for owner or member
 */
export async function getTasksAction(ownerId: string) {
  try {
    const snap = await adminDb.collection('tasks')
      .where('owner_id', '==', ownerId)
      .get();

    const tasks: TaskItem[] = snap.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as TaskItem)
    }));

    tasks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { success: true, data: tasks };
  } catch (error: any) {
    console.error('getTasksAction error:', error);
    return { success: false, error: error.message || 'Failed to fetch tasks', data: [] };
  }
}

/**
 * Create a new task
 */
export async function createTaskAction(params: {
  ownerId: string;
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  dueDate: string;
  pgId: string;
  pgName?: string;
  assignedToId: string;
  assignedToName: string;
  assignedByName?: string;
}) {
  try {
    const taskData: TaskItem = {
      owner_id: params.ownerId,
      title: params.title,
      description: params.description,
      priority: params.priority,
      status: 'Pending',
      progress: 0,
      due_date: params.dueDate,
      pg_id: params.pgId,
      pg_name: params.pgName || 'Himalaya Hostels',
      assigned_to_id: params.assignedToId,
      assigned_to_name: params.assignedToName,
      assigned_by_id: params.ownerId,
      assigned_by_name: params.assignedByName || 'Owner',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const docRef = await adminDb.collection('tasks').add(taskData);

    // Audit Log
    await adminDb.collection('activity_logs').add({
      owner_id: params.ownerId,
      pg_id: params.pgId,
      pg_name: params.pgName || 'Hostel',
      action: 'Task Assigned',
      performed_by_name: params.assignedByName || 'Owner',
      performed_by_role: 'Owner',
      details: `Assigned task "${params.title}" to ${params.assignedToName}`,
      created_at: new Date().toISOString()
    });

    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error('createTaskAction error:', error);
    return { success: false, error: error.message || 'Failed to create task' };
  }
}

/**
 * Update task status & progress
 */
export async function updateTaskStatusAction(taskId: string, status: any, progress?: number) {
  try {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (progress !== undefined) updateData.progress = progress;
    else if (status === 'Completed') updateData.progress = 100;
    else if (status === 'In Progress' && (!progress || progress === 0)) updateData.progress = 50;

    await adminDb.collection('tasks').doc(taskId).update(updateData);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update task status' };
  }
}

/**
 * Delete a task
 */
export async function deleteTaskAction(taskId: string) {
  try {
    await adminDb.collection('tasks').doc(taskId).delete();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to delete task' };
  }
}

/**
 * Record a user/owner activity audit log entry
 */
export async function recordActivityLog(params: {
  owner_id: string;
  user_id?: string;
  pg_id?: string;
  tenant_id?: string;
  event_type: string;
  title: string;
  details: string;
  performed_by?: string;
}) {
  try {
    const logRef = adminDb.collection('activity_logs').doc();
    const now = new Date().toISOString();
    await logRef.set({
      log_id: logRef.id,
      owner_id: params.owner_id,
      user_id: params.user_id || params.owner_id,
      pg_id: params.pg_id || '',
      tenant_id: params.tenant_id || '',
      event_type: params.event_type,
      title: params.title,
      details: params.details,
      description: params.details,
      performed_by: params.performed_by || 'User',
      created_at: now,
      timestamp: now
    });
    return { success: true };
  } catch (err) {
    console.warn('recordActivityLog error:', err);
    return { success: false };
  }
}

/**
 * Fetch staff & owner activity audit logs across owner_id, user_id, and pg_id
 */
export async function getActivityLogsAction(ownerId: string, limitCount: number = 50) {
  try {
    // 1. Fetch user's property IDs
    const propertiesSnap = await adminDb.collection('properties')
      .where('owner_id', '==', ownerId)
      .get();
    
    const pgIds = propertiesSnap.docs.map(doc => doc.id);

    // 2. Fetch logs matching owner_id or user_id
    const promises: Promise<FirebaseFirestore.QuerySnapshot>[] = [
      adminDb.collection('activity_logs').where('owner_id', '==', ownerId).limit(limitCount).get(),
      adminDb.collection('activity_logs').where('user_id', '==', ownerId).limit(limitCount).get(),
    ];

    if (pgIds.length > 0) {
      for (let i = 0; i < pgIds.length; i += 10) {
        const chunk = pgIds.slice(i, i + 10);
        promises.push(adminDb.collection('activity_logs').where('pg_id', 'in', chunk).limit(limitCount).get());
      }
    }

    const results = await Promise.all(promises.map(p => p.catch(() => ({ docs: [] } as any))));
    const logMap = new Map<string, any>();

    results.forEach(snap => {
      if (snap && snap.docs) {
        snap.docs.forEach((doc: any) => {
          const data = doc.data() as any;
          const id = doc.id;
          logMap.set(id, {
            id,
            ...data,
            details: data.details || data.description || data.title || data.action || 'Activity Recorded',
            created_at: data.created_at || data.timestamp || new Date().toISOString()
          });
        });
      }
    });

    // Fallback: If activity_logs is empty, query recent payments as activity history
    if (logMap.size === 0 && pgIds.length > 0) {
      const paymentsSnap = await adminDb.collection('payments')
        .where('pg_id', 'in', pgIds.slice(0, 10))
        .limit(20)
        .get()
        .catch(() => ({ docs: [] } as any));

      if (paymentsSnap && paymentsSnap.docs) {
        paymentsSnap.docs.forEach((doc: any) => {
          const p = doc.data();
          const id = doc.id;
          const isPaid = p.status === 'paid';
          logMap.set(`pay_${id}`, {
            id: `pay_${id}`,
            title: isPaid ? 'Payment Received' : 'Rent Fee Generated',
            details: isPaid 
              ? `Collected ₹${p.amount_paid || p.amount} payment via ${p.payment_method || 'UPI'}.`
              : `Generated ${p.month || ''} rent fee of ₹${p.amount}.`,
            event_type: isPaid ? 'PAYMENT_COLLECTED' : 'FEE_GENERATED',
            created_at: p.payment_date || p.created_at || new Date().toISOString()
          });
        });
      }
    }

    const logs = Array.from(logMap.values());
    logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { success: true, data: logs.slice(0, limitCount) };
  } catch (error: any) {
    console.error('getActivityLogsAction error:', error);
    return { success: false, error: error.message || 'Failed to fetch activity logs', data: [] };
  }
}
