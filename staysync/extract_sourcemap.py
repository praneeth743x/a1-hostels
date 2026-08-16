import json

with open('.next\dev\static\chunks\src_0x5fp72._.js.map', 'r', encoding='utf-8') as f:
    data = json.load(f)
    print(data.keys())
    if 'sections' in data:
        print("Has sections!")
        for section in data['sections']:
            map_data = section.get('map', {})
            sources = map_data.get('sources', [])
            for i, src in enumerate(sources):
                if 'dues' in src and 'page.tsx' in src:
                    print(f"Found in section! {src}")
                    content = map_data.get('sourcesContent', [])
                    if i < len(content) and content[i]:
                        with open('recovered_page.tsx', 'w', encoding='utf-8') as out:
                            out.write(content[i])
                        print("Wrote to recovered_page.tsx")
