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

async function seed() {
  console.log('Starting seed...');
  // Find or create owner
  const usersSnap = await db.collection('user_profiles').where('role', '==', 'pg_owner').limit(1).get();
  let ownerId = 'demo_owner_123';
  if (!usersSnap.empty) {
    ownerId = usersSnap.docs[0].id;
    console.log('Found owner:', ownerId);
  } else {
    console.log('No owner found, creating one...');
    await db.collection('user_profiles').doc(ownerId).set({
      user_id: ownerId,
      full_name: 'Demo Owner',
      mobile: '9999999999',
      role: 'pg_owner',
      created_at: new Date().toISOString()
    });
  }

  const hostels = [
    { name: 'Sunrise Men Hostel', address: 'Madhapur, Hyderabad' },
    { name: 'Moonlight Co-live PG', address: 'Kondapur, Hyderabad' },
    { name: 'Starlight Women PG', address: 'Gachibowli, Hyderabad' }
  ];

  for (const h of hostels) {
    console.log(`Creating hostel ${h.name}...`);
    const pgRef = db.collection('properties').doc();
    await pgRef.set({
      pg_id: pgRef.id,
      owner_id: ownerId,
      name: h.name,
      address: h.address,
      theme_primary_color: JSON.stringify({ 1: "6000", 2: "5000", 3: "4500", 4: "4000" }),
      is_active: true,
      created_at: new Date().toISOString()
    });

    // Create 10 rooms with 5 beds each (50 beds total)
    const rooms = [];
    for (let i = 1; i <= 10; i++) {
      const roomRef = db.collection('rooms').doc();
      const roomData = {
        room_id: roomRef.id,
        pg_id: pgRef.id,
        room_number: `1${i.toString().padStart(2, '0')}`, // 101, 102...
        floor: '1st Floor',
        total_beds: 5,
        created_at: new Date().toISOString()
      };
      await roomRef.set(roomData);
      rooms.push(roomData);
    }

    let tenantCounter = 0;
    // For each room, add 5 tenants
    for (const room of rooms) {
      for (let b = 1; b <= 5; b++) {
        tenantCounter++;
        const tRef = db.collection('tenants').doc();
        const tData = {
          tenant_id: tRef.id,
          pg_id: pgRef.id,
          room_id: room.room_id,
          full_name: `Demo Tenant ${tenantCounter} (${h.name.split(' ')[0]})`,
          mobile: `9${pgRef.id.slice(0, 3)}${tenantCounter.toString().padStart(4, '0')}`, // unique-ish mobile
          rent_amount: 5000,
          security_deposit: 2000,
          extra_fee: 0,
          is_active: true,
          move_in_date: new Date().toISOString().split('T')[0], // today
          documents: {},
          created_at: new Date().toISOString()
        };
        await tRef.set(tData);

        // create initial rent payment (pending)
        const pRef = db.collection('payments').doc();
        await pRef.set({
          payment_id: pRef.id,
          pg_id: pgRef.id,
          tenant_id: tRef.id,
          amount: 5000,
          status: (tenantCounter % 3 === 0) ? 'paid' : 'pending', // mixed statuses
          month: new Date().toLocaleString('default', { month: 'long' }),
          created_at: new Date().toISOString(),
          description: 'Monthly Rent'
        });
        
        // Add some random dues for some tenants
        if (tenantCounter % 5 === 0) {
           const dueRef = db.collection('payments').doc();
           await dueRef.set({
             payment_id: dueRef.id,
             pg_id: pgRef.id,
             tenant_id: tRef.id,
             amount: 500,
             status: 'pending',
             month: new Date().toLocaleString('default', { month: 'long' }),
             description: 'Electricity / Maintenance Due',
             type: 'other',
             created_at: new Date().toISOString()
           });
        }
      }
    }
    console.log(`Created 50 tenants for ${h.name}`);
  }
  console.log('Seed complete!');
  process.exit(0);
}

seed().catch(console.error);
