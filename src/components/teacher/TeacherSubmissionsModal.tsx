import { useState, useMemo } from "react";
import { Exam, ExamSubmission, QuestionGrading, EssayQuestion } from "../../types";
import {
  buildViolationAudit,
  summarizeViolations,
  SEVERITY_LABEL,
  SOURCE_LABEL,
} from "../../utils/violationAudit";
import { gradeStudentAnswers } from "../../services/aiGrading";
import {
  X,
  Eye,
  Download,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Award,
  ChevronLeft,
  Search,
  RefreshCw,
  Zap,
} from "lucide-react";

interface TeacherSubmissionsModalProps {
  exam: Exam;
  submissions: ExamSubmission[];
  onUpdateSubmission: (sub: ExamSubmission) => void;
  onClose: () => void;
}

// Helper to extract student answer for a question with resilient fallbacks
function getAnswerForQuestion(
  q: EssayQuestion,
  qIdx: number,
  answers: Record<string, string> = {}
): string {
  if (!answers) return "";
  if (answers[q.id] !== undefined && answers[q.id] !== null) {
    return String(answers[q.id]);
  }

  const qNum = q.number || qIdx + 1;
  const entries = Object.entries(answers);

  const pattern = new RegExp(`[-_]${qNum}[-_]`, "i");
  const match = entries.find(([k]) => pattern.test(k));
  if (match && match[1]) return String(match[1]);

  if (qIdx < entries.length && entries[qIdx]) {
    return String(entries[qIdx][1]);
  }

  return "";
}

export function TeacherSubmissionsModal({
  exam,
  submissions,
  onUpdateSubmission,
  onClose,
}: TeacherSubmissionsModalProps) {
  const examSubmissions = useMemo(() => {
    const raw = submissions.filter((s) => s.examId === exam.id);
    const map = new Map<string, ExamSubmission>();
    for (const s of raw) {
      const existing = map.get(s.studentId);
      if (!existing) {
        map.set(s.studentId, s);
      } else if (s.status === "graded" || s.status === "submitted" || Boolean(s.submittedAt)) {
        map.set(s.studentId, s);
      }
    }
    return Array.from(map.values());
  }, [submissions, exam.id]);

  const [selectedSub, setSelectedSub] = useState<ExamSubmission | null>(null);
  const [searchKeyword, setSearchKeyword] = useState<string>("");
  const [adjustmentScores, setAdjustmentScores] = useState<Record<string, number>>({});
  const [teacherNotes, setTeacherNotes] = useState<Record<string, string>>({});
  const [isGradingAll, setIsGradingAll] = useState(false);
  const [isGradingSingle, setIsGradingSingle] = useState(false);

  const filtered = examSubmissions.filter((s) =>
    (s.studentName || "").toLowerCase().includes(searchKeyword.toLowerCase())
  );

  // Audit pelanggaran untuk siswa yang sedang ditinjau
  const selectedViolationAudit = useMemo(
    () => buildViolationAudit(selectedSub?.violationLogs, selectedSub?.startedAt),
    [selectedSub]
  );
  const selectedViolationSummary = useMemo(
    () => summarizeViolations(selectedSub?.violationLogs).summaryText,
    [selectedSub]
  );

  const handleOpenDetail = (sub: ExamSubmission) => {
    setSelectedSub(sub);
    const initialAdj: Record<string, number> = {};
    const initialNotes: Record<string, string> = {};
    Object.entries(sub.gradings || {}).forEach(([qId, g]) => {
      initialAdj[qId] = g.teacherAdjustment !== undefined ? g.teacherAdjustment : g.scoreAwarded;
      initialNotes[qId] = g.teacherNotes || "";
    });
    setAdjustmentScores(initialAdj);
    setTeacherNotes(initialNotes);
  };

  const handleEvaluateSingleAI = async () => {
    if (!selectedSub) return;
    setIsGradingSingle(true);
    try {
      const answersToGrade: Record<string, string> = {};
      exam.questions.forEach((q, idx) => {
        answersToGrade[q.id] = getAnswerForQuestion(q, idx, selectedSub.answers);
      });

      const res = await gradeStudentAnswers(exam.questions, answersToGrade);
      const updatedSub: ExamSubmission = {
        ...selectedSub,
        status: "graded",
        gradings: res.gradings || {},
        totalScore: res.totalScore || 0,
        rawScore: res.rawScore ?? res.totalScore ?? 0,
        isPassed: (res.totalScore || 0) >= exam.passingGrade,
        submittedAt: selectedSub.submittedAt || new Date().toISOString(),
      };

      onUpdateSubmission(updatedSub);
      setSelectedSub(updatedSub);

      const newAdj: Record<string, number> = {};
      Object.entries(updatedSub.gradings || {}).forEach(([qId, g]) => {
        newAdj[qId] = g.scoreAwarded;
      });
      setAdjustmentScores(newAdj);
    } catch (e) {
      alert("Gagal melakukan evaluasi AI: " + e);
    } finally {
      setIsGradingSingle(false);
    }
  };

  const handleGradeAllAI = async () => {
    if (examSubmissions.length === 0) {
      alert("Belum ada jawaban siswa pada ujian ini.");
      return;
    }
    if (!window.confirm(`Evaluasi otomatis ${examSubmissions.length} lembar jawaban siswa menggunakan AI?`)) return;

    setIsGradingAll(true);
    try {
      for (const sub of examSubmissions) {
        const answersToGrade: Record<string, string> = {};
        exam.questions.forEach((q, idx) => {
          answersToGrade[q.id] = getAnswerForQuestion(q, idx, sub.answers);
        });

        const res = await gradeStudentAnswers(exam.questions, answersToGrade);
        const updated: ExamSubmission = {
          ...sub,
          status: "graded",
          gradings: res.gradings || {},
          totalScore: res.totalScore || 0,
          rawScore: res.rawScore ?? res.totalScore ?? 0,
          isPassed: (res.totalScore || 0) >= exam.passingGrade,
          submittedAt: sub.submittedAt || new Date().toISOString(),
        };
        onUpdateSubmission(updated);
      }
      alert(`Berhasil mengevaluasi seluruh ${examSubmissions.length} lembar jawaban siswa!`);
    } catch (e) {
      alert("Terjadi kendala saat mengevaluasi: " + e);
    } finally {
      setIsGradingAll(false);
    }
  };

  const handleSaveAdjustment = () => {
    if (!selectedSub) return;
    let newTotalScore = 0;
    const updatedGradings: Record<string, QuestionGrading> = { ...(selectedSub.gradings || {}) };

    exam.questions.forEach((q) => {
      const g = updatedGradings[q.id];
      const currentScore = adjustmentScores[q.id] !== undefined ? adjustmentScores[q.id] : (g?.scoreAwarded || 0);
      updatedGradings[q.id] = {
        questionId: q.id,
        studentAnswer: g?.studentAnswer || getAnswerForQuestion(q, 0, selectedSub.answers),
        scoreAwarded: g?.scoreAwarded || currentScore,
        maxScore: q.maxScore || 20,
        percentage: g?.percentage || Math.round((currentScore / (q.maxScore || 20)) * 100),
        feedback: g?.feedback || "Dinilai oleh Guru",
        matchedKeyPoints: g?.matchedKeyPoints || [],
        missingKeyPoints: g?.missingKeyPoints || [],
        teacherAdjustment: currentScore,
        teacherNotes: teacherNotes[q.id] || "",
      };
      newTotalScore += currentScore;
    });

    const maxPoints = exam.questions.reduce((sum, q) => sum + (q.maxScore || 20), 0);
    const normalized100 = maxPoints > 0 ? Math.round((newTotalScore / maxPoints) * 100) : 0;

    const updatedSub: ExamSubmission = {
      ...selectedSub,
      status: "graded",
      gradings: updatedGradings,
      totalScore: normalized100,
      isPassed: normalized100 >= exam.passingGrade,
    };

    onUpdateSubmission(updatedSub);
    setSelectedSub(updatedSub);
    alert("Penyesuaian nilai guru berhasil disimpan!");
  };

  const handleExportCSV = () => {
    if (examSubmissions.length === 0) {
      alert("Belum ada data siswa yang mengumpulkan ujian.");
      return;
    }

    const headers = [
      "Nama Siswa",
      "Kelas",
      "Nilai Akhir",
      "Status",
      "Jumlah Pelanggaran",
      "Rincian Pelanggaran",
      "Waktu Pengumpulan",
    ];
    const rows = examSubmissions.map((s) => {
      const summary = summarizeViolations(s.violationLogs);
      const detail = summary.topCategories
        .map((c) => `${c.category.label} (${c.count}x)`)
        .join(" | ");
      return [
        `"${s.studentName}"`,
        `"${s.studentClassName}"`,
        s.totalScore,
        s.isPassed ? "LULUS" : "REMEDIAL",
        s.violationCount || 0,
        `"${detail || "Tidak ada pelanggaran"}"`,
        `"${s.submittedAt ? new Date(s.submittedAt).toLocaleString("id-ID") : "Sedang Mengerjakan"}"`,
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Hasil_Ujian_${exam.subject}_${exam.targetClassName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span>Hasil & Lembar Jawaban Siswa</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {exam.title}
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Mata Pelajaran: <span className="font-semibold text-slate-700">{exam.subject}</span> • Kelas: <span className="font-semibold text-slate-700">{exam.targetClassName}</span> • KKM: <span className="font-semibold text-slate-700">{exam.passingGrade}</span> • Total Mengumpulkan: <span className="font-bold text-indigo-600">{examSubmissions.length} Siswa</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isGradingAll || examSubmissions.length === 0}
              onClick={handleGradeAllAI}
              className="px-3.5 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5 transition disabled:opacity-50"
              title="Evaluasi ulang semua lembar jawaban dengan AI"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isGradingAll ? "animate-spin" : ""}`} />
              {isGradingAll ? "Mengevaluasi AI..." : "Evaluasi Semua dengan AI"}
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 shadow-sm flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" />
              Ekspor CSV
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedSub ? (
            /* Detailed submission review view */
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedSub(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-xl transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Kembali ke Daftar Siswa
                </button>

                <button
                  type="button"
                  disabled={isGradingSingle}
                  onClick={handleEvaluateSingleAI}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isGradingSingle ? "animate-spin" : ""}`} />
                  {isGradingSingle ? "Menilai AI..." : "Nilai Ulang dengan AI"}
                </button>
              </div>

              {/* Student overview banner */}
              <div className="bg-slate-900 text-white rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold">{selectedSub.studentName}</h3>
                  <p className="text-xs text-slate-300">
                    {selectedSub.studentClassName} • Dikumpulkan: {selectedSub.submittedAt ? new Date(selectedSub.submittedAt).toLocaleString("id-ID") : "Draf / Sedang Mengerjakan"}
                  </p>
                  <p className="text-xs text-amber-300 mt-1 font-mono">
                    Pelanggaran Pengawasan: {selectedSub.violationCount || 0} Kali Terdeteksi
                  </p>
                </div>

                <div className="flex items-center gap-4 bg-slate-800/90 px-4 py-3 rounded-xl border border-slate-700">
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Nilai AI</span>
                    <span className="text-2xl font-black text-white">{selectedSub.totalScore}</span>
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      selectedSub.isPassed ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                    }`}
                  >
                    {selectedSub.isPassed ? "LULUS" : "REMEDIAL"}
                  </span>
                </div>
              </div>

              {/* Audit pelanggaran: apa yang dilakukan siswa */}
              {selectedViolationAudit.length > 0 && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      Audit Pelanggaran: {selectedViolationAudit.length} Kejadian
                    </h4>
                    <span className="text-[10px] font-bold text-rose-700">
                      {selectedViolationSummary}
                    </span>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {selectedViolationAudit.map((row) => (
                      <div
                        key={`${row.log.timestamp}-${row.index}`}
                        className="bg-white border border-rose-100 rounded-xl p-3 text-xs space-y-1"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-slate-900">{row.category.label}</span>
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded border border-rose-200 bg-rose-100 text-rose-800">
                            {SEVERITY_LABEL[row.severity]}
                          </span>
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-600">
                            {SOURCE_LABEL[row.source]}
                          </span>
                        </div>
                        <p className="text-slate-700 leading-relaxed">
                          {row.log.detail || row.log.reason}
                        </p>
                        {row.log.evidence && (
                          <p className="text-[10px] text-slate-500 font-mono">
                            Bukti: {row.log.evidence}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-400 font-mono">
                          {row.timeLabel}
                          {row.elapsedLabel !== "-" ? ` • ${row.elapsedLabel}` : ""}
                          {row.questionLabel !== "-" ? ` • ${row.questionLabel}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Question review list */}
              <div className="space-y-5">
                {exam.questions.map((q, idx) => {
                  const isMC = q.type === "pg";
                  const g = (selectedSub.gradings || {})[q.id];
                  const studentAns = getAnswerForQuestion(q, idx, selectedSub.answers) || "(Tidak dijawab)";

                  return (
                    <div key={q.id} className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                            Soal #{idx + 1} (Bobot: {q.maxScore || 20} Poin)
                          </span>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                            isMC ? "bg-amber-100 text-amber-800" : "bg-indigo-100 text-indigo-800"
                          }`}>
                            {isMC ? "Pilihan Ganda" : "Soal Uraian"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-600">Nilai Siswa:</span>
                          <input
                            type="number"
                            min={0}
                            max={q.maxScore || 20}
                            value={adjustmentScores[q.id] !== undefined ? adjustmentScores[q.id] : (g?.scoreAwarded || 0)}
                            onChange={(e) =>
                              setAdjustmentScores({ ...adjustmentScores, [q.id]: Number(e.target.value) })
                            }
                            className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-black text-center text-slate-900"
                          />
                          <span className="text-xs text-slate-500">/ {q.maxScore || 20}</span>
                        </div>
                      </div>

                      <p className="text-sm font-semibold text-slate-900">{q.question}</p>

                      {/* Multiple choice review */}
                      {isMC && q.options ? (
                        <div className="space-y-1.5 pt-1">
                          <strong className="block text-slate-500 text-xs mb-1">Opsi & Jawaban Siswa:</strong>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {q.options.map((opt) => {
                              const isSelected = (studentAns || "").trim().toUpperCase() === (opt.label || "").trim().toUpperCase();
                              const isCorrect = (opt.label || "").trim().toUpperCase() === (q.correctAnswer || "").trim().toUpperCase();
                              let borderClass = "border-slate-200 bg-white text-slate-700";
                              if (isSelected && isCorrect) {
                                borderClass = "border-emerald-500 bg-emerald-50 text-emerald-900 font-bold";
                              } else if (isSelected && !isCorrect) {
                                borderClass = "border-rose-400 bg-rose-50 text-rose-800 font-semibold";
                              } else if (isCorrect) {
                                borderClass = "border-emerald-300 bg-emerald-50/50 text-emerald-800";
                              }

                              return (
                                <div key={opt.label} className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${borderClass}`}>
                                  <span>
                                    <strong className="mr-1.5">{opt.label}.</strong>
                                    {opt.text}
                                  </span>
                                  <div className="flex items-center gap-1 text-[10px] uppercase font-bold shrink-0">
                                    {isSelected && <span className={isCorrect ? "text-emerald-700" : "text-rose-600"}>[Dipilih Siswa]</span>}
                                    {isCorrect && <span className="text-emerald-700">✓ Kunci</span>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap">
                            <strong className="block text-slate-500 mb-1">Jawaban Siswa:</strong>
                            {studentAns}
                          </div>

                          {q.answerKey && (
                            <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200/80 text-xs text-emerald-950">
                              <strong className="block text-emerald-800 mb-1">Kunci Jawaban Uraian (Model):</strong>
                              {q.answerKey}
                            </div>
                          )}
                        </>
                      )}

                      {g && (
                        <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100 text-xs space-y-1.5">
                          <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                            <span>
                              {isMC ? "Koreksi Otomatis: " : "Analisis Pencocokan AI: "}
                              (Skor: {g.scoreAwarded}/{q.maxScore || 20})
                            </span>
                          </div>
                          <p className="text-slate-700">{g.feedback}</p>
                          {g.matchedKeyPoints && g.matchedKeyPoints.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              <span className="text-[11px] font-semibold text-emerald-800 mr-1">Kata kunci cocok:</span>
                              {g.matchedKeyPoints.map((k, ki) => (
                                <span key={ki} className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-medium">
                                  ✓ {k}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Teacher Notes */}
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                          Catatan / Umpan Balik Tambahan Guru
                        </label>
                        <input
                          type="text"
                          value={teacherNotes[q.id] || ""}
                          onChange={(e) => setTeacherNotes({ ...teacherNotes, [q.id]: e.target.value })}
                          placeholder="Beri apresiasi atau catatan perbaikan untuk siswa ini..."
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleSaveAdjustment}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition"
                >
                  Simpan Penyesuaian Nilai Guru
                </button>
              </div>
            </div>
          ) : (
            /* Submissions Table */
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    placeholder="Cari nama siswa..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-sm text-slate-500">Belum ada siswa yang mengumpulkan ujian ini.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 border-b border-slate-200 uppercase font-bold text-slate-500 tracking-wider">
                      <tr>
                        <th className="p-3.5">Nama Siswa</th>
                        <th className="p-3.5">Kelas</th>
                        <th className="p-3.5 text-center">Nilai Uraian</th>
                        <th className="p-3.5 text-center">Status</th>
                        <th className="p-3.5 text-center">Pelanggaran</th>
                        <th className="p-3.5 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filtered.map((sub) => (
                        <tr key={sub.id} className="hover:bg-slate-50/70 transition">
                          <td className="p-3.5 font-bold text-slate-900">{sub.studentName}</td>
                          <td className="p-3.5">{sub.studentClassName}</td>
                          <td className="p-3.5 text-center font-black text-slate-900 text-sm">
                            {sub.totalScore}
                          </td>
                          <td className="p-3.5 text-center">
                            <span
                              className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                                sub.isPassed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {sub.isPassed ? "LULUS" : "REMEDIAL"}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                                (sub.violationCount || 0) > 0 ? "bg-rose-100 text-rose-700 font-bold" : "text-slate-400"
                              }`}
                            >
                              {sub.violationCount || 0}x
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(sub)}
                              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-xs inline-flex items-center gap-1 transition"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Detail & Evaluasi
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
