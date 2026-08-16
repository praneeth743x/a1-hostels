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

async function fixOwnerMapping() {
  const realAuthUid = 'KMxFpIM8racfQDEJknvs8NjLzOU2';
  const wrongDocId = 'fJic7CCTjDdHJNfnicXq';

  console.log("Fixing PG owner profile document ID to match Auth UID:", realAuthUid);

  // 1. Get profile data from wrongDocId if it exists
  const wrongDocSnap = await db.collection('user_profiles').doc(wrongDocId).get();
  const profileData = wrongDocSnap.exists ? wrongDocSnap.data() : {};

  // 2. Set profile at realAuthUid
  await db.collection('user_profiles').doc(realAuthUid).set({
    email: 'praneethgoud24k@gmail.com',
    role: 'pg_owner',
    full_name: profileData.full_name || 'Praneeth Goud',
    phone: profileData.phone || '9398699430',
    accountInitialized: true,
    created_at: profileData.created_at || new Date().toISOString()
  }, { merge: true });
  console.log(`Updated user_profiles/${realAuthUid}`);

  // 3. Delete wrongDocId if different
  if (wrongDocSnap.exists) {
    await db.collection('user_profiles').doc(wrongDocId).delete();
    console.log(`Deleted outdated user_profiles/${wrongDocId}`);
  }

  // 4. Update all active properties to have owner_id == realAuthUid
  const propsSnap = await db.collection('properties').get();
  for (const pDoc of propsSnap.docs) {
    const data = pDoc.data();
    if (data.status !== 'DELETED') {
      await db.collection('properties').doc(pDoc.id).update({
        owner_id: realAuthUid
      });
      console.log(`Updated property ${pDoc.id} (${data.name}) owner_id -> ${realAuthUid}`);
    }
  }

  console.log("Migration complete!");
  process.exit(0);
}

fixOwnerMapping().catch(err => {
  console.error(err);
  process.exit(1);
});
