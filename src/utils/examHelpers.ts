import {
  Exam,
  ExamAvailability,
  ExamQuestion,
  ExamType,
  MCQOption,
  QuestionGrading,
  QuestionKind,
} from "../types";

export const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];

/** Normalisasi jawaban pilihan ganda agar perbandingan huruf/teks konsisten. */
export function normalizeChoice(value: string | undefined | null): string {
  return (value || "").trim().toUpperCase().replace(/\s+/g, "");
}

/** Soal tanpa `type` (data lama) dianggap essay. */
export function getQuestionKind(q?: Partial<ExamQuestion> | null): QuestionKind {
  return q?.type === "pg" ? "pg" : "essay";
}

export function isMcqQuestion(q?: Partial<ExamQuestion> | null): boolean {
  return getQuestionKind(q) === "pg";
}

/** Turunkan jenis ujian dari komposisi soal (untuk data lama tanpa examType). */
export function deriveExamType(questions?: ExamQuestion[] | null): ExamType {
  const list = questions || [];
  const hasPg = list.some((q) => isMcqQuestion(q));
  const hasEssay = list.some((q) => !isMcqQuestion(q));
  if (hasPg && hasEssay) return "campuran";
  if (hasPg) return "pg";
  return "essay";
}

export function getExamType(exam: Pick<Exam, "examType" | "questions">): ExamType {
  return exam.examType || deriveExamType(exam.questions);
}

export function examTypeLabel(t: ExamType): string {
  if (t === "pg") return "Pilihan Ganda";
  if (t === "campuran") return "Pilihan Ganda + Essay";
  return "Essay / Uraian";
}

export function defaultMcqOptions(): MCQOption[] {
  return OPTION_LABELS.slice(0, 4).map((label) => ({ label, text: "" }));
}

/** Susun ulang label opsi (A, B, C, ...) setelah penambahan/penghapusan. */
export function relabelOptions(options: MCQOption[]): MCQOption[] {
  return options.map((opt, idx) => ({ ...opt, label: OPTION_LABELS[idx] || opt.label }));
}

/** "B" -> "B. Teks opsi ..." — untuk menampilkan jawaban PG di hasil/review. */
export function describeMcqAnswer(q: ExamQuestion, rawAnswer: string | undefined): string {
  const raw = (rawAnswer || "").trim();
  if (!raw) return "(Tidak dijawab)";
  const opts = q.options || [];
  const byLabel = opts.find((o) => normalizeChoice(o.label) === normalizeChoice(raw));
  if (byLabel) return `${byLabel.label}. ${byLabel.text || "(opsi kosong)"}`;
  const byText = opts.find((o) => o.text.trim() && normalizeChoice(o.text) === normalizeChoice(raw));
  if (byText) return `${byText.label}. ${byText.text}`;
  return raw;
}

/**
 * Koreksi otomatis pilihan ganda: penuh benar (bobot penuh) atau salah (0).
 * Tidak butuh AI — perbandingan langsung terhadap kunci jawaban.
 */
export function gradeMcqQuestion(q: ExamQuestion, studentAnswer: string | undefined): QuestionGrading {
  const maxScore = q.maxScore || 20;
  const raw = (studentAnswer || "").trim();
  const opts = q.options || [];
  const correctLabel = normalizeChoice(q.correctAnswer);

  const chosen = opts.find(
    (o) => normalizeChoice(o.label) === normalizeChoice(raw)
  ) || opts.find((o) => o.text.trim() && normalizeChoice(o.text) === normalizeChoice(raw));
  const correctOpt = opts.find((o) => normalizeChoice(o.label) === correctLabel);

  const isCorrect = Boolean(chosen && correctOpt && normalizeChoice(chosen.label) === correctLabel);
  const kunciText = correctOpt ? `${correctOpt.label}. ${correctOpt.text}` : "(kunci belum ditetapkan)";

  let feedback: string;
  if (!raw) {
    feedback = `Belum dijawab. Kunci jawaban: ${kunciText}`;
  } else if (isCorrect) {
    feedback = `Benar! Jawaban siswa sesuai kunci jawaban (${correctOpt?.label}).`;
  } else {
    feedback = `Salah. Kunci jawaban: ${kunciText}. Jawaban siswa: ${describeMcqAnswer(q, raw)}`;
  }

  return {
    questionId: q.id,
    studentAnswer: raw,
    scoreAwarded: isCorrect ? maxScore : 0,
    maxScore,
    percentage: isCorrect ? 100 : 0,
    matchedKeyPoints: isCorrect && correctOpt ? [`Kunci jawaban: ${kunciText}`] : [],
    missingKeyPoints: !isCorrect && correctOpt ? [`Kunci jawaban: ${kunciText}`] : [],
    feedback,
    isCorrect,
  };
}

export function getExamAvailability(exam: Exam, hasSubmitted: boolean): {
  status: ExamAvailability;
  label: string;
  badgeClass: string;
  canTake: boolean;
  timeNote: string;
} {
  if (exam.status === "draft") {
    return {
      status: "draft",
      label: "Draf (Belum Rilis)",
      badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
      canTake: false,
      timeNote: "Hanya guru yang dapat mempratinjau ujian ini",
    };
  }

  if (hasSubmitted) {
    return {
      status: "already_completed",
      label: "Sudah Dikerjakan (1x Selesai)",
      badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
      canTake: false,
      timeNote: "Ujian telah selesai. Nilai dan evaluasi uraian sudah tersedia.",
    };
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = (exam.startTime || "00:00").split(":").map(Number);
  const startTotalMinutes = (startH || 0) * 60 + (startM || 0);

  const [endH, endM] = (exam.endTime || "23:59").split(":").map(Number);
  const endTotalMinutes = (endH || 0) * 60 + (endM || 0);

  if (exam.examDate > todayStr) {
    return {
      status: "upcoming",
      label: "Akan Datang",
      badgeClass: "bg-sky-100 text-sky-800 border-sky-300",
      canTake: false,
      timeNote: `Dijadwalkan untuk ${exam.examDate} pukul ${exam.startTime} - ${exam.endTime} WIB`,
    };
  }

  if (exam.examDate < todayStr) {
    return {
      status: "ended",
      label: "Sudah Berakhir",
      badgeClass: "bg-slate-100 text-slate-700 border-slate-300",
      canTake: false,
      timeNote: `Jadwal ujian telah berakhir pada ${exam.examDate}`,
    };
  }

  // Same day check
  if (currentMinutes < startTotalMinutes) {
    return {
      status: "upcoming",
      label: "Belum Dimulai",
      badgeClass: "bg-blue-100 text-blue-800 border-blue-300",
      canTake: false,
      timeNote: `Mulai pukul ${exam.startTime} s.d ${exam.endTime} WIB`,
    };
  }

  if (currentMinutes > endTotalMinutes) {
    return {
      status: "ended",
      label: "Waktu Habis",
      badgeClass: "bg-slate-100 text-slate-700 border-slate-300",
      canTake: false,
      timeNote: `Batas waktu pengerjaan berakhir pukul ${exam.endTime} WIB`,
    };
  }

  return {
    status: "active",
    label: "Sedang Berlangsung (Aktif)",
    badgeClass: "bg-green-100 text-green-800 border-green-300 animate-pulse",
    canTake: true,
    timeNote: `Tersedia hari ini: ${exam.startTime} - ${exam.endTime} WIB (${exam.durationMinutes} menit)`,
  };
}

// Web Audio API synthesized sounds (no external audio assets required)
export function playAlertSound(type: "warning" | "violation" | "success" | "click") {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === "violation") {
      // Urgent siren tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === "warning") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.setValueAtTime(680, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === "success") {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C E G C
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.15, ctx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + idx * 0.08 + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.3);
      });
    }
  } catch (err) {
    // Audio context may be restricted before user gesture
  }
}
