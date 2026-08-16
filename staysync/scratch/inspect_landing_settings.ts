import { adminDb } from '../src/lib/firebase-admin';

async function main() {
  const doc = await adminDb.collection('system_settings').doc('landing').get();
  if (doc.exists) {
    const data = doc.data();
    console.log("Existing landing settings logoUrl:", data?.logoUrl?.substring(0, 100));
    console.log("Full data keys:", Object.keys(data || {}));
  } else {
    console.log("No system_settings/landing document found!");
  }
}

main().catch(console.error);
