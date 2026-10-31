#!/usr/bin/env python3
"""Assemble the TikTok cut: one ffmpeg segment per shot with its caption, then concat.

    python3 video/make.py            # -> video/ophaalbrug-tiktok.mp4
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
FPS = 30
FONT = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
shots = json.load(open(os.path.join(ROOT, "shots.json")))
seg_dir = os.path.join(ROOT, "seg")
os.makedirs(seg_dir, exist_ok=True)


def esc(s):
    # ffmpeg drawtext escaping: backslash, colon, quote, percent
    return s.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\\\\\'").replace("%", "\\%")


def caption_filters(text):
    """Two-line caption in the upper third: white on a soft black box, centred."""
    lines = text.split("|")
    out = []
    y0 = 300
    for i, line in enumerate(lines):
        size = 74 if i == 0 else 62
        y = y0 + i * 100
        out.append(
            f"drawtext=fontfile='{FONT}':text='{esc(line)}':fontsize={size}:fontcolor=white:"
            f"x=(w-text_w)/2:y={y}:box=1:boxcolor=black@0.55:boxborderw=22:"
            f"alpha='if(lt(t,0.25),t/0.25,1)'"
        )
    return ",".join(out)


segs = []
for s in shots:
    frames = os.path.join(ROOT, "frames", s["name"])
    n = len([f for f in os.listdir(frames) if f.endswith(".png")])
    if n == 0:
        print("no frames for", s["name"]); sys.exit(1)
    dur = n / FPS
    vf = caption_filters(s["text"]) + f",fade=t=in:st=0:d=0.25,fade=t=out:st={max(0, dur - 0.25):.2f}:d=0.25,format=yuv420p"
    seg = os.path.join(seg_dir, s["name"] + ".mp4")
    cmd = ["ffmpeg", "-v", "error", "-y", "-framerate", str(FPS), "-i", os.path.join(frames, "f%04d.png"),
           "-vf", vf, "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-r", str(FPS), seg]
    subprocess.run(cmd, check=True)
    segs.append(seg)
    print(f"{s['name']}: {n} frames, {dur:.1f} s")

lst = os.path.join(seg_dir, "list.txt")
with open(lst, "w") as f:
    for seg in segs:
        f.write(f"file '{seg}'\n")
final = os.path.join(ROOT, "ophaalbrug-tiktok.mp4")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", "-movflags", "+faststart", final], check=True)
total = sum(len([f for f in os.listdir(os.path.join(ROOT, 'frames', s['name'])) if f.endswith('.png')]) for s in shots) / FPS
print(f"-> {final} ({total:.1f} s)")
