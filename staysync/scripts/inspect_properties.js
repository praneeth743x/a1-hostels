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
const auth = admin.auth();

async function checkIds() {
  const uids = ['fJic7CCTjDdHJNfnicXq', 'KMxFpIM8racfQDEJknvs8NjLzOU2', 'OqfEJ0A5JGhjCnZrbHcEZfbPPSs1'];
  for (const uid of uids) {
    try {
      const u = await auth.getUser(uid);
      console.log(`Auth UID ${uid} => email: ${u.email}, phone: ${u.phoneNumber}, name: ${u.displayName}`);
    } catch (e) {
      console.log(`Auth UID ${uid} => NOT FOUND IN AUTH`);
    }
    const doc = await db.collection('user_profiles').doc(uid).get();
    console.log(`Profile ${uid} => exists: ${doc.exists}, data:`, doc.data());
  }

  process.exit(0);
}

checkIds().catch(err => {
  console.error(err);
  process.exit(1);
});
