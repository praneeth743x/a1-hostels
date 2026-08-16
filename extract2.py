import json
import re

transcript_path = r'C:\Users\prane\.gemini\antigravity-ide\brain\f89c9525-8422-4fc2-b3c2-4f84f50c177f\.system_generated\logs\transcript_full.jsonl'

for line in open(transcript_path, 'r', encoding='utf-8'):
    data = json.loads(line)
    if data.get('step_index', 0) > 5850:
        if data.get('type') == 'PLANNER_RESPONSE' and data.get('tool_calls'):
            for call in data['tool_calls']:
                if call['name'] == 'replace_file_content':
                    args = call.get('args', {})
                    if 'layout.tsx' in args.get('TargetFile', ''):
                        if args.get('StartLine') == 1 or args.get('StartLine') == '1':
                            print("FOUND FULL REPLACE for layout.tsx at step", data['step_index'])
                            with open(r'c:\Users\prane\PHG HOSTE\staysync\src\app\pgowner\layout_backup.tsx', 'w', encoding='utf-8') as f:
                                f.write(args.get('TargetContent', ''))
                            exit(0)
