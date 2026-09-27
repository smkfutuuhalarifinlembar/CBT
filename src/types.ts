export type UserRole = "admin" | "guru" | "siswa";

export interface SchoolProfile {
  name: string;
  npsn?: string;
  address?: string;
  academicYear?: string;
  principalName?: string;
  principalNip?: string;
  proctorName?: string;
  proctorNip?: string;
  logoUrl?: string; // base64 or URL
  headerTitle?: string;
  subTitle?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  password?: string;
  classId?: string;
  className?: string;
  nisn?: string;
  nip?: string;
  avatar?: string; // photo base64 or URL
}

export interface ClassRoom {
  id: string;
  name: string;
  grade: string;
  academicYear: string;
  studentCount: number;
}

export type QuestionKind = "pg" | "essay";

/** Sumber pelanggaran: kunci layar (lockdown), kamera pengawas, atau sistem. */
export type ViolationSource = "layar" | "kamera" | "sistem";

/** Tingkat keparahan yang dilaporkan pada audit ke guru. */
export type ViolationSeverity = "peringatan" | "pelanggaran" | "kritis";

/** Kejadian yang dilaporkan sensor (belum menyimpan waktu). */
export interface ViolationEvent {
  reason: string;
  detail: string;
  source: ViolationSource;
  severity: ViolationSeverity;
  evidence?: string;
}

/**
 * Catatan pelanggaran tersimpan pada submission. Field selain `timestamp` dan
 * `reason` bersifat opsional agar log lama (hanya string) tetap terbaca.
 */
export interface ViolationLog {
  timestamp: string; // ISO 8601 (log lama: "HH.MM.SS")
  reason: string;
  detail?: string; // uraian jelas apa yang dilakukan siswa
  source?: ViolationSource;
  severity?: ViolationSeverity;
  evidence?: string; // bukti/ukuran yang terukur sensor
  count?: number; // urutan kejadian
  elapsedSeconds?: number; // detik sejak ujian dimulai
  questionNumber?: number; // soal yang sedang dikerjakan saat kejadian
}

export type ExamType = "pg" | "essay" | "campuran";

export interface MCQOption {
  label: string; // huruf pilihan: "A" s/d "F"
  text: string;
}

export interface ExamQuestion {
  id: string;
  number: number;
  type?: QuestionKind; // "pg" | "essay"; tidak ada = essay (data lama)
  question: string;
  answerKey: string; // essay: kunci uraian model guru; pg: pembahasan opsional
  keywords: string[];
  rubricGuide: string;
  maxScore: number;
  options?: MCQOption[]; // khusus pilihan ganda
  correctAnswer?: string; // khusus pilihan ganda: label kunci ("A".."F")
}

/** @deprecated Gunakan ExamQuestion. Alias ini dipertahankan untuk kompatibilitas kode lama. */
export type EssayQuestion = ExamQuestion;

export type ExamPublishStatus = "draft" | "published";

export interface Exam {
  id: string;
  title: string;
  subject: string;
  targetClassId: string;
  targetClassName: string;
  teacherId: string;
  teacherName: string;
  examDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationMinutes: number;
  passingGrade: number; // KKM (default 75)
  status: ExamPublishStatus;
  examType?: ExamType; // "pg" | "essay" | "campuran"; tidak ada = diturunkan dari soal
  questions: ExamQuestion[];
  allowCamera: boolean;
  lockdownMode: boolean;
  createdAt: string;
}

export interface QuestionGrading {
  questionId: string;
  studentAnswer: string;
  scoreAwarded: number;
  maxScore: number;
  percentage: number;
  matchedKeyPoints: string[];
  missingKeyPoints: string[];
  feedback: string;
  isCorrect?: boolean; // koreksi otomatis pilihan ganda (benar/salah)
  teacherAdjustment?: number;
  teacherNotes?: string;
}

export interface ExamSubmission {
  id: string;
  examId: string;
  examTitle: string;
  subject: string;
  studentId: string;
  studentNisn?: string;
  studentName: string;
  studentClassId: string;
  studentClassName: string;
  studentClass?: string;
  startedAt: string;
  submittedAt: string;
  answers: Record<string, string>; // questionId -> answer text
  gradings: Record<string, QuestionGrading>;
  totalScore: number; // 0 - 100
  rawScore?: number;
  maxPossibleScore?: number;
  isPassed: boolean;
  violationCount: number;
  violationLogs: ViolationLog[];
  status: "in_progress" | "submitted" | "graded";
  answeredCount?: number;
  totalQuestions?: number;
  lastActiveAt?: string;
}

export type ExamAvailability =
  | "draft"
  | "upcoming"
  | "active"
  | "ended"
  | "already_completed";
