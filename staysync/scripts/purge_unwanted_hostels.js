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

// Hostels to keep
const KEPT_HOSTEL_IDS = ['NkEMRbUsRiZnineEspLL', 'wT1GWzUare7i9qqNxsZc'];

// Hostels to purge
const PURGE_HOSTEL_IDS = [
  '1HfneEqjiKoDLnQZHKvY',
  'RKUvCetCmv7vjjx6LEXH',
  'TpyqfEH2bUViq9CqijdM',
  'YYY17pKQ5W2Vyqmzzkrw',
  'bqJpfEkG7dD4JQf140J4'
];

async function deleteQueryBatch(query, resolve) {
  const snapshot = await query.get();
  if (snapshot.size === 0) {
    return resolve();
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  process.nextTick(() => {
    deleteQueryBatch(query, resolve);
  });
}

async function purgeHostelData() {
  console.log("=== STARTING PURGE OF UNWANTED HOSTELS ===");
  console.log("Hostels to keep:", KEPT_HOSTEL_IDS);
  console.log("Hostels to purge:", PURGE_HOSTEL_IDS);

  const collections = [
    'tenants',
    'payments',
    'invoices',
    'rooms',
    'beds',
    'complaints',
    'notices',
    'food_menu',
    'expenses',
    'maintenance_fees',
    'activity_logs'
  ];

  for (const pgId of PURGE_HOSTEL_IDS) {
    console.log(`\n--- Purging Hostel ${pgId} ---`);

    // Delete property document
    const propRef = db.collection('properties').doc(pgId);
    const propSnap = await propRef.get();
    if (propSnap.exists) {
      console.log(`Deleting property: ${propSnap.data().name}`);
      await propRef.delete();
    }

    // Delete associated items in all related collections
    for (const colName of collections) {
      const q = db.collection(colName).where('pg_id', '==', pgId);
      const snap = await q.get();
      if (snap.size > 0) {
        console.log(`Deleting ${snap.size} docs from collection '${colName}' for pg_id ${pgId}`);
        await new Promise((resolve) => deleteQueryBatch(q, resolve));
      }
    }
  }

  // Double check remaining properties
  const remainingPropSnap = await db.collection('properties').get();
  console.log("\n=== REMAINING PROPERTIES IN DB ===");
  remainingPropSnap.docs.forEach(doc => {
    console.log(`- ${doc.id}: "${doc.data().name}"`);
  });

  process.exit(0);
}

purgeHostelData().catch(err => {
  console.error(err);
  process.exit(1);
});
