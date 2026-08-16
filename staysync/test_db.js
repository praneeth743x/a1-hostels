const admin = require('firebase-admin'); 
const fs = require('fs'); 
const lines = fs.readFileSync('C:\\Users\\prane\\PHG HOSTE\\staysync\\.env.local', 'utf8').split('\n'); 
let pk = lines.find(l => l.startsWith('FIREBASE_PRIVATE_KEY=')).split('=')[1].replace(/"/g, '').replace(/\\n/g, '\n'); 
admin.initializeApp({ 
  credential: admin.credential.cert({ 
    projectId: 'a1-hostels', 
    clientEmail: 'firebase-adminsdk-q40r6@a1-hostels.iam.gserviceaccount.com', 
    privateKey: pk 
  }) 
}); 
admin.firestore().collection('payments').where('status', '==', 'paid').orderBy('created_at', 'desc').limit(5).get().then(snap => { 
  snap.docs.forEach(d => console.log(d.id, 'amount:', d.data().amount, 'paid:', d.data().amount_paid, 'cash:', d.data().cash_collected, 'discount:', d.data().discount_applied, 'type:', d.data().type, 'method:', d.data().payment_method, 'is_partial:', d.data().is_partial)); 
  process.exit(0); 
}).catch(e => { console.error(e); process.exit(1); });
