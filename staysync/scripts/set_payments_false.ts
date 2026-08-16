import { adminDb } from '../src/lib/firebase-admin';

async function updateSettings() {
  await adminDb.collection('system_settings').doc('whatsapp_reminders').set({
    tenantPaymentsEnabled: false
  }, { merge: true });
  console.log("tenantPaymentsEnabled set to false");
  process.exit(0);
}

updateSettings();
