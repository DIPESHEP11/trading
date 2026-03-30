import os

root_dir = "/Users/gksinfotech/StudioProjects/trading"

ignore_dirs = {'.git', 'venv', 'node_modules', 'dist', '__pycache__', '.vscode'}
ignore_exts = {'.pyc', '.png', '.jpg', '.jpeg', '.lock', '.jsonl', '.db', '.pyo'}

def process_file(file_path):
    if file_path.endswith('package-lock.json') or file_path.endswith('.log') or file_path.endswith('client_logs.txt'):
        return

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return

    new_content = content.replace("Trading", "Trading").replace("trading", "trading")

    if new_content != content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated: {file_path}")

for root, dirs, files in os.walk(root_dir):
    dirs[:] = [d for d in dirs if d not in ignore_dirs]
    for file in files:
        if any(file.endswith(ext) for ext in ignore_exts):
            continue
        process_file(os.path.join(root, file))
