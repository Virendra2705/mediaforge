# VideoFetch — Fast Video Downloader & Media Tools

**VideoFetch** is a fast, professional, and privacy-conscious online video downloader and media processing platform. It provides high-speed media analysis, crystal-clear MP3/MP4 conversion, thumbnail extraction, subtitle generation, and video trimming for authorized web media.

## Key Features

- **High-Performance Video Downloader**: Extracts permitted public video streams in 720p, 1080p Full HD, and 4K Ultra HD.
- **Crystal-Clear Audio Extraction**: Lossless 320 kbps MP3 conversion powered by multi-threaded LAME DSP, along with WAV and M4A/AAC formats.
- **Keyframe-Accurate Video Trimmer**: Interactive timeline trimming with instant keyframe seeking and sub-clip export.
- **Thumbnail & Subtitle Tooling**: Multi-resolution image extraction (HD, MQ, SD) and closed captions export in SRT, WebVTT, and TXT formats.
- **Zero-Trust Security**:
  - Comprehensive Server-Side Request Forgery (SSRF) defense blocking RFC1918, loopbacks, link-local, and cloud metadata endpoints.
  - Ephemeral media processing with automatic 15-minute file expiration and secure cryptographic HMAC-SHA256 download tokens.
  - Strict copyright and DMCA compliance with dedicated takedown management portal.

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide icons, Dark/Light theme mode.
- **Backend**: Express, Node.js, `yt-dlp`, FFmpeg & FFprobe media pipelines.
- **Queue & Storage**: In-memory job worker queue, Supabase Storage with local fallback, PostgreSQL.

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The application runs on `http://localhost:3000`.

### Running Tests

```bash
npm test
```

### Production Build

```bash
npm run build
npm start
```

## Documentation

- [Cookie Setup Guide](docs/COOKIES_SETUP.md): Instructions for configuring `YTDLP_COOKIES` for platforms requiring authentication sessions.

## License & Compliance

VideoFetch operates in strict compliance with DMCA guidelines and platform terms of service. It provides format conversion and archiving tools strictly for content that users own or have explicit legal rights to process.
