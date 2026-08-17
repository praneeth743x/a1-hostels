"use server";

import { adminDb } from '@/lib/firebase-admin';

export async function getUserProfile(uid: string, email: string) {
  try {
    const cleanEmail = email ? email.trim().toLowerCase() : '';
    
    if (uid) {
      const ownerDoc = await adminDb.collection('user_profiles').doc(uid).get();
      if (ownerDoc.exists) return { success: true, data: ownerDoc.data() };
      
      const tenantDoc = await adminDb.collection('tenants').doc(uid).get();
      if (tenantDoc.exists) return { success: true, data: tenantDoc.data() };
    }

    if (cleanEmail) {
      const ownerQuery = await adminDb.collection('user_profiles').where('email', '==', cleanEmail).get();
      if (!ownerQuery.empty) return { success: true, data: ownerQuery.docs[0].data() };

      const teamQuery = await adminDb.collection('team_members').where('email', '==', cleanEmail).get();
      if (!teamQuery.empty) return { success: true, data: teamQuery.docs[0].data() };

      const tenantQuery = await adminDb.collection('tenants').where('email', '==', cleanEmail).get();
      if (!tenantQuery.empty) return { success: true, data: tenantQuery.docs[0].data() };
    }

    return { success: false, error: 'User profile not found' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateUserProfile(uid: string, editForm: any) {
  try {
    if (!uid) return { success: false, error: 'No UID provided' };
    
    const ownerDoc = await adminDb.collection('user_profiles').doc(uid).get();
    if (ownerDoc.exists) {
      await adminDb.collection('user_profiles').doc(uid).update(editForm);
      return { success: true };
    }
    
    const tenantDoc = await adminDb.collection('tenants').doc(uid).get();
    if (tenantDoc.exists) {
      await adminDb.collection('tenants').doc(uid).update(editForm);
      return { success: true };
    }
    
    return { success: false, error: 'User document not found for update' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function registerDevice(uid: string, deviceId: string, deviceName: string) {
  try {
    if (!uid || !deviceId) return { success: false, error: 'Missing parameters' };
    await adminDb.collection('users').doc(uid).collection('devices').doc(deviceId).set({
      deviceName,
      deviceId,
      lastActive: new Date().toISOString()
    }, { merge: true });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getUserDevices(uid: string) {
  try {
    if (!uid) return { success: false, error: 'No UID provided' };
    const devicesSnap = await adminDb.collection('users').doc(uid).collection('devices').get();
    const devices = devicesSnap.docs.map(doc => ({ deviceId: doc.id, ...doc.data() }));
    return { success: true, data: devices };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function removeDevice(uid: string, deviceId: string) {
  try {
    if (!uid || !deviceId) return { success: false, error: 'Missing parameters' };
    await adminDb.collection('users').doc(uid).collection('devices').doc(deviceId).delete();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
