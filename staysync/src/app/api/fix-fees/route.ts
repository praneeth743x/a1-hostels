import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const targetTenants = ['karyy', 'hjk'];
    const tenantIds: string[] = [];
    
    const allTenants = await adminDb.collection('tenants').get();
    allTenants.docs.forEach(doc => {
      const data = doc.data();
      if (targetTenants.includes(data.full_name)) {
        tenantIds.push(doc.id);
      }
    });

    if (tenantIds.length > 0) {
      const pendingSnap = await adminDb.collection('payments')
        .where('tenant_id', 'in', tenantIds)
        .where('status', '==', 'pending')
        .get();

      const batch = adminDb.batch();
      let updatedCount = 0;
      pendingSnap.docs.forEach(doc => {
        const pData = doc.data();
        if (pData.type !== 'opening-fee') {
          // Add 10000 to their current amount
          batch.update(doc.ref, { amount: (pData.amount || 0) + 10000 });
          updatedCount++;
        }
      });
      await batch.commit();
      return NextResponse.json({ success: true, updatedCount });
    }

    return NextResponse.json({ success: false, message: 'Tenants not found' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
