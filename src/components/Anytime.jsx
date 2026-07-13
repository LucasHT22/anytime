import { useState, useEffect, useRef, useCallback } from "react";

const CORAL = "#ff3d5a";
const CORAL_LOCKED = "rgba(255,61,90,0.12)";
const BG = "#0a0a0b";
const SURFACE = "#111214";
const MUTED = "#3a3a3d";
const TEXT_DIM = "#555558";
const SHOTS_TOTAL = 3;
const COUNTDOWN = 3;
const STRIP_PADDING = 20;
const STRIP_GAP = 8;
const STRIP_LABEL_H = 20;

const MODES = [
    { id: "raw", label: "RAW", hint: "clean crop, no filter" },
    { id: "pinch", label: "PINCH", hint: "one hand L for corner - other hand pinch to zoom" },
];

const MAX_ZOOM = 3;

function isLShape(lm) {
    const tip = (i) => lm[i];
    const pip = (i) => lm[i - 2];
    const indexUp = tip(8).y < pip(8).y - 0.04;
    const thumbOut = Math.abs(tip(4).x - tip(17).x) > 0.12;
    const midCurl = tip(12).y > pip(12).y - 0.01;
    const ringCurl = tip(16).y > pip(16).y - 0.01;
    const pinkyCurl = tip(20).y > pip(20).y - 0.01;
    return indexUp && thumbOut && midCurl && ringCurl && pinkyCurl;
}

function getCorner(lm) {
    return {
        x: lm[5].x,
        y: lm[5].y
    }
}

function getPinchDist(lm) {
    const dx = lm[4].x - lm[8].x;
    const dy = lm[4].y - lm[8].y;
    return Math.sqrt(dx * dx + dy * dy);
}

function getPinchMid(lm) {
    return {
        x: (lm[4].x + lm[8].x) / 2,
        y: (lm[4].y + lm[8].y) / 2,
    };
}

function HandIcon({ active }) {
    return (
        <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
            <line x1="6" y1="26" x2="6" y2="6" stroke={active ? CORAL : MUTED} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="6" y1="26" x2="26" y2="26" stroke={active ? CORAL : MUTED} strokeWidth="2.5" strokeLinecap="round" />
        </svg>
    );
}

function Dot({ filled }) {
    return (
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: filled ? CORAL : "transparent", border: `1.5px solid ${filled ? CORAL : MUTED}`, transition: "background 0.15s, border-color 0.15s", }} />
    );
}

function ModeButton({ mode, active, onSelect }) {
    return (
        <button onClick={() => onSelect(mode.id)} style={{ background: active ? CORAL : "transparent", border: `1px solid ${active ? CORAL : MUTED}`, color: active ? BG : TEXT_DIM, padding: "6px 18px", cursor: "pointer", letterSpacing: 3, fontSize: 9, fontFamily: "monospace", fontWeight: active ? 700 : 400, transition: "all .15s", }}>
            {mode.label}
        </button>
    );
}

function Strip({ photos, onRetake }) {
    const download = () => {
        const imgs = photos.map(src => {
            const img = new Image();
            img.src = src;
            return img;
        });

        Promise.all(imgs.map(img => new Promise(res => { img.onload = res; }))).then(() => {
            const unifiedW = Math.min(...imgs.map(i => i.naturalWidth));

            const scaled = imgs.map(img => {
                const scale = unifiedW / img.naturalWidth;
                return {
                    img,
                    w: unifiedW,
                    h: Math.round(img.naturalHeight * scale)
                };
            });

            const stripW = unifiedW + STRIP_PADDING * 2;
            const stripH = STRIP_PADDING + scaled.reduce((s, f, i) => s + f.h + STRIP_LABEL_H + (i < scaled.length - 1 ? STRIP_GAP : 0), 0) + STRIP_PADDING;

            const strip = document.createElement("canvas");
            strip.width = stripW;
            strip.height = stripH;

            const ctx = strip.getContext("2d");
            ctx.fillStyle = "#0d0d0e";
            ctx.fillRect(0, 0, stripW, stripH);

            const holeR = 4;
            const holeCount = Math.floor(stripH / 26);
            ctx.fillStyle = "#1c1c1f";
            for (let k = 0; k < holeCount; k++) {
                const hy = 13 + k * 26;
                [8, stripW - 8].forEach(hx => {
                    ctx.beginPath();
                    ctx.roundRect(hx - holeR, hy - holeR * 1.5, holeR * 2, holeR * 3, 2);
                    ctx.fill();
                });
            }

            let y = STRIP_PADDING;
            scaled.forEach(({ img, w, h }, i) => {
                const x = STRIP_PADDING;
                ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, x, y, w, h);
                ctx.fillStyle = CORAL;
                ctx.font = "bold 9px 'Courier New', monospace";
                ctx.textAlign = "center";
                ctx.fillText(`0${i + 1}`, stripW / 2, y + h + 14);
                y += h + STRIP_LABEL_H + (i < scaled.length - 1 ? STRIP_GAP : 0);
            });

            const a = document.createElement("a");
            a.href = strip.toDataURL("image/png");
            a.download = "anytime.png";
            a.click();
        });
    };

    const thumbW = 220;

    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, padding: "32px 16px", background: BG, minHeight: "100vh" }}>
            <div style={{ color: CORAL, letterSpacing: 6, fontSize: 11 }}>// STRIP READY</div>

            <div style={{ background: "#0d0d0e", padding: `${STRIP_PADDING}px`, display: "flex", flexDirection: "column", alignItems: "center", gap: STRIP_GAP, border: `1px solid ${MUTED}`, borderRadius: 3, position: "relative", width: thumbW + STRIP_PADDING * 2 + 28, }}>
                {[0, 1].map(side => (
                    <div key={side} style={{ position: "absolute", top: 0, bottom: 0, [side === 0 ? "left" : "right"]: 0, width: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-evenly", pointerEvents: "none", }}>
                        {Array.from({ length: 8 }).map((_, k) => (
                            <div key={k} style={{ width: 6, height: 9, borderRadius: 1, background: "#1e1e20" }} />
                        ))}
                    </div>
                ))}

                {photos.map((src, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <img src={src} alt={`shot ${i + 1}`} style={{ display: "block", width: thumbW, height: "auto", border: `1px solid #222222` }} />
                        <div style={{ fontSize: 9, color: CORAL, letterSpacing: 3 }}>0{i + 1}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
                <button onClick={onRetake} style={{ background: "transparent", border: `1px solid ${CORAL}`, color: CORAL, padding: "9px 28px", cursor: "pointer", letterSpacing: 3, fontSize: 10, fontFamily: "monospace" }}>
                    RETAKE
                </button>
                <button onClick={download} style={{ background: CORAL, border: "none", color: BG, padding: "9px 28px", cursor: "pointer", letterSpacing: 3, fontSize: 10, fontFamily: "monospace", fontWeight: 700 }}>
                    SAVE STRIP
                </button>
            </div>
        </div>
    );
}

function drawCropRect(ctx, corners, W, H, zoom, pinchMid, dimmed) {
    const xs = corners.map(c => (1 - c.x) * W);
    const ys = corners.map(c => c.y * H);
    const rx = Math.min(...xs);
    const ry = Math.min(...ys);
    const rw = Math.max(...xs) - rx;
    const rh = Math.max(...ys) - ry;

    if (zoom > 1) {
        const cx = rx + rw / 2;
        const cy = ry + rh / 2;
        const irw = rw / zoom;
        const irh = rh / zoom;
        const irx = cx - irw / 2;
        const iry = cy - irh / 2;

        ctx.strokeStyle = dimmed ? "rgba(255,61,90,0.2)" : "rgba(255,61,90,0.3)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(rx, ry, rw, rh);
        ctx.setLineDash([]);

        ctx.strokeStyle = dimmed ? "rgba(255,61,90,0.4)" : CORAL;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([7, 4]);
        ctx.strokeRect(irx, iry, irw, irh);
        ctx.setLineDash([]);
        ctx.fillStyle = dimmed ? CORAL_LOCKED : "rgba(255,61,90,0.18)";
        ctx.fillRect(irx, iry, irw, irh);

        ctx.fillStyle = dimmed ? "rgba(255,61,90,0.4)" : CORAL;
        ctx.font = "bold 10px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.fillText(`${zoom.toFixed(1)}x`, cx, cy);
    } else {
        ctx.strokeStyle = dimmed ? "rgba(255,61,90,0.25)" : CORAL;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([7, 4]);
        ctx.strokeRect(rx, ry, rw, rh);
        ctx.setLineDash([]);
        ctx.fillStyle = dimmed ? CORAL_LOCKED : "rgba(255,61,90,0.25)";
        ctx.fillRect(rx, ry, rw, rh);
    }

    if (pinchMid) {
        ctx.beginPath();
        ctx.arc(pinchMid.x, pinchMid.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = dimmed ? "rgba(255,61,90,0.4)" : CORAL;
        ctx.fill();
    }
}

export default function Anytime() {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const overlayRef = useRef(null);

    const cornersRef = useRef([]);
    const phaseRef = useRef("idle");
    const shotsRef = useRef([]);
    const tickRef = useRef(null);
    const holdTimerRef = useRef(null);

    const pinchZoomRef = useRef(1);
    const pinchMidRef = useRef(null);

    const lockedCornersRef = useRef([]);
    const lockedZoomRef = useRef(1);

    const [phase, setPhase] = useState("idle");
    const [countdown, setCountdown] = useState(COUNTDOWN);
    const [lCount, setLCount] = useState(0);
    const [photos, setPhotos] = useState([]);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState(null);
    const [mode, setMode] = useState("raw");

    const captureFrame = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return null;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");

        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0);
        ctx.restore();

        const corners = lockedCornersRef.current;
        if (corners.length === 2) {
            const W = canvas.width, H = canvas.height;

            const xs = corners.map(c => (1 - c.x) * W);
            const ys = corners.map(c => c.y * H);
            let x1 = Math.max(0, Math.min(...xs));
            let y1 = Math.max(0, Math.min(...ys));
            let x2 = Math.min(W, Math.max(...xs));
            let y2 = Math.min(H, Math.max(...ys));
            
            if (mode === "pinch") {
                const zoom = lockedZoomRef.current;
                const cx = (x1 + x2) / 2;
                const cy = (y1 + y2) / 2;
                const hw = (x2 - x1) / 2 / zoom;
                const hh = (y2 - y1) / 2 / zoom;
                x1 = Math.max(0, cx - hw);
                y1 = Math.max(0, cy - hh);
                x2 = Math.min(W, cx + hw);
                y2 = Math.min(H, cy + hh);
            }

            const w = x2 - x1, h = y2 - y1;
            if (w > 10 && h > 10) {
                const crop = document.createElement("canvas");
                crop.width = w;
                crop.height = h;
                crop.getContext("2d").drawImage(canvas, x1, y1, w, h, 0, 0, w, h);
                return crop.toDataURL("image/png");
            }
        }
        return null;
    }, [mode]);

    const runShot = useCallback((afterCapture) => {
        phaseRef.current = "countdown";
        setPhase("countdown");
        setCountdown(COUNTDOWN);

        let n = COUNTDOWN;
        tickRef.current = setInterval(() => {
            n--;
            setCountdown(n);
            if (n <= 0) {
                clearInterval(tickRef.current);
                phaseRef.current = "flash";
                setPhase("flash");
                setTimeout(() => {
                    const img = captureFrame();
                    afterCapture(img);
                }, 180);
            }
        }, 1000);
    }, [captureFrame]);

    const startSequence = useCallback(() => {
        if (phaseRef.current !== "idle") return;

        const next = () => {
            if (shotsRef.current.length >= SHOTS_TOTAL) {
                phaseRef.current = "done";
                setPhase("done");
                setPhotos([...shotsRef.current]);
                return;
            }
            runShot((img) => {
                if (img) shotsRef.current.push(img);
                if (shotsRef.current.length >= SHOTS_TOTAL) {
                    phaseRef.current = "done";
                    setPhase("done");
                    setPhotos([...shotsRef.current]);
                    return;
                }
                phaseRef.current = "idle";
                setPhase("idle");
                cornersRef.current = [];
                lockedCornersRef.current = [];
                lockedZoomRef.current = 1;
            });
        };
        next();
    }, [runShot]);

    const startSequenceRef = useRef(null);
    startSequenceRef.current = startSequence;

    useEffect(() => {
        let cam;

        const hands = new window.Hands({
            locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${f}`,
        });
        hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.5,
        });

        hands.onResults((results) => {
            const overlay = overlayRef.current;
            if (!overlay) return;
            const ctx = overlay.getContext("2d");
            ctx.clearRect(0, 0, overlay.width, overlay.height);

            const lCorners = [];

            const W = overlay.width, H = overlay.height;

            let pinchDetected = false;

            (results.multiHandLandmarks || []).forEach((lm) => {
                if (isLShape(lm)) {
                    lCorners.push(getCorner(lm));
                } else if (mode === "pinch") {
                    const dist = getPinchDist(lm);
                    const OPEN_DIST = 0.2;
                    const zoom = Math.max(1, Math.min(MAX_ZOOM, 1 + (MAX_ZOOM - 1) * (1 - Math.min(dist, OPEN_DIST) / OPEN_DIST)));
                    pinchZoomRef.current = zoom;
                    lCorners.push(getCorner(lm));
                    pinchDetected = true;
                    const mid = getPinchMid(lm);
                    pinchMidRef.current = { x: (1 - mid.x) * W, y: mid.y * H };
                }
            });

            if (!pinchDetected) {
                pinchZoomRef.current = 1;
                pinchMidRef.current = null;
            }

            cornersRef.current = lCorners;
            setLCount(lCorners.length);

            if (lCorners.length === 2) {
                if (phaseRef.current === "idle") {
                    lockedCornersRef.current = [...lCorners];
                    lockedZoomRef.current = pinchZoomRef.current;
                }

                lCorners.forEach((c) => {
                    const px = (1 - c.x) * W;
                    const py = c.y * H;
                    const sz = 26;
                    ctx.strokeStyle = CORAL;
                    ctx.lineWidth = 3;
                    ctx.lineCap = "round";
                    ctx.beginPath();
                    ctx.moveTo(px - sz, py);
                    ctx.lineTo(px, py);
                    ctx.lineTo(px, py - sz);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(px, py, 4, 0, Math.PI * 2);
                    ctx.fillStyle = CORAL;
                    ctx.fill();
                });

                drawCropRect(ctx, lCorners, W, H, pinchZoomRef.current, pinchMidRef.current, false);

                if (phaseRef.current === "idle") {
                    if (!holdTimerRef.current) {
                        holdTimerRef.current = setTimeout(() => {
                            holdTimerRef.current = null;
                            startSequenceRef.current?.();
                        }, 800);
                    }
                }
            } else {
                if (holdTimerRef.current) {
                    clearTimeout(holdTimerRef.current);
                    holdTimerRef.current = null;
                }

                if (lockedCornersRef.current.length === 2) {
                    drawCropRect(ctx, lockedCornersRef.current, W, H, lockedZoomRef.current, null, true);
                }
            }
        });

        navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 1280, height: 720 } }).then((stream) => {
            const video = videoRef.current;
            if (!video) return;
            video.srcObject = stream;
            video.onloadedmetadata = () => {
                video.play();
                const ov = overlayRef.current;
                
                if (ov) {
                    ov.width = video.videoWidth;
                    ov.height = video.videoHeight;
                }

                cam = new window.Camera(video, {
                    onFrame: async () => { await hands.send({ image: video }); },
                    width: 1280,
                    height: 720,
                });
                cam.start();
                setReady(true);
            };
        }).catch(() => setError("Camera access denied - allow camera and reload."));

        return () => {
            clearInterval(tickRef.current);
            if (cam) cam.stop();
            hands.close();
        };
    }, [mode]);

    const retake = () => {
        clearInterval(tickRef.current);
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
        phaseRef.current = "idle";
        cornersRef.current = [];
        shotsRef.current = [];
        lockedCornersRef.current = [];
        lockedZoomRef.current = 1;
        pinchZoomRef.current = 1;
        pinchMidRef.current = null;
        setPhase("idle");
        setPhotos([]);
        setLCount(0);
        setCountdown(COUNTDOWN);
    };

    if (phase === "done") return <Strip photos={photos} onRetake={retake} />;

    const hasLock = lockedCornersRef.current.length === 2;
    const currentMode = MODES.find(m => m.id === mode);
    const statusText = !ready ? "loading mediapipe..." : phase === "countdown" ? `shooting ${shotsRef.current.length +1} of ${SHOTS_TOTAL}` : lCount === 2 ? "frame locked - hold still" : lCount === 1 ? "hold - waiting for second hand..." : hasLock ? "frame locked · make Ls again to reframe" : currentMode.hint;

    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: BG, minHeight: "100vh", padding: "28px 16px", fontFamily: "'Courier New', monospace" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ color: CORAL, letterSpacing: 7, fontSize: 13, marginBottom: 5}}>A N Y T I M E</div>
                <div style={{ color: TEXT_DIM, fontSize: 10, letterSpacing: 2 }}>
                    {error ? <span style={{ color: CORAL }}>{error}</span> : statusText}
                </div>
            </div>
            
            <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
                {MODES.map(m => (
                    <ModeButton key={m.id} mode={m} active={mode === m.id} onSelect={(id) => {
                        retake();
                        setMode(id);
                    }} />
                ))}
            </div>

            <div style={{ position: "relative", width: "min(720px, 100%)", aspectRatio: "16 / 9", background: SURFACE, borderRadius: 4, overflow: "hidden", border: `1px solid ${MUTED}`, }}>
                <video ref={videoRef} playsInline muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", display: "block" }} />
                <canvas ref={overlayRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
                <canvas ref={canvasRef} style={{ display: "none" }} />
                {phase === "countdown" && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", }}>
                        <span style={{ fontSize: 140, fontWeight: 700, color: CORAL, lineHeight: 1, opacity: 0.9 }}>
                            {countdown}
                        </span>
                    </div>
                )}

                {phase === "flash" && (
                    <div style={{ position: "absolute", inset: 0, background: "white", opacity: 0.88, pointerEvents: "none" }} />
                )}

                <div style={{ position: "absolute", top: 12, right: 14, display: "flex", gap: 7 }}>
                    {Array.from({ length: SHOTS_TOTAL }).map((_, i) => (
                        <Dot key={i} filled={i < shotsRef.current.length} />
                    ))}
                </div>   
            </div>

            <div style={{ display: "flex", gap: 40, marginTop: 24, alignItems: "center" }}>
                {[0, 1].map((i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: lCount > i ? 1 : 0.25, transition: "opacity 0.2s" }}>
                        <HandIcon active={lCount > i} />
                        <div style={{ fontSize: 9, letterSpacing: 3, color: lCount > i ? CORAL : TEXT_DIM }}>
                            HAND {i + 1}
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ marginTop: 28, color: TEXT_DIM, fontSize: 10, letterSpacing: 2, textAlign: "center", lineHeight: 1.8, maxWidth: 340 }}>
                point index + thumb out - curl other fingers <br />
                knuckle = frame corner
            </div>
        </div>
    );
}