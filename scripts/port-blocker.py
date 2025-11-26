#!/usr/bin/env python3
"""Port blocker for testing setup script port conflict resolution."""
import socket
import sys
import time
import signal

def block_port(port, duration=60):
    """Block a port for a specified duration."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind(('127.0.0.1', port))
        s.listen(1)
        print(f"Blocking port {port} for {duration} seconds...", flush=True)
        
        def signal_handler(sig, frame):
            print(f"\nReleasing port {port}...", flush=True)
            s.close()
            sys.exit(0)
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        time.sleep(duration)
        s.close()
        print(f"Released port {port}", flush=True)
    except Exception as e:
        print(f"Error blocking port {port}: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: port-blocker.py <port> [duration_seconds]", file=sys.stderr)
        sys.exit(1)
    
    port = int(sys.argv[1])
    duration = int(sys.argv[2]) if len(sys.argv) > 2 else 60
    block_port(port, duration)
