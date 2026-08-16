const admin = require('firebase-admin');
const fs = require('fs');

const lines = fs.readFileSync('c:\\Users\\prane\\PHG HOSTE\\staysync\\.env.local', 'utf8').split('\n');
let pk = lines.find(l => l.startsWith('FIREBASE_PRIVATE_KEY=')).split('=')[1].replace(/"/g, '').replace(/\\n/g, '\n');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: 'a1-hostels',
    clientEmail: 'firebase-adminsdk-q40r6@a1-hostels.iam.gserviceaccount.com',
    privateKey: pk
  })
});

async function fixTenants() {
  const snapshot = await admin.firestore().collection('tenants').get();
  const batch = admin.firestore().batch();
  let count = 0;
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if ((data.status === 'Active' || data.status === 'notice_period' || data.status === 'Notice Period') && data.is_active === false) {
      batch.update(doc.ref, { is_active: true });
      count++;
      console.log('Fixed tenant:', data.full_name);
    }
  });
  
  if (count > 0) {
    await batch.commit();
    console.log(`Updated ${count} tenants.`);
  } else {
    console.log('No tenants needed fixing.');
  }
  process.exit(0);
}

fixTenants().catch(console.error);
