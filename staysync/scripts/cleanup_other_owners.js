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

async function cleanupOtherOwners() {
  console.log("Starting cleanup of non-praneethgoud24k@gmail.com PG owners...");

  const snap = await db.collection('user_profiles').where('role', '==', 'pg_owner').get();
  console.log(`Found ${snap.docs.length} pg_owner profile documents in Firestore.`);

  const keptEmail = 'praneethgoud24k@gmail.com';
  let deletedCount = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    let authUser = null;
    try {
      authUser = await auth.getUser(doc.id);
    } catch (e) {
      if (data.email) {
        try { authUser = await auth.getUserByEmail(data.email); } catch (e2) {}
      }
    }

    const docEmail = (data.email || authUser?.email || '').toLowerCase().trim();
    const docId = doc.id;

    if (docEmail === keptEmail || docId === 'fJic7CCTjDdHJNfnicXq') {
      console.log(`[KEEPING] Owner Doc: ${docId} | Name: ${data.full_name || 'Praneeth Goud'} | Email: ${docEmail || keptEmail}`);
    } else {
      console.log(`[DELETING] Owner Doc: ${docId} | Name: ${data.full_name || 'Unnamed'} | Email: ${docEmail || 'N/A'}`);
      
      // Delete associated properties if any
      const pSnap = await db.collection('properties').where('owner_id', '==', docId).get();
      for (const pDoc of pSnap.docs) {
        console.log(`  -> Deleting associated property: ${pDoc.id} (${pDoc.data().name})`);
        await db.collection('properties').doc(pDoc.id).delete();
      }

      // Delete user_profile doc
      await db.collection('user_profiles').doc(docId).delete();

      // Delete Firebase Auth User if present (and not praneethgoud24k@gmail.com)
      if (authUser && authUser.email !== keptEmail) {
        try {
          await auth.deleteUser(authUser.uid);
          console.log(`  -> Deleted Firebase Auth User: ${authUser.uid}`);
        } catch (e) {
          console.error(`  -> Failed to delete Auth User: ${e.message}`);
        }
      }

      deletedCount++;
    }
  }

  console.log(`\nCleanup complete! Deleted ${deletedCount} unwanted PG owner documents. Exactly 1 PG owner remains: praneethgoud24k@gmail.com.`);
  process.exit(0);
}

cleanupOtherOwners().catch(err => {
  console.error("Cleanup error:", err);
  process.exit(1);
});
