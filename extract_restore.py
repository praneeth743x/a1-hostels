import json

transcript = r'C:\Users\prane\.gemini\antigravity-ide\brain\f89c9525-8422-4fc2-b3c2-4f84f50c177f\.system_generated\logs\transcript_full.jsonl'

page_content = None
layout_content = None
css_content = None

for line in open(transcript, 'r', encoding='utf-8'):
    try:
        data = json.loads(line)
        if data.get('step_index', 0) > 5900:
            break
            
        # Look for full replacements
        if data.get('type') == 'PLANNER_RESPONSE' and data.get('tool_calls'):
            for call in data['tool_calls']:
                if call['name'] == 'replace_file_content':
                    args = call.get('args', {})
                    if str(args.get('StartLine')) == '1':
                        tgt = args.get('TargetFile', '')
                        if 'page.tsx' in tgt and 'layout.tsx' not in tgt and 'notices' not in tgt and 'history' not in tgt and 'properties' not in tgt and 'tenants' not in tgt:
                            page_content = args.get('TargetContent', '')
                        elif 'layout.tsx' in tgt:
                            layout_content = args.get('TargetContent', '')
                        elif 'pgowner.module.css' in tgt:
                            css_content = args.get('TargetContent', '')
    except Exception as e:
        pass

if page_content:
    with open(r'c:\Users\prane\PHG HOSTE\staysync\src\app\pgowner\page.tsx', 'w', encoding='utf-8') as f:
        f.write(page_content)
    print("Restored page.tsx")

if layout_content:
    with open(r'c:\Users\prane\PHG HOSTE\staysync\src\app\pgowner\layout.tsx', 'w', encoding='utf-8') as f:
        f.write(layout_content)
    print("Restored layout.tsx")

if css_content:
    with open(r'c:\Users\prane\PHG HOSTE\staysync\src\app\pgowner\pgowner.module.css', 'w', encoding='utf-8') as f:
        f.write(css_content)
    print("Restored pgowner.module.css")
