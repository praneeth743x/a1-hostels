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

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: envVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: envVars.FIREBASE_CLIENT_EMAIL,
    privateKey: envVars.FIREBASE_PRIVATE_KEY ? envVars.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
  }),
  storageBucket: envVars.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
});

async function setCors() {
  try {
    const bucket = admin.storage().bucket();
    await bucket.setCorsConfiguration([
      {
        origin: ['*'], // Allow all origins for dev/testing
        method: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        responseHeader: ['Content-Type', 'Authorization', 'Content-Length', 'User-Agent', 'x-goog-resumable'],
        maxAgeSeconds: 3600
      }
    ]);
    console.log('✅ Successfully configured CORS for Firebase Storage bucket: ' + bucket.name);
  } catch (error) {
    console.error('❌ Failed to configure CORS:', error.message);
    if (error.message.includes("does not exist") || error.message.includes("Not Found")) {
      console.log('\n--> YOU NEED TO ENABLE FIREBASE STORAGE IN THE CONSOLE!');
    }
  }
}

setCors();
