import json

transcript = r'C:\Users\prane\.gemini\antigravity-ide\brain\f89c9525-8422-4fc2-b3c2-4f84f50c177f\.system_generated\logs\transcript.jsonl'
for line in open(transcript, 'r', encoding='utf-8'):
    if 'step_index' in line:
        data = json.loads(line)
        if data.get('step_index') == 198:
            print("Found 198")
            calls = data.get('tool_calls', [])
            for call in calls:
                if call['name'] == 'multi_replace_file_content':
                    for chunk in call['args']['ReplacementChunks']:
                        print(chunk['ReplacementContent'][:100])
