#!/bin/bash
# Quick Firewalld Fix - Enable masquerading on public zone

echo "🔧 Quick Firewalld Fix..."
echo "This enables NAT for Docker containers"
echo ""

sudo firewall-cmd --zone=public --add-masquerade --permanent
sudo firewall-cmd --reload

echo ""
echo "✅ Masquerading enabled on public zone"
echo ""
echo "Testing Docker internet connectivity..."
docker run --rm alpine ping -c 2 google.com && echo "✅ SUCCESS!" || echo "❌ Still blocked, needs more investigation"
