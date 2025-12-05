#!/bin/bash
# Baileys Documentation Scraper with Automatic Venv Setup
# This script automatically sets up a virtual environment and installs dependencies

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VENV_DIR=".baileys_scraper_venv"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_SCRIPT="${SCRIPT_DIR}/scrape_baileys.py"
REQUIREMENTS_FILE="${SCRIPT_DIR}/requirements-baileys.txt"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Python 3 is available
check_python() {
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 is not installed or not in PATH"
        exit 1
    fi

    PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
    print_status "Found Python ${PYTHON_VERSION}"
}

# Check if venv module is available
check_venv() {
    if ! python3 -c "import venv" &> /dev/null; then
        print_error "Python venv module is not available"
        print_error "Please install python3-venv or ensure venv is available"
        exit 1
    fi
    print_status "venv module is available"
}

# Create virtual environment if it doesn't exist
create_venv() {
    if [ ! -d "$VENV_DIR" ]; then
        print_status "Creating virtual environment in ${VENV_DIR}"

        # Try to use system Python if available (for better compatibility with system packages)
        if [ -x "/usr/bin/python3" ]; then
            print_status "Using system Python for virtual environment"
            /usr/bin/python3 -m venv "$VENV_DIR"
        else
            print_status "Using default Python for virtual environment"
            python3 -m venv "$VENV_DIR"
        fi
        print_success "Virtual environment created"
    else
        print_status "Virtual environment already exists"
    fi
}

# Activate virtual environment
activate_venv() {
    print_status "Activating virtual environment"
    source "${VENV_DIR}/bin/activate"

    # Verify we're in the venv
    if [[ "$VIRTUAL_ENV" != *"$VENV_DIR"* ]]; then
        print_error "Failed to activate virtual environment"
        exit 1
    fi

    print_success "Virtual environment activated: $VIRTUAL_ENV"
}

# Create requirements file if it doesn't exist
create_requirements() {
    if [ ! -f "$REQUIREMENTS_FILE" ]; then
        print_status "Creating requirements file: ${REQUIREMENTS_FILE}"
        cat > "$REQUIREMENTS_FILE" << 'EOF'
crawl4ai>=0.3.0
EOF
        print_success "Requirements file created"
    fi
}

# Check system dependencies (Linux specific)
check_system_deps() {
    print_status "Checking system dependencies"

    # Check if we're on Linux
    if [[ "$OSTYPE" != "linux-gnu"* ]]; then
        print_warning "Non-Linux system detected. System dependencies may vary."
        return 0
    fi

    # Try to compile a simple C program that uses libxml2
    # Create a temporary C file for testing
    cat > /tmp/test_libxml2.c << 'EOF'
#include <libxml2/libxml/parser.h>
int main() {
    xmlInitParser();
    return 0;
}
EOF

    # Try to compile with pkg-config first, then fallback to manual flags
    if pkg-config --exists libxml-2.0 libxslt 2>/dev/null; then
        if gcc -o /tmp/test_libxml2 /tmp/test_libxml2.c $(pkg-config --cflags --libs libxml-2.0 libxslt) 2>/dev/null; then
            print_success "System dependencies available (pkg-config)"
            rm -f /tmp/test_libxml2 /tmp/test_libxml2.c
            return 0
        fi
    fi

    # Fallback: try manual compilation
    if gcc -o /tmp/test_libxml2 /tmp/test_libxml2.c -I/usr/include/libxml2 -lxml2 -lxslt 2>/dev/null; then
        print_success "System dependencies available (manual flags)"
        rm -f /tmp/test_libxml2 /tmp/test_libxml2.c
        return 0
    fi

    # Check if packages are installed (alternative method)
    if rpm -q libxml2-devel libxslt-devel &>/dev/null; then
        print_warning "System dependencies installed but compilation test failed"
        print_warning "This might be okay - Python wheels may work despite this warning"
        rm -f /tmp/test_libxml2.c
        return 0
    fi

    print_warning "libxml2 development headers not found!"
    print_warning "Install system dependencies manually:"
    if command -v apt &> /dev/null; then
        print_warning "  Ubuntu/Debian: sudo apt install libxml2-dev libxslt-dev"
    elif command -v dnf &> /dev/null; then
        print_warning "  Fedora/RHEL: sudo dnf install libxml2-devel libxslt-devel"
    elif command -v yum &> /dev/null; then
        print_warning "  CentOS/RHEL: sudo yum install libxml2-devel libxslt-devel"
    elif command -v pacman &> /dev/null; then
        print_warning "  Arch Linux: sudo pacman -S libxml2 libxslt"
    else
        print_warning "  Unknown system - search for 'libxml2 development headers'"
    fi
    print_warning "Then re-run this script."

    rm -f /tmp/test_libxml2.c
    return 1
}

# Check additional development tools
check_dev_tools() {
    print_status "Checking development tools"

    local missing_tools=()

    # Check for Python development headers
    if ! rpm -q python3-devel &>/dev/null && ! dpkg -l python3-dev &>/dev/null; then
        missing_tools+=("python3-devel")
    fi

    # Check for GCC
    if ! command -v gcc &> /dev/null; then
        missing_tools+=("gcc")
    fi

    if [ ${#missing_tools[@]} -gt 0 ]; then
        print_warning "Additional development tools needed: ${missing_tools[*]}"
        print_warning "Install with:"
        print_warning "  Fedora/RHEL: sudo dnf install ${missing_tools[*]}"
        print_warning "  Ubuntu/Debian: sudo apt install python3-dev gcc"
        return 1
    fi

    print_success "Development tools available"
    return 0
}

# Install/update dependencies
install_dependencies() {
    print_status "Installing/updating Python dependencies"

    # Check system deps first
    if ! check_system_deps; then
        print_error "System dependencies missing. Install them and try again."
        exit 1
    fi

    # Check development tools
    if ! check_dev_tools; then
        print_error "Development tools missing. Install them and try again."
        exit 1
    fi

    # Upgrade pip first
    pip install --upgrade pip

    # Install requirements
    if pip install -r "$REQUIREMENTS_FILE"; then
        print_success "Python dependencies installed successfully"

        # Install Playwright browsers (required for crawl4ai)
        print_status "Installing Playwright browsers..."
        if playwright install chromium; then
            print_success "Playwright browsers installed"
        else
            print_warning "Failed to install Playwright browsers automatically"
            print_warning "You may need to run: playwright install"
        fi
    else
        print_error "Failed to install Python dependencies"
        print_error "This might be due to missing system libraries."
        if command -v dnf &> /dev/null; then
            print_error "Try installing: sudo dnf install libxml2-devel libxslt-devel python3-devel gcc redhat-rpm-config"
        elif command -v apt &> /dev/null; then
            print_error "Try installing: sudo apt install libxml2-dev libxslt-dev python3-dev gcc"
        fi
        exit 1
    fi
}

# Check if Python script exists
check_script() {
    if [ ! -f "$PYTHON_SCRIPT" ]; then
        print_error "Python script not found: ${PYTHON_SCRIPT}"
        exit 1
    fi
    print_status "Found Python script: $(basename "$PYTHON_SCRIPT")"
}

# Test the setup
test_setup() {
    print_status "Testing scraper setup"

    TEST_SCRIPT="${SCRIPT_DIR}/test_scraper_setup.py"
    if [ ! -f "$TEST_SCRIPT" ]; then
        print_warning "Test script not found, skipping setup test"
        return 0
    fi

    if python3 "$TEST_SCRIPT"; then
        print_success "Setup test passed"
        return 0
    else
        print_error "Setup test failed"
        return 1
    fi
}

# Run the Python script
run_scraper() {
    print_status "Running Baileys documentation scraper"
    echo "=========================================="

    # Check if script exists
    if [ ! -f "$PYTHON_SCRIPT" ]; then
        print_error "Python script not found: $PYTHON_SCRIPT"
        exit 1
    fi

    # Run setup test
    if ! test_setup; then
        exit 1
    fi

    # Run the actual scraper
    echo ""
    if python3 "$PYTHON_SCRIPT"; then
        print_success "Scraping completed successfully"
    else
        print_error "Scraping failed"
        exit 1
    fi
}

# Main execution
main() {
    echo "🚀 Baileys Documentation Scraper"
    echo "=================================="

    check_python
    check_venv
    create_venv
    activate_venv
    create_requirements
    install_dependencies
    check_script
    run_scraper

    echo ""
    print_success "All operations completed successfully!"
    print_status "Virtual environment remains at: ${VENV_DIR}"
    print_status "You can manually activate it later with: source ${VENV_DIR}/bin/activate"
}

# Cleanup function (runs on exit)
cleanup() {
    # Deactivate venv if active
    if [[ -n "$VIRTUAL_ENV" ]]; then
        print_status "Deactivating virtual environment"
        deactivate 2>/dev/null || true
    fi
}

# Set up cleanup on exit
trap cleanup EXIT

# Run main function
main "$@"
