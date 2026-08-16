const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function dump() {
  const tSnap = await db.collection('tenants').where('full_name', '==', 'Demo Tenant 5').get();
  if (tSnap.empty) {
    console.log("Tenant not found");
    return;
  }
  const tId = tSnap.docs[0].id;
  const pSnap = await db.collection('payments').where('tenant_id', '==', tId).get();
  pSnap.docs.forEach(doc => {
    console.log(doc.id, doc.data());
  });
}
dump();
