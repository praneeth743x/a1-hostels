import re

with open('src/app/pgowner/dues/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace import
content = content.replace("import { sendRentReminderWithLink } from '@/lib/whatsapp';", "import { sendRentReminderAction } from '@/app/actions/whatsapp';")

# Replace first call (single remind)
target1 = '''    const res = await sendRentReminderWithLink(
        due.tenant_phone, 
        due.tenant_name, 
        due.amount, 
        due.month || 'this month', 
        due.payment_id
    );'''

replacement1 = '''    const statusType = due.dueDays > 0 ? 'OVERDUE' : (due.dueDays === 0 ? 'DUE_TODAY' : (due.dueDays === -1 ? 'DUE_TOMORROW' : 'STANDARD'));
    const res = await sendRentReminderAction(
        due.tenant_phone, 
        due.tenant_name, 
        due.amount, 
        due.month || 'this month', 
        due.payment_id,
        "Himalaya Hostels",
        statusType,
        due.dueDays > 0 ? due.dueDays : 0
    );'''
content = content.replace(target1, replacement1)

# Replace second call (bulk remind loop)
target2 = '''        const res = await sendRentReminderWithLink(
            due.tenant_phone, 
            due.tenant_name, 
            due.amount, 
            due.month || 'this month', 
            due.payment_id
        );'''
replacement2 = '''        const statusType = due.dueDays > 0 ? 'OVERDUE' : (due.dueDays === 0 ? 'DUE_TODAY' : (due.dueDays === -1 ? 'DUE_TOMORROW' : 'STANDARD'));
        const res = await sendRentReminderAction(
            due.tenant_phone, 
            due.tenant_name, 
            due.amount, 
            due.month || 'this month', 
            due.payment_id,
            "Himalaya Hostels",
            statusType,
            due.dueDays > 0 ? due.dueDays : 0
        );'''
content = content.replace(target2, replacement2)


with open('src/app/pgowner/dues/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
