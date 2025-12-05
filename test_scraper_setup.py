#!/usr/bin/env python3
"""
Test script to verify scraper setup without running full scrape.
"""
import sys
import os

def test_imports():
    """Test that required modules can be imported."""
    try:
        import crawl4ai
        print("✅ crawl4ai imported successfully")
        return True
    except ImportError as e:
        print(f"❌ Failed to import crawl4ai: {e}")
        return False

def test_venv():
    """Test if running in virtual environment."""
    in_venv = hasattr(sys, 'real_prefix') or (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix)
    if in_venv:
        venv_path = os.environ.get('VIRTUAL_ENV', 'Unknown')
        print(f"✅ Running in virtual environment: {venv_path}")
        return True
    else:
        print("❌ Not running in virtual environment")
        return False

def main():
    print("🔍 Testing scraper setup...")
    print(f"Python version: {sys.version}")
    print(f"Working directory: {os.getcwd()}")
    print()

    venv_ok = test_venv()
    imports_ok = test_imports()

    if venv_ok and imports_ok:
        print("✅ Setup test passed!")
        return 0
    else:
        print("❌ Setup test failed!")
        return 1

if __name__ == "__main__":
    sys.exit(main())

