import { adminDb } from '@/lib/firebase-admin';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const snap = await adminDb.collection('tenants').orderBy('created_at', 'desc').limit(5).get();
    const data = snap.docs.map(d => d.data());
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack });
  }
}
