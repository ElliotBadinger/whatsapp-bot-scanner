#!/bin/bash
# Trigger a manual pairing code request
echo "Requesting new pairing code..."
curl -X POST http://127.0.0.1:3000/pair
echo ""
echo "Check 'docker compose logs wa-client' for the code."
