import fs from 'fs';
import path from 'path';

const publicDir = path.join(__dirname, '..', 'public');
const logoPath = path.join(publicDir, 'himalaya_logo_premium.png');

if (fs.existsSync(logoPath)) {
  const logoBuf = fs.readFileSync(logoPath);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), logoBuf);
  fs.writeFileSync(path.join(publicDir, 'icon-192x192.png'), logoBuf);
  fs.writeFileSync(path.join(publicDir, 'icon-512x512.png'), logoBuf);
  console.log("Successfully created valid favicon.ico, icon-192x192.png, icon-512x512.png!");
} else {
  console.error("Logo file not found:", logoPath);
}
