import { ExamQuestion, QuestionGrading } from "../types";
import { gradeMcqQuestion, isMcqQuestion } from "../utils/examHelpers";

export interface BatchGradeResponse {
  success: boolean;
  gradings: Record<string, QuestionGrading>;
  totalScore: number;
  rawScore?: number;
  maxPossibleScore?: number;
}

export async function gradeStudentAnswers(
  questions: ExamQuestion[],
  answers: Record<string, string>
): Promise<BatchGradeResponse> {
  try {
    const res = await fetch("/api/grade-exam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions, answers }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.gradings) {
        return data;
      }
    }
  } catch (err) {
    console.warn("Server grading endpoint unavailable, running client-side evaluator:", err);
  }

  // Client-side fallback evaluator if server call drops
  const gradings: Record<string, QuestionGrading> = {};
  let totalScore = 0;
  let totalMaxScore = 0;

  for (const q of questions) {
    const maxScore = q.maxScore || 20;
    totalMaxScore += maxScore;

    // Soal pilihan ganda: koreksi otomatis penuh tanpa AI
    if (isMcqQuestion(q)) {
      const g = gradeMcqQuestion(q, answers[q.id] || "");
      gradings[q.id] = g;
      totalScore += g.scoreAwarded;
      continue;
    }

    const studentAns = (answers[q.id] || "").trim();

    if (studentAns.length === 0) {
      gradings[q.id] = {
        questionId: q.id,
        studentAnswer: "",
        scoreAwarded: 0,
        maxScore,
        percentage: 0,
        matchedKeyPoints: [],
        missingKeyPoints: q.keywords || ["Jawaban belum diisi"],
        feedback: "Jawaban kosong. Siswa belum mengisi uraian untuk pertanyaan ini.",
      };
      continue;
    }

    const lowerAns = studentAns.toLowerCase();
    const matched: string[] = [];
    const missing: string[] = [];

    (q.keywords || []).forEach((kw) => {
      if (lowerAns.includes(kw.toLowerCase())) matched.push(kw);
      else missing.push(kw);
    });

    const kwScore = (q.keywords && q.keywords.length > 0)
      ? (matched.length / q.keywords.length)
      : 0.7;

    const wordCount = studentAns.split(/\s+/).length;
    const lengthScore = Math.min(1, wordCount / 20);

    const percent = Math.round((kwScore * 0.75 + lengthScore * 0.25) * 100);
    const scoreAwarded = Math.round(((percent / 100) * maxScore) * 10) / 10;

    let feedback = "Pemahaman materi cukup baik.";
    if (percent >= 85) feedback = "Uraian sangat lengkap, sistematis, dan mencakup semua kata kunci esensial!";
    else if (percent >= 70) feedback = "Uraian sudah tepat, sebagian besar konsep utama tersampaikan dengan jelas.";
    else if (percent >= 50) feedback = "Konsep dasar sudah terlihat, namun perlu elaborasi lebih lanjut sesuai kunci jawaban.";
    else feedback = "Perlu penguatan konsep materi dan pemahaman kata kunci terkait.";

    gradings[q.id] = {
      questionId: q.id,
      studentAnswer: studentAns,
      scoreAwarded,
      maxScore,
      percentage: percent,
      matchedKeyPoints: matched.length > 0 ? matched : ["Konsep dasar pemikiran"],
      missingKeyPoints: missing.length > 0 ? missing : ["Detail kontekstual"],
      feedback,
    };

    totalScore += scoreAwarded;
  }

  const finalScore100 = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;

  return {
    success: true,
    gradings,
    totalScore: finalScore100,
    rawScore: Math.round(totalScore * 10) / 10,
    maxPossibleScore: totalMaxScore,
  };
}
