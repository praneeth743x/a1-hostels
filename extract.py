import json
import re

transcript_path = r'C:\Users\prane\.gemini\antigravity-ide\brain\f89c9525-8422-4fc2-b3c2-4f84f50c177f\.system_generated\logs\transcript_full.jsonl'

layout_content = None
css_content = None

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line)
        step_index = data.get('step_index', 0)
        
        if step_index > 5900:
            break
            
        if data.get('type') == 'VIEW_FILE' and data.get('source') == 'MODEL' or data.get('source') == 'SYSTEM':
            # It's output of a tool. Wait, TOOL_RESPONSE is actually what we want.
            content = data.get('content', '')
            if 'layout.tsx`' in content or 'layout.tsx\'' in content or 'layout.tsx' in content:
                # If this was a full view_file output, it has "<line_number>: " prefix.
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
                    if parsed_lines:
                        layout_content = '\n'.join(parsed_lines)
            
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
                    if parsed_lines and len(parsed_lines) > 200:
                        css_content = '\n'.join(parsed_lines)

print("LAYOUT LENGTH:", len(layout_content) if layout_content else 0)
print("CSS LENGTH:", len(css_content) if css_content else 0)

if layout_content:
    with open(r'c:\Users\prane\PHG HOSTE\staysync\src\app\pgowner\layout_recovered.tsx', 'w', encoding='utf-8') as f:
        f.write(layout_content)

if css_content:
    with open(r'c:\Users\prane\PHG HOSTE\staysync\src\app\pgowner\pgowner_recovered.module.css', 'w', encoding='utf-8') as f:
        f.write(css_content)
