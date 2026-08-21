"use server";

import { adminDb, adminAuth } from '@/lib/firebase-admin';

/**
 * Ensures a team member has a valid Firebase Auth user and user_profiles doc.
 */
export async function autoProvisionTeamMember(cleanEmail: string, targetUid?: string) {
  try {
    const teamSnap = await adminDb.collection('team_members').get();
    let memberDoc: any = null;
    let memberData: any = null;

    for (const doc of teamSnap.docs) {
      const data = doc.data();
      const staffEmail = (data.email || '').trim().toLowerCase();

      if (staffEmail === cleanEmail) {
        memberDoc = doc;
        memberData = data;
        break;
      }
    }

    if (!memberDoc) return null;

    let authUid = targetUid;
    if (!authUid) {
      try {
        const existingUser = await adminAuth.getUserByEmail(cleanEmail);
        authUid = existingUser.uid;
      } catch (authError: any) {
        const initialPassword = memberData.phone ? `A1@${memberData.phone.replace(/\D/g, '').slice(-6)}` : 'A1Hostels@123';
        const newUser = await adminAuth.createUser({
          email: cleanEmail,
          password: initialPassword,
          displayName: memberData.full_name || 'Team Member',
        });
        authUid = newUser.uid;
        await memberDoc.ref.update({ auth_uid: authUid, initial_password: initialPassword });
      }
    }

    if (authUid) {
      await adminDb.collection('user_profiles').doc(authUid).set({
        email: cleanEmail,
        full_name: memberData.full_name,
        role: 'team_member',
        staff_role: memberData.role,
        owner_id: memberData.owner_id,
        permissions: memberData.permissions,
        assigned_properties: memberData.assigned_properties || [],
        status: memberData.status || 'Active',
        accountInitialized: true,
        updated_at: new Date().toISOString()
      }, { merge: true });
    }

    return { uid: authUid, member: memberData };
  } catch (err) {
    console.error("Auto-provision team member error:", err);
    return null;
  }
}

/**
 * Validates if an email exists in superadmin, pg_owner, team_members, or tenants collection.
 */
export async function checkUserByEmail(email: string) {
  try {
    const cleanEmail = email.trim().toLowerCase();
    // 1. Check Superadmin
    if (cleanEmail === '25r21a05e2@mlrit.ac.in' || cleanEmail === 'admin@raliving.com') return true;

    // 2. Check PG Owners (user_profiles where role === 'pg_owner')
    const ownerQuery = await adminDb.collection('user_profiles')
      .where('email', '==', cleanEmail)
      .get();
      
    if (!ownerQuery.empty) return true;

    // 3. Check Team Members by exact email
    const teamQuery = await adminDb.collection('team_members')
      .where('email', '==', cleanEmail)
      .get();
    if (!teamQuery.empty) return true;

    // 4. Check Tenants (tenants where email === email)
    const tenantQuery = await adminDb.collection('tenants')
      .where('email', '==', cleanEmail)
      .get();

    if (!tenantQuery.empty) return true;

    return false;
  } catch (error) {
    console.error("Error in checkUserByEmail:", error);
    return false;
  }
}

/**
 * Looks up a tenant or staff email address by their phone number.
 */
export async function getTenantEmailByPhone(phone: string) {
  try {
    const rawPhone = phone.replace(/\D/g, '');
    
    // 1. Check PG owners first
    const ownerQuery = await adminDb.collection('user_profiles')
      .get();
      
    for (const doc of ownerQuery.docs) {
      const data = doc.data();
      const ownerPhone = (data.phone || data.mobile || '').replace(/\D/g, '');
      if (ownerPhone === rawPhone && data.email) {
        return { success: true, email: data.email };
      }
    }

    // 2. Check Team Members
    const teamQuery = await adminDb.collection('team_members')
      .get();

    for (const doc of teamQuery.docs) {
      const data = doc.data();
      const staffPhone = (data.phone || '').replace(/\D/g, '');
      if (staffPhone === rawPhone && data.email) {
        await autoProvisionTeamMember(data.email.toLowerCase());
        return { success: true, email: data.email };
      }
    }

    // 3. Check tenants collection
    const tenantQuery = await adminDb.collection('tenants')
      .where('mobile', '==', rawPhone)
      .get();

    if (!tenantQuery.empty) {
      const tenantData = tenantQuery.docs[0].data();
      if (tenantData.email) {
        return { success: true, email: tenantData.email };
      } else {
        return { success: false, error: "Phone number found, but no email is associated with this account." };
      }
    }

    return { success: false, error: "No account found with this mobile number." };
  } catch (error: any) {
    console.error("Error in getTenantEmailByPhone:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Checks if the account has been initialized (i.e. has set a password).
 */
export async function checkAccountInitialized(email: string) {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const ownerQuery = await adminDb.collection('user_profiles').where('email', '==', cleanEmail).get();
    if (!ownerQuery.empty) {
      return ownerQuery.docs[0].data().accountInitialized ?? true;
    }
    const teamQuery = await adminDb.collection('team_members').get();
    for (const doc of teamQuery.docs) {
      const staffEmail = (doc.data().email || '').trim().toLowerCase();
      if (staffEmail === cleanEmail) return true;
    }
    const tenantQuery = await adminDb.collection('tenants').where('email', '==', cleanEmail).get();
    if (!tenantQuery.empty) {
      return tenantQuery.docs[0].data().accountInitialized ?? true; 
    }
    return true;
  } catch(e) {
    return true;
  }
}

/**
 * Marks the account as initialized.
 */
export async function markAccountInitialized(email: string) {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const ownerQuery = await adminDb.collection('user_profiles').where('email', '==', cleanEmail).get();
    if (!ownerQuery.empty) {
      await ownerQuery.docs[0].ref.update({ accountInitialized: true });
      return { success: true };
    }
    const tenantQuery = await adminDb.collection('tenants').where('email', '==', cleanEmail).get();
    if (!tenantQuery.empty) {
      await tenantQuery.docs[0].ref.update({ accountInitialized: true });
      return { success: true };
    }
    return { success: false, error: 'User not found' };
  } catch (error: any) {
    console.error("Error marking account initialized:", error);
    return { success: false, error: error.message };
  }
}



/**
 * Centrally resolves a user's role.
 */
export async function getResolvedRole(uid: string, email: string): Promise<string | null> {
  try {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (cleanEmail === '25r21a05e2@mlrit.ac.in' || cleanEmail === 'admin@raliving.com') return 'super_admin';

    // 1. Check team_members collection by exact email first
    if (cleanEmail) {
      const teamQuery = await adminDb.collection('team_members').where('email', '==', cleanEmail).get();
      if (!teamQuery.empty) {
        if (uid) await autoProvisionTeamMember(cleanEmail, uid);
        return 'team_member';
      }
    }

    // 2. Check user_profiles by UID (PG Owner)
    if (uid) {
      const ownerUidDoc = await adminDb.collection('user_profiles').doc(uid).get();
      if (ownerUidDoc.exists) {
        const data = ownerUidDoc.data();
        if (data?.role === 'super_admin') return 'super_admin';
        if (data?.role === 'team_member') return 'team_member';
        if (data?.role === 'tenant') return 'tenant';
        return data?.role || 'pg_owner';
      }
    }

    // 3. Check user_profiles by email (PG Owner)
    if (cleanEmail) {
      const ownerEmailQuery = await adminDb.collection('user_profiles').where('email', '==', cleanEmail).get();
      if (!ownerEmailQuery.empty) {
        const data = ownerEmailQuery.docs[0].data();
        if (data?.role === 'super_admin') return 'super_admin';
        if (data?.role === 'team_member') return 'team_member';
        if (data?.role === 'tenant') return 'tenant';
        return data?.role || 'pg_owner';
      }
    }

    // 4. Check Tenants by email
    if (cleanEmail) {
      const tenantEmailQuery = await adminDb.collection('tenants').where('email', '==', cleanEmail).get();
      if (!tenantEmailQuery.empty) {
        return 'tenant';
      }
    }

    // 5. Check Tenants by UID
    if (uid) {
      const tenantUidDoc = await adminDb.collection('tenants').doc(uid).get();
      if (tenantUidDoc.exists) {
        return 'tenant';
      }
    }

    return null;
  } catch (error) {
    console.error("Error resolving role:", error);
    return null;
  }
}

/**
 * Combined fast-path for login metadata (exists, isInitialized, role) in 1 parallelized RPC roundtrip.
 */
export async function getLoginAuthMeta(uid: string, email: string) {
  try {
    const cleanEmail = (email || '').trim().toLowerCase();
    
    // Superadmin fast path
    if (cleanEmail === '25r21a05e2@mlrit.ac.in' || cleanEmail === 'admin@raliving.com') {
      return { success: true, exists: true, isInitialized: true, role: 'super_admin' };
    }

    // Parallel checks across Collections
    const [teamSnap, ownerDoc, ownerEmailSnap, tenantEmailSnap, tenantUidDoc] = await Promise.all([
      cleanEmail ? adminDb.collection('team_members').where('email', '==', cleanEmail).get() : Promise.resolve({ empty: true, docs: [] }),
      uid ? adminDb.collection('user_profiles').doc(uid).get() : Promise.resolve(null),
      cleanEmail ? adminDb.collection('user_profiles').where('email', '==', cleanEmail).get() : Promise.resolve({ empty: true, docs: [] }),
      cleanEmail ? adminDb.collection('tenants').where('email', '==', cleanEmail).get() : Promise.resolve({ empty: true, docs: [] }),
      uid ? adminDb.collection('tenants').doc(uid).get() : Promise.resolve(null),
    ]);

    // 1. Team Member check
    if (!teamSnap.empty) {
      const tData = (teamSnap as any).docs[0].data();
      if (tData.status === 'Suspended' || tData.status === 'disabled' || tData.status === 'INACTIVE' || tData.is_active === false) {
        return { success: false, exists: false, isSuspended: true, role: 'team_member', error: 'Invalid credentials.' };
      }
      if (uid) autoProvisionTeamMember(cleanEmail, uid).catch(console.error);
      return { success: true, exists: true, isInitialized: true, role: 'team_member' };
    }

    // 2. PG Owner check (by UID)
    if (ownerDoc?.exists) {
      const data = ownerDoc.data();
      if (data?.status === 'Suspended' || data?.status === 'disabled' || data?.status === 'INACTIVE' || data?.is_active === false) {
        return { success: false, exists: false, isSuspended: true, role: 'pg_owner', error: 'Invalid credentials.' };
      }
      const role = data?.role === 'super_admin' ? 'super_admin' : data?.role === 'team_member' ? 'team_member' : data?.role === 'tenant' ? 'tenant' : (data?.role || 'pg_owner');
      return { success: true, exists: true, isInitialized: data?.accountInitialized ?? true, role };
    }

    // 3. PG Owner check (by email)
    if (!ownerEmailSnap.empty) {
      const data = (ownerEmailSnap as any).docs[0].data();
      if (data?.status === 'Suspended' || data?.status === 'disabled' || data?.status === 'INACTIVE' || data?.is_active === false) {
        return { success: false, exists: false, isSuspended: true, role: 'pg_owner', error: 'Invalid credentials.' };
      }
      const role = data?.role === 'super_admin' ? 'super_admin' : data?.role === 'team_member' ? 'team_member' : data?.role === 'tenant' ? 'tenant' : (data?.role || 'pg_owner');
      return { success: true, exists: true, isInitialized: data?.accountInitialized ?? true, role };
    }

    // 4. Tenant check (by email)
    if (!tenantEmailSnap.empty) {
      const data = (tenantEmailSnap as any).docs[0].data();
      if (data?.status === 'Suspended' || data?.status === 'disabled' || data?.status === 'INACTIVE' || data?.is_active === false) {
        return { success: false, exists: false, isSuspended: true, role: 'tenant', error: 'Invalid credentials.' };
      }
      return { success: true, exists: true, isInitialized: data?.accountInitialized ?? true, role: 'tenant' };
    }

    // 5. Tenant check (by UID)
    if (tenantUidDoc?.exists) {
      const data = tenantUidDoc.data();
      if (data?.status === 'Suspended' || data?.status === 'disabled' || data?.status === 'INACTIVE' || data?.is_active === false) {
        return { success: false, exists: false, isSuspended: true, role: 'tenant', error: 'Invalid credentials.' };
      }
      return { success: true, exists: true, isInitialized: data?.accountInitialized ?? true, role: 'tenant' };
    }

    return { success: true, exists: false, isInitialized: false, role: null };
  } catch (error: any) {
    console.error("Error in getLoginAuthMeta:", error);
    return { success: false, exists: false, isInitialized: false, role: null, error: error.message };
  }
}
