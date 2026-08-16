"use server";

import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
import { isHostelActive, isTenantActiveForBusiness } from '@/lib/repository';

export async function getUserRole(userId: string) {
  try {
    const doc = await adminDb.collection('user_profiles').doc(userId).get();
    return doc.exists ? (doc.data()?.role || 'tenant') : 'tenant';
  } catch (err) {
    return 'tenant';
  }
}

export async function getOwners() {
  try {
    const snapshot = await adminDb.collection('user_profiles')
      .where('role', '==', 'pg_owner')
      .get();

    const ownerData = [];
    for (const doc of snapshot.docs) {
      const profile: any = { id: doc.id, ...doc.data() };
      
      // Attempt to get email/phone from Auth if missing
      let authUser: any = null;
      try {
        authUser = await adminAuth.getUser(profile.id);
      } catch (e) {}

      const propertiesSnapshot = await adminDb.collection('properties')
        .where('owner_id', '==', profile.id)
        .get();

      const rawProps: any[] = propertiesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const activeProps = rawProps.filter(p => isHostelActive(p));

      let totalTenants = 0;
      let paymentStatus = 'PAID';
      let isActive = true;
      const hostelList: any[] = [];

      for (const prop of activeProps) {
        const pgId = prop.pg_id || prop.id;

        const tenantsSnapshot = await adminDb.collection('tenants')
          .where('pg_id', '==', pgId)
          .get();
        
        const activeTenantsInProp = tenantsSnapshot.docs
          .map(d => d.data())
          .filter(t => isTenantActiveForBusiness(t));

        totalTenants += activeTenantsInProp.length;
        
        if (prop.saas_payment_status !== 'paid') paymentStatus = 'PENDING';
        if (!prop.is_active) isActive = false;

        hostelList.push({
          id: pgId,
          name: prop.name || 'Unnamed Hostel',
          address: prop.address || 'Address not specified',
          tenantCount: activeTenantsInProp.length,
          is_active: prop.is_active ?? true,
        });
      }

      const isOwnerProfileActive = profile.is_active !== false && profile.status !== 'disabled';

      ownerData.push({
        id: profile.id,
        name: profile.full_name || authUser?.displayName || 'Unknown Owner',
        email: profile.email || authUser?.email || '',
        phone: profile.phone || profile.mobile || authUser?.phoneNumber || '',
        password: profile.password || profile.plain_password || '',
        hostels: activeProps.length,
        tenants: totalTenants,
        status: isOwnerProfileActive && isActive ? 'active' : 'disabled',
        payment: paymentStatus,
        hostelList,
        created_at: profile.created_at || new Date().toISOString(),
      });
    }

    ownerData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return { success: true, data: ownerData };
  } catch (err: any) {
    console.error(err);
    return { success: false, error: err.message, data: [] };
  }
}

export async function togglePGOwnerCascadeStatus(ownerId: string, activate: boolean) {
  try {
    const isNowActive = activate;
    const ownerStatusStr = isNowActive ? 'active' : 'disabled';
    const tenantStatusStr = isNowActive ? 'ACTIVE' : 'INACTIVE';

    // 1. Update PG Owner profile in 'user_profiles'
    await adminDb.collection('user_profiles').doc(ownerId).set({
      is_active: isNowActive,
      status: ownerStatusStr,
      updated_at: new Date().toISOString()
    }, { merge: true });

    // 2. Enable/Disable PG Owner in Firebase Auth & Revoke Tokens & Devices
    try {
      await adminAuth.updateUser(ownerId, {
        disabled: !isNowActive
      });
      if (!isNowActive) {
        await adminAuth.revokeRefreshTokens(ownerId).catch(() => {});
        // Delete device session docs for instant client logout via device listener
        const devSnap = await adminDb.collection('users').doc(ownerId).collection('devices').get().catch(() => null);
        if (devSnap) {
          for (const dDoc of devSnap.docs) {
            await dDoc.ref.delete().catch(() => {});
          }
        }
      }
    } catch (authErr) {
      console.warn("Firebase Auth update warning for owner:", authErr);
    }

    // 3. Update all properties belonging to this PG Owner
    const propsSnapshot = await adminDb.collection('properties')
      .where('owner_id', '==', ownerId)
      .get();

    const pgIds: string[] = [];
    for (const doc of propsSnapshot.docs) {
      const pData = doc.data();
      const pgId = pData.pg_id || doc.id;
      pgIds.push(pgId);
      if (pgId !== doc.id) pgIds.push(doc.id);

      await adminDb.collection('properties').doc(doc.id).set({
        is_active: isNowActive,
        status: isNowActive ? 'ACTIVE' : 'INACTIVE',
        updated_at: new Date().toISOString()
      }, { merge: true });
    }

    // 4. Update all Team Members under this PG Owner in 'user_profiles'
    const teamSnapshot = await adminDb.collection('user_profiles')
      .where('owner_id', '==', ownerId)
      .get();

    for (const teamDoc of teamSnapshot.docs) {
      if (teamDoc.id === ownerId) continue;
      await adminDb.collection('user_profiles').doc(teamDoc.id).set({
        is_active: isNowActive,
        status: ownerStatusStr,
        updated_at: new Date().toISOString()
      }, { merge: true });

      try {
        await adminAuth.updateUser(teamDoc.id, {
          disabled: !isNowActive
        });
        if (!isNowActive) {
          await adminAuth.revokeRefreshTokens(teamDoc.id).catch(() => {});
          const tDevSnap = await adminDb.collection('users').doc(teamDoc.id).collection('devices').get().catch(() => null);
          if (tDevSnap) {
            for (const dDoc of tDevSnap.docs) {
              await dDoc.ref.delete().catch(() => {});
            }
          }
        }
      } catch (e) {}
    }

    // 5. Update all Tenants under this PG Owner's hostels
    let tenantCount = 0;
    const processTenantDoc = async (tDoc: any) => {
      const tData = tDoc.data();
      if (tData.status !== 'DELETED' && tData.status !== 'VACATED') {
        await adminDb.collection('tenants').doc(tDoc.id).set({
          is_active: isNowActive,
          status: tenantStatusStr,
          updated_at: new Date().toISOString()
        }, { merge: true });
        tenantCount++;

        // Revoke Auth user if tenant has auth account by UID or email
        const tenantUids = [tDoc.id, tData.auth_uid, tData.tenant_id].filter(Boolean);
        for (const tuid of tenantUids) {
          try {
            await adminAuth.updateUser(tuid, { disabled: !isNowActive }).catch(() => {});
            if (!isNowActive) {
              await adminAuth.revokeRefreshTokens(tuid).catch(() => {});
              const tDevSnap = await adminDb.collection('users').doc(tuid).collection('devices').get().catch(() => null);
              if (tDevSnap) {
                for (const dDoc of tDevSnap.docs) {
                  await dDoc.ref.delete().catch(() => {});
                }
              }
            }
          } catch (e) {}
        }

        if (tData.email && !isNowActive) {
          try {
            const uRec = await adminAuth.getUserByEmail(tData.email);
            if (uRec) {
              await adminAuth.updateUser(uRec.uid, { disabled: true }).catch(() => {});
              await adminAuth.revokeRefreshTokens(uRec.uid).catch(() => {});
              const tDevSnap = await adminDb.collection('users').doc(uRec.uid).collection('devices').get().catch(() => null);
              if (tDevSnap) {
                for (const dDoc of tDevSnap.docs) {
                  await dDoc.ref.delete().catch(() => {});
                }
              }
            }
          } catch (e) {}
        }
      }
    };

    const tenantsByOwnerSnap = await adminDb.collection('tenants')
      .where('owner_id', '==', ownerId)
      .get();

    for (const tDoc of tenantsByOwnerSnap.docs) {
      await processTenantDoc(tDoc);
    }

    for (const pId of pgIds) {
      const tenantsByPgSnap = await adminDb.collection('tenants')
        .where('pg_id', '==', pId)
        .get();

      for (const tDoc of tenantsByPgSnap.docs) {
        await processTenantDoc(tDoc);
      }
    }

    revalidatePath('/superadmin/owners');
    return { success: true, count: { properties: propsSnapshot.size, tenants: tenantCount } };
  } catch (err: any) {
    console.error("Cascade toggle owner status failed:", err);
    return { success: false, error: err.message };
  }
}

export async function updatePGOwner(ownerId: string, data: {
  name: string;
  email: string;
  phone: string;
  password?: string;
}) {
  try {
    const profileUpdate: any = {
      full_name: data.name,
      email: data.email,
      phone: data.phone,
      updated_at: new Date().toISOString()
    };

    if (data.password && data.password.trim() !== '') {
      profileUpdate.password = data.password.trim();
      profileUpdate.plain_password = data.password.trim();
    }

    await adminDb.collection('user_profiles').doc(ownerId).set(profileUpdate, { merge: true });

    try {
      const authUpdate: any = {
        displayName: data.name,
        email: data.email,
      };
      if (data.password && data.password.trim() !== '') {
        authUpdate.password = data.password.trim();
      }
      await adminAuth.updateUser(ownerId, authUpdate);
    } catch (e) {
      console.warn("Auth update warning:", e);
    }

    revalidatePath('/superadmin/owners');
    return { success: true };
  } catch (err: any) {
    console.error("Failed to update PG Owner:", err);
    return { success: false, error: err.message };
  }
}

export async function registerNewPGOwner(data: {
  name: string;
  email: string;
  mobile: string;
}) {
  try {
    const formattedPhone = `+91${data.mobile.replace(/\D/g, '').slice(0, 10)}`;
    let userId;

    try {
      const userRecord = await adminAuth.createUser({
        email: data.email,
        displayName: data.name,
      });
      userId = userRecord.uid;
    } catch (authError: any) {
      if (authError.code === 'auth/email-already-exists') {
        const userRecord = await adminAuth.getUserByEmail(data.email);
        userId = userRecord.uid;
      } else {
        throw authError;
      }
    }

    if (!userId) throw new Error("Failed to generate Auth User ID for PG Owner");

    await adminDb.collection('user_profiles').doc(userId).set({
      full_name: data.name,
      email: data.email,
      phone: data.mobile,
      role: 'pg_owner',
      accountInitialized: false,
      created_at: new Date().toISOString()
    }, { merge: true });

    revalidatePath('/superadmin/owners');
    return { success: true, userId };
  } catch (error: any) {
    console.error("Error registering PG Owner:", error);
    return { success: false, error: error.message };
  }
}

export async function checkUserExists(phone: string) {
  try {
    if (phone === '9999999999' || phone === '9398699430') return true;
    
    // Check if they are a registered PG Owner
    const ownerQuery = await adminDb.collection('user_profiles').where('role', '==', 'pg_owner').get();
    let isOwner = false;
    for (const doc of ownerQuery.docs) {
      const authUser = await adminAuth.getUser(doc.id).catch(() => null);
      if (authUser && authUser.phoneNumber === `+91${phone}`) {
        isOwner = true;
        break;
      }
    }
    if (isOwner) return true;

    // Check if they are an active tenant
    const tenantQuery = await adminDb.collection('tenants').where('mobile', '==', phone).get();
    if (!tenantQuery.empty) {
      return tenantQuery.docs.some(doc => isTenantActiveForBusiness(doc.data()));
    }

    return false;
  } catch (err: any) {
    return false; 
  }
}

const getCachedLandingSettings = unstable_cache(
  async () => {
    const doc = await adminDb.collection('system_settings').doc('landing').get();
    if (doc.exists) {
      return { success: true, data: doc.data() };
    }
    return {
      success: true,
      data: {
        logoUrl: '/himalaya_logo.png',
        siteName: 'Himalaya Hostels',
        selectedTransition: 'gradient_depixelate',
        slideDurationSeconds: 1,
        slides: [
          {
            id: '1',
            imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB1ybc4RDJcJCi0vesS4Kdhno7cvHG0nV0SrX9qYRRAuNE74f3AT9fvhQZSh6QXDC0MTiIjZfRyKlpYhZYt3nwU-m4ryDwg9eKqZfmuw8pDCIdLe0qvQnHSFWF_cQMaYigYn9TFDVs1fDCRbIqTnsPlQtDgbeuyyP5PQI5oNXy3bLkwMzLqMMLzwWcqn5GmEWcloVC5iheKI9ghf6sKn6QYheYdxLVQyrvIIHSDSfDzjTF7tulkyPnH',
            title: 'Himalayan Luxury Suites',
            subtitle: 'Panoramic Alpine Views & Glacial Quiet'
          },
          {
            id: '2',
            imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBgozEEjIruvwkrAL77UDylnJyQHalhexX_4Nz2_zJZpWTvLlHxduGsxIaeUEpZyGQIAyyi4EWeQYNXd96svCysC12Dict_aRVVdu6Wci-Se2oTXhbPta4BfwgZFJ_-yh4iKANFXdtRqVcvCH1lUnvjAiWzV6vXOLwIq9jNU78jNRKOsp0J-CJG0H0SZj1LkKeqrNgM2qf5S6GAcERwG5yyIqlTx0RAptOdWypYT2FM-9AnsQWa2Sks',
            title: 'Hydrotherapy Sanctuary',
            subtitle: 'Marble Soaking Tubs & Thermal Springs'
          },
          {
            id: '3',
            imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAmcfMeigKgGLlkNwazD88lXYhThlEFANadWLtzM9aaNQWiowE44XXrIhaLqx19W_fUV_TnwKpRhVnqoQRaMrkPw5m6zsJKnj4TLrENzh4ie8tPRNVbiYU-vgOo36eAswwDtNMl46RePLd7a9il8qDQmgaCCQM-NqCFYHrKqHuWZ7Z4qcBlFT4WsXyJCNDICfQXkYW0ePQLSpDEocE54ACUbgi2EHMOoEe3c6wCjX4rg8nrAsM7nAnsQWa2Sks',
            title: 'Glass Disconnection Dome',
            subtitle: 'Cliffside Stargazing & Pure Oxygen Lounges'
          }
        ]
      }
    };
  },
  ['landing-settings'],
  { tags: ['landing-settings'], revalidate: 300 }
);

export async function getLandingSettings() {
  try {
    return await getCachedLandingSettings();
  } catch (err: any) {
    console.error("Error fetching landing settings:", err);
    return { success: false, error: err.message };
  }
}

import fs from 'fs';
import path from 'path';

export async function updateLandingSettings(data: {
  logoUrl?: string;
  siteName?: string;
  selectedTransition?: string;
  slideDurationSeconds?: number;
  slides?: any[];
  headerOutlineColor?: string;
  headerOutlineThickness?: number;
}) {
  try {
    const payload = {
      ...data,
      updated_at: new Date().toISOString()
    };

    const payloadJson = JSON.stringify(payload);
    const sizeInBytes = Buffer.byteLength(payloadJson, 'utf8');

    // Firestore 1MB limit check (1048576 bytes)
    if (sizeInBytes > 950000) {
      console.warn(`[LandingSettings] Document size too large: ${(sizeInBytes / 1024).toFixed(1)} KB`);
      return { 
        success: false, 
        error: `Payload size (${(sizeInBytes / 1024).toFixed(0)} KB) exceeds Firestore 1MB limit. Please upload a smaller image file.` 
      };
    }

    // Overwrite static public image files so all static fallbacks & favicons update on disk
    if (data.logoUrl && data.logoUrl.startsWith('data:image/')) {
      try {
        const base64Data = data.logoUrl.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const publicDir = path.join(process.cwd(), 'public');
        fs.writeFileSync(path.join(publicDir, 'himalaya_logo.png'), buffer);
        fs.writeFileSync(path.join(publicDir, 'himalaya_logo_premium.png'), buffer);
      } catch (fsErr) {
        console.warn("[LandingSettings] Warning writing logo to disk:", fsErr);
      }
    }

    // Update public/manifest.json with new website name
    if (data.siteName) {
      try {
        const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
        if (fs.existsSync(manifestPath)) {
          const manifestObj = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          manifestObj.name = data.siteName;
          manifestObj.short_name = data.siteName;
          manifestObj.description = `${data.siteName} | Premium PG Hostels`;
          fs.writeFileSync(manifestPath, JSON.stringify(manifestObj, null, 2));
        }
      } catch (mErr) {
        console.warn("[LandingSettings] Failed updating manifest.json:", mErr);
      }
    }

    await adminDb.collection('system_settings').doc('landing').set(payload, { merge: true });

    try {
      (revalidateTag as any)('landing-settings');
    } catch (e) {}
    revalidatePath('/');
    revalidatePath('/explore');
    revalidatePath('/superadmin/owners');
    return { success: true };
  } catch (err: any) {
    console.error("Error updating landing settings:", err);
    return { success: false, error: err?.message || 'Failed to save landing settings.' };
  }
}

const getCachedPublicHostels = unstable_cache(
  async () => {
    const snapshot = await adminDb.collection('properties').get();

    const hostels = snapshot.docs
      .map(doc => {
        const d = doc.data();
        if (d.is_active === false || d.status === 'INACTIVE' || d.status === 'DELETED') {
          return null;
        }
        const rawAddress = d.address || '';
        const addressParts = rawAddress.split(' | Maps: ');
        return {
          id: doc.id,
          name: d.name || 'Unnamed Hostel',
          address: addressParts[0] || '',
          locationLink: addressParts[1] || '',
          description: d.description || '',
          imageUrl: d.imageUrl || d.image_url || '',
          images: d.images || [],
          amenities: d.amenities || [],
          facilities: d.facilities || [],
          gender: d.gender || d.type || '',
          totalRooms: d.totalRooms || d.total_rooms || 0,
          pgId: d.pg_id || doc.id,
          lat: d.lat ?? null,
          lng: d.lng ?? null,
          phone: d.phone || '',
        };
      })
      .filter(Boolean);

    return { success: true, data: hostels };
  },
  ['public-hostels'],
  { tags: ['public-hostels'], revalidate: 300 }
);

export async function getPublicHostels() {
  try {
    return await getCachedPublicHostels();
  } catch (err: any) {
    console.error("Error fetching public hostels:", err);
    return { success: false, error: err.message, data: [] };
  }
}

export async function getPublicHostelById(pgId: string) {
  try {
    let doc = await adminDb.collection('properties').doc(pgId).get();
    if (!doc.exists) {
      const qSnap = await adminDb.collection('properties').where('pg_id', '==', pgId).get();
      if (!qSnap.empty) {
        doc = qSnap.docs[0];
      }
    }

    if (!doc.exists) {
      return { success: false, error: 'Hostel not found' };
    }
    const d = doc.data() as any;
    if (d.is_active === false || d.status === 'INACTIVE' || d.status === 'DELETED') {
      return { success: false, error: 'Hostel is inactive' };
    }

    const rawAddress = d.address || '';
    const addressParts = rawAddress.split(' | Maps: ');

    let pricing: Record<number, string> = { 1: "12000", 2: "9500", 3: "8000", 4: "7000" };
    if (d.theme_primary_color) {
      try {
        pricing = JSON.parse(d.theme_primary_color);
      } catch (e) {}
    }

    return {
      success: true,
      data: {
        id: doc.id,
        name: d.name || 'Unnamed Hostel',
        address: addressParts[0] || '',
        locationLink: addressParts[1] || '',
        description: d.description || '',
        imageUrl: d.imageUrl || d.image_url || '',
        images: d.images || [],
        amenities: d.amenities || [],
        facilities: d.facilities || [],
        gender: d.gender || d.type || '',
        totalRooms: d.totalRooms || d.total_rooms || 0,
        pgId: d.pg_id || doc.id,
        lat: d.lat ?? null,
        lng: d.lng ?? null,
        phone: d.phone || '',
        pricing
      }
    };
  } catch (err: any) {
    console.error("Error fetching public hostel by id:", err);
    return { success: false, error: err.message };
  }
}

export async function getWhatsAppReminderSettings() {
  try {
    const doc = await adminDb.collection('system_settings').doc('whatsapp_reminders').get();
    if (doc.exists) {
      return { success: true, data: doc.data() };
    }
    return {
      success: true,
      data: {
        dueDayReminder: true,
        overdueFirstReminderDays: 1,
        overdueReminderFrequencyDays: 3,
        tenantPaymentsEnabled: true
      }
    };
  } catch (err: any) {
    console.error("Error fetching whatsapp reminder settings:", err);
    return { success: false, error: err.message };
  }
}

export async function updateWhatsAppReminderSettings(data: {
  dueDayReminder?: boolean;
  overdueFirstReminderDays?: number;
  overdueReminderFrequencyDays?: number;
  tenantPaymentsEnabled?: boolean;
}) {
  try {
    await adminDb.collection('system_settings').doc('whatsapp_reminders').set({
      ...data,
      updated_at: new Date().toISOString()
    }, { merge: true });

    return { success: true };
  } catch (err: any) {
    console.error("Error updating whatsapp reminder settings:", err);
    return { success: false, error: err.message };
  }
}
