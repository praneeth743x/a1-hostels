const admin = require('firebase-admin');
const serviceAccount = require('./src/lib/staysync-app-himalaya-firebase-adminsdk-fbsvc-d4f12cc6e6.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function check() {
  try {
    const doc = await db.collection('tenants').doc('s2NR1OWeK98umRkzBiSR').get();
    if (doc.exists) {
      console.log('Tenant exists:', doc.data());
    } else {
      console.log('Tenant not found by ID. Checking if any tenant has this ID in a field...');
      const snap = await db.collection('tenants').where('tenant_id', '==', 's2NR1OWeK98umRkzBiSR').get();
      if (!snap.empty) {
        console.log('Found tenant where tenant_id field ==', 's2NR1OWeK98umRkzBiSR');
        console.log('Actual document ID is:', snap.docs[0].id);
      } else {
        console.log('Not found anywhere.');
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}
check();
