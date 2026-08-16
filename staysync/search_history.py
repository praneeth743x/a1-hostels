import os
import json
import time

history_dir = r"C:\Users\prane\AppData\Roaming\Code\User\History"
found_entries = []

for folder in os.listdir(history_dir):
    folder_path = os.path.join(history_dir, folder)
    if os.path.isdir(folder_path):
        entries_path = os.path.join(folder_path, "entries.json")
        if os.path.exists(entries_path):
            try:
                with open(entries_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    res = data.get('resource', '')
                    if 'dues' in res and 'page.tsx' in res:
                        found_entries.append((folder_path, data))
            except:
                pass

print(f"Found {len(found_entries)} folders")
for folder, data in found_entries:
    print(f"Folder: {folder}")
    print(f"Resource: {data['resource']}")
    for entry in data.get('entries', []):
        timestamp = entry.get('timestamp', 0) / 1000.0
        time_str = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(timestamp))
        print(f"  - id: {entry.get('id')}, time: {time_str}")
