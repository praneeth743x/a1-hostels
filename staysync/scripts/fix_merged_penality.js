const admin = require('firebase-admin');
const path = require('path');

const privateKeyRaw = process.env.FB_ADMIN_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY;
const clientEmail = process.env.FB_ADMIN_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: clientEmail,
      privateKey: privateKeyRaw ? privateKeyRaw.replace(/\\n/g, '\n') : undefined,
    }),
  });
}

const db = admin.firestore();

async function fixDue() {
  console.log('Fetching all payments...');
  const snap = await db.collection('payments').get();
  let found = false;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.amount === 8000) {
      console.log(`Found a payment with 8000: ${doc.id}`);
      found = true;
      if (data.description === 'penality' || data.description === 'penality ') {
        console.log(`Fixing it!`);
        await doc.ref.update({
          amount: 7000,
          description: ''
        });
        
        const newRef = db.collection('payments').doc();
        await newRef.set({
          payment_id: newRef.id,
          pg_id: data.pg_id,
          tenant_id: data.tenant_id,
          amount: 1000,
          status: 'pending',
          month: new Date().toLocaleString('default', { month: 'long' }),
          description: 'penality',
          type: 'one-time',
          created_at: new Date().toISOString()
        });
        console.log('Fixed successfully.');
      }
    }
  }
  if (!found) console.log('No payment with amount 8000 found anywhere.');
}

fixDue().then(() => {
  console.log('Done');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
