import json

transcript = r'C:\Users\prane\.gemini\antigravity-ide\brain\f89c9525-8422-4fc2-b3c2-4f84f50c177f\.system_generated\logs\transcript_full.jsonl'
for line in open(transcript, 'r', encoding='utf-8'):
    if 'premiumDashboardGrid' in line and 'replace_file_content' in line:
        data = json.loads(line)
        print("Found at step:", data.get('step_index'))
