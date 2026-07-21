const admin = require('firebase-admin');
const serviceAccount = require('../src/lib/firebase-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkProperties() {
  const props = await db.collection('properties').get();
  console.log('Total Properties:', props.size);
  props.forEach(doc => {
    console.log(doc.id, '=>', doc.data());
  });
}

checkProperties();
