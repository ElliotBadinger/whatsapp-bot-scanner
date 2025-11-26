#!/bin/bash

# Deployment Validation Script for whatsapp-bot-scanner
# This script validates that the entire codebase compiles properly and is ready for deployment

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to print section headers
print_section() {
    echo ""
    print_status $BLUE "=========================================="
    print_status $BLUE "$1"
    print_status $BLUE "=========================================="
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check directory exists
dir_exists() {
    [ -d "$1" ]
}

# Function to safely run a command and capture exit code
run_command() {
    "$@" >/dev/null 2>&1
    return $?
}

# Initialize counters
total_checks=0
passed_checks=0
failed_checks=0

# Function to safely increment counters
safe_increment() {
    local var_name=$1
    eval "$var_name=$((${!var_name} + 1))"
}

print_status $BLUE "🚀 Starting Deployment Validation for whatsapp-bot-scanner"
print_status $BLUE "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

# Check prerequisites
print_section "Checking Prerequisites"

# Check Node.js
if command_exists node; then
    node_version=$(node --version)
    print_status $GREEN "✓ Node.js found: $node_version"
    safe_increment total_checks
    safe_increment passed_checks
else
    print_status $RED "✗ Node.js not found"
    safe_increment total_checks
    safe_increment failed_checks
    exit 1
fi

# Check npm
if command_exists npm; then
    npm_version=$(npm --version)
    print_status $GREEN "✓ npm found: $npm_version"
    safe_increment total_checks
    safe_increment passed_checks
else
    print_status $RED "✗ npm not found"
    safe_increment total_checks
    safe_increment failed_checks
    exit 1
fi

# Check if we're in the right directory
if [ -f "package.json" ] && grep -q '"whatsapp-bot-scanner"' package.json; then
    print_status $GREEN "✓ Root package.json found and verified"
    safe_increment total_checks
    safe_increment passed_checks
else
    print_status $RED "✗ Not in the correct whatsapp-bot-scanner root directory"
    safe_increment total_checks
    safe_increment failed_checks
    exit 1
fi

# Validate workspace structure
print_section "Validating Workspace Structure"

# Check for required workspace directories
workspaces=("packages/shared" "services/control-plane" "services/scan-orchestrator" "services/wa-client")
for workspace in "${workspaces[@]}"; do
    if dir_exists "$workspace"; then
        print_status $GREEN "✓ $workspace directory exists"
        safe_increment total_checks
        safe_increment passed_checks
        
        # Check for package.json in each workspace
        if [ -f "$workspace/package.json" ]; then
            print_status $GREEN "  ✓ package.json exists in $workspace"
            safe_increment total_checks
            safe_increment passed_checks
        else
            print_status $RED "  ✗ package.json missing in $workspace"
            safe_increment total_checks
            safe_increment failed_checks
        fi
        
        # Check for tsconfig.json in each workspace
        if [ -f "$workspace/tsconfig.json" ]; then
            print_status $GREEN "  ✓ tsconfig.json exists in $workspace"
            safe_increment total_checks
            safe_increment passed_checks
        else
            print_status $RED "  ✗ tsconfig.json missing in $workspace"
            safe_increment total_checks
            safe_increment failed_checks
        fi
    else
        print_status $RED "✗ $workspace directory missing"
        safe_increment total_checks
        safe_increment failed_checks
    fi
done

# Check test workspaces
test_workspaces=("tests/integration" "tests/e2e")
for test_workspace in "${test_workspaces[@]}"; do
    if dir_exists "$test_workspace"; then
        print_status $GREEN "✓ $test_workspace directory exists"
        safe_increment total_checks
        safe_increment passed_checks
    else
        print_status $YELLOW "⚠ $test_workspace directory missing (optional)"
        safe_increment total_checks
    fi
done

# Install dependencies
print_section "Installing Dependencies"

print_status $BLUE "Installing root dependencies..."
if npm install --silent; then
    print_status $GREEN "✓ Root dependencies installed successfully"
    safe_increment total_checks
    safe_increment passed_checks
else
    print_status $RED "✗ Failed to install root dependencies"
    safe_increment total_checks
    safe_increment failed_checks
fi

# Run workspace build validation
print_section "Running Full Workspace Build"

print_status $BLUE "Running 'npm run build' for entire workspace..."
if npm run build 2>&1; then
    print_status $GREEN "✓ Full workspace build completed successfully"
    safe_increment total_checks
    safe_increment passed_checks
else
    print_status $RED "✗ Full workspace build failed"
    safe_increment total_checks
    safe_increment failed_checks
    print_status $YELLOW "Build errors detected. Will attempt individual workspace builds for debugging..."
fi

# Run individual workspace builds
print_section "Individual Workspace Build Validation"

for workspace in "${workspaces[@]}"; do
    if dir_exists "$workspace"; then
        print_status $BLUE "Building $workspace..."
        
        cd "$workspace" || continue
        
        if npm run build --silent 2>&1; then
            print_status $GREEN "✓ $workspace build completed successfully"
            safe_increment total_checks
            safe_increment passed_checks
        else
            print_status $RED "✗ $workspace build failed"
            safe_increment total_checks
            safe_increment failed_checks
            
            # Show detailed error information
            print_status $YELLOW "  Checking for common issues..."
            if [ -f "tsconfig.json" ]; then
                print_status $GREEN "  ✓ tsconfig.json exists"
            else
                print_status $RED "  ✗ tsconfig.json missing"
            fi
            
            if [ -f "package.json" ]; then
                if grep -q '"build"' package.json; then
                    print_status $GREEN "  ✓ build script defined"
                else
                    print_status $RED "  ✗ build script missing in package.json"
                fi
            fi
            
            # Check if source files exist
            if dir_exists "src"; then
                print_status $GREEN "  ✓ src directory exists"
                src_file_count=$(find src -name "*.ts" 2>/dev/null | wc -l)
                print_status $BLUE "  → TypeScript files in src: $src_file_count"
            else
                print_status $RED "  ✗ src directory missing"
            fi
        fi
        
        cd - > /dev/null || continue
    fi
done

# Check TypeScript compilation artifacts
print_section "Validating TypeScript Compilation Artifacts"

for workspace in "${workspaces[@]}"; do
    if dir_exists "$workspace"; then
        if [ -d "$workspace/dist" ]; then
            dist_files=$(find "$workspace/dist" -name "*.js" 2>/dev/null | wc -l)
            if [ "$dist_files" -gt 0 ]; then
                print_status $GREEN "✓ $workspace/dist contains $dist_files compiled JavaScript files"
                safe_increment total_checks
                safe_increment passed_checks
            else
                print_status $YELLOW "⚠ $workspace/dist exists but contains no JavaScript files"
                safe_increment total_checks
            fi
        else
            print_status $YELLOW "⚠ $workspace/dist directory missing"
            safe_increment total_checks
        fi
        
        # Check for type definitions
        if [ -f "$workspace/dist/index.d.ts" ]; then
            print_status $GREEN "  ✓ Type definitions found in $workspace/dist/index.d.ts"
            safe_increment total_checks
            safe_increment passed_checks
        fi
    fi
done

# Verify workspace configurations
print_section "Verifying Workspace Configurations"

# Check package.json workspace definitions
if grep -q '"workspaces"' package.json; then
    print_status $GREEN "✓ Root package.json defines workspaces"
    safe_increment total_checks
    safe_increment passed_checks
else
    print_status $RED "✗ Root package.json missing workspace definitions"
    safe_increment total_checks
    safe_increment failed_checks
fi

# Check for consistent TypeScript versions
typescript_versions=()
for workspace in "${workspaces[@]}"; do
    if dir_exists "$workspace" && [ -f "$workspace/package.json" ]; then
        version=$(grep -o '"typescript": "[^"]*"' "$workspace/package.json" 2>/dev/null | cut -d'"' -f4 || echo "")
        if [ -n "$version" ]; then
            typescript_versions+=("$workspace:$version")
        fi
    fi
done

if [ ${#typescript_versions[@]} -gt 0 ]; then
    print_status $BLUE "TypeScript versions found:"
    for ts_version in "${typescript_versions[@]}"; do
        print_status $BLUE "  $ts_version"
    done
    safe_increment total_checks
    safe_increment passed_checks
fi

# Summary
print_section "Validation Summary"

print_status $BLUE "Total checks performed: $total_checks"
print_status $GREEN "Checks passed: $passed_checks"

if [ $failed_checks -gt 0 ]; then
    print_status $RED "Checks failed: $failed_checks"
    echo ""
    print_status $RED "❌ DEPLOYMENT VALIDATION FAILED"
    print_status $YELLOW ""
    print_status $YELLOW "Troubleshooting steps:"
    print_status $YELLOW "1. Check the error messages above for specific issues"
    print_status $YELLOW "2. Run 'npm install' to ensure all dependencies are installed"
    print_status $YELLOW "3. Check TypeScript configuration files (tsconfig.json) in each workspace"
    print_status $YELLOW "4. Verify source code syntax in any workspace that failed"
    print_status $YELLOW "5. Check for circular dependencies between workspaces"
    print_status $YELLOW "6. Run 'npm run lint' to identify code quality issues"
    echo ""
    exit 1
else
    print_status $GREEN "Checks failed: 0"
    echo ""
    print_status $GREEN "✅ DEPLOYMENT VALIDATION PASSED"
    print_status $GREEN ""
    print_status $GREEN "The codebase is ready for deployment!"
    print_status $BLUE ""
    print_status $BLUE "Next steps:"
    print_status $BLUE "1. Run 'npm run test' to execute test suites"
    print_status $BLUE "2. Review the compiled JavaScript files in each workspace's dist/ directory"
    print_status $BLUE "3. Consider running 'npm run lint' for code quality checks"
    print_status $BLUE "4. Use 'make build' to build Docker containers for deployment"
    echo ""
    exit 0
fi