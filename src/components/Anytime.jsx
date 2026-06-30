import { useState, useEffect, useRef, useCallback } from "react";

const CORAL = "#ff3d5a";
const CORAL_DIM = "rgba(255,61,90,0.25)";
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
    { id: "draw", label: "DRAW", hint: "draw with your finger while framing" },
];

// da beauty of constants

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

function getIndexTip(lm) {
    return {
        x: lm[8].x,
        y: lm[8].y
    }
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

export default function Anytime() {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const overlayRef = useRef(null);
    const drawRef = useRef(null);

    const cornersRef = useRef([]);
    const phaseRef = useRef("idle");
    const shotsRef = useRef([]);
    const tickRef = useRef(null);
    const holdTimerRef = useRef(null);
    const drawPathRef = useRef([]);

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

        if (mode === "draw") {
            const dc = drawRef.current;
            if (dc) ctx.drawImage(dc, 0, 0);
        }

        const corners = cornersRef.current;
        if (corners.length === 2) {
            const W = canvas.width, H = canvas.height;

            const xs = corners.map(c => (1 - c.x) * W);
            const ys = corners.map(c => c.y * H);
            const x1 = Math.max(0, Math.min(...xs));
            const y1 = Math.max(0, Math.min(...ys));
            const x2 = Math.min(W, Math.max(...xs));
            const y2 = Math.min(H, Math.max(...ys));
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

            (results.multiHandLandmarks || []).forEach((lm) => {
                if (isLShape(lm)) {
                    lCorners.push(getCorner(lm));
                } else if (mode === "draw" && phaseRef.current === "idle") {
                    const tip = getIndexTip(lm);
                    const px = (1 - tip.x) * W;
                    const py = tip.y * H;
                    const dc = drawRef.current;
                    if (dc) {
                        const sx = dc.width / W;
                        const sy = dc.height / H;
                        const dctx = dc.getContext("2d");
                        dctx.strokeStyle = CORAL;
                        dctx.lineWidth = 3;
                        dctx.lineCap = "round";
                        dctx.lineJoin = "round";

                        const prev = drawPathRef.current[drawPathRef.current.length - 1];
                        if (prev) {
                            dctx.beginPath();
                            dctx.moveTo(prev.x * sx, prev.y * sy);
                            dctx.lineTo(px *sx, py * sy);
                            dctx.stroke();
                        }
                        drawPathRef.current.push({ x: px, y: py });

                        ctx.save();
                        ctx.scale(-1, 1);
                        ctx.translate(-W, 0);
                        ctx.drawImage(dc, 0, 0, dc.width, dc.height, 0, 0, W, H);
                        ctx.restore();
                    }
                }
            });

            cornersRef.current = lCorners;
            setLCount(lCorners.length);

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

            if (lCorners.length === 2) {
                const xs = lCorners.map(c => (1 - c.x) * W);
                const ys = lCorners.map(c => c.y * H);
                const rx = Math.min(...xs), ry = Math.min(...ys);
                const rw = Math.max(...xs) - rx, rh = Math.max(...ys) - ry;
                ctx.strokeStyle = CORAL;
                ctx.lineWidth = 1.5;
                ctx.setLineDash([7, 4]);
                ctx.strokeRect(rx, ry, rw, rh);
                ctx.setLineDash([]);
                ctx.fillStyle = CORAL_DIM;
                ctx.fillRect(rx, ry, rw, rh);

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

                if (lCorners.length === 0) {
                    drawPathRef.current = [];
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
                const dc = drawRef.current;
                
                if (ov) {
                    ov.width = video.videoWidth;
                    ov.height = video.videoHeight;
                }

                if (dc) {
                    dc.width = video.videoWidth;
                    dc.height = video.videoHeight;
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
        drawPathRef.current = [];
        const dc = drawRef.current;
        if (dc) dc.getContext("2d").clearRect(0, 0, dc.width, dc.height);
        setPhase("idle");
        setPhotos([]);
        setLCount(0);
        setCountdown(COUNTDOWN);
    };

    if (phase === "done") return <Strip photos={photos} onRetake={retake} />;

    const currentMode = MODES.find(m => m.id === mode);
    const statusText = !ready ? "loading mediapipe..." : lCount === 0 ? currentMode.hint : lCount === 1 ? "hold - waiting for second hand..." : phase === "countdown" ? `shooting ${shotsRef.current.length + 1} of ${SHOTS_TOTAL}` : "crop locked";

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
                <canvas ref={drawRef} style={{ display: "none" }} />
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