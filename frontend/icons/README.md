# App Icons

## Required Icons for PWA

- **icon-192.png**: 192x192 pixels (required for Android)
- **icon-512.png**: 512x512 pixels (required for iOS and Android)

## Generating Icons

Use the provided icon.svg as a source to generate PNG files:

```bash
# Using ImageMagick or similar tool
convert -background none -resize 192x192 icon.svg icon-192.png
convert -background none -resize 512x512 icon.svg icon-512.png
```

Or use an online tool like:
- https://realfavicongenerator.net/
- https://www.pwabuilder.com/imageGenerator

## Icon Design

The icon should be:
- Simple and recognizable at small sizes
- Represent facial/video recording concept
- Use brand colors: #007aff (blue) on #1a1a1a (dark) background
- Safe zone: Keep important elements within 80% of canvas (40px margin on 192px icon)

## Temporary Solution

For development/testing, you can use simple solid color squares:

```bash
# Create temporary placeholder icons
convert -size 192x192 xc:"#007aff" icon-192.png
convert -size 512x512 xc:"#007aff" icon-512.png
```
