import os
import fnmatch

# Configuration
OUTPUT_FILE = "codebase_context.md"

# Directories to scan recursively
# Business Logic + Setup Onboarding Flow
SEARCH_DIRS = [
    "services",
    "packages",
    "SafeMode-web-app",
    "scripts/setup",
    "scripts/cli"
]

# Files in the root directory to include specifically (if they match extensions)
INCLUDE_ROOT_FILES = [
    "package.json",
    "tsconfig.base.json",
    "tsconfig.json",
    "docker-compose.yml",
    "docker-compose.observability.yml",
    "Dockerfile",
    "Makefile",
    "railway.toml",
    "vercel.json",
    "bootstrap.sh",
    "setup.sh",
    "setup-hobby-express.sh",
    ".env.example"
]

# Specific files to include (absolute relative to root)
INCLUDE_SPECIFIC_FILES = [
    "scripts/setup-wizard.mjs",
    "scripts/unified-cli.mjs",
    "scripts/validate-setup.sh",
    "scripts/validate-environment.sh",
    "scripts/preflight-check.mjs",
    "scripts/remote-bootstrap.sh"
]

# Extensions to include (EXCLUDING Python)
ALLOWED_EXTENSIONS = {
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.sh', '.ps1', '.bash',
    '.html', '.css', '.scss',
    '.json', '.jsonc',
    '.yml', '.yaml', '.toml',
    '.sql',
    '.conf',
    '.dockerfile',
    'Dockerfile' # special case
}

# Directories to always ignore
IGNORE_DIRS = {
    'monorepos',
    'node_modules',
    '.git',
    '.next',
    '.vercel',
    'dist',
    'build',
    'coverage',
    '__tests__',
    '.devcontainer',
    '.vscode',
    '.idea',
    '.windsurf',
    '.husky',
    'venv',
    '.baileys_scraper_venv',
    'logs',
    'tmp',
    'temp'
}

# Files to always ignore
IGNORE_FILES = {
    'package-lock.json',
    'bun.lock',
    'yarn.lock',
    '.DS_Store',
    'thumbs.db'
}

# File extensions to ignore (docs, binaries, PYTHON)
IGNORE_EXTENSIONS = {
    '.md', '.markdown', '.txt',
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
    '.pdf', '.zip', '.tar', '.gz',
    '.py', '.pyc', '.pyo',
    '.log'
}

def get_language_from_ext(ext):
    ext = ext.lower()
    if ext in ['.ts', '.tsx']: return 'typescript'
    if ext in ['.js', '.jsx', '.mjs', '.cjs']: return 'javascript'
    # Python removed
    if ext in ['.sh', '.bash', '.ps1']: return 'bash'
    if ext in ['.html']: return 'html'
    if ext in ['.css', '.scss']: return 'css'
    if ext in ['.json', '.jsonc']: return 'json'
    if ext in ['.yml', '.yaml']: return 'yaml'
    if ext == '.toml': return 'toml'
    if ext == '.sql': return 'sql'
    if ext == '.conf': return 'nginx'
    if ext == '.dockerfile' or ext == 'dockerfile': return 'dockerfile'
    return 'text'

def should_process_file(file_path):
    filename = os.path.basename(file_path)
    name, ext = os.path.splitext(filename)
    
    if filename in IGNORE_FILES:
        return False
    
    if ext.lower() in IGNORE_EXTENSIONS:
        return False
        
    if ext.lower() in ALLOWED_EXTENSIONS or filename in ALLOWED_EXTENSIONS or filename in INCLUDE_ROOT_FILES:
        return True
        
    return False

def collect_files():
    all_files = []
    
    # 1. Scan Root Directory for specific files
    print("Scanning root directory...")
    for filename in os.listdir('.'):
        if os.path.isfile(filename):
            if filename in INCLUDE_ROOT_FILES:
                 all_files.append(os.path.abspath(filename))
            elif filename.endswith(tuple(ALLOWED_EXTENSIONS)) and filename not in IGNORE_FILES and not filename.endswith('.md'):
                 # Optional: Include all root code files if they aren't explicitly ignored?
                 # Let's stick to the INCLUDE_ROOT_FILES + generic code check if deemed "core"
                 # For now, let's strictly use the Allowed Extensions for root files too if not in Ignore
                 if should_process_file(filename):
                     all_files.append(os.path.abspath(filename))

    # 2. Scan subdirectories
    for root_dir in SEARCH_DIRS:
        if not os.path.exists(root_dir):
            print(f"Warning: Directory {root_dir} not found.")
            continue
            
        print(f"Scanning {root_dir}...")
        for root, dirs, files in os.walk(root_dir):
            # Modify dirs in-place to skip ignored directories
            dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
            
            for file in files:
                file_path = os.path.join(root, file)
                if should_process_file(file_path):
                    all_files.append(os.path.abspath(file_path))

    # 3. Include Specific Files
    print("Adding specific files...")
    for specific_file in INCLUDE_SPECIFIC_FILES:
        if os.path.exists(specific_file) and os.path.isfile(specific_file):
            all_files.append(os.path.abspath(specific_file))
        else:
            print(f"Warning: Specific file {specific_file} not found.")

    return sorted(list(set(all_files))) # Unique and sorted

def main():
    files = collect_files()
    print(f"Found {len(files)} files to process.")
    
    try:
        with open(OUTPUT_FILE, "w", encoding="utf-8") as outfile:
            outfile.write(f"# Codebase Context\n\n")
            outfile.write(f"Generated from project root: {os.getcwd()}\n")
            outfile.write(f"Total files: {len(files)}\n\n")
            
            for file_path in files:
                rel_path = os.path.relpath(file_path)
                print(f"Adding {rel_path}...")
                
                filename = os.path.basename(file_path)
                _, ext = os.path.splitext(filename)
                if filename == 'Dockerfile': ext = 'Dockerfile'
                
                lang = get_language_from_ext(ext)
                
                outfile.write(f"## File: {rel_path}\n\n")
                outfile.write(f"```{lang}\n")
                
                try:
                    with open(file_path, "r", encoding="utf-8", errors='replace') as infile:
                        content = infile.read()
                        outfile.write(content)
                except Exception as e:
                    outfile.write(f"[Error reading file: {e}]")
                
                outfile.write("\n```\n\n")
                
        print(f"\nSuccessfully generated {OUTPUT_FILE}")
        
    except Exception as e:
        print(f"Critical error: {e}")

if __name__ == "__main__":
    main()
