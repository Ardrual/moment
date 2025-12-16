# Moment

A minimal meditation timer PWA with ambient audio.

![Moment Screenshot](https://img.shields.io/badge/PWA-Ready-blueviolet) ![License](https://img.shields.io/badge/License-MIT-green)

## Features

- ⏱️ **Timer** - 5/10/15/20/30 min presets or custom duration
- 🔊 **Ambient sounds** - Rain, waves, drone (or silence)
- 🔔 **End bells** - 5 different tones
- 📝 **Journal** - Set intentions, write reflections
- 📊 **History** - Track your practice, export to JSON
- 🌙 **Dark/Light themes**
- 📱 **PWA** - Install on any device, works offline

## Quick Start

```bash
# Clone or download
cd moment

# Serve locally (any static server works)
python3 -m http.server 8080

# Open http://localhost:8080
```

## Usage

1. **Pick a sound** - Tap a sound button at the top (or leave on silence)
2. **Tap the disc** - Set an intention (optional), then begin
3. **Pause/Resume** - Tap the disc anytime
4. **Finish early** - Use the button that appears during meditation
5. **Reflect** - After finishing, add notes about your session

## Customization

### Add Your Own Sounds

Edit `app.js` and update the `CONFIG.channels` array:

```javascript
channels: [
  { id: 0, name: 'Silence', src: null },
  { id: 1, name: 'Rain', src: '/sounds/rain.mp3' },
  { id: 2, name: 'Forest', src: '/sounds/forest.mp3' },
  { id: 3, name: 'Stream', src: 'https://example.com/stream.mp3' },
],
```

### Change Bell Sounds

Update `CONFIG.bells` with different frequencies and decay times:

```javascript
bells: [
  { id: 0, name: 'Bowl', frequency: 528, decay: 4 },
  { id: 1, name: 'Gong', frequency: 220, decay: 6 },
  // Add more...
],
```

## Tech Stack

- **HTML/CSS/JS** - No build step, no dependencies
- **Web Audio API** - Generated ambient sounds and bells
- **localStorage** - Session history and settings
- **Service Worker** - Offline support

## Project Structure

```
├── index.html      # App structure
├── style.css       # Styles (mobile-first)
├── app.js          # Logic
├── sw.js           # Service worker
├── manifest.json   # PWA manifest
└── icon.svg        # App icon
```

## Credits

Inspired by [am/fm](https://apps.apple.com/us/app/am-fm/id6756219226) by Adam Ludwin.

## License

MIT
