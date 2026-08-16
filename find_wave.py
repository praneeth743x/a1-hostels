import json

transcript = r'C:\Users\prane\.gemini\antigravity-ide\brain\f89c9525-8422-4fc2-b3c2-4f84f50c177f\.system_generated\logs\transcript_full.jsonl'
out = []
with open(transcript, 'r', encoding='utf-8') as f:
    for line in f:
        if 'mobileWaveHeader' in line:
            data = json.loads(line)
            if 'tool_calls' in data:
                for call in data['tool_calls']:
                    if call['name'] == 'multi_replace_file_content':
                        if 'layout.tsx' in call['args'].get('TargetFile', ''):
                            out.append(f"FOUND IN LAYOUT:\n{json.dumps(call['args'], indent=2)}")
                        if 'pgowner.module.css' in call['args'].get('TargetFile', ''):
                            out.append(f"FOUND IN CSS:\n{json.dumps(call['args'], indent=2)}")

with open(r'c:\Users\prane\PHG HOSTE\wave_out2.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out[-10:])) # just write the last 10 to be safe
