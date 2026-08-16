import json

with open(r'.next\dev\static\chunks\src_0eo2~9p._.js.map', 'r', encoding='utf-8') as f:
    data = json.load(f)
    if 'sections' in data:
        for section in data['sections']:
            map_data = section.get('map', {})
            sources = map_data.get('sources', [])
            for i, src in enumerate(sources):
                if 'dues' in src and 'page.tsx' in src:
                    print(f"Found in section! {src}")
                    content = map_data.get('sourcesContent', [])
                    if i < len(content) and content[i]:
                        with open('recovered_page_old.tsx', 'w', encoding='utf-8') as out:
                            out.write(content[i])
                        print("Wrote to recovered_page_old.tsx")
    else:
        sources = data.get('sources', [])
        for i, src in enumerate(sources):
            if 'dues' in src and 'page.tsx' in src:
                print(f"Found! {src}")
                content = data.get('sourcesContent', [])
                if i < len(content) and content[i]:
                    with open('recovered_page_old.tsx', 'w', encoding='utf-8') as out:
                        out.write(content[i])
                    print("Wrote to recovered_page_old.tsx")
