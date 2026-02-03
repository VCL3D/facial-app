#!/usr/bin/env python3
"""
View client-side logs for a session
Usage: python view_client_logs.py <session_id>
"""

import sys
import json
from pathlib import Path

def view_logs(session_id):
    """View client logs for a session"""
    session_dir = Path(__file__).parent / 'data' / 'facial_recordings' / session_id
    log_file = session_dir / 'client.log'

    if not log_file.exists():
        print(f"❌ No client logs found for session {session_id}")
        print(f"   Expected: {log_file}")
        return

    print(f"📋 Client logs for session: {session_id}")
    print(f"   Log file: {log_file}")
    print("=" * 80)

    with open(log_file, 'r') as f:
        line_count = 0
        for line in f:
            line_count += 1
            try:
                log_entry = json.loads(line.strip())
                timestamp = log_entry.get('timestamp', 'N/A')
                level = log_entry.get('level', 'info').upper()
                message = log_entry.get('message', '')
                context = log_entry.get('context', {})

                # Color code by level
                if level == 'ERROR':
                    color = '\033[91m'  # Red
                elif level == 'WARN':
                    color = '\033[93m'  # Yellow
                else:
                    color = '\033[92m'  # Green
                reset = '\033[0m'

                print(f"{color}[{timestamp}] {level}{reset}: {message}")

                if context:
                    print(f"   Context: {json.dumps(context, indent=2)}")

                print()

            except json.JSONDecodeError:
                print(f"⚠️ Invalid JSON on line {line_count}: {line}")

    print("=" * 80)
    print(f"✅ Total log entries: {line_count}")

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("Usage: python view_client_logs.py <session_id>")
        print("\nExample:")
        print("  python view_client_logs.py 5b92c82e-13bb-4eb9-b3e8-a8553ce9b096")
        sys.exit(1)

    session_id = sys.argv[1]
    view_logs(session_id)
