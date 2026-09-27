import crypto from "crypto";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import * as db from "./db";

dotenv.config();

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProd = process.env.NODE_ENV === "production";

/* ---------- Security headers (tanpa dependency tambahan) ---------- */
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  if (isProd) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://*.googleapis.com https://*.gstatic.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    );
  }
  next();
});

/* ---------- CORS ketat (hanya origin yang diizinkan) ---------- */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || process.env.APP_URL || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use((req, res, next) => {
  const origin = req.headers.origin as string | undefined;
  if (origin && (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-key, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

/* ---------- Rate limit sederhana in-memory ---------- */
const buckets = new Map<string, { count: number; reset: number }>();
function rateLimit(max: number, windowMs: number) {
  return (req: any, res: any, next: any) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || now > b.reset) b = { count: 0, reset: now + windowMs };
    b.count++;
    buckets.set(key, b);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - b.count)));
    if (b.count > max) return res.status(429).json({ error: "Terlalu banyak permintaan. Coba lagi sebentar." });
    next();
  };
}
app.use("/api/", rateLimit(120, 60_000));
// Logo sekolah & foto peserta disimpan sebagai base64 (2MB file ≈ 2.7MB string),
// jawaban uraian juga panjang, jadi limit lama 1mb membuat seluruh simpan gagal.
app.use(express.json({ limit: "12mb" }));

// Database PostgreSQL lokal — WAJIB via DATABASE_URL (lihat .env.example)
const DATABASE_URL = process.env.DATABASE_URL || "";
if (!DATABASE_URL) {
  console.error("[FATAL] DATABASE_URL belum diset. Isi file .env (lihat .env.example).");
  console.error("        Contoh: DATABASE_URL=postgres://ujian:rahasia@127.0.0.1:5432/ujian_cbt");
  process.exit(1);
}

async function getConfig(key: string) {
  try {
    return await db.getConfig(key);
  } catch (err) {
    console.warn(`DB getConfig error for ${key}:`, err);
    return null;
  }
}

async function setConfig(key: string, value: any) {
  try {
    await db.setConfig(key, value);
  } catch (err) {
    console.error(`DB setConfig exception for ${key}:`, err);
    throw err;
  }
}

// Lazy init Gemini client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Fallback intelligent grading algorithm if Gemini key is missing or offline
function fallbackEvaluateEssay(
  question: string,
  answerKey: string,
  studentAnswer: string,
  keywords: string[] = [],
  maxScore: number = 20,
  rubricGuide: string = ""
) {
  const cleanStudent = (studentAnswer || "").trim();
  if (cleanStudent.length === 0) {
    return {
      scoreAwarded: 0,
      maxScore,
      percentage: 0,
      matchedKeyPoints: [],
      missingKeyPoints: keywords.length > 0 ? keywords : ["Belum ada jawaban yang ditulis."],
      feedback: "Jawaban kosong. Siswa belum mengisi uraian untuk pertanyaan ini.",
    };
  }

  const lowerStudent = cleanStudent.toLowerCase();
  const lowerKey = (answerKey || "").toLowerCase();

  // Keyword matching
  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];

  keywords.forEach((kw) => {
    const trimmed = kw.trim();
    if (!trimmed) return;
    if (lowerStudent.includes(trimmed.toLowerCase())) {
      matchedKeywords.push(trimmed);
    } else {
      missingKeywords.push(trimmed);
    }
  });

  // Calculate similarity based on keywords and content depth
  let keywordRatio = 0.5;
  if (keywords.length > 0) {
    keywordRatio = matchedKeywords.length / keywords.length;
  } else {
    // If no keywords explicitly set, check word overlap with answer key
    const keyWords = lowerKey
      .replace(/[^\w\s]/gi, "")
      .split(/\s+/)
      .filter((w) => w.length > 3);
    const uniqueKeyWords = Array.from(new Set(keyWords));
    if (uniqueKeyWords.length > 0) {
      const matched = uniqueKeyWords.filter((w) => lowerStudent.includes(w));
      keywordRatio = Math.min(1, matched.length / Math.max(3, uniqueKeyWords.length * 0.5));
      matched.slice(0, 4).forEach((w) => matchedKeywords.push(w));
      uniqueKeyWords
        .filter((w) => !lowerStudent.includes(w))
        .slice(0, 3)
        .forEach((w) => missingKeywords.push(w));
    }
  }

  // Length and depth score (penalize 1-word answer, reward articulated sentences)
  const wordCount = cleanStudent.split(/\s+/).length;
  let depthMultiplier = Math.min(1, wordCount / 15);
  if (wordCount < 4) depthMultiplier = 0.2;

  let finalPercentage = Math.round((keywordRatio * 0.75 + depthMultiplier * 0.25) * 100);
  finalPercentage = Math.max(0, Math.min(100, finalPercentage));

  const scoreAwarded = Math.round((finalPercentage / 100) * maxScore * 10) / 10;

  let feedback = "";
  if (finalPercentage >= 85) {
    feedback = "Jawaban sangat komprehensif, tepat sasaran, dan mencakup poin-poin utama kunci jawaban.";
  } else if (finalPercentage >= 65) {
    feedback = "Pemahaman materi cukup baik, sebagian besar konsep utama sudah tersampaikan dengan jelas.";
  } else if (finalPercentage >= 40) {
    feedback = "Jawaban mengarah ke topik namun masih kurang penjabaran dan beberapa kata kunci esensial belum disebutkan.";
  } else {
    feedback = "Jawaban masih belum sesuai dengan substansi kunci jawaban. Perlu penguatan konsep materi terkait.";
  }

  return {
    scoreAwarded,
    maxScore,
    percentage: finalPercentage,
    matchedKeyPoints: matchedKeywords.length > 0 ? matchedKeywords : ["Gagasan dasar tersampaikan"],
    missingKeyPoints: missingKeywords.length > 0 ? missingKeywords : ["Elaborasi kontekstual"],
    feedback,
  };
}

// API: Check Health
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

/* ---------- Helpers: validasi + hash password (scrypt, tanpa dep baru) ---------- */
const str = (v: any, max = 5000, def = "") => {
  if (typeof v !== "string") return def;
  return v.slice(0, max);
};
const num = (v: any, def = 0, min = 0, max = 100000) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
};
const arr = (v: any, maxLen = 500) => (Array.isArray(v) ? v.slice(0, maxLen) : []);

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password || "password123"), salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

/* Kunci admin sederhana untuk endpoint mutasi.
   Set ADMIN_API_KEY di .env server + VITE_ADMIN_API_KEY di frontend build.
   Jika ADMIN_API_KEY kosong (dev), mutasi diizinkan agar alur lokal tetap jalan. */
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "";
function isAdminRequest(req: any): boolean {
  if (!ADMIN_API_KEY) return true; // dev tanpa kunci: diizinkan
  const got = req.headers["x-admin-key"] || req.query.admin_key;
  const a = Buffer.from(String(got || ""));
  const b = Buffer.from(ADMIN_API_KEY);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function requireAdmin(req: any, res: any, next: any) {
  if (!ADMIN_API_KEY) return next();
  if (!isAdminRequest(req)) {
    return res.status(401).json({ error: "Unauthorized: kunci admin tidak valid." });
  }
  next();
}
const gradeLimiter = rateLimit(30, 60_000);
const submitLimiter = rateLimit(60, 60_000);
const authLimiter = rateLimit(10, 60_000); // anti brute-force login

/* Verifikasi password: dukung hash scrypt: (baru) dan plaintext lama (legacy).
   Perbandingan selalu timing-safe. */
function verifyPassword(input: string, stored: string | undefined | null): boolean {
  const candidate = String(input || "");
  const expected = String(stored || "");
  if (!expected) return false;
  if (expected.startsWith("scrypt:")) {
    const [, salt, hash] = expected.split(":");
    if (!salt || !hash) return false;
    try {
      const calc = crypto.scryptSync(candidate, salt, 64);
      const buf = Buffer.from(hash, "hex");
      if (buf.length !== calc.length) return false;
      return crypto.timingSafeEqual(calc, buf);
    } catch {
      return false;
    }
  }
  // Legacy plaintext
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// API: Grade Single Essay
app.post("/api/grade-single", gradeLimiter, async (req, res) => {
  try {
    const question = str(req.body?.question, 8000);
    const answerKey = str(req.body?.answerKey, 8000);
    const studentAnswer = str(req.body?.studentAnswer, 15000);
    const keywords = arr(req.body?.keywords, 50).map((k: any) => str(k, 200)).filter(Boolean);
    const maxScore = num(req.body?.maxScore, 20, 1, 1000);
    const rubricGuide = str(req.body?.rubricGuide, 5000);
    const client = getGeminiClient();

    if (!client || !process.env.GEMINI_API_KEY) {
      // Fallback evaluator
      const result = fallbackEvaluateEssay(
        question,
        answerKey,
        studentAnswer,
        keywords || [],
        maxScore || 20,
        rubricGuide || ""
      );
      return res.json({ success: true, gradedBy: "fallback-engine", ...result });
    }

    // Call Gemini 3.8 Flash with structured schema
    const prompt = `
Anda adalah sistem penilai ujian essay / uraian otomatis yang objektif, teliti, dan adil.
Tugas Anda adalah mencocokkan dan menilai jawaban uraian siswa terhadap soal dan kunci jawaban yang diberikan guru.

Soal:
${question}

Kunci Jawaban Guru:
${answerKey}

Kata Kunci / Kriteria Wajib:
${(keywords || []).join(", ") || "-"}

Panduan Rubrik Tambahan:
${rubricGuide || "-"}

Bobot Skor Maksimal:
${maxScore || 20}

Jawaban Siswa:
"${studentAnswer || ""}"

Instruksi Penilaian:
1. Analisis pemahaman substansi jawaban siswa terhadap kunci jawaban (bukan hanya kecocokan kata persis, tapi juga makna semantik / konsep sinonim).
2. Periksa apakah konsep inti dan kata kunci esensial tersampaikan.
3. Berikan skor (0 s/d ${maxScore}) serta persentase nilai (0 s/d 100).
4. Buat daftar konsep/poin yang berhasil dijawab siswa (matchedKeyPoints).
5. Buat daftar konsep/poin penting yang belum/kurang dijawab siswa (missingKeyPoints).
6. Berikan umpan balik (feedback) konstruktif dalam Bahasa Indonesia yang santun dan mendidik.
`;

    const response = await client.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            scoreAwarded: {
              type: Type.NUMBER,
              description: `Skor yang didapat siswa (antara 0 sampai ${maxScore})`,
            },
            percentage: {
              type: Type.INTEGER,
              description: "Persentase kecocokan dan kebenaran (0 - 100)",
            },
            matchedKeyPoints: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Poin-poin konsep yang sudah benar dan sesuai",
            },
            missingKeyPoints: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Poin-poin konsep yang terlewat atau belum dijelaskan",
            },
            feedback: {
              type: Type.STRING,
              description: "Umpan balik penjelasan singkat untuk siswa dalam Bahasa Indonesia",
            },
          },
          required: ["scoreAwarded", "percentage", "matchedKeyPoints", "missingKeyPoints", "feedback"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    const safeScore = Math.max(0, Math.min(maxScore || 20, Number(parsed.scoreAwarded) || 0));

    return res.json({
      success: true,
      gradedBy: "gemini-3.8-flash",
      scoreAwarded: Math.round(safeScore * 10) / 10,
      maxScore: maxScore || 20,
      maxPossibleScore: maxScore || 20,
      percentage: parsed.percentage || Math.round((safeScore / (maxScore || 20)) * 100),
      matchedKeyPoints: parsed.matchedKeyPoints || [],
      missingKeyPoints: parsed.missingKeyPoints || [],
      feedback: parsed.feedback || "Penilaian berhasil diproses.",
    });
  } catch (error: any) {
    console.error("Gemini grading error, falling back:", error?.message || error);
    const fbQ = str(req.body?.question, 8000);
    const fbK = str(req.body?.answerKey, 8000);
    const fbA = str(req.body?.studentAnswer, 15000);
    const fbKw = arr(req.body?.keywords, 50).map((k: any) => str(k, 200)).filter(Boolean);
    const fbM = num(req.body?.maxScore, 20, 1, 1000);
    const fbR = str(req.body?.rubricGuide, 5000);
    const fallback = fallbackEvaluateEssay(fbQ, fbK, fbA, fbKw, fbM, fbR);
    return res.json({
      success: true,
      gradedBy: "fallback-engine-recovered",
      maxPossibleScore: fbM || 20,
      ...fallback,
    });
  }
});

// Helper to call Gemini with automatic model retry on 503 / high demand
async function callGeminiGrading(client: GoogleGenAI, prompt: string, schema: any) {
  const modelsToTry = ["gemini-3.8-flash", "gemini-3.1-flash-lite"];
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const response = await client.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      });
      return { success: true, text: response.text, model };
    } catch (err: any) {
      lastError = err;
      // If 503 or overloaded, continue to next fallback model
      console.warn(`Model ${model} unavailable or busy (${err?.message || err}), attempting alternative...`);
    }
  }
  throw lastError;
}

// Koreksi otomatis pilihan ganda: benar = bobot penuh, salah/kosong = 0. Tanpa AI.
function gradeMcqServer(
  q: {
    id: string;
    options: Array<{ label: string; text: string }>;
    correctAnswer: string;
    maxScore: number;
  },
  studentAnswer: string
) {
  const norm = (v: string) => (v || "").trim().toUpperCase().replace(/\s+/g, "");
  const maxScore = q.maxScore || 20;
  const raw = (studentAnswer || "").trim();
  const opts = Array.isArray(q.options) ? q.options : [];
  const chosen =
    opts.find((o) => norm(o.label) === norm(raw)) ||
    opts.find((o) => (o.text || "").trim() && norm(o.text) === norm(raw));
  const correctOpt = opts.find((o) => norm(o.label) === norm(q.correctAnswer));
  const isCorrect = Boolean(chosen && correctOpt && norm(chosen.label) === norm(q.correctAnswer));
  const kunciText = correctOpt ? `${correctOpt.label}. ${correctOpt.text}` : "(kunci belum ditetapkan)";
  const chosenText = chosen ? `${chosen.label}. ${chosen.text}` : raw || "(Tidak dijawab)";

  let feedback: string;
  if (!raw) feedback = `Belum dijawab. Kunci jawaban: ${kunciText}`;
  else if (isCorrect) feedback = `Benar! Jawaban siswa sesuai kunci jawaban (${correctOpt?.label}).`;
  else feedback = `Salah. Kunci jawaban: ${kunciText}. Jawaban siswa: ${chosenText}`;

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
    gradedBy: "auto-pg",
  };
}

// API: Batch Grade Full Exam
app.post("/api/grade-exam", gradeLimiter, async (req, res) => {
  try {
    const rawQuestions = arr(req.body?.questions, 100);
    const rawAnswers = (req.body?.answers && typeof req.body.answers === "object") ? req.body.answers : {};
    if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
      return res.status(400).json({ error: "Questions array is required." });
    }
    const questions = rawQuestions.slice(0, 50).map((q: any) => ({
      id: str(q?.id, 200),
      type: str(q?.type, 10) === "pg" ? "pg" : "essay",
      question: str(q?.question, 8000),
      answerKey: str(q?.answerKey, 8000),
      keywords: arr(q?.keywords, 50).map((k: any) => str(k, 200)).filter(Boolean),
      maxScore: num(q?.maxScore, 20, 1, 1000),
      rubricGuide: str(q?.rubricGuide, 5000),
      options: arr(q?.options, 6)
        .map((o: any) => ({ label: str(o?.label, 4), text: str(o?.text, 500) }))
        .filter((o: any) => o.label),
      correctAnswer: str(q?.correctAnswer, 4),
    })).filter((q: any) => q.id);
    const answers: Record<string, string> = {};
    for (const q of questions) answers[q.id] = str(rawAnswers[q.id], 15000);

    const gradings: Record<string, any> = {};
    let totalScore = 0;
    let totalMaxScore = 0;

    for (const q of questions) {
      const studentAnswer = answers?.[q.id] || "";
      const maxScore = q.maxScore || 20;
      totalMaxScore += maxScore;

      // Soal pilihan ganda: koreksi otomatis penuh, langsung instan tanpa AI
      if (q.type === "pg") {
        const auto = gradeMcqServer(q, studentAnswer);
        gradings[q.id] = auto;
        totalScore += auto.scoreAwarded;
        continue;
      }

      let qResult;
      const client = getGeminiClient();

      if (client && process.env.GEMINI_API_KEY && studentAnswer.trim().length > 0) {
        try {
          const prompt = `
Nilai jawaban uraian siswa untuk soal berikut:
Soal: ${q.question}
Kunci Jawaban Guru: ${q.answerKey}
Kata Kunci: ${(q.keywords || []).join(", ") || "-"}
Rubrik: ${q.rubricGuide || "-"}
Bobot Maksimal: ${maxScore}
Jawaban Siswa: "${studentAnswer}"

Berikan penilaian objektif dalam format JSON.
`;
          const schema = {
            type: Type.OBJECT,
            properties: {
              scoreAwarded: { type: Type.NUMBER },
              percentage: { type: Type.INTEGER },
              matchedKeyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
              missingKeyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
              feedback: { type: Type.STRING },
            },
            required: ["scoreAwarded", "percentage", "matchedKeyPoints", "missingKeyPoints", "feedback"],
          };

          const genResult = await callGeminiGrading(client, prompt, schema);
          const parsed = JSON.parse(genResult.text || "{}");
          const safeScore = Math.max(0, Math.min(maxScore, Number(parsed.scoreAwarded) || 0));
          qResult = {
            questionId: q.id,
            studentAnswer,
            scoreAwarded: Math.round(safeScore * 10) / 10,
            maxScore,
            percentage: parsed.percentage || Math.round((safeScore / maxScore) * 100),
            matchedKeyPoints: parsed.matchedKeyPoints || [],
            missingKeyPoints: parsed.missingKeyPoints || [],
            feedback: parsed.feedback || "Evaluasi selesai.",
            gradedBy: genResult.model,
          };
        } catch (geminiErr) {
          console.warn("Gemini batch item error, using fallback engine:", (geminiErr as any)?.message || geminiErr);
          const fallback = fallbackEvaluateEssay(
            q.question,
            q.answerKey,
            studentAnswer,
            q.keywords || [],
            maxScore,
            q.rubricGuide || ""
          );
          qResult = {
            questionId: q.id,
            studentAnswer,
            ...fallback,
          };
        }
      } else {
        const fallback = fallbackEvaluateEssay(
          q.question,
          q.answerKey,
          studentAnswer,
          q.keywords || [],
          maxScore,
          q.rubricGuide || ""
        );
        qResult = {
          questionId: q.id,
          studentAnswer,
          ...fallback,
        };
      }

      gradings[q.id] = qResult;
      totalScore += qResult.scoreAwarded;
    }

    // Normalized to 0-100 scale
    const finalScore100 = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;

    return res.json({
      success: true,
      gradings,
      totalScore: finalScore100,
      rawScore: Math.round(totalScore * 10) / 10,
      maxPossibleScore: totalMaxScore,
      totalMaxScore,
    });
  } catch (err: any) {
    console.error("Batch grading error:", err);
    return res.status(500).json({ error: "Internal grading error", message: err?.message });
  }
});

// ==========================================
// DATABASE API ROUTES (PostgreSQL lokal)
// ==========================================

app.get("/api/db/health", async (req, res) => {
  try {
    const count = await db.countConfig();
    return res.json({ connected: true, provider: "postgresql", configCount: count });
  } catch (err: any) {
    return res.status(500).json({ connected: false, error: err?.message });
  }
});

function areSubmissionsForSameStudentAndExam(s1: any, s2: any): boolean {
  if (!s1 || !s2) return false;
  // Submissions MUST belong to the exact same exam
  if (!s1.examId || !s2.examId || s1.examId !== s2.examId) return false;

  // 1. Direct submission ID match
  if (s1.id && s2.id && s1.id === s2.id) return true;

  // 2. Direct studentId match
  if (s1.studentId && s2.studentId && s1.studentId === s2.studentId) return true;

  // 3. NISN match
  if (s1.nisn && s2.nisn && s1.nisn === s2.nisn) return true;
  if (s1.nisn && s2.studentId && s1.nisn === s2.studentId) return true;
  if (s2.nisn && s1.studentId && s2.nisn === s1.studentId) return true;

  // 4. Normalized student name match
  const n1 = (s1.studentName || "").trim().toLowerCase();
  const n2 = (s2.studentName || "").trim().toLowerCase();
  if (n1 && n2 && n1 === n2) return true;

  // 5. Canonical ID pattern match: sub-{examId}-{studentId}
  if (s1.id && s2.studentId && s1.id.includes(s2.studentId)) return true;
  if (s2.id && s1.studentId && s2.id.includes(s1.studentId)) return true;

  return false;
}

function mergeTwoSubmissions(existing: any, incoming: any): any {
  const existingIsCompleted =
    existing.status === "graded" ||
    existing.status === "submitted" ||
    Boolean(existing.submittedAt);
  const incomingIsCompleted =
    incoming.status === "graded" ||
    incoming.status === "submitted" ||
    Boolean(incoming.submittedAt);

  // Combine violation logs safely
  const vMap = new Map<string, any>();
  [...(existing.violationLogs || []), ...(incoming.violationLogs || [])].forEach((v: any) => {
    if (v && v.timestamp) {
      vMap.set(`${v.timestamp}_${v.reason}`, v);
    }
  });
  const mergedViolations = Array.from(vMap.values());
  const maxViolations = Math.max(
    existing.violationCount || 0,
    incoming.violationCount || 0,
    mergedViolations.length
  );

  let winner: any;
  if (incomingIsCompleted && !existingIsCompleted) {
    winner = { ...incoming };
  } else if (existingIsCompleted && !incomingIsCompleted) {
    winner = { ...existing };
  } else if (incomingIsCompleted && existingIsCompleted) {
    // Both completed: keep the one with higher/valid totalScore or latest submittedAt
    const t1 = new Date(existing.submittedAt || existing.lastActiveAt || 0).getTime();
    const t2 = new Date(incoming.submittedAt || incoming.lastActiveAt || 0).getTime();
    winner = t2 >= t1 ? { ...incoming } : { ...existing };
  } else {
    // Both in_progress: keep latest or most answered
    const a1 = existing.answeredCount || 0;
    const a2 = incoming.answeredCount || 0;
    const t1 = new Date(existing.lastActiveAt || existing.startedAt || 0).getTime();
    const t2 = new Date(incoming.lastActiveAt || incoming.startedAt || 0).getTime();
    winner = (a2 > a1 || (a2 === a1 && t2 >= t1)) ? { ...incoming } : { ...existing };
  }

  // Ensure merged violation stats are preserved
  winner.violationLogs = mergedViolations;
  winner.violationCount = maxViolations;

  return winner;
}

function deduplicateSubmissionsList(subs: any[]): any[] {
  if (!Array.isArray(subs)) return [];
  const result: any[] = [];

  for (const sub of subs) {
    if (!sub || !sub.examId) continue;
    const matchIndex = result.findIndex((existing) =>
      areSubmissionsForSameStudentAndExam(existing, sub)
    );

    if (matchIndex < 0) {
      result.push(sub);
    } else {
      result[matchIndex] = mergeTwoSubmissions(result[matchIndex], sub);
    }
  }

  return result;
}

// Extract student answer with resilient key matching
function extractStudentAnswer(q: any, idx: number, answers: Record<string, string> = {}): string {
  if (!answers) return "";
  if (answers[q.id] !== undefined && answers[q.id] !== null) return String(answers[q.id]);
  const keys = Object.keys(answers);
  const qNum = q.number || idx + 1;
  const match = keys.find(k => k.includes(`-${qNum}-`) || k.endsWith(`-${qNum}`) || k.includes(`_${qNum}_`));
  if (match) return String(answers[match]);
  if (idx < keys.length && keys[idx] && answers[keys[idx]]) return String(answers[keys[idx]]);
  return "";
}

// Auto-grade any submissions with answers that lack scores or are in progress
function evaluateSubmissionWithExam(sub: any, exams: any[]): any {
  const exam = (exams || []).find((e: any) => e.id === sub.examId);
  if (!exam || !Array.isArray(exam.questions)) {
    return sub;
  }
  const ansCount = Object.values(sub.answers || {}).filter(
    (a: any) => typeof a === "string" && a.trim().length > 0
  ).length;
  if (ansCount === 0) {
    return sub;
  }

  let totalScore = 0;
  let totalMaxScore = 0;
  const gradings: Record<string, any> = { ...(sub.gradings || {}) };

  exam.questions.forEach((q: any, idx: number) => {
    const studentAns = extractStudentAnswer(q, idx, sub.answers);
    const maxScore = q.maxScore || 20;
    totalMaxScore += maxScore;

    if (!gradings[q.id] || gradings[q.id].scoreAwarded === undefined || gradings[q.id].scoreAwarded === 0) {
      const res = fallbackEvaluateEssay(
        q.question,
        q.answerKey,
        studentAns,
        q.keywords || [],
        maxScore,
        q.rubricGuide || ""
      );
      gradings[q.id] = { questionId: q.id, studentAnswer: studentAns, ...res };
      totalScore += res.scoreAwarded;
    } else {
      totalScore += gradings[q.id].scoreAwarded;
    }
  });

  const finalScore100 = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;
  const isPassed = finalScore100 >= (exam.passingGrade || 70);

  return {
    ...sub,
    gradings,
    totalScore: finalScore100,
    rawScore: Math.round(totalScore * 10) / 10,
    maxPossibleScore: totalMaxScore,
    isPassed,
    status: "graded",
    submittedAt: sub.submittedAt || sub.lastActiveAt || new Date().toISOString(),
  };
}

// Auth: verifikasi login di server (hash scrypt: atau plaintext legacy).
// Tidak mengembalikan field password.
app.post("/api/auth/login", authLimiter, async (req, res) => {
  try {
    const identifier = str(req.body?.identifier, 300).trim().toLowerCase();
    const password = str(req.body?.password, 300);
    const role = str(req.body?.role, 20);
    if (!identifier || !password) {
      return res.status(400).json({ success: false, error: "Harap masukkan identitas dan kata sandi." });
    }

    const users = (await getConfig("users")) || [];
    const u: any = users.find((x: any) => {
      const email = String(x?.email || "").toLowerCase();
      const nisn = String(x?.nisn || "").toLowerCase();
      const nip = String(x?.nip || "").toLowerCase();
      const name = String(x?.name || "").toLowerCase();
      const id = String(x?.id || "").toLowerCase();
      return (
        (email && email === identifier) ||
        (nisn && nisn === identifier) ||
        (nip && nip === identifier) ||
        (name && name === identifier) ||
        (id && id === identifier)
      );
    });

    if (!u) {
      return res.status(401).json({
        success: false,
        code: "USER_NOT_FOUND",
        error: `Pengguna tidak ditemukan. Pastikan Username/NISN/NIP sudah terdaftar.`,
      });
    }

    // Verifikasi peran (admin selalu boleh masuk di tab mana pun)
    if (role && u.role !== role && u.role !== "admin") {
      return res.status(401).json({
        success: false,
        code: "ROLE_MISMATCH",
        error: `Peran akun tidak cocok. Akun ini terdaftar sebagai ${String(u.role || "").toUpperCase()}.`,
      });
    }

    // Sumber hash: tabel users PostgreSQL (scrypt) bila ada, fallback field config (legacy)
    let stored: string | null | undefined = u.password;
    try {
      const hash = await db.getUserPasswordHash(String(u.id || ""));
      if (hash) stored = hash;
    } catch {
      /* fallback ke field config */
    }

    if (!verifyPassword(password, stored)) {
      return res.status(401).json({
        success: false,
        code: "BAD_PASSWORD",
        error: "Kata sandi (password) salah. Silakan periksa kembali.",
      });
    }

    const safeUser = { ...u };
    delete safeUser.password;
    delete safeUser.password_hash;
    return res.json({ success: true, user: safeUser });
  } catch (err: any) {
    console.error("Login error:", err?.message || err);
    return res.status(500).json({ success: false, error: "Gagal memproses login. Coba lagi." });
  }
});

// Load all data from PostgreSQL in a single fast query
app.get("/api/db/load-all", async (req, res) => {
  try {
    const map = await db.allConfig();

    const exams = map["exams"] || [];
    const rawSubs = map["submissions"] || [];
    let cleanedSubs = deduplicateSubmissionsList(rawSubs);

    // Auto-grade any pending submissions with valid answers
    let hadAutoGraded = false;
    cleanedSubs = cleanedSubs.map((s) => {
      const ansCount = Object.values(s.answers || {}).filter(
        (a: any) => typeof a === "string" && a.trim().length > 0
      ).length;
      if (ansCount > 0 && (s.status === "in_progress" || s.totalScore === 0)) {
        hadAutoGraded = true;
        return evaluateSubmissionWithExam(s, exams);
      }
      return s;
    });

    // If cleaned list resolved legacy duplicates or auto-graded, sync back silently in background
    if (rawSubs.length !== cleanedSubs.length || hadAutoGraded) {
      setConfig("submissions", cleanedSubs).catch((e) =>
        console.warn("Background submission deduplication/grade sync note:", e)
      );
    }

    // Sembunyikan password dari caller tanpa kunci admin
    // (admin UI tetap menerima field ini saat mengirim x-admin-key valid)
    const usersOut = (map["users"] || []).map((u: any) => {
      if (isAdminRequest(req)) return u;
      const { password, password_hash, ...rest } = u || {};
      return rest;
    });

    return res.json({
      success: true,
      schoolProfile: map["school_profile"] || null,
      users: usersOut,
      classes: map["classes"] || null,
      exams: map["exams"] || null,
      submissions: cleanedSubs,
    });
  } catch (err: any) {
    console.error("DB load-all error:", err);
    return res.status(500).json({ error: err?.message });
  }
});

// Auto-grade all submissions endpoint
app.post("/api/db/auto-grade-all", requireAdmin, async (req, res) => {
  try {
    const exams = (await getConfig("exams")) || [];
    const subs = (await getConfig("submissions")) || [];

    const updatedSubs = subs.map((s: any) => {
      const ansCount = Object.values(s.answers || {}).filter(
        (a: any) => typeof a === "string" && a.trim().length > 0
      ).length;
      if (ansCount > 0) {
        return evaluateSubmissionWithExam(s, exams);
      }
      return s;
    });

    await setConfig("submissions", updatedSubs);
    return res.json({ success: true, count: updatedSubs.length, submissions: updatedSubs });
  } catch (err: any) {
    console.error("Auto grade all error:", err);
    return res.status(500).json({ error: err?.message });
  }
});

// Save School Profile
app.post("/api/db/save-school-profile", requireAdmin, async (req, res) => {
  try {
    const p = req.body || {};
    if (!p || typeof p !== "object" || !str(p.name, 300)) {
      return res.status(400).json({ error: "Nama sekolah wajib diisi" });
    }
    // Seluruh field SchoolProfile wajib ikut disimpan. Sebelumnya hanya 7 field
    // (academicYear, principal*, proctor*, headerTitle, subTitle) hilang, sehingga
    // sync berkala menimpanya kembali dengan nilai kosong.
    const profile = {
      name: str(p.name, 300, "Sekolah"),
      npsn: str(p.npsn, 50),
      address: str(p.address, 1000),
      academicYear: str(p.academicYear, 50),
      principalName: str(p.principalName, 300),
      principalNip: str(p.principalNip, 100),
      proctorName: str(p.proctorName, 300),
      proctorNip: str(p.proctorNip, 100),
      headerTitle: str(p.headerTitle, 300),
      subTitle: str(p.subTitle, 300),
      // Logo base64 boleh besar (≈2.7jt karakter untuk file 2MB)
      logoUrl: str(p.logoUrl, 4_000_000),
      // Field lama tetap dipertahankan agar data tidak hilang
      phone: str(p.phone, 100),
      email: str(p.email, 300),
      principal: str(p.principal, 300),
    };
    await setConfig("school_profile", profile);

    return res.json({ success: true, profile });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message });
  }
});

// Save Single User
app.post("/api/db/save-user", requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b || !str(b.id, 200)) {
      return res.status(400).json({ error: "User ID is required" });
    }
    const role = ["admin", "guru", "siswa"].includes(b.role) ? b.role : "siswa";
    const user = {
      id: str(b.id, 200),
      name: str(b.name, 300, "Pengguna"),
      email: str(b.email, 300),
      nisn: str(b.nisn, 100),
      nip: str(b.nip, 100),
      role,
      password: str(b.password, 200, "password123"),
      classId: str(b.classId, 200),
      className: str(b.className, 300),
      avatar: str(b.avatar, 4_000_000),
    };

    const currentUsers = (await getConfig("users")) || [];
    const idx = currentUsers.findIndex((u: any) => u.id === user.id);
    if (idx >= 0) {
      currentUsers[idx] = user;
    } else {
      currentUsers.push(user);
    }
    await setConfig("users", currentUsers);

    // Sinkron ke tabel users (password_hash scrypt)
    try {
      await db.upsertUser({
        id: user.id,
        email: user.email,
        password_hash: hashPassword(user.password),
        full_name: user.name,
        role: user.role,
      });
    } catch (e) {
      console.warn("User relational sync note:", e);
    }

    return res.json({ success: true, user });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message });
  }
});

// Bulk Save Users
app.post("/api/db/save-users-bulk", requireAdmin, async (req, res) => {
  try {
    const rawUsers = arr(req.body?.users, 2000);
    if (!Array.isArray(rawUsers)) {
      return res.status(400).json({ error: "Users array is required" });
    }
    const newUsers = rawUsers.slice(0, 1000).map((u: any) => ({
      id: str(u?.id, 200),
      name: str(u?.name, 300, "Pengguna"),
      email: str(u?.email, 300),
      nisn: str(u?.nisn, 100),
      nip: str(u?.nip, 100),
      role: ["admin", "guru", "siswa"].includes(u?.role) ? u.role : "siswa",
      password: str(u?.password, 200, "password123"),
      classId: str(u?.classId, 200),
      className: str(u?.className, 300),
      avatar: str(u?.avatar, 4_000_000),
    })).filter((u: any) => u.id);

    const currentUsers = (await getConfig("users")) || [];
    newUsers.forEach((nu: any) => {
      let idx = currentUsers.findIndex((u: any) => u.id === nu.id);
      if (idx === -1 && nu.email) {
        idx = currentUsers.findIndex((u: any) => u.email?.toLowerCase() === nu.email.toLowerCase());
      }
      if (idx === -1 && nu.nisn) {
        idx = currentUsers.findIndex((u: any) => u.nisn === nu.nisn);
      }
      if (idx === -1 && nu.nip) {
        idx = currentUsers.findIndex((u: any) => u.nip === nu.nip);
      }

      if (idx >= 0) {
        currentUsers[idx] = { ...currentUsers[idx], ...nu };
      } else {
        currentUsers.push(nu);
      }
    });

    await setConfig("users", currentUsers);

    // Sinkron ke tabel users (batch, transaksi)
    try {
      const relRows = newUsers.map((u: any) => ({
        id: u.id,
        email: u.email,
        password_hash: hashPassword(u.password),
        full_name: u.name,
        role: u.role,
      }));
      await db.upsertUsers(relRows);
    } catch (e) {
      console.warn("Bulk users relational sync note:", e);
    }

    return res.json({ success: true, count: newUsers.length });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message });
  }
});

// Delete User
app.delete("/api/db/delete-user/:id", requireAdmin, async (req, res) => {
  try {
    const id = str(req.params?.id, 200);
    if (!id) return res.status(400).json({ error: "ID tidak valid" });
    const currentUsers = (await getConfig("users")) || [];
    const filtered = currentUsers.filter((u: any) => u.id !== id);
    await setConfig("users", filtered);

    try {
      await db.deleteUserRow(id);
    } catch (e) {
      console.warn("Delete user relational note:", e);
    }

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message });
  }
});

// Save Class
app.post("/api/db/save-class", requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const cls = {
      id: str(b.id, 200),
      name: str(b.name, 300, "Kelas"),
      grade: str(b.grade, 50),
      academicYear: str(b.academicYear, 50),
      studentCount: num(b.studentCount, 0, 0, 100000),
    };
    if (!cls || !cls.id) {
      return res.status(400).json({ error: "Class ID is required" });
    }

    const currentClasses = (await getConfig("classes")) || [];
    const idx = currentClasses.findIndex((c: any) => c.id === cls.id);
    if (idx >= 0) {
      currentClasses[idx] = cls;
    } else {
      currentClasses.push(cls);
    }
    await setConfig("classes", currentClasses);

    return res.json({ success: true, class: cls });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message });
  }
});

// Delete Class
app.delete("/api/db/delete-class/:id", requireAdmin, async (req, res) => {
  try {
    const id = str(req.params?.id, 200);
    if (!id) return res.status(400).json({ error: "ID tidak valid" });
    const currentClasses = (await getConfig("classes")) || [];
    const filtered = currentClasses.filter((c: any) => c.id !== id);
    await setConfig("classes", filtered);

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message });
  }
});

// Save Exam
app.post("/api/db/save-exam", requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b || !str(b.id, 200)) {
      return res.status(400).json({ error: "Exam ID is required" });
    }
    // Peta field WAJIB sesuai Exam di src/types.ts. Versi lama memakai nama lain
    // (classId/duration) sehingga exam yang tersimpan kehilangan tanggal, kelas,
    // pengaturan kamera, dan mode lockdown.
    const exam: any = {
      id: str(b.id, 200),
      title: str(b.title, 500, "Ujian"),
      subject: str(b.subject, 300),
      targetClassId: str(b.targetClassId ?? b.classId, 200),
      targetClassName: str(b.targetClassName, 300),
      teacherId: str(b.teacherId, 200),
      teacherName: str(b.teacherName, 300),
      examDate: str(b.examDate, 50),
      startTime: str(b.startTime, 100),
      endTime: str(b.endTime, 100),
      durationMinutes: num(
        b.durationMinutes ?? b.duration,
        60,
        1,
        1440
      ),
      passingGrade: num(b.passingGrade, 75, 0, 100),
      status: ["draft", "published"].includes(b.status) ? b.status : "draft",
      examType: ["pg", "essay", "campuran"].includes(b.examType)
        ? b.examType
        : undefined,
      questions: arr(b.questions, 500).map((q: any) => ({
        ...q,
        question: str(q?.question, 15000),
        answerKey: str(q?.answerKey, 15000),
        keywords: arr(q?.keywords, 100),
        rubricGuide: str(q?.rubricGuide, 8000),
        maxScore: num(q?.maxScore, 20, 0, 1000),
      })),
      allowCamera: b.allowCamera !== false,
      lockdownMode: b.lockdownMode !== false,
      createdAt: str(b.createdAt, 100) || new Date().toISOString(),
    };

    const currentExams = (await getConfig("exams")) || [];
    const idx = currentExams.findIndex((e: any) => e.id === exam.id);
    if (idx >= 0) {
      // Pertahankan createdAt asli bila klien tidak mengirimnya
      exam.createdAt = currentExams[idx]?.createdAt || exam.createdAt;
      currentExams[idx] = exam;
    } else {
      currentExams.push(exam);
    }
    await setConfig("exams", currentExams);

    return res.json({ success: true, exam });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message });
  }
});

// Delete Exam
app.delete("/api/db/delete-exam/:id", requireAdmin, async (req, res) => {
  try {
    const id = str(req.params?.id, 200);
    if (!id) return res.status(400).json({ error: "ID tidak valid" });
    const currentExams = (await getConfig("exams")) || [];
    const filtered = currentExams.filter((e: any) => e.id !== id);
    await setConfig("exams", filtered);

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message });
  }
});

// Save Submission
app.post("/api/db/save-submission", submitLimiter, async (req, res) => {
  try {
    const b = req.body || {};
    const submission: any = {
      id: str(b.id, 200),
      examId: str(b.examId, 200),
      studentId: str(b.studentId, 200),
      studentName: str(b.studentName, 300),
      status: ["in_progress", "submitted", "graded"].includes(b.status) ? b.status : "in_progress",
      submittedAt: str(b.submittedAt, 100),
      answers: {},
      violationCount: num(b.violationCount, 0, 0, 10000),
      violationLogs: arr(b.violationLogs, 200),
    };
    if (b.answers && typeof b.answers === "object") {
      for (const [k, v] of Object.entries(b.answers).slice(0, 200)) {
        submission.answers[str(k, 200)] = str(v as any, 15000);
      }
    }
    // Field ini wajib disimpan agar tab pemantauan live & audit pelanggaran pada
    // perangkat guru tetap lengkap (bukan hanya di perangkat siswa).
    [
      "gradings",
      "totalScore",
      "rawScore",
      "maxPossibleScore",
      "answeredCount",
      "isPassed",
      "startedAt",
      "lastActiveAt",
      "examTitle",
      "subject",
      "studentNisn",
      "studentClassId",
      "studentClassName",
      "studentClass",
      "totalQuestions",
    ].forEach((k) => {
      if (b[k] !== undefined) submission[k] = b[k];
    });
    if (!submission || !submission.id) {
      return res.status(400).json({ error: "Submission ID is required" });
    }

    const currentSubs = (await getConfig("submissions")) || [];
    
    // Check if there is an existing submission for this student and exam
    const existingIndex = currentSubs.findIndex((s: any) =>
      areSubmissionsForSameStudentAndExam(s, submission)
    );

    if (existingIndex >= 0) {
      const existing = currentSubs[existingIndex];
      const existingIsCompleted =
        existing.status === "graded" ||
        existing.status === "submitted" ||
        Boolean(existing.submittedAt);
      const incomingIsInProgress =
        submission.status === "in_progress" && !submission.submittedAt;

      // CRITICAL: Do NOT allow an existing graded/submitted exam to be downgraded to in_progress
      if (existingIsCompleted && incomingIsInProgress) {
        return res.json({
          success: true,
          submission: existing,
          note: "Exam already completed. in_progress downgrade prevented.",
        });
      }
    }

    // Merge existing and incoming to keep complete answers & violation logs
    const mergedSubmission =
      existingIndex >= 0
        ? mergeTwoSubmissions(currentSubs[existingIndex], submission)
        : submission;

    // Remove any previous or duplicate records for this student and exam
    const remainingSubs = currentSubs.filter(
      (s: any) => !areSubmissionsForSameStudentAndExam(s, submission)
    );

    remainingSubs.push(mergedSubmission);
    const cleanedSubs = deduplicateSubmissionsList(remainingSubs);
    await setConfig("submissions", cleanedSubs);

    return res.json({ success: true, submission: mergedSubmission });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message });
  }
});

// Delete Submission
app.delete("/api/db/delete-submission/:id", requireAdmin, async (req, res) => {
  try {
    const id = str(req.params?.id, 200);
    if (!id) return res.status(400).json({ error: "ID tidak valid" });
    const currentSubs = (await getConfig("submissions")) || [];
    const filtered = currentSubs.filter((s: any) => s.id !== id);
    await setConfig("submissions", filtered);

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message });
  }
});

// Bulk Delete Data
app.post("/api/db/bulk-delete", requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const students = Boolean(b.students);
    const teachers = Boolean(b.teachers);
    const submissions = Boolean(b.submissions);
    const exams = Boolean(b.exams);
    const classes = Boolean(b.classes);
    const auditLogsOnly = Boolean(b.auditLogsOnly);

    let usersCount = 0;
    let examsCount = 0;
    let submissionsCount = 0;
    let classesCount = 0;

    if (submissions) {
      const cur = (await getConfig("submissions")) || [];
      submissionsCount = cur.length;
      await setConfig("submissions", []);
    } else if (auditLogsOnly) {
      const cur = (await getConfig("submissions")) || [];
      const cleaned = cur.map((s: any) => ({
        ...s,
        violationCount: 0,
        violationLogs: [],
      }));
      await setConfig("submissions", cleaned);
    }

    if (exams) {
      const cur = (await getConfig("exams")) || [];
      examsCount = cur.length;
      await setConfig("exams", []);
    }

    if (students || teachers) {
      const cur = (await getConfig("users")) || [];
      const toKeep = cur.filter((u: any) => {
        if (u.role === "admin") return true;
        if (students && u.role === "siswa") return false;
        if (teachers && u.role === "guru") return false;
        return true;
      });
      usersCount = cur.length - toKeep.length;
      await setConfig("users", toKeep);
    }

    if (classes) {
      const cur = (await getConfig("classes")) || [];
      classesCount = cur.length;
      await setConfig("classes", []);
    }

    return res.json({
      success: true,
      usersCount,
      examsCount,
      submissionsCount,
      classesCount,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message });
  }
});

// Restore Backup Data
app.post("/api/db/restore", requireAdmin, async (req, res) => {
  try {
    const backupPayload = (req.body?.backupPayload && typeof req.body.backupPayload === "object") ? req.body.backupPayload : {};
    const selectedModules = (req.body?.selectedModules && typeof req.body.selectedModules === "object") ? req.body.selectedModules : {};
    // batasi ukuran restore agar tidak OOM (backup bisa memuat logo base64)
    const payloadSize = JSON.stringify(backupPayload).length;
    if (payloadSize > 11_000_000) return res.status(413).json({ error: "Backup terlalu besar (maks ~11MB)." });
    let restoredCount = 0;

    if (selectedModules?.profile && backupPayload?.schoolProfile) {
      await setConfig("school_profile", backupPayload.schoolProfile);
      restoredCount++;
    }

    if (selectedModules?.classes && Array.isArray(backupPayload?.classes)) {
      await setConfig("classes", backupPayload.classes);
      restoredCount += backupPayload.classes.length;
    }

    if (Array.isArray(backupPayload?.users)) {
      const toRestore = backupPayload.users.filter((u: any) => {
        if (selectedModules?.students && u.role === "siswa") return true;
        if (selectedModules?.teachers && u.role === "guru") return true;
        return false;
      });
      if (toRestore.length > 0) {
        const cur = (await getConfig("users")) || [];
        toRestore.forEach((nu: any) => {
          const idx = cur.findIndex((x: any) => x.id === nu.id);
          if (idx >= 0) cur[idx] = nu;
          else cur.push(nu);
        });
        await setConfig("users", cur);
        restoredCount += toRestore.length;
      }
    }

    if (selectedModules?.exams && Array.isArray(backupPayload?.exams)) {
      await setConfig("exams", backupPayload.exams);
      restoredCount += backupPayload.exams.length;
    }

    if (selectedModules?.submissions && Array.isArray(backupPayload?.submissions)) {
      await setConfig("submissions", backupPayload.submissions);
      restoredCount += backupPayload.submissions.length;
    }

    return res.json({ success: true, restoredCount });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message });
  }
});

// Vite middleware or static serving

async function startServer() {
  // Koneksi & inisialisasi skema PostgreSQL (gagal cepat bila DB tak terjangkau)
  try {
    await db.initDb();
  } catch (err: any) {
    console.error("[FATAL] Tidak bisa terhubung ke PostgreSQL:", err?.message || err);
    console.error("        Pastikan service PostgreSQL berjalan dan DATABASE_URL di .env sesuai.");
    process.exit(1);
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
