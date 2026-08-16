import os
import glob

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if '"use server";' in content or "'use server';" in content:
        # Check if it's not at the very top
        lines = content.split('\n')
        if lines[0].strip() not in ['"use server";', "'use server';", '"use server"', "'use server'"]:
            print(f"Fixing {filepath}")
            # Remove existing directives
            content = content.replace('"use server";\n', '').replace("'use server';\n", '')
            content = content.replace('"use server";', '').replace("'use server';", '')
            # Put it at the very top
            content = '"use server";\n' + content.lstrip()
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)

for filepath in glob.glob('src/app/actions/*.ts'):
    fix_file(filepath)

print("Done")
