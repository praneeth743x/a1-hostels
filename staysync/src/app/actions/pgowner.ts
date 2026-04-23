"use server";

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function addSubHostel(ownerId: string, name: string, address: string, rooms: {floor: string, roomNum: string, beds: number}[], pricing: Record<number, string>) {
  try {
    // We can store pricing as a JSON string in theme_primary_color to avoid schema migrations for now
    const pricingStr = JSON.stringify(pricing);
    
    const { data: propData, error: propError } = await supabaseAdmin.from('properties').insert({
      owner_id: ownerId,
      name: name,
      address: address,
      theme_primary_color: pricingStr,
      is_active: true
    }).select();

    if (propError) throw propError;
    const newPgId = propData[0].pg_id;

    // Bulk insert rooms
    if (rooms && rooms.length > 0) {
      const roomInserts = rooms.map(r => ({
        pg_id: newPgId,
        room_number: r.roomNum,
        floor: r.floor,
        total_beds: r.beds
      }));
      await supabaseAdmin.from('rooms').insert(roomInserts);
    }

    revalidatePath('/pgowner/properties');
    revalidatePath('/pgowner');
    
    return { success: true, data: propData };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getProperties(ownerId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('properties')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

export async function deleteProperty(pgId: string) {
  try {
    await supabaseAdmin.from('payments').delete().eq('pg_id', pgId);
    await supabaseAdmin.from('tenants').delete().eq('pg_id', pgId);
    await supabaseAdmin.from('rooms').delete().eq('pg_id', pgId);
    const { error } = await supabaseAdmin.from('properties').delete().eq('pg_id', pgId);
    
    if (error) throw error;
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
    const { error } = await supabaseAdmin.from('properties')
      .update({ name, address, theme_primary_color: pricingStr })
      .eq('pg_id', pgId);
      
    if (error) throw error;
    
    // Sync rooms safely (update existing, insert new)
    const { data: existingRooms } = await supabaseAdmin.from('rooms').select('*').eq('pg_id', pgId);
    
    if (rooms && rooms.length > 0) {
      for (const r of rooms) {
        const existing = existingRooms?.find(er => er.room_number === r.roomNum);
        if (existing) {
          if (existing.total_beds !== r.beds) {
            await supabaseAdmin.from('rooms').update({ total_beds: r.beds }).eq('room_id', existing.room_id);
          }
        } else {
          await supabaseAdmin.from('rooms').insert({
            pg_id: pgId,
            room_number: r.roomNum,
            floor: r.floor,
            total_beds: r.beds
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
    const { data: propData, error: propError } = await supabaseAdmin
      .from('properties')
      .select('name, address')
      .eq('pg_id', pgId)
      .single();
      
    if (propError) throw propError;

    const { data: rooms } = await supabaseAdmin.from('rooms').select('*').eq('pg_id', pgId);
    const { data: tenants } = await supabaseAdmin.from('tenants').select('tenant_id, room_id, full_name').eq('pg_id', pgId).eq('is_active', true);

    return { success: true, data: { property: propData, rooms, tenants } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getPropertiesWithRooms(ownerId: string) {
  try {
    const { data: properties, error: propError } = await supabaseAdmin
      .from('properties')
      .select('pg_id, name')
      .eq('owner_id', ownerId)
      .eq('is_active', true);
      
    if (propError) throw propError;
    if (!properties || properties.length === 0) return { success: true, data: [] };

    const pgIds = properties.map(p => p.pg_id);
    const { data: rooms, error: roomError } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .in('pg_id', pgIds);

    if (roomError) throw roomError;

    // Attach rooms to properties
    const propsWithRooms = properties.map(p => ({
      ...p,
      rooms: rooms?.filter(r => r.pg_id === p.pg_id) || []
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
}) {
  try {
    const { data: newTenant, error } = await supabaseAdmin.from('tenants').insert({
      pg_id: data.pgId,
      room_id: data.roomId,
      full_name: data.fullName,
      mobile: data.phone,
      is_active: true
      // parent_phone: data.parentPhone, // if schema allows
      // work_status: data.workStatus
    }).select();

    if (error) throw error;
    
    // Also create the first rent payment bill so it shows up in Tenant portal!
    await supabaseAdmin.from('payments').insert({
      pg_id: data.pgId,
      tenant_id: newTenant[0].tenant_id,
      amount: 8500, // This could be fetched from the pricing config in properties later
      status: 'pending',
      month: new Date().toLocaleString('default', { month: 'long' })
    });

    revalidatePath('/pgowner/tenants');
    return { success: true, data: newTenant };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getTenants(ownerId: string) {
  try {
    const { data: props } = await supabaseAdmin.from('properties').select('pg_id, name').eq('owner_id', ownerId);
    if (!props || props.length === 0) return { success: true, data: [] };
    const pgIds = props.map(p => p.pg_id);

    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('tenant_id, full_name, mobile, is_active, pg_id, rooms(room_number)')
      .in('pg_id', pgIds);

    if (error) throw error;
    
    // Map pg name into data
    const enrichedData = data.map(t => ({
      ...t,
      pg_name: props.find(p => p.pg_id === t.pg_id)?.name || 'Unknown'
    }));

    return { success: true, data: enrichedData };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function addNotice(ownerId: string, message: string) {
  try {
    const { data: props } = await supabaseAdmin.from('properties').select('pg_id').eq('owner_id', ownerId).limit(1);
    if (!props || props.length === 0) throw new Error("No PG Hostels found.");
    const pgId = props[0].pg_id;

    const { data, error } = await supabaseAdmin.from('notices').insert({
      pg_id: pgId,
      message: message
    }).select();

    if (error) throw error;
    revalidatePath('/pgowner/notices');
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getNotices(ownerId: string) {
  try {
    const { data: props } = await supabaseAdmin.from('properties').select('pg_id').eq('owner_id', ownerId).limit(1);
    if (!props || props.length === 0) return { success: true, data: [] };
    const pgId = props[0].pg_id;

    const { data, error } = await supabaseAdmin
      .from('notices')
      .select('notice_id, message, created_at')
      .eq('pg_id', pgId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
