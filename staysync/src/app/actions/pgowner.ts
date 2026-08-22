/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { revalidatePath } from 'next/cache';
import { isTenantActiveForBusiness } from '@/lib/repository';
import { getTenantPaymentStatus } from '@/lib/paymentStatus';
import { 
  parseMoneyToPaise, 
  formatPaiseToINR, 
  paiseToRupees, 
  rupeesToPaise, 
  calculateTenantFinancialState, 
  allocatePaymentFIFO, 
  verifyFinancialInvariants,
  FinancialCharge,
  allocatePayment
} from '@/lib/financialEngine';

export async function resolveEffectiveOwnerId(userId: string) {
  try {
    const doc = await adminDb.collection('user_profiles').doc(userId).get();
    if (doc.exists) {
      const data = doc.data();
      if (data?.role === 'team_member') {
        if (data?.owner_id) {
          return { ownerId: data.owner_id, isTeamMember: true };
        }
        if (Array.isArray(data?.assigned_properties) && data.assigned_properties.length > 0) {
          const propDoc = await adminDb.collection('properties').doc(data.assigned_properties[0]).get();
          const pData = propDoc.exists ? propDoc.data() : null;
          if (pData?.owner_id) {
            return { ownerId: pData.owner_id, isTeamMember: true };
          }
        }
      }
    }
    return { ownerId: userId, isTeamMember: false };
  } catch (e) {
    return { ownerId: userId, isTeamMember: false };
  }
}

export async function getInitialAppData(ownerId: string, selectedPgId: string | null = null) {
  try {
    const { ownerId: effectiveOwnerId } = await resolveEffectiveOwnerId(ownerId);

    const propsSnap = await adminDb.collection('properties').where('owner_id', '==', effectiveOwnerId).get();
    const properties: any[] = propsSnap.docs
      .map(doc => ({ id: doc.id, ...(doc.data() as any) }))
      .filter((p: any) => p.owner_id === effectiveOwnerId && p.is_active !== false && p.status !== 'INACTIVE' && p.status !== 'DELETED');

    if (properties.length === 0) {
      return {
        success: true,
        data: { property: null, properties: [], rooms: [], tenants: [], dues: [], payments: [], expenses: [], foodMenu: null }
      };
    }

    properties.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    let targetPgId = selectedPgId;
    if (!targetPgId || !properties.some((p: any) => (p.pg_id || p.id) === targetPgId)) {
      targetPgId = properties[0].pg_id || properties[0].id;
    }

    const currentProp = properties.find((p: any) => (p.pg_id || p.id) === targetPgId);
    const safePgId = targetPgId || '';

    const [roomsSnap, tenantsSnap, paymentsSnap, expensesSnap, foodMenuDoc] = await Promise.all([
      adminDb.collection('rooms').where('pg_id', '==', safePgId).get(),
      adminDb.collection('tenants').where('pg_id', '==', safePgId).get(),
      adminDb.collection('payments').where('pg_id', '==', safePgId).get(),
      adminDb.collection('expenses').where('pg_id', '==', safePgId).get(),
      adminDb.collection('food_menus').doc(safePgId).get()
    ]);

    const rooms = roomsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const roomsMap: Record<string, any> = {};
    rooms.forEach((r: any) => {
      if (r.id) roomsMap[r.id] = r;
      if (r.room_id) roomsMap[r.room_id] = r;
    });

    const rawTenants = tenantsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const tenants = rawTenants
      .filter((t: any) => t.status !== 'DELETED')
      .map((t: any) => {
        const roomObj = roomsMap[t.room_id] || roomsMap[t.room] || null;
        return {
          ...t,
          pg_name: currentProp?.name || 'A1 Hostels',
          room_number: roomObj?.room_number || t.room_number || t.room || 'N/A',
          rooms: roomObj ? { room_number: roomObj.room_number, floor: roomObj.floor } : (t.rooms || { room_number: t.room_number || t.room || 'N/A' })
        };
      });

    const rawPayments = paymentsSnap.docs.map(d => ({ id: d.id, payment_id: d.id, ...d.data() }));
    const dues = rawPayments.filter((p: any) => p.status === 'pending' || p.status === 'overdue' || p.status === 'settled');

    // Collect all charge IDs that were settled/paid by a payment receipt
    const allocatedChargeIds = new Set<string>();
    rawPayments.forEach((p: any) => {
      if (Array.isArray(p.allocated_charges)) {
        p.allocated_charges.forEach((alloc: any) => {
          if (alloc.chargeId) allocatedChargeIds.add(alloc.chargeId);
        });
      }
    });

    const payments = rawPayments.filter((p: any) => {
      if (p.status === 'settled' || p.status === 'pending' || p.status === 'overdue') return false;
      const isPaid = p.status === 'paid' || p.status === 'completed' || p.status === 'success' || p.status === 'reversed';
      if (!isPaid) return false;
      if (allocatedChargeIds.has(p.id) || allocatedChargeIds.has(p.payment_id)) return false;
      return true;
    });

    const expenses = expensesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const foodMenu = foodMenuDoc.exists ? foodMenuDoc.data() : null;

    return {
      success: true,
      data: {
        property: currentProp,
        properties,
        rooms,
        tenants,
        dues,
        payments,
        expenses,
        foodMenu
      }
    };
  } catch (err: any) {
    console.error("Error in getInitialAppData:", err);
    return { success: false, error: err.message };
  }
}

export async function addSubHostel(ownerId: string, name: string, address: string, rooms: {floor: string, roomNum: string, beds: number}[], pricing: Record<number, string>) {
  try {
    const pricingStr = JSON.stringify(pricing);
    
    const newPropertyRef = adminDb.collection('properties').doc();
    const newPgId = newPropertyRef.id;

    await newPropertyRef.set({
      pg_id: newPgId,
      owner_id: ownerId,
      name: name,
      address: address,
      theme_primary_color: pricingStr,
      is_active: true,
      created_at: new Date().toISOString()
    });

    // Bulk insert rooms
    if (rooms && rooms.length > 0) {
      const batch = adminDb.batch();
      rooms.forEach(r => {
        const roomRef = adminDb.collection('rooms').doc();
        batch.set(roomRef, {
          room_id: roomRef.id,
          pg_id: newPgId,
          room_number: r.roomNum,
          floor: r.floor,
          total_beds: r.beds,
          created_at: new Date().toISOString()
        });
      });
      await batch.commit();
    }

    revalidatePath('/pgowner/properties');
    revalidatePath('/pgowner');
    
    return { success: true, data: [{ pg_id: newPgId }] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createHostelProperty(ownerId: string, name: string, address: string, totalRooms: number = 5, bedsPerRoom: number = 3) {
  try {
    const rooms = [];
    for (let i = 1; i <= totalRooms; i++) {
      rooms.push({
        floor: '1st Floor',
        roomNum: `${100 + i}`,
        beds: bedsPerRoom
      });
    }
    return await addSubHostel(ownerId, name, address, rooms, { 1: "8000" });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createNewHostelFull(
  ownerId: string, 
  data: {
    name: string;
    address: string;
    locationLink?: string;
    floorsConfig: { floorName: string; roomsCount: number; rooms: { roomNum: string; sharing: number }[] }[];
    pricing: Record<number, string>;
  }
) {
  try {
    const rooms: { floor: string; roomNum: string; beds: number }[] = [];

    data.floorsConfig.forEach((fConfig) => {
      fConfig.rooms.forEach(r => {
        rooms.push({
          floor: fConfig.floorName,
          roomNum: r.roomNum,
          beds: r.sharing
        });
      });
    });

    const fullAddress = data.locationLink ? `${data.address} | Maps: ${data.locationLink}` : data.address;

    return await addSubHostel(ownerId, data.name, fullAddress, rooms, data.pricing);
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getHostelDetailsForEdit(pgId: string) {
  try {
    const propDoc = await adminDb.collection('properties').doc(pgId).get();
    if (!propDoc.exists) return { success: false, error: "Property not found" };

    const pData = propDoc.data() as any;

    let pricing: Record<number, string> = { 1: "12000", 2: "9500", 3: "8000", 4: "7000" };
    if (pData.theme_primary_color) {
      try {
        pricing = JSON.parse(pData.theme_primary_color);
      } catch (e) {}
    }

    let address = pData.address || '';
    let locationLink = '';
    if (address.includes(' | Maps: ')) {
      const parts = address.split(' | Maps: ');
      address = parts[0];
      locationLink = parts[1];
    }

    const roomsSnap = await adminDb.collection('rooms').where('pg_id', '==', pgId).get();
    const rooms = roomsSnap.docs.map(d => d.data());

    const floorMap = new Map<string, { roomsCount: number; rooms: { roomNum: string; sharing: number }[] }>();
    rooms.forEach((r: any) => {
      const fName = r.floor || '1st Floor';
      if (!floorMap.has(fName)) {
        floorMap.set(fName, { roomsCount: 0, rooms: [] });
      }
      const item = floorMap.get(fName)!;
      item.roomsCount += 1;
      item.rooms.push({ roomNum: r.room_number, sharing: r.total_beds || 2 });
    });

    const floorsConfig: { floorName: string; roomsCount: number; rooms: { roomNum: string; sharing: number }[] }[] = [];
    if (floorMap.size > 0) {
      floorMap.forEach((val, key) => {
        floorsConfig.push({ floorName: key, roomsCount: val.roomsCount, rooms: val.rooms });
      });
    } else {
      floorsConfig.push({ floorName: '1st Floor', roomsCount: 4, rooms: [] });
    }

    return {
      success: true,
      data: {
        pg_id: pgId,
        name: pData.name || '',
        address,
        locationLink,
        pricing,
        floorsConfig
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getGlobalFinancials(ownerId: string) {
  try {
    if (!ownerId) return { success: false, error: 'ownerId is required' };
    
    // Get all properties for this owner
    const propsSnap = await adminDb.collection('properties')
      .where('owner_id', '==', ownerId)
      .get();
      
    if (propsSnap.empty) return { success: true, data: { payments: [], expenses: [] } };
    
    const pgIds = propsSnap.docs
      .filter(doc => doc.data().is_active !== false && doc.data().status !== 'DELETED')
      .map(doc => doc.data().pg_id)
      .filter(id => id);
      
    if (pgIds.length === 0) return { success: true, data: { payments: [], expenses: [] } };

    // Fetch payments
    let payments: any[] = [];
    if (pgIds.length <= 10) {
      const pSnap = await adminDb.collection('payments').where('pg_id', 'in', pgIds).get();
      payments = pSnap.docs.map(doc => doc.data());
    } else {
      for (const id of pgIds) {
        const pSnap = await adminDb.collection('payments').where('pg_id', '==', id).get();
        payments.push(...pSnap.docs.map(d => d.data()));
      }
    }

    // Fetch expenses
    let expenses: any[] = [];
    if (pgIds.length <= 10) {
      const eSnap = await adminDb.collection('expenses').where('pg_id', 'in', pgIds).get();
      expenses = eSnap.docs.map(doc => doc.data());
    } else {
      for (const id of pgIds) {
        const eSnap = await adminDb.collection('expenses').where('pg_id', '==', id).get();
        expenses.push(...eSnap.docs.map(d => d.data()));
      }
    }

    return { success: true, data: { payments, expenses } };
  } catch (err: any) {
    return { success: false, error: err.message, data: { payments: [], expenses: [] } };
  }
}

export async function updateHostelMedia(pgId: string, data: { images: string[], facilities: string[] }) {
  try {
    if (!pgId) return { success: false, error: 'Property ID is required' };
    
    const propsRef = adminDb.collection('properties');
    const q = await propsRef.where('pg_id', '==', pgId).limit(1).get();
    
    let docRef;
    if (q.empty) {
      docRef = propsRef.doc(pgId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) {
        return { success: false, error: 'Property not found' };
      }
    } else {
      docRef = q.docs[0].ref;
    }
    
    await docRef.update({
      images: data.images || [],
      facilities: data.facilities || [],
      updated_at: new Date().toISOString()
    });
    
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateHostelPropertyFull(
  pgId: string,
  data: {
    name: string;
    address: string;
    locationLink?: string;
    floorsConfig?: { floorName: string; roomsCount: number; rooms: { roomNum: string; sharing: number }[] }[];
    pricing: Record<number, string>;
  }
) {
  try {
    const fullAddress = data.locationLink ? `${data.address} | Maps: ${data.locationLink}` : data.address;
    const pricingStr = JSON.stringify(data.pricing);

    await adminDb.collection('properties').doc(pgId).update({
      name: data.name,
      address: fullAddress,
      theme_primary_color: pricingStr,
      updated_at: new Date().toISOString()
    });

    if (data.floorsConfig && data.floorsConfig.length > 0) {
      const existingRoomsSnap = await adminDb.collection('rooms').where('pg_id', '==', pgId).get();
      const existingMap = new Map();
      existingRoomsSnap.docs.forEach(doc => {
        const rData = doc.data();
        existingMap.set(rData.room_number, doc.ref);
      });

      const batch = adminDb.batch();

      data.floorsConfig.forEach((fConfig) => {
        fConfig.rooms.forEach((r) => {
          const roomNum = r.roomNum;
          if (existingMap.has(roomNum)) {
            const ref = existingMap.get(roomNum);
            batch.update(ref, {
              floor: fConfig.floorName,
              total_beds: r.sharing,
              updated_at: new Date().toISOString()
            });
          } else {
            const roomRef = adminDb.collection('rooms').doc();
            batch.set(roomRef, {
              room_id: roomRef.id,
              pg_id: pgId,
              room_number: roomNum,
              floor: fConfig.floorName,
              total_beds: r.sharing,
              created_at: new Date().toISOString()
            });
          }
        });
      });

      await batch.commit();
    }

    revalidatePath('/pgowner/properties');
    revalidatePath(`/pgowner/properties/${pgId}`);
    revalidatePath('/pgowner');

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getProperties(ownerId: string) {
  try {
    const { ownerId: effectiveOwnerId } = await resolveEffectiveOwnerId(ownerId);
    const snapshot = await adminDb.collection('properties')
      .where('owner_id', '==', effectiveOwnerId)
      .get();
    
    let data = snapshot.docs
      .map(doc => doc.data())
      .filter(p => p.owner_id === effectiveOwnerId && p.is_active !== false && p.status !== 'INACTIVE' && p.status !== 'DELETED');
    data.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    // Fetch real metrics for each property
    for (let i = 0; i < data.length; i++) {
      const pgId = data[i].pg_id;
      
      // Get all tenants for this pg_id to count active ones robustly
      const tenantsSnap = await adminDb.collection('tenants').where('pg_id', '==', pgId).get();
      const activeTenants = tenantsSnap.docs.filter(d => isTenantActiveForBusiness(d.data()));
      const tenantCount = activeTenants.length;
      
      // Get rooms count
      const roomsSnap = await adminDb.collection('rooms').where('pg_id', '==', pgId).get();
      const roomsCount = roomsSnap.size;
      
      // Calculate total capacity
      let totalCapacity = 0;
      roomsSnap.docs.forEach(d => {
        const rData = d.data();
        totalCapacity += (rData.total_beds || rData.beds || 2);
      });
      
      // Group active tenants by room_id in memory to calculate occupied rooms count
      const occupiedRoomIds = new Set(activeTenants.map(d => d.data().room_id).filter(Boolean));
      const filledRoomsCount = occupiedRoomIds.size;
      
      const occupancyRate = totalCapacity > 0 ? Math.round((tenantCount / totalCapacity) * 100) : 0;
      
      // Get pending dues
      const duesSnap = await adminDb.collection('payments').where('pg_id', '==', pgId).where('status', '==', 'pending').get();
      let pendingDues = 0;
      duesSnap.docs.forEach(d => {
        pendingDues += (d.data().amount || 0);
      });

      data[i] = {
        ...data[i],
        calculatedTenantCount: tenantCount,
        calculatedRoomsCount: roomsCount,
        calculatedOccupancyRate: occupancyRate,
        calculatedPendingDues: pendingDues,
        calculatedTotalCapacity: totalCapacity,
        calculatedFilledRoomsCount: filledRoomsCount
      };
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

export async function requestHostelDeletion(pgId: string, ownerEmail: string) {
  try {
    const pgDoc = await adminDb.collection('properties').doc(pgId).get();
    if (!pgDoc.exists) return { success: false, error: 'Hostel not found' };

    const pgData = pgDoc.data() as any;
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60000).toISOString(); // 1 minute

    const [roomsSnap, tenantsSnap] = await Promise.all([
      adminDb.collection('rooms').where('pg_id', '==', pgId).get(),
      adminDb.collection('tenants').where('pg_id', '==', pgId).get()
    ]);

    await adminDb.collection('deletion_requests').doc(token).set({
      type: 'property',
      propertyId: pgId,
      status: 'pending',
      expiresAt,
      requestedAt: new Date().toISOString()
    });

    const { sendHostelDeletionConfirmationEmail } = await import('@/lib/email');
    const emailSent = await sendHostelDeletionConfirmationEmail(
      ownerEmail,
      pgData.name || 'Hostel',
      token,
      roomsSnap.size,
      tenantsSnap.size
    );

    if (!emailSent) {
      return { success: false, error: 'Failed to send confirmation email' };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteProperty(pgId: string) {
  try {
    // 1. Fetch and clean up all tenants in this hostel
    const tenantsSnap = await adminDb.collection('tenants').where('pg_id', '==', pgId).get();
    for (const tDoc of tenantsSnap.docs) {
      const tData = tDoc.data();
      const tUid = tData.uid;
      const tEmail = tData.email;
      const tPhone = (tData.mobile || tData.phone || '').replace(/\D/g, '').slice(-10);

      if (tUid) await adminAuth.deleteUser(tUid).catch(() => {});
      if (tEmail) {
        try {
          const u = await adminAuth.getUserByEmail(tEmail);
          if (u) await adminAuth.deleteUser(u.uid);
        } catch (e) {}
      }
      if (tPhone && tPhone.length === 10) {
        try {
          const u = await adminAuth.getUserByPhoneNumber(`+91${tPhone}`);
          if (u) await adminAuth.deleteUser(u.uid);
        } catch (e) {}
      }

      // Delete user_profiles for this tenant
      if (tEmail) {
        const pSnap = await adminDb.collection('user_profiles').where('email', '==', tEmail).get();
        pSnap.docs.forEach(doc => doc.ref.delete());
      }
    }

    // 2. Cascade delete all documents across collections
    const collectionsToClean = [
      'payments',
      'dues',
      'tenants',
      'rooms',
      'complaints',
      'notices',
      'expenses',
      'food_menus',
      'tenant_activity_logs'
    ];

    for (const col of collectionsToClean) {
      const snap = await adminDb.collection(col).where('pg_id', '==', pgId).get();
      if (!snap.empty) {
        const batch = adminDb.batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
    }

    // 3. Clean up team members assigned to this hostel
    const teamSnap = await adminDb.collection('team_members').where('pg_id', '==', pgId).get();
    for (const memberDoc of teamSnap.docs) {
      const mData = memberDoc.data();
      if (mData.email) {
        try {
          const u = await adminAuth.getUserByEmail(mData.email);
          if (u) await adminAuth.deleteUser(u.uid);
        } catch (e) {}
      }
      await memberDoc.ref.delete();
    }

    // 4. Delete property document
    await adminDb.collection('properties').doc(pgId).delete();
    
    revalidatePath('/pgowner/properties');
    revalidatePath('/pgowner');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateProperty(
  pgId: string, 
  name: string, 
  address: string,
  rooms: {floor: string, roomNum: string, beds: number}[], 
  pricing: Record<number, string>
) {
  try {
    const pricingStr = JSON.stringify(pricing);
    await adminDb.collection('properties').doc(pgId).update({ 
      name, 
      address, 
      theme_primary_color: pricingStr 
    });
      
    // Sync rooms safely
    const existingRoomsSnap = await adminDb.collection('rooms').where('pg_id', '==', pgId).get();
    const existingRooms = existingRoomsSnap.docs.map(doc => doc.data());
    
    if (rooms && rooms.length > 0) {
      for (const r of rooms) {
        const existing = existingRooms.find(er => er.room_number === r.roomNum);
        if (existing) {
          if (existing.total_beds !== r.beds) {
            await adminDb.collection('rooms').doc(existing.room_id).update({ total_beds: r.beds });
          }
        } else {
          const roomRef = adminDb.collection('rooms').doc();
          await roomRef.set({
            room_id: roomRef.id,
            pg_id: pgId,
            room_number: r.roomNum,
            floor: r.floor,
            total_beds: r.beds,
            created_at: new Date().toISOString()
          });
        }
      }
    }

    revalidatePath('/pgowner/properties');
    revalidatePath('/pgowner');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getPropertyMap(pgId: string) {
  try {
    const propDoc = await adminDb.collection('properties').doc(pgId).get();
    if (!propDoc.exists) throw new Error("Property not found");
    const propData = propDoc.data();

    const roomsSnap = await adminDb.collection('rooms').where('pg_id', '==', pgId).get();
    const rooms = roomsSnap.docs.map(doc => doc.data());

    const tenantsSnap = await adminDb.collection('tenants').where('pg_id', '==', pgId).where('is_active', '==', true).get();
    const tenants = tenantsSnap.docs.map(doc => doc.data());

    return { success: true, data: { property: propData, rooms, tenants } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getPropertiesWithRooms(ownerId: string) {
  try {
    const { ownerId: effectiveOwnerId } = await resolveEffectiveOwnerId(ownerId);
    const propsSnap = await adminDb.collection('properties')
      .where('owner_id', '==', effectiveOwnerId)
      .get();
      
    if (propsSnap.empty) return { success: true, data: [] };
    const properties = propsSnap.docs
      .map(doc => doc.data())
      .filter(p => p.owner_id === effectiveOwnerId && p.is_active !== false && p.status !== 'INACTIVE' && p.status !== 'DELETED');
    
    if (properties.length === 0) return { success: true, data: [] };
    
    // Sort properties descending by created_at to perfectly match getTenants
    properties.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    const pgIds = properties.map(p => p.pg_id);
    
    // Firestore 'in' query has max 10 elements. Assuming owner has < 10 active hostels for now
    let rooms: any[] = [];
    if (pgIds.length <= 10) {
      const roomsSnap = await adminDb.collection('rooms').where('pg_id', 'in', pgIds).get();
      rooms = roomsSnap.docs.map(doc => doc.data());
    } else {
      // Chunk queries if needed in production
      for (const id of pgIds) {
        const rSnap = await adminDb.collection('rooms').where('pg_id', '==', id).get();
        rooms.push(...rSnap.docs.map(d => d.data()));
      }
    }

    // Attach rooms to properties
    const propsWithRooms = properties.map(p => ({
      ...p,
      rooms: rooms.filter(r => r.pg_id === p.pg_id)
    }));

    return { success: true, data: propsWithRooms };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

export async function addTenant(data: {
  ownerId: string;
  pgId: string;
  roomId: string;
  fullName: string;
  phone: string;
  email: string;
  parentPhone?: string;
  workStatus?: string;
  moveInDate: string;
  rentAmount: number;
  securityDeposit: number;
  openingPendingFee?: number;
  openingBalanceDueDate?: string;
  documents?: {
    facePicture?: string;
    govtFront?: string;
    govtBack?: string;
    collegeFront?: string;
    collegeBack?: string;
    empFront?: string;
    empBack?: string;
  };
}) {
  try {
    const cleanDigits = (data.phone || '').replace(/\D/g, '').slice(-10);
    const cleanEmail = (data.email || '').trim().toLowerCase();

    if (!cleanDigits || cleanDigits.length < 10) {
      return { success: false, error: 'Please enter a valid 10-digit phone number.' };
    }

    const formattedPhone = `+91${cleanDigits}`;

    // Execute ALL strict uniqueness checks concurrently in parallel
    const [
      tenantPhoneSnap,
      tenantEmailSnap,
      profilePhoneSnap,
      profileMobileSnap,
      profileEmailSnap,
      teamPhoneSnap,
      authPhoneUser,
      authEmailUser
    ] = await Promise.all([
      adminDb.collection('tenants').where('mobile', '==', cleanDigits).get().catch(() => null),
      cleanEmail ? adminDb.collection('tenants').where('email', '==', cleanEmail).get().catch(() => null) : Promise.resolve(null),
      adminDb.collection('user_profiles').where('phone', '==', cleanDigits).get().catch(() => null),
      adminDb.collection('user_profiles').where('mobile', '==', cleanDigits).get().catch(() => null),
      cleanEmail ? adminDb.collection('user_profiles').where('email', '==', cleanEmail).get().catch(() => null) : Promise.resolve(null),
      adminDb.collection('team_members').where('mobile', '==', cleanDigits).get().catch(() => null),
      adminAuth.getUserByPhoneNumber(formattedPhone).catch(() => null),
      cleanEmail ? adminAuth.getUserByEmail(cleanEmail).catch(() => null) : Promise.resolve(null)
    ]);

    // 1. Check duplicate active tenant in the same property
    if (tenantPhoneSnap && !tenantPhoneSnap.empty) {
      const hasActivePhoneTenant = tenantPhoneSnap.docs.some(doc => {
        const d = doc.data();
        return d.is_active !== false && d.status === 'Active' && d.pg_id === data.pgId;
      });
      if (hasActivePhoneTenant) {
        return { success: false, error: `An active tenant with phone number ${cleanDigits} already exists in this hostel.` };
      }
    }

    // 2. Prevent adding registered PG Owner or Super Admin accounts as a tenant
    const isOwnerOrAdmin = [
      ...(profilePhoneSnap?.docs || []), 
      ...(profileMobileSnap?.docs || []), 
      ...(profileEmailSnap?.docs || [])
    ].some(d => d.data()?.role === 'pg_owner' || d.data()?.role === 'super_admin');

    if (isOwnerOrAdmin) {
      return { success: false, error: `Phone number or email belongs to a registered PG Owner or Super Admin account.` };
    }

    const tenantRef = adminDb.collection('tenants').doc();
    const finalRentAmount = Math.round(Number(data.rentAmount) || 0);
    const finalDeposit = Math.round(Number(data.securityDeposit) || 0);
    const finalOpeningFee = Math.round(Number(data.openingPendingFee) || 0);

    const tenantData: any = {
      tenant_id: tenantRef.id,
      pg_id: data.pgId,
      room_id: data.roomId,
      full_name: data.fullName,
      mobile: cleanDigits,
      parent_phone: data.parentPhone || '',
      alternate_phone: data.parentPhone || '',
      emergency_contact: data.parentPhone || '',
      email: cleanEmail || '',
      work_status: data.workStatus || 'student',
      rent_amount: finalRentAmount,
      security_deposit: finalDeposit,
      extra_fee: 0,
      is_active: true,
      status: 'Active',
      move_in_date: data.moveInDate || new Date().toISOString(),
      documents: data.documents || {},
      face_picture: data.documents?.facePicture || '',
      created_at: new Date().toISOString()
    };

    const batch = adminDb.batch();
    batch.set(tenantRef, tenantData);

    const currentMonth = new Date(data.moveInDate || Date.now()).toLocaleString('default', { month: 'long' });
    const paymentRef = adminDb.collection('payments').doc();
    batch.set(paymentRef, {
      payment_id: paymentRef.id,
      pg_id: data.pgId,
      owner_id: data.ownerId || '',
      tenant_id: tenantRef.id,
      tenant_name: data.fullName,
      tenant_phone: cleanDigits,
      amount: finalRentAmount,
      amount_paid: 0,
      status: 'pending',
      type: 'monthly_rent',
      description: `${currentMonth} Rent`,
      month: currentMonth,
      due_date: data.moveInDate || new Date().toISOString(),
      created_at: new Date().toISOString()
    });

    if (finalOpeningFee > 0) {
      const openingFeeRef = adminDb.collection('payments').doc();
      const openingMonth = new Date(data.openingBalanceDueDate || Date.now()).toLocaleString('default', { month: 'long' });
      batch.set(openingFeeRef, {
        payment_id: openingFeeRef.id,
        pg_id: data.pgId,
        owner_id: data.ownerId || '',
        tenant_id: tenantRef.id,
        tenant_name: data.fullName,
        tenant_phone: cleanDigits,
        amount: finalOpeningFee,
        amount_paid: 0,
        status: 'pending',
        month: openingMonth,
        description: 'Opening Pending Fee',
        type: 'opening-fee',
        due_date: data.openingBalanceDueDate || data.moveInDate || new Date().toISOString(),
        created_at: data.openingBalanceDueDate || new Date().toISOString()
      });
    }

    await batch.commit();

    // Asynchronously dispatch WhatsApp Welcome + Due/Overdue Notification in background (<50ms non-blocking)
    (async () => {
      try {
        const { sendTenantWelcomeNotification, sendRentReminderWithLink } = await import('@/lib/whatsapp');
        let hostelName = 'A1 Hostels';
        const pgSnap = await adminDb.collection('properties').doc(data.pgId).get();
        if (pgSnap.exists) hostelName = pgSnap.data()?.name || hostelName;

        let roomNum = 'N/A';
        const roomSnap = await adminDb.collection('rooms').doc(data.roomId).get();
        if (roomSnap.exists) roomNum = roomSnap.data()?.room_number || roomNum;

        // 1. Send Welcome Notification
        await sendTenantWelcomeNotification({
          tenantPhone: cleanDigits,
          tenantName: data.fullName,
          roomNumber: roomNum,
          moveInDate: data.moveInDate,
          rentAmount: finalRentAmount,
          securityDeposit: finalDeposit,
          hostelName,
          tenantId: tenantRef.id,
          triggeredBy: 'auto_tenant_create'
        });

        // 2. If tenant has pending rent / opening fee, also send Due/Overdue Reminder
        const totalPendingDue = finalRentAmount + finalOpeningFee;
        if (totalPendingDue > 0) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          let moveIn = new Date(data.moveInDate || Date.now());
          if (isNaN(moveIn.getTime())) moveIn = new Date();
          moveIn.setHours(0, 0, 0, 0);

          const diffTime = today.getTime() - moveIn.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          let statusType: 'STANDARD' | 'DUE_TODAY' | 'DUE_TOMORROW' | 'OVERDUE' = 'DUE_TODAY';
          let overdueDays = 0;

          if (diffDays > 0) {
            statusType = 'OVERDUE';
            overdueDays = diffDays;
          } else if (diffDays === 0) {
            statusType = 'DUE_TODAY';
          } else if (diffDays === -1) {
            statusType = 'DUE_TOMORROW';
          } else {
            statusType = 'STANDARD';
          }

          const currentMonth = today.toLocaleString('default', { month: 'long', year: 'numeric' });
          const dueDateFormatted = moveIn.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

          await sendRentReminderWithLink(
            cleanDigits,
            data.fullName,
            totalPendingDue,
            currentMonth,
            paymentRef.id,
            hostelName,
            statusType,
            overdueDays,
            {
              tenantId: tenantRef.id,
              triggeredBy: 'auto_tenant_create_due',
              roomNumber: roomNum,
              dueDateStr: dueDateFormatted
            }
          );
        }
      } catch (err) {
        console.warn('Background welcome/due notification error:', err);
      }
    })();

    return { success: true, data: { tenant_id: tenantRef.id } };
  } catch (err: any) {
    console.error('Error in addTenant action:', err);
    return { success: false, error: err.message || 'Failed to save tenant record.' };
  }
}

export async function updateTenantBasicDetails(tenantId: string, data: {
  fullName?: string;
  mobile?: string;
  parentPhone?: string;
  alternatePhone?: string;
  email?: string;
  moveInDate?: string;
  checkOutDate?: string;
  documents?: any;
  facePicture?: string;
  face_picture?: string;
}) {
  try {
    const updateData: any = {};
    if (data.fullName !== undefined) updateData.full_name = data.fullName;
    if (data.mobile !== undefined) updateData.mobile = data.mobile;
    if (data.parentPhone !== undefined) {
      updateData.parent_phone = data.parentPhone;
      updateData.alternate_phone = data.parentPhone;
      updateData.emergency_contact = data.parentPhone;
    }
    if (data.alternatePhone !== undefined) {
      updateData.alternate_phone = data.alternatePhone;
      updateData.parent_phone = data.alternatePhone;
      updateData.emergency_contact = data.alternatePhone;
    }
    if (data.email !== undefined) updateData.email = data.email;
    if (data.moveInDate !== undefined) updateData.move_in_date = data.moveInDate;
    if (data.checkOutDate !== undefined) updateData.check_out_date = data.checkOutDate;
    if (data.documents !== undefined) {
      updateData.documents = data.documents;
      if (data.documents?.facePicture || data.documents?.photo) {
        updateData.face_picture = data.documents.facePicture || data.documents.photo;
      }
    }
    if (data.facePicture !== undefined) updateData.face_picture = data.facePicture;
    if (data.face_picture !== undefined) updateData.face_picture = data.face_picture;

    if (Object.keys(updateData).length > 0) {
      await adminDb.collection('tenants').doc(tenantId).update(updateData);
      revalidatePath(`/pgowner/tenants/${tenantId}`);
      revalidatePath('/pgowner/tenants');
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getTenants(ownerId: string, selectedPgId: string | null = null) {
  try {
    const { ownerId: effectiveOwnerId } = await resolveEffectiveOwnerId(ownerId);
    const propsSnap = await adminDb.collection('properties').where('owner_id', '==', effectiveOwnerId).get();
    if (propsSnap.empty) return { success: true, data: [] };
    
    const props = propsSnap.docs
      .map(doc => ({ id: doc.id, ...doc.data() as any }))
      .filter(p => p.owner_id === effectiveOwnerId && p.is_active !== false && p.status !== 'INACTIVE' && p.status !== 'DELETED');
    
    if (props.length === 0) return { success: true, data: [] };

    props.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    
    let pgIds = props.map((p: any) => p.pg_id || p.id).filter(Boolean);
    if (selectedPgId && selectedPgId !== 'all' && selectedPgId !== 'ALL') {
      const matched = props.filter((p: any) => (p.pg_id || p.id) === selectedPgId).map((p: any) => p.pg_id || p.id);
      pgIds = matched;
    }

    if (pgIds.length === 0) return { success: true, data: [] };

    const tenantMap = new Map<string, any>();

    // 1. Fetch strictly by pg_ids belonging to this owner
    if (pgIds.length <= 10) {
      const tenantsSnap = await adminDb.collection('tenants').where('pg_id', 'in', pgIds).get();
      tenantsSnap.docs.forEach(d => {
        const tData = d.data();
        if (tData.status !== 'DELETED') {
          tenantMap.set(d.id, { id: d.id, ...tData });
        }
      });
    } else {
      for (const id of pgIds) {
        const tSnap = await adminDb.collection('tenants').where('pg_id', '==', id).get();
        tSnap.docs.forEach(d => {
          const tData = d.data();
          if (tData.status !== 'DELETED') {
            tenantMap.set(d.id, { id: d.id, ...tData });
          }
        });
      }
    }

    let tenants = Array.from(tenantMap.values());

    // Pre-fetch rooms to join
    const roomIds = Array.from(new Set(tenants.map(t => t.room_id).filter(Boolean)));
    let roomsMap: Record<string, any> = {};
    if (roomIds.length > 0) {
      for (let i = 0; i < roomIds.length; i += 10) {
        const chunk = roomIds.slice(i, i + 10);
        const rSnap = await adminDb.collection('rooms').where('room_id', 'in', chunk).get();
        rSnap.docs.forEach(d => {
          const rData = d.data();
          roomsMap[d.id] = rData;
          if (rData.room_id) roomsMap[rData.room_id] = rData;
        });
      }
    }
    
    // Map pg name and room number into data & normalize face picture fields
    const enrichedData = tenants.map(t => {
      const roomObj = roomsMap[t.room_id] || {};
      const facePic = t.face_picture || t.facePicture || t.photo_url || t.photoUrl || t.avatar || t.documents?.photo || t.documents?.facePicture || t.documents?.photo_url || null;
      return {
        ...t,
        id: t.id || t.tenant_id,
        tenant_id: t.tenant_id || t.id,
        name: t.full_name || t.name || 'Tenant',
        full_name: t.full_name || t.name || 'Tenant',
        phone: t.mobile || t.phone || t.phone_number || '',
        room: t.room_number || t.room || roomObj.room_number || 'N/A',
        face_picture: facePic,
        facePicture: facePic,
        pg_name: props.find((p: any) => p.pg_id === t.pg_id || p.id === t.pg_id)?.name || 'Hostel',
        rooms: roomObj
      };
    });

    return { success: true, data: enrichedData };
  } catch (err: any) {
    console.error('getTenants Catch Error:', err, err.stack);
    return { success: false, error: err.message };
  }
}

export async function addNotice(ownerId: string, message: string, selectedPgId: string | null = null) {
  try {
    const propsSnap = await adminDb.collection('properties').where('owner_id', '==', ownerId).get();
    if (propsSnap.empty) throw new Error("No PG Hostels found.");
    
    let pgId = propsSnap.docs[0].data().pg_id;
    if (selectedPgId) {
       const matched = propsSnap.docs.find(d => d.data().pg_id === selectedPgId);
       if (matched) pgId = matched.data().pg_id;
    }

    const noticeRef = adminDb.collection('notices').doc();
    const noticeData = {
      notice_id: noticeRef.id,
      pg_id: pgId,
      message: message,
      created_at: new Date().toISOString()
    };
    await noticeRef.set(noticeData);

    revalidatePath('/pgowner/notices');
    return { success: true, data: [noticeData] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getNotices(ownerId: string, selectedPgId: string | null = null) {
  try {
    const propsSnap = await adminDb.collection('properties').where('owner_id', '==', ownerId).get();
    if (propsSnap.empty) return { success: true, data: [] };
    
    let pgId = propsSnap.docs[0].data().pg_id;
    if (selectedPgId) {
       const matched = propsSnap.docs.find(d => d.data().pg_id === selectedPgId);
       if (matched) pgId = matched.data().pg_id;
    }

    const noticesSnap = await adminDb.collection('notices')
      .where('pg_id', '==', pgId)
      .get();

    const data = noticesSnap.docs.map(doc => doc.data());
    data.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getDashboardStats(ownerId: string, selectedPgIds: string[] | null) {
  try {
    const allPropsSnap = await adminDb.collection('properties').where('owner_id', '==', ownerId).get();
    if (allPropsSnap.empty) return { success: true, data: null };
    
    const allProperties = allPropsSnap.docs.map((doc:any) => doc.data());
    
    let propertiesToUse = allProperties;
    if (selectedPgIds && selectedPgIds.length > 0) {
      propertiesToUse = allProperties.filter((p:any) => selectedPgIds.includes(p.pg_id));
    } else if (allProperties.length > 0) {
      propertiesToUse = [allProperties[0]];
    }

    const pgIds = propertiesToUse.map((p:any) => p.pg_id);
    
    let dashboardTitle = 'Overview of all your managed hostels';
    if (propertiesToUse.length > 0) {
      if (propertiesToUse.length === 1) {
         dashboardTitle = `${propertiesToUse[0].name} (Hostel ID: ${propertiesToUse[0].pg_id.split('-')[0]})`;
      } else {
         dashboardTitle = `Overview of ${propertiesToUse.length} selected hostels`;
      }
    }

    let rooms: any[] = [];
    if (pgIds.length <= 10) {
      const roomsSnap = await adminDb.collection('rooms').where('pg_id', 'in', pgIds).get();
      rooms = roomsSnap.docs.map((doc:any) => doc.data());
    } else {
      for (const id of pgIds) {
        const rSnap = await adminDb.collection('rooms').where('pg_id', '==', id).get();
        rooms.push(...rSnap.docs.map((d:any) => d.data()));
      }
    }

    let tenants: any[] = [];
    if (pgIds.length <= 10) {
      const tenantsSnap = await adminDb.collection('tenants').where('pg_id', 'in', pgIds).get();
      tenants = tenantsSnap.docs.map((doc:any) => doc.data());
    } else {
      for (const id of pgIds) {
        const tSnap = await adminDb.collection('tenants').where('pg_id', '==', id).get();
        tenants.push(...tSnap.docs.map((d:any) => d.data()));
      }
    }

    let payments: any[] = [];
    if (pgIds.length <= 10) {
      const paySnap = await adminDb.collection('payments').where('pg_id', 'in', pgIds).get();
      payments = paySnap.docs.map((doc:any) => doc.data());
    } else {
      for (const id of pgIds) {
        const pSnap = await adminDb.collection('payments').where('pg_id', '==', id).get();
        payments.push(...pSnap.docs.map((d:any) => d.data()));
      }
    }

    const activeTenantsList = tenants.filter((t:any) => t.is_active !== false);
    
    let totalBeds = 0;
    let occupiedBeds = activeTenantsList.length;
    let availableRoomsCount = 0;
    const floorMap: Record<string, any[]> = {};

    rooms.forEach((room:any) => {
      totalBeds += room.total_beds;
      const tenantsInRoom = activeTenantsList.filter(t => t.room_id === room.room_id).length;
      
      let status = 'available';
      if (tenantsInRoom >= room.total_beds) status = 'occupied';
      else if (tenantsInRoom > 0) status = 'partial';
      
      if (status === 'available') availableRoomsCount++;

      if (!floorMap[room.floor]) floorMap[room.floor] = [];
      floorMap[room.floor].push({
        num: room.room_number,
        roomId: room.room_id,
        status,
        beds: room.total_beds,
        occ: tenantsInRoom,
        extraFee: room.extra_fee || 0,
        tenants: activeTenantsList
          .filter(t => t.room_id === room.room_id)
          .map(t => ({
            id: t.tenant_id,
            name: t.full_name || 'Unknown',
            fee: t.fee || t.rent_amount || 0,
            extraFee: t.extra_fee || 0,
            securityDeposit: t.security_deposit || 0
          }))
      });
    });

    const formattedRoomData = Object.keys(floorMap).map(floor => ({
      floor,
      rooms: floorMap[floor].sort((a, b) => String(a.num).localeCompare(String(b.num)))
    })).sort((a, b) => {
      const numA = parseInt(a.floor.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.floor.replace(/\D/g, '')) || 0;
      return numA - numB;
    });

    let collected = 0;
    let overdue = 0;
    let overdueCount = 0;

    payments.forEach((p:any) => {
      if (p.status === 'paid') collected += p.amount;
      else if (p.status === 'pending' || p.status === 'overdue') {
        overdue += p.amount;
        overdueCount++;
      }
    });

    const kpi = {
      collected,
      overdue,
      overdueCount,
      bedsAvailable: totalBeds - occupiedBeds,
      totalBeds,
      availableRooms: availableRoomsCount
    };

    return { success: true, data: { dashboardTitle, kpi, formattedRoomData, payments, properties: allProperties, tenants } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function recordPayment(ownerId: string, tenantId: string, pgId: string, amount: number, method: string) {
  try {
    const payment = {
      tenant_id: tenantId,
      pg_id: pgId,
      amount: amount,
      status: 'paid',
      method: method,
      created_at: new Date().toISOString()
    };
    await adminDb.collection('payments').add(payment);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getTenantById(tenantId: string) {
  try {
    let tenant: any = null;
    const tenantSnap = await adminDb.collection('tenants').doc(tenantId).get();
    if (tenantSnap.exists) {
      tenant = tenantSnap.data();
    } else {
      // Fallback: search by tenant_id field
      const querySnap = await adminDb.collection('tenants').where('tenant_id', '==', tenantId).limit(1).get();
      if (!querySnap.empty) {
        tenant = querySnap.docs[0].data();
      } else {
        return { success: false, error: 'Tenant not found' };
      }
    }
    
    let room = { room_number: 'N/A' };
    if (tenant?.room_id && typeof tenant.room_id === 'string' && tenant.room_id.trim() !== '') {
      try {
        const roomSnap = await adminDb.collection('rooms').doc(tenant.room_id).get();
        if (roomSnap.exists) room = roomSnap.data() as any;
      } catch (e) {
        console.error('Error fetching room:', e);
      }
    }

    let pg_name = 'Unknown';
    if (tenant?.pg_id && typeof tenant.pg_id === 'string' && tenant.pg_id.trim() !== '') {
      try {
        const pgSnap = await adminDb.collection('properties').doc(tenant.pg_id).get();
        if (pgSnap.exists) pg_name = pgSnap.data()?.name || 'Unknown';
      } catch (e) {
        console.error('Error fetching property:', e);
      }
    }

    console.log('getTenantById returning success:', tenant.full_name);
    return { success: true, data: { ...tenant, room, pg_name } };
  } catch (err: any) {
    console.error('getTenantById Error:', err);
    return { success: false, error: err.message };
  }
}


export async function updateRoomDetails(roomId: string, totalBeds: number, extraFee: number, extraChargesArray?: any[]) {
  try {
    const roomRef = adminDb.collection('rooms').doc(roomId);
    const roomSnap = await roomRef.get();
    
    let difference = 0;
    if (roomSnap.exists) {
      const roomData = roomSnap.data() || {};
      const oldExtraFee = roomData.extra_fee || 0;
      difference = extraFee - oldExtraFee;
    }

    const updatePayload: any = {
      total_beds: totalBeds,
      extra_fee: extraFee
    };

    if (extraChargesArray) {
      updatePayload.extra_charges = extraChargesArray;
    }

    await roomRef.update(updatePayload);

    if (difference !== 0) {
      // Find tenants in this room
      const tenantsSnap = await adminDb.collection('tenants')
        .where('room_id', '==', roomId)
        .where('is_active', '==', true)
        .get();

      if (!tenantsSnap.empty) {
        const tenantIds = tenantsSnap.docs.map(doc => doc.id);
        
        // Find pending payments for these tenants
        const pendingSnap = await adminDb.collection('payments')
          .where('tenant_id', 'in', tenantIds)
          .where('status', '==', 'pending')
          .get();

        if (!pendingSnap.empty) {
          const batch = adminDb.batch();
          pendingSnap.docs.forEach(doc => {
            const pData = doc.data();
            // Do not apply extra room fee to opening balances
            if (pData.type !== 'opening-fee') {
              const newAmount = Math.max(0, (pData.amount || 0) + difference);
              batch.update(doc.ref, { amount: newAmount });
            }
          });
          await batch.commit();
        }
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function addTenantConstantFee(tenantId: string, extraFee: number) {
  try {
    const tenantRef = adminDb.collection('tenants').doc(tenantId);
    const tenantSnap = await tenantRef.get();
    
    let difference = 0;
    if (tenantSnap.exists) {
      const oldExtraFee = tenantSnap.data()?.extra_fee || 0;
      difference = extraFee - oldExtraFee;
    }

    await tenantRef.update({
      extra_fee: extraFee
    });

    if (difference !== 0) {
      const pendingSnap = await adminDb.collection('payments')
        .where('tenant_id', '==', tenantId)
        .where('status', '==', 'pending')
        .get();

      if (!pendingSnap.empty) {
        const batch = adminDb.batch();
        pendingSnap.docs.forEach(doc => {
          const pData = doc.data();
          if (pData.type !== 'opening-fee') {
            const newAmount = Math.max(0, (pData.amount || 0) + difference);
            batch.update(doc.ref, { amount: newAmount });
          }
        });
        await batch.commit();
      }
    }

    revalidatePath('/pgowner/rooms');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function addTenantOneTimeCharge(pgId: string, tenantId: string, amount: number, description: string) {
  try {
    const paymentRef = adminDb.collection('payments').doc();
    await paymentRef.set({
      payment_id: paymentRef.id,
      pg_id: pgId,
      tenant_id: tenantId,
      amount: amount,
      status: 'pending',
      month: new Date().toLocaleString('default', { month: 'long' }),
      description: description,
      type: 'one-time',
      created_at: new Date().toISOString()
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getPendingDues(ownerId: string, pgId?: string | null) {
  try {
    const { ownerId: effectiveOwnerId } = await resolveEffectiveOwnerId(ownerId);
    const propsSnap = await adminDb.collection('properties')
      .where('owner_id', '==', effectiveOwnerId)
      .get();
      
    if (propsSnap.empty) return { success: true, data: [] };
      
    let pgIds = propsSnap.docs
      .map(doc => doc.data())
      .filter(p => p.owner_id === effectiveOwnerId && p.is_active !== false && p.status !== 'INACTIVE' && p.status !== 'DELETED')
      .map(p => p.pg_id || p.id);

    if (pgId) {
      pgIds = pgIds.filter(id => id === pgId);
    }
    
    if (pgIds.length === 0) return { success: true, data: [] };

    let payments: any[] = [];
    if (pgIds.length <= 10) {
      const paySnap = await adminDb.collection('payments')
        .where('pg_id', 'in', pgIds)
        .where('status', '==', 'pending')
        .get();
      payments = paySnap.docs.map(doc => doc.data());
    } else {
      for (const id of pgIds) {
        const pSnap = await adminDb.collection('payments')
          .where('pg_id', '==', id)
          .where('status', '==', 'pending')
          .get();
        payments.push(...pSnap.docs.map(d => d.data()));
      }
    }

    let tenants: any[] = [];
    if (pgIds.length <= 10) {
      const tenantsSnap = await adminDb.collection('tenants').where('pg_id', 'in', pgIds).get();
      tenants = tenantsSnap.docs.map(doc => doc.data());
    } else {
      for (const id of pgIds) {
        const tSnap = await adminDb.collection('tenants').where('pg_id', '==', id).get();
        tenants.push(...tSnap.docs.map(d => d.data()));
      }
    }

    const roomsSnap = await adminDb.collection('rooms').where('pg_id', 'in', pgIds).get();
    const rooms = roomsSnap.docs.map(doc => doc.data());

    const enrichedPayments = payments.map(p => {
      const tenant = tenants.find(t => (t.tenant_id || t.id) === p.tenant_id) || {};
      const room = rooms.find(r => (r.room_id || r.id) === (tenant.room_id || p.room_id)) || {};
      const origPaise = parseMoneyToPaise(p.original_amount !== undefined ? p.original_amount : p.amount);
      const paidPaise = parseMoneyToPaise(p.amount_paid || 0);
      const remPaise = p.pending_balance_paise !== undefined 
        ? parseMoneyToPaise(p.pending_balance_paise)
        : p.pending_balance !== undefined 
          ? parseMoneyToPaise(p.pending_balance) 
          : Math.max(0, origPaise - paidPaise);

      return {
        ...p,
        amount: paiseToRupees(remPaise),
        amount_paise: remPaise,
        original_amount: paiseToRupees(origPaise),
        original_amount_paise: origPaise,
        amount_paid: paiseToRupees(paidPaise),
        amount_paid_paise: paidPaise,
        pending_balance: paiseToRupees(remPaise),
        pending_balance_paise: remPaise,
        tenant_name: tenant.full_name || tenant.name || 'Tenant',
        tenant_phone: tenant.mobile || tenant.phone || '',
        room_number: room.room_number || tenant.room_number || 'N/A',
        move_in_date: tenant.move_in_date || ''
      };
    });

    return { success: true, data: enrichedPayments };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function collectFIFOPayment(
  tenantId: string, 
  totalAmount: number | string, 
  method: string, 
  pgId: string, 
  selectedPaymentIds?: string[], 
  collectorUid?: string, 
  collectedByRole?: string, 
  discountAmount: number = 0,
  idempotencyKey?: string
) {
  try {
    const amountPaise = parseMoneyToPaise(totalAmount);
    if (amountPaise <= 0) {
      return { success: false, error: 'Payment amount must be greater than zero.' };
    }

    const idempotencyId = idempotencyKey || `idemp_${tenantId}_${amountPaise}_${Date.now()}`;
    const idempRef = adminDb.collection('idempotency_keys').doc(idempotencyId);

    // Check idempotency cache first
    const idempDoc = await idempRef.get();
    if (idempDoc.exists) {
      const idempData = idempDoc.data();
      if (idempData?.status === 'completed') {
        return { success: true, message: 'Payment already processed (idempotent)', paymentId: idempData.paymentId };
      }
    }

    // Resolve tenant details & collector
    const tenantDoc = await adminDb.collection('tenants').doc(tenantId).get();
    if (!tenantDoc.exists) {
      return { success: false, error: 'Tenant record not found.' };
    }
    const tenantData = tenantDoc.data() as any;

    let snapshotTenantName = tenantData?.full_name || tenantData?.name || 'Tenant';
    let snapshotRoomNum = tenantData?.room_number || tenantData?.room || 'N/A';
    let snapshotPgName = tenantData?.pg_name || tenantData?.hostel || 'A1 Hostels';

    if ((!snapshotRoomNum || snapshotRoomNum === 'N/A') && tenantData?.room_id) {
      const rDoc = await adminDb.collection('rooms').doc(tenantData.room_id).get();
      if (rDoc.exists) snapshotRoomNum = rDoc.data()?.room_number || snapshotRoomNum;
    }

    let targetOwnerId = tenantData?.owner_id || '';
    const effectivePgId = pgId || tenantData?.pg_id || '';
    if (effectivePgId) {
      const pDoc = await adminDb.collection('properties').doc(effectivePgId).get();
      if (pDoc.exists) {
        const pData = pDoc.data();
        if (!snapshotPgName || snapshotPgName === 'A1 Hostels') snapshotPgName = pData?.name || snapshotPgName;
        if (!targetOwnerId) targetOwnerId = pData?.owner_id || '';
      }
    }

    // Resolve Collector
    let collectorName = 'PG Staff';
    let collectorRole = collectedByRole || 'Staff';
    if (collectorUid) {
      try {
        const [profSnap, memberSnap] = await Promise.all([
          adminDb.collection('user_profiles').doc(collectorUid).get().catch(() => null),
          adminDb.collection('team_members').where('auth_uid', '==', collectorUid).get().catch(() => null)
        ]);
        if (profSnap && profSnap.exists) {
          const p = profSnap.data();
          collectorName = p?.full_name || p?.name || p?.displayName || collectorName;
          collectorRole = p?.role || collectorRole;
        } else if (memberSnap && !memberSnap.empty) {
          const m = memberSnap.docs[0].data();
          collectorName = m?.full_name || m?.name || collectorName;
          collectorRole = m?.role || m?.role_title || collectorRole;
        }
      } catch (e) {
        console.warn('Collector name lookup failed', e);
      }
    }

    // Atomic Database Transaction for Ledger Consistency
    const newPaymentDocRef = adminDb.collection('payments').doc();
    const auditLogDocRef = adminDb.collection('financial_audit_logs').doc();

    const transactionResult = await adminDb.runTransaction(async (t) => {
      // 1. Read ALL charges (pending, overdue, settled) for this tenant inside transaction to compute correct outstanding
      const chargesQuery = adminDb.collection('payments')
        .where('tenant_id', '==', tenantId)
        .where('status', 'in', ['pending', 'overdue', 'settled']);
      
      const chargesSnap = await t.get(chargesQuery);
      
      const allCharges = chargesSnap.docs.map(d => ({
        id: d.id,
        payment_id: d.id,
        ref: d.ref,
        ...(d.data() as any)
      }));

      // 2. Fetch all paid payments for tenant to compute pre-transaction financial state
      const paidQuery = adminDb.collection('payments')
        .where('tenant_id', '==', tenantId)
        .where('status', '==', 'paid');
      const paidSnap = await t.get(paidQuery);
      const rawPaid = paidSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Compute the TRUE global outstanding balance before this payment
      const beforeState = calculateTenantFinancialState(tenantData, allCharges, rawPaid);

      // Filter charges to be allocated (only pending/overdue)
      const eligibleCharges = allCharges.filter(c => c.status === 'pending' || c.status === 'overdue');

      // 3. Allocate payment strictly in integer paise
      const allocationResult = allocatePayment({
        tenantId,
        paymentAmountPaise: amountPaise,
        pendingCharges: eligibleCharges,
        selectedChargeIds: selectedPaymentIds
      });

      // Strict Validation: If specific charges are selected, overpayment is not allowed
      const hasSpecificSelection = Array.isArray(selectedPaymentIds) && selectedPaymentIds.length > 0;
      if (hasSpecificSelection && allocationResult.unallocatedAmountPaise > 0) {
        throw new Error('Payment amount exceeds the outstanding balance of the selected charges.');
      }

      // 4. Update each charge and write payment allocations in transaction
      for (const alloc of allocationResult.allocations) {
        const chargeDoc = eligibleCharges.find(c => c.id === alloc.chargeId);
        if (!chargeDoc) continue;

        const originalPaise = parseMoneyToPaise(chargeDoc.original_amount !== undefined ? chargeDoc.original_amount : chargeDoc.amount);
        const currentPaidPaise = parseMoneyToPaise(chargeDoc.amount_paid_paise !== undefined ? chargeDoc.amount_paid_paise : (chargeDoc.amount_paid || 0));
        const newPaidPaise = currentPaidPaise + alloc.allocatedAmountPaise;
        const newRemainingPaise = alloc.remainingPaise;

        const isFullyPaid = newRemainingPaise === 0;

        // Update charge doc
        t.update(chargeDoc.ref, {
          status: isFullyPaid ? 'settled' : 'pending',
          is_settled: isFullyPaid,
          amount: paiseToRupees(newRemainingPaise),
          amount_paid: paiseToRupees(newPaidPaise),
          amount_paise: newRemainingPaise,
          amount_paid_paise: newPaidPaise,
          original_amount: paiseToRupees(originalPaise),
          original_amount_paise: originalPaise,
          pending_balance: paiseToRupees(newRemainingPaise),
          pending_balance_paise: newRemainingPaise,
          last_payment_date: new Date().toISOString(),
          last_payment_id: newPaymentDocRef.id,
          collected_by: collectorName,
          collected_by_name: collectorName,
          collected_by_role: collectorRole,
          collected_by_uid: collectorUid || ''
        });

        // Write to payment_allocations collection
        const newAllocRef = adminDb.collection('payment_allocations').doc();
        t.set(newAllocRef, {
          allocation_id: newAllocRef.id,
          payment_id: newPaymentDocRef.id,
          charge_id: alloc.chargeId,
          tenant_id: tenantId,
          pg_id: effectivePgId,
          amount_paise: alloc.allocatedAmountPaise,
          created_at: new Date().toISOString()
        });
      }

      // 5. Create immutable Payment Receipt Document
      const paymentDate = new Date().toISOString();
      const amountRupees = paiseToRupees(amountPaise);
      const afterOutstandingPaise = allocationResult.remainingTenantDuePaise;

      t.set(newPaymentDocRef, {
        payment_id: newPaymentDocRef.id,
        idempotency_key: idempotencyId,
        tenant_id: tenantId,
        pg_id: effectivePgId,
        owner_id: targetOwnerId,
        amount: amountRupees,
        amount_paid: amountRupees,
        amount_paise: amountPaise,
        original_amount: amountRupees,
        status: 'paid',
        is_payment_receipt: true,
        payment_method: method || 'UPI',
        payment_date: paymentDate,
        created_at: paymentDate,
        month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
        description: `Payment of ${formatPaiseToINR(amountPaise)} (${method || 'UPI'})`,
        type: 'monthly_rent',
        allocated_charges: allocationResult.allocations.map(a => {
          const ch = eligibleCharges.find(c => c.id === a.chargeId);
          return {
            chargeId: a.chargeId,
            amountPaise: a.allocatedAmountPaise,
            description: ch?.description || 'Rent',
            type: ch?.type || 'monthly_rent'
          };
        }),
        advance_paise: allocationResult.unallocatedAmountPaise,
        collected_by: collectorName,
        collected_by_name: collectorName,
        collected_by_role: collectorRole,
        collected_by_uid: collectorUid || '',
        tenant_name: snapshotTenantName,
        room_number: snapshotRoomNum,
        pg_name: snapshotPgName,
        pending_balance: paiseToRupees(afterOutstandingPaise),
        pending_balance_paise: afterOutstandingPaise
      });

      // 6. Write Financial Audit Log
      t.set(auditLogDocRef, {
        log_id: auditLogDocRef.id,
        tenant_id: tenantId,
        pg_id: effectivePgId,
        owner_id: targetOwnerId,
        action: 'PAYMENT_COLLECTED',
        payment_id: newPaymentDocRef.id,
        idempotency_key: idempotencyId,
        amount_paise: amountPaise,
        amount_rupees: amountRupees,
        before_outstanding_paise: beforeState.outstandingPaise,
        after_outstanding_paise: afterOutstandingPaise,
        payment_method: method || 'UPI',
        performed_by_name: collectorName,
        performed_by_uid: collectorUid || '',
        timestamp: paymentDate
      });

      // 7. Store Idempotency Key
      t.set(idempRef, {
        idempotencyKey: idempotencyId,
        paymentId: newPaymentDocRef.id,
        tenantId,
        amountPaise,
        status: 'completed',
        timestamp: paymentDate,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });

      return {
        paymentId: newPaymentDocRef.id,
        amountRupees,
        amountPaise,
        afterOutstandingPaise
      };
    });

    // Send real-time notification
    if (targetOwnerId && amountPaise > 0) {
      try {
        await adminDb.collection('notifications').add({
          owner_id: targetOwnerId,
          pg_id: effectivePgId,
          type: 'payment',
          title: `[${snapshotPgName}] Fee Collected: ${formatPaiseToINR(amountPaise)}`,
          message: `${collectorName} collected ${formatPaiseToINR(amountPaise)} from ${snapshotTenantName} (${snapshotRoomNum ? 'Room ' + snapshotRoomNum : 'Rent'}) via ${method || 'UPI'}.`,
          amount: paiseToRupees(amountPaise),
          amount_paise: amountPaise,
          tenant_id: tenantId,
          tenant_name: snapshotTenantName,
          room_number: snapshotRoomNum,
          collected_by_name: collectorName,
          collected_by_role: collectorRole,
          created_at: new Date().toISOString(),
          read: false
        });
      } catch (nErr) {
        console.warn('Owner notification trigger error:', nErr);
      }
    }

    revalidatePath('/pgowner/dues');
    revalidatePath('/pgowner/history');
    revalidatePath('/pgowner/dashboard');
    return { success: true, data: transactionResult };
  } catch (err: any) {
    console.error('Error in collectFIFOPayment:', err);
    return { success: false, error: err.message || 'Payment collection failed.' };
  }
}

export async function reversePayment(paymentId: string, reason: string = 'Payment reversal', reversedByUid?: string) {
  try {
    const paymentRef = adminDb.collection('payments').doc(paymentId);
    const paymentDoc = await paymentRef.get();
    if (!paymentDoc.exists) {
      return { success: false, error: 'Payment transaction not found.' };
    }

    const paymentData = paymentDoc.data() as any;
    if (paymentData.status === 'reversed') {
      return { success: false, error: 'This payment has already been reversed.' };
    }

    const reversedAt = new Date().toISOString();
    const amountPaise = parseMoneyToPaise(paymentData.amount_paid !== undefined ? paymentData.amount_paid : paymentData.amount);

    // Resolve performer
    let reversedByName = 'PG Owner';
    if (reversedByUid) {
      const profDoc = await adminDb.collection('user_profiles').doc(reversedByUid).get().catch(() => null);
      if (profDoc?.exists) {
        reversedByName = profDoc.data()?.full_name || profDoc.data()?.name || reversedByName;
      }
    }

    const auditRef = adminDb.collection('financial_audit_logs').doc();

    await adminDb.runTransaction(async (t) => {
      // 1. Mark payment as reversed
      t.update(paymentRef, {
        status: 'reversed',
        is_reversed: true,
        reversal_info: {
          reversedAt,
          reversedBy: reversedByName,
          reversedByUid: reversedByUid || '',
          reason
        },
        updated_at: reversedAt
      });

      // 2. If payment had allocated charges, restore remaining balance on those charges
      if (Array.isArray(paymentData.allocated_charges)) {
        for (const alloc of paymentData.allocated_charges) {
          if (!alloc.chargeId) continue;
          const chargeRef = adminDb.collection('payments').doc(alloc.chargeId);
          const cDoc = await t.get(chargeRef);
          if (cDoc.exists) {
            const cData = cDoc.data() as any;
            const currentPaidPaise = parseMoneyToPaise(cData.amount_paid || 0);
            const restoredPaidPaise = Math.max(0, currentPaidPaise - alloc.amountPaise);
            const originalPaise = parseMoneyToPaise(cData.original_amount !== undefined ? cData.original_amount : cData.amount);
            const newRemainingPaise = Math.max(0, originalPaise - restoredPaidPaise);

            t.update(chargeRef, {
              status: newRemainingPaise > 0 ? 'pending' : 'settled',
              is_settled: newRemainingPaise === 0,
              amount: paiseToRupees(newRemainingPaise),
              amount_paid: paiseToRupees(restoredPaidPaise),
              amount_paise: newRemainingPaise,
              amount_paid_paise: restoredPaidPaise,
              pending_balance: paiseToRupees(newRemainingPaise),
              pending_balance_paise: newRemainingPaise,
              updated_at: reversedAt
            });
          }
        }
      }

      // 3. Write Audit Log
      t.set(auditRef, {
        log_id: auditRef.id,
        tenant_id: paymentData.tenant_id,
        pg_id: paymentData.pg_id,
        owner_id: paymentData.owner_id,
        action: 'PAYMENT_REVERSED',
        payment_id: paymentId,
        amount_paise: amountPaise,
        amount_rupees: paiseToRupees(amountPaise),
        reason,
        performed_by_name: reversedByName,
        performed_by_uid: reversedByUid || '',
        timestamp: reversedAt
      });
    });

    revalidatePath('/pgowner/dues');
    revalidatePath('/pgowner/history');
    revalidatePath('/pgowner/dashboard');
    return { success: true, message: 'Payment successfully reversed and balance restored.' };
  } catch (err: any) {
    console.error('Error in reversePayment:', err);
    return { success: false, error: err.message || 'Failed to reverse payment.' };
  }
}

export async function collectUpcomingPayment(tenantId: string, amount: number, amountPaid: number, method: string, month: string, pgId: string) {
  try {
    const isPartial = amountPaid < amount;
    
    // Create the paid record
    const paidRef = adminDb.collection('payments').doc();
    await paidRef.set({
      payment_id: paidRef.id,
      pg_id: pgId,
      tenant_id: tenantId,
      amount: isPartial ? amountPaid : amount,
      amount_paid: amountPaid,
      original_amount: amount,
      status: 'paid',
      month: month,
      payment_method: method,
      payment_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      is_partial: isPartial
    });
    
    // If partial, create the pending remainder
    if (isPartial) {
      const pendingRef = adminDb.collection('payments').doc();
      await pendingRef.set({
        payment_id: pendingRef.id,
        pg_id: pgId,
        tenant_id: tenantId,
        amount: amount - amountPaid,
        status: 'pending',
        month: month,
        created_at: new Date().toISOString(),
        is_partially_paid: true
      });
    }
    
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function markPaymentPaid(paymentId: string, method: string) {
  try {
    const paymentRef = adminDb.collection('payments').doc(paymentId);
    const doc = await paymentRef.get();
    if (!doc.exists) {
      return { success: false, error: 'Payment not found' };
    }
    
    const paymentData = doc.data() as any;
    
    await paymentRef.update({
      status: 'paid',
      payment_method: method,
      amount_paid: paymentData.amount || 0,
      payment_date: new Date().toISOString()
    });
    
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function recordPartialPayment(paymentId: string, amountPaid: number, method: string) {
  try {
    const paymentRef = adminDb.collection('payments').doc(paymentId);
    const doc = await paymentRef.get();
    if (!doc.exists) {
      return { success: false, error: 'Payment not found' };
    }
    
    const paymentData = doc.data() as any;
    const remainingAmount = Math.max(0, (paymentData.amount || 0) - amountPaid);
    
    // Update the pending due to reflect the new remaining amount
    await paymentRef.update({
      amount: remainingAmount,
      is_partially_paid: true
    });
    
    // Create a new payment record for the history
    const newReceiptRef = adminDb.collection('payments').doc();
    await newReceiptRef.set({
      ...paymentData,
      payment_id: newReceiptRef.id,
      amount: amountPaid,
      amount_paid: amountPaid,
      original_amount: paymentData.amount,
      pending_balance: remainingAmount,
      status: 'paid',
      payment_method: method,
      payment_date: new Date().toISOString(),
      is_partial: true
    });
    
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getPaymentHistory(uid: string, activePgId: string | null = null) {
  try {
    const { ownerId: effectiveOwnerId } = await resolveEffectiveOwnerId(uid);
    let pgIds: string[] = [];
    let propertiesData: any[] = [];

    const propsSnap = await adminDb.collection('properties')
      .where('owner_id', '==', effectiveOwnerId)
      .get();
    
    if (propsSnap.empty) return { success: true, data: [] };

    propertiesData = propsSnap.docs
      .map(doc => doc.data())
      .filter(p => p.owner_id === effectiveOwnerId && p.is_active !== false && p.status !== 'INACTIVE' && p.status !== 'DELETED');
    
    pgIds = propertiesData.map(p => p.pg_id || p.id);

    if (activePgId) {
      pgIds = pgIds.filter(id => id === activePgId);
    }

    if (pgIds.length === 0) return { success: true, data: [] };

    let payments: any[] = [];
    if (pgIds.length <= 10) {
      const paySnap = await adminDb.collection('payments')
        .where('pg_id', 'in', pgIds)
        .where('status', '==', 'paid')
        .get();
      payments = paySnap.docs.map(doc => doc.data());
    } else {
      for (const id of pgIds) {
        const pSnap = await adminDb.collection('payments')
          .where('pg_id', '==', id)
          .where('status', '==', 'paid')
          .get();
        payments.push(...pSnap.docs.map(d => d.data()));
      }
    }

    // Get tenants and rooms to enrich data
    let tenants: any[] = [];
    if (pgIds.length <= 10) {
      const tenantsSnap = await adminDb.collection('tenants').where('pg_id', 'in', pgIds).get();
      tenants = tenantsSnap.docs.map(doc => doc.data());
    } else {
      for (const id of pgIds) {
        const tSnap = await adminDb.collection('tenants').where('pg_id', '==', id).get();
        tenants.push(...tSnap.docs.map(d => d.data()));
      }
    }

    const roomsSnap = await adminDb.collection('rooms').where('pg_id', 'in', pgIds).get();
    const rooms = roomsSnap.docs.map(doc => doc.data());

    const enrichedPayments = payments.map(p => {
      const tenant = tenants.find(t => (t.tenant_id || t.id) === p.tenant_id) || {};
      const room = rooms.find(r => (r.room_id || r.id) === (tenant.room_id || p.room_id)) || {};
      const property = propertiesData.find(prop => (prop.pg_id || prop.id) === p.pg_id) || {};
      const amtPaise = parseMoneyToPaise(p.amount_paid !== undefined ? p.amount_paid : p.amount);
      const origPaise = parseMoneyToPaise(p.original_amount !== undefined ? p.original_amount : p.amount);

      return {
        ...p,
        amount: paiseToRupees(amtPaise),
        amount_paid: paiseToRupees(amtPaise),
        amount_paise: amtPaise,
        original_amount: paiseToRupees(origPaise),
        original_amount_paise: origPaise,
        tenant_name: p.tenant_name || tenant.full_name || tenant.name || 'Tenant',
        room_number: p.room_number || room.room_number || tenant.room_number || tenant.room || 'N/A',
        pg_name: p.pg_name || property.name || tenant.pg_name || 'A1 Hostels'
      };
    });

    return { success: true, data: enrichedPayments };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateTenantStatus(tenantId: string, status: string, options?: { check_out_date?: string | null }) {
  try {
    const updateData: any = { status };
    if (status === 'vacated' || status === 'Vacated' || status === 'VACATED') {
      updateData.is_active = false;
      updateData.vacated_at = new Date().toISOString();
      if (!options?.check_out_date) {
        updateData.check_out_date = new Date().toISOString();
      }
    } else {
      updateData.is_active = true;
      updateData.vacated_at = null;
      updateData.check_out_date = null;
    }
    
    if (options && options.check_out_date !== undefined) {
      updateData.check_out_date = options.check_out_date;
    }

    await adminDb.collection('tenants').doc(tenantId).update(updateData);
    
    revalidatePath('/pgowner/tenants');
    revalidatePath(`/pgowner/tenants/${tenantId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getTenantPayments(tenantId: string) {
  try {
    const paySnap = await adminDb.collection('payments')
      .where('tenant_id', '==', tenantId)
      .where('status', '==', 'paid')
      .get();
      
    const payments = paySnap.docs.map(doc => doc.data());
    payments.sort((a, b) => {
      const dateA = new Date(a.payment_date || a.created_at || 0).getTime();
      const dateB = new Date(b.payment_date || b.created_at || 0).getTime();
      return dateB - dateA;
    });

    return { success: true, data: payments };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function pauseTenant(tenantId: string, options?: { 
  pauseType?: string; 
  pauseUntilDate?: string; 
  maintenanceFee?: number; 
  clearedPaymentIds?: string[];
}) {
  try {
    const tenantRef = adminDb.collection('tenants').doc(tenantId);
    const tenantSnap = await tenantRef.get();
    if (!tenantSnap.exists) {
      return { success: false, error: 'Tenant not found' };
    }
    const tenantData = tenantSnap.data() as any;

    const updateData: any = {
      status: 'PAUSED',
      paused_at: new Date().toISOString(),
      pause_type: options?.pauseType || 'indefinite',
      expected_resume_date: options?.pauseUntilDate || null,
      maintenance_fee_on_pause: Number(options?.maintenanceFee || 0),
      updated_at: new Date().toISOString()
    };

    await tenantRef.update(updateData);

    // If maintenance fee charged on pause
    const maintFee = Number(options?.maintenanceFee || 0);
    if (maintFee > 0) {
      const pendingRef = adminDb.collection('payments').doc();
      await pendingRef.set({
        payment_id: pendingRef.id,
        pg_id: tenantData.pg_id || '',
        tenant_id: tenantId,
        amount: maintFee,
        amount_paid: 0,
        type: 'maintenance',
        description: 'Maintenance Fee (Paused Stay)',
        status: 'pending',
        created_at: new Date().toISOString()
      });
    }

    // Clear any selected pending dues if requested
    if (Array.isArray(options?.clearedPaymentIds) && options.clearedPaymentIds.length > 0) {
      for (const payId of options.clearedPaymentIds) {
        if (!payId) continue;
        const pRef = adminDb.collection('payments').doc(payId);
        const pDoc = await pRef.get();
        if (pDoc.exists) {
          await pRef.update({
            status: 'paid',
            payment_date: new Date().toISOString(),
            payment_method: 'Paused Waiver'
          });
        }
      }
    }

    // Record in activity_logs
    const logRef = adminDb.collection('activity_logs').doc();
    await logRef.set({
      log_id: logRef.id,
      owner_id: tenantData.owner_id || tenantData.user_id || '',
      user_id: tenantData.owner_id || tenantData.user_id || '',
      tenant_id: tenantId,
      pg_id: tenantData.pg_id || '',
      event_type: 'STAY_PAUSED',
      title: 'Tenant Stay Paused',
      description: `Stay paused for ${tenantData.full_name || 'Resident'} (${options?.pauseType || 'indefinite'}). ${maintFee > 0 ? `Maintenance fee of ₹${maintFee} charged.` : 'No maintenance fee charged.'}`,
      details: `Stay paused for ${tenantData.full_name || 'Resident'} (${options?.pauseType || 'indefinite'}). ${maintFee > 0 ? `Maintenance fee of ₹${maintFee} charged.` : 'No maintenance fee charged.'}`,
      performed_by: 'Owner',
      created_at: new Date().toISOString(),
      timestamp: new Date().toISOString()
    });

    // Record in pause_history
    const pauseRef = adminDb.collection('pause_history').doc();
    await pauseRef.set({
      history_id: pauseRef.id,
      tenant_id: tenantId,
      pg_id: tenantData.pg_id || '',
      action: 'PAUSE',
      paused_at: new Date().toISOString(),
      pause_type: options?.pauseType || 'indefinite',
      maintenance_fee: maintFee,
      created_at: new Date().toISOString(),
      timestamp: new Date().toISOString()
    });

    try {
      revalidatePath('/pgowner/tenants');
      revalidatePath(`/pgowner/tenants/${tenantId}`);
      revalidatePath('/pgowner/dues');
    } catch (e) {
      // Ignore revalidatePath errors outside request context
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function resumeTenant(tenantId: string, options?: { 
  chargeMaintenanceFee?: number; 
  collectNow?: boolean; 
  paymentMethod?: string;
}) {
  try {
    const tenantRef = adminDb.collection('tenants').doc(tenantId);
    const tenantSnap = await tenantRef.get();
    if (!tenantSnap.exists) {
      return { success: false, error: 'Tenant not found' };
    }
    const tenantData = tenantSnap.data() as any;

    const updateData: any = {
      status: 'Active',
      is_active: true,
      resumed_at: new Date().toISOString(),
      pause_type: null,
      expected_resume_date: null,
      updated_at: new Date().toISOString()
    };

    await tenantRef.update(updateData);

    const maintFee = Number(options?.chargeMaintenanceFee || 0);
    if (maintFee > 0) {
      const payRef = adminDb.collection('payments').doc();
      if (options?.collectNow) {
        await payRef.set({
          payment_id: payRef.id,
          pg_id: tenantData.pg_id || '',
          tenant_id: tenantId,
          amount: maintFee,
          amount_paid: maintFee,
          type: 'maintenance',
          description: 'Maintenance Fee (Resumed Stay)',
          status: 'paid',
          payment_method: options.paymentMethod || 'UPI',
          payment_date: new Date().toISOString(),
          created_at: new Date().toISOString()
        });
      } else {
        await payRef.set({
          payment_id: payRef.id,
          pg_id: tenantData.pg_id || '',
          tenant_id: tenantId,
          amount: maintFee,
          amount_paid: 0,
          type: 'maintenance',
          description: 'Maintenance Fee (Resumed Stay)',
          status: 'pending',
          created_at: new Date().toISOString()
        });
      }
    }

    // Record in activity_logs
    const logRef = adminDb.collection('activity_logs').doc();
    await logRef.set({
      log_id: logRef.id,
      owner_id: tenantData.owner_id || tenantData.user_id || '',
      user_id: tenantData.owner_id || tenantData.user_id || '',
      tenant_id: tenantId,
      pg_id: tenantData.pg_id || '',
      event_type: 'STAY_RESUMED',
      title: 'Tenant Stay Resumed',
      description: `Stay resumed for ${tenantData.full_name || 'Resident'}. ${maintFee > 0 ? `Maintenance fee of ₹${maintFee} applied.` : 'Resumed without maintenance fee.'}`,
      details: `Stay resumed for ${tenantData.full_name || 'Resident'}. ${maintFee > 0 ? `Maintenance fee of ₹${maintFee} applied.` : 'Resumed without maintenance fee.'}`,
      performed_by: 'Owner',
      created_at: new Date().toISOString(),
      timestamp: new Date().toISOString()
    });

    // Record in pause_history
    const pauseRef = adminDb.collection('pause_history').doc();
    await pauseRef.set({
      history_id: pauseRef.id,
      tenant_id: tenantId,
      pg_id: tenantData.pg_id || '',
      action: 'RESUME',
      actual_resume_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      timestamp: new Date().toISOString()
    });

    try {
      revalidatePath('/pgowner/tenants');
      revalidatePath(`/pgowner/tenants/${tenantId}`);
      revalidatePath('/pgowner/dues');
    } catch (e) {
      // Ignore revalidatePath errors outside request context
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function cancelTenantPause(tenantId: string) {
  try {
    const tenantRef = adminDb.collection('tenants').doc(tenantId);
    const tenantSnap = await tenantRef.get();
    if (!tenantSnap.exists) {
      return { success: false, error: 'Tenant not found' };
    }
    const tenantData = tenantSnap.data() as any;

    const updateData: any = {
      status: 'Active',
      is_active: true,
      paused_at: null,
      pause_type: null,
      expected_resume_date: null,
      maintenance_fee_on_pause: 0,
      updated_at: new Date().toISOString()
    };

    await tenantRef.update(updateData);

    // Delete any pending maintenance fee created during pause for this tenant
    const maintSnap = await adminDb.collection('payments')
      .where('tenant_id', '==', tenantId)
      .where('type', '==', 'maintenance')
      .where('status', '==', 'pending')
      .get();

    if (!maintSnap.empty) {
      for (const doc of maintSnap.docs) {
        await doc.ref.delete();
      }
    }

    // If any payments were marked as 'Paused Waiver', revert them back to pending
    const waivedSnap = await adminDb.collection('payments')
      .where('tenant_id', '==', tenantId)
      .where('payment_method', '==', 'Paused Waiver')
      .get();

    if (!waivedSnap.empty) {
      for (const doc of waivedSnap.docs) {
        await doc.ref.update({
          status: 'pending',
          payment_method: null,
          payment_date: null
        });
      }
    }

    // Record in activity_logs
    const logRef = adminDb.collection('activity_logs').doc();
    await logRef.set({
      log_id: logRef.id,
      owner_id: tenantData.owner_id || tenantData.user_id || '',
      user_id: tenantData.owner_id || tenantData.user_id || '',
      tenant_id: tenantId,
      pg_id: tenantData.pg_id || '',
      event_type: 'PAUSE_CANCELLED',
      title: 'Tenant Pause Cancelled',
      description: `Pause trip for ${tenantData.full_name || 'Resident'} was cancelled by owner. Active status restored, maintenance fee removed, and original dues restored.`,
      details: `Pause trip for ${tenantData.full_name || 'Resident'} was cancelled by owner. Active status restored, maintenance fee removed, and original dues restored.`,
      performed_by: 'Owner',
      created_at: new Date().toISOString(),
      timestamp: new Date().toISOString()
    });

    // Record in pause_history
    const pauseRef = adminDb.collection('pause_history').doc();
    await pauseRef.set({
      history_id: pauseRef.id,
      tenant_id: tenantId,
      pg_id: tenantData.pg_id || '',
      action: 'CANCEL_PAUSE',
      created_at: new Date().toISOString(),
      timestamp: new Date().toISOString()
    });

    try {
      revalidatePath('/pgowner/tenants');
      revalidatePath(`/pgowner/tenants/${tenantId}`);
      revalidatePath('/pgowner/dues');
    } catch (e) {
      // Ignore outside request context
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getTenantDues(tenantId: string) {
  try {
    const duesSnap = await adminDb.collection('payments')
      .where('tenant_id', '==', tenantId)
      .where('status', '==', 'pending')
      .get();

    let dues = duesSnap.docs.map(doc => doc.data());

    if (dues.length === 0) {
      const tenantSnap = await adminDb.collection('tenants').doc(tenantId).get();
      if (tenantSnap.exists) {
        const t = tenantSnap.data() as any;
        if (t.is_active !== false && t.status !== 'vacated' && t.status !== 'PAUSED') {
          const paidSnap = await adminDb.collection('payments')
            .where('tenant_id', '==', tenantId)
            .where('status', '==', 'paid')
            .get();
          const paidPayments = paidSnap.docs.map(d => d.data());
          
          const statusInfo = getTenantPaymentStatus(t, [], paidPayments);
          if (statusInfo.status === 'OVERDUE' || statusInfo.status === 'CRITICAL' || statusInfo.status === 'DUE_TODAY') {
            const currentMonthName = new Date().toLocaleString('default', { month: 'long' });
            dues.push({
              payment_id: `due_${tenantId}`,
              tenant_id: tenantId,
              pg_id: t.pg_id || '',
              amount: statusInfo.virtualRentRemaining !== undefined ? statusInfo.virtualRentRemaining : (t.rent_amount || 0),
              month: statusInfo.virtualMonth || currentMonthName,
              status: 'pending',
              due_date: statusInfo.dueDate ? statusInfo.dueDate.toISOString() : new Date().toISOString(),
              created_at: new Date().toISOString(),
              is_virtual: true
            });
          }
        }
      }
    }

    dues.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

    return { success: true, data: dues };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getTenantPauseHistory(tenantId: string) {
  try {
    const histSnap = await adminDb.collection('pause_history')
      .where('tenant_id', '==', tenantId)
      .get();

    const history = histSnap.docs.map(doc => doc.data());
    history.sort((a, b) => new Date(b.created_at || b.timestamp || 0).getTime() - new Date(a.created_at || a.timestamp || 0).getTime());

    return { success: true, data: history };
  } catch (err: any) {
    return { success: true, data: [] };
  }
}

export async function getTenantActivityLogs(tenantId: string) {
  try {
    const logsSnap = await adminDb.collection('activity_logs')
      .where('tenant_id', '==', tenantId)
      .get();

    const logs = logsSnap.docs.map(doc => doc.data());
    logs.sort((a, b) => new Date(b.created_at || b.timestamp || 0).getTime() - new Date(a.created_at || a.timestamp || 0).getTime());

    return { success: true, data: logs };
  } catch (err: any) {
    return { success: true, data: [] };
  }
}

export async function getExpensesList(ownerId: string, pgId: string) {
  try {
    const expensesSnap = await adminDb.collection('expenses').where('pg_id', '==', pgId).get();
    const expenses = expensesSnap.docs.map(d => ({ 
      id: d.id, 
      expense_id: d.id, 
      ...d.data(),
      created_at: d.data().created_at || new Date().toISOString()
    }));
    expenses.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { success: true, data: expenses };
  } catch (e: any) {
    return { success: false, error: e.message || "Failed to fetch expenses list." };
  }
}

export async function addExpense(expenseData: {
  pg_id: string;
  category: string;
  date: string;
  amount: number;
  recorded_by: string;
  notes?: string;
  expense_id?: string;
}) {
  try {
    const { pg_id, category, date, amount, recorded_by, notes = '', expense_id } = expenseData;
    
    const record = {
      pg_id,
      category,
      date,
      amount: Number(amount),
      recorded_by,
      notes,
      created_at: new Date().toISOString()
    };

    let docRef;
    if (expense_id) {
      docRef = adminDb.collection('expenses').doc(expense_id);
      await docRef.set(record);
    } else {
      docRef = await adminDb.collection('expenses').add(record);
    }

    return { 
      success: true, 
      data: { 
        id: docRef.id, 
        expense_id: docRef.id, 
        ...record 
      } 
    };
  } catch (e: any) {
    return { success: false, error: e.message || "Failed to record expense." };
  }
}
