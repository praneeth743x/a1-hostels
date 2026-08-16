import json
import traceback

try:
    with open(r'.next\dev\static\chunks\src_0eo2~9p._.js.map', 'r', encoding='utf-8') as f:
        data = json.load(f)
        
        found = False
        def process_map(map_data):
            global found
            sources = map_data.get('sources', [])
            contents = map_data.get('sourcesContent', [])
            for i, src in enumerate(sources):
                if 'dues' in src and 'page.tsx' in src:
                    print(f"Found! {src}")
                    if i < len(contents) and contents[i]:
                        with open('recovered_page_old.tsx', 'w', encoding='utf-8') as out:
                            out.write(contents[i])
                        print("Wrote to recovered_page_old.tsx")
                    else:
                        print("No content found at index", i)
                    found = True

        if 'sections' in data:
            print(f"Has {len(data['sections'])} sections")
            for section in data['sections']:
                if 'map' in section:
                    process_map(section['map'])
        else:
            print("No sections, processing top level map")
            process_map(data)
            
        if not found:
            print("Did not find page.tsx in sources.")
            
except Exception as e:
    traceback.print_exc()
