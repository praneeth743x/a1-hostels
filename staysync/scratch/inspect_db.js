const fs = require('fs');
const path = require('path');

const envText = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');

function getEnv(key) {
  const reg = new RegExp('^' + key + '=(.*)$', 'm');
  const m = envText.match(reg);
  if (!m) return '';
  let val = m[1].trim();
  if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
  return val.replace(/\\n/g, '\n');
}

const privateKey = getEnv('FB_ADMIN_PRIVATE_KEY');
const clientEmail = getEnv('FB_ADMIN_CLIENT_EMAIL');

const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: 'a1-hostels',
    clientEmail: clientEmail,
    privateKey: privateKey,
  })
});
const db = admin.firestore();

async function run() {
  console.log("=== USER PROFILES ===");
  const profiles = await db.collection('user_profiles').get();
  profiles.forEach(doc => {
    console.log(`[UserProfile doc.id=${doc.id}]`, doc.data());
  });

  console.log("\n=== USERS ===");
  const users = await db.collection('users').get();
  users.forEach(doc => {
    console.log(`[User doc.id=${doc.id}]`, doc.data());
  });
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
