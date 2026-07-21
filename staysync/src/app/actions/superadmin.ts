"use server";

import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { revalidatePath } from 'next/cache';

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
      
      const propertiesSnapshot = await adminDb.collection('properties')
        .where('owner_id', '==', profile.id)
        .get();

      let totalTenants = 0;
      let paymentStatus = 'Paid';
      let isActive = true;

      for (const propDoc of propertiesSnapshot.docs) {
        const prop = propDoc.data();
        const pgId = prop.pg_id || propDoc.id;

        const tenantsSnapshot = await adminDb.collection('tenants')
          .where('pg_id', '==', pgId)
          .get();
        
        totalTenants += tenantsSnapshot.size;
        
        if (prop.saas_payment_status !== 'paid') paymentStatus = 'Overdue';
        if (!prop.is_active) isActive = false;
      }

      ownerData.push({
        id: profile.id,
        name: profile.full_name || 'Unknown Owner',
        hostels: propertiesSnapshot.size,
        tenants: totalTenants,
        status: isActive ? 'active' : 'disabled',
        payment: paymentStatus,
        created_at: profile.created_at || new Date().toISOString(),
      });
    }
    // Sort in memory to avoid Firestore composite index requirement
    ownerData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return { success: true, data: ownerData };
  } catch (err: any) {
    console.error(err);
    return { success: false, error: err.message, data: [] };
  }
}

export async function registerNewPGHostel(data: {
  name: string;
  mobile: string;
  location: string;
}) {
  try {
    const formattedPhone = `+91${data.mobile.replace(/\D/g, '').slice(0, 10)}`;
    let userId;

    try {
      const userRecord = await adminAuth.createUser({
        phoneNumber: formattedPhone,
        displayName: data.name,
      });
      userId = userRecord.uid;
    } catch (authError: any) {
      if (authError.code === 'auth/phone-number-already-exists') {
        const userRecord = await adminAuth.getUserByPhoneNumber(formattedPhone);
        userId = userRecord.uid;
      } else {
        throw authError;
      }
    }

    if (!userId) throw new Error("Failed to generate Auth User ID for PG Owner");

    await adminDb.collection('user_profiles').doc(userId).set({
      full_name: data.name,
      role: 'pg_owner',
      created_at: new Date().toISOString()
    }, { merge: true });

    const newPropertyRef = adminDb.collection('properties').doc();
    await newPropertyRef.set({
      pg_id: newPropertyRef.id,
      owner_id: userId,
      name: data.name,
      address: data.location,
      is_active: true,
      saas_payment_status: 'paid',
      theme_primary_color: '#3F51B5',
      created_at: new Date().toISOString()
    });

    revalidatePath('/superadmin/owners');
    return { success: true, data: [{ pg_id: newPropertyRef.id }] };
  } catch (error: any) {
    console.error("Error registering PG:", error);
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

    // Check if they are an added tenant
    const tenantQuery = await adminDb.collection('tenants').where('mobile', '==', phone).get();
    if (!tenantQuery.empty) return true;

    return false;
  } catch (err: any) {
    return false; 
  }
}
