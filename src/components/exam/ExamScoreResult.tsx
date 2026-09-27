import { Exam, ExamSubmission } from "../../types";
import {
  buildViolationAudit,
  SEVERITY_LABEL,
  SOURCE_LABEL,
} from "../../utils/violationAudit";
import {
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ArrowLeft,
  Printer,
  Sparkles,
  BookOpen,
  ShieldAlert,
  Camera,
  Monitor,
  Cpu,
} from "lucide-react";
import confetti from "canvas-confetti";
import { useEffect } from "react";

interface ExamScoreResultProps {
  exam: Exam;
  submission: ExamSubmission;
  onBackToDashboard?: () => void;
  onClose?: () => void;
}

export function ExamScoreResult({ exam, submission, onBackToDashboard, onClose }: ExamScoreResultProps) {
  const handleClose = onClose || onBackToDashboard || (() => {});
  const isPassed = submission.totalScore >= exam.passingGrade;
  const violationAudit = buildViolationAudit(
    submission.violationLogs,
    submission.startedAt
  );

  useEffect(() => {
    if (isPassed) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [isPassed]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-in fade-in duration-300">
      {/* Top action */}
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={handleClose}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Daftar Ujian
        </button>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-sm"
        >
          <Printer className="w-4 h-4 text-slate-500" />
          Cetak Hasil Nilai
        </button>
      </div>

      {/* Hero Score Card */}
      <div
        className={`rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-8 relative overflow-hidden ${
          isPassed
            ? "bg-gradient-to-br from-emerald-600 via-teal-700 to-cyan-800"
            : "bg-gradient-to-br from-rose-600 via-pink-700 to-amber-800"
        }`}
      >
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-bold uppercase tracking-wider text-white mb-3">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Penilaian Essay Otomatis AI Selesai
            </div>
            <h1 className="text-2xl sm:text-3xl font-black">{exam.title}</h1>
            <p className="text-white/90 text-sm mt-1 font-medium">
              Mata Pelajaran: {exam.subject} • Siswa: {submission.studentName} ({submission.studentClassName})
            </p>
            <p className="text-xs text-white/75 mt-2">
              Diselesaikan pada: {new Date(submission.submittedAt).toLocaleString("id-ID")}
            </p>
          </div>

          {/* Big Score Box */}
          <div className="bg-white text-slate-900 rounded-2xl p-6 text-center shadow-2xl min-w-[200px] shrink-0 border-4 border-white/30">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Nilai Akhir Siswa
            </span>
            <div className="text-5xl sm:text-6xl font-black tracking-tight my-1 text-slate-900">
              {submission.totalScore}
            </div>
            <div className="text-xs font-semibold text-slate-500">Skala 0 - 100</div>

            <div className="mt-3 pt-3 border-t border-slate-100">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${
                  isPassed
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {isPassed ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" /> LULUS KKM ({exam.passingGrade})
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" /> PERLU REMEDIAL (&lt;{exam.passingGrade})
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Security and timing indicators */}
        <div className="mt-6 pt-4 border-t border-white/20 flex flex-wrap items-center gap-4 text-xs text-white/90">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>Waktu Pengerjaan: {exam.durationMinutes} Menit Maks.</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
            <span>Kamera Pengawas: Aktif Selama Ujian</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-amber-300" />
            <span>Pelanggaran: {submission.violationCount || 0} Kali</span>
          </div>
        </div>

        {/* Rincian pelanggaran yang tercatat selama ujian */}
        {violationAudit.length > 0 && (
          <div className="mt-3 p-4 bg-rose-950/30 border border-rose-300/30 rounded-2xl">
            <h4 className="text-xs font-black uppercase tracking-wider text-rose-200 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" />
              Catatan Pelanggaran Selama Ujian ({violationAudit.length} kejadian)
            </h4>
            <p className="text-[11px] text-rose-100/70 mt-1 mb-2.5">
              Data ini tercatat oleh sistem pengawasan dan akan digunakan guru untuk
              keperluan penilaian.
            </p>
            <ul className="space-y-2">
              {violationAudit.map((row) => {
                const SourceIcon =
                  row.source === "kamera" ? Camera : row.source === "layar" ? Monitor : Cpu;
                return (
                  <li
                    key={`${row.log.timestamp}-${row.index}`}
                    className="flex items-start gap-2 text-[11px] text-white/90 bg-slate-950/40 rounded-xl px-2.5 py-2"
                  >
                    <SourceIcon className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-300" />
                    <div>
                      <p className="font-bold">
                        {row.category.label} • {SEVERITY_LABEL[row.severity]} •{" "}
                        {SOURCE_LABEL[row.source]}
                      </p>
                      <p className="text-white/75 leading-relaxed">
                        {row.log.detail || row.log.reason}
                      </p>
                      <p className="text-white/45 font-mono text-[10px] mt-0.5">
                        {row.timeLabel}
                        {row.elapsedLabel !== "-" ? ` • ${row.elapsedLabel}` : ""}
                        {row.questionLabel !== "-" ? ` • ${row.questionLabel}` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Detailed breakdown per question */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            Rincian Evaluasi & Koreksi Jawaban
          </h2>
          <span className="text-xs font-medium text-slate-500">
            {exam.questions.length} Soal Total
          </span>
        </div>

        {exam.questions.map((q, idx) => {
          const isMC = q.type === "pg";
          const grading = submission.gradings[q.id];
          const studentAns = submission.answers[q.id] || "(Tidak dijawab)";
          const score = grading ? grading.scoreAwarded : 0;
          const max = q.maxScore || 20;

          return (
            <div
              key={q.id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 sm:p-6 overflow-hidden"
            >
              {/* Question Header */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-200">
                    #{idx + 1}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    isMC ? "bg-amber-100 text-amber-800" : "bg-indigo-100 text-indigo-800"
                  }`}>
                    {isMC ? "Pilihan Ganda" : "Soal Uraian"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500">Skor:</span>
                  <span className={`text-sm font-black px-2.5 py-1 rounded-lg border ${
                    score === max
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : score > 0
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-rose-50 text-rose-700 border-rose-200"
                  }`}>
                    {score} / {max}
                  </span>
                </div>
              </div>

              {/* Question Body */}
              <div className="mt-4">
                <p className="text-sm sm:text-base font-semibold text-slate-900 leading-relaxed">
                  {q.question}
                </p>
              </div>

              {/* Multiple Choice view */}
              {isMC && q.options && (
                <div className="mt-4 space-y-2">
                  {q.options.map((opt) => {
                    const isSelected = (studentAns || "").trim().toUpperCase() === (opt.label || "").trim().toUpperCase();
                    const isCorrect = (opt.label || "").trim().toUpperCase() === (q.correctAnswer || "").trim().toUpperCase();
                    let rowStyle = "border-slate-200 bg-slate-50 text-slate-700";
                    if (isSelected && isCorrect) {
                      rowStyle = "border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold";
                    } else if (isSelected && !isCorrect) {
                      rowStyle = "border-rose-300 bg-rose-50 text-rose-900 line-through";
                    } else if (isCorrect) {
                      rowStyle = "border-emerald-300 bg-emerald-50/50 text-emerald-800 font-medium";
                    }

                    return (
                      <div
                        key={opt.label}
                        className={`flex items-center justify-between p-3 rounded-xl border text-xs ${rowStyle}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-white border border-slate-300 flex items-center justify-center font-bold text-slate-700 shrink-0">
                            {opt.label}
                          </span>
                          <span>{opt.text}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-bold">
                          {isSelected && (
                            <span className={isCorrect ? "text-emerald-700" : "text-rose-600"}>
                              [Pilihan Anda]
                            </span>
                          )}
                          {isCorrect && (
                            <span className="text-emerald-700 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Kunci Benar
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Student Answer for Essay */}
              {!isMC && (
                <>
                  <div className="mt-4 bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                      Jawaban Uraian Siswa:
                    </span>
                    <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {studentAns}
                    </p>
                  </div>

                  {q.answerKey && (
                    <div className="mt-3 bg-emerald-50/60 rounded-xl p-4 border border-emerald-200/80">
                      <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block mb-1">
                        Kunci Jawaban Uraian (Model Guru):
                      </span>
                      <p className="text-sm text-emerald-950 leading-relaxed">
                        {q.answerKey}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* AI Matching Analysis for Essay */}
              {!isMC && grading && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Matched Points */}
                  <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Poin & Kata Kunci yang Sesuai:
                    </div>
                    {grading.matchedKeyPoints && grading.matchedKeyPoints.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {grading.matchedKeyPoints.map((pt, i) => (
                          <span
                            key={i}
                            className="text-xs bg-white text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200 font-medium"
                          >
                            ✓ {pt}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">Tidak ada kata kunci yang cocok.</p>
                    )}
                  </div>

                  {/* Missing Points */}
                  <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 mb-2">
                      <XCircle className="w-4 h-4 text-amber-600" />
                      Poin yang Kurang / Terlewat:
                    </div>
                    {grading.missingKeyPoints && grading.missingKeyPoints.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {grading.missingKeyPoints.map((pt, i) => (
                          <span
                            key={i}
                            className="text-xs bg-white text-amber-800 px-2.5 py-0.5 rounded-full border border-amber-200 font-medium"
                          >
                            • {pt}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-emerald-700 font-medium">Lengkap! Semua poin esensial terpenuhi.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Feedback Note */}
              {grading?.feedback && (
                <div className="mt-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-indigo-950 leading-relaxed">
                    <strong className="font-bold">
                      {isMC ? "Evaluasi Otomatis: " : "Umpan Balik AI: "}
                    </strong>
                    {grading.feedback}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 text-center">
        <button
          type="button"
          onClick={handleClose}
          className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-lg transition"
        >
          Kembali ke Dashboard Utama
        </button>
      </div>
    </div>
  );
}
