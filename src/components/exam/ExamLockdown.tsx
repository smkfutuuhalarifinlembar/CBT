import { useEffect, useState, useCallback, useRef } from "react";
import { Lock, ShieldAlert, Maximize, Shield, CheckCircle2, ExternalLink } from "lucide-react";
import { playAlertSound } from "../../utils/examHelpers";
import { ViolationEvent } from "../../types";

interface ExamLockdownProps {
  isEnabled: boolean;
  maxViolations?: number;
  /** Jumlah pelanggaran dari sesi sebelumnya (lanjutkan sesi aktif). */
  initialViolationCount?: number;
  onViolation: (event: ViolationEvent, count: number) => void;
  onForceSubmit: (reason: string) => void;
}

export function ExamLockdown({
  isEnabled,
  maxViolations = 3,
  initialViolationCount = 0,
  onViolation,
  onForceSubmit,
}: ExamLockdownProps) {
  const [violationCount, setViolationCount] = useState<number>(initialViolationCount);
  const [isLockdownStarted, setIsLockdownStarted] = useState<boolean>(false);
  const [isInsideIframe, setIsInsideIframe] = useState<boolean>(false);
  const [activeAlert, setActiveAlert] = useState<{
    show: boolean;
    reason: string;
    countdown: number;
  }>({
    show: false,
    reason: "",
    countdown: 5,
  });
  const [isNativeFullscreen, setIsNativeFullscreen] = useState<boolean>(false);
  const lastViolationTime = useRef<number>(0);
  const violationCountRef = useRef<number>(initialViolationCount);
  const hasEnteredFullscreenOnce = useRef<boolean>(false);
  const onViolationRef = useRef(onViolation);
  const onForceSubmitRef = useRef(onForceSubmit);

  useEffect(() => {
    violationCountRef.current = initialViolationCount;
    setViolationCount(initialViolationCount);
  }, [initialViolationCount]);

  useEffect(() => {
    onViolationRef.current = onViolation;
  }, [onViolation]);

  useEffect(() => {
    onForceSubmitRef.current = onForceSubmit;
  }, [onForceSubmit]);

  useEffect(() => {
    try {
      setIsInsideIframe(window.self !== window.top);
      setIsNativeFullscreen(
        Boolean(
          document.fullscreenElement ||
            (document as any).webkitFullscreenElement ||
            (document as any).mozFullScreenElement ||
            (document as any).msFullscreenElement
        )
      );
    } catch {
      setIsInsideIframe(false);
    }
  }, []);

  // Request browser native fullscreen with cross-browser prefixes
  const enterFullscreen = useCallback(async () => {
    setIsLockdownStarted(true);

    try {
      const docEl = document.documentElement as any;
      const requestMethod =
        docEl.requestFullscreen ||
        docEl.webkitRequestFullscreen ||
        docEl.mozRequestFullScreen ||
        docEl.msRequestFullscreen;

      if (requestMethod) {
        await requestMethod.call(docEl);
      } else if (document.body) {
        const bodyEl = document.body as any;
        const bodyRequest =
          bodyEl.requestFullscreen ||
          bodyEl.webkitRequestFullscreen ||
          bodyEl.mozRequestFullScreen ||
          bodyEl.msRequestFullscreen;
        if (bodyRequest) {
          await bodyRequest.call(bodyEl);
        }
      }

      setIsNativeFullscreen(
        Boolean(
          document.fullscreenElement ||
            (document as any).webkitFullscreenElement ||
            (document as any).mozFullScreenElement ||
            (document as any).msFullscreenElement
        )
      );
      hasEnteredFullscreenOnce.current = true;
    } catch (err) {
      console.warn("Fullscreen request error/fallback:", err);
      setIsNativeFullscreen(false);
      hasEnteredFullscreenOnce.current = true;
    }
  }, []);

  const openInNewTab = () => {
    window.open(window.location.href, "_blank", "noopener,noreferrer");
  };

  // Handle violation trigger with debounce
  const triggerViolation = useCallback(
    (event: ViolationEvent) => {
      if (!isEnabled || !isLockdownStarted) return;
      const now = Date.now();
      // Debounce duplicate triggers within 2 seconds
      if (now - lastViolationTime.current < 2000) return;
      lastViolationTime.current = now;

      playAlertSound("violation");

      const nextCount = violationCountRef.current + 1;
      violationCountRef.current = nextCount;
      setViolationCount(nextCount);

      // Call parent callback safely
      onViolationRef.current(event, nextCount);

      if (nextCount >= maxViolations) {
        setActiveAlert({
          show: true,
          reason: `Batas pelanggaran keamanan tercapai (${nextCount}/${maxViolations})! Lembar jawaban akan otomatis dikumpulkan demi integritas ujian.`,
          countdown: 3,
        });
        setTimeout(() => {
          onForceSubmitRef.current(`Diskualifikasi / Pelanggaran berulang: ${event.reason}`);
        }, 3000);
      } else {
        setActiveAlert({
          show: true,
          reason: `Pelanggaran ${nextCount}/${maxViolations}: ${event.reason}. Dilarang meminimalisir jendela (minimize), membuka tab lain, atau beralih aplikasi!`,
          countdown: 5,
        });
      }
    },
    [isEnabled, isLockdownStarted, maxViolations]
  );

  // Listen for fullscreen change
  useEffect(() => {
    if (!isEnabled) return;

    const handleFullscreenChange = () => {
      const isFull = Boolean(
        document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          (document as any).mozFullScreenElement ||
          (document as any).msFullscreenElement
      );
      setIsNativeFullscreen(isFull);
      if (isFull) {
        hasEnteredFullscreenOnce.current = true;
      } else if (hasEnteredFullscreenOnce.current && isLockdownStarted) {
        triggerViolation({
          reason: "Keluar dari Mode Layar Penuh (Exited Fullscreen / Minimize)",
          detail:
            "Siswa keluar dari mode layar penuh, sehingga jendela ujian tidak lagi terkunci dan isi soal berpotensi terlihat oleh aplikasi lain.",
          source: "layar",
          severity: "pelanggaran",
        });
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
    };
  }, [isEnabled, isLockdownStarted, triggerViolation]);

  // Listen for minimize, tab switch, and window blur
  useEffect(() => {
    if (!isEnabled || !isLockdownStarted) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerViolation({
          reason: "Jendela ujian diminimalkan atau tab ditutup / berpindah tab (Minimize/Tab Switch)",
          detail:
            "Tab ujian disembunyikan atau berpindah ke tab lain, sehingga siswa dapat melihat materi di luar lembar ujian.",
          source: "layar",
          severity: "pelanggaran",
        });
      }
    };

    const handleWindowBlur = () => {
      setTimeout(() => {
        if (document.hidden || !document.hasFocus()) {
          triggerViolation({
            reason: "Fokus layar ujian hilang (Jendela diminimalkan / aplikasi lain dibuka)",
            detail:
              "Fokus jendela ujian hilang karena aplikasi atau jendela lain dibuka, menandakan siswa berpindah dari lembar ujian.",
            source: "layar",
            severity: "pelanggaran",
          });
        }
      }, 300);
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Ujian sedang berlangsung! Jika Anda keluar sekarang, lembar jawaban akan disimpan sesuai progres.";
      return e.returnValue;
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Block F11, F12 (devtools & manual screen mode)
      if (e.key === "F12") {
        e.preventDefault();
        triggerViolation({
          reason: `Percobaan menekan tombol fungsi sistem (${e.key})`,
          detail: `Siswa menekan ${e.key} yang digunakan untuk membuka Developer Tools browser.`,
          source: "sistem",
          severity: "kritis",
          evidence: `Tombol ${e.key}`,
        });
        return;
      }

      // Block Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
      if (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C")) {
        e.preventDefault();
        triggerViolation({
          reason: "Percobaan membuka Developer Tools",
          detail: `Siswa mencoba membuka Developer Tools lewat pintasan Ctrl+Shift+${e.key.toUpperCase()}.`,
          source: "sistem",
          severity: "kritis",
          evidence: `Ctrl+Shift+${e.key.toUpperCase()}`,
        });
        return;
      }

      // Block copy, paste, cut, select all, print, view source
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();
        if (["c", "v", "x", "p", "u", "s", "a"].includes(k)) {
          e.preventDefault();
          playAlertSound("warning");
          return;
        }
      }

      // Warn on Esc
      if (e.key === "Escape") {
        playAlertSound("warning");
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isEnabled, isLockdownStarted, triggerViolation]);

  // Countdown timer for alert overlay
  useEffect(() => {
    if (!activeAlert.show) return;
    const timer = setInterval(() => {
      setActiveAlert((prev) => {
        if (prev.countdown <= 1) {
          clearInterval(timer);
          return { ...prev, show: false };
        }
        return { ...prev, countdown: prev.countdown - 1 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeAlert.show]);

  if (!isEnabled) return null;

  return (
    <>
      {/* 1. Modal Awal: Konfirmasi Memulai Ujian & Mengunci Layar Penuh */}
      {!isLockdownStarted && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-indigo-500 max-w-md w-full rounded-3xl p-6 sm:p-8 text-center text-white shadow-2xl relative overflow-hidden">
            <div className="w-16 h-16 bg-indigo-600/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-500/30">
              <Maximize className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-black text-white tracking-tight">
              Sistem Ujian Terkunci & Layar Penuh
            </h3>

            <p className="text-xs sm:text-sm text-slate-300 mt-2.5 leading-relaxed">
              Mode ujian penuh akan mengunci peramban sehingga tidak ada tab atau aplikasi lain yang tampak, serta mengaktifkan kamera pengawas.
            </p>

            <div className="my-5 p-4 bg-slate-950/80 rounded-2xl border border-slate-800 text-left text-xs space-y-2.5">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Kamera Pengawas AI Wajah Aktif</span>
              </div>
              <div className="flex items-center gap-2 text-indigo-300 font-bold">
                <Shield className="w-4 h-4 shrink-0" />
                <span>Mode Layar Penuh Total (Kiosk Mode)</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed pt-1 border-t border-slate-800/80">
                Peringatan: Meminimalisir jendela (minimize), membuka tab baru, atau berpindah aplikasi akan dicatat langsung sebagai <strong className="text-rose-400">pelanggaran</strong> ke guru pengawas.
              </p>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={enterFullscreen}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black rounded-2xl text-sm transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Maximize className="w-4 h-4" />
                <span>Mulai Ujian (Kunci Layar Penuh)</span>
              </button>

              {isInsideIframe && (
                <button
                  type="button"
                  onClick={openInNewTab}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka di Tab Baru (Sembunyikan Semua Tab Google)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Mini restore bar jika keluar dari native fullscreen saat ujian berjalan */}
      {isLockdownStarted && !isNativeFullscreen && (
        <div className="fixed top-0 inset-x-0 z-40 bg-amber-600 text-white px-4 py-1.5 flex items-center justify-between text-xs font-semibold shadow-md">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5" />
            <span>Pengawasan Ujian: Klik tombol untuk mengunci layar penuh tanpa tab browser</span>
          </div>
          <button
            type="button"
            onClick={enterFullscreen}
            className="bg-white text-amber-900 px-3 py-1 rounded-lg text-[11px] font-bold hover:bg-amber-50 flex items-center gap-1.5 shadow transition cursor-pointer"
          >
            <Maximize className="w-3.5 h-3.5" />
            Kunci Layar Penuh
          </button>
        </div>
      )}

      {/* 3. Violation Modal / Overlay */}
      {activeAlert.show && (
        <div className="fixed inset-0 z-50 bg-rose-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-rose-500 max-w-lg w-full rounded-3xl p-6 sm:p-8 text-center text-white shadow-2xl relative overflow-hidden">
            <div className="w-16 h-16 bg-rose-600/20 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ring-rose-500/10">
              <ShieldAlert className="w-9 h-9" />
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-rose-400 uppercase tracking-wide">
              Peringatan Pelanggaran Ujian!
            </h3>

            <p className="text-sm text-slate-200 mt-3 font-medium leading-relaxed">
              {activeAlert.reason}
            </p>

            <div className="mt-5 p-4 bg-slate-950/80 rounded-2xl border border-slate-800 text-left">
              <div className="flex justify-between items-center text-xs font-semibold mb-2">
                <span className="text-slate-400">Total Catatan Pelanggaran:</span>
                <span className="text-rose-400 font-bold">
                  {violationCount} dari {maxViolations} Batas Maksimal
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-rose-500 h-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (violationCount / maxViolations) * 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Peringatan: Riwayat pelanggaran disimpan dan dilaporkan secara langsung ke Guru dan Administrator.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-center">
              <button
                type="button"
                onClick={() => {
                  setActiveAlert((prev) => ({ ...prev, show: false }));
                }}
                className="w-full px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-sm transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                Saya Paham, Kembali Mengerjakan ({activeAlert.countdown}s)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
