const fs = require('fs');
const path = require('path');

const files = [
  'src/app/pgowner/dues/page.tsx',
  'src/app/pgowner/food-menu/page.tsx',
  'src/app/pgowner/notices/page.tsx',
  'src/app/pgowner/properties/page.tsx',
  'src/app/pgowner/reports/page.tsx',
  'src/app/pgowner/rooms/page.tsx',
  'src/app/pgowner/team/page.tsx',
  'src/app/pgowner/tenants/[id]/page.tsx',
  'src/app/pgowner/tenants/page.tsx',
  'src/app/superadmin/owners/page.tsx'
];

for (const file of files) {
  const filePath = path.join(__dirname, '..', file);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8');
  
  let modified = false;

  // 1. Replace alert with toast
  if (content.includes('alert(')) {
    content = content.replace(/alert\((.*?)\)/g, (match, p1) => {
      const lower = p1.toLowerCase();
      if (lower.includes('success') || lower.includes('✅') || lower.includes('saved')) {
        return `toast.success(${p1})`;
      } else if (lower.includes('error') || lower.includes('fail') || lower.includes('⚠️') || lower.includes('please')) {
        return `toast.error(${p1})`;
      } else {
        return `toast.error(${p1})`; // Defaulting to error since most alerts are error fallbacks
      }
    });
    
    // Add import if missing
    if (!content.includes('react-hot-toast')) {
      content = `import { toast } from 'react-hot-toast';\n` + content;
    }
    modified = true;
  }
  
  // 2. Replace confirm with await confirm
  if (content.includes('confirm(')) {
    // Prevent replacing if it's already 'await confirm'
    // Regex matches confirm( but not await confirm(
    content = content.replace(/(?<!await\s+)(window\.)?confirm\((.*?)\)/g, 'await confirm($2)');
    
    // Add import if missing
    if (!content.includes('ConfirmContext')) {
      content = `import { useConfirm } from '@/context/ConfirmContext';\n` + content;
    }
    
    // Insert `const confirm = useConfirm();` inside the component
    if (!content.includes('useConfirm()')) {
      // Find export default function XYZ() {
      content = content.replace(/(export\s+default\s+function\s+[^{]+\{)/, '$1\n  const confirm = useConfirm();');
    }
    modified = true;
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
}
