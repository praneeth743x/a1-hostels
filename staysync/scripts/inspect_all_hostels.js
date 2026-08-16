const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let key = match[1].trim();
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    envVars[key] = val;
  }
});

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: envVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: envVars.FIREBASE_CLIENT_EMAIL,
      privateKey: envVars.FIREBASE_PRIVATE_KEY ? envVars.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
    })
  });
}

const db = admin.firestore();

async function inspectHostels() {
  const pSnap = await db.collection('properties').get();
  console.log("=== ALL PROPERTIES IN FIRESTORE ===");
  for (const doc of pSnap.docs) {
    const data = doc.data();
    const tSnap = await db.collection('tenants').where('pg_id', '==', doc.id).get();
    console.log("----------------------------------------");
    console.log(`Doc ID: ${doc.id}`);
    console.log(`Name: "${data.name}"`);
    console.log(`Address: "${data.address}"`);
    console.log(`Is Active: ${data.is_active}`);
    console.log(`Status: ${data.status}`);
    console.log(`Tenant Count: ${tSnap.docs.length}`);
  }

  process.exit(0);
}

inspectHostels().catch(err => {
  console.error(err);
  process.exit(1);
});
