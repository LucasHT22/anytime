import { useState, useEffect, useRef, useCallback } from "react";

const CORAL = "#ff3d5a";
const CORAL_DIM = "rgba(255,61,90,0.25)";
const BG = "#0a0a0b";
const SURFACE = "#111214";
const MUTED = "#3a3a3d";
const TEXT_DIM = "#555558";
const SHOTS_TOTAL = 3;
const COUNTDOWN = 3;

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

function Strip({ photos, onRetake }) {
    const download = () => {
        photos.forEach((src, i) => {
            setTimeout(() => {
                const a = document.createElement("a");
                a.href = src;
                a.download = `anytime_${i + 1}.png`;
                a.click();
            }, i * 150);
        });
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, padding: "32px 16px", background: BG, minHeight: "100vh" }}>
            <div style={{ color: CORAL, letterSpacing: 6, fontSize: 11 }}>// STRIP READY</div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
                {photos.map((src, i) => (
                    <div key={i} style={{ position: "relative", border: `1.5px solid ${CORAL}`, borderRadius: 3, overflow: "hidden" }}>
                        <img src={src} alt={`shot ${i + 1}`} style={{ display: "block", width: 220, height: "auto" }} />
                        <div style={{ position: "absolute", bottom: 6, left: 8, fontSize: 9, color: CORAL, letterSpacing: 3 }}>
                            0{i + 1}
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
                <button onClick={onRetake} style={{ background: "transparent", border: `1px solid ${CORAL}`, color: CORAL, padding: "9px 28px", cursor: "pointer", letterSpacing: 3, fontSize: 10, fontFamily: "monospace" }}>
                    RETAKE
                </button>
                <button onClick={download} style={{ background: CORAL, border: "none", color: BG, padding: "9px 28px", cursor: "pointer", letterSpacing: 3, fontSize: 10, fontFamily: "monospace", fontWeight: 700 }}>
                    SAVE ALL
                </button>
            </div>
        </div>
    );
}

export default function Anytime() {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const overlayRef = useRef(null);

    const cornersRef = useRef([]);
    const phaseRef = useRef("idle");
    const shotsRef = useRef([]);
    const tickRef = useRef(null);

    const [phase, setPhase] = useState("idle");
    const [countdown, setCountdown] = useState(COUNTDOWN);
    const [lCount, setLCount] = useState(0);
    const [photos, setPhotos] = useState([]);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState(null);

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
        return canvas.toDataURL("image/png");
    }, []);

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
        shotsRef.current = [];

        const next = () => {
            if (shotsRef.current.length >= SHOTS_TOTAL) {
                phaseRef.current = "done";
                setPhase("done");
                setPhotos([...shotsRef.current]);
                return;
            }
            runShot((img) => {
                if (img) shotsRef.current.push(img);
                phaseRef.current = "idle-between";
                setPhase("idle-between");
                setTimeout(next, 600);
            });
        };
        next();
    }, [runShot]);

    useEffect(() => {
        let cam;

        const hands = new window.Hands({
            locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
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
            (results.multiHandLandmarks || []).forEach((lm) => {
                if (isLShape(lm)) lCorners.push(getCorner(lm));
            });
            cornersRef.current = lCorners;
            setLCount(lCorners.length);

            const W = overlay.width, H = overlay.height;

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

                if (phaseRef.current === "idle") startSequence(); 
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
    }, [startSequence]);

    const retake = () => {
        clearInterval(tickRef.current);
        phaseRef.current = "idle";
        cornersRef.current = [];
        shotsRef.current = [];
        setPhase("idle");
        setPhotos([]);
        setLCount(0);
        setCountdown(COUNTDOWN);
    };

    if (phase === "done") return <Strip photos={photos} onRetake={retake} />;

    const statusText = !ready ? "loading mediapipe..." : lCount === 0 ? "make an L with both hands to frame your shot" : lCount === 1 ? "hold - waiting for second hand..." : phase === "countdown" ? `shooting ${shotsRef.current.length + 1} of ${SHOTS_TOTAL}` : "crop locked";

    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: BG, minHeight: "100vh", padding: "28px 16px", fontFamily: "'Courier New', monospace" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ color: CORAL, letterSpacing: 7, fontSize: 13, marginBottom: 5}}>A N Y T I M E</div>
                <div style={{ color: TEXT_DIM, fontSize: 10, letterSpacing: 2 }}>
                    {error ? <span style={{ color: CORAL }}>{error}</span> : statusText}
                </div>
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