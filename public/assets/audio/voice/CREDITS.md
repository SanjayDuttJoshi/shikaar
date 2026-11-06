# SHIKAAR voice lines

Voice lines made for SHIKAAR, a free non-commercial game.

- Speech: Microsoft neural voices (Hindi: Madhur, Swara; English (India): Prabhat, Neerja), generated with the free edge-tts tool and used here only inside this free game. For any other use, record the lines yourself (same file names) instead. Every line exists in `hi/` and `en/`.
- Processing: ffmpeg (Shikari: lowered pitch with formants kept, a quiet sub layer and a small stone room. Chudail: whisper layer, slight tremble, long echo. Mareez: shaky and hoarse. Announcer and radio: old speaker band, hiss, hall echo).
- Generator: `scripts/voice/make_voices.py`, reading the lines from `src/content/voice-lines.json`. Swap any file for a real recording with the same name to replace that line.
