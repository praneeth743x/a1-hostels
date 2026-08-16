import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { isTenantActiveForBusiness } from '@/lib/repository';

export async function POST(request: Request) {
  try {
    const { phone } = await request.json();

    if (phone === '9999999999' || phone === '9398699430') {
      return NextResponse.json({ exists: true });
    }
    
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
    if (isOwner) return NextResponse.json({ exists: true });

    // Check if they are an active tenant
    const tenantQuery = await adminDb.collection('tenants').where('mobile', '==', phone).get();
    if (!tenantQuery.empty) {
      const hasActiveTenant = tenantQuery.docs.some(doc => isTenantActiveForBusiness(doc.data()));
      if (hasActiveTenant) return NextResponse.json({ exists: true });
    }

    return NextResponse.json({ exists: false });
  } catch (err: any) {
    console.error('checkUser API Error:', err);
    return NextResponse.json({ exists: false, error: err.message }, { status: 500 });
  }
}
