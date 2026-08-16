import fs from 'fs';
import path from 'path';

// Sample default logo or check existing public files
console.log("Checking public directory logos...");
const publicDir = path.join(__dirname, '..', 'public');
console.log("Public Dir:", publicDir);

const files = fs.readdirSync(publicDir);
console.log("Found logo files:", files.filter(f => f.includes('logo')));
