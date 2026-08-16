const admin = require('firebase-admin'); 
const fs = require('fs'); 
const lines = fs.readFileSync('.env.local', 'utf8').split('\n'); 
let pk = lines.find(l => l.startsWith('FIREBASE_PRIVATE_KEY=')).split('=')[1].replace(/"/g, '').replace(/\\n/g, '\n'); 
admin.initializeApp({ 
  credential: admin.credential.cert({ 
    projectId: 'a1-hostels', 
    clientEmail: 'firebase-adminsdk-q40r6@a1-hostels.iam.gserviceaccount.com', 
    privateKey: pk 
  }) 
}); 
admin.firestore().collection('tenants').where('name', '==', 'praneeth').limit(1).get().then(snap => { 
  console.log(snap.docs[0].data()); 
  process.exit(0); 
}).catch(e => { console.error(e); process.exit(1); });
