<p align="center">
  <img src="./public/icon-256.png" alt="Kibo Logo" width="96" height="96" style="border-radius: 24px;" />
</p>

<h1 align="center">Kibo</h1>

<p align="center">
  <strong>The voice assistant that actually does things for you.</strong><br>
  Ambient Top Bezel Desktop Companion for Windows 10 & 11.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078D4?style=flat-square&logo=windows" alt="Platform" />
  <img src="https://img.shields.io/badge/License-Proprietary-darkgray?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/Runtime-Electron%20%7C%20React%20%7C%20Vite-61DAFB?style=flat-square" alt="Stack" />
  <img src="https://img.shields.io/badge/AI-Gemini%202.5%20%7C%20Claude%20%7C%20Local%20LLM-8E75FF?style=flat-square" alt="AI Models" />
</p>

---

## Overview

**Kibo** lives quietly in your top display bezel. Whenever you need assistance, hold a shortcut to control applications, inspect on-screen code or errors, dictate structured notes, or run background workflows without switching windows or interrupting your flow.

---

## Key Features

### Voice Control & Computer Use (`Win + Alt`)
- Hold your shortcut to speak natural instructions.
- Controls Windows applications, toggles system settings (Wi-Fi, Bluetooth, Night Light, Dark Mode), manipulates windows, and types directly at your cursor.
- Fast sub-second execution powered by Gemini 2.5 Flash and native Win32 UIAutomation.

### Circle-to-Ask / Screen Vision (`Ctrl + Shift`)
- Trace a freeform circle or box around any area on your screen.
- Instantly sends the cropped screenshot to multimodal Gemini to debug code, explain terminal errors, translate text, or analyze design components.

### Clean Dictation (`Ctrl + Win`)
- Speak rough, spoken thoughts with mid-sentence self-corrections.
- Kibo automatically strips filler words (`um`, `uh`, `like`), structures paragraphs, and inserts formatted text directly into your active input field.

### Top Bezel Hardware Island
- **Controls**: Instant toggles for Wi-Fi, Bluetooth, Audio device switching, Night Light warmth, Dark Mode, and volume sliders.
- **Media Player**: Real-time song scrub bar, album artwork, and audio EQ spectrum for Spotify, YouTube, and system media sessions.
- **Today & Focus**: Pomodoro focus timer, task priorities checklist, and daily weather.
- **Clipboard Manager**: Searchable multi-format clipboard history (text, code, links, images) with one-click double-tap paste.
- **Curated 4K Wallpapers**: 12 curated vibrant wallpapers with instant top-bezel shockwave transitions and automatic UI color palette extraction.

### 6 Modular Droid Chassis
Choose from 6 factory-calibrated Kibo chassis skins with animated gyro rings and visor LEDs:
- **MK-I Cobalt** (`#38BDF8`) · Titanium chassis with dual-axis gyroscope
- **TE-02 Field** (`#F59E0B`) · High-contrast amber dot-matrix optics
- **K-03 Bio-Synth** (`#10B981`) · Low-emission phosphor-green deep-work core
- **V-04 Arc** (`#818CF8`) · Overclocked high-voltage magnetic gimbal
- **S-05 Helios** (`#FBBF24`) · Gold-anodized orbital frame with solar stabilizers
- **MK-0 Singularity** (`#C084FC`) · Zero-point deep violet telemetry pod

---

## Keyboard Shortcuts

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| `Win + Alt` *(Hold)* | **Voice Assistant** | Speak commands to control PC apps, settings & media |
| `Ctrl + Shift` *(Hold)* | **Circle-to-Ask** | Lasso any code or error on screen for instant AI analysis |
| `Ctrl + Win` *(Hold)* | **Clean Dictation** | Transforms rough spoken speech into clean formatted text |
| `Hover Notch` *(Hold)* | **Peek Notch** | Glides down the hardware notch into quick view |
| `Scroll Down on Notch` | **Expand Tabs** | Opens Controls, Today, Clipboard, Wallpapers, and Power |

---

## Tech Stack

- **Desktop Runtime**: Electron 44, Node.js, Win32 Native UIAutomation, PowerShell Daemons
- **Frontend**: React 18, TypeScript, Vite
- **Motion & Physics**: GSAP 3.12, Lenis Smooth Scroll
- **AI Engine**: Google Gemini API (2.5 Flash / Pro), Anthropic Claude, OpenAI, Ollama Local LLMs
- **Audio Engine**: Web Audio API synthesized haptic tones & sound effects

---

## Getting Started

### Prerequisites

- **Windows 10 or 11** (x64)
- **Node.js 18+** & **npm**

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Launch the Desktop Companion**:
   ```bash
   npm run app
   ```

3. **Launch the Web Showcase / Landing Page**:
   ```bash
   npm run dev
   ```

---

## Building Standalone Windows Installer (`.exe`)

To package a production NSIS installer executable:

```bash
npm run dist
```

The compiled installer will be output to:
```
release/Kibo Setup 1.0.0.exe
```

---

## Copyright & Author

Designed and built by **Raahim Alavi**.  
All rights reserved. Proprietary software.
