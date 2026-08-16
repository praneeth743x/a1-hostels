import os

file_path = r'c:\Users\prane\PHG HOSTE\staysync\src\app\pgowner\pgowner.module.css'

with open(file_path, 'rb') as f:
    content_bytes = f.read()

# The file likely has utf-16 bytes appended to utf-8 bytes
# Let's just fix it. I will read the file line by line using replace_file_content or a python script.

# Actually, the file size is 15392.
# Let's just truncate the file to 645 lines, and append it correctly!

with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()
    
valid_lines = lines[:645]

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(valid_lines)
    f.write('''
/* Mobile Bottom Navigation Base (Hidden on Desktop) */
@media (max-width: 768px) {
  .mobileBottomNav {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    background: white;
    border-top: 1px solid #e2e8f0;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.05);
    z-index: 50;
    justify-content: space-between;
    padding: 0 12px;
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  
  .bottomNavItem {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 12px 0;
    color: #94a3b8;
    text-decoration: none;
    font-size: 10px;
    font-weight: 600;
    gap: 6px;
    transition: all 0.2s ease;
  }
  
  .bottomNavItem:hover {
    color: #64748b;
  }
  
  .bottomNavItem.active {
    color: #0d7990; /* Match the teal header */
  }
  .bottomNavItem.active svg {
    color: #0d7990;
    stroke-width: 2.5px;
  }

  .contentWrapper {
    padding-bottom: 90px !important; /* Make space for the bottom nav */
  }
}

.topHeaderGradient {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: linear-gradient(135deg, #094769 0%, #0d7990 100%);
  color: white;
  margin-bottom: 24px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(13, 121, 144, 0.2);
}

.headerIcon {
  cursor: pointer;
  opacity: 0.9;
  transition: opacity 0.2s;
}

.headerIcon:hover {
  opacity: 1;
}

.topHeaderTitle {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
  letter-spacing: 0.5px;
}
''')
    print("Fixed CSS file.")
