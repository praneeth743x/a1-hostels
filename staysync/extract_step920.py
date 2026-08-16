import json

transcript_path = r'C:\Users\prane\.gemini\antigravity-ide\brain\dbdc34b4-aa19-4105-9345-d49bd8c15aac\.system_generated\logs\transcript_full.jsonl'
with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line)
        step = data.get('step_index', 0)
        if 920 <= step <= 923:
            content = data.get('content', '')
            print(f"--- STEP {step} (type: {data.get('type')}) (len: {len(content)}) ---")
            if 'import React' in content:
                with open('recovered_150.txt', 'w', encoding='utf-8') as out:
                    out.write(content)
