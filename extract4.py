import json

transcript_path = r'C:\Users\prane\.gemini\antigravity-ide\brain\f89c9525-8422-4fc2-b3c2-4f84f50c177f\.system_generated\logs\transcript_full.jsonl'

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line)
        if data.get('step_index') == 5928:
            calls = data.get('tool_calls', [])
            for call in calls:
                if call['name'] == 'replace_file_content':
                    target = call.get('args', {}).get('TargetContent', '')
                    with open(r'c:\Users\prane\PHG HOSTE\staysync\src\app\pgowner\page_backup.tsx', 'w', encoding='utf-8') as out:
                        out.write(target)
            print("Extracted page.tsx")
