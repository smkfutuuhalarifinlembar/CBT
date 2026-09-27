import React, { useState } from "react";
import { User, ClassRoom, Exam, ExamSubmission, SchoolProfile } from "../../types";
import { storage } from "../../services/storage";
import {
  Database,
  Download,
  Trash2,
  Upload,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  FileJson,
  Users,
  GraduationCap,
  BookOpen,
  FileSpreadsheet,
  ShieldAlert,
  HardDrive,
  Info,
  CheckSquare,
  Square,
  Sparkles,
} from "lucide-react";

interface DataBackupManagementTabProps {
  schoolProfile?: SchoolProfile;
  users: User[];
  classes: ClassRoom[];
  exams: Exam[];
  submissions: ExamSubmission[];
  onRefreshData?: () => void;
}

export function DataBackupManagementTab({
  schoolProfile,
  users,
  classes,
  exams,
  submissions,
  onRefreshData,
}: DataBackupManagementTabProps) {
  // Counts
  const studentCount = users.filter((u) => u.role === "siswa").length;
  const teacherCount = users.filter((u) => u.role === "guru").length;
  const examCount = exams.length;
  const submissionCount = submissions.length;
  const classCount = classes.length;
  const totalViolationsCount = submissions.reduce((acc, s) => acc + (s.violationLogs?.length || 0), 0);

  // Backup checkboxes state
  const [backupOptions, setBackupOptions] = useState({
    profile: true,
    students: true,
    teachers: true,
    classes: true,
    exams: true,
    submissions: true,
  });

  // Delete checkboxes state
  const [deleteOptions, setDeleteOptions] = useState({
    students: false,
    teachers: false,
    classes: false,
    exams: false,
    submissions: false,
    auditLogsOnly: false,
  });

  // Delete confirmation safety
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState<string | null>(null);
  const [deleteErrorMsg, setDeleteErrorMsg] = useState<string | null>(null);

  // Select all / Deselect all for Delete
  const toggleAllDelete = (select: boolean) => {
    setDeleteOptions({
      students: select,
      teachers: select,
      classes: select,
      exams: select,
      submissions: select,
      auditLogsOnly: false,
    });
    setDeleteErrorMsg(null);
  };

  // Restore state
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePayload, setRestorePayload] = useState<any | null>(null);
  const [restoreOptions, setRestoreOptions] = useState({
    profile: true,
    students: true,
    teachers: true,
    classes: true,
    exams: true,
    submissions: true,
  });
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccessMsg, setRestoreSuccessMsg] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // Select all / Deselect all for Backup
  const toggleAllBackup = (select: boolean) => {
    setBackupOptions({
      profile: select,
      students: select,
      teachers: select,
      classes: select,
      exams: select,
      submissions: select,
    });
  };

  // Export Backup JSON
  const handleExportBackup = () => {
    const backupData: Record<string, any> = {
      app: "Sistem Ujian Essay Online AI",
      exportDate: new Date().toISOString(),
      version: "2.0",
      modules: {},
    };

    if (backupOptions.profile && schoolProfile) {
      backupData.schoolProfile = schoolProfile;
      backupData.modules.profile = true;
    }

    if (backupOptions.classes) {
      backupData.classes = classes;
      backupData.modules.classes = classes.length;
    }

    if (backupOptions.students || backupOptions.teachers) {
      const filteredUsers = users.filter((u) => {
        if (backupOptions.students && u.role === "siswa") return true;
        if (backupOptions.teachers && u.role === "guru") return true;
        if (u.role === "admin") return true; // always include admin in backup for safety
        return false;
      });
      backupData.users = filteredUsers;
      backupData.modules.users = filteredUsers.length;
    }

    if (backupOptions.exams) {
      backupData.exams = exams;
      backupData.modules.exams = exams.length;
    }

    if (backupOptions.submissions) {
      backupData.submissions = submissions;
      backupData.modules.submissions = submissions.length;
    }

    const dataStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().split("T")[0];
    link.href = url;
    link.download = `backup_ujian_cbt_${schoolProfile?.name?.replace(/\s+/g, "_") || "sekolah"}_${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handle Restore File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreFile(file);
    setRestoreError(null);
    setRestoreSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed || typeof parsed !== "object") {
          throw new Error("Format berkas backup JSON tidak valid.");
        }
        setRestorePayload(parsed);
      } catch (err: any) {
        setRestoreError(`Gagal membaca file: ${err.message || "File JSON rusak"}`);
        setRestorePayload(null);
      }
    };
    reader.readAsText(file);
  };

  // Execute Restore
  const handleExecuteRestore = async () => {
    if (!restorePayload) return;
    setIsRestoring(true);
    setRestoreError(null);
    setRestoreSuccessMsg(null);

    try {
      const result = await storage.restoreBackupData(restorePayload, restoreOptions);
      setRestoreSuccessMsg(`Berhasil memulihkan ${result.restoredCount} entitas data dari cadangan.`);
      if (onRefreshData) onRefreshData();
      setRestorePayload(null);
      setRestoreFile(null);
    } catch (err: any) {
      setRestoreError(`Gagal memulihkan data: ${err.message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  // Count how many items will be deleted
  const getPendingDeleteCount = () => {
    let count = 0;
    if (deleteOptions.students) count += studentCount;
    if (deleteOptions.teachers) count += teacherCount;
    if (deleteOptions.classes) count += classCount;
    if (deleteOptions.exams) count += examCount;
    if (deleteOptions.submissions) count += submissionCount;
    return count;
  };

  const hasAnyDeleteSelected =
    deleteOptions.students ||
    deleteOptions.teachers ||
    deleteOptions.classes ||
    deleteOptions.exams ||
    deleteOptions.submissions ||
    deleteOptions.auditLogsOnly;

  // Execute Selective Delete
  const handleExecuteDelete = async () => {
    if (!hasAnyDeleteSelected) {
      setDeleteErrorMsg("Pilih minimal satu opsi kotak data yang hendak dihapus.");
      return;
    }

    if (deleteConfirmationText.trim().toUpperCase() !== "HAPUS") {
      setDeleteErrorMsg("Ketik kata 'HAPUS' dengan benar pada kolom konfirmasi.");
      return;
    }

    setIsDeleting(true);
    setDeleteErrorMsg(null);
    setDeleteSuccessMsg(null);

    try {
      const result = await storage.bulkDeleteData(deleteOptions);
      setDeleteSuccessMsg(
        `Penghapusan data berhasil: ${result.usersCount} pengguna, ${result.examsCount} paket ujian, ${result.submissionsCount} lembar jawaban/riwayat, dan ${result.classesCount} master kelas dibersihkan.`
      );
      setDeleteConfirmationText("");
      setDeleteOptions({
        students: false,
        teachers: false,
        classes: false,
        exams: false,
        submissions: false,
        auditLogsOnly: false,
      });
      if (onRefreshData) {
        onRefreshData();
      }
    } catch (err: any) {
      setDeleteErrorMsg(`Gagal memproses penghapusan: ${err?.message || err}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Info Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-7 text-white shadow-lg border border-indigo-800/40">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-2 border border-indigo-500/30">
              <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
              Pusat Manajemen & Keamanan Database
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              Backup, Restore & Pembersihan Data Terpilih
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              Amankan salinan basis data sekolah secara modular atau bersihkan data periode sebelumnya secara selektif dengan centang pilihan modul di bawah.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-slate-950/60 p-3 rounded-2xl border border-indigo-500/20 shrink-0">
            <div className="text-right">
              <span className="text-[10px] text-indigo-300 font-bold uppercase block">Status Cloud</span>
              <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5 justify-end">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Tersinkronisasi Realtime
              </span>
            </div>
          </div>
        </div>

        {/* Quick Current Data Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 sm:gap-3 mt-5 pt-5 border-t border-indigo-900/50 text-xs">
          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-indigo-800/20">
            <span className="text-slate-400 block text-[11px]">Siswa</span>
            <span className="text-lg font-black text-white">{studentCount}</span>
          </div>
          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-indigo-800/20">
            <span className="text-slate-400 block text-[11px]">Guru</span>
            <span className="text-lg font-black text-white">{teacherCount}</span>
          </div>
          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-indigo-800/20">
            <span className="text-slate-400 block text-[11px]">Kelas</span>
            <span className="text-lg font-black text-white">{classCount}</span>
          </div>
          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-indigo-800/20">
            <span className="text-slate-400 block text-[11px]">Daftar Ujian</span>
            <span className="text-lg font-black text-white">{examCount}</span>
          </div>
          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-indigo-800/20">
            <span className="text-slate-400 block text-[11px]">Hasil / Jawaban</span>
            <span className="text-lg font-black text-white">{submissionCount}</span>
          </div>
          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-indigo-800/20">
            <span className="text-slate-400 block text-[11px]">Log Pelanggaran</span>
            <span className="text-lg font-black text-rose-400">{totalViolationsCount}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Backup Section & Delete Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. SEKSI CADANGKAN / BACKUP DATA */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">1. Cadangkan Data (Backup)</h3>
                  <p className="text-xs text-slate-500">Pilih modul data yang ingin diekspor ke file JSON</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => toggleAllBackup(true)}
                  className="text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  Semua
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => toggleAllBackup(false)}
                  className="text-slate-500 hover:text-slate-700 font-semibold"
                >
                  Batal
                </button>
              </div>
            </div>

            {/* Checklist Backup */}
            <div className="space-y-2.5">
              <label
                className={`flex items-center justify-between p-3 rounded-2xl border transition cursor-pointer ${
                  backupOptions.profile
                    ? "bg-indigo-50/50 border-indigo-200 text-indigo-950"
                    : "bg-slate-50 border-slate-200 text-slate-600"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={backupOptions.profile}
                    onChange={(e) => setBackupOptions((p) => ({ ...p, profile: e.target.checked }))}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs sm:text-sm font-bold block">Identitas & Profil Sekolah</span>
                    <span className="text-[11px] text-slate-500">Nama sekolah, NPSN, kop surat & logo</span>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                  Profil
                </span>
              </label>

              <label
                className={`flex items-center justify-between p-3 rounded-2xl border transition cursor-pointer ${
                  backupOptions.classes
                    ? "bg-indigo-50/50 border-indigo-200 text-indigo-950"
                    : "bg-slate-50 border-slate-200 text-slate-600"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={backupOptions.classes}
                    onChange={(e) => setBackupOptions((p) => ({ ...p, classes: e.target.checked }))}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs sm:text-sm font-bold block">Master Data Kelas</span>
                    <span className="text-[11px] text-slate-500">Daftar kelas rombel & tingkat tahun ajaran</span>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                  {classCount} Kelas
                </span>
              </label>

              <label
                className={`flex items-center justify-between p-3 rounded-2xl border transition cursor-pointer ${
                  backupOptions.students
                    ? "bg-indigo-50/50 border-indigo-200 text-indigo-950"
                    : "bg-slate-50 border-slate-200 text-slate-600"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={backupOptions.students}
                    onChange={(e) => setBackupOptions((p) => ({ ...p, students: e.target.checked }))}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs sm:text-sm font-bold block">Akun Data Siswa</span>
                    <span className="text-[11px] text-slate-500">Nama, NISN, email & penempatan kelas</span>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                  {studentCount} Siswa
                </span>
              </label>

              <label
                className={`flex items-center justify-between p-3 rounded-2xl border transition cursor-pointer ${
                  backupOptions.teachers
                    ? "bg-indigo-50/50 border-indigo-200 text-indigo-950"
                    : "bg-slate-50 border-slate-200 text-slate-600"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={backupOptions.teachers}
                    onChange={(e) => setBackupOptions((p) => ({ ...p, teachers: e.target.checked }))}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs sm:text-sm font-bold block">Akun Guru Penguji</span>
                    <span className="text-[11px] text-slate-500">Data guru pengajar & pembuat soal</span>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                  {teacherCount} Guru
                </span>
              </label>

              <label
                className={`flex items-center justify-between p-3 rounded-2xl border transition cursor-pointer ${
                  backupOptions.exams
                    ? "bg-indigo-50/50 border-indigo-200 text-indigo-950"
                    : "bg-slate-50 border-slate-200 text-slate-600"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={backupOptions.exams}
                    onChange={(e) => setBackupOptions((p) => ({ ...p, exams: e.target.checked }))}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs sm:text-sm font-bold block">Bank Soal & Jadwal Ujian</span>
                    <span className="text-[11px] text-slate-500">Soal uraian, kunci jawaban model & rubrik AI</span>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                  {examCount} Ujian
                </span>
              </label>

              <label
                className={`flex items-center justify-between p-3 rounded-2xl border transition cursor-pointer ${
                  backupOptions.submissions
                    ? "bg-indigo-50/50 border-indigo-200 text-indigo-950"
                    : "bg-slate-50 border-slate-200 text-slate-600"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={backupOptions.submissions}
                    onChange={(e) => setBackupOptions((p) => ({ ...p, submissions: e.target.checked }))}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs sm:text-sm font-bold block">Hasil & Penilaian Siswa</span>
                    <span className="text-[11px] text-slate-500">Lembar jawaban, nilai AI & log rekaman curang</span>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                  {submissionCount} Jawaban
                </span>
              </label>
            </div>
          </div>

          <div className="p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
            <div className="text-[11px] text-slate-500">
              Format: <span className="font-mono font-bold text-slate-700">.json (Standard)</span>
            </div>
            <button
              type="button"
              onClick={handleExportBackup}
              disabled={
                !backupOptions.profile &&
                !backupOptions.classes &&
                !backupOptions.students &&
                !backupOptions.teachers &&
                !backupOptions.exams &&
                !backupOptions.submissions
              }
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Unduh File Cadangan (.json)</span>
            </button>
          </div>
        </div>

        {/* 2. SEKSI HAPUS DATA TERPILIH (PURGE) */}
        <div className="bg-white rounded-3xl border border-rose-200 shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-rose-100 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center font-bold">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-rose-950">2. Hapus Data Terpilih (Pembersihan)</h3>
                  <p className="text-xs text-rose-700/80">Pilih bagian data yang hendak dihapus secara permanen</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleAllDelete(true)}
                  className="px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition"
                >
                  Pilih Semua
                </button>
                <button
                  type="button"
                  onClick={() => toggleAllDelete(false)}
                  className="px-2.5 py-1 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition"
                >
                  Batal
                </button>
              </div>
            </div>

            {/* Checklist Delete */}
            <div className="space-y-2.5">
              <label
                className={`flex items-center justify-between p-3 rounded-2xl border transition cursor-pointer ${
                  deleteOptions.submissions
                    ? "bg-rose-50/80 border-rose-300 text-rose-950 font-medium"
                    : "bg-slate-50 border-slate-200 text-slate-600"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={deleteOptions.submissions}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setDeleteOptions((p) => ({
                        ...p,
                        submissions: checked,
                        auditLogsOnly: checked ? false : p.auditLogsOnly,
                      }));
                      setDeleteErrorMsg(null);
                    }}
                    className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                  />
                  <div>
                    <span className="text-xs sm:text-sm font-bold block text-rose-900">
                      Hapus Semua Lembar Jawaban & Nilai Siswa
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Mengosongkan riwayat pengerjaan siswa ({submissionCount} data)
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white border border-rose-200 text-rose-700">
                  {submissionCount} data
                </span>
              </label>

              <label
                className={`flex items-center justify-between p-3 rounded-2xl border transition cursor-pointer ${
                  deleteOptions.auditLogsOnly
                    ? "bg-rose-50/80 border-rose-300 text-rose-950 font-medium"
                    : "bg-slate-50 border-slate-200 text-slate-600"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    disabled={deleteOptions.submissions}
                    checked={deleteOptions.auditLogsOnly}
                    onChange={(e) => {
                      setDeleteOptions((p) => ({ ...p, auditLogsOnly: e.target.checked }));
                      setDeleteErrorMsg(null);
                    }}
                    className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 disabled:opacity-50"
                  />
                  <div>
                    <span className="text-xs sm:text-sm font-bold block text-slate-800">
                      Hanya Bersihkan Log Pelanggaran Layar (Integritas)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Nilai siswa tetap utuh, rekaman log curang dikosongkan ({totalViolationsCount} log)
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                  {totalViolationsCount} log
                </span>
              </label>

              <label
                className={`flex items-center justify-between p-3 rounded-2xl border transition cursor-pointer ${
                  deleteOptions.exams
                    ? "bg-rose-50/80 border-rose-300 text-rose-950 font-medium"
                    : "bg-slate-50 border-slate-200 text-slate-600"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={deleteOptions.exams}
                    onChange={(e) => {
                      setDeleteOptions((p) => ({ ...p, exams: e.target.checked }));
                      setDeleteErrorMsg(null);
                    }}
                    className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                  />
                  <div>
                    <span className="text-xs sm:text-sm font-bold block text-rose-900">
                      Hapus Seluruh Bank Soal & Jadwal Ujian
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Menghapus paket ujian yang telah dibuat guru ({examCount} ujian)
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white border border-rose-200 text-rose-700">
                  {examCount} ujian
                </span>
              </label>

              <label
                className={`flex items-center justify-between p-3 rounded-2xl border transition cursor-pointer ${
                  deleteOptions.students
                    ? "bg-rose-50/80 border-rose-300 text-rose-950 font-medium"
                    : "bg-slate-50 border-slate-200 text-slate-600"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={deleteOptions.students}
                    onChange={(e) => {
                      setDeleteOptions((p) => ({ ...p, students: e.target.checked }));
                      setDeleteErrorMsg(null);
                    }}
                    className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                  />
                  <div>
                    <span className="text-xs sm:text-sm font-bold block text-rose-900">
                      Hapus Seluruh Akun Siswa
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Menghapus semua akun siswa ({studentCount} siswa)
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white border border-rose-200 text-rose-700">
                  {studentCount} siswa
                </span>
              </label>

              <label
                className={`flex items-center justify-between p-3 rounded-2xl border transition cursor-pointer ${
                  deleteOptions.teachers
                    ? "bg-rose-50/80 border-rose-300 text-rose-950 font-medium"
                    : "bg-slate-50 border-slate-200 text-slate-600"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={deleteOptions.teachers}
                    onChange={(e) => {
                      setDeleteOptions((p) => ({ ...p, teachers: e.target.checked }));
                      setDeleteErrorMsg(null);
                    }}
                    className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                  />
                  <div>
                    <span className="text-xs sm:text-sm font-bold block text-rose-900">
                      Hapus Akun Guru (Kecuali Akun Admin)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Menghapus akun guru ({teacherCount} guru). Akun Admin tetap aman.
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white border border-rose-200 text-rose-700">
                  {teacherCount} guru
                </span>
              </label>

              <label
                className={`flex items-center justify-between p-3 rounded-2xl border transition cursor-pointer ${
                  deleteOptions.classes
                    ? "bg-rose-50/80 border-rose-300 text-rose-950 font-medium"
                    : "bg-slate-50 border-slate-200 text-slate-600"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={deleteOptions.classes}
                    onChange={(e) => {
                      setDeleteOptions((p) => ({ ...p, classes: e.target.checked }));
                      setDeleteErrorMsg(null);
                    }}
                    className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                  />
                  <div>
                    <span className="text-xs sm:text-sm font-bold block text-rose-900">
                      Hapus Seluruh Master Kelas
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Menghapus daftar rombel kelas ({classCount} kelas)
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white border border-rose-200 text-rose-700">
                  {classCount} kelas
                </span>
              </label>
            </div>

            {/* Confirmation input box */}
            {hasAnyDeleteSelected && (
              <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Konfirmasi Keamanan: Ketik kata "HAPUS" di bawah:</span>
                  </div>
                  {deleteConfirmationText.trim().toUpperCase() === "HAPUS" && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Terkonfirmasi
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Ketik HAPUS untuk konfirmasi"
                  value={deleteConfirmationText}
                  onChange={(e) => {
                    setDeleteConfirmationText(e.target.value);
                    setDeleteErrorMsg(null);
                  }}
                  className={`w-full px-3.5 py-2.5 text-xs bg-white rounded-xl focus:outline-none focus:ring-2 font-bold tracking-wider transition ${
                    deleteConfirmationText.trim().toUpperCase() === "HAPUS"
                      ? "border-2 border-emerald-500 focus:ring-emerald-400 text-emerald-950"
                      : "border border-rose-300 focus:ring-rose-500 text-slate-900"
                  }`}
                />
              </div>
            )}

            {deleteErrorMsg && (
              <div className="p-3 bg-rose-100 border border-rose-300 rounded-xl text-rose-900 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
                <span>{deleteErrorMsg}</span>
              </div>
            )}

            {deleteSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{deleteSuccessMsg}</span>
              </div>
            )}
          </div>

          <div className="p-5 bg-rose-50/50 border-t border-rose-100 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-[11px] text-rose-800 font-medium">
              {hasAnyDeleteSelected
                ? `${getPendingDeleteCount()} item data terpilih`
                : "Pilih minimal 1 kotak opsi di atas"}
            </div>
            <button
              type="button"
              onClick={handleExecuteDelete}
              disabled={
                !hasAnyDeleteSelected ||
                deleteConfirmationText.trim().toUpperCase() !== "HAPUS" ||
                isDeleting
              }
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-2"
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Memproses Penghapusan...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Hapus Data Terpilih</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 3. SEKSI PULIHKAN DATA CADANGAN (RESTORE / IMPORT BACKUP) */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">3. Pulihkan Data dari Berkas Cadangan (Restore)</h3>
            <p className="text-xs text-slate-500">
              Unggah file backup .json dan pilih modul mana saja yang ingin dipulihkan ke Database Lokal (PostgreSQL)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* File Picker Box */}
          <div className="md:col-span-1 space-y-3">
            <label className="block text-xs font-bold text-slate-700">Pilih Berkas Backup (.json):</label>
            <div className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-2xl p-5 text-center bg-slate-50/50 hover:bg-teal-50/30 transition cursor-pointer relative">
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <FileJson className="w-8 h-8 text-teal-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-800 truncate">
                {restoreFile ? restoreFile.name : "Klik atau seret file JSON backup"}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Maksimal 25MB</p>
            </div>

            {restoreError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{restoreError}</span>
              </div>
            )}

            {restoreSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{restoreSuccessMsg}</span>
              </div>
            )}
          </div>

          {/* Module Selectors for Restore */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">
                Pilih Modul yang Ingin Dipulihkan ke Sistem:
              </label>
              {restorePayload && (
                <span className="text-[11px] text-teal-700 font-bold bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                  File Terdeteksi: {restorePayload.app || "Cadangan CBT"}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-teal-50/40 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={restoreOptions.profile}
                  onChange={(e) => setRestoreOptions((p) => ({ ...p, profile: e.target.checked }))}
                  className="w-4 h-4 text-teal-600 rounded"
                />
                <span>Profil Sekolah</span>
              </label>

              <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-teal-50/40 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={restoreOptions.classes}
                  onChange={(e) => setRestoreOptions((p) => ({ ...p, classes: e.target.checked }))}
                  className="w-4 h-4 text-teal-600 rounded"
                />
                <span>Master Kelas</span>
              </label>

              <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-teal-50/40 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={restoreOptions.students}
                  onChange={(e) => setRestoreOptions((p) => ({ ...p, students: e.target.checked }))}
                  className="w-4 h-4 text-teal-600 rounded"
                />
                <span>Akun Siswa</span>
              </label>

              <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-teal-50/40 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={restoreOptions.teachers}
                  onChange={(e) => setRestoreOptions((p) => ({ ...p, teachers: e.target.checked }))}
                  className="w-4 h-4 text-teal-600 rounded"
                />
                <span>Akun Guru</span>
              </label>

              <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-teal-50/40 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={restoreOptions.exams}
                  onChange={(e) => setRestoreOptions((p) => ({ ...p, exams: e.target.checked }))}
                  className="w-4 h-4 text-teal-600 rounded"
                />
                <span>Daftar Ujian</span>
              </label>

              <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-teal-50/40 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={restoreOptions.submissions}
                  onChange={(e) => setRestoreOptions((p) => ({ ...p, submissions: e.target.checked }))}
                  className="w-4 h-4 text-teal-600 rounded"
                />
                <span>Nilai & Jawaban</span>
              </label>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={!restorePayload || isRestoring}
                className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-2"
              >
                {isRestoring ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Memulihkan Database...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Mulai Restore Data Terpilih</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
