import { useState } from "react";
import { X, Copy, Check, Terminal, Sparkles, BookOpen } from "lucide-react";

interface PromptDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PromptDocsModal({ isOpen, onClose }: PromptDocsModalProps) {
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const promptText = `Buatkan aplikasi web sistem ujian essay/uraian online interaktif berbasis AI dan anti-kecurangan dengan spesifikasi lengkap berikut:

1. ARSITEKTUR 3 ROLE (MULTI-ROLE):
   - ADMIN: Manajemen kelas sekolah, data guru & siswa, monitoring log pelanggaran ujian (anti-cheat audit), dan ikhtisar analitik seluruh sekolah.
   - GURU: Membuat & mengedit ujian uraian, mengisi kunci jawaban model guru, menentukan kata kunci wajib & bobot nilai per soal, melihat daftar lembar jawaban siswa, menyesuaikan nilai manual, serta fitur PRATINJAU (PREVIEW SISWA SEBELUM PUBLIKASI).
   - SISWA: Melihat jadwal ujian khusus kelasnya, mengerjakan ujian uraian aktif, live proctoring kamera, mode layar terkunci (lockdown), dan langsung melihat nilai serta evaluasi uraian setelah selesai dikumpulkan.

2. ATURAN JADWAL & 1 KALI UJIAN (SINGLE-ATTEMPT):
   - Ujian siswa hanya dapat dilakukan 1 kali untuk setiap mata pelajaran. Jika sudah submit, tombol ujian dinonaktifkan dan berubah menjadi "Lihat Nilai & Rubrik".
   - Tampilkan seluruh ujian kelas siswa. Ujian yang dapat dikerjakan (aktif) HANYA ujian yang sesuai dengan tanggal hari ini dan berada dalam rentang jam mulai s.d. jam selesai. Di luar jam tersebut berstatus "Belum Dimulai" atau "Waktu Habis".

3. PENCOCOKAN JAWABAN URAIAN OTOMATIS (AI ESSAY GRADING):
   - Sistem mencocokkan substansi jawaban uraian siswa terhadap kunci jawaban guru menggunakan Google Gemini 3.8 Flash pada backend Express.
   - Evaluasi menghasilkan skor objektif (0-100), poin kata kunci yang cocok (matchedKeyPoints), poin yang terlewat (missingKeyPoints), dan umpan balik konstruktif dalam Bahasa Indonesia.
   - Dilengkapi fallback grading algorithm cerdas jika offline/tanpa kunci API.

4. NILAI LANGSUNG MUNCUL (IMMEDIATE SCORE REVEAL):
   - Begitu siswa menekan "Kumpulkan Ujian", hasil evaluasi AI langsung ditampilkan: nilai total, status kelulusan (KKM), dan breakdown per nomor soal beserta kunci jawabannya.

5. KAMERA PENGAWAS PROCTORING AKTIF:
   - Kamera webcam aktif otomatis via navigator.mediaDevices.getUserMedia saat siswa mulai ujian hingga selesai dalam PiP HUD interaktif (status REC).

6. MODE LAYAR TERKUNCI (SECURE LOCKDOWN & ANTI-CHEAT):
   - Otomatis masuk mode Fullscreen.
   - Melacak visibilitas tab (visibilitychange), blur jendela (kehilangan fokus), tombol fungsi devtools (F12, F11, Ctrl+Shift+I), klik kanan, dan pintasan salin-tempel (copy-paste).
   - Menampilkan peringatan sirine audio dan overlay pelanggaran dengan batas maksimal 3 kali sebelum otomatis dikumpulkan demi integritas ujian.

7. PRATINJAU HASIL SEBELUM PUBLIKASI (DRAFT PREVIEW):
   - Guru dapat menyimpan ujian sebagai "Draf" dan melakukan "Pratinjau Siswa" untuk menguji tampilan dan simulasi pengerjaan sebelum ujian dirilis ke siswa.

8. RESPONSIF & SIAP DEPLOY GOOGLE AI STUDIO:
   - Tampilan adaptif penuh untuk Laptop, Tablet, dan Ponsel pintar (Mobile responsive) menggunakan Tailwind CSS dan Plus Jakarta Sans.`;

  const handleCopy = () => {
    navigator.clipboard.writeText(promptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Prompt Master & Spesifikasi Sistem Ujian Uraian AI
              </h2>
              <p className="text-xs text-slate-500">
                Salin prompt ini untuk dokumentasi atau pembuatan di Google AI Studio
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-indigo-600" />
              Teks Prompt Lengkap (Bahasa Indonesia)
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Tersalin ke Clipboard!" : "Salin Prompt Master"}
            </button>
          </div>

          <pre className="p-4 bg-slate-900 text-slate-100 rounded-2xl text-xs font-mono whitespace-pre-wrap leading-relaxed border border-slate-800 shadow-inner max-h-[60vh] overflow-y-auto">
            {promptText}
          </pre>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Aplikasi ini telah menerapkan 100% dari seluruh poin di atas.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
