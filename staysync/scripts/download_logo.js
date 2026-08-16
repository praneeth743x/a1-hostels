const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Load environment variables
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
      privateKey: envVars.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    })
  });
}

const db = admin.firestore();

async function downloadLogo() {
  try {
    const doc = await db.collection('system_settings').doc('landing').get();
    if (!doc.exists) {
      console.log('No landing settings found');
      process.exit(1);
    }
    
    const data = doc.data();
    const logoUrl = data.logoUrl;
    
    if (!logoUrl) {
      console.log('No logoUrl found in landing settings');
      process.exit(1);
    }
    
    const destPath = path.join(__dirname, '../public/himalaya_logo_premium.png');

    if (logoUrl.startsWith('data:image/')) {
      // It's a base64 data URI
      console.log('Found base64 logo image, decoding and saving...');
      const base64Data = logoUrl.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(destPath, buffer);
      console.log('Successfully saved base64 logo to public/himalaya_logo_premium.png');
      process.exit(0);
    } else {
      console.log('Downloading logo from URL:', logoUrl);
      
      const file = fs.createWriteStream(destPath);
      
      https.get(logoUrl, (response) => {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log('Successfully downloaded logo to public/himalaya_logo_premium.png');
          process.exit(0);
        });
      }).on('error', (err) => {
        fs.unlink(destPath, () => {});
        console.error('Error downloading logo:', err.message);
        process.exit(1);
      });
    }
    
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

downloadLogo();
