# 🚀 Banana Launch Kit Page

## Overview

Created a "Launch Kit" workspace that turns any idea into ready-to-paste campaign assets. Users enter what they're shipping, pick platforms, and instantly get channel-native copy plus a rendered hero visual generated with our image models. Optional reference images keep visuals on brand.

---

## Main Features

### 1) Multi-Platform Copy in One Shot
- Build TikTok, Instagram, X, LinkedIn, and email blurbs together
- Hooks, bodies, CTAs, hashtags, and channel-specific notes for each
- Copy-to-clipboard per platform for quick pasting into schedulers

### 2) Structured Launch Brain
- Generates launch summary, angle, target audience, and voice
- Headline bank + keyword bank to reuse across assets
- Email/newsletter blurb for longer-form distribution

### 3) Auto Visual Generation
- Produces a detailed visual prompt + style notes from the kit
- Renders a hero visual via Seedream (text-to-image) or Nano Banana Pro when a reference is provided
- Adjustable prompt box with "refresh visual" to iterate without regenerating copy

### 4) Reference-Guided Renders
- Optional reference image upload (data URL) to guide edits
- Clears reference with one click to switch back to pure text-to-image

### 5) Fast Presets & Controls
- Tone chips (Bold, Helpful, Analytical, etc.)
- Goal presets (launch buzz, waitlist, sales/demo, newsletter growth)
- Visual direction presets (cinematic photo, 3D render, diagram, lifestyle, poster)
- Platform toggles to target only the channels you need

---

## Flow

1. Fill in the idea, audience, goal, tone, visual style, and optional constraints
2. Toggle target platforms
3. Click **Build launch kit** to generate copy + visual prompt
4. The hero image renders automatically (respecting reference if present)
5. Copy channel assets or tweak the prompt and hit **Refresh visual only**

---

## Tech Notes

- New API: `POST /api/launch-kit` (OpenAI gpt-4o-2024-08-06 with JSON schema)
- Image rendering: existing `/api/generate` with Seedream or Nano Banana Pro depending on whether a reference image is supplied
- Page route: `/launch-kit` (linked from the home mode picker)
