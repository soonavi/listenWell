# listenWell
listenWell is a customizable music player built for users who want full control over their audio experience.

Unlike traditional streaming platforms, listenWell has no catalog and does not distribute music. Users upload their own audio files, which are stored privately in their account and available from any device, and manage them in a powerful, flexible interface designed for personalization and performance.

## 🎧 Core Philosophy

- **User-owned audio** — You upload and control your own files.
- **Your library, everywhere** — Songs are stored privately per account and sync across devices.
- **Privacy-focused** — No selling user data, no algorithms, no recommendations.
- **Highly customizable** — Built for power users.

## 🚀 Features (Planned & In Progress)

- Upload and manage your own audio files (synced to your account)
- Edit metadata (title, artist, artwork)
- Create and organize playlists
- Playback speed control
- Built-in equalizer
- Theme and UI customization
- Offline functionality (web-based)

## 🛠 Tech Stack

- React + Vite (JavaScript/JSX)
- TailwindCSS
- Web Audio API
- Supabase (auth, database, file storage)

## ⚙️ Backend Setup

The app needs a Supabase project. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`, then run `supabase/setup.sql` in the Supabase SQL Editor — it creates the `tracks` table, the private `audio-files` storage bucket, and the per-user access policies.

## 🎯 Project Goal

listenWell is designed as both a practical music management tool and a technical learning project focused on:

- Clean frontend architecture
- Browser audio processing
- State management
- Data persistence
- Scalable UI design

---
