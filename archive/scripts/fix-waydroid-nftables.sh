#!/bin/bash
# Fix waydroid_filter nftables rules that block Docker inter-container communication
# The waydroid_filter table has a FORWARD chain with policy drop that runs before Docker's iptables rules
# This script adds an accept rule to allow all forwarded traffic after waydroid-specific rules

set -e

# Check if waydroid_filter table exists
if nft list table ip waydroid_filter &>/dev/null; then
    echo "Fixing waydroid_filter nftables rules..."
    
    # Check if the accept rule already exists
    if ! nft list chain ip waydroid_filter FORWARD 2>/dev/null | grep -q "accept$"; then
        # Add accept rule at the end of the FORWARD chain
        nft add rule ip waydroid_filter FORWARD accept
        echo "Added accept rule to waydroid_filter FORWARD chain"
    else
        echo "Accept rule already exists in waydroid_filter FORWARD chain"
    fi
else
    echo "waydroid_filter table does not exist, skipping"
fi
