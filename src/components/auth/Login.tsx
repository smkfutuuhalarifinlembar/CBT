import { useState, FormEvent } from "react";
import { User, UserRole, SchoolProfile } from "../../types";
import { storage } from "../../services/storage";
import {
  ShieldAlert,
  BookOpen,
  GraduationCap,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Camera,
  ArrowRight,
  School,
  KeyRound,
  FileCheck2,
} from "lucide-react";

interface LoginProps {
  schoolProfile?: SchoolProfile;
  onLoginSuccess: (user: User) => void;
  onOpenPromptDocs: () => void;
}

export function Login({ schoolProfile, onLoginSuccess, onOpenPromptDocs }: LoginProps) {
  const [selectedRoleTab, setSelectedRoleTab] = useState<UserRole>("siswa");
  const [identifier, setIdentifier] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleRoleTabChange = (role: UserRole) => {
    setSelectedRoleTab(role);
    setErrorMsg(null);
    setIdentifier("");
    setPassword("");
  };



  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    const res = await storage.login(identifier, password, selectedRoleTab);
    setIsLoading(false);
    if (res.success && res.user) {
      onLoginSuccess(res.user);
    } else {
      setErrorMsg(res.error || "Login gagal. Silakan periksa kembali data Anda.");
    }
  };

  const handleQuickLogin = (user: User) => {
    storage.setCurrentUser(user);
    onLoginSuccess(user);
  };

  const roleConfigs = {
    admin: {
      title: "Administrator",
      badge: "bg-purple-100 text-purple-800 border-purple-300",
      icon: ShieldAlert,
      themeColor: "purple",
      desc: "Pusat kendali operasional ujian sekolah, log pelanggaran integritas, pengaturan identitas sekolah, dan manajemen pengguna.",
      features: [
        "Audit Log Pelanggaran Real-time (Anti-Curang)",
        "Pengaturan Identitas & Logo Sekolah (Kop Resmi)",
        "Manajemen Pengguna, Ganti Sandi & Cetak Kartu",
        "Master Reset & Pemantauan Nilai Sekolah",
      ],
      placeholder: "Email / Username Administrator",
    },
    guru: {
      title: "Guru / Pengajar",
      badge: "bg-teal-100 text-teal-800 border-teal-300",
      icon: BookOpen,
      themeColor: "teal",
      desc: "Pengelolaan bank soal essay, perumusan rubrik kunci jawaban AI, dan peninjauan koreksi nilai siswa.",
      features: [
        "Pembuat Soal Uraian dengan Kunci Jawaban Model",
        "Ekstraksi Kata Kunci Wajib & Panduan Rubrik AI",
        "Mode Pratinjau (Preview) Simulasi Ujian Guru",
        "Peninjauan Jawaban Siswa & Penyesuaian Skor Manual",
      ],
      placeholder: "siti.guru@sekolah.sch.id atau NIP",
    },
    siswa: {
      title: "Siswa / Peserta",
      badge: "bg-indigo-100 text-indigo-800 border-indigo-300",
      icon: GraduationCap,
      themeColor: "indigo",
      desc: "Pelaksanaan ujian essay terjadwal dengan sistem pengawasan kamera, mode lockdown, dan nilai instan.",
      features: [
        "Jadwal Ujian Aktif Hari Ini (Validasi Jam Mulai-Selesai)",
        "Aturan Ketat 1x Pengerjaan per Mata Pelajaran",
        "Kamera Pengawas (Webcam) Aktif selama Ujian",
        "Mode Kiosk Lockdown (Cegah Buka Tab / Keluar Layar)",
        "Hasil & Rincian Nilai AI Langsung Keluar",
      ],
      placeholder: "ahmad.fauzi@siswa.sch.id atau NISN",
    },
  };

  const currentConfig = roleConfigs[selectedRoleTab];
  const CurrentIcon = currentConfig.icon;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Top Bar */}
      <nav className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {schoolProfile?.logoUrl ? (
            <div className="w-10 h-10 rounded-2xl bg-white border border-slate-700 p-0.5 shadow-lg overflow-hidden shrink-0 flex items-center justify-center">
              <img
                src={schoolProfile.logoUrl}
                alt="Logo Sekolah"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
              <School className="w-5 h-5" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-white text-base tracking-tight">
                {schoolProfile?.name || "Sistem Ujian Essay"}
              </span>
              <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                v2.5 AI Proctor
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              {schoolProfile?.headerTitle || "Platform Ujian Uraian dengan Pencocokan Kunci Jawaban & Lockdown Kiosk"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenPromptDocs}
          className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white text-xs font-bold border border-slate-700/80 flex items-center gap-1.5 transition shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Prompt Master Ujian AI</span>
        </button>
      </nav>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 sm:py-12 flex flex-col items-center justify-center">
        {/* Role Comparison Banner */}
        <div className="text-center max-w-2xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-3">
            <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
            Autentikasi Multi-Role Berbasis Hak Akses
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Selamat Datang di Portal Ujian
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-2">
            Silakan pilih jenis peran akun Anda dan masukkan kredensial resmi untuk mengakses sistem ujian.
          </p>
        </div>

        {/* Role Selector Tabs */}
        <div className="w-full max-w-4xl grid grid-cols-3 gap-2 sm:gap-3 p-1.5 bg-slate-950/80 rounded-2xl border border-slate-800 mb-6 shadow-inner">
          <button
            type="button"
            onClick={() => handleRoleTabChange("siswa")}
            className={`py-3 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex flex-col sm:flex-row items-center justify-center gap-2 transition ${
              selectedRoleTab === "siswa"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Role Siswa</span>
          </button>

          <button
            type="button"
            onClick={() => handleRoleTabChange("guru")}
            className={`py-3 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex flex-col sm:flex-row items-center justify-center gap-2 transition ${
              selectedRoleTab === "guru"
                ? "bg-teal-600 text-white shadow-lg shadow-teal-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Role Guru</span>
          </button>

          <button
            type="button"
            onClick={() => handleRoleTabChange("admin")}
            className={`py-3 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex flex-col sm:flex-row items-center justify-center gap-2 transition ${
              selectedRoleTab === "admin"
                ? "bg-purple-700 text-white shadow-lg shadow-purple-700/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Role Admin</span>
          </button>
        </div>

        {/* Login Card Grid (Role Info + Login Form) */}
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-950 rounded-3xl border border-slate-800/90 shadow-2xl overflow-hidden">
          {/* Left Column: Role Features Highlight */}
          <div className="lg:col-span-5 p-6 sm:p-8 bg-gradient-to-b from-slate-900 to-slate-950 border-b lg:border-b-0 lg:border-r border-slate-800/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                    selectedRoleTab === "admin"
                      ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                      : selectedRoleTab === "guru"
                      ? "bg-teal-500/20 text-teal-400 border border-teal-500/30"
                      : "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                  }`}
                >
                  <CurrentIcon className="w-5 h-5" />
                </div>
                <div>
                  <span
                    className={`inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${currentConfig.badge}`}
                  >
                    Hak Akses: {currentConfig.title}
                  </span>
                  <h3 className="text-lg font-bold text-white leading-snug">
                    Fitur Khusus {currentConfig.title}
                  </h3>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                {currentConfig.desc}
              </p>

              <div className="space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Kapabilitas Role Ini:
                </span>
                {currentConfig.features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-300">
                    <CheckCircle2
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        selectedRoleTab === "admin"
                          ? "text-purple-400"
                          : selectedRoleTab === "guru"
                          ? "text-teal-400"
                          : "text-indigo-400"
                      }`}
                    />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-slate-400" />
                  Kamera Pengawas
                </span>
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  Lockdown Kiosk
                </span>
                <span className="flex items-center gap-1.5">
                  <FileCheck2 className="w-3.5 h-3.5 text-slate-400" />
                  AI Matching
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Login Form */}
          <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Masuk Akun {currentConfig.title}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Masukkan identitas terdaftar Anda untuk melanjutkan ke dashboard kerja.
                </p>
              </div>

              {errorMsg && (
                <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <div>
                    <strong className="block font-bold">Autentikasi Ditolak:</strong>
                    <span>{errorMsg}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                {/* Identifier Input */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    {selectedRoleTab === "siswa"
                      ? "Email atau NISN Siswa"
                      : selectedRoleTab === "guru"
                      ? "Email atau NIP Guru"
                      : "Email atau NIP Administrator"}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder={currentConfig.placeholder}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white text-xs sm:text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                      Kata Sandi (Password)
                    </label>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan kata sandi..."
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white text-xs sm:text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full py-4 px-6 rounded-xl text-sm sm:text-base font-bold text-white flex items-center justify-center gap-3 transition shadow-lg ${
                    selectedRoleTab === "admin"
                      ? "bg-purple-700 hover:bg-purple-600 shadow-purple-900/30"
                      : selectedRoleTab === "guru"
                      ? "bg-teal-600 hover:bg-teal-500 shadow-teal-900/30"
                      : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/30"
                  } disabled:opacity-50`}
                >
                  {isLoading ? (
                    <span>Memverifikasi Akun...</span>
                  ) : (
                    <>
                      <span>Masuk (Akun {currentConfig.title})</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>


            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-4 px-6 text-center text-xs text-slate-500">
        <p>
          Sistem Ujian Essay Online • Standar Integritas Proctoring & AI NLP Semantic Matcher • Gemini 3.8 Flash
        </p>
      </footer>
    </div>
  );
}
