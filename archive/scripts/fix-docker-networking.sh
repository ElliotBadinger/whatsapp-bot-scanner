#!/bin/bash
# Fix Docker bridge networking on Fedora with firewalld
# This script adds rules to allow inter-container communication

set -e

echo "Fixing Docker bridge networking on Fedora..."

# Method 1: Disable bridge-nf-call-iptables (may break external connectivity)
# sudo sysctl -w net.bridge.bridge-nf-call-iptables=0

# Method 2: Add DOCKER-USER rules for bridge traffic
echo "Adding nftables rules for Docker bridge traffic..."
sudo nft add rule ip filter DOCKER-USER iifname "br-*" oifname "br-*" accept 2>/dev/null || true

# Method 3: Add firewalld direct rules
echo "Adding firewalld direct rules..."
sudo firewall-cmd --permanent --direct --add-rule ipv4 filter FORWARD 0 -i br-+ -o br-+ -j ACCEPT 2>/dev/null || true
sudo firewall-cmd --reload 2>/dev/null || true

# Method 4: Add Docker networks to trusted zone
echo "Adding Docker networks to trusted zone..."
for net in $(docker network ls --format '{{.ID}}' 2>/dev/null); do
    bridge="br-${net:0:12}"
    if ip link show "$bridge" &>/dev/null; then
        sudo firewall-cmd --permanent --zone=trusted --add-interface="$bridge" 2>/dev/null || true
    fi
done
sudo firewall-cmd --reload 2>/dev/null || true

echo "Done. Restart Docker and your containers:"
echo "  sudo systemctl restart docker"
echo "  docker compose down && docker compose up -d"
