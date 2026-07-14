> Note: this project uses AI for implementation suggestions, quick fixes, and rubber-ducking gesture detection logic.

---

# Anytime

A gesture-controlled photobooth, take it anywhere anytime.

## How it works

Anytime uses [MediaPipe Hands](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker) to track 21 landmarks per hand in real time via the webcam. Two gestures drive everything:

### The L-shape

```
index finger extended upward -> tip(8).y < pip(8).y - 0.04
thumb extended outward -> |tip(4).x - tip(17).x| > 0.12
middle, ring, pinky curled -> tip(N).y ? pip
```

Making an L with both hands places two corner markers on the overlay. The knuckle of the index finger (`lm[5]`) defines the corner position. The bounding box between the two knuckles becomes the crop region, any ratio, any size.

### Frame lock

Once both Ls are held for 800ms, the corners freeze into `lockedCornersRef`. You can drop your hands, the frame persists as a dimmed overlay on screen. The capture reads from the locked corners.

After each shot the lock clears. Every shot needs its own frame.

### The Strip

Three shots are taken in sequence. Each is cropped to whatever was locked at that shot's trigger. On the strip export, all frames are normalized to the same width (the narowest shot), each scaled proportionally so their individual shots are preserved. 

```
unifiedW = Math.min(...imgs.map(i => i.naturalWidth))

scaled = imgs.map(img => ({
    w: unifiedW,
    h: Math.round(img.naturalHeight * (unifiedW / img.naturalWidth))
}))
```

---

## Modes

### RAW

Standard mode. two L shapes -> lock -> countdown -> shot. No processing beyond the crop.

### PINCH

Once hand makes the L for one corner. The otherhand pinches (thumb tip close to index tip) to supply the second corner and control zoom at the same time.

Pinch distance maps to a zoom scalar:

```
dist -> 0 (fully closed) -> MAX_ZOOM (3x)
dist -> 0.2+ (wide open) -> 1x (no zoom)

zoom = clamp(1 + (MAX_ZOOM - 1) * (1 - dist / OPEN_DIST), 1, MAX_ZOOM)
```

The zoom shrinks the crop inward from its center before capture:

```
cx = (x1 + x2) / 2
hw = (x2 - x1) / 2 / zoom
x1 = cx - hw
x2 = cx + hw 
```

The overlay shows boththe outer bbox (dimmed) and the inner zoomed crop (solid), plus the zoom multiplier at the center.

---

## Gesture detection details

MediaPipe returns landmarks in normalized `[0, 1]` space relative to the video frame. The video is CSS-mirrored (`scaleX(-1)`) for a natural selfie view, so all x-coordinates are flipped before use:

```
px = (1 - landmark.x) * overlayWidth
```

The overlay canvas sits on top of the mirrored video at `position: absolute`, drawing L markers and crop rects in the already-mirrored coordinate space.

The hidden capture canvas draws the video unmirrored (via a `ctx.translate + ctx.scale (-1, 1)` trick), then crops from pixel coordinates derived from the same  x-flip. This ensures what you see in the overlay matches what gets saved.