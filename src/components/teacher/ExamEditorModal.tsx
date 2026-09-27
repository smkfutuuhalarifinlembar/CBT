import { useState } from "react";
import { Exam, ExamQuestion, ExamType, QuestionKind, ClassRoom, User } from "../../types";
import {
  OPTION_LABELS,
  defaultMcqOptions,
  deriveExamType,
  isMcqQuestion,
  relabelOptions,
} from "../../utils/examHelpers";
import { downloadQuestionTemplateXlsx } from "../../utils/excelQuestionImport";
import { BulkQuestionUploadModal } from "./BulkQuestionUploadModal";
import {
  X,
  Plus,
  Trash2,
  Eye,
  Save,
  CheckCircle2,
  Clock,
  Sparkles,
  HelpCircle,
  Camera,
  Lock,
  Upload,
  Download,
  FileSpreadsheet,
  ListChecks,
  AlignLeft,
  Layers,
} from "lucide-react";

interface ExamEditorModalProps {
  examToEdit: Exam | null;
  classes: ClassRoom[];
  currentUser: User;
  onSave: (exam: Exam, shouldPublish: boolean) => void;
  onPreview: (exam: Exam) => void;
  onClose: () => void;
}

export function ExamEditorModal({
  examToEdit,
  classes,
  currentUser,
  onSave,
  onPreview,
  onClose,
}: ExamEditorModalProps) {
  const [title, setTitle] = useState<string>(examToEdit?.title || "");
  const [subject, setSubject] = useState<string>(examToEdit?.subject || "Biologi");
  const [targetClassId, setTargetClassId] = useState<string>(
    examToEdit?.targetClassId || classes[0]?.id || "XII-IPA-1"
  );
  const [examDate, setExamDate] = useState<string>(
    examToEdit?.examDate || new Date().toISOString().split("T")[0]
  );
  const [startTime, setStartTime] = useState<string>(examToEdit?.startTime || "08:00");
  const [endTime, setEndTime] = useState<string>(examToEdit?.endTime || "12:00");
  const [durationMinutes, setDurationMinutes] = useState<number>(examToEdit?.durationMinutes || 60);
  const [passingGrade, setPassingGrade] = useState<number>(examToEdit?.passingGrade || 75);
  const [allowCamera, setAllowCamera] = useState<boolean>(examToEdit ? examToEdit.allowCamera : true);
  const [lockdownMode, setLockdownMode] = useState<boolean>(examToEdit ? examToEdit.lockdownMode : true);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState<boolean>(false);
  const [examType, setExamType] = useState<ExamType>(
    examToEdit?.examType || deriveExamType(examToEdit?.questions || [])
  );

  const [questions, setQuestions] = useState<ExamQuestion[]>(
    examToEdit?.questions && examToEdit.questions.length > 0
      ? examToEdit.questions
      : [
          {
            id: `q-${Date.now()}-1`,
            number: 1,
            question: "",
            answerKey: "",
            keywords: [],
            rubricGuide: "",
            maxScore: 25,
          },
        ]
  );

  const [keywordInputs, setKeywordInputs] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    (examToEdit?.questions || []).forEach((q) => {
      initial[q.id] = (q.keywords || []).join(", ");
    });
    return initial;
  });

  const handleImportQuestions = (newQuestions: ExamQuestion[], mode: "replace" | "append") => {
    let finalQuestions: ExamQuestion[];
    if (mode === "replace" || questions.length === 0) {
      finalQuestions = newQuestions.map((q, idx) => ({ ...q, number: idx + 1 }));
    } else {
      // If the only question was an empty placeholder
      const isSingleEmpty =
        questions.length === 1 && !questions[0].question.trim() && !questions[0].answerKey.trim();
      if (isSingleEmpty) {
        finalQuestions = newQuestions.map((q, idx) => ({ ...q, number: idx + 1 }));
      } else {
        const combined = [...questions, ...newQuestions];
        finalQuestions = combined.map((q, idx) => ({ ...q, number: idx + 1 }));
      }
    }
    setQuestions(finalQuestions);

    const newKwInputs: Record<string, string> = { ...keywordInputs };
    finalQuestions.forEach((q) => {
      newKwInputs[q.id] = (q.keywords || []).join(", ");
    });
    setKeywordInputs(newKwInputs);
  };

  const handleDownloadTemplate = () => {
    void downloadQuestionTemplateXlsx({
      filename:
        examType === "campuran" ? "template_soal_ujian.xlsx" : "template_soal_uraian_guru.xlsx",
      kinds: examType === "campuran" ? ["pg", "essay"] : ["essay"],
    });
  };


  const createQuestion = (kind: QuestionKind, number: number): ExamQuestion => {
    const id = `q-${Date.now()}-${number}-${Math.random().toString(36).substring(2, 6)}`;
    if (kind === "pg") {
      return {
        id,
        number,
        type: "pg",
        question: "",
        answerKey: "",
        keywords: [],
        rubricGuide: "",
        maxScore: 20,
        options: defaultMcqOptions(),
        correctAnswer: "",
      };
    }
    return {
      id,
      number,
      type: "essay",
      question: "",
      answerKey: "",
      keywords: [],
      rubricGuide: "",
      maxScore: 25,
      options: [],
      correctAnswer: "",
    };
  };

  const handleAddQuestion = (kind?: QuestionKind) => {
    const effective: QuestionKind = kind || (examType === "pg" ? "pg" : "essay");
    const newQ = createQuestion(effective, questions.length + 1);
    setQuestions([...questions, newQ]);
    setKeywordInputs((prev) => ({ ...prev, [newQ.id]: "" }));
  };

  // Ganti jenis ujian: soal terisi tidak diubah paksa (divalidasi saat publikasi),
  // hanya placeholder kosong yang ikut dikonversi ke jenis baru.
  const handleExamTypeChange = (next: ExamType) => {
    setExamType(next);
    if (next === "campuran") return;
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.question.trim()) return q;
        return next === "pg"
          ? {
              ...q,
              type: "pg" as const,
              options: q.options && q.options.length > 0 ? q.options : defaultMcqOptions(),
              correctAnswer: q.correctAnswer || "",
              keywords: [],
              rubricGuide: "",
            }
          : { ...q, type: "essay" as const, options: [], correctAnswer: "" };
      })
    );
  };

  const handleRemoveQuestion = (id: string) => {
    if (questions.length <= 1) {
      alert("Ujian harus memiliki minimal 1 soal.");
      return;
    }
    const filtered = questions.filter((q) => q.id !== id);
    const renumbered = filtered.map((q, idx) => ({ ...q, number: idx + 1 }));
    setQuestions(renumbered);
  };

  const handleQuestionChange = (id: string, field: keyof ExamQuestion, value: any) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, [field]: value } : q))
    );
  };

  const handleKeywordsChange = (id: string, rawText: string) => {
    setKeywordInputs((prev) => ({ ...prev, [id]: rawText }));
    const kws = rawText
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    handleQuestionChange(id, "keywords", kws);
  };

  /* ---------- Handler soal pilihan ganda ---------- */
  const handleOptionTextChange = (qId: string, optIdx: number, text: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        const opts = (q.options || []).map((o, i) => (i === optIdx ? { ...o, text } : o));
        return { ...q, options: opts };
      })
    );
  };

  const handleToggleCorrectAnswer = (qId: string, label: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        return { ...q, correctAnswer: q.correctAnswer === label ? "" : label };
      })
    );
  };

  const handleAddOption = (qId: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        const opts = q.options || [];
        if (opts.length >= 6) return q;
        return { ...q, options: relabelOptions([...opts, { label: "", text: "" }]) };
      })
    );
  };

  const handleRemoveOption = (qId: string, optIdx: number) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        const opts = q.options || [];
        if (opts.length <= 2) return q;
        const correctIdx = opts.findIndex((o) => o.label === q.correctAnswer);
        const newCorrectIdx =
          correctIdx < 0 ? -1 : correctIdx < optIdx ? correctIdx : correctIdx === optIdx ? -1 : correctIdx - 1;
        const remaining = opts.filter((_, i) => i !== optIdx);
        return {
          ...q,
          options: relabelOptions(remaining),
          correctAnswer: newCorrectIdx >= 0 ? OPTION_LABELS[newCorrectIdx] || "" : "",
        };
      })
    );
  };

  const validateForPublish = (): string | null => {
    const pgCount = questions.filter((q) => isMcqQuestion(q)).length;
    const essayCount = questions.length - pgCount;

    if (examType === "pg" && essayCount > 0) {
      return `Jenis ujian "Pilihan Ganda", tetapi masih ada ${essayCount} soal essay. Hapus soal essay tersebut atau ubah jenis ujian.`;
    }
    if (examType === "essay" && pgCount > 0) {
      return `Jenis ujian "Essay", tetapi masih ada ${pgCount} soal pilihan ganda. Hapus soal tersebut atau ubah jenis ujian.`;
    }
    if (examType === "campuran" && (pgCount === 0 || essayCount === 0)) {
      return "Jenis ujian Campuran membutuhkan minimal 1 soal pilihan ganda dan 1 soal essay.";
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const label = `Soal #${i + 1}`;
      if (!q.question.trim()) return `${label}: teks pertanyaan belum diisi.`;

      if (isMcqQuestion(q)) {
        const opts = q.options || [];
        if (opts.length < 2) return `${label}: pilihan ganda membutuhkan minimal 2 opsi.`;
        if (opts.some((o) => !o.text.trim())) return `${label}: masih ada teks opsi yang kosong.`;
        if (!q.correctAnswer || !opts.some((o) => o.label === q.correctAnswer)) {
          return `${label}: belum menentukan kunci jawaban. Klik lingkaran pada opsi yang benar.`;
        }
      } else if (!q.answerKey.trim()) {
        return `${label}: kunci jawaban uraian wajib diisi.`;
      }
    }
    return null;
  };

  const assembleExam = (status: "draft" | "published"): Exam => {
    const targetClass = classes.find((c) => c.id === targetClassId);
    return {
      id: examToEdit?.id || `exam-${Date.now()}`,
      title: title.trim() || (examType === "pg" ? "Ujian Pilihan Ganda Baru" : examType === "campuran" ? "Ujian Campuran Baru" : "Ujian Uraian Baru"),
      subject: subject.trim() || "Mata Pelajaran",
      targetClassId,
      targetClassName: targetClass ? targetClass.name : "Semua Kelas",
      teacherId: currentUser.id,
      teacherName: currentUser.name,
      examDate,
      startTime,
      endTime,
      durationMinutes: Number(durationMinutes) || 60,
      passingGrade: Number(passingGrade) || 75,
      status,
      examType,
      questions,
      allowCamera,
      lockdownMode,
      createdAt: examToEdit?.createdAt || new Date().toISOString(),
    };
  };

  const handleSaveDraft = () => {
    const exam = assembleExam("draft");
    onSave(exam, false);
  };

  const handlePublish = () => {
    if (!title.trim()) {
      alert("Harap masukkan judul ujian terlebih dahulu.");
      return;
    }
    const error = validateForPublish();
    if (error) {
      alert(`Ujian belum dapat dipublikasikan:\n\n• ${error}`);
      return;
    }
    const exam = assembleExam("published");
    onSave(exam, true);
  };

  const handleTriggerPreview = () => {
    const exam = assembleExam(examToEdit?.status || "draft");
    onPreview(exam);
  };

  const totalMaxScore = questions.reduce((sum, q) => sum + (Number(q.maxScore) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900">
              {examToEdit ? "Edit Soal & Kunci Jawaban Ujian" : "Buat Ujian Baru"}
            </h2>
            <p className="text-xs text-slate-500">
              Pilih jenis ujian, atur soal beserta kuncinya, lalu pratinjau sebelum dipublikasikan.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Exam Type Selector */}
          <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4">
            <label className="text-xs font-bold text-indigo-900 uppercase block mb-2">
              Jenis Ujian *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {([
                {
                  value: "pg" as ExamType,
                  label: "Pilihan Ganda",
                  desc: "Koreksi otomatis instan oleh sistem",
                  Icon: ListChecks,
                },
                {
                  value: "essay" as ExamType,
                  label: "Essay / Uraian",
                  desc: "Koreksi otomatis oleh AI (Gemini)",
                  Icon: Sparkles,
                },
                {
                  value: "campuran" as ExamType,
                  label: "PG + Essay",
                  desc: "Gabungan kedua jenis soal",
                  Icon: Layers,
                },
              ]).map(({ value, label, desc, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleExamTypeChange(value)}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition ${
                    examType === value
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-md ring-2 ring-indigo-300"
                      : "bg-white border-slate-200 hover:border-indigo-300 text-slate-700"
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 shrink-0 mt-0.5 ${
                      examType === value ? "text-indigo-200" : "text-indigo-600"
                    }`}
                  />
                  <span>
                    <span className="block text-sm font-bold">{label}</span>
                    <span
                      className={`block text-[11px] ${
                        examType === value ? "text-indigo-100" : "text-slate-500"
                      }`}
                    >
                      {desc}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-indigo-800/90 mt-2 leading-relaxed">
              {examType === "pg"
                ? "Soal pilihan ganda dikoreksi 100% otomatis saat siswa mengumpulkan — tanpa AI, tanpa tunggu."
                : examType === "campuran"
                ? "Soal PG dikoreksi otomatis oleh sistem, soal essay dikoreksi AI. Nilai digabung dalam satu skala 0–100."
                : "Soal uraian dikoreksi AI (Gemini) dengan pencocokan kunci jawaban dan kata kunci guru."}
            </p>
          </div>

          {/* Metadata Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs font-bold text-slate-700 uppercase mb-1 block">
                Judul Ujian Uraian *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Misal: Penilaian Akhir Semester: Biologi Sel & Genetika"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase mb-1 block">
                Mata Pelajaran *
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Misal: Biologi, Kimia, B. Indonesia"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase mb-1 block">
                Target Kelas *
              </label>
              <select
                value={targetClassId}
                onChange={(e) => setTargetClassId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase mb-1 block">
                Tanggal Ujian *
              </label>
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase mb-1 block">
                Jam Mulai - Selesai *
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-1/2 px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900"
                />
                <span className="text-xs text-slate-400">s/d</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-1/2 px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase mb-1 block">
                Durasi Pengerjaan (Menit)
              </label>
              <input
                type="number"
                min={10}
                max={240}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase mb-1 block">
                KKM Kelulusan
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={passingGrade}
                onChange={(e) => setPassingGrade(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* Security Toggles */}
            <div className="flex flex-col justify-center space-y-2 pt-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowCamera}
                  onChange={(e) => setAllowCamera(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <Camera className="w-3.5 h-3.5 text-indigo-600" />
                Aktifkan Kamera Proctoring
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={lockdownMode}
                  onChange={(e) => setLockdownMode(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <Lock className="w-3.5 h-3.5 text-rose-600" />
                Kunci Layar Siswa (Anti Pindah Tab)
              </label>
            </div>
          </div>

          {/* Question List Section */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>
                    {examType === "pg"
                      ? "Daftar Soal Pilihan Ganda & Kunci Jawaban"
                      : examType === "campuran"
                      ? "Daftar Soal (Pilihan Ganda & Essay)"
                      : "Daftar Soal & Kunci Jawaban Uraian"}
                  </span>
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-semibold border border-indigo-200">
                    Total Bobot: {totalMaxScore} Poin
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  {examType === "pg"
                    ? "Isi teks soal, pilihan jawaban, dan klik lingkaran untuk menandai kunci — koreksi berjalan otomatis."
                    : examType === "campuran"
                    ? "Kelola soal PG (koreksi otomatis) dan soal essay (koreksi AI) dalam satu ujian."
                    : "Tuliskan kunci uraian lengkap serta kata kunci esensial untuk pencocokan otomatis AI."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {examType !== "pg" && (
                  <>
                    <button
                      type="button"
                      onClick={handleDownloadTemplate}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border border-slate-300 shadow-xs"
                      title="Unduh template Excel (.xlsx) untuk membuat banyak soal sekaligus di Excel/Sheets"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                      <span>Template Soal (.xlsx)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowBulkUploadModal(true)}
                      className="px-3 py-1.5 bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-800 hover:to-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
                      title="Impor soal uraian & kunci jawaban massal dari file Excel (.xlsx) atau CSV"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-teal-200" />
                      <span>Upload Massal Soal</span>
                    </button>
                  </>
                )}

                {examType === "campuran" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleAddQuestion("pg")}
                      className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
                    >
                      <ListChecks className="w-3.5 h-3.5" />
                      <span>Tambah Soal PG</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuestion("essay")}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Soal Essay</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAddQuestion()}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
                  >
                    {examType === "pg" ? (
                      <ListChecks className="w-3.5 h-3.5" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    <span>{examType === "pg" ? "Tambah Soal PG" : "Tambah Soal"}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-6">
              {questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4 relative group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow">
                        #{idx + 1}
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                          isMcqQuestion(q)
                            ? "bg-sky-50 text-sky-700 border-sky-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}
                      >
                        {isMcqQuestion(q) ? "Pilihan Ganda" : "Essay"}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        <span>Bobot Nilai:</span>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={q.maxScore}
                          onChange={(e) => handleQuestionChange(q.id, "maxScore", Number(e.target.value))}
                          className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-center"
                        />
                        <span>Poin</span>
                      </div>

                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestion(q.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Hapus Soal"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Question Prompt */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase mb-1 block">
                      {isMcqQuestion(q) ? "Teks Pertanyaan *" : "Teks Pertanyaan Uraian *"}
                    </label>
                    <textarea
                      rows={2}
                      value={q.question}
                      onChange={(e) => handleQuestionChange(q.id, "question", e.target.value)}
                      placeholder={
                        isMcqQuestion(q)
                          ? "Misal: Organ apakah yang berfungsi menyerap cahaya matahari pada tumbuhan?"
                          : "Misal: Jelaskan proses fotosintesis pada tumbuhan dan peranan klorofil..."
                      }
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none leading-relaxed"
                    />
                  </div>

                  {isMcqQuestion(q) && (
                    <>
                      {/* Opsi Pilihan Ganda */}
                      <div className="bg-sky-50/60 p-3.5 rounded-xl border border-sky-200">
                        <div className="flex items-center justify-between mb-2 gap-2">
                          <label className="text-xs font-bold text-sky-900 uppercase flex items-center gap-1.5">
                            <ListChecks className="w-3.5 h-3.5 text-sky-600" />
                            Pilihan Jawaban & Kunci *
                          </label>
                          <button
                            type="button"
                            onClick={() => handleAddOption(q.id)}
                            disabled={(q.options || []).length >= 6}
                            className="px-2 py-1 bg-white hover:bg-sky-100 text-sky-800 text-[11px] font-bold rounded-lg border border-sky-300 transition disabled:opacity-40 flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Opsi
                          </button>
                        </div>

                        <div className="space-y-2">
                          {(q.options || []).map((opt, oi) => {
                            const isKey = (q.correctAnswer || "").toUpperCase() === opt.label;
                            return (
                              <div
                                key={oi}
                                className={`flex items-center gap-2 p-2 rounded-xl border ${
                                  isKey ? "bg-emerald-50 border-emerald-300" : "bg-white border-slate-200"
                                }`}
                              >
                                <button
                                  type="button"
                                  title={`Tandai ${opt.label} sebagai kunci jawaban`}
                                  onClick={() => handleToggleCorrectAnswer(q.id, opt.label)}
                                  className={`w-7 h-7 shrink-0 rounded-full border-2 flex items-center justify-center text-[11px] font-black transition ${
                                    isKey
                                      ? "bg-emerald-600 border-emerald-600 text-white"
                                      : "border-slate-300 text-slate-500 hover:border-emerald-500 hover:text-emerald-600"
                                  }`}
                                >
                                  {isKey ? <CheckCircle2 className="w-4 h-4" /> : opt.label}
                                </button>
                                <input
                                  type="text"
                                  value={opt.text}
                                  onChange={(e) => handleOptionTextChange(q.id, oi, e.target.value)}
                                  placeholder={`Teks pilihan jawaban ${opt.label}...`}
                                  className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                                />
                                {isKey && (
                                  <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200">
                                    KUNCI
                                  </span>
                                )}
                                {(q.options || []).length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveOption(q.id, oi)}
                                    title="Hapus opsi"
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {!q.correctAnswer && (
                          <p className="text-[11px] text-rose-600 font-semibold mt-2">
                            Belum ada kunci jawaban. Klik lingkaran pada opsi yang benar.
                          </p>
                        )}
                      </div>

                      {/* Pembahasan PG (opsional) */}
                      <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200/80">
                        <label className="text-xs font-bold text-emerald-900 uppercase mb-1 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                          Pembahasan Jawaban (Opsional)
                        </label>
                        <textarea
                          rows={2}
                          value={q.answerKey}
                          onChange={(e) => handleQuestionChange(q.id, "answerKey", e.target.value)}
                          placeholder="Jelaskan alasan kunci jawaban ini benar (tampil di hasil siswa)..."
                          className="w-full px-3.5 py-2.5 bg-white border border-emerald-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none leading-relaxed"
                        />
                      </div>
                    </>
                  )}

                  {!isMcqQuestion(q) && (
                    <>
                  {/* Answer Key */}
                  <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200/80">
                    <label className="text-xs font-bold text-emerald-900 uppercase mb-1 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      Kunci Jawaban Uraian (Model Guru) *
                    </label>
                    <textarea
                      rows={3}
                      value={q.answerKey}
                      onChange={(e) => handleQuestionChange(q.id, "answerKey", e.target.value)}
                      placeholder="Tuliskan uraian model jawaban yang diharapkan secara lengkap dan terstruktur..."
                      className="w-full px-3.5 py-2.5 bg-white border border-emerald-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none leading-relaxed"
                    />
                  </div>

                  {/* Keywords & Rubric Guide */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase mb-1 block">
                        Kata Kunci Wajib (Pisahkan dengan koma)
                      </label>
                      <input
                        type="text"
                        value={keywordInputs[q.id] || ""}
                        onChange={(e) => handleKeywordsChange(q.id, e.target.value)}
                        placeholder="contoh: klorofil, cahaya matahari, glukosa, oksigen"
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        AI akan memverifikasi keberadaan konsep kata kunci ini pada jawaban siswa.
                      </span>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase mb-1 block">
                        Panduan Rubrik Tambahan (Opsional)
                      </label>
                      <input
                        type="text"
                        value={q.rubricGuide || ""}
                        onChange={(e) => handleQuestionChange(q.id, "rubricGuide", e.target.value)}
                        placeholder="Misal: Menyebutkan 3 tahapan dapat 15 poin, elaborasi 10 poin"
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/90 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTriggerPreview}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 text-xs sm:text-sm font-bold rounded-xl border border-slate-300 shadow-sm transition flex items-center gap-2"
              title="Coba dan lihat tampilan persis siswa sebelum dipublikasi"
            >
              <Eye className="w-4 h-4 text-indigo-600" />
              Pratinjau (Preview Siswa)
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs sm:text-sm font-bold rounded-xl transition flex items-center gap-1.5"
            >
              <Save className="w-4 h-4 text-slate-600" />
              Simpan sebagai Draf
            </button>

            <button
              type="button"
              onClick={handlePublish}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg transition flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Publikasikan Ujian
            </button>
          </div>
        </div>
        {/* Bulk Question Upload Modal */}
        <BulkQuestionUploadModal
          isOpen={showBulkUploadModal}
          onClose={() => setShowBulkUploadModal(false)}
          onImportQuestions={handleImportQuestions}
          existingQuestionsCount={questions.length}
          allowedKinds={examType === "campuran" ? ["pg", "essay"] : [examType === "pg" ? "pg" : "essay"]}
        />
      </div>
    </div>
  );
}
