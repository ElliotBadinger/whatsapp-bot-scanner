# Baileys Documentation Scraper

This tool automatically scrapes and updates Baileys documentation from the official wiki.

## Quick Start

```bash
# Run the scraper (automatically handles venv and dependencies)
./scrape_baileys.sh
```

## Requirements

### System Dependencies

**Linux (Fedora/RHEL/CentOS):**
```bash
sudo dnf install libxml2-devel libxslt-devel python3-devel gcc redhat-rpm-config
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt install libxml2-dev libxslt-dev python3-dev gcc
```

**Linux (Arch):**
```bash
sudo pacman -S libxml2 libxslt python gcc
```

**macOS:**
```bash
brew install libxml2 libxslt python3 gcc
```

**Windows:**
System dependencies are not required (wheels available).

### Python Dependencies

All Python dependencies are installed automatically in a virtual environment:
- `crawl4ai>=0.3.0` - Web scraping library
- `lxml` - XML/HTML parsing

## Files

- `scrape_baileys.sh` - Main wrapper script (handles venv and dependencies)
- `scrape_baileys.py` - Python scraping script
- `requirements-baileys.txt` - Python dependencies
- `docs/exports/Baileys/` - Scraped documentation output

## Usage

### Automatic Mode (Recommended)
```bash
./scrape_baileys.sh
```

This will:
1. Create a virtual environment (`.baileys_scraper_venv`)
2. Check/install system dependencies
3. Install Python dependencies
4. Run the scraper
5. Clean up on completion

### Manual Mode
```bash
# Activate virtual environment
source .baileys_scraper_venv/bin/activate

# Run scraper directly
python3 scrape_baileys.py
```

## Output

Documentation is saved to `docs/exports/Baileys/` with the following structure:
- `docs/intro.md` - Introduction and setup
- `docs/api/` - Complete API reference
  - `classes/` - Class documentation
  - `functions/` - Function documentation
  - `interfaces/` - Interface documentation
  - `enumerations/` - Enum documentation
  - `type-aliases/` - Type definitions
- `docs/faq.md` - Frequently asked questions
- `docs/migration/` - Migration guides

## Troubleshooting

### "System dependencies missing"
Install system development headers as shown in the Requirements section above.

### "Virtual environment not activated"
The script automatically handles venv creation and activation.

### "Python dependencies failed"
Ensure system dependencies are installed, then re-run the script.

### Permission issues
The script may need sudo access for system package installation on some systems.

## Development

To modify the scraper:

1. Edit `scrape_baileys.py` for scraping logic
2. Edit `requirements-baileys.txt` for Python dependencies
3. Edit `scrape_baileys.sh` for environment setup

The scraper uses [Crawl4AI](https://github.com/unclecode/crawl4ai) for web scraping and preserves the original site structure in markdown format.
