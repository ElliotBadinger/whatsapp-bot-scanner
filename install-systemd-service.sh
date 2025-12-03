#!/bin/bash
# Install the Waydroid-Docker fix as a systemd service

set -e

SERVICE_FILE="waydroid-docker-fix.service"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔧 Installing Waydroid-Docker fix systemd service..."
echo ""

# Copy service file to systemd directory
echo "Copying service file to /etc/systemd/system/..."
sudo cp "$SCRIPT_DIR/$SERVICE_FILE" /etc/systemd/system/

# Reload systemd
echo "Reloading systemd daemon..."
sudo systemctl daemon-reload

# Enable the service
echo "Enabling service to run on boot..."
sudo systemctl enable waydroid-docker-fix.service

echo ""
echo "✅ Service installed and enabled!"
echo ""
echo "To manually run the fix:"
echo "  sudo systemctl start waydroid-docker-fix"
echo ""
echo "To check service status:"
echo "  sudo systemctl status waydroid-docker-fix"
echo ""
echo "To view logs:"
echo "  journalctl -u waydroid-docker-fix"
echo ""
echo "To disable on boot:"
echo "  sudo systemctl disable waydroid-docker-fix"
