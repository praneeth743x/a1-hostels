import { adminDb } from '../lib/firebase-admin';

async function checkRecentLogs() {
  try {
    const snap = await adminDb.collection('whatsapp_logs')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    console.log(`Found ${snap.docs.length} recent whatsapp logs:`);
    snap.docs.forEach(doc => {
      const d = doc.data();
      console.log(`[${d.createdAt}] ${d.templateName} -> ${d.phoneNumber} (${d.tenantName}): status=${d.status}, error=${d.failedReason || 'none'}`);
    });
  } catch (err: any) {
    console.error('Error fetching logs:', err);
  }
}

checkRecentLogs();
