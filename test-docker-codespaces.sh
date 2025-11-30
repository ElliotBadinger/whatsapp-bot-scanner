#!/usr/bin/env bash
# Diagnostic script to test Docker access in Codespaces

echo "=== Docker Diagnostic Script for Codespaces ==="
echo ""

echo "1. Checking environment variables:"
echo "   CODESPACES: ${CODESPACES:-not set}"
echo "   GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: ${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-not set}"
echo ""

echo "2. Checking Docker binary:"
which docker || echo "   Docker binary not found in PATH"
docker --version 2>/dev/null || echo "   Cannot run docker --version"
echo ""

echo "3. Checking user groups:"
groups
echo ""

echo "4. Checking Docker socket:"
ls -la /var/run/docker.sock 2>/dev/null || echo "   /var/run/docker.sock not found"
echo ""

echo "5. Testing Docker access (without sudo):"
if docker info >/dev/null 2>&1; then
  echo "   ✓ Docker is accessible without sudo"
  docker info | grep -E "Server Version|Storage Driver|Operating System"
else
  echo "   ✗ Docker not accessible without sudo"
  echo "   Error output:"
  docker info 2>&1 | head -5
fi
echo ""

echo "6. Testing Docker socket permissions:"
if [ -S /var/run/docker.sock ]; then
  echo "   Socket permissions: $(ls -l /var/run/docker.sock)"
  if [ -r /var/run/docker.sock ] && [ -w /var/run/docker.sock ]; then
    echo "   ✓ Socket is readable and writable"
  else
    echo "   ✗ Socket lacks read/write permissions"
  fi
else
  echo "   ✗ Docker socket not found or not a socket"
fi
echo ""

echo "7. Checking if Docker daemon is running:"
pgrep dockerd >/dev/null && echo "   ✓ dockerd process is running" || echo "   ✗ dockerd process not found"
echo ""

echo "8. Testing Docker ps:"
if docker ps >/dev/null 2>&1; then
  echo "   ✓ Can list containers"
  docker ps --format "table {{.Names}}\t{{.Status}}"
else
  echo "   ✗ Cannot list containers"
  docker ps 2>&1 | head -3
fi
echo ""

echo "=== End of diagnostic ==="
