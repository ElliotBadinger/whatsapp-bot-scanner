#!/usr/bin/env python3
"""
Scrape Baileys documentation using Crawl4AI.

This script crawls https://baileys.wiki/docs and https://baileys.wiki/docs/api/
and saves the content as markdown files while preserving the site's file structure.
"""
import asyncio
import os
import re
from pathlib import Path
from urllib.parse import urlparse, unquote

from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
from crawl4ai.deep_crawling import DFSDeepCrawlStrategy
from crawl4ai.deep_crawling.filters import FilterChain, DomainFilter
from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator


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
    output_dir = "docs/export"
    
    print("🚀 Starting Baileys documentation scraper")
    print(f"📁 Output directory: {output_dir}")
    print(f"🌐 URLs to scrape: {', '.join(start_urls)}\n")
    
    # Create output directory
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
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
    async with AsyncWebCrawler(config=browser_config) as crawler:
        for start_url in start_urls:
            print(f"\n📖 Crawling from: {start_url}")
            print("=" * 60)
            
            page_count = 0
            async for result in await crawler.arun(url=start_url, config=run_config):
                page_count += 1
                depth = result.metadata.get("depth", 0)
                status = "SUCCESS" if result.success else "FAILED"
                print(f"[{status}] Depth={depth} | {result.url}")
                
                # Save the result
                await save_result(result, base_url, output_dir)
            
            print(f"\n✅ Completed crawling from {start_url}")
            print(f"📊 Total pages crawled: {page_count}\n")
    
    print("\n🎉 Scraping complete!")
    print(f"📁 All files saved to: {output_dir}")


if __name__ == "__main__":
    asyncio.run(scrape_baileys_docs())
