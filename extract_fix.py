import json
import os

transcript = r'C:\Users\prane\.gemini\antigravity-ide\brain\f89c9525-8422-4fc2-b3c2-4f84f50c177f\.system_generated\logs\transcript_full.jsonl'

page_content = None

for line in open(transcript, 'r', encoding='utf-8'):
    try:
        data = json.loads(line)
        if data.get('step_index', 0) > 5930:
            break
            
        if data.get('type') == 'PLANNER_RESPONSE' and data.get('tool_calls'):
            for call in data['tool_calls']:
                if call['name'] == 'replace_file_content' or call['name'] == 'multi_replace_file_content':
                    args = call.get('args', {})
                    tgt = args.get('TargetFile', '')
                    if 'pgowner' in tgt and 'page.tsx' in tgt and not 'layout' in tgt:
                        # Find the first full replace
                        if str(args.get('StartLine')) == '1':
                            page_content = args.get('TargetContent', '')
                            break
    except Exception as e:
        pass

if page_content:
    with open(r'c:\Users\prane\PHG HOSTE\staysync\src\app\pgowner\page.tsx', 'w', encoding='utf-8') as f:
        f.write(page_content)
    print("Restored pgowner/page.tsx")
