const admin = require('firebase-admin');

// Initialize Firebase Admin
try {
  admin.initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  });
} catch (e) {}

const db = admin.firestore();

async function run() {
  const usersRef = db.collection('user_profiles');
  const snapshot = await usersRef.where('role', '==', 'team_member').get();
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    console.log('User:', data.email);
    console.log('Permissions:', data.permissions);
  }
}

run().catch(console.error);
