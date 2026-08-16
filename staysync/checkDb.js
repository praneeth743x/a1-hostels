const fs = require('fs');
const envConfig = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    acc[match[1].trim()] = val;
  }
  return acc;
}, {});
Object.assign(process.env, envConfig);

const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
  })
});
const db = admin.firestore();

async function run() {
  const uid = '768sW3HfUKWwIxUcyazHatLaw4w2';
  
  console.log("Checking UID:", uid);

  const userDoc = await db.collection('users').doc(uid).get();
  console.log("users collection exists:", userDoc.exists, userDoc.exists ? userDoc.data() : '');

  const userProfDoc = await db.collection('user_profiles').doc(uid).get();
  console.log("user_profiles collection exists:", userProfDoc.exists, userProfDoc.exists ? userProfDoc.data() : '');

  const tenantsQ = await db.collection('tenants').where('email', '==', 'praneeth743x@gmail.com').get();
  console.log("tenants matching email:");
  tenantsQ.forEach(d => console.log(d.id, d.data().full_name || d.data().name, d.data()));
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
