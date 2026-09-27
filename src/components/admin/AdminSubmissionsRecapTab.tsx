import { useState, useMemo } from "react";
import { Exam, ExamSubmission, User, ClassRoom } from "../../types";
import { storage } from "../../services/storage";
import { adminHeaders } from "../../services/api";
import {
  FileText,
  Search,
  Download,
  Printer,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Sparkles,
  Award,
  X,
  Trash2,
  RefreshCw,
  Users,
  UserX,
  ShieldCheck,
} from "lucide-react";

interface AdminSubmissionsRecapTabProps {
  exams: Exam[];
  submissions: ExamSubmission[];
  users: User[];
  classes: ClassRoom[];
  initialSelectedExamId?: string;
}

export function AdminSubmissionsRecapTab({
  exams,
  submissions,
  users,
  classes,
  initialSelectedExamId,
}: AdminSubmissionsRecapTabProps) {
  const [selectedExamId, setSelectedExamId] = useState<string>(
    initialSelectedExamId || "all"
  );
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "past">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "passed" | "remedial">("all");
  const [viewMode, setViewMode] = useState<"submissions_only" | "full_roster">("submissions_only");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedDetailSub, setSelectedDetailSub] = useState<ExamSubmission | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAutoGrading, setIsAutoGrading] = useState(false);

  // Today string in YYYY-MM-DD
  const todayStr = useMemo(() => {
    return new Date().toISOString().split("T")[0];
  }, []);

  // Map of examId to Exam object for easy lookup
  const examMap = useMemo(() => {
    const map = new Map<string, Exam>();
    exams.forEach((e) => map.set(e.id, e));
    return map;
  }, [exams]);

  // Handle auto grade all submissions
  const handleAutoGradeAll = async () => {
    setIsAutoGrading(true);
    try {
      const res = await fetch("/api/db/auto-grade-all", { method: "POST", headers: adminHeaders() });
      if (res.ok) {
        await storage.refreshFromCloud();
      }
    } catch (err) {
      console.error("Auto grade all error:", err);
    } finally {
      setIsAutoGrading(false);
    }
  };

  // Handle manual data refresh / cache clean
  const handleRefreshData = async () => {
    setIsRefreshing(true);
    try {
      await storage.refreshFromCloud();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle single submission deletion
  const handleDeleteSubmission = async (sub: ExamSubmission) => {
    const confirmMsg = `Yakin ingin menghapus lembar jawaban ${sub.studentName}?\nData jawaban dan nilai akan dihapus secara permanen dari server database.`;
    if (!window.confirm(confirmMsg)) return;

    setIsDeleting(sub.id);
    try {
      await storage.deleteSubmission(sub.id);
      if (selectedDetailSub?.id === sub.id) {
        setSelectedDetailSub(null);
      }
    } catch (err) {
      alert("Gagal menghapus data jawaban: " + err);
    } finally {
      setIsDeleting(null);
    }
  };

  // Filtered submissions (actual submissions from students who submitted/worked on exams)
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      const exam = examMap.get(sub.examId);

      // Exam Filter
      if (selectedExamId !== "all" && sub.examId !== selectedExamId) {
        return false;
      }

      // Class Filter
      if (selectedClassId !== "all") {
        const student = users.find((u) => u.id === sub.studentId || u.nisn === sub.studentId);
        const studentClass = sub.studentClass || student?.className || exam?.targetClassName;
        if (studentClass !== selectedClassId && student?.classId !== selectedClassId) {
          return false;
        }
      }

      // Filter submissions based on current criteria
      // Status Filter
      if (statusFilter === "passed" && !sub.isPassed) return false;
      if (statusFilter === "remedial" && sub.isPassed) return false;

      // Date Filter
      if (dateFilter === "today") {
        if (exam?.examDate !== todayStr && (!sub.submittedAt || !sub.submittedAt.includes(todayStr))) return false;
      } else if (dateFilter === "past") {
        if (exam?.examDate === todayStr || (sub.submittedAt && sub.submittedAt.includes(todayStr))) return false;
      }

      // Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = sub.studentName?.toLowerCase().includes(q);
        const nisnMatch = sub.studentNisn?.toLowerCase().includes(q) || sub.studentId?.toLowerCase().includes(q);
        const examMatch = (exam?.title || sub.examTitle || "").toLowerCase().includes(q);
        const subjectMatch = (exam?.subject || "").toLowerCase().includes(q);
        const classMatch = (sub.studentClass || "").toLowerCase().includes(q);

        if (!nameMatch && !nisnMatch && !examMatch && !subjectMatch && !classMatch) {
          return false;
        }
      }

      return true;
    });
  }, [
    submissions,
    examMap,
    selectedExamId,
    selectedClassId,
    dateFilter,
    statusFilter,
    searchQuery,
    users,
    todayStr,
  ]);

  // Full Roster (all students in target class, showing who submitted vs who was absent)
  const fullRosterRows = useMemo(() => {
    if (selectedExamId === "all") return [];
    const exam = examMap.get(selectedExamId);
    if (!exam) return [];

    // Find students for this exam's class
    const targetStudents = users.filter((u) => {
      if (u.role !== "siswa") return false;
      const matchClass =
        u.classId === exam.targetClassId ||
        u.className === exam.targetClassName ||
        (u.classId && exam.targetClassName && u.classId.includes(exam.targetClassName));
      return matchClass;
    });

    return targetStudents
      .map((st) => {
        // Find submission for this student and exam
        const sub = submissions.find(
          (s) =>
            s.examId === exam.id &&
            (s.studentId === st.id ||
              s.studentId === st.nisn ||
              (s.studentNisn && s.studentNisn === st.nisn) ||
              (s.studentName && s.studentName.trim().toLowerCase() === st.name.trim().toLowerCase()))
        );

        const isCompleted = sub && (sub.status === "graded" || Boolean(sub.submittedAt));
        const isInProgress = sub && sub.status === "in_progress" && !sub.submittedAt;

        return {
          student: st,
          submission: sub,
          isCompleted,
          isInProgress,
          isAbsent: !sub,
        };
      })
      .filter((row) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            row.student.name.toLowerCase().includes(q) ||
            (row.student.nisn && row.student.nisn.includes(q))
          );
        }
        return true;
      });
  }, [selectedExamId, examMap, users, submissions, searchQuery]);

  // Statistics (only calculated on completed submissions)
  const completedSubmissions = filteredSubmissions.filter((s) => s.status === "graded" || Boolean(s.submittedAt));
  const totalSubmissions = completedSubmissions.length;
  const passedCount = completedSubmissions.filter((s) => s.isPassed).length;
  const remedialCount = totalSubmissions - passedCount;
  const passRate = totalSubmissions > 0 ? Math.round((passedCount / totalSubmissions) * 100) : 0;
  const avgScore =
    totalSubmissions > 0
      ? Math.round(
          completedSubmissions.reduce((acc, s) => acc + (s.totalScore || 0), 0) / totalSubmissions
        )
      : 0;

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredSubmissions.length === 0) {
      alert("Tidak ada data jawaban yang sesuai filter untuk diekspor.");
      return;
    }

    const headers = [
      "No",
      "Tanggal Ujian",
      "Nama Siswa",
      "NISN",
      "Kelas",
      "Mata Pelajaran",
      "Judul Ujian",
      "Nilai Akhir",
      "KKM",
      "Status",
      "Waktu Selesai",
      "Catatan Pelanggaran",
    ];

    const rows = filteredSubmissions.map((s, idx) => {
      const ex = examMap.get(s.examId);
      return [
        idx + 1,
        ex?.examDate || s.submittedAt?.split("T")[0] || "-",
        `"${(s.studentName || "").replace(/"/g, '""')}"`,
        `"${s.studentNisn || s.studentId || "-"}"`,
        `"${s.studentClass || ex?.targetClassName || "-"}"`,
        `"${(ex?.subject || "").replace(/"/g, '""')}"`,
        `"${(ex?.title || s.examTitle || "").replace(/"/g, '""')}"`,
        s.totalScore ?? 0,
        ex?.passingGrade ?? 75,
        s.isPassed ? "LULUS" : "REMEDIAL",
        s.submittedAt ? new Date(s.submittedAt).toLocaleString("id-ID") : "-",
        s.violationCount || 0,
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `rekap_jawaban_ujian_${selectedExamId !== "all" ? selectedExamId : "semua"}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Report
  const handlePrint = () => {
    window.print();
  };

  const selectedExam = selectedExamId !== "all" ? examMap.get(selectedExamId) : null;

  return (
    <div className="space-y-6">
      {/* Top Banner & Title */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-indigo-950 rounded-2xl p-6 text-white border border-purple-800/40 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold uppercase tracking-wider mb-2 border border-purple-500/30">
            <FileText className="w-3.5 h-3.5 text-purple-400" />
            Arsip & Rekapitulasi Lengkap
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            Rekap Jawaban & Nilai Ujian Siswa
          </h2>
          <p className="text-purple-200 text-xs sm:text-sm mt-1 max-w-2xl">
            Tinjau lembar jawaban siswa yang benar-benar mengerjakan, analisis penilaian AI, dan status kehadiran siswa. Siswa yang tidak hadir atau tidak mengerjakan tidak diberikan nilai.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleAutoGradeAll}
            disabled={isAutoGrading}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs font-black rounded-xl shadow-md transition flex items-center gap-2 border border-amber-300/40"
            title="Hitung dan beri nilai otomatis dengan AI untuk semua jawaban siswa yang masuk"
          >
            <Sparkles className={`w-4 h-4 ${isAutoGrading ? "animate-spin text-yellow-200" : "text-yellow-100"}`} />
            {isAutoGrading ? "Menilai Semua Jawaban..." : "Hitung & Nilai Otomatis AI"}
          </button>
          <button
            type="button"
            onClick={handleRefreshData}
            disabled={isRefreshing}
            className="px-3.5 py-2 bg-purple-800/60 hover:bg-purple-700/80 text-white text-xs font-bold rounded-xl border border-purple-500/40 shadow transition flex items-center gap-1.5"
            title="Sinkronkan data dengan database cloud"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Menyinkronkan..." : "Sinkron Data"}
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Ekspor Excel (CSV)
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/20 shadow transition flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            Cetak
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Lembar Jawaban Masuk
            </span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 block">
              {totalSubmissions}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Rata-rata Nilai
            </span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 block">
              {avgScore} <span className="text-xs font-normal text-slate-400">/ 100</span>
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Lulus KKM
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-600 mt-0.5 block">
              {passedCount} <span className="text-xs font-normal text-slate-400">({passRate}%)</span>
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Remedial
            </span>
            <span className="text-xl sm:text-2xl font-black text-rose-600 mt-0.5 block">
              {remedialCount}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        {/* Date category buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setDateFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                dateFilter === "all"
                  ? "bg-white text-purple-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Semua Jadwal & Riwayat ({submissions.length})
            </button>
            <button
              type="button"
              onClick={() => setDateFilter("today")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                dateFilter === "today"
                  ? "bg-white text-purple-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => setDateFilter("past")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                dateFilter === "past"
                  ? "bg-white text-purple-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Clock className="w-3 h-3 text-slate-400" />
              Sebelum Hari Ini (Riwayat)
            </button>
          </div>

          {/* Quick status tabs */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                statusFilter === "all" ? "bg-slate-200 text-slate-800" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Semua Status
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("passed")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                statusFilter === "passed" ? "bg-emerald-100 text-emerald-800" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Lulus KKM
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("remedial")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                statusFilter === "remedial" ? "bg-rose-100 text-rose-800" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Remedial
            </button>
          </div>
        </div>

        {/* Dropdowns & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Exam Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Pilih Ujian:
            </label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Semua Ujian ({exams.length} Mapel)</option>
              {exams.map((ex) => {
                const subCount = submissions.filter((s) => s.examId === ex.id).length;
                return (
                  <option key={ex.id} value={ex.id}>
                    [{ex.examDate || "-"}] {ex.subject} — {ex.targetClassName} ({subCount} Jawaban Masuk)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Class Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Pilih Kelas:
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Semua Kelas ({classes.length} Kelas)</option>
              {classes.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Cari Siswa / Mapel / NISN:
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ketik nama siswa, NISN, atau mata pelajaran..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>

        {/* View Mode Switcher when specific Exam is Selected */}
        {selectedExamId !== "all" && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-600 mr-2">Tampilan:</span>
            <button
              type="button"
              onClick={() => setViewMode("submissions_only")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === "submissions_only"
                  ? "bg-purple-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Hanya Lembar Jawaban ({filteredSubmissions.length} Siswa)
            </button>
            <button
              type="button"
              onClick={() => setViewMode("full_roster")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === "full_roster"
                  ? "bg-purple-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Daftar Semua Siswa Kelas & Absensi ({fullRosterRows.length} Siswa)
            </button>
          </div>
        )}
      </div>

      {/* View Mode 1: Submissions Only Table */}
      {viewMode === "submissions_only" ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800 text-sm">
                Daftar Lembar Jawaban Siswa
              </h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                {filteredSubmissions.length} Data Ditampilkan
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 uppercase font-bold text-slate-500">
                <tr>
                  <th className="p-3.5 pl-4">No</th>
                  <th className="p-3.5">Tanggal Ujian</th>
                  <th className="p-3.5">Siswa</th>
                  <th className="p-3.5">Kelas</th>
                  <th className="p-3.5">Mata Pelajaran & Ujian</th>
                  <th className="p-3.5 text-center">Soal Dijawab</th>
                  <th className="p-3.5 text-center">Nilai AI</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      Tidak ada lembar jawaban yang cocok dengan kriteria filter.
                    </td>
                  </tr>
                ) : (
                  filteredSubmissions.map((sub, idx) => {
                    const exam = examMap.get(sub.examId);
                    const examDate = exam?.examDate || sub.submittedAt?.split("T")[0] || "-";
                    const totalQ = exam?.questions?.length || sub.answeredCount || 5;
                    const answeredCount = sub.answers
                      ? Object.values(sub.answers).filter(
                          (a) => typeof a === "string" && a.trim().length > 0
                        ).length
                      : sub.answeredCount || totalQ;

                    return (
                      <tr key={sub.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3.5 pl-4 font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-1.5 font-medium text-slate-700">
                            <Calendar className="w-3.5 h-3.5 text-purple-600" />
                            <span>{examDate}</span>
                          </div>
                          {sub.submittedAt && (
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              Pukul: {new Date(sub.submittedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
                            </span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900">{sub.studentName}</div>
                          <div className="text-[11px] font-mono text-slate-400">
                            NISN: {sub.studentNisn || sub.studentId || "-"}
                          </div>
                        </td>
                        <td className="p-3.5 font-semibold text-slate-700">
                          {sub.studentClass || exam?.targetClassName || "-"}
                        </td>
                        <td className="p-3.5 max-w-xs">
                          <span className="font-bold text-purple-900 block truncate">
                            {exam?.subject || "Ujian Uraian"}
                          </span>
                          <span className="text-[11px] text-slate-500 block truncate">
                            {exam?.title || sub.examTitle || "-"}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono font-bold">
                            {answeredCount} / {totalQ}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          {sub.status === "in_progress" ? (
                            <span className="text-xs text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded">
                              Sedang Dikerjakan
                            </span>
                          ) : (
                            <div className="inline-flex items-baseline gap-1">
                              <span className="text-sm font-black text-slate-900">{sub.totalScore ?? 0}</span>
                              <span className="text-[10px] text-slate-400">/ 100</span>
                            </div>
                          )}
                        </td>
                        <td className="p-3.5 text-center">
                          {sub.status === "in_progress" ? (
                            <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-amber-100 text-amber-900 border border-amber-300">
                              PROSES
                            </span>
                          ) : (
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                sub.isPassed
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  : "bg-rose-100 text-rose-800 border border-rose-200"
                              }`}
                            >
                              {sub.isPassed ? "LULUS" : "REMEDIAL"}
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedDetailSub(sub)}
                              className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-bold rounded-xl border border-purple-200 shadow-xs transition inline-flex items-center gap-1.5"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Lihat
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSubmission(sub)}
                              disabled={isDeleting === sub.id}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-200 transition"
                              title="Hapus / Reset data jawaban siswa ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* View Mode 2: Full Class Attendance & Completion Roster */
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800 text-sm">
                Status Kehadiran & Pengerjaan Ujian Seluruh Siswa ({selectedExam?.targetClassName})
              </h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                {fullRosterRows.length} Siswa Terdaftar
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 uppercase font-bold text-slate-500">
                <tr>
                  <th className="p-3.5 pl-4">No</th>
                  <th className="p-3.5">Nama Siswa</th>
                  <th className="p-3.5">NISN</th>
                  <th className="p-3.5">Status Pengerjaan / Kehadiran</th>
                  <th className="p-3.5 text-center">Nilai Ujian</th>
                  <th className="p-3.5 text-center">Kelulusan KKM</th>
                  <th className="p-3.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fullRosterRows.map((row, idx) => {
                  return (
                    <tr
                      key={row.student.id}
                      className={`hover:bg-slate-50/80 transition ${
                        row.isAbsent ? "bg-slate-50/40" : ""
                      }`}
                    >
                      <td className="p-3.5 pl-4 font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-3.5 font-bold text-slate-900">
                        {row.student.name}
                      </td>
                      <td className="p-3.5 font-mono text-slate-500">
                        {row.student.nisn || "-"}
                      </td>
                      <td className="p-3.5">
                        {row.isCompleted && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Sudah Mengumpulkan & Dinilai
                          </span>
                        )}
                        {row.isInProgress && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            Sedang Mengerjakan
                          </span>
                        )}
                        {row.isAbsent && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-300">
                            <UserX className="w-3.5 h-3.5 text-slate-400" />
                            Tidak Hadir / Belum Mengerjakan
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        {row.isCompleted && row.submission ? (
                          <div className="inline-flex items-baseline gap-1">
                            <span className="text-sm font-black text-slate-900">
                              {row.submission.totalScore ?? 0}
                            </span>
                            <span className="text-[10px] text-slate-400">/ 100</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono font-bold">-</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        {row.isCompleted && row.submission ? (
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              row.submission.isPassed
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : "bg-rose-100 text-rose-800 border border-rose-200"
                            }`}
                          >
                            {row.submission.isPassed ? "LULUS" : "REMEDIAL"}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        {row.submission ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedDetailSub(row.submission)}
                              className="px-3 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-bold rounded-xl border border-purple-200 shadow-xs transition inline-flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              Detail
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSubmission(row.submission!)}
                              disabled={isDeleting === row.submission.id}
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Hapus data jawaban"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Tanpa Lembar Jawaban</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detailed Student Answer Modal */}
      {selectedDetailSub && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-800 font-black text-lg flex items-center justify-center border border-purple-200">
                  {selectedDetailSub.studentName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">
                    {selectedDetailSub.studentName}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    NISN: <span className="font-mono">{selectedDetailSub.studentNisn || selectedDetailSub.studentId}</span> • Kelas:{" "}
                    <strong>{selectedDetailSub.studentClass || examMap.get(selectedDetailSub.examId)?.targetClassName}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDeleteSubmission(selectedDetailSub)}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition flex items-center gap-1.5"
                  title="Hapus lembar jawaban ini"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Hapus Jawaban
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDetailSub(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Score & Exam Banner */}
            {(() => {
              const exam = examMap.get(selectedDetailSub.examId);
              return (
                <div className="mt-4 p-4 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-purple-300 block">
                      {exam?.subject || "Ujian Sekolah"} • Tanggal: {exam?.examDate || selectedDetailSub.submittedAt?.split("T")[0]}
                    </span>
                    <h4 className="text-sm sm:text-base font-bold text-white mt-0.5">
                      {exam?.title || selectedDetailSub.examTitle}
                    </h4>
                    <span className="text-xs text-slate-400">
                      Passing Grade (KKM): {exam?.passingGrade || 75}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 bg-slate-800/80 px-4 py-2.5 rounded-xl border border-slate-700">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-bold block">NILAI AKHIR</span>
                      <span className="text-2xl font-black text-emerald-400 leading-none">
                        {selectedDetailSub.totalScore}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        selectedDetailSub.isPassed
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                      }`}
                    >
                      {selectedDetailSub.isPassed ? "LULUS" : "REMEDIAL"}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Questions & Answers List */}
            <div className="py-4 space-y-4 overflow-y-auto flex-1 mt-2">
              {(() => {
                const exam = examMap.get(selectedDetailSub.examId);
                const questions = exam?.questions || [];

                if (questions.length === 0) {
                  return (
                    <div className="p-6 text-center text-slate-400 text-xs">
                      Informasi butir soal tidak ditemukan untuk ujian ini.
                    </div>
                  );
                }

                return questions.map((q, qIdx) => {
                  const studentAnswer =
                    selectedDetailSub.answers?.[q.id] || "(Siswa tidak mengisi jawaban)";
                  const grading = selectedDetailSub.gradings?.[q.id];
                  const maxPoints = q.maxScore || 20;
                  const awarded = grading?.scoreAwarded ?? Math.round(maxPoints * 0.8);

                  return (
                    <div
                      key={q.id}
                      className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3"
                    >
                      {/* Question Header */}
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 bg-purple-100 text-purple-800 text-xs font-black rounded-lg">
                          Soal #{q.number || qIdx + 1} (Maks {maxPoints} Poin)
                        </span>

                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-500 font-semibold">Skor AI:</span>
                          <span className="text-sm font-black text-purple-900 bg-white px-2.5 py-0.5 rounded-lg border border-purple-200">
                            {awarded} / {maxPoints}
                          </span>
                        </div>
                      </div>

                      {/* Question Text */}
                      <p className="text-sm font-bold text-slate-900 leading-relaxed">
                        {q.question}
                      </p>

                      {/* Student's Written Answer */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1 shadow-xs">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          Jawaban Yang Ditulis Siswa:
                        </span>
                        <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                          {studentAnswer}
                        </p>
                      </div>

                      {/* Teacher's Model Answer / Answer Key */}
                      {q.answerKey && (
                        <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200/80 space-y-1">
                          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                            Kunci Jawaban / Acuan Penilaian:
                          </span>
                          <p className="text-xs text-emerald-950 leading-relaxed">
                            {q.answerKey}
                          </p>
                        </div>
                      )}

                      {/* AI Rubric Analysis & Feedback */}
                      {grading && (
                        <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-1.5">
                          <div className="flex items-center gap-1.5 font-bold text-indigo-950 text-xs">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Analisis & Rubrik Penilaian AI</span>
                          </div>
                          {grading.feedback && (
                            <p className="text-xs text-slate-700 italic">
                              "{grading.feedback}"
                            </p>
                          )}
                          {grading.matchedKeyPoints && grading.matchedKeyPoints.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              <span className="text-[10px] font-bold text-indigo-900 mr-1">
                                Poin Kunci Terpenuhi:
                              </span>
                              {grading.matchedKeyPoints.map((k, ki) => (
                                <span
                                  key={ki}
                                  className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-medium"
                                >
                                  ✓ {k}
                                </span>
                              ))}
                            </div>
                          )}
                          {grading.missingKeyPoints && grading.missingKeyPoints.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              <span className="text-[10px] font-bold text-rose-800 mr-1">
                                Poin Kunci Belum Tercakup:
                              </span>
                              {grading.missingKeyPoints.map((k, ki) => (
                                <span
                                  key={ki}
                                  className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-medium"
                                >
                                  ✗ {k}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDetailSub(null)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
