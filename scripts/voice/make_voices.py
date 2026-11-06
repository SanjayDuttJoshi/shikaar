"""SHIKAAR voice lines v3: every line in Hindi and English (Microsoft neural voices via edge-tts),
read from src/content/voice-lines.json, with light per-speaker processing.

Run: python -I scripts/voice/make_voices.py src/content/voice-lines.json <raw_dir> public/assets/audio/voice   (needs: pip install edge-tts, and ffmpeg)
Writes <out_dir>/hi/<id>.mp3 and <out_dir>/en/<id>.mp3.
"""
import asyncio
import json
import subprocess
import sys
from pathlib import Path

import edge_tts

LINES, RAW, OUT = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
data = json.loads(LINES.read_text(encoding="utf-8"))

FX = {
    # Men sound like men: lowered with formants kept, a quiet sub layer, small stone room.
    "shikari": "[0:a]asplit=2[v][s];[v]rubberband=pitch=0.84:formant=preserved,bass=g=6:f=110[main];"
    "[s]rubberband=pitch=0.5:formant=preserved,lowpass=f=600,volume=0.25[sub];"
    "[main][sub]amix=inputs=2:normalize=0,aecho=0.7:0.35:35|80:0.22|0.12,apad=pad_dur=0.5,loudnorm=I=-17:TP=-1.5",
    "chudail": "[0:a]asplit=2[v][w];[v]rubberband=pitch=0.97:formant=preserved,tremolo=f=5:d=0.15[main];"
    "[w]highpass=f=2600,volume=0.5,adelay=25[air];"
    "[main][air]amix=inputs=2:normalize=0,aecho=0.75:0.45:110|240:0.3|0.16,apad=pad_dur=0.8,loudnorm=I=-18:TP=-1.5",
    # Rough male voice: lower, hoarse, a slight shake only.
    "mareez": "[0:a]rubberband=pitch=0.88:formant=preserved,bass=g=4:f=130,tremolo=f=6:d=0.12,asoftclip=type=atan:param=1.4,"
    "highpass=f=70,aecho=0.6:0.3:30|70:0.2|0.1,apad=pad_dur=0.4,loudnorm=I=-17:TP=-1.5",
    "pa": "[0:a]highpass=f=380,lowpass=f=3200,acompressor=threshold=-22dB:ratio=4,asoftclip=type=tanh:param=1.2,volume=1.3[v];"
    "[1:a]volume=0.03[n];[v][n]amix=inputs=2:duration=first:normalize=0,aecho=0.8:0.6:240|430:0.28|0.16,apad=pad_dur=0.9,loudnorm=I=-19:TP=-1.5",
    "radio": "[0:a]highpass=f=500,lowpass=f=2600,asoftclip=type=atan:param=1.4,volume=1.2[v];"
    "[1:a]volume=0.06[n];[v][n]amix=inputs=2:duration=first:normalize=0,apad=pad_dur=0.6,loudnorm=I=-20:TP=-1.5",
    # Story narration: clear and close, like someone telling you in the dark.
    "narrator-f": "[0:a]rubberband=pitch=0.98:formant=preserved,aecho=0.6:0.3:60|140:0.15|0.08,apad=pad_dur=0.6,loudnorm=I=-16:TP=-1.5",
    "narrator-m": "[0:a]rubberband=pitch=0.9:formant=preserved,bass=g=4:f=120,aecho=0.6:0.3:60|140:0.15|0.08,apad=pad_dur=0.6,loudnorm=I=-16:TP=-1.5",
}


async def main():
    for line in data["lines"]:
        sp = data["speakers"][line["speaker"]]
        for lang in ("hi", "en"):
            text = line["tts"] if lang == "hi" else line["en"]
            raw = RAW / lang / f"{line['id']}.mp3"
            raw.parent.mkdir(parents=True, exist_ok=True)
            if not raw.exists():
                await edge_tts.Communicate(text, sp[lang], rate=sp["rate"], pitch=sp["pitch"]).save(str(raw))
            out = OUT / lang / f"{line['id']}.mp3"
            out.parent.mkdir(parents=True, exist_ok=True)
            cmd = ["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(raw)]
            if sp["fx"] in ("pa", "radio"):
                cmd += ["-f", "lavfi", "-i", "anoisesrc=color=pink:amplitude=0.5:duration=60"]
            cmd += ["-filter_complex", FX[sp["fx"]], "-ar", "44100", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "80k", str(out)]
            subprocess.run(cmd, check=True)
        print("ok", line["id"])


asyncio.run(main())
