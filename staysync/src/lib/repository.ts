/* eslint-disable @typescript-eslint/no-explicit-any */
import { adminDb } from '@/lib/firebase-admin';

// Hostels States
export type HostelStatus = 'ACTIVE' | 'DELETED' | 'ARCHIVED';

// Tenant States
export type TenantStatus = 
  | 'ACTIVE' 
  | 'VACANT' 
  | 'NOTICE_PERIOD' 
  | 'RESERVED' 
  | 'PENDING_MOVE_IN' 
  | 'DELETED' 
  | 'ARCHIVED';

// Tenant states that participate in business logic & duplicate validation
export const PARTICIPATING_TENANT_STATUSES: TenantStatus[] = [
  'ACTIVE',
  'VACANT',
  'NOTICE_PERIOD',
  'RESERVED',
  'PENDING_MOVE_IN'
];

// Tenant states that do NOT participate
export const NON_PARTICIPATING_TENANT_STATUSES: TenantStatus[] = [
  'DELETED',
  'ARCHIVED'
];

/**
 * Normalization helper to determine if a hostel document is active in business logic.
 */
export function isHostelActive(hostel: any): boolean {
  if (!hostel) return false;
  if (hostel.status) {
    return hostel.status === 'ACTIVE';
  }
  // Backward compatibility for legacy docs
  return hostel.is_active !== false;
}

/**
 * Normalization helper to determine if a tenant document is active in business logic.
 */
export function isTenantActiveForBusiness(tenant: any): boolean {
  if (!tenant) return false;
  if (tenant.status) {
    const uppercaseStatus = String(tenant.status).toUpperCase();
    if (uppercaseStatus === 'DELETED' || uppercaseStatus === 'ARCHIVED' || uppercaseStatus === 'VACATED') {
      return false;
    }
    if ((PARTICIPATING_TENANT_STATUSES as string[]).includes(uppercaseStatus)) {
      return true;
    }
  }
  // Backward compatibility for legacy docs
  if (tenant.is_active === false) return false;
  if (tenant.status === 'vacated' || tenant.status === 'deleted') return false;
  return true;
}

/**
 * Get all active hostels belonging to an owner.
 */
export async function getActiveHostels(ownerId: string): Promise<any[]> {
  let targetOwnerId = ownerId;
  let assignedProperties: string[] | null = null;

  if (ownerId) {
    const profileDoc = await adminDb.collection('user_profiles').doc(ownerId).get();
    if (profileDoc.exists) {
      const pData = profileDoc.data();
      if (pData?.role === 'team_member' && pData?.owner_id) {
        targetOwnerId = pData.owner_id;
        if (Array.isArray(pData.assigned_properties) && pData.assigned_properties.length > 0) {
          assignedProperties = pData.assigned_properties;
        }
      }
    } else {
      const teamSnap = await adminDb.collection('team_members')
        .where('auth_uid', '==', ownerId)
        .get();
      if (!teamSnap.empty) {
        const tData = teamSnap.docs[0].data();
        if (tData?.owner_id) {
          targetOwnerId = tData.owner_id;
          if (Array.isArray(tData.assigned_properties) && tData.assigned_properties.length > 0) {
            assignedProperties = tData.assigned_properties;
          }
        }
      }
    }
  }

  let snapshot = await adminDb.collection('properties')
    .where('owner_id', '==', targetOwnerId)
    .get();

  if (snapshot.empty && targetOwnerId === ownerId) {
    const teamSnap = await adminDb.collection('team_members')
      .where('auth_uid', '==', ownerId)
      .get();
    if (!teamSnap.empty) {
      const tData = teamSnap.docs[0].data();
      if (tData?.owner_id) {
        targetOwnerId = tData.owner_id;
        if (Array.isArray(tData.assigned_properties) && tData.assigned_properties.length > 0) {
          assignedProperties = tData.assigned_properties;
        }
        snapshot = await adminDb.collection('properties')
          .where('owner_id', '==', targetOwnerId)
          .get();
      }
    }
  }

  if (snapshot.empty) {
    const allProps = await adminDb.collection('properties').get();
    if (!allProps.empty) {
      snapshot = allProps;
    }
  }

  if (snapshot.empty) return [];

  let hostels = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(h => isHostelActive(h));

  if (assignedProperties && assignedProperties.length > 0) {
    const validAssigned = hostels.filter((h: any) => assignedProperties!.includes(h.id) || assignedProperties!.includes(h.pg_id));
    if (validAssigned.length > 0) hostels = validAssigned;
  }

  hostels.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  return hostels;
}

/**
 * Get active tenants belonging to owner's active hostels.
 */
export async function getActiveTenants(ownerId: string, selectedPgId: string | null = null): Promise<any[]> {
  const activeHostels = await getActiveHostels(ownerId);
  if (activeHostels.length === 0) return [];

  let targetPgIds = activeHostels.map((h: any) => h.pg_id || h.id);
  if (selectedPgId) {
    targetPgIds = targetPgIds.filter(id => id === selectedPgId);
    if (targetPgIds.length === 0) return [];
  }

  const tenants: any[] = [];

  // Firestore 'in' query has a max limit of 10
  if (targetPgIds.length <= 10) {
    const tenantsSnap = await adminDb.collection('tenants')
      .where('pg_id', 'in', targetPgIds)
      .get();
    tenantsSnap.docs.forEach(doc => {
      tenants.push({ id: doc.id, ...doc.data() });
    });
  } else {
    for (const pgId of targetPgIds) {
      const tSnap = await adminDb.collection('tenants')
        .where('pg_id', '==', pgId)
        .get();
      tSnap.docs.forEach(doc => {
        tenants.push({ id: doc.id, ...doc.data() });
      });
    }
  }

  // Filter only tenants participating in business logic
  return tenants.filter(t => isTenantActiveForBusiness(t));
}

/**
 * Get all tenants (including vacated, notice_period, paused, active) belonging to owner's active hostels.
 * Excludes only DELETED and ARCHIVED tenants.
 */
export async function getAllTenants(ownerId: string, selectedPgId: string | null = null): Promise<any[]> {
  const activeHostels = await getActiveHostels(ownerId);
  if (activeHostels.length === 0) return [];

  let targetPgIds = activeHostels.map((h: any) => h.pg_id || h.id);
  if (selectedPgId) {
    targetPgIds = targetPgIds.filter(id => id === selectedPgId);
    if (targetPgIds.length === 0) return [];
  }

  const tenants: any[] = [];

  if (targetPgIds.length <= 10) {
    const tenantsSnap = await adminDb.collection('tenants')
      .where('pg_id', 'in', targetPgIds)
      .get();
    tenantsSnap.docs.forEach(doc => {
      tenants.push({ id: doc.id, ...doc.data() });
    });
  } else {
    for (const pgId of targetPgIds) {
      const tSnap = await adminDb.collection('tenants')
        .where('pg_id', '==', pgId)
        .get();
      tSnap.docs.forEach(doc => {
        tenants.push({ id: doc.id, ...doc.data() });
      });
    }
  }

  return tenants.filter(t => {
    if (!t) return false;
    const s = String(t.status || '').toUpperCase();
    return s !== 'DELETED' && s !== 'ARCHIVED' && t.is_deleted !== true;
  });
}

/**
 * Get visible rooms for an active hostel.
 */
export async function getVisibleRooms(pgId: string): Promise<any[]> {
  const propSnap = await adminDb.collection('properties').doc(pgId).get();
  if (!propSnap.exists || !isHostelActive(propSnap.data())) {
    return [];
  }

  const roomsSnap = await adminDb.collection('rooms').where('pg_id', '==', pgId).get();
  return roomsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Validate duplicate phone number for tenant creation/update.
 * Step 1: Load owner's active hostels.
 * Step 2: Load tenants only from those active hostels.
 * Step 3: Ignore deleted or archived tenants.
 * Step 4: Search phone number inside this filtered dataset.
 */
export async function validateDuplicatePhone(
  ownerId: string, 
  phone: string, 
  excludeTenantId?: string
): Promise<{ allowed: boolean; error?: string }> {
  const cleanPhone = phone.replace(/\D/g, '');
  if (!cleanPhone) {
    return { allowed: false, error: 'Invalid phone number format.' };
  }

  const activeTenants = await getActiveTenants(ownerId);
  const exists = activeTenants.some(t => {
    if (excludeTenantId && (t.tenant_id === excludeTenantId || t.id === excludeTenantId)) {
      return false;
    }
    const tenantPhone = (t.mobile || '').replace(/\D/g, '');
    return tenantPhone === cleanPhone;
  });

  if (exists) {
    return {
      allowed: false,
      error: 'Phone number already exists in one of your active hostels.'
    };
  }

  return { allowed: true };
}

/**
 * Global duplicate check across ALL collections: tenants, team_members, user_profiles.
 * Only checks against active/non-deleted records so deleted users' credentials can be reused.
 */
export async function validateDuplicateEmailPhone(params: {
  email?: string;
  phone?: string;
  excludeId?: string;
  excludeCollection?: 'tenants' | 'team_members' | 'user_profiles';
}): Promise<{ allowed: boolean; error?: string }> {
  const cleanEmail = (params.email || '').toLowerCase().trim();
  const cleanPhoneDigits = (params.phone || '').replace(/\D/g, '');
  const cleanPhone10 = cleanPhoneDigits.length >= 10 ? cleanPhoneDigits.slice(-10) : cleanPhoneDigits;

  if (!cleanEmail && !cleanPhone10) {
    return { allowed: true };
  }

  // 1. Check team_members collection
  const teamSnap = await adminDb.collection('team_members').get();
  for (const doc of teamSnap.docs) {
    if (params.excludeCollection === 'team_members' && doc.id === params.excludeId) continue;
    const d = doc.data();
    if (d.status === 'Deleted' || d.status === 'DELETED') continue;

    const docEmail = (d.email || '').toLowerCase().trim();
    const docPhoneDigits = (d.phone || d.mobile || '').replace(/\D/g, '');
    const docPhone10 = docPhoneDigits.length >= 10 ? docPhoneDigits.slice(-10) : docPhoneDigits;

    if (cleanEmail && docEmail && docEmail === cleanEmail) {
      return { allowed: false, error: `Email "${cleanEmail}" is already registered to team member "${d.full_name || 'Unknown'}".` };
    }

    if (cleanPhone10 && docPhone10 && docPhone10 === cleanPhone10) {
      return { allowed: false, error: `Phone number "${params.phone}" is already registered to team member "${d.full_name || 'Unknown'}".` };
    }
  }

  // 2. Check tenants collection (active/participating tenants only)
  const tenantsSnap = await adminDb.collection('tenants').get();
  for (const doc of tenantsSnap.docs) {
    if (params.excludeCollection === 'tenants' && doc.id === params.excludeId) continue;
    const d = doc.data();
    if (!isTenantActiveForBusiness(d)) continue;

    const docEmail = (d.email || '').toLowerCase().trim();
    const docPhoneDigits = (d.mobile || d.phone || '').replace(/\D/g, '');
    const docPhone10 = docPhoneDigits.length >= 10 ? docPhoneDigits.slice(-10) : docPhoneDigits;

    if (cleanEmail && docEmail && docEmail === cleanEmail) {
      return { allowed: false, error: `Email "${cleanEmail}" is already registered to tenant "${d.full_name || 'Unknown'}".` };
    }

    if (cleanPhone10 && docPhone10 && docPhone10 === cleanPhone10) {
      return { allowed: false, error: `Phone number "${params.phone}" is already registered to tenant "${d.full_name || 'Unknown'}".` };
    }
  }

  // 3. Check user_profiles collection (owners, staff, superadmins)
  const profilesSnap = await adminDb.collection('user_profiles').get();
  for (const doc of profilesSnap.docs) {
    if (doc.id === params.excludeId) continue;
    const d = doc.data();

    const docEmail = (d.email || '').toLowerCase().trim();
    const docPhoneDigits = (d.phone || d.mobile || '').replace(/\D/g, '');
    const docPhone10 = docPhoneDigits.length >= 10 ? docPhoneDigits.slice(-10) : docPhoneDigits;

    if (cleanEmail && docEmail && docEmail === cleanEmail) {
      const roleLabel = d.role === 'pg_owner' ? 'property owner' : (d.role === 'team_member' ? 'team member' : 'user');
      return { allowed: false, error: `Email "${cleanEmail}" is already registered to ${roleLabel} "${d.full_name || 'Unknown'}".` };
    }

    if (cleanPhone10 && docPhone10 && docPhone10 === cleanPhone10) {
      const roleLabel = d.role === 'pg_owner' ? 'property owner' : (d.role === 'team_member' ? 'team member' : 'user');
      return { allowed: false, error: `Phone number "${params.phone}" is already registered to ${roleLabel} "${d.full_name || 'Unknown'}".` };
    }
  }

  return { allowed: true };
}

/**
 * Soft delete a hostel and cascade status change to all its tenants.
 */
export async function softDeleteHostel(pgId: string, ownerId?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const deletedAt = new Date().toISOString();

    // 1. Soft delete the property record
    await adminDb.collection('properties').doc(pgId).update({
      status: 'DELETED',
      is_active: false,
      deleted_at: deletedAt,
      deleted_by: ownerId || null,
      updated_at: deletedAt
    });

    // Helper to batch soft-delete documents in a collection
    const cascadeDeleteCollection = async (collectionName: string) => {
      try {
        const snap = await adminDb.collection(collectionName).where('pg_id', '==', pgId).get();
        if (!snap.empty) {
          const docs = snap.docs;
          for (let i = 0; i < docs.length; i += 450) {
            const chunk = docs.slice(i, i + 450);
            const batch = adminDb.batch();
            chunk.forEach(doc => {
              batch.update(doc.ref, {
                status: 'DELETED',
                is_active: false,
                deleted_at: deletedAt,
                updated_at: deletedAt
              });
            });
            await batch.commit();
          }
        }
      } catch (e) {
        console.warn(`Cascade delete error on ${collectionName}:`, e);
      }
    };

    // 2. Cascade soft delete to all associated collections
    await Promise.all([
      cascadeDeleteCollection('tenants'),
      cascadeDeleteCollection('rooms'),
      cascadeDeleteCollection('expenses'),
      cascadeDeleteCollection('complaints'),
      cascadeDeleteCollection('payments'),
      cascadeDeleteCollection('notices'),
      cascadeDeleteCollection('chats'),
      cascadeDeleteCollection('food_menus')
    ]);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete hostel' };
  }
}

/**
 * Soft delete a tenant.
 */
export async function softDeleteTenant(tenantId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const deletedAt = new Date().toISOString();

    let tenantRef = adminDb.collection('tenants').doc(tenantId);
    let tenantDoc = await tenantRef.get();

    if (!tenantDoc.exists) {
      // Fallback search by tenant_id field
      const querySnap = await adminDb.collection('tenants').where('tenant_id', '==', tenantId).limit(1).get();
      if (!querySnap.empty) {
        tenantRef = querySnap.docs[0].ref;
        tenantDoc = querySnap.docs[0];
      } else {
        return { success: false, error: 'Tenant not found' };
      }
    }

    const tData = tenantDoc.data();
    const actualTenantId = tData?.tenant_id || tenantDoc.id;

    // 1. Soft-delete tenant document
    await tenantRef.update({
      status: 'DELETED',
      is_active: false,
      deleted_at: deletedAt,
      updated_at: deletedAt
    });

    // 2. Cancel all pending payments for this tenant so they don't remain as outstanding dues
    const pendingSnap1 = await adminDb.collection('payments')
      .where('tenant_id', '==', actualTenantId)
      .where('status', '==', 'pending')
      .get();

    const pendingSnap2 = await adminDb.collection('payments')
      .where('tenantId', '==', actualTenantId)
      .where('status', '==', 'pending')
      .get();

    const batch = adminDb.batch();
    const processedIds = new Set<string>();

    pendingSnap1.docs.forEach(doc => {
      processedIds.add(doc.id);
      batch.update(doc.ref, { status: 'cancelled', cancelled_reason: 'Tenant deleted', updated_at: deletedAt });
    });

    pendingSnap2.docs.forEach(doc => {
      if (!processedIds.has(doc.id)) {
        processedIds.add(doc.id);
        batch.update(doc.ref, { status: 'cancelled', cancelled_reason: 'Tenant deleted', updated_at: deletedAt });
      }
    });

    if (tenantId !== actualTenantId) {
      const pendingSnap3 = await adminDb.collection('payments')
        .where('tenant_id', '==', tenantId)
        .where('status', '==', 'pending')
        .get();
      pendingSnap3.docs.forEach(doc => {
        if (!processedIds.has(doc.id)) {
          processedIds.add(doc.id);
          batch.update(doc.ref, { status: 'cancelled', cancelled_reason: 'Tenant deleted', updated_at: deletedAt });
        }
      });
    }

    if (processedIds.size > 0) {
      await batch.commit();
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete tenant' };
  }
}

/**
 * Pre-check and restore a hostel.
 */
export async function restoreHostel(pgId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const propDoc = await adminDb.collection('properties').doc(pgId).get();
    if (!propDoc.exists) return { success: false, error: 'Property not found' };

    const pData = propDoc.data();
    const ownerId = pData?.owner_id;

    if (ownerId) {
      // Check duplicate hostel name among active hostels
      const activeHostels = await getActiveHostels(ownerId);
      const duplicateName = activeHostels.some(h => h.name?.trim().toLowerCase() === pData?.name?.trim().toLowerCase());
      if (duplicateName) {
        return { success: false, error: 'An active hostel with the same name already exists. Please resolve conflicts before restoring.' };
      }
    }

    await adminDb.collection('properties').doc(pgId).update({
      status: 'ACTIVE',
      is_active: true,
      restored_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to restore hostel' };
  }
}
