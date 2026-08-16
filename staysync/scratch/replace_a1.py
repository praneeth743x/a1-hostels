import os
import glob

def replace_in_files(directory):
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith(('.ts', '.tsx', '.json', '.css', '.js')):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    if 'A1 Hostels' in content or 'A1 HOSTELS' in content:
                        new_content = content.replace('A1 Hostels', 'Himalaya Hostels').replace('A1 HOSTELS', 'HIMALAYA HOSTELS')
                        
                        with open(filepath, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        print(f"Updated: {filepath}")
                except Exception as e:
                    print(f"Failed to read/write {filepath}: {e}")

if __name__ == "__main__":
    replace_in_files("c:/Users/prane/PHG HOSTE/staysync/src")
    replace_in_files("c:/Users/prane/PHG HOSTE/staysync/public")
    replace_in_files("c:/Users/prane/PHG HOSTE/staysync/scripts")
