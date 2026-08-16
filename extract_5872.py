import json

transcript = r'C:\Users\prane\.gemini\antigravity-ide\brain\f89c9525-8422-4fc2-b3c2-4f84f50c177f\.system_generated\logs\transcript_full.jsonl'
for line in open(transcript, 'r', encoding='utf-8'):
    if 'premiumDashboardGrid' in line and 'replace_file_content' in line:
        data = json.loads(line)
        if data.get('step_index') == 5872:
            for call in data.get('tool_calls', []):
                if call['name'] == 'replace_file_content':
                    with open(r'c:\Users\prane\PHG HOSTE\staysync\src\app\pgowner\page.tsx', 'w', encoding='utf-8') as f:
                        f.write(call['args']['TargetContent'])
            print("Extracted step 5872")
            break
