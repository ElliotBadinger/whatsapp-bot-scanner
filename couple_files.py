import os
import glob

# Define the list of files and patterns to include
patterns = [
    "docker-compose.yml",
    "setup.sh",
    "setup-hobby-express.sh",
    "package.json",
    "tsconfig.base.json",
    "README.md",
    "railway.toml",
    ".env.example",
    ".env.hobby",
    "services/control-plane/src/**/*.ts",
    "services/scan-orchestrator/src/**/*.ts",
    "services/wa-client/src/**/*.ts",
    "services/landing-page/index.html",
    "services/landing-page/style.css",
    "packages/shared/src/**/*.ts",
    "packages/confusable/index.js",
    "packages/confusable/index.d.ts",
    "scripts/fix-firewalld-docker.sh",
    "scripts/quick-fix-firewalld.sh",
    "scripts/pair.sh",
    "scripts/watch-pairing-code.js",
    "scripts/setup/setup-wizard.mjs",
    "scripts/validate-setup.sh"
]

# Exclude patterns
excludes = [
    "**/__tests__/**",
    "**/node_modules/**",
    "**/dist/**",
    "**/coverage/**"
]

def is_excluded(path):
    for exclude in excludes:
        # Simple check, for more complex glob matching we might need fnmatch
        if "__tests__" in path or "node_modules" in path or "dist/" in path or "coverage/" in path:
            return True
    return False

output_file = "codebase_context.md"

with open(output_file, "w") as outfile:
    outfile.write("# Codebase Context\n\n")
    outfile.write("This file contains the core code of the project, concatenated for LLM context.\n\n")

    for pattern in patterns:
        # recursive=True is needed for **
        files = glob.glob(pattern, recursive=True)
        for file_path in files:
            if os.path.isfile(file_path) and not is_excluded(file_path):
                print(f"Processing {file_path}...")
                
                # Determine language for markdown code block
                ext = os.path.splitext(file_path)[1]
                lang = "text"
                if ext == ".ts":
                    lang = "typescript"
                elif ext == ".js":
                    lang = "javascript"
                elif ext == ".json":
                    lang = "json"
                elif ext == ".sh":
                    lang = "bash"
                elif ext == ".yml" or ext == ".yaml":
                    lang = "yaml"
                elif ext == ".html":
                    lang = "html"
                elif ext == ".css":
                    lang = "css"
                
                outfile.write(f"# File: {file_path}\n\n")
                outfile.write(f"```{lang}\n")
                
                try:
                    with open(file_path, "r", encoding="utf-8") as infile:
                        outfile.write(infile.read())
                except Exception as e:
                    outfile.write(f"Error reading file: {e}")
                
                outfile.write("\n```\n\n")

print(f"Finished writing to {output_file}")
