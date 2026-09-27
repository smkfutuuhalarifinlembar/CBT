import { useState } from "react";
import { User, Exam, ExamSubmission, ClassRoom } from "../../types";
import { downloadQuestionTemplateXlsx } from "../../utils/excelQuestionImport";
import { LiveExamTab } from "../admin/LiveExamTab";
import {
  Plus,
  Edit3,
  Eye,
  Users,
  CheckCircle2,
  Calendar,
  Clock,
  BookOpen,
  Award,
  Sparkles,
  Search,
  Trash2,
  Download,
  FileSpreadsheet,
  Activity,
  Layers,
} from "lucide-react";

interface TeacherDashboardProps {
  currentUser: User;
  exams: Exam[];
  submissions: ExamSubmission[];
  classes: ClassRoom[];
  users?: User[];
  onOpenCreate: () => void;
  onOpenEdit: (exam: Exam) => void;
  onPreviewExam: (exam: Exam) => void;
  onOpenSubmissions: (exam: Exam) => void;
  onTogglePublish: (exam: Exam) => void;
  onDeleteExam: (examId: string) => void;
}

export function TeacherDashboard({
  currentUser,
  exams,
  submissions,
  classes,
  users = [],
  onOpenCreate,
  onOpenEdit,
  onPreviewExam,
  onOpenSubmissions,
  onTogglePublish,
  onDeleteExam,
}: TeacherDashboardProps) {
  const [activeMainTab, setActiveMainTab] = useState<"exams" | "live">("exams");
  const [filterTab, setFilterTab] = useState<"all" | "published" | "draft">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const teacherExams = exams.filter(
    (e) =>
      e.teacherId === currentUser.id ||
      currentUser.role === "admin" ||
      !e.teacherId ||
      (e.teacherName &&
        currentUser.name &&
        e.teacherName.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
  );

  const filteredExams = teacherExams
    .filter((e) => {
      if (filterTab === "published") return e.status === "published";
      if (filterTab === "draft") return e.status === "draft";
      return true;
    })
    .filter(
      (e) =>
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.subject.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const totalExams = teacherExams.length;
  const teacherExamIds = new Set(teacherExams.map((e) => e.id));
  const relevantSubmissions = submissions.filter((s) => teacherExamIds.has(s.examId));
  const totalSubmissions = relevantSubmissions.length;
  const avgScore =
    totalSubmissions > 0
      ? Math.round(
          relevantSubmissions.reduce((acc, c) => acc + (c.totalScore || 0), 0) /
            totalSubmissions
        )
      : 0;

  const handleDownloadQuestionTemplate = () => {
    void downloadQuestionTemplateXlsx({
      filename: "template_soal_ujian.xlsx",
      kinds: ["pg", "essay"],
    });
  };

  return (
    <div className="space-y-6">
      {/* Teacher Header Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-teal-700/50">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-teal-400 shadow-md shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-teal-800/80 border-2 border-teal-400/50 flex items-center justify-center text-xl font-black text-teal-200 shrink-0">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-bold uppercase tracking-wider mb-2 border border-teal-500/30">
                <Sparkles className="w-3.5 h-3.5 text-teal-300" />
                Panel Guru & Evaluator AI
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                Selamat Bertugas, {currentUser.name}!
              </h1>
              <p className="text-teal-200 text-sm mt-1 max-w-xl">
                Buat soal uraian, tentukan kunci jawaban model dan kata kunci, lalu pratinjau tampilan siswa sebelum dipublikasikan.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleDownloadQuestionTemplate}
              className="px-4 py-3 bg-teal-950/80 hover:bg-teal-950 text-teal-200 hover:text-white font-bold text-xs sm:text-sm rounded-2xl border border-teal-600/50 shadow-md transition flex items-center gap-2"
              title="Unduh template Excel (.xlsx) untuk membuat banyak soal uraian dan pilihan ganda di Excel/Sheets"
            >
              <Download className="w-4 h-4 text-teal-400" />
              <span>Unduh Template Soal (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={onOpenCreate}
              className="px-5 py-3 bg-white hover:bg-teal-50 text-teal-950 font-black text-xs sm:text-sm rounded-2xl shadow-lg transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4 text-teal-700 stroke-[3]" />
              <span>Buat Ujian Uraian Baru</span>
            </button>
          </div>
        </div>

        {/* Quick Teacher Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mt-6 pt-6 border-t border-teal-700/40">
          <div className="bg-teal-950/60 rounded-2xl p-4 border border-teal-700/30">
            <span className="text-xs text-teal-300 font-semibold block">Total Ujian Dibuat</span>
            <span className="text-2xl sm:text-3xl font-black text-white mt-1 block">{totalExams}</span>
          </div>

          <div className="bg-teal-950/60 rounded-2xl p-4 border border-teal-700/30">
            <span className="text-xs text-teal-300 font-semibold block">Lembar Jawaban Masuk</span>
            <span className="text-2xl sm:text-3xl font-black text-white mt-1 block">{totalSubmissions}</span>
          </div>

          <div className="bg-teal-950/60 rounded-2xl p-4 border border-teal-700/30 col-span-2 sm:col-span-1">
            <span className="text-xs text-teal-300 font-semibold block">Rata-rata Nilai Siswa</span>
            <span className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1 block">
              {totalSubmissions > 0 ? avgScore : "-"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Teacher Mode Switcher: Exams List vs Live Monitoring */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveMainTab("exams")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
            activeMainTab === "exams"
              ? "bg-teal-700 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Daftar Ujian Uraian ({teacherExams.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab("live")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
            activeMainTab === "live"
              ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400/40"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
          </span>
          <Activity className="w-4 h-4 text-indigo-400" />
          <span>Pemantauan Live Ujian</span>
        </button>
      </div>

      {activeMainTab === "live" ? (
        <LiveExamTab
          exams={teacherExams}
          classes={classes}
          submissions={submissions}
          users={users}
        />
      ) : (
        <>
          {/* Filter and Search Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setFilterTab("all")}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition ${
                  filterTab === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Semua Ujian ({teacherExams.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("published")}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition ${
                  filterTab === "published" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Terpublikasi ({teacherExams.filter((e) => e.status === "published").length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("draft")}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition ${
                  filterTab === "draft" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Draf ({teacherExams.filter((e) => e.status === "draft").length})
              </button>
            </div>

            <div className="relative max-w-xs w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari judul ujian atau mapel..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm"
              />
            </div>
          </div>

          {/* Exam Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredExams.map((exam) => {
              const examSubmissions = submissions.filter((s) => s.examId === exam.id);
              const isDraft = exam.status === "draft";

              return (
                <div
                  key={exam.id}
                  className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md transition flex flex-col justify-between overflow-hidden"
                >
                  <div className="p-5">
                    {/* Header tags */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-lg bg-teal-50 text-teal-800 border border-teal-200">
                        {exam.subject}
                      </span>

                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                          isDraft
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : "bg-emerald-100 text-emerald-800 border-emerald-300"
                        }`}
                      >
                        {isDraft ? "DRAF (Belum Terbit)" : "TERPUBLIKASI"}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-base leading-snug line-clamp-2 mb-2">
                      {exam.title}
                    </h3>

                    <p className="text-xs text-slate-500 mb-4">
                      Target: <strong className="text-slate-800">{exam.targetClassName}</strong>
                    </p>

                    {/* Info List */}
                    <div className="bg-slate-50 rounded-xl p-3.5 space-y-2 text-xs text-slate-600 border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <Calendar className="w-3.5 h-3.5 text-teal-600" /> Tanggal Ujian:
                        </span>
                        <span className="font-semibold text-slate-800">{exam.examDate}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <Clock className="w-3.5 h-3.5 text-teal-600" /> Waktu:
                        </span>
                        <span className="font-semibold text-slate-800">
                          {exam.startTime} - {exam.endTime} ({exam.durationMinutes} Menit)
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <BookOpen className="w-3.5 h-3.5 text-teal-600" /> Jumlah Soal:
                        </span>
                        <span className="font-semibold text-slate-800">
                          {exam.questions.length} Soal Uraian (KKM {exam.passingGrade})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="p-4 bg-slate-50/70 border-t border-slate-100 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {/* Preview Button */}
                      <button
                        type="button"
                        onClick={() => onPreviewExam(exam)}
                        className="w-full py-2 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 shadow-sm transition flex items-center justify-center gap-1.5"
                        title="Pratinjau antarmuka siswa"
                      >
                        <Eye className="w-3.5 h-3.5 text-teal-600" />
                        Pratinjau Siswa
                      </button>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => onOpenEdit(exam)}
                        className="w-full py-2 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 shadow-sm transition flex items-center justify-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                        Edit Soal
                      </button>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      {/* View Submissions */}
                      <button
                        type="button"
                        onClick={() => onOpenSubmissions(exam)}
                        className="flex-1 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl shadow transition flex items-center justify-center gap-1.5"
                      >
                        <Users className="w-3.5 h-3.5" />
                        Jawaban Siswa ({examSubmissions.length})
                      </button>

                      {/* Toggle publish */}
                      <button
                        type="button"
                        onClick={() => onTogglePublish(exam)}
                        className={`px-3 py-2 text-xs font-bold rounded-xl border transition ${
                          isDraft
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                            : "bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300"
                        }`}
                        title={isDraft ? "Publikasikan ujian ke siswa" : "Kembalikan ujian ke status draf"}
                      >
                        {isDraft ? "Terbitkan" : "Tarik Draf"}
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteExam(exam.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                        title="Hapus Ujian"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
