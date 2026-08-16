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

async function revokeDisabled() {
  const ownerId = 'KMxFpIM8racfQDEJknvs8NjLzOU2';
  console.log("Revoking owner auth tokens & devices for ownerId:", ownerId);

  // 1. Disable auth & revoke tokens for owner
  await auth.updateUser(ownerId, { disabled: true }).catch(console.warn);
  await auth.revokeRefreshTokens(ownerId).catch(console.warn);

  // Delete owner devices
  const devSnap = await db.collection('users').doc(ownerId).collection('devices').get();
  for (const d of devSnap.docs) {
    await d.ref.delete();
    console.log("Deleted owner device session:", d.id);
  }

  // 2. Disable team members under owner
  const teamSnap = await db.collection('user_profiles').where('owner_id', '==', ownerId).get();
  for (const tDoc of teamSnap.docs) {
    if (tDoc.id === ownerId) continue;
    await db.collection('user_profiles').doc(tDoc.id).set({ is_active: false, status: 'disabled' }, { merge: true });
    await auth.updateUser(tDoc.id, { disabled: true }).catch(console.warn);
    await auth.revokeRefreshTokens(tDoc.id).catch(console.warn);
    const tmDev = await db.collection('users').doc(tDoc.id).collection('devices').get();
    for (const d of tmDev.docs) {
      await d.ref.delete();
    }
  }

  // 3. Disable tenants under owner
  const tenantsSnap = await db.collection('tenants').where('owner_id', '==', ownerId).get();
  for (const tDoc of tenantsSnap.docs) {
    const data = tDoc.data();
    await db.collection('tenants').doc(tDoc.id).set({ is_active: false, status: 'INACTIVE' }, { merge: true });
    if (data.email) {
      try {
        const uRec = await auth.getUserByEmail(data.email);
        if (uRec) {
          await auth.updateUser(uRec.uid, { disabled: true });
          await auth.revokeRefreshTokens(uRec.uid);
          console.log("Revoked tenant Auth UID:", uRec.uid, "email:", data.email);
          const tDev = await db.collection('users').doc(uRec.uid).collection('devices').get();
          for (const d of tDev.docs) {
            await d.ref.delete();
          }
        }
      } catch (e) {}
    }
  }

  console.log("Revocation completed successfully!");
  process.exit(0);
}

revokeDisabled().catch(err => {
  console.error(err);
  process.exit(1);
});
