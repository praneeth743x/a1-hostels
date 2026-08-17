import os
import glob

def replace_in_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        new_content = content.replace('Himalaya Hostels | Premium Pg Hostels', 'A1 Hostels | Premium Pg Hostels')
        new_content = new_content.replace('Himalaya Hostels', 'A1 Hostels')
        new_content = new_content.replace('HIMALAYA HOSTELS', 'A1 HOSTELS')
        new_content = new_content.replace('Himalaya stayin', 'A1 Hostels')
        new_content = new_content.replace('Himalaya Stayin', 'A1 Hostels')
        
        if new_content != content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f'Updated {filepath}')
    except Exception as e:
        print(f'Error on {filepath}: {e}')

for ext in ['ts', 'tsx', 'js', 'jsx', 'html']:
    for filepath in glob.glob(f'src/**/*.{ext}', recursive=True):
        replace_in_file(filepath)
