import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

// Initialize Firebase Admin (mock the env var since we are running locally)
const serviceAccount = JSON.parse(fs.readFileSync('C:/Users/prane/PHG HOSTE/staysync/serviceAccountKey.json', 'utf8'));

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const db = getFirestore();

async function check() {
  const snapshot = await db.collection('complaints').get();
  console.log(`Found ${snapshot.size} complaints`);
  snapshot.forEach(doc => {
    console.log(doc.id, '=> owner_id:', doc.data().owner_id, '| pg_id:', doc.data().pg_id, '| status:', doc.data().status, '| title:', doc.data().description);
  });
}

check().catch(console.error);
