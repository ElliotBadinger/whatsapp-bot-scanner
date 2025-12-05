#!/usr/bin/env python3
"""
Scrape and update Baileys documentation using Crawl4AI.

This script crawls https://baileys.wiki/docs and https://baileys.wiki/docs/api/
and saves the content as markdown files while preserving the site's file structure.
It updates the documentation in docs/exports/Baileys/ directory.
"""
import asyncio
import os
import re
import shutil
import sys
from pathlib import Path
from urllib.parse import urlparse, unquote

try:
    from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
    from crawl4ai.deep_crawling import DFSDeepCrawlStrategy
    from crawl4ai.deep_crawling.filters import FilterChain, DomainFilter
    from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator
except ImportError as e:
    print("❌ Error: Required dependencies not found!")
    print(f"   Missing: {e}")
    print("   Please run the script using: ./scrape_baileys.sh")
    print("   Or install dependencies manually: pip install crawl4ai>=0.3.0")
    sys.exit(1)


def url_to_filepath(url: str, base_url: str, output_dir: str) -> Path:
    """
    Convert a URL to a file path while preserving the site structure.
    
    Args:
        url: The URL to convert
        base_url: The base URL of the site
        output_dir: The output directory for saved files
        
    Returns:
        Path object for the output file
    """
    parsed = urlparse(url)
    path = unquote(parsed.path)
    
    # Remove leading slash
    if path.startswith('/'):
        path = path[1:]
    
    # Handle index pages (URLs ending with /)
    if path.endswith('/'):
        path = path + 'index'
    
    # Remove .html or .htm extensions if present
    path = re.sub(r'\.(html?|php)$', '', path)
    
    # Sanitize filename - replace invalid characters
    path = re.sub(r'[<>:"|?*]', '_', path)
    
    # Create full path
    full_path = Path(output_dir) / f"{path}.md"
    
    return full_path


async def save_result(result, base_url: str, output_dir: str):
    """
    Save a crawl result to a markdown file.
    
    Args:
        result: The crawl result object
        base_url: The base URL of the site
        output_dir: The output directory for saved files
    """
    if not result.success:
        print(f"❌ Failed to crawl: {result.url}")
        return
    
    # Get the file path
    filepath = url_to_filepath(result.url, base_url, output_dir)
    
    # Create directory if it doesn't exist
    filepath.parent.mkdir(parents=True, exist_ok=True)
    
    # Save the markdown content
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            # Add metadata header
            f.write(f"# Source: {result.url}\n\n")
            f.write(f"<!-- Scraped from {result.url} -->\n\n")
            
            # Write the markdown content
            if hasattr(result.markdown, 'raw_markdown'):
                f.write(result.markdown.raw_markdown)
            else:
                f.write(result.markdown)
        
        print(f"✅ Saved: {filepath.relative_to(output_dir)}")
    except Exception as e:
        print(f"❌ Error saving {result.url}: {e}")


def clean_existing_docs(output_dir: str):
    """
    Clean existing documentation directory.

    Args:
        output_dir: The output directory to clean
    """
    output_path = Path(output_dir)
    if output_path.exists():
        print(f"🧹 Cleaning existing documentation in {output_dir}")
        shutil.rmtree(output_path)
    output_path.mkdir(parents=True, exist_ok=True)
    print(f"📁 Created fresh output directory: {output_dir}")


def check_environment():
    """
    Check and display environment information.
    """
    print("🔍 Environment Check:")

    # Check Python version
    python_version = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    print(f"   Python version: {python_version}")

    # Check if running in virtual environment
    in_venv = hasattr(sys, 'real_prefix') or (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix)
    venv_status = "Yes" if in_venv else "No"
    if in_venv:
        venv_path = os.environ.get('VIRTUAL_ENV', 'Unknown')
        print(f"   Virtual environment: {venv_status} ({venv_path})")
    else:
        print(f"   Virtual environment: {venv_status}")

    # Check current working directory
    print(f"   Working directory: {os.getcwd()}")

    print()


async def scrape_baileys_docs():
    """
    Main function to scrape Baileys documentation.
    """
    # Configuration
    base_url = "https://baileys.wiki"
    start_urls = [
        "https://baileys.wiki/docs",
        "https://baileys.wiki/docs/api/",
    ]
    output_dir = "docs/exports/Baileys"

    print("🚀 Starting Baileys documentation scraper")
    check_environment()
    print(f"📁 Output directory: {output_dir}")
    print(f"🌐 URLs to scrape: {', '.join(start_urls)}\n")

    # Clean existing docs and create fresh directory
    clean_existing_docs(output_dir)
    
    # Set up the deep crawl strategy
    dfs_strategy = DFSDeepCrawlStrategy(
        max_depth=5,  # Crawl up to 5 levels deep
        max_pages=200,  # Limit to 200 pages to avoid excessive crawling
        include_external=False,  # Only crawl within baileys.wiki
    )
    
    # Set up filters to only crawl baileys.wiki domain
    filter_chain = FilterChain([
        DomainFilter(
            allowed_domains=["baileys.wiki"],
            blocked_domains=[],
        ),
    ])
    
    # Update the strategy with filters
    dfs_strategy.filter_chain = filter_chain
    
    # Browser configuration
    browser_config = BrowserConfig(
        headless=True,
        verbose=False,
    )
    
    # Crawler configuration
    run_config = CrawlerRunConfig(
        deep_crawl_strategy=dfs_strategy,
        markdown_generator=DefaultMarkdownGenerator(),
        cache_mode=CacheMode.BYPASS,
        stream=True,  # Stream results for real-time processing
        verbose=True,
    )
    
    # Start crawling
    total_pages = 0
    successful_pages = 0

    async with AsyncWebCrawler(config=browser_config) as crawler:
        for start_url in start_urls:
            print(f"\n📖 Crawling from: {start_url}")
            print("=" * 60)

            page_count = 0
            start_successful = successful_pages

            async for result in await crawler.arun(url=start_url, config=run_config):
                page_count += 1
                total_pages += 1
                depth = result.metadata.get("depth", 0)
                status = "SUCCESS" if result.success else "FAILED"

                if result.success:
                    successful_pages += 1

                print(f"[{status}] Depth={depth} | {result.url}")

                # Save the result
                await save_result(result, base_url, output_dir)

            print(f"\n✅ Completed crawling from {start_url}")
            print(f"📊 Pages from this URL: {page_count}")
            print(f"📊 Successful pages from this URL: {successful_pages - start_successful}\n")

    print("\n🎉 Scraping complete!")
    print(f"📁 All files saved to: {output_dir}")
    print(f"📊 Total pages crawled: {total_pages}")
    print(f"📊 Successful pages: {successful_pages}")
    print(f"📊 Failed pages: {total_pages - successful_pages}")

    # Count files created
    output_path = Path(output_dir)
    if output_path.exists():
        md_files = list(output_path.rglob("*.md"))
        print(f"📄 Total markdown files created: {len(md_files)}")

        # Show some examples
        if md_files:
            print("\n📋 Sample files created:")
            for file in md_files[:5]:
                print(f"  - {file.relative_to(output_path)}")
            if len(md_files) > 5:
                print(f"  ... and {len(md_files) - 5} more files")


if __name__ == "__main__":
    asyncio.run(scrape_baileys_docs())
