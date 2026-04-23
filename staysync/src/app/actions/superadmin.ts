"use server";

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

// We initialize a service client if the key is available, otherwise fallback to anon key.
// The service key is required to bypass RLS and create auth users.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function getUserRole(userId: string) {
  try {
    const { data } = await supabaseAdmin.from('user_profiles').select('role').eq('id', userId).single();
    return data?.role || 'tenant';
  } catch (err) {
    return 'tenant';
  }
}

export async function getOwners() {
  try {
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, full_name')
      .eq('role', 'pg_owner')
      .order('created_at', { ascending: false });

    if (profileError) throw profileError;

    const ownerData = [];
    for (const profile of profiles) {
      const { data: properties } = await supabaseAdmin
        .from('properties')
        .select('pg_id, saas_payment_status, is_active')
        .eq('owner_id', profile.id);

      let totalTenants = 0;
      let paymentStatus = 'Paid';
      let isActive = true;

      if (properties) {
        for (const prop of properties) {
          const { count } = await supabaseAdmin
            .from('tenants')
            .select('*', { count: 'exact', head: true })
            .eq('pg_id', prop.pg_id);
          totalTenants += count || 0;
          
          if (prop.saas_payment_status !== 'paid') paymentStatus = 'Overdue';
          if (!prop.is_active) isActive = false;
        }
      }

      ownerData.push({
        id: profile.id,
        name: profile.full_name || 'Unknown Owner',
        hostels: properties ? properties.length : 0,
        tenants: totalTenants,
        status: isActive ? 'active' : 'disabled',
        payment: paymentStatus,
      });
    }
    
    return { success: true, data: ownerData };
  } catch (err: any) {
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

    // 1. Create the PG Owner in Supabase Auth using the Admin API
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      phone: formattedPhone,
      phone_confirm: true,
      user_metadata: { full_name: data.name }
    });

    let userId = authUser?.user?.id;

    if (authError) {
      if (authError.message.includes('already registered')) {
        // Fetch existing user to link them instead of failing
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = users.find(u => u.phone === formattedPhone.replace('+', ''));
        if (existingUser) {
          userId = existingUser.id;
        } else {
          throw new Error("User exists but could not be retrieved.");
        }
      } else {
        throw authError;
      }
    }

    if (!userId) throw new Error("Failed to generate Auth User ID for PG Owner");

    // Give the Supabase Auth Trigger (which inserts default role 'tenant') 500ms to finish
    await new Promise(resolve => setTimeout(resolve, 500));

    // 2. Update the User Profile to pg_owner (overwriting the trigger's default)
    await supabaseAdmin.from('user_profiles').upsert({
      id: userId,
      full_name: data.name,
      role: 'pg_owner'
    });

    // 3. Insert into properties with the correct owner_id
    const { data: insertedProps, error } = await supabaseAdmin
      .from('properties')
      .insert({
        owner_id: userId,
        name: data.name,
        address: data.location,
        is_active: true,
        saas_payment_status: 'paid',
        theme_primary_color: '#3F51B5'
      })
      .select();

    if (error) throw error;

    revalidatePath('/superadmin/owners');
    return { success: true, data: insertedProps };
  } catch (error: any) {
    console.error("Error registering PG:", error);
    return { success: false, error: error.message };
  }
}
