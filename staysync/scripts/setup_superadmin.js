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

const SUPER_ADMIN_EMAIL = '25r21a05e2@mlrit.ac.in';

async function setupSuperAdmin() {
  console.log("Setting up single Super Admin account:", SUPER_ADMIN_EMAIL);

  // 1. Ensure Firebase Auth User exists for 25r21a05e2@mlrit.ac.in
  let authUser;
  try {
    authUser = await auth.getUserByEmail(SUPER_ADMIN_EMAIL);
    console.log(`Found existing Auth User for ${SUPER_ADMIN_EMAIL} (UID: ${authUser.uid})`);
  } catch (e) {
    console.log(`Creating new Auth User for ${SUPER_ADMIN_EMAIL}...`);
    authUser = await auth.createUser({
      email: SUPER_ADMIN_EMAIL,
      displayName: 'Super Admin',
      emailVerified: true
    });
    console.log(`Created Auth User with UID: ${authUser.uid}`);
  }

  // 2. Set user_profiles document with role: 'superadmin'
  await db.collection('user_profiles').doc(authUser.uid).set({
    email: SUPER_ADMIN_EMAIL,
    full_name: 'Super Admin',
    role: 'superadmin',
    accountInitialized: true,
    created_at: new Date().toISOString()
  }, { merge: true });
  console.log(`Set user_profiles/${authUser.uid} as superadmin.`);

  // 3. Purge any OTHER superadmin profiles in user_profiles
  const snap = await db.collection('user_profiles').where('role', '==', 'superadmin').get();
  for (const doc of snap.docs) {
    if (doc.id !== authUser.uid && doc.data().email !== SUPER_ADMIN_EMAIL) {
      console.log(`[PURGING STALE SUPERADMIN] Doc ID: ${doc.id} | Email: ${doc.data().email}`);
      await db.collection('user_profiles').doc(doc.id).delete();
    }
  }

  console.log(`\nSuper Admin setup complete! Exactly ONE Super Admin account exists: ${SUPER_ADMIN_EMAIL} (UID: ${authUser.uid}).`);
  process.exit(0);
}

setupSuperAdmin().catch(err => {
  console.error(err);
  process.exit(1);
});
