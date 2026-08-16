import re

with open('src/app/pgowner/dues/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = '''  const getTenantStatus = (t: any) => {
    if (!t) return 'Active';
    if (t.is_active === false || t.status === 'Vacated' || t.status === 'VACATED') return 'Vacated';
    if (t.status === 'Notice Period' || t.status === 'notice_period' || t.status === 'NOTICE' || t.status === 'NOTICE_PERIOD') return 'Notice Period';
    if (t.status === 'PAUSED' || t.status === 'Paused') return 'Paused';
    return 'Active';
  };

  const activeTenants = tenants;'''

content = re.sub(r'\s*const activeTenants = tenants\.filter\(t => t\.is_active\);', replacement, content)

# Fix paidCount and dueCount
content = re.sub(r'const paidCount = activeTenants\.filter\(t => !pendingDueTenantIds\.has\(t\.tenant_id\)\)\.length;', 'const paidCount = activeTenants.filter(t => t.is_active !== false && !pendingDueTenantIds.has(t.tenant_id)).length;', content)
content = re.sub(r'const dueCount = activeTenants\.filter\(t => pendingDueTenantIds\.has\(t\.tenant_id\)\)\.length;', 'const dueCount = activeTenants.filter(t => t.is_active !== false && pendingDueTenantIds.has(t.tenant_id)).length;', content)

# Also fix the tenantStatus field assignment which might have been t.is_active === false ? 'Vacated' : 'Active'
content = re.sub(r"tenantStatus:\s*t\.is_active === false \? 'Vacated' : 'Active',", "tenantStatus: getTenantStatus(t),", content)

with open('src/app/pgowner/dues/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Regex fixes applied!")
