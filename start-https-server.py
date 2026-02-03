#!/usr/bin/env python3
"""
HTTPS Server for Frontend with Self-Signed Certificate
"""

import http.server
import ssl
import os
import sys

# Configuration
PORT = 8001
CERT_FILE = 'ssl/cert.pem'
KEY_FILE = 'ssl/key.pem'

def main():
    # Change to frontend directory
    frontend_dir = os.path.join(os.path.dirname(__file__), 'frontend')
    os.chdir(frontend_dir)

    # Check if certificate files exist
    cert_path = os.path.join('..', CERT_FILE)
    key_path = os.path.join('..', KEY_FILE)

    if not os.path.exists(cert_path) or not os.path.exists(key_path):
        print("❌ Error: SSL certificate files not found!")
        print(f"   Expected: {cert_path} and {key_path}")
        print("\nGenerate them with:")
        print("  cd /home/akanlis/Desktop/facial-app")
        print("  mkdir -p ssl")
        print("  cd ssl")
        print("  openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes")
        sys.exit(1)

    # Create HTTPS server
    handler = http.server.SimpleHTTPRequestHandler
    httpd = http.server.HTTPServer(('0.0.0.0', PORT), handler)

    # Wrap with SSL
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile=cert_path, keyfile=key_path)
    httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

    print("=" * 60)
    print("HTTPS Frontend Server Started")
    print("=" * 60)
    print(f"Local:    https://localhost:{PORT}")
    print(f"Network:  https://195.251.117.230:{PORT}")
    print("")
    print("⚠️  WARNING: Self-signed certificate")
    print("You will see a browser security warning - this is normal.")
    print("Click 'Advanced' -> 'Proceed to site' to continue.")
    print("=" * 60)
    print("\nPress Ctrl+C to stop")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n✅ Server stopped")
        sys.exit(0)

if __name__ == '__main__':
    main()
