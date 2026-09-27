import React, { useState, useEffect, useMemo } from "react";
import { User, ClassRoom, Exam, ExamSubmission, QuestionGrading } from "../../types";
import { storage } from "../../services/storage";
import {
  buildViolationAudit,
  summarizeViolations,
  SEVERITY_LABEL,
  SOURCE_LABEL,
} from "../../utils/violationAudit";
import { describeMcqAnswer, isMcqQuestion, normalizeChoice } from "../../utils/examHelpers";
import {
  Activity,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  Maximize,
  Minimize,
  Search,
  Eye,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Camera,
  Monitor,
  Cpu,
  FileText,
  Calendar,
  X,
  UserX,
} from "lucide-react";

interface LiveExamTabProps {
  exams: Exam[];
  classes: ClassRoom[];
  submissions: ExamSubmission[];
  users: User[];
}

export function LiveExamTab({
  exams,
  classes,
  submissions: initialSubmissions,
  users: initialUsers,
}: LiveExamTabProps) {
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const availableExams = useMemo(() => {
    const pub = exams.filter((e) => e.status === "published");
    const list = pub.length > 0 ? pub : exams;
    // Sort so today/newest exams appear first
    return [...list].sort((a, b) => {
      const dateA = a.examDate || "";
      const dateB = b.examDate || "";
      return dateB.localeCompare(dateA);
    });
  }, [exams]);

  const [examPeriodFilter, setExamPeriodFilter] = useState<"all" | "today" | "past">("all");

  const displayedExams = useMemo(() => {
    if (examPeriodFilter === "today") {
      return availableExams.filter((e) => e.examDate === todayStr);
    } else if (examPeriodFilter === "past") {
      return availableExams.filter((e) => e.examDate && e.examDate !== todayStr);
    }
    return availableExams;
  }, [availableExams, examPeriodFilter, todayStr]);

  // Find best initial exam (one that has submissions, or the first available)
  const initialBestExam = useMemo(() => {
    const examWithSubs = availableExams.find((ex) =>
      initialSubmissions.some((s) => s.examId === ex.id)
    );
    return examWithSubs?.id || availableExams[0]?.id || "";
  }, [availableExams, initialSubmissions]);

  const [selectedExamId, setSelectedExamId] = useState<string>(initialBestExam);
  const [liveSubmissions, setLiveSubmissions] = useState<ExamSubmission[]>(
    initialSubmissions
  );
  const [liveUsers, setLiveUsers] = useState<User[]>(initialUsers);

  // If filter changes and current exam is not in displayedExams, switch to first available
  useEffect(() => {
    if (displayedExams.length > 0 && !displayedExams.some((e) => e.id === selectedExamId)) {
      const withSubs = displayedExams.find((ex) =>
        liveSubmissions.some((s) => s.examId === ex.id)
      );
      setSelectedExamId(withSubs ? withSubs.id : displayedExams[0].id);
    }
  }, [displayedExams, selectedExamId, liveSubmissions]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "not_started" | "in_progress" | "graded" | "violation"
  >("all");
  const [modalViewTab, setModalViewTab] = useState<"answers" | "proctoring">("answers");
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<{
    student: User;
    submission?: ExamSubmission;
    status: "not_started" | "in_progress" | "graded";
  } | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>(
    new Date().toLocaleTimeString("id-ID")
  );

  // Synchronize when parent props change
  useEffect(() => {
    if (initialSubmissions) setLiveSubmissions(initialSubmissions);
  }, [initialSubmissions]);

  useEffect(() => {
    if (initialUsers) setLiveUsers(initialUsers);
  }, [initialUsers]);

  // Sync latest submissions & users periodically and via storage events
  const refreshLiveData = async () => {
    setIsRefreshing(true);
    try {
      const subs = storage.getSubmissions();
      const usrs = storage.getUsers();
      setLiveSubmissions(subs);
      setLiveUsers(usrs);
      setLastSyncTime(new Date().toLocaleTimeString("id-ID"));

      // Also trigger cloud refresh in background for real-time accuracy
      await storage.refreshFromCloud();
      setLiveSubmissions(storage.getSubmissions());
      setLiveUsers(storage.getUsers());
      setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
    } catch (err) {
      console.warn("Error refreshing live data:", err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  };

  useEffect(() => {
    refreshLiveData();

    // Auto poll every 2 seconds for live status and violation sync
    const pollInterval = setInterval(() => {
      try {
        const subs = storage.getSubmissions();
        const usrs = storage.getUsers();
        setLiveSubmissions(subs);
        setLiveUsers(usrs);
        setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
      } catch {
        // ignore
      }
    }, 2000);

    const handleStorageChange = () => {
      const subs = storage.getSubmissions();
      const usrs = storage.getUsers();
      setLiveSubmissions(subs);
      setLiveUsers(usrs);
      setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
    };

    window.addEventListener("edu_data_changed", handleStorageChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener("edu_data_changed", handleStorageChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  // Update selected exam if current one is empty
  useEffect(() => {
    if (!selectedExamId && availableExams.length > 0) {
      setSelectedExamId(availableExams[0].id);
    }
  }, [availableExams, selectedExamId]);

  const selectedExam = availableExams.find((e) => e.id === selectedExamId);

  // Robust multi-attribute student matching (identitas kuat -> nama -> fallback)
  const normalizeIdentity = (v?: string) => (v || "").trim().toLowerCase();

  const isStudentMatch = (s: ExamSubmission, u: User): boolean => {
    if (!s || !u) return false;
    const sId = normalizeIdentity(s.studentId);
    const uId = normalizeIdentity(u.id);
    const sNisn = normalizeIdentity(s.studentNisn);
    const uNisn = normalizeIdentity(u.nisn);
    const sEmail = normalizeIdentity(
      (s as any).email || (sId.includes("@") ? sId : "")
    );
    const uEmail = normalizeIdentity(u.email);

    // 1. Direct ID match
    if (sId && uId && sId === uId) return true;
    // 2. NISN match
    if (uNisn && (sNisn === uNisn || sId === uNisn)) return true;
    // 3. Email match
    if (uEmail && (sEmail === uEmail || sId === uEmail)) return true;
    // 4. Normalized student name match (case-insensitive)
    if (
      s.studentName &&
      u.name &&
      s.studentName.trim().toLowerCase() === u.name.trim().toLowerCase()
    )
      return true;
    return false;
  };

  /**
   * Fallback untuk data lama yang studentId-nya tidak sama dengan id pengguna
   * (mis. `sub-{examId}-{nisn}`). Hanya dipakai bila tidak ada kecocokan kuat,
   * supaya `id.includes()` tidak salahubuangkan siswa satu dengan yang lain.
   */
  const isLooseStudentMatch = (s: ExamSubmission, u: User): boolean => {
    if (!s?.id || !u) return false;
    const uId = normalizeIdentity(u.id);
    const uNisn = normalizeIdentity(u.nisn);
    const sId = normalizeIdentity(s.id);
    return Boolean(
      (uId && sId.includes(uId)) || (uNisn && sId.includes(uNisn))
    );
  };

  const matchSubmissions = (student: User, subs: ExamSubmission[]) => {
    const strict = subs.filter((s) => isStudentMatch(s, student));
    if (strict.length > 0) return strict;
    return subs.filter((s) => isLooseStudentMatch(s, student));
  };

  // Filter submissions for this specific exam
  const examSubmissions = useMemo(() => {
    if (!selectedExamId) return [];
    return liveSubmissions.filter((s) => s.examId === selectedExamId);
  }, [liveSubmissions, selectedExamId]);

  // Determine students in this exam (by targetClassId or by having a submission)
  const studentsInExam = useMemo(() => {
    const allStudents = liveUsers.filter((u) => u.role === "siswa");
    if (!selectedExam) return allStudents;

    if (!selectedExam.targetClassId || selectedExam.targetClassId === "all") {
      return allStudents;
    }

    return allStudents.filter(
      (u) =>
        u.classId === selectedExam.targetClassId ||
        matchSubmissions(u, examSubmissions).length > 0
    );
  }, [liveUsers, selectedExam, examSubmissions]);

  // Compute status and statistics for every student
  const studentRows = useMemo(() => {
    if (!selectedExam) return [];

    const totalQuestions = selectedExam.questions?.length || 1;

    return studentsInExam.map((student) => {
      const studentSubs = matchSubmissions(student, examSubmissions);

      // Prioritize completed (graded, submitted, or with submittedAt)
      const completedSub = studentSubs.find(
        (s) =>
          s.status === "graded" ||
          s.status === "submitted" ||
          Boolean(s.submittedAt) ||
          (s.totalScore !== undefined && s.totalScore !== null && s.totalScore > 0)
      );
      const inProgressSub = studentSubs.find(
        (s) => s.status === "in_progress" || Boolean(s.startedAt)
      );
      const sub = completedSub || inProgressSub || studentSubs[0];

      const answersCount = sub?.answers
        ? Object.values(sub.answers).filter(
            (a) => typeof a === "string" && a.trim().length > 0
          ).length
        : 0;

      let status: "not_started" | "in_progress" | "graded" = "not_started";
      let statusLabel = "Belum Mulai";
      let statusBadgeClass = "bg-slate-100 text-slate-700 border-slate-300";

      if (sub) {
        const isCompleted =
          sub.status === "graded" ||
          sub.status === "submitted" ||
          Boolean(sub.submittedAt);

        if (isCompleted) {
          status = "graded";
          statusLabel = "Sudah Dinilai";
          statusBadgeClass =
            "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold";
        } else if (sub.status === "in_progress" || Boolean(sub.startedAt) || answersCount > 0) {
          status = "in_progress";
          statusLabel = "Mengerjakan";
          statusBadgeClass =
            "bg-amber-100 text-amber-900 border-amber-300 font-black animate-pulse";
        }
      }

      const progressPercent = Math.min(
        100,
        Math.round((answersCount / totalQuestions) * 100)
      );

      const violationLogs = sub?.violationLogs || [];
      const violationCount = sub?.violationCount || violationLogs.length || 0;

      return {
        student,
        sub,
        status,
        statusLabel,
        statusBadgeClass,
        answersCount,
        totalQuestions,
        progressPercent,
        violationCount,
        violationLogs,
        violationAudit: buildViolationAudit(violationLogs, sub?.startedAt),
        violationSummary: summarizeViolations(violationLogs),
        score: sub?.totalScore ?? null,
        isPassed: sub?.isPassed ?? false,
        startedAt: sub?.startedAt,
        submittedAt: sub?.submittedAt,
        lastActiveAt: sub?.lastActiveAt,
      };
    });
  }, [studentsInExam, examSubmissions, selectedExam]);

  // Filtered rows by search and status filter
  const filteredRows = useMemo(() => {
    return studentRows.filter((row) => {
      const matchSearch =
        row.student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (row.student.nisn && row.student.nisn.includes(searchQuery)) ||
        (row.student.className &&
          row.student.className.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchSearch) return false;

      if (statusFilter === "not_started") return row.status === "not_started";
      if (statusFilter === "in_progress") return row.status === "in_progress";
      if (statusFilter === "graded") return row.status === "graded";
      if (statusFilter === "violation") return row.violationCount > 0;

      return true;
    });
  }, [studentRows, searchQuery, statusFilter]);

  // Statistics Summary Counters
  const stats = useMemo(() => {
    const total = studentRows.length;
    const notStarted = studentRows.filter((r) => r.status === "not_started").length;
    const inProgress = studentRows.filter((r) => r.status === "in_progress").length;
    const graded = studentRows.filter((r) => r.status === "graded").length;
    const totalViolations = studentRows.reduce(
      (acc, r) => acc + r.violationCount,
      0
    );
    const studentsWithViolation = studentRows.filter(
      (r) => r.violationCount > 0
    ).length;

    const scoresList = studentRows
      .filter((r) => r.status === "graded" && r.score !== null)
      .map((r) => r.score as number);
    const avgScore =
      scoresList.length > 0
        ? Math.round(
            scoresList.reduce((acc, s) => acc + s, 0) / scoresList.length
          )
        : 0;

    return {
      total,
      notStarted,
      inProgress,
      graded,
      totalViolations,
      studentsWithViolation,
      avgScore,
    };
  }, [studentRows]);

  const formatTimeStr = (iso?: string) => {
    if (!iso) return "-";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  // Audit pelanggaran untuk siswa yang sedang dibuka di modal
  const detailAudit = useMemo(
    () =>
      buildViolationAudit(
        selectedStudentDetail?.submission?.violationLogs,
        selectedStudentDetail?.submission?.startedAt
      ),
    [selectedStudentDetail]
  );
  const detailSummary = useMemo(
    () => summarizeViolations(selectedStudentDetail?.submission?.violationLogs),
    [selectedStudentDetail]
  );

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-50 bg-slate-50 p-6 overflow-y-auto"
          : "space-y-6"
      }
    >
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-600" />
              Pemantauan Ujian Live (Real-Time)
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Status real-time siswa: <strong>Belum Mulai</strong>,{" "}
            <strong className="text-amber-600">Mengerjakan</strong>, atau{" "}
            <strong className="text-emerald-600">Sudah Dinilai</strong> beserta
            deteksi kamera & pergerakan.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
          {/* Period filter buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setExamPeriodFilter("all")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                examPeriodFilter === "all"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Semua ({availableExams.length})
            </button>
            <button
              type="button"
              onClick={() => setExamPeriodFilter("today")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                examPeriodFilter === "today"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => setExamPeriodFilter("past")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                examPeriodFilter === "past"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Clock className="w-3 h-3 text-slate-400" />
              Terdahulu
            </button>
          </div>

          {/* Exam Selector */}
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="px-3.5 py-2 border border-slate-300 rounded-xl bg-slate-50 text-xs sm:text-sm font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-1 lg:max-w-md"
          >
            {displayedExams.length === 0 && (
              <option value="">Tidak ada ujian pada filter ini</option>
            )}
            {displayedExams.map((ex) => {
              const subCount = liveSubmissions.filter((s) => s.examId === ex.id).length;
              return (
                <option key={ex.id} value={ex.id}>
                  [{ex.examDate || "-"}] {ex.subject} — {ex.targetClassName || "Semua Kelas"} ({subCount} Siswa)
                </option>
              );
            })}
          </select>

          {/* Sync Button */}
          <button
            type="button"
            onClick={refreshLiveData}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition flex items-center gap-1.5 shadow-sm justify-center"
            title="Sinkronisasi Data Sekarang"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-indigo-600 ${
                isRefreshing ? "animate-spin" : ""
              }`}
            />
            <span className="hidden sm:inline">Sinkron</span> ({lastSyncTime})
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-xl bg-white border border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-sm transition"
            title={isFullscreen ? "Keluar Layar Penuh" : "Mode Layar Penuh"}
          >
            {isFullscreen ? (
              <Minimize className="w-4 h-4" />
            ) : (
              <Maximize className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {selectedExam ? (
        <div className="space-y-6">
          {/* History info banner if past exam */}
          {selectedExam.examDate && selectedExam.examDate !== todayStr && (
            <div className="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-4 text-xs text-indigo-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-slate-900">
                    Mode Riwayat Ujian Terdahulu: {selectedExam.title}
                  </p>
                  <p className="text-slate-600 text-[11px]">
                    Tanggal Pelaksanaan: {selectedExam.examDate || "-"} | Target: {selectedExam.targetClassName || "Semua Kelas"}. Seluruh lembar jawaban siswa dan nilai AI tersimpan secara permanen.
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 font-black shrink-0 text-[11px]">
                {examSubmissions.length} Lembar Jawaban Terkumpul
              </span>
            </div>
          )}

          {/* Live KPI Statistics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {/* Total Peserta */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Total Siswa
                </p>
                <p className="text-xl font-black text-slate-900">{stats.total}</p>
              </div>
            </div>

            {/* Belum Mulai */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Belum Mulai
                </p>
                <p className="text-xl font-black text-slate-600">
                  {stats.notStarted}
                </p>
              </div>
            </div>

            {/* Sedang Mengerjakan */}
            <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                  Mengerjakan
                </p>
                <p className="text-xl font-black text-amber-900">
                  {stats.inProgress}
                </p>
              </div>
            </div>

            {/* Sudah Dinilai */}
            <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  Sudah Dinilai
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-emerald-900">
                    {stats.graded}
                  </span>
                  {stats.avgScore > 0 && (
                    <span className="text-[10px] font-bold text-emerald-700">
                      (Rata²: {stats.avgScore})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Pelanggaran Pengawas */}
            <div className="bg-rose-50/60 p-4 rounded-2xl border border-rose-200 shadow-sm flex items-center gap-3 col-span-2 sm:col-span-1">
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                  Pelanggaran
                </p>
                <p className="text-xl font-black text-rose-900">
                  {stats.totalViolations}{" "}
                  <span className="text-xs font-normal text-rose-600">
                    ({stats.studentsWithViolation} Siswa)
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Search, Filter & Action Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Box */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari siswa berdasarkan nama, NISN, atau kelas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
              />
            </div>

            {/* Status Filter Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  statusFilter === "all"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Semua ({studentRows.length})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("not_started")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  statusFilter === "not_started"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Belum Mulai ({stats.notStarted})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("in_progress")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  statusFilter === "in_progress"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                }`}
              >
                Mengerjakan ({stats.inProgress})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("graded")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  statusFilter === "graded"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                }`}
              >
                Sudah Dinilai ({stats.graded})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("violation")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  statusFilter === "violation"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100"
                }`}
              >
                Pelanggaran ({stats.studentsWithViolation})
              </button>
            </div>
          </div>

          {/* Main Live Monitoring Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-bold">
                    <th className="p-3.5 pl-4 border-b border-slate-200">No</th>
                    <th className="p-3.5 border-b border-slate-200">Peserta Ujian</th>
                    <th className="p-3.5 border-b border-slate-200">Kelas</th>
                    <th className="p-3.5 border-b border-slate-200">Status</th>
                    <th className="p-3.5 border-b border-slate-200">Progres Soal</th>
                    <th className="p-3.5 border-b border-slate-200">Waktu</th>
                    <th className="p-3.5 border-b border-slate-200">
                      Pelanggaran Kamera/Layar
                    </th>
                    <th className="p-3.5 border-b border-slate-200">Nilai AI</th>
                    <th className="p-3.5 pr-4 border-b border-slate-200 text-center">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="p-8 text-center text-slate-400 text-xs sm:text-sm"
                      >
                        <UserX className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        Tidak ada siswa yang sesuai dengan filter saat ini.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, index) => {
                      return (
                        <tr
                          key={row.student.id}
                          className="hover:bg-slate-50/80 transition"
                        >
                          {/* Number */}
                          <td className="p-3.5 pl-4 text-slate-400 font-mono text-xs">
                            {index + 1}
                          </td>

                          {/* Student Info */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-2.5">
                              {row.student.avatar ? (
                                <img
                                  src={row.student.avatar}
                                  alt={row.student.name}
                                  className="w-8 h-8 rounded-full object-cover border border-slate-200"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0">
                                  {row.student.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <p className="font-bold text-slate-900 leading-tight">
                                  {row.student.name}
                                </p>
                                <p className="text-[11px] text-slate-500 font-mono">
                                  NISN: {row.student.nisn || "-"}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Class */}
                          <td className="p-3.5 font-medium text-slate-700">
                            {row.student.className || "-"}
                          </td>

                          {/* Status Badge: Belum Mulai / Mengerjakan / Sudah Dinilai */}
                          <td className="p-3.5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-xs ${row.statusBadgeClass}`}
                            >
                              {row.status === "in_progress" && (
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
                              )}
                              {row.statusLabel}
                            </span>
                          </td>

                          {/* Progress */}
                          <td className="p-3.5">
                            {row.status === "not_started" ? (
                              <span className="text-slate-400 text-xs">
                                0 / {row.totalQuestions} Soal (0%)
                              </span>
                            ) : row.status === "in_progress" ? (
                              <div className="space-y-1 w-32">
                                <div className="flex justify-between text-[11px] font-bold text-amber-800">
                                  <span>{row.answersCount} / {row.totalQuestions}</span>
                                  <span>{row.progressPercent}%</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-amber-500 h-full transition-all duration-300 rounded-full"
                                    style={{ width: `${row.progressPercent}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="text-emerald-700 font-bold text-xs flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Selesai ({row.totalQuestions} Soal)
                              </span>
                            )}
                          </td>

                          {/* Time */}
                          <td className="p-3.5 text-xs text-slate-600">
                            {row.status === "in_progress" ? (
                              <div>
                                <span className="text-slate-500 block text-[10px]">
                                  Mulai: {formatTimeStr(row.startedAt)}
                                </span>
                                <span className="text-emerald-600 font-bold text-[10px]">
                                  Sesi Aktif
                                </span>
                              </div>
                            ) : row.status === "graded" ? (
                              <div>
                                <span className="text-slate-500 block text-[10px]">
                                  Selesai: {formatTimeStr(row.submittedAt)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>

                          {/* Violations */}
                          <td className="p-3.5">
                            {row.violationCount > 0 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedStudentDetail({
                                    student: row.student,
                                    submission: row.sub,
                                    status: row.status,
                                  })
                                }
                                className="inline-flex flex-col items-start gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 font-bold text-xs transition cursor-pointer text-left"
                                title="Klik untuk melihat rincianaudit: apa yang dilakukan siswa"
                              >
                                <span className="inline-flex items-center gap-1.5">
                                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                  {row.violationCount} Kali Terdeteksi
                                </span>
                                <span className="text-[10px] font-semibold text-rose-600/90 leading-tight">
                                  {row.violationSummary.topCategories
                                    .slice(0, 2)
                                    .map((c) => `${c.category.label} ${c.count}x`)
                                    .join(", ") || "Lihat rincian"}
                                </span>
                                {row.violationSummary.highestSeverity === "kritis" && (
                                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-600 text-white">
                                    Termasuk Kritis
                                  </span>
                                )}
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                Tertib (0x)
                              </span>
                            )}
                          </td>

                          {/* Score */}
                          <td className="p-3.5">
                            {row.status === "graded" && row.score !== null ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-black text-slate-900">
                                  {row.score}
                                </span>
                                <span className="text-[10px] text-slate-400">/ 100</span>
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                    row.isPassed
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-rose-100 text-rose-800"
                                  }`}
                                >
                                  {row.isPassed ? "LULUS" : "REMEDIAL"}
                                </span>
                              </div>
                            ) : row.status === "in_progress" ? (
                              <span className="text-amber-600 text-xs font-medium">
                                Mengisi...
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>

                          {/* Action */}
                          <td className="p-3.5 pr-4 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedStudentDetail({
                                  student: row.student,
                                  submission: row.sub,
                                  status: row.status,
                                })
                              }
                              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-indigo-700 text-xs font-bold rounded-lg border border-slate-300 shadow-xs transition inline-flex items-center gap-1 cursor-pointer"
                              title="Lihat Log dan Rincian Pengawasan Siswa"
                            >
                              <Eye className="w-3 h-3" />
                              Rincian
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 shadow-sm">
          <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-700 text-base">
            Tidak Ada Ujian yang Sedang Berlangsung / Dipublikasikan
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Silakan publikasikan ujian terlebih dahulu melalui tab Manajemen
            Ujian.
          </p>
        </div>
      )}

      {/* Detail & Proctoring Log Modal */}
      {selectedStudentDetail && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-3">
                {selectedStudentDetail.student.avatar ? (
                  <img
                    src={selectedStudentDetail.student.avatar}
                    alt={selectedStudentDetail.student.name}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 font-bold text-lg flex items-center justify-center">
                    {selectedStudentDetail.student.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-bold text-slate-900 leading-snug">
                    {selectedStudentDetail.student.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    NISN: {selectedStudentDetail.student.nisn || "-"} | Kelas:{" "}
                    {selectedStudentDetail.student.className || "-"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedStudentDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab selection inside modal */}
            <div className="flex items-center gap-2 pt-3 pb-1">
              <button
                type="button"
                onClick={() => setModalViewTab("answers")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  modalViewTab === "answers"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Lembar Jawaban Siswa & Nilai AI
              </button>
              <button
                type="button"
                onClick={() => setModalViewTab("proctoring")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  modalViewTab === "proctoring"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                Audit Pelanggaran ({detailSummary.total})
              </button>
            </div>

            {/* Modal Body */}
            <div className="py-3 space-y-4 overflow-y-auto flex-1 pr-1">
              {/* Session Overview Box */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Status Pengerjaan
                  </span>
                  <span
                    className={`inline-block mt-0.5 px-2 py-0.5 rounded-md font-bold text-xs ${
                      selectedStudentDetail.status === "graded"
                        ? "bg-emerald-100 text-emerald-800"
                        : selectedStudentDetail.status === "in_progress"
                        ? "bg-amber-100 text-amber-900 font-black"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {selectedStudentDetail.status === "graded"
                      ? "Sudah Dinilai"
                      : selectedStudentDetail.status === "in_progress"
                      ? "Mengerjakan"
                      : "Belum Mulai"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Waktu Mulai
                  </span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">
                    {formatTimeStr(selectedStudentDetail.submission?.startedAt)}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Waktu Selesai
                  </span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">
                    {formatTimeStr(selectedStudentDetail.submission?.submittedAt)}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Total Nilai Akhir
                  </span>
                  <span className="font-black text-indigo-700 mt-0.5 block text-sm">
                    {selectedStudentDetail.submission?.totalScore !== undefined &&
                    selectedStudentDetail.status === "graded"
                      ? `${selectedStudentDetail.submission.totalScore} / 100`
                      : "-"}
                  </span>
                </div>
              </div>

              {/* View 1: Student Answers & AI Grading */}
              {modalViewTab === "answers" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      Jawaban Uraian & Rubrik Penilaian ({selectedExam?.questions?.length || 0} Soal)
                    </h4>
                  </div>

                  {selectedExam?.questions && selectedExam.questions.length > 0 ? (
                    <div className="space-y-3.5">
                      {selectedExam.questions.map((q, idx) => {
                        const studentAnswer =
                          selectedStudentDetail.submission?.answers?.[q.id];
                        const grading =
                          selectedStudentDetail.submission?.gradings?.[q.id];

                        return (
                          <div
                            key={q.id || idx}
                            className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 text-xs space-y-3"
                          >
                            <div className="flex justify-between items-start gap-2">
                              <span className="font-bold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                                Soal #{q.number || idx + 1}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold text-[11px]">
                                Bobot: {q.maxScore || 20} Poin
                              </span>
                            </div>

                            <p className="text-slate-800 font-medium leading-relaxed bg-white p-3 rounded-lg border border-slate-100">
                              {q.question || "(Teks soal tidak tersedia)"}
                            </p>

                            {isMcqQuestion(q) && (q.options || []).length > 0 && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {(q.options || []).map((opt) => (
                                  <div
                                    key={opt.label}
                                    className={`text-[11px] px-2 py-1 rounded-lg border ${
                                      normalizeChoice(opt.label) ===
                                      normalizeChoice(q.correctAnswer)
                                        ? "bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold"
                                        : "bg-white border-slate-100 text-slate-600"
                                    }`}
                                  >
                                    <span className="font-bold">{opt.label}.</span> {opt.text}
                                    {normalizeChoice(opt.label) ===
                                      normalizeChoice(q.correctAnswer) && (
                                      <span className="ml-1 font-black text-emerald-700">
                                        (kunci)
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Student Answer */}
                            <div className="bg-white p-3 rounded-xl border border-indigo-100">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider">
                                  Jawaban Siswa:
                                </span>
                                {studentAnswer ? (
                                  <span className="text-[10px] text-emerald-600 font-bold">
                                    Telah Diisi
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-amber-600 font-bold">
                                    Belum Diisi
                                  </span>
                                )}
                              </div>
                              <p className="text-slate-900 text-xs leading-relaxed whitespace-pre-wrap font-sans bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                                {isMcqQuestion(q) && studentAnswer
                                  ? describeMcqAnswer(q, studentAnswer)
                                  : studentAnswer || "(Siswa tidak memberikan jawaban)"}
                              </p>
                            </div>

                            {/* Answer Key */}
                            {q.answerKey && (
                              <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200 text-xs text-emerald-950">
                                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">
                                  {isMcqQuestion(q)
                                    ? "Pembahasan:"
                                    : "Kunci Jawaban Guru:"}
                                </span>
                                <p className="whitespace-pre-wrap text-[11px] leading-relaxed">
                                  {q.answerKey}
                                </p>
                              </div>
                            )}

                            {/* AI Evaluation */}
                            {grading && (
                              <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-200 text-xs space-y-1.5">
                                <div className="flex justify-between items-center font-bold text-indigo-950">
                                  <span>
                                    {isMcqQuestion(q)
                                      ? "Koreksi Otomatis"
                                      : "Hasil Evaluasi AI"}
                                  </span>
                                  <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-md text-[11px]">
                                    Skor: {grading.scoreAwarded} /{" "}
                                    {grading.maxScore || q.maxScore || 20}
                                  </span>
                                </div>
                                <p className="text-slate-700 italic text-[11px] leading-relaxed">
                                  "{grading.feedback}"
                                </p>
                                {grading.matchedKeyPoints &&
                                  grading.matchedKeyPoints.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-1 mt-1 pt-1.5 border-t border-indigo-100">
                                      <span className="text-[10px] font-bold text-indigo-900">
                                        Poin Kunci Terpenuhi:
                                      </span>
                                      {grading.matchedKeyPoints.map((kw, kwIdx) => (
                                        <span
                                          key={kwIdx}
                                          className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-medium"
                                        >
                                          ✓ {kw}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                {grading.missingKeyPoints &&
                                  grading.missingKeyPoints.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-1">
                                      <span className="text-[10px] font-bold text-rose-800">
                                        Poin Kunci Belum Tercakup:
                                      </span>
                                      {grading.missingKeyPoints.map((kw, kwIdx) => (
                                        <span
                                          key={kwIdx}
                                          className="px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded text-[10px] font-medium"
                                        >
                                          ✗ {kw}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-50 rounded-xl text-center text-slate-500 text-xs">
                      Tidak ada data soal pada ujian ini.
                    </div>
                  )}
                </div>
              )}

              {/* View 2: Proctoring & Violation Audit Logs */}
              {modalViewTab === "proctoring" && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-indigo-600" />
                      Audit Pelanggaran: Apa yang Dilakukan Siswa
                    </span>
                    <span className="text-[11px] font-semibold text-rose-600">
                      Total: {detailSummary.total} Kejadian
                    </span>
                  </h4>

                  {detailSummary.total > 0 && (
                    <>
                      {/* Ringkasan per jenis & sumber */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {(
                          [
                            { key: "kritis", label: "Kritis", value: detailSummary.bySeverity.kritis, cls: "bg-rose-600 text-white" },
                            { key: "pelanggaran", label: "Pelanggaran", value: detailSummary.bySeverity.pelanggaran, cls: "bg-rose-100 text-rose-800" },
                            { key: "peringatan", label: "Peringatan", value: detailSummary.bySeverity.peringatan, cls: "bg-amber-100 text-amber-800" },
                            { key: "layar", label: "Kunci Layar", value: detailSummary.bySource.layar, cls: "bg-indigo-100 text-indigo-800" },
                          ] as const
                        ).map((item) => (
                          <div key={item.key} className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center">
                            <p className={`text-lg font-black ${item.cls.split(" ")[0]}`}>{item.value}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              {item.label}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {detailSummary.topCategories.map((c) => (
                          <span
                            key={c.category.key}
                            title={c.category.description}
                            className="px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-bold"
                          >
                            {c.category.label} ({c.count}x) • {SOURCE_LABEL[c.category.source]}
                          </span>
                        ))}
                      </div>

                      {/* Timeline kejadian terbaru */}
                      <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-80 overflow-y-auto bg-white">
                        {detailAudit.map((row) => {
                          const SourceIcon =
                            row.source === "kamera" ? Camera : row.source === "layar" ? Monitor : Cpu;
                          return (
                            <div
                              key={`${row.log.timestamp}-${row.index}`}
                              className="p-3 flex items-start gap-2.5 text-xs hover:bg-slate-50 transition"
                            >
                              <span
                                className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                                  row.severity === "kritis"
                                    ? "bg-rose-600 text-white"
                                    : row.severity === "peringatan"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-rose-100 text-rose-700"
                                }`}
                              >
                                <SourceIcon className="w-3.5 h-3.5" />
                              </span>

                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <p className="font-bold text-slate-900">
                                    {row.category.label}
                                  </p>
                                  <span
                                    className={`px-1.5 py-0.5 rounded border text-[9px] font-black uppercase ${
                                      row.severity === "kritis"
                                        ? "bg-rose-600 text-white border-rose-700"
                                        : row.severity === "peringatan"
                                        ? "bg-amber-100 text-amber-800 border-amber-200"
                                        : "bg-rose-100 text-rose-800 border-rose-200"
                                    }`}
                                  >
                                    {SEVERITY_LABEL[row.severity]}
                                  </span>
                                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                    {SOURCE_LABEL[row.source]}
                                  </span>
                                </div>

                                <p className="text-[11px] text-slate-700 leading-relaxed mt-0.5">
                                  {row.log.detail || row.log.reason}
                                </p>

                                {row.log.evidence && (
                                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                    Bukti: {row.log.evidence}
                                  </p>
                                )}

                                <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-slate-400 font-mono">
                                  <span>Waktu: {row.timeLabel}</span>
                                  {row.elapsedLabel !== "-" && <span>| {row.elapsedLabel}</span>}
                                  {row.questionLabel !== "-" && <span>| {row.questionLabel}</span>}
                                  <span>| kejadian ke-{row.log.count || row.index}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {detailSummary.total === 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center text-xs text-emerald-800 flex flex-col items-center gap-1.5">
                      <ShieldCheck className="w-8 h-8 text-emerald-600" />
                      <p className="font-bold text-sm">Tidak Ada Catatan Pelanggaran</p>
                      <p className="text-xs text-emerald-700 max-w-md">
                        Siswa mengerjakan ujian dengan tertib: tidak keluar dari layar
                        penuh, tidak berpindah tab, dan wajah tetap berada di bingkai
                        kamera pengawas.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedStudentDetail(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
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
