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
admin.firestore().collection('tenants').where('full_name', '==', 'praneeth').limit(1).get().then(snap => { 
  if (snap.empty) { console.log('No tenant found'); return process.exit(0); }
  const t = snap.docs[0].data(); 
  console.log('Move in:', t.move_in_date); 
  admin.firestore().collection('payments').where('tenant_id', '==', snap.docs[0].id).get().then(pSnap => { 
    console.log('Payments:', pSnap.size); 
    pSnap.forEach(p => console.log(p.data().status, p.data().amount, p.data().month, p.data().due_date, p.data().created_at)); 
    process.exit(0); 
  }); 
}).catch(e => { console.error(e); process.exit(1); });
