#!/bin/bash
# Fix Waydroid nftables blocking Docker containers
# The Waydroid filter chain has higher priority and drops all non-Waydroid traffic
# This script adds rules to allow Docker bridge interfaces

set -e

echo "🔧 Fixing Waydroid nftables conflict with Docker..."

# Check if waydroid_filter table exists
if ! sudo nft list table ip waydroid_filter &>/dev/null; then
    echo "✅ Waydroid filter table not found - no fix needed"
    exit 0
fi

echo "Found Waydroid filter table - applying Docker compatibility rules..."

# Flush the FORWARD chain
sudo nft flush chain ip waydroid_filter FORWARD

# Re-add rules in the correct order (Docker rules BEFORE return)
sudo nft add rule ip waydroid_filter FORWARD iifname "waydroid0" oifname "wlp0s20f3" accept
sudo nft add rule ip waydroid_filter FORWARD iifname "wlp0s20f3" oifname "waydroid0" accept
sudo nft add rule ip waydroid_filter FORWARD iifname "docker0" accept
sudo nft add rule ip waydroid_filter FORWARD oifname "docker0" accept
sudo nft add rule ip waydroid_filter FORWARD iifname "br-*" accept
sudo nft add rule ip waydroid_filter FORWARD oifname "br-*" accept
sudo nft add rule ip waydroid_filter FORWARD return

echo ""
echo "✅ Waydroid-Docker compatibility rules applied!"
echo ""
echo "Current waydroid_filter table:"
sudo nft list table ip waydroid_filter

echo ""
echo "Testing Docker internet connectivity..."
if docker run --rm alpine ping -c 2 8.8.8.8 &>/dev/null; then
    echo "✅ Docker containers can reach internet!"
else
    echo "❌ Still blocked - please check configuration"
    exit 1
fi
