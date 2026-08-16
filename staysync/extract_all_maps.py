import json
import os
import glob

map_files = glob.glob(r'.next\dev\static\chunks\*.map')
found = 0

def process_map(map_data, filepath):
    global found
    sources = map_data.get('sources', [])
    contents = map_data.get('sourcesContent', [])
    for i, src in enumerate(sources):
        if 'dues' in src and 'page.tsx' in src:
            print(f"Found in {filepath}! {src}")
            if i < len(contents) and contents[i]:
                output_name = f"recovered_page_{found}.tsx"
                with open(output_name, 'w', encoding='utf-8') as out:
                    out.write(contents[i])
                print(f"Wrote to {output_name}")
                found += 1

for filepath in map_files:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if 'sections' in data:
                for section in data['sections']:
                    if 'map' in section:
                        process_map(section['map'], filepath)
            else:
                process_map(data, filepath)
    except Exception as e:
        pass

print(f"Total recovered: {found}")
