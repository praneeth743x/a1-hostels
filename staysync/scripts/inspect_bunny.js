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

async function run() {
  const pgId = 'NkEMRbUsRiZnineEspLL';
  const tenantsSnap = await db.collection('tenants').where('pg_id', '==', pgId).get();
  const roomsSnap = await db.collection('rooms').where('pg_id', '==', pgId).get();
  
  const rooms = roomsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const tenants = tenantsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const activeTenants = tenants.filter(t => t.is_active !== false && t.status !== 'PAUSED');

  let totalMonthlyFee = 0;
  activeTenants.forEach(t => {
    const r = rooms.find(rm => rm.room_id === t.room_id || rm.room_number === t.room_number || rm.num === t.room_number);
    const roomExtra = Number(r?.extra_fee || 0);
    const baseRent = Number(t.rent_amount || t.fee || 0);
    totalMonthlyFee += (baseRent + roomExtra);
  });

  console.log('Active Tenants count:', activeTenants.length);
  console.log('Total Monthly Rent of Active Tenants:', totalMonthlyFee);
  console.log('12 Months Expected Rent (Monthly * 12):', totalMonthlyFee * 12);
}

run().catch(console.error);
