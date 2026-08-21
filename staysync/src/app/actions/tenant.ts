"use server";

import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { sendDeletionConfirmationEmail, sendPasswordResetHTMLMail } from '@/lib/email';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';

export async function getTenantDashboardData(email: string) {
  try {
    // 1. Fetch Tenant
    const tenantQuery = await adminDb.collection('tenants').where('email', '==', email).get();
    if (tenantQuery.empty) {
      return { success: false, error: 'Tenant not found.' };
    }
    const tenantData = { id: tenantQuery.docs[0].id, ...tenantQuery.docs[0].data() } as any;

    if (tenantData.is_active === false || tenantData.status === 'INACTIVE') {
      return { success: false, error: 'ACCOUNT_DISABLED', message: 'Your tenant account or hostel access has been suspended by the administrator.' };
    }

    // 2. Fetch Properties, Roommates, Room Capacity, Payments, Notices concurrently via Promise.all
    const tenantId = tenantData.tenant_id || tenantData.id;
    const [pgSnap, roommatesQuery, roomSnap, duesQuery, noticesQuery, systemSettingsSnap, activityLogsSnap] = await Promise.all([
      tenantData.pg_id ? adminDb.collection('properties').doc(tenantData.pg_id).get() : Promise.resolve(null),
      tenantData.room_id && tenantData.pg_id
        ? adminDb.collection('tenants').where('room_id', '==', tenantData.room_id).where('pg_id', '==', tenantData.pg_id).get()
        : Promise.resolve({ docs: [] }),
      tenantData.room_id ? adminDb.collection('rooms').doc(tenantData.room_id).get() : Promise.resolve(null),
      tenantId ? adminDb.collection('payments').where('tenant_id', '==', tenantId).get() : Promise.resolve({ docs: [] }),
      tenantData.pg_id ? adminDb.collection('notices').where('pg_id', '==', tenantData.pg_id).get() : Promise.resolve({ docs: [] }),
      adminDb.collection('system_settings').doc('whatsapp_reminders').get(),
      tenantId ? adminDb.collection('tenant_activity_logs').where('tenant_id', '==', tenantId).limit(20).get() : Promise.resolve({ docs: [] })
    ]);

    if (pgSnap?.exists) {
      const pgData = pgSnap.data();
      if (pgData?.is_active === false || pgData?.status === 'INACTIVE') {
        return { success: false, error: 'ACCOUNT_DISABLED', message: 'Your hostel subscription has been suspended by the administrator.' };
      }
      if (pgData?.owner_id) {
        const ownerDoc = await adminDb.collection('user_profiles').doc(pgData.owner_id).get();
        if (ownerDoc.exists) {
          const oData = ownerDoc.data();
          if (oData?.is_active === false || oData?.status === 'disabled') {
            return { success: false, error: 'ACCOUNT_DISABLED', message: 'The PG Owner account for this hostel has been suspended by the administrator.' };
          }
        }
      }
      tenantData.pg_name = pgData?.name || 'Unknown Hostel';
    }

    const roommates = roommatesQuery.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as any))
      .filter(t => t.id !== tenantData.id && t.status === 'ACTIVE');

    let availableBeds = 0;
    if (roomSnap?.exists) {
      const roomCapacity = roomSnap.data()?.capacity || 0;
      const currentOccupants = roommatesQuery.docs.filter(d => d.data().status === 'ACTIVE').length;
      availableBeds = Math.max(0, roomCapacity - currentOccupants);
      tenantData.room = { id: roomSnap.id, ...roomSnap.data() };
    }

    const allPayments = duesQuery.docs.map(doc => ({ id: doc.id, payment_id: doc.id, ...doc.data() } as any));
    allPayments.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const pendingDues = allPayments.filter(p => p.status === 'pending' || p.status === 'overdue');

    const allocatedChargeIds = new Set<string>();
    allPayments.forEach((p: any) => {
      if (Array.isArray(p.allocated_charges)) {
        p.allocated_charges.forEach((alloc: any) => {
          if (alloc.chargeId) allocatedChargeIds.add(alloc.chargeId);
        });
      }
    });

    const tenantPaidHistory = allPayments.filter((p: any) => {
      if (p.status === 'settled' || p.status === 'pending' || p.status === 'overdue') return false;
      if (allocatedChargeIds.has(p.id) || allocatedChargeIds.has(p.payment_id)) return false;
      return p.status === 'paid' || p.status === 'completed' || p.status === 'success';
    });

    const notices = noticesQuery.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    notices.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const activityLogs = activityLogsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    activityLogs.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    const systemSettings = systemSettingsSnap?.exists ? systemSettingsSnap.data() : {};
    const tenantPaymentsEnabled = systemSettings?.tenantPaymentsEnabled !== false;
    console.log('[DEBUG] Fetched tenantPaymentsEnabled:', tenantPaymentsEnabled);

    return {
      success: true,
      data: {
        tenant: tenantData,
        roommates,
        availableBeds,
        pendingDues,
        payments: tenantPaidHistory,
        notices: notices.slice(0, 3), // Top 3 recent
        tenantPaymentsEnabled,
        activityLogs
      }
    };
  } catch (err: any) {
    console.error("Error fetching tenant dashboard data:", err);
    return { success: false, error: err.message };
  }
}

export async function sendPasswordResetAction(email: string, appUrl: string) {
  try {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes expiration

    await adminDb.collection('password_resets').doc(token).set({
      email,
      expiresAt,
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    const directAppResetLink = `${appUrl}/reset-password?token=${token}`;

    let userName = 'User';
    const tenantDocs = await adminDb.collection('tenants').where('email', '==', email).limit(1).get();
    if (!tenantDocs.empty) {
      const data = tenantDocs.docs[0].data();
      userName = data.full_name || data.name || 'Tenant';
    } else {
      const profileDocs = await adminDb.collection('user_profiles').where('email', '==', email).limit(1).get();
      if (!profileDocs.empty) {
        const data = profileDocs.docs[0].data();
        userName = data.full_name || data.name || 'Admin';
      }
    }

    const emailSent = await sendPasswordResetHTMLMail(email, userName, directAppResetLink);
    if (emailSent) {
      return { success: true, message: 'Reset link sent successfully to your email!' };
    } else {
      return { success: false, error: 'Link generated, but failed to send email. Please contact support.' };
    }

  } catch (err: any) {
    console.error("Error in sendPasswordResetAction:", err);
    return { success: false, error: 'Failed to initiate password reset.' };
  }
}

export async function verifyCustomResetToken(token: string) {
  try {
    const docRef = adminDb.collection('password_resets').doc(token);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      return { success: false, error: 'Invalid or expired reset link.' };
    }
    
    const data = docSnap.data();
    if (data?.status !== 'pending') {
      return { success: false, error: 'This reset link has already been used.' };
    }
    
    const now = new Date();
    const expiresAt = new Date(data?.expiresAt || 0);
    
    if (now > expiresAt) {
      return { success: false, error: 'This password reset link has expired.' };
    }
    
    return { success: true, email: data.email };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function executeCustomPasswordReset(token: string, newPassword: string) {
  try {
    const docRef = adminDb.collection('password_resets').doc(token);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      return { success: false, error: 'Invalid or expired reset link.' };
    }
    
    const data = docSnap.data();
    if (data?.status !== 'pending') {
      return { success: false, error: 'This reset link has already been used.' };
    }
    
    const now = new Date();
    const expiresAt = new Date(data?.expiresAt || 0);
    
    if (now > expiresAt) {
      return { success: false, error: 'This password reset link has expired.' };
    }
    
    if (newPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }
    
    const email = data.email;
    const userRecord = await adminAuth.getUserByEmail(email);
    
    await adminAuth.updateUser(userRecord.uid, { password: newPassword });
    
    await docRef.update({
      status: 'completed',
      completedAt: now.toISOString()
    });
    
    return { success: true };
  } catch (err: any) {
    console.error("Custom password reset error:", err);
    return { success: false, error: err.message || 'Failed to reset password.' };
  }
}

export async function resetTenantPasswordAdmin(email: string, newPassword: string) {
  try {
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }
    const userRecord = await adminAuth.getUserByEmail(email);
    await adminAuth.updateUser(userRecord.uid, { password: newPassword });
    console.log(`[PASSWORD-UPDATED-ADMIN] Password updated for tenant ${email}`);
    return { success: true, message: 'Password updated successfully!' };
  } catch (err: any) {
    console.error("Error updating password via adminAuth:", err);
    return { success: false, error: err.message || 'Failed to update password.' };
  }
}

export async function updateTenantRent(tenantId: string, rentAmount: number) {
  try {
    if (!tenantId || rentAmount === undefined || rentAmount === null) {
      return { success: false, error: 'Tenant ID and rent amount are required' };
    }

    const tenantRef = adminDb.collection('tenants').doc(tenantId);
    const doc = await tenantRef.get();
    
    if (!doc.exists) {
      return { success: false, error: 'Tenant not found' };
    }

    await tenantRef.update({
      rent_amount: Number(rentAmount),
      updated_at: new Date().toISOString()
    });

    return { success: true, message: 'Monthly rent updated successfully' };
  } catch (err: any) {
    console.error("Error updating tenant rent:", err);
    return { success: false, error: err.message };
  }
}

export async function deleteTenantPermanently(tenantId: string) {
  try {
    let tenantName = 'Tenant';
    let roomNum = 'N/A';
    let pgName = 'A1 Hostels';
    let tenantEmail = '';
    let tenantPhone = '';
    let tenantUid = '';

    const tenantDoc = await adminDb.collection('tenants').doc(tenantId).get();
    if (tenantDoc.exists) {
      const tenantData = tenantDoc.data() as any;
      tenantName = tenantData.full_name || tenantData.name || tenantName;
      roomNum = tenantData.room_number || tenantData.room || roomNum;
      pgName = tenantData.pg_name || tenantData.hostel || pgName;
      tenantEmail = (tenantData.email || '').trim().toLowerCase();
      tenantPhone = (tenantData.mobile || tenantData.phone || '').replace(/\D/g, '').slice(-10);
      tenantUid = tenantData.uid || '';

      if ((!roomNum || roomNum === 'N/A') && tenantData.room_id) {
        const roomDoc = await adminDb.collection('rooms').doc(tenantData.room_id).get();
        if (roomDoc.exists) {
          roomNum = roomDoc.data()?.room_number || roomNum;
        }
      }

      if ((!pgName || pgName === 'A1 Hostels') && tenantData.pg_id) {
        const propDoc = await adminDb.collection('properties').doc(tenantData.pg_id).get();
        if (propDoc.exists) {
          pgName = propDoc.data()?.name || pgName;
        }
      }

      // 1. Delete Firebase Auth account thoroughly across UID, Email, and Phone
      if (tenantUid) {
        await adminAuth.deleteUser(tenantUid).catch(() => {});
      }
      if (tenantEmail) {
        try {
          const authUser = await adminAuth.getUserByEmail(tenantEmail);
          if (authUser) await adminAuth.deleteUser(authUser.uid);
        } catch (e) {}
      }
      if (tenantPhone && tenantPhone.length === 10) {
        try {
          const authUser = await adminAuth.getUserByPhoneNumber(`+91${tenantPhone}`);
          if (authUser) await adminAuth.deleteUser(authUser.uid);
        } catch (e) {}
      }
    }

    const batch = adminDb.batch();

    // 2. Delete tenant document permanently
    batch.delete(adminDb.collection('tenants').doc(tenantId));
    
    // 3. Process payments: Preserve paid payments with snapshot info, delete unpaid dues
    const payments = await adminDb.collection('payments').where('tenant_id', '==', tenantId).get();
    for (const doc of payments.docs) {
      const pData = doc.data();
      const isPaid = pData.status === 'paid' || pData.status === 'completed' || Number(pData.amount_paid || 0) > 0;
      
      if (isPaid) {
        batch.update(doc.ref, {
          tenant_name: pData.tenant_name || tenantName,
          room_number: pData.room_number || roomNum,
          pg_name: pData.pg_name || pgName,
          updated_at: new Date().toISOString()
        });
      } else {
        batch.delete(doc.ref);
      }
    }
    
    // 4. Delete unpaid dues from dues collection
    const dues = await adminDb.collection('dues').where('tenant_id', '==', tenantId).get();
    dues.docs.forEach(doc => batch.delete(doc.ref));

    // 5. Delete complaints and activity logs
    const complaints = await adminDb.collection('complaints').where('tenant_id', '==', tenantId).get();
    complaints.docs.forEach(doc => batch.delete(doc.ref));

    const activityLogs = await adminDb.collection('tenant_activity_logs').where('tenant_id', '==', tenantId).get();
    activityLogs.docs.forEach(doc => batch.delete(doc.ref));

    // 6. Delete matching user_profiles
    if (tenantEmail) {
      const userProfilesByEmail = await adminDb.collection('user_profiles').where('email', '==', tenantEmail).get();
      userProfilesByEmail.docs.forEach(doc => batch.delete(doc.ref));
    }
    if (tenantPhone) {
      const userProfilesByPhone = await adminDb.collection('user_profiles').where('phone', '==', tenantPhone).get();
      userProfilesByPhone.docs.forEach(doc => batch.delete(doc.ref));
    }
    
    await batch.commit();

    try {
      revalidatePath('/pgowner/tenants');
      revalidatePath('/pgowner/history');
      revalidatePath('/pgowner/dues');
    } catch (e) {}

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete tenant permanently' };
  }
}

export async function requestTenantDeletion(tenantId: string, ownerEmail: string, requesterName?: string) {
  try {
    const tenantDoc = await adminDb.collection('tenants').doc(tenantId).get();
    if (!tenantDoc.exists) return { success: false, error: 'Tenant not found' };
    
    const tenant = tenantDoc.data() as any;
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60000).toISOString(); // 1 minute

    // Calculate real pending dues from payments collection
    const paymentsSnap = await adminDb.collection('payments')
      .where('tenant_id', '==', tenantId)
      .where('status', '==', 'pending')
      .get();
    
    let dueAmount = 0;
    paymentsSnap.forEach(d => {
      const data = d.data();
      const orig = Number(data.original_amount || data.amount || 0);
      const paid = Number(data.amount_paid || 0);
      const rem = data.pending_balance !== undefined ? Number(data.pending_balance) : Math.max(0, orig - paid);
      dueAmount += rem;
    });

    // If no explicit pending documents in payments collection, fallback to monthly rent if active
    if (paymentsSnap.empty && tenant.is_active !== false) {
      dueAmount = Number(tenant.rent_amount || tenant.monthly_rent || 0);
    }

    let hostelName = 'A1 Hostels';
    if (tenant.pg_id) {
      const pgDoc = await adminDb.collection('properties').doc(tenant.pg_id).get();
      if (pgDoc.exists) hostelName = pgDoc.data()?.name || hostelName;
    }

    // Resolve human-readable room number
    let roomNo = tenant.room_number || tenant.room || '';
    if ((!roomNo || roomNo.length > 10) && tenant.room_id) {
      try {
        const rDoc = await adminDb.collection('rooms').doc(tenant.room_id).get();
        if (rDoc.exists) {
          roomNo = rDoc.data()?.room_number || rDoc.data()?.number || rDoc.data()?.room || roomNo;
        }
      } catch (e) {
        console.warn("Room number lookup error:", e);
      }
    }
    if (!roomNo) roomNo = 'Unassigned';

    const actorName = requesterName || 'PG Management';

    await adminDb.collection('deletion_requests').doc(token).set({
      tenantId,
      status: 'pending',
      expiresAt,
      requestedAt: new Date().toISOString(),
      requestedBy: actorName
    });

    await adminDb.collection('tenants').doc(tenantId).update({
      deletion_requested_at: new Date().toISOString(),
      deletion_requested_by: actorName
    });

    const emailSent = await sendDeletionConfirmationEmail(
      ownerEmail, 
      tenant.full_name || tenant.name || 'Tenant', 
      token, 
      hostelName, 
      roomNo, 
      dueAmount,
      actorName
    );
    
    if (!emailSent) {
      return { success: false, error: 'Failed to send confirmation email' };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
