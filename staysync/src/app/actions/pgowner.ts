/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { adminDb } from '@/lib/firebase-admin';
import { revalidatePath } from 'next/cache';

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
    const snapshot = await adminDb.collection('properties')
      .where('owner_id', '==', ownerId)
      .get();
    
    let data = snapshot.docs.map(doc => doc.data());
    data.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    // Fetch real metrics for each property
    for (let i = 0; i < data.length; i++) {
      const pgId = data[i].pg_id;
      
      // Get tenants count
      const tenantsSnap = await adminDb.collection('tenants').where('pg_id', '==', pgId).where('status', '==', 'active').get();
      const tenantCount = tenantsSnap.size;
      
      // Get rooms count
      const roomsSnap = await adminDb.collection('rooms').where('pg_id', '==', pgId).get();
      const roomsCount = roomsSnap.size;
      
      // Calculate total capacity
      let totalCapacity = 0;
      roomsSnap.docs.forEach(d => {
        totalCapacity += (d.data().total_beds || 0);
      });
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
        calculatedPendingDues: pendingDues
      };
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

export async function deleteProperty(pgId: string) {
  try {
    // Delete payments
    const payments = await adminDb.collection('payments').where('pg_id', '==', pgId).get();
    const pBatch = adminDb.batch();
    payments.docs.forEach(doc => pBatch.delete(doc.ref));
    await pBatch.commit();

    // Delete tenants
    const tenants = await adminDb.collection('tenants').where('pg_id', '==', pgId).get();
    const tBatch = adminDb.batch();
    tenants.docs.forEach(doc => tBatch.delete(doc.ref));
    await tBatch.commit();

    // Delete rooms
    const rooms = await adminDb.collection('rooms').where('pg_id', '==', pgId).get();
    const rBatch = adminDb.batch();
    rooms.docs.forEach(doc => rBatch.delete(doc.ref));
    await rBatch.commit();

    // Delete property
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
    const propsSnap = await adminDb.collection('properties')
      .where('owner_id', '==', ownerId)
      .where('is_active', '==', true)
      .get();
      
    if (propsSnap.empty) return { success: true, data: [] };
    const properties = propsSnap.docs.map(doc => doc.data());
    
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
  };
}) {
  try {
    const tenantRef = adminDb.collection('tenants').doc();
    const tenantData = {
      tenant_id: tenantRef.id,
      pg_id: data.pgId,
      room_id: data.roomId,
      full_name: data.fullName,
      mobile: data.phone.replace(/\D/g, ''),
      rent_amount: data.rentAmount || 0,
      security_deposit: data.securityDeposit || 0,
      extra_fee: 0,
      is_active: true,
      move_in_date: data.moveInDate || '',
      documents: data.documents || {},
      created_at: new Date().toISOString()
    };
    await tenantRef.set(tenantData);
    
    const roomRefLocal = adminDb.collection('rooms').doc(data.roomId);
    const roomSnapLocal = await roomRefLocal.get();
    const roomExtraFee = roomSnapLocal.exists ? (roomSnapLocal.data()?.extra_fee || 0) : 0;

    // Also create the first rent payment bill
    const paymentRef = adminDb.collection('payments').doc();
    await paymentRef.set({
      payment_id: paymentRef.id,
      pg_id: data.pgId,
      tenant_id: tenantRef.id,
      amount: (data.rentAmount || 0) + roomExtraFee,
      status: 'pending',
      month: new Date().toLocaleString('default', { month: 'long' }),
      created_at: new Date().toISOString()
    });

    if (data.openingPendingFee && data.openingPendingFee > 0) {
      const openingFeeRef = adminDb.collection('payments').doc();
      await openingFeeRef.set({
        payment_id: openingFeeRef.id,
        pg_id: data.pgId,
        tenant_id: tenantRef.id,
        amount: data.openingPendingFee,
        status: 'pending',
        month: new Date(data.openingBalanceDueDate || Date.now()).toLocaleString('default', { month: 'long' }),
        description: 'Opening Pending Fee',
        type: 'opening-fee',
        created_at: data.openingBalanceDueDate || new Date().toISOString()
      });
    }


    revalidatePath('/pgowner/tenants');
    return { success: true, data: [tenantData] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateTenantBasicDetails(tenantId: string, data: {
  fullName?: string;
  mobile?: string;
  email?: string;
  moveInDate?: string;
  checkOutDate?: string;
}) {
  try {
    const updateData: any = {};
    if (data.fullName !== undefined) updateData.full_name = data.fullName;
    if (data.mobile !== undefined) updateData.mobile = data.mobile;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.moveInDate !== undefined) updateData.move_in_date = data.moveInDate;
    if (data.checkOutDate !== undefined) updateData.check_out_date = data.checkOutDate;

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
    const propsSnap = await adminDb.collection('properties').where('owner_id', '==', ownerId).get();
    if (propsSnap.empty) return { success: true, data: [] };
    const props = propsSnap.docs.map(doc => doc.data());
    
    // Sort properties descending by created_at to perfectly match the UI dropdown default
    props.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    
    let pgIds = props.map(p => p.pg_id);
    if (selectedPgId) {
      pgIds = props.filter(p => p.pg_id === selectedPgId).map(p => p.pg_id);
      if (pgIds.length === 0) pgIds = [props[0].pg_id];
    } else if (props.length > 0) {
      pgIds = [props[0].pg_id];
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

    // Pre-fetch rooms to join
    const roomIds = Array.from(new Set(tenants.map(t => t.room_id).filter(id => id)));
    let roomsMap: Record<string, any> = {};
    if (roomIds.length > 0) {
      // Chunk up to 10
      for (let i = 0; i < roomIds.length; i += 10) {
        const chunk = roomIds.slice(i, i + 10);
        const rSnap = await adminDb.collection('rooms').where('room_id', 'in', chunk).get();
        rSnap.docs.forEach(d => {
          roomsMap[d.id] = d.data();
        });
      }
    }
    
    // Map pg name and room number into data
    const enrichedData = tenants.map(t => ({
      ...t,
      pg_name: props.find(p => p.pg_id === t.pg_id)?.name || 'Unknown',
      rooms: roomsMap[t.room_id] || { room_number: 'N/A' }
    }));

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


export async function updateRoomDetails(roomId: string, totalBeds: number, extraFee: number) {
  try {
    const roomRef = adminDb.collection('rooms').doc(roomId);
    const roomSnap = await roomRef.get();
    
    let difference = 0;
    if (roomSnap.exists) {
      const roomData = roomSnap.data() || {};
      const oldExtraFee = roomData.extra_fee || 0;
      difference = extraFee - oldExtraFee;
    }

    await roomRef.update({
      total_beds: totalBeds,
      extra_fee: extraFee
    });

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
    const pendingSnap = await adminDb.collection('payments')
      .where('tenant_id', '==', tenantId)
      .where('status', '==', 'pending')
      .get();

    if (!pendingSnap.empty) {
      // Find the most recent pending due in memory (since we can't orderBy if we don't have an index sometimes)
      const docs = pendingSnap.docs.sort((a, b) => {
        const da = new Date(a.data().created_at || 0).getTime();
        const db = new Date(b.data().created_at || 0).getTime();
        return db - da;
      });
      
      const existingDoc = docs[0];
      const existingData = existingDoc.data() as any;
      const newAmount = (existingData.amount || 0) + amount;
      const oldDesc = existingData.description ? existingData.description + ' & ' : '';
      
      await existingDoc.ref.update({
        amount: newAmount,
        description: oldDesc + description
      });
      return { success: true };
    }

    // Fallback if no pending dues exist
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
    const propsSnap = await adminDb.collection('properties')
      .where('owner_id', '==', ownerId)
      .where('is_active', '==', true)
      .get();
      
    if (propsSnap.empty) return { success: true, data: [] };
    
    let pgIds = propsSnap.docs.map(doc => doc.data().pg_id);
    if (pgId) pgIds = pgIds.filter(id => id === pgId);
    
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
      const tenant = tenants.find(t => t.tenant_id === p.tenant_id) || {};
      const room = rooms.find(r => r.room_id === tenant.room_id) || {};
      return {
        ...p,
        tenant_name: tenant.full_name || 'Unknown',
        tenant_phone: tenant.mobile || '',
        room_number: room.room_number || 'N/A',
        move_in_date: tenant.move_in_date || ''
      };
    });

    return { success: true, data: enrichedPayments };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function collectFIFOPayment(tenantId: string, totalAmount: number, method: string, pgId: string) {
  try {
    let remainingToCollect = totalAmount;

    // 1. Fetch all pending payments for the tenant
    const pendingSnap = await adminDb.collection('payments')
      .where('tenant_id', '==', tenantId)
      .where('status', '==', 'pending')
      .get();
      
    if (!pendingSnap.empty) {
      const pendingPayments = pendingSnap.docs.map(doc => doc.data());
      
      // Sort them by oldest first based on created_at or due date logic
      pendingPayments.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

      // Iterate and apply payment
      for (const payment of pendingPayments) {
        if (remainingToCollect <= 0) break;

        const paymentRef = adminDb.collection('payments').doc(payment.payment_id);
        const amountDue = payment.amount || 0;

        if (remainingToCollect >= amountDue) {
          // Fully clear this charge
          await paymentRef.update({
            status: 'paid',
            amount_paid: amountDue,
            payment_method: method,
            payment_date: new Date().toISOString()
          });
          remainingToCollect -= amountDue;
        } else {
          // Partially clear this charge
          const newRemaining = amountDue - remainingToCollect;
          
          // Update the original pending record with the new remaining amount
          await paymentRef.update({
            amount: newRemaining,
            is_partially_paid: true
          });

          // Create a receipt/paid record for the partial amount collected
          const receiptRef = adminDb.collection('payments').doc();
          await receiptRef.set({
            ...payment,
            payment_id: receiptRef.id,
            amount: remainingToCollect,
            amount_paid: remainingToCollect,
            original_amount: amountDue,
            pending_balance: newRemaining,
            status: 'paid',
            payment_method: method,
            payment_date: new Date().toISOString(),
            is_partial: true,
            created_at: new Date().toISOString()
          });

          remainingToCollect = 0;
        }
      }
    }

    // 2. If remainingToCollect > 0 (meaning no pending dues existed, or payment exceeded pending dues - advance/next month rent collection):
    if (remainingToCollect > 0) {
      const tenantSnap = await adminDb.collection('tenants').doc(tenantId).get();
      const tenantData = tenantSnap.exists ? tenantSnap.data() : null;
      const targetPgId = pgId || tenantData?.pg_id || '';

      const now = new Date();
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const shortMonthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

      // Check last paid payment for this tenant to determine next month
      const paidSnap = await adminDb.collection('payments')
        .where('tenant_id', '==', tenantId)
        .where('status', '==', 'paid')
        .get();

      let targetMonth = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

      if (!paidSnap.empty) {
        const paidDocs = paidSnap.docs.map(d => d.data());
        paidDocs.sort((a, b) => new Date(b.created_at || b.payment_date || 0).getTime() - new Date(a.created_at || a.payment_date || 0).getTime());
        const lastMonthStr = paidDocs[0]?.month;

        if (lastMonthStr) {
          const monthClean = lastMonthStr.split(' ')[0];
          let foundIdx = monthNames.findIndex(m => m.toLowerCase() === monthClean.toLowerCase());
          if (foundIdx === -1) {
            foundIdx = shortMonthNames.findIndex(m => m.toLowerCase() === monthClean.toLowerCase());
          }

          if (foundIdx !== -1) {
            const nextIdx = (foundIdx + 1) % 12;
            let year = now.getFullYear();
            if (nextIdx === 0 && foundIdx === 11) {
              year += 1;
            }
            targetMonth = `${monthNames[nextIdx]} ${year}`;
          }
        }
      }

      // Create next month / advance paid record in payments collection
      const advanceRef = adminDb.collection('payments').doc();
      await advanceRef.set({
        payment_id: advanceRef.id,
        pg_id: targetPgId,
        tenant_id: tenantId,
        amount: remainingToCollect,
        amount_paid: remainingToCollect,
        original_amount: tenantData?.rent_amount || remainingToCollect,
        status: 'paid',
        month: targetMonth,
        payment_method: method,
        payment_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        is_advance: true,
        description: `Advance Rent (${targetMonth})`
      });
    }

    revalidatePath('/pgowner/dues');
    revalidatePath('/pgowner/history');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
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

export async function markPaymentPaid(paymentId: string, method: string, discount: number = 0) {
  try {
    const paymentRef = adminDb.collection('payments').doc(paymentId);
    const doc = await paymentRef.get();
    if (!doc.exists) {
      return { success: false, error: 'Payment not found' };
    }
    
    const paymentData = doc.data() as any;
    const finalAmount = Math.max(0, (paymentData.amount || 0) - discount);
    
    await paymentRef.update({
      status: 'paid',
      payment_method: method,
      discount_applied: discount,
      amount_paid: finalAmount,
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
    let pgIds: string[] = [];
    let propertiesData: any[] = [];
    if (activePgId) {
      pgIds = [activePgId];
      const pSnap = await adminDb.collection('properties').doc(activePgId).get();
      if (pSnap.exists) propertiesData = [pSnap.data()];
    } else {
      const propsSnap = await adminDb.collection('properties')
        .where('owner_id', '==', uid)
        .where('is_active', '==', true)
        .get();
      propertiesData = propsSnap.docs.map(doc => doc.data());
      pgIds = propertiesData.map(p => p.pg_id);
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
      const tenant = tenants.find(t => t.tenant_id === p.tenant_id) || {};
      const room = rooms.find(r => r.room_id === tenant.room_id) || {};
      const property = propertiesData.find(prop => prop.pg_id === p.pg_id) || {};
      return {
        ...p,
        tenant_name: tenant.full_name || 'Unknown',
        room_number: room.room_number || 'N/A',
        pg_name: property.name || 'Unknown'
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
    if (status === 'vacated') {
      updateData.is_active = false;
      updateData.vacated_at = new Date().toISOString();
      if (!options?.check_out_date) {
        updateData.check_out_date = new Date().toISOString();
      }
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
