import json
import os

transcript = r'C:\Users\prane\.gemini\antigravity-ide\brain\f89c9525-8422-4fc2-b3c2-4f84f50c177f\.system_generated\logs\transcript_full.jsonl'

page_content = None

for line in open(transcript, 'r', encoding='utf-8'):
    try:
        data = json.loads(line)
        if data.get('step_index', 0) == 5928:
            calls = data.get('tool_calls', [])
            for call in calls:
                if call['name'] == 'replace_file_content':
                    args = call.get('args', {})
                    page_content = args.get('TargetContent', '')
    except Exception as e:
        pass

if page_content:
    with open(r'c:\Users\prane\PHG HOSTE\staysync\src\app\pgowner\page.tsx', 'w', encoding='utf-8') as f:
        f.write(page_content)
    print("Restored exact page.tsx from step 5928")
