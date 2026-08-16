const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk(path.join(__dirname, '../src'));

files.forEach((file) => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('"use client";')) {
    // Remove all occurrences of "use client"; and trims leading whitespace
    const cleaned = content.replace(/"use client";\r?\n?/g, '').trimStart();
    const newContent = `"use client";\n\n` + cleaned;
    if (newContent !== content) {
      fs.writeFileSync(file, newContent, 'utf8');
      console.log(`Fixed "use client"; in ${file}`);
    }
  }
});
