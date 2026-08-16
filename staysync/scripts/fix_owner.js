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

const db = admin.firestore();

async function run() {
  const wrongOwnerId = 'r89JTqvDg5bnMkY7Wwart1lXssI3';
  const rightOwnerId = 'OqfEJ0A5JGhjCnZrbHcEZfbPPSs1';
  
  const snap = await db.collection('properties').where('owner_id', '==', wrongOwnerId).get();
  
  let batch = db.batch();
  snap.forEach(doc => {
    batch.update(doc.ref, { owner_id: rightOwnerId });
    console.log(`Updated owner for ${doc.data().name}`);
  });
  
  await batch.commit();
  console.log('Successfully updated properties to your user account.');
  process.exit(0);
}

run().catch(console.error);
