import React from "react";
import { useState, useRef } from "react";
import { User, Exam, ExamSubmission, ClassRoom, UserRole, SchoolProfile } from "../../types";
import { LiveExamTab } from "./LiveExamTab";
import { AdminSubmissionsRecapTab } from "./AdminSubmissionsRecapTab";
import { SchoolSettingsTab } from "./SchoolSettingsTab";
import { BulkUploadModal } from "./BulkUploadModal";
import { DataBackupManagementTab } from "./DataBackupManagementTab";
import { PrintExamCardsModal } from "./PrintExamCardsModal";
import { ImageUpload } from "../common/ImageUpload";
import {
  ShieldAlert,
  Users,
  GraduationCap,
  BookOpen,
  FileSpreadsheet,
  RotateCcw,
  CheckCircle2,
  AlertTriangle, Activity,
  Search,
  Plus,
  Lock,
  Trash2,
  UserPlus,
  Printer,
  Eye,
  EyeOff,
  KeyRound,
  Copy,
  Check,
  Edit2,
  X,
  FileText,
  Sparkles,
  School,
  QrCode,
  RefreshCw,
  Camera,
  Database,
  HardDrive,
} from "lucide-react";

interface AdminDashboardProps {
  currentUser: User;
  users: User[];
  classes: ClassRoom[];
  exams: Exam[];
  submissions: ExamSubmission[];
  onResetData: () => void;
  onAddClass: (newClass: ClassRoom) => void;
  onAddUser?: (newUser: User) => void;
  onUpdateUser?: (updatedUser: User) => void;
  onBulkAddUsers?: (newUsers: User[]) => Promise<void> | void;
  onDeleteUser?: (userId: string) => void;
  schoolProfile?: SchoolProfile;
  onSaveSchoolProfile?: (profile: SchoolProfile) => void;
  onResetSchoolProfile?: () => void;
  onRefreshData?: () => void;
}

export function AdminDashboard({
  currentUser,
  users,
  classes,
  exams,
  submissions,
  onResetData,
  onAddClass,
  onAddUser,
  onUpdateUser,
  onBulkAddUsers,
  onDeleteUser,
  schoolProfile,
  onSaveSchoolProfile,
  onResetSchoolProfile,
  onRefreshData,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "live" | "recap" | "violations" | "classes" | "users" | "settings" | "backup">("overview");
  const [recapSelectedExamId, setRecapSelectedExamId] = useState<string>("all");
  const [showAddClassModal, setShowAddClassModal] = useState<boolean>(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState<boolean>(false);
  const [newClassName, setNewClassName] = useState<string>("");
  const [newGrade, setNewGrade] = useState<string>("12");

  // User management state
  const [showAddUserModal, setShowAddUserModal] = useState<boolean>(false);
  const [newUserName, setNewUserName] = useState<string>("");
  const [newUserEmail, setNewUserEmail] = useState<string>("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("siswa");
  const [newUserClassId, setNewUserClassId] = useState<string>(classes[0]?.id || "");
  const [newUserNipNisn, setNewUserNipNisn] = useState<string>("");
  const [newUserPassword, setNewUserPassword] = useState<string>("password123");
  const [newUserAvatar, setNewUserAvatar] = useState<string>("");
  const [showNewUserPassword, setShowNewUserPassword] = useState<boolean>(false);
  const [userRoleFilter, setUserRoleFilter] = useState<string>("all");
  const [userSearchTerm, setUserSearchTerm] = useState<string>("");

  // Admin exclusive password visibility state (Melihat Password)
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [showAllPasswords, setShowAllPasswords] = useState<boolean>(false);
  const [copiedUserId, setCopiedUserId] = useState<string | null>(null);

  // Admin exclusive user editing & password change state (Mengganti Password)
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState<string>("");
  const [editEmail, setEditEmail] = useState<string>("");
  const [editRole, setEditRole] = useState<UserRole>("siswa");
  const [editClassId, setEditClassId] = useState<string>("");
  const [editNipNisn, setEditNipNisn] = useState<string>("");
  const [editPassword, setEditPassword] = useState<string>("");
  const [editAvatar, setEditAvatar] = useState<string>("");
  const [showEditPassword, setShowEditPassword] = useState<boolean>(false);

  // Admin exclusive deletion confirmation state (Menghapus Akun)
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Admin exclusive print credential & exam cards state (Cetak Kartu & Kredensial)
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  const generateRandomPassword = (role: UserRole) => {
    const prefix = role === "siswa" ? "sw" : role === "guru" ? "gr" : "adm";
    const num = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}${num}`;
  };

  const handleCopyPassword = (userId: string, pass: string) => {
    navigator.clipboard.writeText(pass);
    setCopiedUserId(userId);
    setTimeout(() => setCopiedUserId(null), 2000);
  };

  const handleOpenEditUser = (u: User) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditRole(u.role);
    setEditClassId(u.classId || classes[0]?.id || "");
    setEditNipNisn(u.nisn || u.nip || "");
    setEditPassword(u.password || "password123");
    setEditAvatar(u.avatar || "");
    setShowEditPassword(false);
  };

  const handleSaveEditUser = () => {
    if (!editingUser) return;
    if (!editName.trim() || !editEmail.trim() || !editPassword.trim()) {
      alert("Nama Lengkap, Email, dan Kata Sandi wajib diisi!");
      return;
    }
    const selectedClass = classes.find((c) => c.id === editClassId);
    const updated: User = {
      ...editingUser,
      name: editName.trim(),
      email: editEmail.trim(),
      role: editRole,
      password: editPassword.trim(),
    };

    if (editAvatar) {
      updated.avatar = editAvatar;
    } else {
      delete updated.avatar;
    }

    if (editRole === "siswa") {
      updated.classId = editClassId;
      updated.className = selectedClass?.name || editClassId;
      if (editNipNisn.trim()) {
        updated.nisn = editNipNisn.trim();
      } else {
        delete updated.nisn;
      }
      delete updated.nip;
    } else {
      delete updated.classId;
      delete updated.className;
      delete updated.nisn;
      if (editNipNisn.trim()) {
        updated.nip = editNipNisn.trim();
      } else {
        delete updated.nip;
      }
    }

    if (onUpdateUser) {
      onUpdateUser(updated);
    } else if (onAddUser) {
      onAddUser(updated);
    }
    setEditingUser(null);
  };

  // Violation logs flattened
  const allViolations = submissions.flatMap((s) =>
    s.violationLogs.map((log) => ({
      ...log,
      studentName: s.studentName,
      className: s.studentClassName,
      examTitle: s.examTitle,
      submissionId: s.id,
    }))
  );

  const totalStudents = users.filter((u) => u.role === "siswa").length;
  const totalTeachers = users.filter((u) => u.role === "guru").length;
  const avgSchoolScore =
    submissions.length > 0
      ? Math.round(submissions.reduce((acc, c) => acc + c.totalScore, 0) / submissions.length)
      : 0;

  const handleCreateClass = () => {
    if (!newClassName.trim()) return;
    const newClass: ClassRoom = {
      id: newClassName.trim().replace(/\s+/g, "-").toUpperCase(),
      name: newClassName.trim(),
      grade: newGrade,
      academicYear: "2025/2026",
      studentCount: 30,
    };
    onAddClass(newClass);
    setNewClassName("");
    setShowAddClassModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Admin Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-purple-800/40">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold uppercase tracking-wider mb-3 border border-purple-500/30">
              <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
              Administrator Sistem Utama
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Pusat Kendali Ujian Sekolah
            </h1>
            <p className="text-purple-200 text-sm mt-1 max-w-xl">
              Pantau seluruh aktivitas pelaksanaan ujian essay, audit integritas anti-kecurangan, dan manajemen master data kelas & pengguna.
            </p>
          </div>

          <button
            type="button"
            onClick={onResetData}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold rounded-xl border border-slate-700 transition flex items-center gap-2"
            title="Muat ulang seluruh data contoh awal"
          >
            <RotateCcw className="w-4 h-4 text-purple-400" />
            Reset Data Contoh
          </button>
        </div>

        {/* Global Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-purple-800/40">
          <div className="bg-slate-950/60 rounded-2xl p-4 border border-purple-800/30">
            <span className="text-xs text-purple-300 font-semibold block">Total Ujian Terjadwal</span>
            <span className="text-2xl sm:text-3xl font-black text-white mt-1 block">{exams.length}</span>
          </div>
          <div className="bg-slate-950/60 rounded-2xl p-4 border border-purple-800/30">
            <span className="text-xs text-purple-300 font-semibold block">Siswa Mengerjakan</span>
            <span className="text-2xl sm:text-3xl font-black text-white mt-1 block">{submissions.length}</span>
          </div>
          <div className="bg-slate-950/60 rounded-2xl p-4 border border-purple-800/30">
            <span className="text-xs text-purple-300 font-semibold block">Rata-rata Nilai Sekolah</span>
            <span className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1 block">
              {submissions.length > 0 ? avgSchoolScore : "-"}
            </span>
          </div>
          <div className="bg-slate-950/60 rounded-2xl p-4 border border-purple-800/30">
            <span className="text-xs text-purple-300 font-semibold block">Pelanggaran Terdeteksi</span>
            <span className="text-2xl sm:text-3xl font-black text-rose-400 mt-1 block">
              {allViolations.length}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition shrink-0 ${
            activeTab === "overview"
              ? "bg-purple-900 text-white shadow"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          Ringkasan Ujian
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("live")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 shrink-0 ${
            activeTab === "live"
              ? "bg-purple-900 text-white shadow"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Activity className="w-4 h-4" />
          Live Ujian
        </button>
        <button
          type="button"
          onClick={() => {
            setRecapSelectedExamId("all");
            setActiveTab("recap");
          }}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 shrink-0 ${
            activeTab === "recap"
              ? "bg-purple-900 text-white shadow"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <FileText className="w-4 h-4 text-emerald-400" />
          <span>Rekap Jawaban & Nilai ({submissions.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("violations")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 shrink-0 ${
            activeTab === "violations"
              ? "bg-purple-900 text-white shadow"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          Audit Pelanggaran ({allViolations.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("classes")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition shrink-0 ${
            activeTab === "classes"
              ? "bg-purple-900 text-white shadow"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          Manajemen Kelas ({classes.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition shrink-0 ${
            activeTab === "users"
              ? "bg-purple-900 text-white shadow"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          Daftar Pengguna ({users.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 shrink-0 ${
            activeTab === "settings"
              ? "bg-purple-900 text-white shadow"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <School className="w-4 h-4 text-purple-400" />
          <span>Identitas & Logo Sekolah</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("backup")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 shrink-0 ${
            activeTab === "backup"
              ? "bg-purple-900 text-white shadow"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Database className="w-4 h-4 text-indigo-400" />
          <span>Backup & Hapus Data</span>
        </button>
      </div>

      {/* Tab: Backup & Purge */}
      {activeTab === "backup" && (
        <DataBackupManagementTab
          schoolProfile={schoolProfile}
          users={users}
          classes={classes}
          exams={exams}
          submissions={submissions}
          onRefreshData={onRefreshData}
        />
      )}

      {/* Tab: Live */}
      {activeTab === "live" && (
        <LiveExamTab exams={exams} classes={classes} submissions={submissions} users={users} />
      )}

      {/* Tab: Rekap Jawaban & Nilai Siswa */}
      {activeTab === "recap" && (
        <AdminSubmissionsRecapTab
          exams={exams}
          submissions={submissions}
          users={users}
          classes={classes}
          initialSelectedExamId={recapSelectedExamId}
        />
      )}

      {/* Tab: Settings */}
      {activeTab === "settings" && schoolProfile && onSaveSchoolProfile && (
        <SchoolSettingsTab 
          initialProfile={schoolProfile} 
          onSave={onSaveSchoolProfile} 
          onResetDefault={onResetSchoolProfile || (() => {})} 
        />
      )}
        {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                Daftar Seluruh Ujian Sekolah
              </h3>
              <span className="text-xs text-slate-500">{exams.length} Ujian Terdaftar</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 uppercase font-bold text-slate-500">
                  <tr>
                    <th className="p-3.5">Mata Pelajaran</th>
                    <th className="p-3.5">Judul Ujian</th>
                    <th className="p-3.5">Kelas Target</th>
                    <th className="p-3.5">Guru Pengampu</th>
                    <th className="p-3.5">Jadwal</th>
                    <th className="p-3.5 text-center">Soal</th>
                    <th className="p-3.5 text-center">Jawaban Siswa</th>
                    <th className="p-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {exams.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/70">
                      <td className="p-3.5 font-bold text-slate-900">{e.subject}</td>
                      <td className="p-3.5 font-medium">{e.title}</td>
                      <td className="p-3.5">{e.targetClassName}</td>
                      <td className="p-3.5">{e.teacherName}</td>
                      <td className="p-3.5">
                        {e.examDate} ({e.startTime} - {e.endTime})
                      </td>
                      <td className="p-3.5 text-center font-bold">{e.questions.length}</td>
                      <td className="p-3.5 text-center">
                        {(() => {
                          const subCount = submissions.filter((s) => s.examId === e.id).length;
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                setRecapSelectedExamId(e.id);
                                setActiveTab("recap");
                              }}
                              className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 text-[11px] font-bold rounded-lg border border-purple-200 shadow-xs inline-flex items-center gap-1 transition"
                              title="Buka rekap seluruh jawaban siswa untuk ujian ini"
                            >
                              <FileText className="w-3 h-3" />
                              {subCount} Lembar
                            </button>
                          );
                        })()}
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            e.status === "published"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {e.status === "published" ? "TERPUBLIKASI" : "DRAF"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Violations */}
      {activeTab === "violations" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              Log Rekaman Pelanggaran Layar & Integritas Ujian
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Setiap aktivitas siswa meninggalkan layar penuh, berpindah tab, atau membuka jendela lain terekam secara transparan di sini.
            </p>
          </div>

          {allViolations.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              Belum ada pelanggaran integritas yang terdeteksi.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 uppercase font-bold text-slate-500">
                  <tr>
                    <th className="p-3.5">Waktu Kejadian</th>
                    <th className="p-3.5">Nama Siswa</th>
                    <th className="p-3.5">Kelas</th>
                    <th className="p-3.5">Ujian Terkait</th>
                    <th className="p-3.5">Deskripsi Pelanggaran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allViolations.map((v, i) => (
                    <tr key={i} className="hover:bg-rose-50/50">
                      <td className="p-3.5 font-mono text-slate-500">{v.timestamp}</td>
                      <td className="p-3.5 font-bold text-slate-900">{v.studentName}</td>
                      <td className="p-3.5">{v.className}</td>
                      <td className="p-3.5">{v.examTitle}</td>
                      <td className="p-3.5 text-rose-700 font-semibold">{v.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Classes */}
      {activeTab === "classes" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-slate-900">Daftar Kelas Sekolah</h3>
            <button
              type="button"
              onClick={() => setShowAddClassModal(true)}
              className="px-3.5 py-2 bg-purple-900 hover:bg-purple-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Kelas
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {classes.map((c) => (
              <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold bg-purple-50 text-purple-800 px-2 py-0.5 rounded border border-purple-200">
                    Tingkat {c.grade}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">{c.academicYear}</span>
                </div>
                <h4 className="text-base font-black text-slate-900">{c.name}</h4>
                <p className="text-xs text-slate-500">Estimasi Siswa: {c.studentCount} Siswa</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Users */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">Manajemen Pengguna & Kredensial</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                  Akses Khusus Admin
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Hanya Administrator yang berhak melihat kata sandi, mengganti sandi, menghapus akun, dan mencetak kartu ujian peserta.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setShowBulkUploadModal(true)}
                className="px-3.5 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition"
                title="Upload massal pengguna dari file spreadsheet CSV atau salin-tempel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Upload Massal (CSV)</span>
              </button>
              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition"
                title="Cetak Kartu Ujian & Daftar Akun untuk Dibagikan ke Siswa"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Kartu & Akun</span>
              </button>

              {onAddUser && (
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(true)}
                  className="px-3.5 py-2 bg-purple-900 hover:bg-purple-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Tambah Pengguna</span>
                </button>
              )}
            </div>
          </div>

          {/* Filters, Search & Global Password Visibility Toggle */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 mr-1">Filter:</span>
              {["all", "siswa", "guru", "admin"].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setUserRoleFilter(r)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition ${
                    userRoleFilter === r
                      ? "bg-purple-100 text-purple-800 border border-purple-300"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {r === "all" ? "Semua" : r}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAllPasswords(!showAllPasswords)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border ${
                  showAllPasswords
                    ? "bg-amber-50 text-amber-900 border-amber-300 shadow-sm"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
                title="Buka / Tutup Tampilan Semua Kata Sandi Pengguna"
              >
                {showAllPasswords ? (
                  <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                ) : (
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span>{showAllPasswords ? "Sembunyikan Sandi" : "Tampilkan Semua Sandi"}</span>
              </button>

              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  placeholder="Cari nama / NISN / NIP..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-purple-600"
                />
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 uppercase font-bold text-slate-500">
                  <tr>
                    <th className="p-3.5">Nama & Identitas</th>
                    <th className="p-3.5">Email (Username)</th>
                    <th className="p-3.5">Peran</th>
                    <th className="p-3.5">Kelas / NISN / NIP</th>
                    <th className="p-3.5">
                      <div className="flex items-center gap-1 text-purple-900 font-bold">
                        <Lock className="w-3 h-3" />
                        <span>Kata Sandi (Admin)</span>
                      </div>
                    </th>
                    <th className="p-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users
                    .filter((u) => {
                      if (userRoleFilter !== "all" && u.role !== userRoleFilter) return false;
                      if (!userSearchTerm.trim()) return true;
                      const q = userSearchTerm.toLowerCase();
                      return (
                        u.name.toLowerCase().includes(q) ||
                        u.email.toLowerCase().includes(q) ||
                        (u.nisn && u.nisn.toLowerCase().includes(q)) ||
                        (u.nip && u.nip.toLowerCase().includes(q))
                      );
                    })
                    .map((u) => {
                      const isRevealed = showAllPasswords || visiblePasswords[u.id];
                      const userPass = u.password || "password123";

                      return (
                        <tr key={u.id} className="hover:bg-slate-50/70 transition">
                          <td className="p-3.5 font-bold text-slate-900">
                            <div className="flex items-center gap-3">
                              {u.avatar ? (
                                <img
                                  src={u.avatar}
                                  alt={u.name}
                                  className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0 shadow-xs"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div
                                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs ${
                                    u.role === "admin"
                                      ? "bg-purple-100 text-purple-700"
                                      : u.role === "guru"
                                      ? "bg-teal-100 text-teal-700"
                                      : "bg-indigo-100 text-indigo-700"
                                  }`}
                                >
                                  {u.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span>{u.name}</span>
                                  {u.id === currentUser.id && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                                      Anda
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400 font-normal block font-mono">
                                  ID: {u.id}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5 text-slate-600 font-mono text-[11px]">{u.email}</td>
                          <td className="p-3.5">
                            <span
                              className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                                u.role === "admin"
                                  ? "bg-purple-100 text-purple-800 border border-purple-200"
                                  : u.role === "guru"
                                  ? "bg-teal-100 text-teal-800 border border-teal-200"
                                  : "bg-indigo-100 text-indigo-800 border border-indigo-200"
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-600">
                            <div className="font-semibold text-slate-800">{u.className || "-"}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {u.nisn ? `NISN: ${u.nisn}` : u.nip ? `NIP: ${u.nip}` : ""}
                            </div>
                          </td>
                          {/* Kata Sandi Column */}
                          <td className="p-3.5">
                            <div className="inline-flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                              <span
                                className={`font-mono text-[11px] select-all ${
                                  isRevealed ? "font-bold text-slate-900" : "text-slate-400 tracking-widest"
                                }`}
                              >
                                {isRevealed ? userPass : "••••••••"}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setVisiblePasswords((prev) => ({
                                    ...prev,
                                    [u.id]: !prev[u.id],
                                  }))
                                }
                                className="p-1 text-slate-400 hover:text-slate-700 rounded transition"
                                title={isRevealed ? "Sembunyikan Sandi" : "Lihat Sandi Asli"}
                              >
                                {isRevealed ? (
                                  <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyPassword(u.id, userPass)}
                                className="p-1 text-slate-400 hover:text-indigo-600 rounded transition"
                                title="Salin Kata Sandi"
                              >
                                {copiedUserId === u.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                          {/* Aksi Column */}
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditUser(u)}
                                className="p-1.5 text-slate-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition"
                                title="Edit Akun & Ganti Kata Sandi"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {onDeleteUser && u.id !== currentUser.id && (
                                <button
                                  type="button"
                                  onClick={() => setUserToDelete(u)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                  title="Hapus Akun Pengguna"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Pengguna & Ganti Kata Sandi */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Ubah Data & Kata Sandi</h3>
                  <p className="text-[11px] text-slate-500">
                    Perbarui informasi akun dan tentukan kata sandi baru.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-600 font-semibold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block mb-1">
                  Email (Username Login)
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase block mb-1">
                    Peran / Role
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none"
                  >
                    <option value="siswa">Siswa</option>
                    <option value="guru">Guru</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase block mb-1">
                    {editRole === "siswa" ? "NISN Siswa" : "NIP Pegawai"}
                  </label>
                  <input
                    type="text"
                    value={editNipNisn}
                    onChange={(e) => setEditNipNisn(e.target.value)}
                    placeholder={editRole === "siswa" ? "0054892110" : "1985..."}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none"
                  />
                </div>
              </div>

              {editRole === "siswa" && (
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase block mb-1">
                    Rombongan Belajar (Kelas)
                  </label>
                  <select
                    value={editClassId}
                    onChange={(e) => setEditClassId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Foto Profil / Pas Foto Upload */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <ImageUpload
                  label="Foto Profil / Pas Foto (Perangkat)"
                  value={editAvatar}
                  onChange={setEditAvatar}
                  onClear={() => setEditAvatar("")}
                  helperText="Upload foto profil siswa, guru, atau admin dari perangkat (JPG/PNG)"
                  previewSize="sm"
                />
              </div>

              {/* Password change section */}
              <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-purple-900 uppercase flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-purple-700" />
                    Kata Sandi Baru
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditPassword(generateRandomPassword(editRole))}
                      className="text-[10px] font-bold text-purple-700 hover:text-purple-900 hover:underline flex items-center gap-1"
                      title="Buat kata sandi acak baru"
                    >
                      <Sparkles className="w-3 h-3" />
                      Acak Sandi
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => setEditPassword("password123")}
                      className="text-[10px] font-bold text-slate-500 hover:text-slate-700 hover:underline"
                    >
                      Reset Default
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type={showEditPassword ? "text" : "password"}
                    required
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Masukkan kata sandi baru..."
                    className="w-full px-3 py-2 pr-9 bg-white border border-purple-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-600 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  Perubahan kata sandi langsung berlaku. Pastikan untuk mencetak atau memberitahukan sandi baru kepada pengguna.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEditUser}
                className="px-4 py-2 text-xs font-bold text-white bg-purple-900 hover:bg-purple-800 rounded-xl shadow"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Konfirmasi Hapus Pengguna */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Hapus Akun Pengguna?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Apakah Anda yakin ingin menghapus akun{" "}
                <strong className="text-slate-900">{userToDelete.name}</strong> ({userToDelete.role})?
              </p>
              <p className="text-[11px] text-rose-600 bg-rose-50 p-2 rounded-lg mt-3">
                Tindakan ini permanen. Pengguna ini tidak akan dapat login lagi ke sistem ujian.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteUser) {
                    onDeleteUser(userToDelete.id);
                  }
                  setUserToDelete(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow"
              >
                Ya, Hapus Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cetak Kartu Ujian & Kredensial Pengguna */}
      <PrintExamCardsModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        users={users}
        classes={classes}
        schoolProfile={schoolProfile}
        currentUser={currentUser}
      />

      {/* Modal Add User */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Tambah Akun Pengguna Baru</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Misal: Rina Wardani, S.Pd / Bima Pratama"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="pengguna@sekolah.sch.id"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase block mb-1">
                    Peran / Role
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none"
                  >
                    <option value="siswa">Siswa</option>
                    <option value="guru">Guru</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-600 uppercase">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setNewUserPassword(generateRandomPassword(newUserRole))}
                      className="text-[10px] font-bold text-purple-700 hover:underline flex items-center gap-0.5"
                    >
                      <Sparkles className="w-2.5 h-2.5" />
                      Acak
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showNewUserPassword ? "text" : "password"}
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="password123"
                      className="w-full px-3 py-2 pr-8 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showNewUserPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {newUserRole === "siswa" && (
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase block mb-1">
                    Rombongan Belajar (Kelas)
                  </label>
                  <select
                    value={newUserClassId}
                    onChange={(e) => setNewUserClassId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block mb-1">
                  {newUserRole === "siswa" ? "NISN Siswa" : "NIP Pegawai (Opsional)"}
                </label>
                <input
                  type="text"
                  value={newUserNipNisn}
                  onChange={(e) => setNewUserNipNisn(e.target.value)}
                  placeholder={newUserRole === "siswa" ? "0054892119" : "198701012012011001"}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              {/* Upload Foto Profil Siswa / Guru / Admin dari perangkat */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <ImageUpload
                  label="Foto Profil / Pas Foto Pengguna"
                  value={newUserAvatar}
                  onChange={setNewUserAvatar}
                  onClear={() => setNewUserAvatar("")}
                  helperText="Upload foto dari perangkat (JPG, PNG Maks 2MB)"
                  previewSize="sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowAddUserModal(false);
                  setNewUserAvatar("");
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!newUserName.trim() || !newUserEmail.trim()) {
                    alert("Nama dan Email wajib diisi!");
                    return;
                  }
                  const selectedClass = classes.find((c) => c.id === newUserClassId);
                  const newUser: User = {
                    id: `user-${Date.now()}`,
                    name: newUserName.trim(),
                    email: newUserEmail.trim(),
                    role: newUserRole,
                    password: newUserPassword || "password123",
                    avatar: newUserAvatar || undefined,
                    ...(newUserRole === "siswa" && {
                      classId: newUserClassId,
                      className: selectedClass?.name || newUserClassId,
                      nisn: newUserNipNisn.trim() || undefined,
                    }),
                    ...(newUserRole === "guru" && {
                      nip: newUserNipNisn.trim() || undefined,
                    }),
                    ...(newUserRole === "admin" && {
                      nip: newUserNipNisn.trim() || undefined,
                    }),
                  };
                  if (onAddUser) onAddUser(newUser);
                  setNewUserName("");
                  setNewUserEmail("");
                  setNewUserNipNisn("");
                  setNewUserAvatar("");
                  setShowAddUserModal(false);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-purple-900 hover:bg-purple-800 rounded-xl shadow"
              >
                Simpan Pengguna
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add Class */}
      {showAddClassModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Tambah Kelas Baru</h3>
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase block mb-1">
                Nama Kelas
              </label>
              <input
                type="text"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="Misal: Kelas XII IPS 2"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase block mb-1">
                Tingkat
              </label>
              <select
                value={newGrade}
                onChange={(e) => setNewGrade(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none"
              >
                <option value="10">Kelas 10</option>
                <option value="11">Kelas 11</option>
                <option value="12">Kelas 12</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddClassModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCreateClass}
                className="px-4 py-2 text-xs font-bold text-white bg-purple-900 hover:bg-purple-800 rounded-xl shadow"
              >
                Simpan Kelas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk User Upload Modal (CSV / Excel) */}
      <BulkUploadModal
        isOpen={showBulkUploadModal}
        onClose={() => setShowBulkUploadModal(false)}
        classes={classes}
        onImportUsers={async (importedUsers) => {
          if (onBulkAddUsers) {
            await onBulkAddUsers(importedUsers);
          } else if (onAddUser) {
            for (const u of importedUsers) {
              await onAddUser(u);
            }
          }
        }}
      />
    </div>
  );
}
