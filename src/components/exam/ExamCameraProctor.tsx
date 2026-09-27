import { useEffect, useRef, useState, useCallback } from "react";
import {
  Camera,
  CameraOff,
  AlertCircle,
  ShieldCheck,
  Eye,
  RefreshCw,
  AlertTriangle,
  Activity,
} from "lucide-react";
import { playAlertSound } from "../../utils/examHelpers";
import { ViolationEvent } from "../../types";

interface ExamCameraProctorProps {
  isActive: boolean;
  studentName: string;
  onCameraViolation?: (event: ViolationEvent) => void;
}

export function ExamCameraProctor({
  isActive,
  studentName,
  onCameraViolation,
}: ExamCameraProctorProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const prevFrameDataRef = useRef<Uint8Array | null>(null);
  const darkFrameCountRef = useRef<number>(0);
  const absentFrameCountRef = useRef<number>(0);
  const lastViolationTimeRef = useRef<number>(0);
  const onViolationRef = useRef(onCameraViolation);

  const [cameraStatus, setCameraStatus] = useState<
    "connecting" | "active" | "denied" | "unsupported"
  >("connecting");
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [snapshotCount, setSnapshotCount] = useState<number>(0);
  const [motionLevel, setMotionLevel] = useState<number>(0); // 0 - 100%
  const [activeWarning, setActiveWarning] = useState<string | null>(null);

  useEffect(() => {
    onViolationRef.current = onCameraViolation;
  }, [onCameraViolation]);

  // Safely attach stream to video element whenever either changes
  const attachStreamToVideo = useCallback((stream: MediaStream) => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch((err) => console.warn("Video play error:", err));
      };
    }
  }, []);

  const setupCameraStream = useCallback(async () => {
    setCameraStatus("connecting");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatus("unsupported");
      return;
    }

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640, min: 320 },
          height: { ideal: 480, min: 240 },
          facingMode: "user",
        },
        audio: false,
      });

      streamRef.current = stream;
      attachStreamToVideo(stream);
      setCameraStatus("active");
    } catch (err: any) {
      console.warn("Camera access error / denied:", err);
      setCameraStatus("denied");
      // Trigger violation if camera is denied
      const now = Date.now();
      if (now - lastViolationTimeRef.current > 8000) {
        lastViolationTimeRef.current = now;
        onViolationRef.current?.({
          reason: "[Kamera Pengawas] Akses kamera pengawas tidak diizinkan / dinonaktifkan",
          detail:
            "Izin kamera ditolak atau kamera dinonaktifkan, sehingga siswa tidak dapat diawasi selama ujian berlangsung.",
          source: "kamera",
          severity: "kritis",
          evidence: `Akses kamera ditolak (${err?.name || "NotAllowedError"})`,
        });
      }
    }
  }, [attachStreamToVideo]);

  // Trigger violation with sound and cooldown
  const triggerViolation = useCallback((event: ViolationEvent) => {
    const now = Date.now();
    if (now - lastViolationTimeRef.current < 6000) return; // 6s cooldown
    lastViolationTimeRef.current = now;

    setActiveWarning(event.reason);
    playAlertSound("warning");
    onViolationRef.current?.(event);

    setTimeout(() => {
      setActiveWarning(null);
    }, 4500);
  }, []);

  // Callback ref to guarantee stream attachment
  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
      node.onloadedmetadata = () => {
        node.play().catch((err) => console.warn("Video auto-play warning:", err));
      };
    }
  }, []);

  // Main lifecycle for stream & motion analysis
  useEffect(() => {
    if (!isActive) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      return;
    }

    setupCameraStream();

    // Reset analisis agar tidak dibandingkan dengan frame dari sesi sebelumnya
    prevFrameDataRef.current = null;
    darkFrameCountRef.current = 0;
    absentFrameCountRef.current = 0;
    lastViolationTimeRef.current = 0;

    // Periodic snapshot & motion analysis interval
    const interval = setInterval(() => {
      setSnapshotCount((prev) => prev + 1);

      // Perform frame pixel diffing on offscreen canvas
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2 || video.paused) return;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      try {
        ctx.drawImage(video, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        const totalPixels = w * h;

        const currentLuma = new Uint8Array(totalPixels);
        let totalBrightness = 0;

        for (let i = 0; i < totalPixels; i++) {
          const r = data[i * 4];
          const g = data[i * 4 + 1];
          const b = data[i * 4 + 2];
          // Standard luminance formula
          const luma = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
          currentLuma[i] = luma;
          totalBrightness += luma;
        }

        const avgBrightness = totalBrightness / totalPixels;

        // 1. Check for pitch dark / covered camera
        if (avgBrightness < 15) {
          darkFrameCountRef.current += 1;
          if (darkFrameCountRef.current >= 2) {
            triggerViolation({
              reason: "[Kamera Pengawas] Kamera tertutup atau pencahayaan terlalu gelap",
              detail:
                "Lensa kamera tertutup atau ruangan terlalu gelap sehingga wajah siswa tidak dapat diawasi.",
              source: "kamera",
              severity: "peringatan",
              evidence: `Kecerahan rata-rata ${avgBrightness.toFixed(0)}/255 selama ${darkFrameCountRef.current} frame`,
            });
          }
        } else {
          darkFrameCountRef.current = 0;
        }

        // 2. Motion diffing against previous frame
        if (prevFrameDataRef.current && prevFrameDataRef.current.length === totalPixels) {
          const prevLuma = prevFrameDataRef.current;
          let changedPixels = 0;
          let centerChanged = 0;
          let centerTotal = 0;

          // Define center box (middle 50% width and height)
          const startX = Math.floor(w * 0.25);
          const endX = Math.floor(w * 0.75);
          const startY = Math.floor(h * 0.2);
          const endY = Math.floor(h * 0.8);

          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const idx = y * w + x;
              const diff = Math.abs(currentLuma[idx] - prevLuma[idx]);
              if (diff > 25) {
                changedPixels++;
                if (x >= startX && x <= endX && y >= startY && y <= endY) {
                  centerChanged++;
                }
              }
              if (x >= startX && x <= endX && y >= startY && y <= endY) {
                centerTotal++;
              }
            }
          }

          const motionPercent = Math.min(100, Math.round((changedPixels / totalPixels) * 100));
          const centerMotionPercent = Math.min(
            100,
            Math.round((centerChanged / Math.max(1, centerTotal)) * 100)
          );
          setMotionLevel(Math.max(motionPercent, centerMotionPercent));

          // Gerak area wajah dipantau terpisah dari seluruh bingkai agar
          // gerak wajar saat menulis tidak salah dianggap sebagai pelanggaran.
          if (centerMotionPercent > 55) {
            triggerViolation({
              reason: "[Kamera Pengawas] Pergerakan berlebih / tidak wajar terdeteksi di kamera",
              detail:
                "Siswa berpindah posisi, berdiri, atau berbalik dari kamera saat mengerjakan soal.",
              source: "kamera",
              severity: "pelanggaran",
              evidence: `Gerak area wajah ${centerMotionPercent}% (ambang 55%)`,
            });
          } else if (motionPercent > 80) {
            triggerViolation({
              reason: "[Kamera Pengawas] Perubahan besar pada seluruh bingkai kamera",
              detail:
                "Seluruh bingkai kamera berubah drastis, misalnya kamera digeser atau ditutup.",
              source: "kamera",
              severity: "peringatan",
              evidence: `Perubahan seluruh bingkai ${motionPercent}% (ambang 80%)`,
            });
          }

          // Center variance check (person presence in front of camera)
          let centerVariance = 0;
          let centerSum = 0;
          for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
              centerSum += currentLuma[y * w + x];
            }
          }
          const centerAvg = centerSum / centerTotal;
          for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
              const d = currentLuma[y * w + x] - centerAvg;
              centerVariance += d * d;
            }
          }
          centerVariance = Math.sqrt(centerVariance / centerTotal);

          // If center area has almost no contrast/texture (blank background / student out of frame)
          if (avgBrightness >= 25 && centerVariance < 8) {
            absentFrameCountRef.current += 1;
            if (absentFrameCountRef.current >= 3) {
              triggerViolation({
                reason: "[Kamera Pengawas] Wajah peserta tidak terdeteksi di bingkai kamera",
                detail:
                  "Area tengah bingkai kamera kosong tanpa tekstur wajah, indikasi siswa keluar dari bingkai kamera.",
                source: "kamera",
                severity: "peringatan",
                evidence: `Kontras area wajah ${centerVariance.toFixed(1)} (ambang 8) selama ${absentFrameCountRef.current} frame`,
              });
            }
          } else {
            absentFrameCountRef.current = 0;
          }
        }

        prevFrameDataRef.current = currentLuma;
      } catch (err) {
        console.warn("Frame analysis error:", err);
      }
    }, 800);

    return () => {
      clearInterval(interval);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [isActive, setupCameraStream, triggerViolation]);

  if (!isActive) return null;

  return (
    <div
      id="exam-camera-proctor"
      className="fixed bottom-4 right-4 z-40 transition-all duration-300 shadow-2xl rounded-2xl overflow-hidden border-2 border-indigo-500 bg-slate-900 text-white select-none ring-4 ring-indigo-500/20"
      style={{ width: isMinimized ? "210px" : "260px" }}
    >
      {/* Hidden offscreen canvas for real-time motion and pixel diff analysis */}
      <canvas ref={canvasRef} width={120} height={90} className="hidden" />

      {/* Proctoring Header */}
      <div className="bg-slate-950 px-3 py-2 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
          </span>
          <span className="text-[11px] font-black tracking-wider uppercase text-slate-200 flex items-center gap-1">
            Kamera AI Proctor
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsMinimized(!isMinimized)}
          className="text-[10px] font-semibold text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition"
          title={isMinimized ? "Perbesar tampilan kamera" : "Perkecil tampilan"}
        >
          {isMinimized ? "Buka" : "Kecil"}
        </button>
      </div>

      {/* Active Warning Overlay Banner */}
      {activeWarning && (
        <div className="bg-rose-600 text-white px-2.5 py-1.5 text-[10px] font-bold flex items-center gap-1.5 animate-bounce shadow-lg">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span className="leading-tight line-clamp-2">{activeWarning}</span>
        </div>
      )}

      {/* Video Stream & Visual Guides */}
      {!isMinimized && (
        <div className="relative aspect-4/3 bg-slate-950 flex items-center justify-center overflow-hidden">
          {/* Video Stream */}
          <video
            ref={setVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-300 ${
              cameraStatus === "active" ? "opacity-100 block" : "opacity-0 hidden"
            }`}
          />

          {cameraStatus === "active" && (
            /* Face Guide Overlay & Motion Sensor */
            <div className="absolute inset-0 pointer-events-none border border-emerald-500/40 rounded-xl m-2 flex flex-col justify-between p-2">
              <div className="flex justify-between items-center text-[9px] text-emerald-400 font-mono drop-shadow">
                <span className="flex items-center gap-1 bg-black/70 px-1.5 py-0.5 rounded border border-emerald-500/30">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  WAJAH TERAWASI
                </span>
                <span className="bg-black/70 px-1.5 py-0.5 rounded text-[8px] text-slate-300 border border-slate-700">
                  Snap #{snapshotCount}
                </span>
              </div>

              {/* Real-time Motion Bar Meter */}
              <div className="bg-black/80 p-1.5 rounded-lg border border-slate-700/60 backdrop-blur-xs space-y-1">
                <div className="flex justify-between items-center text-[8px] font-mono">
                  <span className="flex items-center gap-1 text-slate-300">
                    <Activity className="w-2.5 h-2.5 text-indigo-400" /> Sensor Gerak:
                  </span>
                  <span
                    className={`font-bold ${
                      motionLevel > 40
                        ? "text-rose-400 animate-pulse"
                        : motionLevel > 15
                        ? "text-amber-300"
                        : "text-emerald-400"
                    }`}
                  >
                    {motionLevel > 40
                      ? "Gerak Tinggi!"
                      : motionLevel > 15
                      ? "Aktivitas"
                      : "Stabil"}
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      motionLevel > 40
                        ? "bg-rose-500"
                        : motionLevel > 15
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                    }`}
                    style={{ width: `${Math.max(8, motionLevel)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {cameraStatus === "connecting" && (
            <div className="flex flex-col items-center gap-2 p-4 text-center">
              <Camera className="w-8 h-8 animate-pulse text-indigo-400" />
              <span className="text-xs text-slate-300 font-medium">Menghubungkan kamera...</span>
              <span className="text-[10px] text-slate-400">Pastikan izin kamera diizinkan</span>
            </div>
          )}

          {cameraStatus === "denied" && (
            <div className="p-3 text-center flex flex-col items-center justify-center h-full">
              <CameraOff className="w-7 h-7 text-amber-400 mb-1.5" />
              <p className="text-xs font-bold text-amber-200">Izin Kamera Diperlukan</p>
              <p className="text-[10px] text-slate-400 mt-1 leading-tight mb-2">
                Izinkan akses kamera di browser Anda untuk pengawasan ujian online.
              </p>
              <button
                type="button"
                onClick={setupCameraStream}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-lg shadow transition flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Coba Lagi
              </button>
            </div>
          )}

          {cameraStatus === "unsupported" && (
            <div className="p-4 text-center">
              <AlertCircle className="w-8 h-8 text-rose-400 mb-1 mx-auto" />
              <p className="text-xs text-slate-300">Kamera tidak didukung / tidak ditemukan</p>
            </div>
          )}

          {/* Student Watermark */}
          <div className="absolute bottom-1 left-1.5 right-1.5 text-[9px] text-slate-200 bg-black/85 px-2 py-0.5 rounded truncate font-mono flex items-center justify-between border border-slate-800">
            <span className="truncate">{studentName}</span>
            <span className="text-emerald-400 ml-1 shrink-0 flex items-center gap-0.5 font-bold">
              <Eye className="w-2.5 h-2.5" /> LIVE
            </span>
          </div>
        </div>
      )}

      {/* Minimized View */}
      {isMinimized && (
        <div className="px-3 py-2 bg-slate-900 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 truncate">
            <Camera className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="truncate text-slate-300 font-mono text-[11px]">
              {cameraStatus === "active" ? "Kamera Mengawasi (Live)" : "Sensor Pengawas"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
