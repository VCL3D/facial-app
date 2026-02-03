#!/usr/bin/env python3
"""
View Participant Data - Development Tool
Shows all participants with their video details, resolutions, FPS, browsers, etc.
"""

import json
from pathlib import Path
from datetime import datetime
import sys

# Data directory
DATA_DIR = Path(__file__).parent / 'data' / 'facial_recordings'

def format_size(bytes_size):
    """Convert bytes to human-readable format"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_size < 1024.0:
            return f"{bytes_size:.2f} {unit}"
        bytes_size /= 1024.0
    return f"{bytes_size:.2f} TB"

def get_video_link(session_id, video_file):
    """Generate video URL"""
    return f"https://facestudy.detector-project.eu:8000/data/facial_recordings/{session_id}/{video_file}"

def main():
    if not DATA_DIR.exists():
        print(f"❌ Data directory not found: {DATA_DIR}")
        return

    sessions = []

    # Iterate through all session directories
    for session_dir in DATA_DIR.iterdir():
        if not session_dir.is_dir():
            continue

        session_file = session_dir / 'session.json'
        if not session_file.exists():
            continue

        try:
            with open(session_file, 'r') as f:
                session_data = json.load(f)

            # Get all video files and their metadata
            videos = []
            for video_file in session_dir.glob('*.webm'):
                metadata_file = session_dir / f"{video_file.stem}.metadata.json"

                video_info = {
                    'filename': video_file.name,
                    'size': video_file.stat().st_size,
                    'link': get_video_link(session_data['session_id'], video_file.name)
                }

                # Load metadata if exists
                if metadata_file.exists():
                    with open(metadata_file, 'r') as f:
                        metadata = json.load(f)
                        video_info.update({
                            'resolution': metadata.get('resolution', 'N/A'),
                            'fps': metadata.get('frame_rate', metadata.get('frameRate', 'N/A')),
                            'browser': metadata.get('browser', 'N/A'),
                            'codec': metadata.get('codec', metadata.get('videoCodec', 'N/A')),
                            'duration': metadata.get('duration', 'N/A'),
                            'prompt_id': metadata.get('prompt_id', metadata.get('promptId', 'N/A'))
                        })

                videos.append(video_info)

            sessions.append({
                'session_id': session_data['session_id'],
                'participant_name': session_data.get('participant_name', 'Anonymous'),
                'created_at': session_data.get('created_at'),
                'video_count': len(videos),
                'videos': videos
            })

        except Exception as e:
            print(f"⚠️  Error reading session {session_dir.name}: {e}")
            continue

    # Sort by created_at (newest first)
    sessions.sort(key=lambda x: x['created_at'], reverse=True)

    # Display results
    print("=" * 100)
    print("📊 PARTICIPANT DATA VIEWER")
    print("=" * 100)
    print(f"\nTotal Participants: {len(sessions)}")
    print(f"Total Videos: {sum(s['video_count'] for s in sessions)}\n")

    for idx, session in enumerate(sessions, 1):
        print(f"\n{'─' * 100}")
        print(f"🧑 PARTICIPANT #{idx}: {session['participant_name']}")
        print(f"{'─' * 100}")
        print(f"Session ID:    {session['session_id']}")
        print(f"Created:       {datetime.fromisoformat(session['created_at']).strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Videos:        {session['video_count']}")

        if session['videos']:
            print(f"\n📹 Videos:")
            for video_idx, video in enumerate(session['videos'], 1):
                print(f"\n  Video {video_idx}: {video['filename']}")
                print(f"    Prompt ID:    {video.get('prompt_id', 'N/A')}")
                print(f"    Size:         {format_size(video['size'])}")
                print(f"    Resolution:   {video.get('resolution', 'N/A')}")
                print(f"    FPS:          {video.get('fps', 'N/A')}")
                print(f"    Codec:        {video.get('codec', 'N/A')}")
                print(f"    Browser:      {video.get('browser', 'N/A')}")
                print(f"    Duration:     {video.get('duration', 'N/A')}s")
                print(f"    Link:         {video['link']}")

    print(f"\n{'=' * 100}\n")

    # Summary statistics
    print("📈 SUMMARY STATISTICS:")
    print(f"{'─' * 100}")

    total_size = sum(video['size'] for session in sessions for video in session['videos'])
    print(f"Total Storage Used:  {format_size(total_size)}")

    # Resolution breakdown
    resolutions = {}
    fps_values = {}
    browsers = {}
    codecs = {}

    for session in sessions:
        for video in session['videos']:
            res = video.get('resolution', 'Unknown')
            resolutions[res] = resolutions.get(res, 0) + 1

            fps = str(video.get('fps', 'Unknown'))
            fps_values[fps] = fps_values.get(fps, 0) + 1

            browser = video.get('browser', 'Unknown')
            browsers[browser] = browsers.get(browser, 0) + 1

            codec = video.get('codec', 'Unknown')
            codecs[codec] = codecs.get(codec, 0) + 1

    if resolutions:
        print(f"\nResolutions:")
        for res, count in sorted(resolutions.items(), key=lambda x: x[1], reverse=True):
            print(f"  {res}: {count} videos")

    if fps_values:
        print(f"\nFrame Rates:")
        for fps, count in sorted(fps_values.items(), key=lambda x: x[1], reverse=True):
            print(f"  {fps} fps: {count} videos")

    if browsers:
        print(f"\nBrowsers:")
        for browser, count in sorted(browsers.items(), key=lambda x: x[1], reverse=True):
            print(f"  {browser}: {count} videos")

    if codecs:
        print(f"\nCodecs:")
        for codec, count in sorted(codecs.items(), key=lambda x: x[1], reverse=True):
            print(f"  {codec}: {count} videos")

    print(f"\n{'=' * 100}\n")

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
        sys.exit(0)
