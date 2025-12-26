#!/bin/bash
# Fix Firewalld blocking Docker internet access

set -e

echo "🔧 Fixing Firewalld Docker integration..."

# Create docker zone if it doesn't exist
echo "Creating Docker firewall zone..."
sudo firewall-cmd --permanent --new-zone=docker 2>/dev/null || echo "  → Docker zone already exists"

# Add all Docker bridge interfaces
echo "Adding Docker interfaces to zone..."
for iface in docker0 br-* ; do
    if ip link show "$iface" &>/dev/null; then
        sudo firewall-cmd --permanent --zone=docker --add-interface="$iface" 2>/dev/null || echo "  → $iface already in zone"
    fi
done

# Enable masquerading (NAT) for Docker
echo "Enabling masquerading..."
sudo firewall-cmd --permanent --zone=docker --add-masquerade

# Set zone target to ACCEPT
echo "Setting zone target to ACCEPT..."
sudo firewall-cmd --permanent --zone=docker --set-target=ACCEPT

# Reload firewall
echo "Reloading firewall..."
sudo firewall-cmd --reload

# Verify
echo ""
echo "✅ Firewalld configuration applied!"
echo ""
echo "Verification:"
sudo firewall-cmd --zone=docker --list-all

echo ""
echo "Testing Docker internet access..."
docker run --rm alpine ping -c 2 8.8.8.8 && echo "✅ Docker can reach internet!" || echo "❌ Still blocked"
