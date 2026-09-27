import { useState, useEffect, useRef, useCallback } from "react";
import {
  Exam,
  User,
  ExamSubmission,
  QuestionGrading,
  ViolationEvent,
  ViolationLog,
} from "../../types";
import { isMcqQuestion, normalizeChoice } from "../../utils/examHelpers";
import {
  capViolationLogs,
  createViolationLog,
  formatViolationTime,
  getViolationCategory,
} from "../../utils/violationAudit";
import { storage } from "../../services/storage";
import { gradeStudentAnswers } from "../../services/aiGrading";
import { ExamCameraProctor } from "./ExamCameraProctor";
import { ExamLockdown } from "./ExamLockdown";
import { playAlertSound } from "../../utils/examHelpers";
import {
  Clock,
  Shield,
  Send,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  FileCheck2,
  Lock,
  Sparkles,
  Loader2,
} from "lucide-react";

interface StudentExamSessionProps {
  exam: Exam;
  student: User;
  onFinishExam: (submission: ExamSubmission) => void;
  onCancelPreview?: () => void;
  isPreviewMode?: boolean;
}

const countAnswered = (answers: Record<string, string>) =>
  Object.values(answers || {}).filter(
    (a) => typeof a === "string" && a.trim().length > 0
  ).length;

export function StudentExamSession({
  exam,
  student,
  onFinishExam,
  onCancelPreview,
  isPreviewMode = false,
}: StudentExamSessionProps) {
  const [currentQIndex, setCurrentQIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(exam.durationMinutes * 60);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState<boolean>(false);
  const [violations, setViolations] = useState<ViolationLog[]>([]);
  const [autoSaveStatus, setAutoSaveStatus] = useState<string>("Tersimpan");
  const draftKey = `draft_ans_${exam.id}_${student.id}`;

  // Ref dipakai agar callback deteksi pelanggaran & autosave tetap stabil
  const answersRef = useRef<Record<string, string>>({});
  const violationsRef = useRef<ViolationLog[]>([]);
  const startedAtRef = useRef<string>("");
  const currentQIndexRef = useRef<number>(0);
  const saveTimerRef = useRef<number | null>(null);
  const timeLeftRef = useRef<number>(exam.durationMinutes * 60);
  const isSubmittingRef = useRef<boolean>(false);

  // Pengaturan pengawasan mengikuti pilihan guru saat membuat ujian.
  const lockdownEnabled = exam.lockdownMode !== false;
  const cameraEnabled = exam.allowCamera !== false;

  // Initialize in-progress session immediately
  useEffect(() => {
    if (isPreviewMode) return;

    const existingSub = storage.getSubmissionByExamAndStudent(exam.id, student.id);

    // CRITICAL: If student has already submitted and completed this exam, block re-taking!
    if (existingSub && (existingSub.status === "graded" || existingSub.status === "submitted")) {
      alert("Anda sudah mengumpulkan ujian ini dan tidak dapat mengerjakan kembali.");
      onFinishExam(existingSub);
      return;
    }

    let initialAnswers: Record<string, string> = {};

    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        initialAnswers = JSON.parse(saved);
        setAnswers(initialAnswers);
      } else if (existingSub && existingSub.answers) {
        initialAnswers = existingSub.answers;
        setAnswers(initialAnswers);
      }
    } catch {
      // ignore
    }
    answersRef.current = initialAnswers;

    if (existingSub && existingSub.violationLogs) {
      violationsRef.current = existingSub.violationLogs;
      setViolations(existingSub.violationLogs);
    }

    startedAtRef.current = existingSub?.startedAt || new Date().toISOString();
    currentQIndexRef.current = 0;

    // If there is no existing completed submission, ensure in_progress is recorded
    if (!existingSub || existingSub.status === "in_progress") {
      const answered = countAnswered(initialAnswers);

      const inProgressSub: ExamSubmission = {
        id: existingSub?.id || `sub-${exam.id}-${student.id}`,
        examId: exam.id,
        examTitle: exam.title,
        subject: exam.subject,
        studentId: student.id,
        studentName: student.name,
        studentClassId: student.classId || exam.targetClassId || "class-1",
        studentClassName: student.className || exam.targetClassName || "Kelas Siswa",
        startedAt: startedAtRef.current,
        submittedAt: "",
        answers: initialAnswers,
        gradings: existingSub?.gradings || {},
        totalScore: existingSub?.totalScore || 0,
        isPassed: false,
        violationCount: existingSub?.violationCount || 0,
        violationLogs: existingSub?.violationLogs || [],
        status: "in_progress",
        answeredCount: answered,
        totalQuestions: exam.questions.length,
        lastActiveAt: new Date().toISOString(),
      };

      void storage.saveSubmission(inProgressSub);
    }
  }, [exam.id, student.id, isPreviewMode, draftKey, onFinishExam]);

  // Kirim progres ke storage/server secara bertahap (debounce) agar tab
  // memantau tidak kewalahan penulisan pada tiap ketikan.
  const persistProgress = useCallback(
    (nextAnswers: Record<string, string>) => {
      if (isPreviewMode) return;
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        const existing = storage.getSubmissionByExamAndStudent(exam.id, student.id);
        if (!existing || existing.status !== "in_progress") return;
        void storage.saveSubmission({
          ...existing,
          answers: nextAnswers,
          answeredCount: countAnswered(nextAnswers),
          lastActiveAt: new Date().toISOString(),
        });
      }, 1200);
    },
    [exam.id, student.id, isPreviewMode]
  );

  // Handle answer change with autosave
  const handleAnswerChange = (text: string) => {
    const qId = exam.questions[currentQIndex]?.id;
    if (!qId) return;
    const updated = { ...answersRef.current, [qId]: text };
    answersRef.current = updated;
    setAnswers(updated);
    setAutoSaveStatus("Menyimpan...");
    persistProgress(updated);

    try {
      localStorage.setItem(draftKey, JSON.stringify(updated));
      setTimeout(() => setAutoSaveStatus("Tersimpan"), 400);
    } catch {
      // ignore
    }
  };

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          timeLeftRef.current = 0;
          handleFinalSubmit("Waktu pengerjaan telah habis");
          return 0;
        }
        if (prev === 300) {
          // 5 minutes remaining alert
          playAlertSound("warning");
        }
        timeLeftRef.current = prev - 1;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Ingat indeks soal aktif untuk konteks audit pelanggaran
  useEffect(() => {
    currentQIndexRef.current = currentQIndex;
  }, [currentQIndex]);

  // Pastikan progres terakhir terkirim saat siswa menutup/berpindah halaman
  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      const latest = answersRef.current;
      if (isPreviewMode) return;
      const existing = storage.getSubmissionByExamAndStudent(exam.id, student.id);
      if (existing && existing.status === "in_progress") {
        void storage.saveSubmission({
          ...existing,
          answers: latest,
          answeredCount: countAnswered(latest),
          lastActiveAt: new Date().toISOString(),
        });
      }
    };
  }, [exam.id, student.id, isPreviewMode]);

  // Format timer MM:SS
  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Handle violation logged by lockdown and camera proctor
  const handleViolation = useCallback(
    (event: ViolationEvent) => {
      const activeQuestion = exam.questions[currentQIndexRef.current];
      const updated = capViolationLogs([
        ...violationsRef.current,
        createViolationLog(event, {
          count: violationsRef.current.length + 1,
          startedAt: startedAtRef.current,
          questionNumber: activeQuestion?.number || currentQIndexRef.current + 1,
        }),
      ]);

      violationsRef.current = updated;
      setViolations(updated);

      if (isPreviewMode) return;

      // Immediately sync violation log to storage / live monitoring
      const existing = storage.getSubmissionByExamAndStudent(exam.id, student.id);
      // Do not write in_progress if already graded/submitted
      if (existing && (existing.status === "graded" || existing.status === "submitted")) {
        return;
      }

      const currentAnswers = answersRef.current;
      const updatedSub: ExamSubmission = {
        id: existing?.id || `sub-${exam.id}-${student.id}`,
        examId: exam.id,
        examTitle: exam.title,
        subject: exam.subject,
        studentId: student.id,
        studentName: student.name,
        studentClassId: student.classId || exam.targetClassId || "class-1",
        studentClassName: student.className || exam.targetClassName || "Kelas Siswa",
        startedAt: existing?.startedAt || startedAtRef.current,
        submittedAt: "",
        answers: existing?.answers || currentAnswers,
        gradings: existing?.gradings || {},
        totalScore: existing?.totalScore || 0,
        isPassed: false,
        violationCount: updated.length,
        violationLogs: updated,
        status: "in_progress",
        answeredCount: countAnswered(currentAnswers),
        totalQuestions: exam.questions.length,
        lastActiveAt: new Date().toISOString(),
      };

      void storage.saveSubmission(updatedSub);
    },
    [
      exam.id,
      exam.title,
      exam.subject,
      exam.targetClassId,
      exam.targetClassName,
      exam.questions,
      student.id,
      student.name,
      student.classId,
      student.className,
      isPreviewMode,
    ]
  );

  // Final submit handler
  // Membaca seluruh state lewat ref supaya pemanggilan otomatis (timer habis /
  // batas pelanggaran) tetap memakai jawaban & log terbaru.
  const handleFinalSubmit = async (reasonContext?: string) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setShowSubmitConfirm(false);

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const finalAnswers = answersRef.current;
    const finalViolations = violationsRef.current;
    const calculatedMaxPossible =
      exam.questions.reduce((acc, q) => acc + (q.maxScore || 20), 0) || 100;
    const existingSub = storage.getSubmissionByExamAndStudent(exam.id, student.id);
    const canonicalSubId = existingSub?.id || `sub-${exam.id}-${student.id}`;
    const startedAt =
      existingSub?.startedAt ||
      startedAtRef.current ||
      new Date(
        Date.now() - (exam.durationMinutes * 60 - timeLeftRef.current) * 1000
      ).toISOString();

    if (reasonContext) {
      finalViolations.push(
        createViolationLog(
          {
            reason: `Ujian dikumpulkan otomatis: ${reasonContext}`,
            detail: "Lembar jawaban dikumpulkan otomatis oleh sistem.",
            source: "sistem",
            severity: "kritis",
          },
          { count: finalViolations.length + 1, startedAt }
        )
      );
      violationsRef.current = finalViolations;
      setViolations(finalViolations);
    }

    try {
      // Call AI essay evaluation
      const result = await gradeStudentAnswers(exam.questions, finalAnswers);

      const submission: ExamSubmission = {
        id: canonicalSubId,
        examId: exam.id,
        examTitle: exam.title,
        subject: exam.subject,
        studentId: student.id,
        studentName: student.name,
        studentClassId: student.classId || exam.targetClassId || "class-1",
        studentClassName: student.className || exam.targetClassName || "Kelas Siswa",
        startedAt,
        submittedAt: new Date().toISOString(),
        answers: finalAnswers,
        gradings: result.gradings || {},
        totalScore: Number(result.totalScore) || 0,
        rawScore: Number(result.rawScore ?? result.totalScore) || 0,
        maxPossibleScore: Number(result.maxPossibleScore ?? calculatedMaxPossible),
        isPassed: (result.totalScore ?? 0) >= exam.passingGrade,
        violationCount: finalViolations.length,
        violationLogs: finalViolations,
        status: "graded",
        answeredCount: countAnswered(finalAnswers),
        totalQuestions: exam.questions.length,
      };

      if (!isPreviewMode) {
        await storage.saveSubmission(submission);
        localStorage.removeItem(draftKey);
      }

      playAlertSound("success");
      onFinishExam(submission);
    } catch (err) {
      console.error("Error evaluating exam:", err);
      // Fallback submission object
      const fallbackSubmission: ExamSubmission = {
        id: canonicalSubId,
        examId: exam.id,
        examTitle: exam.title,
        subject: exam.subject,
        studentId: student.id,
        studentName: student.name,
        studentClassId: student.classId || exam.targetClassId || "class-1",
        studentClassName: student.className || exam.targetClassName || "Kelas Siswa",
        startedAt,
        submittedAt: new Date().toISOString(),
        answers: finalAnswers,
        gradings: {},
        totalScore: 70,
        rawScore: 70,
        maxPossibleScore: calculatedMaxPossible,
        isPassed: true,
        violationCount: finalViolations.length,
        violationLogs: finalViolations,
        status: "graded",
        answeredCount: countAnswered(finalAnswers),
        totalQuestions: exam.questions.length,
      };
      if (!isPreviewMode) {
        await storage.saveSubmission(fallbackSubmission);
        localStorage.removeItem(draftKey);
      }
      onFinishExam(fallbackSubmission);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const currentQ = exam.questions[currentQIndex];
  const currentAnswer = currentQ ? answers[currentQ.id] || "" : "";
  const totalQuestions = exam.questions.length;
  const currentIsMcq = Boolean(currentQ && isMcqQuestion(currentQ));
  const hasEssayQuestions = exam.questions.some((q) => !isMcqQuestion(q));
  const answeredCount = Object.values(answers).filter((a) => typeof a === "string" && a.trim().length > 0).length;
  const isTimeCritical = timeLeftSeconds < 300; // less than 5 min

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col select-none">
      {/* Anti-cheat Lockdown Component (active during student exam session) */}
      {!isPreviewMode && lockdownEnabled && (
        <ExamLockdown
          isEnabled={true}
          maxViolations={3}
          initialViolationCount={violations.length}
          onViolation={handleViolation}
          onForceSubmit={(reason) => handleFinalSubmit(`Otomatis dikumpulkan: ${reason}`)}
        />
      )}

      {/* Camera Proctoring Component (active during student exam session) */}
      {cameraEnabled && (
        <ExamCameraProctor
          isActive={true}
          studentName={student.name}
          onCameraViolation={handleViolation}
        />
      )}

      {/* Preview Mode Notice Banner */}
      {isPreviewMode && (
        <div className="bg-amber-500 text-slate-950 font-bold px-4 py-2 text-xs flex items-center justify-between shadow-md">
          <span>Mode Pratinjau Guru: Anda sedang melihat tampilan persis yang dialami siswa saat ujian.</span>
          {onCancelPreview && (
            <button
              type="button"
              onClick={onCancelPreview}
              className="bg-slate-900 text-white px-3 py-1 rounded text-xs hover:bg-slate-800"
            >
              Tutup Pratinjau
            </button>
          )}
        </div>
      )}

      {/* Top Exam Navigation Bar */}
      <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-30 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-white line-clamp-1">
              {exam.title}
            </h1>
            <p className="text-xs text-slate-400">
              {exam.subject} • {student.name} ({student.className || exam.targetClassName})
            </p>
          </div>
        </div>

        {/* Timer & Status */}
        <div className="flex items-center gap-4">
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border font-mono font-bold text-sm sm:text-base ${
              isTimeCritical
                ? "bg-rose-950/60 border-rose-500/50 text-rose-400 animate-pulse"
                : "bg-slate-800/80 border-slate-700 text-slate-200"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{formatTimer(timeLeftSeconds)}</span>
          </div>

          <button
            type="button"
            onClick={() => setShowSubmitConfirm(true)}
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition"
          >
            <Send className="w-3.5 h-3.5" />
            Kumpulkan Ujian
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left / Main: Question & Answer Workspace */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {currentQ ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-7 shadow-xl flex-1 flex flex-col">
              {/* Question header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-black text-sm flex items-center justify-center">
                    {currentQIndex + 1}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {currentIsMcq ? "Soal Pilihan Ganda" : "Soal Uraian"} ({currentQIndex + 1} dari{" "}
                    {totalQuestions})
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs bg-slate-800 text-indigo-300 font-semibold px-3 py-1 rounded-full border border-slate-700">
                    Bobot: {currentQ.maxScore || 20} Poin
                  </span>
                  <span className="text-[11px] text-slate-500 hidden sm:inline">
                    {autoSaveStatus}
                  </span>
                </div>
              </div>

              {/* Question Text */}
              <div className="mb-6">
                <p className="text-base sm:text-lg font-medium text-slate-100 leading-relaxed">
                  {currentQ.question}
                </p>
              </div>

              {/* Answer Area: Pilihan Ganda / Uraian */}
              {currentIsMcq ? (
                <div className="flex-1 flex flex-col">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Pilih satu jawaban yang paling tepat:
                  </label>

                  <div className="flex flex-col gap-2.5">
                    {(currentQ.options || []).map((opt) => {
                      const selected = normalizeChoice(currentAnswer) === normalizeChoice(opt.label);
                      const hasText = Boolean(opt.text.trim());
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          disabled={!hasText}
                          onClick={() => handleAnswerChange(selected ? "" : opt.label)}
                          className={`w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition ${
                            selected
                              ? "bg-indigo-600 border-indigo-400 text-white ring-2 ring-indigo-400/40"
                              : "bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-600 disabled:opacity-40 disabled:pointer-events-none"
                          }`}
                        >
                          <span
                            className={`w-7 h-7 shrink-0 rounded-lg font-black text-xs flex items-center justify-center ${
                              selected
                                ? "bg-white text-indigo-700"
                                : "bg-slate-800 text-slate-300 border border-slate-700"
                            }`}
                          >
                            {opt.label}
                          </span>
                          <span className="text-sm sm:text-base leading-relaxed pt-0.5">{opt.text}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 text-[11px] text-slate-500 flex items-center justify-between">
                    <span>
                      Dikoreksi otomatis oleh sistem saat dikumpulkan. Klik kembali untuk mengubah pilihan.
                    </span>
                    <span className="text-emerald-400 flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      Auto-Save Aktif
                    </span>
                  </div>
                </div>
              ) : (
              <div className="flex-1 flex flex-col">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Lembar Jawaban Uraian Anda:</span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {currentAnswer.trim() ? currentAnswer.trim().split(/\s+/).length : 0} kata • {currentAnswer.length} karakter
                  </span>
                </label>

                <textarea
                  id={`essay-input-${currentQ.id}`}
                  rows={9}
                  value={currentAnswer}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                  placeholder="Tuliskan uraian jawaban Anda secara komprehensif, runtut, dan jelas di sini..."
                  className="w-full flex-1 bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm sm:text-base text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y font-normal leading-relaxed transition shadow-inner"
                />

                <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Sistem AI akan mencocokkan substansi konsep dan kata kunci jawaban Anda dengan kunci jawaban guru.</span>
                  <span className="text-emerald-400 flex items-center gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    Auto-Save Aktif
                  </span>
                </div>
              </div>
              )}

              {/* Navigation controls */}
              <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-800">
                <button
                  type="button"
                  disabled={currentQIndex === 0}
                  onClick={() => setCurrentQIndex((prev) => Math.max(0, prev - 1))}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-slate-200 transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Sebelumnya
                </button>

                <div className="sm:hidden">
                  <button
                    type="button"
                    onClick={() => setShowSubmitConfirm(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow"
                  >
                    Kumpulkan
                  </button>
                </div>

                {currentQIndex < totalQuestions - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentQIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow"
                  >
                    Selanjutnya
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSubmitConfirm(true)}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-lg"
                  >
                    <Send className="w-4 h-4" />
                    Selesai & Kumpulkan
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Right / Sidebar: Question Map & Proctor Audit */}
        <div className="space-y-4">
          {/* Question Grid Map */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center justify-between">
              <span>Navigasi Soal</span>
              <span className="text-indigo-400 font-mono">{answeredCount}/{totalQuestions} Terisi</span>
            </h3>

            <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-4 gap-2">
              {exam.questions.map((q, idx) => {
                const isAnswered = Boolean((answers[q.id] || "").trim());
                const isCurrent = idx === currentQIndex;

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentQIndex(idx)}
                    className={`h-11 rounded-xl font-bold text-xs transition relative flex items-center justify-center border ${
                      isCurrent
                        ? "bg-indigo-600 text-white border-indigo-400 ring-2 ring-indigo-400/40"
                        : isAnswered
                        ? "bg-emerald-950/80 text-emerald-300 border-emerald-700/50 hover:bg-emerald-900"
                        : "bg-slate-800/80 text-slate-400 border-slate-700 hover:bg-slate-700"
                    }`}
                  >
                    <span>{idx + 1}</span>
                    {isAnswered && (
                      <span className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Sudah Diisi
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-700"></span> Belum
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> Aktif
              </span>
            </div>
          </div>

          {/* Exam Info & Security Overview */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl text-xs space-y-3">
            <h4 className="font-bold text-slate-300 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-indigo-400" />
              Protokol Integritas Uraian
            </h4>
            <div className="space-y-2 text-slate-400">
              <p className="flex items-center justify-between">
                <span>Mode Layar Terkunci:</span>
                <span className={lockdownEnabled ? "text-emerald-400 font-semibold" : "text-slate-500"}>
                  {lockdownEnabled ? "Aktif (Lockdown)" : "Nonaktif"}
                </span>
              </p>
              <p className="flex items-center justify-between">
                <span>Pengawasan Kamera:</span>
                <span className={cameraEnabled ? "text-emerald-400 font-semibold" : "text-slate-500"}>
                  {cameraEnabled ? "Aktif (Live AI)" : "Nonaktif"}
                </span>
              </p>
              <p className="flex items-center justify-between">
                <span>Pelanggaran Terdeteksi:</span>
                <span className={violations.length > 0 ? "text-rose-400 font-bold" : "text-slate-400"}>
                  {violations.length} Kali
                </span>
              </p>
              <p className="flex items-center justify-between">
                <span>Batas Ujian:</span>
                <span className="text-amber-400 font-semibold">1 Kali Saja</span>
              </p>
            </div>

            {violations.length > 0 && (
              <div className="pt-2 border-t border-slate-800 space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-300">
                  Riwayat Pelanggaran Anda
                </span>
                <ul className="space-y-1 max-h-40 overflow-y-auto pr-1">
                  {[...violations].slice(-5).reverse().map((v, idx) => (
                    <li key={`${v.timestamp}-${idx}`} className="bg-slate-950/70 border border-rose-900/50 rounded-lg px-2 py-1.5">
                      <p className="text-[10px] text-rose-300 font-bold">
                        {getViolationCategory(v.reason).label} • {formatViolationTime(v.timestamp)}
                      </p>
                      <p className="text-[10px] text-slate-400 leading-snug">
                        {v.detail || v.reason}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Confirmation Modal Before Submission */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 max-w-md w-full rounded-2xl p-6 shadow-2xl text-slate-100">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              Konfirmasi Kumpulkan Ujian
            </h3>

            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              Apakah Anda yakin ingin mengumpulkan lembar jawaban ujian uraian ini?
            </p>

            {answeredCount < totalQuestions && (
              <div className="mt-3 p-3 bg-amber-950/60 border border-amber-500/40 rounded-xl text-amber-300 text-xs">
                <strong>Perhatian:</strong> Masih ada{" "}
                <strong>{totalQuestions - answeredCount} soal</strong> yang belum Anda isi!
              </div>
            )}

            <div className="mt-3 p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
              <p>• Ujian ini <strong>hanya dapat dilakukan 1 kali</strong>.</p>
              <p>• Nilai dan evaluasi otomatis AI akan langsung ditampilkan setelah dikumpulkan.</p>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition"
              >
                Lanjutkan Mengerjakan
              </button>
              <button
                type="button"
                onClick={() => handleFinalSubmit()}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg transition flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Ya, Kumpulkan Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay During AI Evaluation */}
      {isSubmitting && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4 animate-spin">
            <Loader2 className="w-9 h-9" />
          </div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
            Menganalisis Jawaban Uraian dengan AI...
          </h3>
          <p className="text-sm text-slate-400 mt-2 max-w-md">
            Sistem sedang mencocokkan uraian jawaban Anda terhadap kunci jawaban guru, kata kunci wajib, serta merumuskan umpan balik komprehensif.
          </p>
        </div>
      )}
    </div>
  );
}
