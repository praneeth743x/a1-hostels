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

async function inspectOwners() {
  const snap = await db.collection('user_profiles').where('role', '==', 'pg_owner').get();
  console.log(`Remaining PG Owners count: ${snap.docs.length}`);

  snap.docs.forEach(doc => {
    console.log("------------------------------------------");
    console.log("ID:", doc.id);
    console.log("Data:", doc.data());
  });

  process.exit(0);
}

inspectOwners().catch(err => {
  console.error(err);
  process.exit(1);
});
