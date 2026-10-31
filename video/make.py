#!/usr/bin/env python3
"""Assemble the TikTok cut: one ffmpeg segment per shot with its caption, then concat.

    python3 video/make.py            # -> video/ophaalbrug-tiktok.mp4
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
FPS = 30
shots = json.load(open(os.path.join(ROOT, "shots.json")))
seg_dir = os.path.join(ROOT, "seg")
os.makedirs(seg_dir, exist_ok=True)


def caption(name):
    return os.path.join(ROOT, "captions", name + ".png")


segs = []
for s in shots:
    frames = os.path.join(ROOT, "frames", s["name"])
    n = len([f for f in os.listdir(frames) if f.endswith(".png")])
    if n == 0:
        print("no frames for", s["name"]); sys.exit(1)
    dur = n / FPS
    # caption fades in over the first 0.3 s; the whole segment fades at both ends
    fc = (f"[1:v]format=rgba,fade=t=in:st=0:d=0.3:alpha=1[cap];"
          f"[0:v][cap]overlay=0:0:format=auto," +
          (f"fade=t=out:st={max(0, dur - 0.4):.2f}:d=0.4," if s is shots[-1] else "") + "format=yuv420p[v]")
    seg = os.path.join(seg_dir, s["name"] + ".mp4")
    cmd = ["ffmpeg", "-v", "error", "-y", "-framerate", str(FPS), "-i", os.path.join(frames, "f%04d.png"),
           "-loop", "1", "-framerate", str(FPS), "-t", f"{dur:.3f}", "-i", caption(s["name"]),
           "-filter_complex", fc, "-map", "[v]", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-r", str(FPS), seg]
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
