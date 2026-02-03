#!/bin/bash

# Script to generate PWA icons from SVG source
# Requires: ImageMagick (convert) or rsvg-convert

echo "Generating PWA icons..."

if command -v convert &> /dev/null; then
    echo "Using ImageMagick..."
    convert -background none -resize 192x192 icon.svg icon-192.png
    convert -background none -resize 512x512 icon.svg icon-512.png
    echo "✓ Icons generated successfully"
elif command -v rsvg-convert &> /dev/null; then
    echo "Using rsvg-convert..."
    rsvg-convert -w 192 -h 192 icon.svg -o icon-192.png
    rsvg-convert -w 512 -h 512 icon.svg -o icon-512.png
    echo "✓ Icons generated successfully"
else
    echo "❌ Error: Neither ImageMagick nor rsvg-convert found"
    echo ""
    echo "Please install one of these tools:"
    echo "  - ImageMagick: sudo apt install imagemagick"
    echo "  - librsvg: sudo apt install librsvg2-bin"
    echo ""
    echo "Or use an online tool to convert icon.svg to PNG:"
    echo "  - https://cloudconvert.com/svg-to-png"
    echo "  - https://www.pwabuilder.com/imageGenerator"
    exit 1
fi

# Display file sizes
if [ -f "icon-192.png" ]; then
    ls -lh icon-192.png icon-512.png
fi
