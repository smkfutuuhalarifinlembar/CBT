import { useState } from "react";
import { User, Exam, ExamSubmission } from "../../types";
import { getExamAvailability } from "../../utils/examHelpers";
import {
  BookOpen,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  Eye,
  ShieldCheck,
  Lock,
  Award,
  Sparkles,
  Camera,
} from "lucide-react";

interface StudentDashboardProps {
  student: User;
  exams: Exam[];
  submissions: ExamSubmission[];
  onStartExam: (exam: Exam) => void;
  onViewScore: (exam: Exam, submission: ExamSubmission) => void;
}

export function StudentDashboard({
  student,
  exams,
  submissions,
  onStartExam,
  onViewScore,
}: StudentDashboardProps) {
  // Robust student match helper
  const isStudentMatch = (s: ExamSubmission): boolean => {
    if (!s || !student) return false;
    if (s.studentId && student.id && s.studentId === student.id) return true;
    if (student.nisn && (s.studentId === student.nisn || (s as any).nisn === student.nisn)) return true;
    if (student.email && (s.studentId === student.email || (s as any).email === student.email)) return true;
    if (
      s.studentName &&
      student.name &&
      s.studentName.trim().toLowerCase() === student.name.trim().toLowerCase()
    )
      return true;
    if (s.id && student.id && s.id.includes(student.id)) return true;
    if (s.id && student.nisn && s.id.includes(student.nisn)) return true;
    return false;
  };

  // Filter exams for student's class (or general if not specified)
  const classExams = exams.filter(
    (e) => !student.classId || e.targetClassId === student.classId || e.targetClassId === "all"
  );

  // Student stats (only count completed exams for score and count)
  const studentSubmissions = submissions.filter(
    (s) =>
      isStudentMatch(s) &&
      (s.status === "graded" || s.status === "submitted" || Boolean(s.submittedAt))
  );
  const completedCount = studentSubmissions.length;
  const avgScore =
    completedCount > 0
      ? Math.round(
          studentSubmissions.reduce((acc, curr) => acc + (curr.totalScore || 0), 0) / completedCount
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Student Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-indigo-700/50">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            {student.avatar ? (
              <img
                src={student.avatar}
                alt={student.name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-indigo-400 shadow-md shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-indigo-800/80 border-2 border-indigo-400/50 flex items-center justify-center text-xl font-black text-indigo-200 shrink-0">
                {student.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-2 border border-indigo-500/30">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Portal Siswa • {student.className || "Kelas XII IPA 1"}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                Selamat Datang, {student.name}!
              </h1>
              <p className="text-indigo-200 text-sm mt-1 max-w-xl">
                Silakan periksa jadwal ujian uraian kelas Anda di bawah ini. Pastikan kamera perangkat aktif dan patuhi aturan mode terkunci (lockdown).
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <div className="bg-indigo-950/70 border border-indigo-700/50 rounded-2xl p-4 text-center min-w-[110px]">
              <span className="text-xs text-indigo-300 font-semibold block">Ujian Selesai</span>
              <span className="text-2xl sm:text-3xl font-black text-white mt-0.5 block">
                {completedCount}
              </span>
            </div>
            <div className="bg-indigo-950/70 border border-indigo-700/50 rounded-2xl p-4 text-center min-w-[110px]">
              <span className="text-xs text-indigo-300 font-semibold block">Rata-rata Nilai</span>
              <span className="text-2xl sm:text-3xl font-black text-emerald-400 mt-0.5 block">
                {completedCount > 0 ? avgScore : "-"}
              </span>
            </div>
          </div>
        </div>

        {/* Requirements reminder */}
        <div className="mt-6 pt-4 border-t border-indigo-700/40 flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-indigo-200">
          <span className="flex items-center gap-1.5 font-medium">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            Setiap ujian hanya 1 kali kesempatan
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <Camera className="w-3.5 h-3.5 text-emerald-400" />
            Kamera proctoring mengikuti pengaturan ujian
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
            Mode layar terkunci (Anti Tab-Switching) sesuai pengaturan ujian
          </span>
        </div>
      </div>

      {/* Exam List Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              Daftar Ujian Uraian {student.className}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Semua ujian untuk kelas Anda ditampilkan. Ujian hanya dapat dikerjakan saat status aktif.
            </p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {classExams.length} Total Ujian
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {classExams.map((exam) => {
            const studentSubsForExam = submissions.filter(
              (s) => s.examId === exam.id && isStudentMatch(s)
            );
            const submission =
              studentSubsForExam.find(
                (s) =>
                  s.status === "graded" ||
                  s.status === "submitted" ||
                  Boolean(s.submittedAt)
              ) || studentSubsForExam[0];

            const hasSubmitted = Boolean(
              submission &&
                (submission.status === "graded" ||
                  submission.status === "submitted" ||
                  Boolean(submission.submittedAt))
            );
            const isInProgress = Boolean(
              !hasSubmitted &&
                submission &&
                submission.status === "in_progress" &&
                !submission.submittedAt
            );
            const availability = getExamAvailability(exam, hasSubmitted);

            return (
              <div
                key={exam.id}
                className="bg-white rounded-2xl border border-slate-200/80 hover:border-slate-300 shadow-sm hover:shadow-md transition flex flex-col justify-between overflow-hidden"
              >
                {/* Card Top */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {exam.subject}
                    </span>

                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full border ${availability.badgeClass}`}
                    >
                      {availability.label}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base leading-snug line-clamp-2 mb-2">
                    {exam.title}
                  </h3>

                  <p className="text-xs text-slate-500 mb-4">
                    Guru Pengampu: <strong className="text-slate-700">{exam.teacherName}</strong>
                  </p>

                  {/* Schedule Details */}
                  <div className="bg-slate-50 rounded-xl p-3.5 space-y-2 text-xs text-slate-600 border border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" /> Tanggal:
                      </span>
                      <span className="font-semibold text-slate-800">{exam.examDate}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Clock className="w-3.5 h-3.5 text-indigo-500" /> Jam Buka - Selesai:
                      </span>
                      <span className="font-semibold text-slate-800">
                        {exam.startTime} - {exam.endTime} WIB
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <BookOpen className="w-3.5 h-3.5 text-indigo-500" /> Jumlah Soal:
                      </span>
                      <span className="font-semibold text-slate-800">
                        {exam.questions.length} Soal Uraian ({exam.durationMinutes} Menit)
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Award className="w-3.5 h-3.5 text-amber-500" /> KKM Kelulusan:
                      </span>
                      <span className="font-semibold text-slate-800">{exam.passingGrade}</span>
                    </div>
                  </div>

                  {/* Timing or Submission Note */}
                  <p className="text-[11px] text-slate-500 mt-3 italic flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {availability.timeNote}
                  </p>
                </div>

                {/* Card Bottom / Action Area */}
                <div className="p-5 pt-0 border-t border-slate-100 mt-2 bg-slate-50/50">
                  {hasSubmitted && submission ? (
                    <div className="flex items-center justify-between pt-3 gap-2">
                      <div className="text-left">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">
                          Nilai Diperoleh:
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-black text-slate-900">
                            {submission.totalScore}
                          </span>
                          <span className="text-xs text-slate-500">/ 100</span>
                          <span
                            className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              submission.isPassed
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {submission.isPassed ? "LULUS" : "REMEDIAL"}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onViewScore(exam, submission)}
                        className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold rounded-xl border border-slate-300 shadow-sm transition flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-600" />
                        Lihat Nilai & Rubrik
                      </button>
                    </div>
                  ) : availability.canTake ? (
                    <button
                      type="button"
                      onClick={() => onStartExam(exam)}
                      className={`w-full mt-3 py-2.5 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 ${
                        isInProgress
                          ? "bg-amber-600 hover:bg-amber-500 active:bg-amber-700 animate-pulse ring-2 ring-amber-400/50"
                          : "bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700"
                      }`}
                    >
                      <Play className="w-4 h-4 fill-white" />
                      {isInProgress ? "Lanjutkan Ujian (Sedang Dikerjakan)" : "Mulai Mengerjakan Ujian"}
                    </button>
                  ) : (
                    <div className="mt-3">
                      <button
                        type="button"
                        disabled
                        className="w-full py-2.5 bg-slate-100 text-slate-400 font-bold text-xs rounded-xl cursor-not-allowed border border-slate-200 flex items-center justify-center gap-1.5"
                      >
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                        {availability.status === "upcoming"
                          ? "Belum Masuk Jam Ujian"
                          : availability.status === "ended"
                          ? "Waktu Ujian Berakhir"
                          : "Ujian Tidak Aktif"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
