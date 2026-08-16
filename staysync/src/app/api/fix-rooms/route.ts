import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
    try {
        const tenantsSnap = await adminDb.collection('tenants').get();
        let updated = 0;
        
        const roomsSnap = await adminDb.collection('rooms').get();
        const roomsMap: Record<string, string> = {};
        roomsSnap.docs.forEach(doc => {
            roomsMap[doc.id] = doc.data().room_number || doc.data().room_name || '';
        });
        
        const batch = adminDb.batch();
        for (const doc of tenantsSnap.docs) {
            const data = doc.data();
            if (!data.room_number && data.room_id) {
                const roomNumber = roomsMap[data.room_id] || '';
                if (roomNumber) {
                    batch.update(doc.ref, { room_number: roomNumber });
                    updated++;
                }
            }
        }
        
        if (updated > 0) {
            await batch.commit();
        }
        return NextResponse.json({ success: true, updated });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message });
    }
}
