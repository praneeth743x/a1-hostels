import json
import re

transcript_path = r'C:\Users\prane\.gemini\antigravity-ide\brain\f89c9525-8422-4fc2-b3c2-4f84f50c177f\.system_generated\logs\transcript_full.jsonl'

css_content = None

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            step_index = data.get('step_index', 0)
            
            if step_index > 5900:
                break
                
            if data.get('type') == 'VIEW_FILE' or data.get('type') == 'PLANNER_RESPONSE':
                content = data.get('content', '')
                if 'pgowner.module.css`' in content or 'pgowner.module.css\'' in content or 'pgowner.module.css' in content:
                    if 'The following code has been modified to include a line number' in content:
                        lines = content.split('\n')
                        parsed_lines = []
                        is_code = False
                        for l in lines:
                            if l.startswith('1: '):
                                is_code = True
                            if is_code:
                                match = re.match(r'^\d+: (.*)$', l)
                                if match:
                                    parsed_lines.append(match.group(1))
                                else:
                                    if l.startswith('The above content does NOT show the entire file contents'):
                                        break
                                    if l.startswith('The above content shows the entire, complete file contents'):
                                        break
                        if parsed_lines and len(parsed_lines) > 2000:
                            css_content = '\n'.join(parsed_lines)
        except Exception:
            pass

if css_content:
    print("Found CSS, length:", len(css_content))
    with open(r'c:\Users\prane\PHG HOSTE\staysync\src\app\pgowner\pgowner_backup.module.css', 'w', encoding='utf-8') as f:
        f.write(css_content)
else:
    print("No full CSS found before step 5900")
