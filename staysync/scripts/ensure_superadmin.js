const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.resolve(__dirname, '../.env.local');
const envStr = fs.readFileSync(envPath, 'utf-8');
envStr.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let key = match[1].trim();
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    }
    process.env[key] = val;
  }
});

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const auth = admin.auth();
const db = admin.firestore();

async function ensureSuperAdmin() {
  const email = '25r21a05e2@mlrit.ac.in';
  let uid;

  try {
    const user = await auth.getUserByEmail(email);
    uid = user.uid;
    console.log(`Found existing Firebase Auth user for ${email}: ${uid}`);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      const newUser = await auth.createUser({
        email: email,
        emailVerified: true,
        displayName: 'Super Admin',
        password: 'AdminPassword123!',
      });
      uid = newUser.uid;
      console.log(`Created new Firebase Auth user for ${email}: ${uid}`);
    } else {
      console.error('Error fetching user:', err);
      return;
    }
  }

  // Ensure document exists in user_profiles collection with role super_admin
  await db.collection('user_profiles').doc(uid).set({
    full_name: 'Super Admin',
    email: email,
    role: 'super_admin',
    accountInitialized: true,
    created_at: new Date().toISOString()
  }, { merge: true });

  console.log(`Successfully verified and initialized super_admin profile for ${email}`);
}

ensureSuperAdmin().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
