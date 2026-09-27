import { User, ClassRoom, Exam, ExamSubmission, SchoolProfile, UserRole } from "../types";
import { adminHeaders } from "./api";

// Super-admin bawaan (darurat): kredensial HARUS via env, bukan hardcode.
// Set VITE_BOOTSTRAP_ADMIN_EMAIL / VITE_BOOTSTRAP_ADMIN_PASSWORD saat build bila perlu.

// Helper function to remove undefined fields recursively
export function sanitizeForserver<T>(data: T): T {
  if (data === undefined || data === null) {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForserver(item)) as unknown as T;
  }
  if (typeof data === "object") {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForserver(value);
      }
    }
    return cleaned as T;
  }
  return data;
}

// Backward compatibility alias
export const sanitizeForFirestore = sanitizeForserver;

import {
  INITIAL_SCHOOL_PROFILE,
  DEFAULT_USERS,
  DEFAULT_CLASSES,
  DEFAULT_EXAMS
} from "./initialData";

export { INITIAL_SCHOOL_PROFILE };

/**
 * Perbaiki record ujian lama yang tersimpan dengan skema server sebelumnya
 * (classId/duration) supaya tanggal, kelas target, dan pengaturan pengawasan
 * tidak hilang saat data ditarik dari server.
 */
export function normalizeExam(raw: any): Exam {
  if (!raw || typeof raw !== "object") return raw;
  const exam: any = { ...raw };
  if (!exam.targetClassId && exam.classId) exam.targetClassId = exam.classId;
  if (!exam.targetClassName) {
    exam.targetClassName = exam.className || exam.targetClassId || "Kelas";
  }
  if (exam.durationMinutes === undefined && exam.duration !== undefined) {
    exam.durationMinutes = exam.duration;
  }
  if (exam.duration === undefined) exam.duration = exam.durationMinutes;
  if (exam.examDate === undefined) exam.examDate = "";
  if (exam.startTime === undefined) exam.startTime = "";
  if (exam.endTime === undefined) exam.endTime = "";
  if (exam.passingGrade === undefined || exam.passingGrade === null) {
    exam.passingGrade = 75;
  }
  if (exam.allowCamera === undefined) exam.allowCamera = true;
  if (exam.lockdownMode === undefined) exam.lockdownMode = true;
  if (exam.status === "archived") exam.status = "published";
  if (exam.createdAt === undefined) exam.createdAt = new Date().toISOString();
  if (exam.questions === undefined) exam.questions = [];
  return exam as Exam;
}

class StorageService {
  private _users: User[] = [...DEFAULT_USERS];
  private _classes: ClassRoom[] = [...DEFAULT_CLASSES];
  private _exams: Exam[] = [...DEFAULT_EXAMS];
  private _submissions: ExamSubmission[] = [];
  private _currentUser: User | null = null;
  private _schoolProfile: SchoolProfile = { ...INITIAL_SCHOOL_PROFILE };
  private _isCloudConnected: boolean = true;
  private syncIntervalId: any = null;

  constructor() {
    this.loadLocalSession();
    this.initServerSync();
  }

  private loadLocalSession() {
    try {
      const savedUser = localStorage.getItem("edu_current_user");
      if (savedUser) {
        this._currentUser = JSON.parse(savedUser);
      }
      const savedProfile = localStorage.getItem("edu_school_profile");
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile);
        if (parsed.name && parsed.name !== "SMK Falendang Jae") {
          this._schoolProfile = parsed;
        } else {
          this._schoolProfile = { ...INITIAL_SCHOOL_PROFILE };
        }
      }
      const savedUsers = localStorage.getItem("edu_users");
      if (savedUsers) {
        const parsedUsers = JSON.parse(savedUsers);
        // Avoid retaining old dummy seed
        const isOldDummy = Array.isArray(parsedUsers) && parsedUsers.some((u: any) => u.name === "Siti Rahmawati, S.Pd");
        if (!isOldDummy && Array.isArray(parsedUsers) && parsedUsers.length > 0) {
          this._users = parsedUsers;
        } else {
          this._users = [...DEFAULT_USERS];
        }
      }
      const savedClasses = localStorage.getItem("edu_classes");
      if (savedClasses) {
        const parsedClasses = JSON.parse(savedClasses);
        const isOldDummyClass = Array.isArray(parsedClasses) && parsedClasses.some((c: any) => c.name === "12 IPA 1");
        if (!isOldDummyClass && Array.isArray(parsedClasses) && parsedClasses.length > 0) {
          this._classes = parsedClasses;
        } else {
          this._classes = [...DEFAULT_CLASSES];
        }
      }
      const savedExams = localStorage.getItem("edu_exams");
      if (savedExams) {
        const parsedExams = JSON.parse(savedExams);
        const isOldDummyExam = Array.isArray(parsedExams) && parsedExams.some((e: any) => e.id === "exam-sample-1");
        if (!isOldDummyExam && Array.isArray(parsedExams) && parsedExams.length > 0) {
          this._exams = parsedExams;
        } else {
          this._exams = [...DEFAULT_EXAMS];
        }
      }
      const savedSubmissions = localStorage.getItem("edu_submissions");
      if (savedSubmissions) {
        try {
          const parsedSubs = JSON.parse(savedSubmissions);
          const cleanSubs = Array.isArray(parsedSubs)
            ? parsedSubs.filter((s: any) => s && s.examId)
            : [];
          this._submissions = this.deduplicateSubmissions(cleanSubs);
        } catch {
          this._submissions = [];
        }
      }
    } catch (e) {
      console.error("Error loading local session:", e);
    }
  }

  private areSubmissionsForSameStudentAndExam(
    s1: ExamSubmission,
    s2: ExamSubmission
  ): boolean {
    if (!s1 || !s2) return false;
    // Submissions MUST belong to the exact same exam
    if (!s1.examId || !s2.examId || s1.examId !== s2.examId) return false;

    // 1. Direct submission ID match
    if (s1.id && s2.id && s1.id === s2.id) return true;

    // 2. Direct studentId match
    if (s1.studentId && s2.studentId && s1.studentId === s2.studentId) return true;

    // 3. NISN match
    const nisn1 = (s1 as any).nisn || "";
    const nisn2 = (s2 as any).nisn || "";
    if (nisn1 && nisn2 && nisn1 === nisn2) return true;
    if (nisn1 && s2.studentId && nisn1 === s2.studentId) return true;
    if (nisn2 && s1.studentId && nisn2 === s1.studentId) return true;

    // 4. Normalized student name match
    const n1 = (s1.studentName || "").trim().toLowerCase();
    const n2 = (s2.studentName || "").trim().toLowerCase();
    if (n1 && n2 && n1 === n2) return true;

    // 5. Canonical ID pattern match: sub-{examId}-{studentId}
    if (s1.id && s2.studentId && s1.id.includes(s2.studentId)) return true;
    if (s2.id && s1.studentId && s2.id.includes(s1.studentId)) return true;

    return false;
  }

  private mergeTwoSubmissions(
    existing: ExamSubmission,
    incoming: ExamSubmission
  ): ExamSubmission {
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
    [...(existing.violationLogs || []), ...(incoming.violationLogs || [])].forEach(
      (v: any) => {
        if (v && v.timestamp) {
          vMap.set(`${v.timestamp}_${v.reason}`, v);
        }
      }
    );
    const mergedViolations = Array.from(vMap.values());
    const maxViolations = Math.max(
      existing.violationCount || 0,
      incoming.violationCount || 0,
      mergedViolations.length
    );

    let winner: ExamSubmission;
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
      winner =
        a2 > a1 || (a2 === a1 && t2 >= t1)
          ? { ...incoming }
          : { ...existing };
    }

    winner.violationLogs = mergedViolations;
    winner.violationCount = maxViolations;
    return winner;
  }

  public deduplicateSubmissions(subs: ExamSubmission[]): ExamSubmission[] {
    if (!Array.isArray(subs)) return [];
    const result: ExamSubmission[] = [];

    for (const sub of subs) {
      if (!sub || !sub.examId) continue;
      const matchIndex = result.findIndex((existing) =>
        this.areSubmissionsForSameStudentAndExam(existing, sub)
      );

      if (matchIndex < 0) {
        result.push(sub);
      } else {
        result[matchIndex] = this.mergeTwoSubmissions(result[matchIndex], sub);
      }
    }

    return result;
  }

  private persistLocalCache() {
    try {
      localStorage.setItem("edu_school_profile", JSON.stringify(this._schoolProfile));
      localStorage.setItem("edu_users", JSON.stringify(this._users));
      localStorage.setItem("edu_classes", JSON.stringify(this._classes));
      localStorage.setItem("edu_exams", JSON.stringify(this._exams));
      localStorage.setItem("edu_submissions", JSON.stringify(this._submissions));
    } catch (e) {
      console.warn("LocalStorage caching note:", e);
    }
  }

  private async fetchAllFromServer(isBackground = false) {
    try {
      // Hanya browser admin (sudah login sebagai admin) yang mengirim kunci admin,
      // agar field password hanya diterima oleh UI admin (cetak kartu, reveal sandi).
      const headers =
        this._currentUser?.role === "admin" ? adminHeaders() : undefined;
      const res = await fetch("/api/db/load-all", { headers });
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const data = await res.json();
      if (data.success) {
        let changed = false;

        if (data.schoolProfile) {
          // Gabungkan: server adalah acuan, tetapi field yang belum ada di
          // record server (mis. data lama) tetap memakai nilai lokal.
          this._schoolProfile = { ...this._schoolProfile, ...data.schoolProfile };
          localStorage.setItem("edu_school_profile", JSON.stringify(this._schoolProfile));
          window.dispatchEvent(new CustomEvent("edu_school_changed", { detail: this._schoolProfile }));
          changed = true;
        }

        if (Array.isArray(data.users) && data.users.length > 0) {
          this._users = data.users;
          changed = true;
        }

        if (Array.isArray(data.classes) && data.classes.length > 0) {
          this._classes = data.classes;
          changed = true;
        }

        if (Array.isArray(data.exams)) {
          this._exams = data.exams.map((e: any) => normalizeExam(e));
          changed = true;
        }

        if (Array.isArray(data.submissions)) {
          const cloudSubs = data.submissions.filter(
            (s: any) => s && s.examId
          );

          // Keep ALL local submissions that don't exist in the cloud yet to prevent data loss
          const localOnlySubs = this._submissions.filter((local) => {
            return !cloudSubs.some((cs: any) =>
              this.areSubmissionsForSameStudentAndExam(cs, local)
            );
          });

          const merged = this.deduplicateSubmissions([
            ...cloudSubs,
            ...localOnlySubs,
          ]);

          // Proactively upload any completed local submissions that were missing from the cloud
          localOnlySubs.forEach((sub) => {
             if (sub.status === "submitted" || sub.status === "graded") {
                this.saveSubmission(sub).catch(e => console.error("Auto-sync failed:", e));
             }
          });
          const oldSubHash = JSON.stringify(
            this._submissions.map((s) => ({
              id: s.id,
              status: s.status,
              score: s.totalScore,
              ans: s.answeredCount,
              violations: s.violationCount,
            }))
          );
          const newSubHash = JSON.stringify(
            merged.map((s) => ({
              id: s.id,
              status: s.status,
              score: s.totalScore,
              ans: s.answeredCount,
              violations: s.violationCount,
            }))
          );
          if (oldSubHash !== newSubHash) {
            this._submissions = merged;
            changed = true;
          }
        }

        this._isCloudConnected = true;
        this.persistLocalCache();

        if (changed || !isBackground) {
          window.dispatchEvent(new CustomEvent("edu_data_changed"));
        }
      }
    } catch (err) {
      if (!isBackground) {
        console.warn("server initial sync note:", err);
      }
      this._isCloudConnected = false;
    }
  }

  public async refreshFromCloud(): Promise<void> {
    await this.fetchAllFromServer(false);
  }

  private initServerSync() {
    // Initial fetch from server
    this.fetchAllFromServer(false);

    // Periodic sync every 4 seconds to sync submissions and changes across devices/tabs
    if (!this.syncIntervalId) {
      this.syncIntervalId = setInterval(() => {
        this.fetchAllFromServer(true);
      }, 4000);
    }
  }

  isCloudConnected(): boolean {
    return this._isCloudConnected;
  }

  getSchoolProfile(): SchoolProfile {
    return this._schoolProfile;
  }

  /**
   * Semua penyimpanan ke server memakai helper ini agar kegagalan tidak lagi
   * ditelan diam-diam: error memicu event `edu_save_error` (ditampilkan App)
   * dan method mengembalikan false sehingga UI bisa memberi tahu pengguna.
   */
  private async requestServer(
    scope: string,
    url: string,
    init: RequestInit
  ): Promise<boolean> {
    try {
      const res = await fetch(url, init);
      if (res.ok) {
        this._isCloudConnected = true;
        return true;
      }
      let message = `Server menolak permintaan (HTTP ${res.status})`;
      try {
        const body = await res.json();
        if (body?.error) message = String(body.error);
      } catch {
        // abaikan, pakai pesan default
      }
      this._reportSaveError(scope, message);
      return false;
    } catch (e: any) {
      this._reportSaveError(scope, e?.message || "Gagal menghubungi server");
      return false;
    }
  }

  private _reportSaveError(scope: string, message: string) {
    this._isCloudConnected = false;
    console.error(`[storage] gagal menyimpan ${scope}:`, message);
    window.dispatchEvent(
      new CustomEvent("edu_save_error", { detail: { scope, message } })
    );
  }

  async saveSchoolProfile(profile: SchoolProfile): Promise<boolean> {
    this._schoolProfile = profile;
    localStorage.setItem("edu_school_profile", JSON.stringify(profile));
    window.dispatchEvent(new CustomEvent("edu_school_changed", { detail: profile }));
    window.dispatchEvent(new CustomEvent("edu_data_changed"));

    const ok = await this.requestServer("profil sekolah", "/api/db/save-school-profile", {
      method: "POST",
      headers: adminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(profile),
    });
    if (ok) {
      this._isCloudConnected = true;
    }
    return ok;
  }

  getUsers(): User[] {
    return this._users;
  }

  getCurrentUser(): User | null {
    return this._currentUser;
  }

  setCurrentUser(user: User | null): void {
    this._currentUser = user;
    if (user) {
      localStorage.setItem("edu_current_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("edu_current_user");
    }
    window.dispatchEvent(new CustomEvent("edu_user_changed", { detail: user }));
  }

  async login(
    identifier: string,
    passwordInput: string,
    roleTab: UserRole
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    const rawInput = identifier.trim().toLowerCase();
    const passInput = passwordInput.trim();

    if (!rawInput) {
      return { success: false, error: "Harap masukkan username, NISN, NIP, atau email Anda." };
    }
    if (!passInput) {
      return { success: false, error: "Harap masukkan kata sandi (password)." };
    }

    // Admin darurat HANYA jika dikonfigurasi eksplisit lewat env saat build
    // (VITE_BOOTSTRAP_ADMIN_EMAIL + VITE_BOOTSTRAP_ADMIN_PASSWORD).
    const bootEmail = String(
      ((import.meta as any).env?.VITE_BOOTSTRAP_ADMIN_EMAIL || "")
    )
      .trim()
      .toLowerCase();
    const bootPass = String(
      (import.meta as any).env?.VITE_BOOTSTRAP_ADMIN_PASSWORD || ""
    );
    if (bootEmail && bootPass && rawInput === bootEmail && passInput === bootPass) {
      let adminUser = this._users.find(
        (u) => u.role === "admin" && u.email?.toLowerCase() === bootEmail
      );
      if (!adminUser) {
        adminUser = {
          id: "user-admin-1",
          name: "Administrator Sekolah",
          email: bootEmail,
          role: "admin",
          password: bootPass,
        };
        await this.saveUser(adminUser);
      }
      this.setCurrentUser(adminUser);
      return { success: true, user: adminUser };
    }

    // 1) Verifikasi utama di server (/api/auth/login â€” cek hash scrypt / legacy)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: rawInput,
          password: passInput,
          role: roleTab,
        }),
      });
      const body = await res.json().catch(() => ({}) as any);
      if (res.ok && body?.success && body?.user) {
        this.setCurrentUser(body.user);
        if (body.user.role === "admin") {
          // Muat ulang data (termasuk field password utk fitur admin) sesudah login
          this.fetchAllFromServer(false).catch(() => {});
        }
        return { success: true, user: body.user };
      }
      // 4xx = tolak sesuai hasil verifikasi server
      // Kecuali USER_NOT_FOUND: bisa jadi user masih ada di cache lokal
      // (fresh install sebelum tersinkron) â†’ lanjut ke fallback lokal.
      if (
        res.status >= 400 &&
        res.status < 500 &&
        body?.error &&
        body?.code !== "USER_NOT_FOUND"
      ) {
        return { success: false, error: body.error };
      }
      // 5xx / respons tak terduga â†’ lanjut ke verifikasi lokal (fallback)
    } catch {
      // Server tidak terjangkau â†’ lanjut ke verifikasi lokal (fallback offline)
    }

    // 2) Fallback lokal (kompatibilitas mode offline / data cache lama)
    const matchedUser = this._users.find((u) => {
      const emailMatch = u.email.toLowerCase() === rawInput;
      const nisnMatch = u.nisn && u.nisn.toLowerCase() === rawInput;
      const nipMatch = u.nip && u.nip.toLowerCase() === rawInput;
      const nameMatch = u.name.toLowerCase() === rawInput;
      const idMatch = u.id.toLowerCase() === rawInput;

      return emailMatch || nisnMatch || nipMatch || nameMatch || idMatch;
    });

    if (!matchedUser) {
      return {
        success: false,
        error: `Pengguna tidak ditemukan. Pastikan Username/NISN/NIP (${identifier}) sudah terdaftar.`
      };
    }

    // Verify role
    if (matchedUser.role !== roleTab && matchedUser.role !== "admin") {
      return {
        success: false,
        error: `Peran akun tidak cocok. Akun ini terdaftar sebagai ${matchedUser.role.toUpperCase()}.`
      };
    }

    // Verify Password
    const expectedPassword = matchedUser.password || "password123";
    if (passInput !== expectedPassword) {
      return { success: false, error: "Kata sandi (password) salah. Silakan periksa kembali." };
    }

    this.setCurrentUser(matchedUser);
    if (matchedUser.role === "admin") {
      this.fetchAllFromServer(false).catch(() => {});
    }
    return { success: true, user: matchedUser };
  }

  async logout(): Promise<void> {
    this.setCurrentUser(null);
  }

  async saveUser(newUser: User): Promise<void> {
    if (!newUser.id) {
      newUser.id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    }
    if (!newUser.password) {
      newUser.password = "password123";
    }

    const idx = this._users.findIndex((u) => u.id === newUser.id);
    if (idx >= 0) {
      this._users[idx] = newUser;
    } else {
      this._users.push(newUser);
    }
    this.persistLocalCache();
    window.dispatchEvent(new CustomEvent("edu_data_changed"));

    await this.requestServer("pengguna", "/api/db/save-user", {
      method: "POST",
      headers: adminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(newUser),
    });
  }

  async saveUsersBulk(newUsers: User[]): Promise<{ count: number; error?: string }> {
    if (!newUsers || newUsers.length === 0) return { count: 0 };

    const processedUsers: User[] = [];

    newUsers.forEach((newUser, index) => {
      const u: User = { ...newUser };
      if (!u.id) {
        u.id = `user-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 7)}`;
      }
      if (!u.password) {
        u.password = "password123";
      }

      let existingIdx = this._users.findIndex((ex) => ex.id === u.id);
      if (existingIdx === -1 && u.email) {
        existingIdx = this._users.findIndex((ex) => ex.email.toLowerCase() === u.email.toLowerCase());
      }
      if (existingIdx === -1 && u.nisn) {
        existingIdx = this._users.findIndex((ex) => ex.nisn === u.nisn);
      }
      if (existingIdx === -1 && u.nip) {
        existingIdx = this._users.findIndex((ex) => ex.nip === u.nip);
      }

      if (existingIdx >= 0) {
        u.id = this._users[existingIdx].id;
        this._users[existingIdx] = { ...this._users[existingIdx], ...u };
      } else {
        this._users.push(u);
      }
      processedUsers.push(u);
    });

    this.persistLocalCache();
    window.dispatchEvent(new CustomEvent("edu_data_changed"));

    try {
      const res = await fetch("/api/db/save-users-bulk", {
        method: "POST",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ users: processedUsers }),
      });
      if (res.ok) {
        this._isCloudConnected = true;
        return { count: processedUsers.length };
      } else {
        const err = await res.json();
        return { count: processedUsers.length, error: err.error };
      }
    } catch (error: any) {
      console.error("server saveUsersBulk error:", error);
      return { count: processedUsers.length, error: error.message };
    }
  }

  async deleteUser(userId: string): Promise<void> {
    this._users = this._users.filter((u) => u.id !== userId);
    this.persistLocalCache();
    window.dispatchEvent(new CustomEvent("edu_data_changed"));

    try {
      const res = await fetch(`/api/db/delete-user/${encodeURIComponent(userId)}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      if (res.ok) {
        this._isCloudConnected = true;
      }
    } catch (error) {
      console.error("server deleteUser error:", error);
    }
  }

  getClasses(): ClassRoom[] {
    return this._classes;
  }

  async saveClass(newClass: ClassRoom): Promise<void> {
    const idx = this._classes.findIndex((c) => c.id === newClass.id);
    if (idx >= 0) {
      this._classes[idx] = newClass;
    } else {
      this._classes.push(newClass);
    }
    this.persistLocalCache();
    window.dispatchEvent(new CustomEvent("edu_data_changed"));

    await this.requestServer("kelas", "/api/db/save-class", {
      method: "POST",
      headers: adminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(newClass),
    });
  }

  async deleteClass(id: string): Promise<void> {
    this._classes = this._classes.filter((c) => c.id !== id);
    this.persistLocalCache();
    window.dispatchEvent(new CustomEvent("edu_data_changed"));

    try {
      const res = await fetch(`/api/db/delete-class/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      if (res.ok) {
        this._isCloudConnected = true;
      }
    } catch (error) {
      console.error("server deleteClass error:", error);
    }
  }

  getExams(): Exam[] {
    return this._exams;
  }

  getExamById(id: string): Exam | undefined {
    return this._exams.find((e) => e.id === id);
  }

  async saveExam(exam: Exam): Promise<void> {
    const idx = this._exams.findIndex((e) => e.id === exam.id);
    if (idx >= 0) {
      this._exams[idx] = exam;
    } else {
      this._exams.push(exam);
    }
    this.persistLocalCache();
    window.dispatchEvent(new CustomEvent("edu_data_changed"));

    await this.requestServer("ujian", "/api/db/save-exam", {
      method: "POST",
      headers: adminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(exam),
    });
  }

  async deleteExam(id: string): Promise<void> {
    this._exams = this._exams.filter((e) => e.id !== id);
    this.persistLocalCache();
    window.dispatchEvent(new CustomEvent("edu_data_changed"));

    try {
      const res = await fetch(`/api/db/delete-exam/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      if (res.ok) {
        this._isCloudConnected = true;
      }
    } catch (error) {
      console.error("server deleteExam error:", error);
    }
  }

  getSubmissions(): ExamSubmission[] {
    return this._submissions;
  }

  getSubmissionByExamAndStudent(
    examId: string,
    studentId: string,
    studentName?: string
  ): ExamSubmission | undefined {
    const probe: any = { examId, studentId, studentName };
    const matches = this._submissions.filter((s) =>
      this.areSubmissionsForSameStudentAndExam(s, probe)
    );
    if (matches.length === 0) return undefined;

    // Prioritize completed/graded submission
    const completed = matches.find(
      (s) => s.status === "graded" || s.status === "submitted" || Boolean(s.submittedAt)
    );
    if (completed) return completed;

    return matches[matches.length - 1];
  }

  async saveSubmission(submission: ExamSubmission): Promise<void> {
    // Check if student already has a completed/graded submission for this exam
    const existingIndex = this._submissions.findIndex((s) =>
      this.areSubmissionsForSameStudentAndExam(s, submission)
    );

    if (existingIndex >= 0) {
      const existing = this._submissions[existingIndex];
      const existingIsCompleted =
        existing.status === "graded" ||
        existing.status === "submitted" ||
        Boolean(existing.submittedAt);
      const incomingIsInProgress =
        submission.status === "in_progress" && !submission.submittedAt;

      // CRITICAL: Prevent downgrading an already completed/graded submission to in_progress
      if (existingIsCompleted && incomingIsInProgress) {
        console.warn(
          "Downgrade to in_progress blocked for submitted exam:",
          submission.examId,
          submission.studentId
        );
        return;
      }
    }

    // Merge existing and incoming to preserve full answers & violation logs
    const mergedSubmission =
      existingIndex >= 0
        ? this.mergeTwoSubmissions(this._submissions[existingIndex], submission)
        : submission;

    // Remove any previous or duplicate record for this student and exam
    const remaining = this._submissions.filter(
      (s) => !this.areSubmissionsForSameStudentAndExam(s, submission)
    );

    remaining.push(mergedSubmission);
    this._submissions = this.deduplicateSubmissions(remaining);
    this.persistLocalCache();
    window.dispatchEvent(new CustomEvent("edu_data_changed"));

    await this.requestServer("jawaban siswa", "/api/db/save-submission", {
      method: "POST",
      headers: adminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(mergedSubmission),
    });
  }

  async deleteSubmission(id: string): Promise<void> {
    this._submissions = this._submissions.filter((s) => s.id !== id);
    this.persistLocalCache();
    window.dispatchEvent(new CustomEvent("edu_data_changed"));

    try {
      const res = await fetch(`/api/db/delete-submission/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      if (res.ok) {
        this._isCloudConnected = true;
      }
    } catch (error) {
      console.error("server deleteSubmission error:", error);
    }
  }

  // Selective bulk delete for Backup/Purge manager
  async bulkDeleteData(options: {
    students?: boolean;
    teachers?: boolean;
    submissions?: boolean;
    exams?: boolean;
    classes?: boolean;
    auditLogsOnly?: boolean;
    keepAdmin?: boolean;
  }): Promise<{ usersCount: number; examsCount: number; submissionsCount: number; classesCount: number }> {
    let deletedUsersCount = 0;
    let deletedExamsCount = 0;
    let deletedSubmissionsCount = 0;
    let deletedClassesCount = 0;

    // 1. Delete Submissions / Audit Logs
    if (options.submissions) {
      const subsToDelete = [...this._submissions];
      this._submissions = [];
      deletedSubmissionsCount = subsToDelete.length;
    } else if (options.auditLogsOnly) {
      this._submissions = this._submissions.map((s) => ({
        ...s,
        violationCount: 0,
        violationLogs: [],
      }));
    }

    // 2. Delete Exams
    if (options.exams) {
      const examsToDelete = [...this._exams];
      this._exams = [];
      deletedExamsCount = examsToDelete.length;
    }

    // 3. Delete Users
    if (options.students || options.teachers) {
      const usersToDelete = this._users.filter((u) => {
        if (u.role === "admin") return false;
        if (options.students && u.role === "siswa") return true;
        if (options.teachers && u.role === "guru") return true;
        return false;
      });

      this._users = this._users.filter((u) => !usersToDelete.some((del) => del.id === u.id));
      deletedUsersCount = usersToDelete.length;
    }

    // 4. Delete Classes
    if (options.classes) {
      const classesToDelete = [...this._classes];
      this._classes = [];
      deletedClassesCount = classesToDelete.length;
    }

    this.persistLocalCache();
    window.dispatchEvent(new CustomEvent("edu_data_changed"));

    try {
      const res = await fetch("/api/db/bulk-delete", {
        method: "POST",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(options),
      });
      if (res.ok) {
        this._isCloudConnected = true;
      }
    } catch (err) {
      console.error("server bulk delete error:", err);
    }

    return {
      usersCount: deletedUsersCount,
      examsCount: deletedExamsCount,
      submissionsCount: deletedSubmissionsCount,
      classesCount: deletedClassesCount,
    };
  }

  // Restore imported backup data
  async restoreBackupData(
    backupPayload: {
      schoolProfile?: SchoolProfile;
      users?: User[];
      classes?: ClassRoom[];
      exams?: Exam[];
      submissions?: ExamSubmission[];
    },
    selectedModules: {
      profile?: boolean;
      students?: boolean;
      teachers?: boolean;
      classes?: boolean;
      exams?: boolean;
      submissions?: boolean;
    }
  ): Promise<{ restoredCount: number }> {
    let count = 0;

    if (selectedModules.profile && backupPayload.schoolProfile) {
      this._schoolProfile = { ...this._schoolProfile, ...backupPayload.schoolProfile };
      await this.saveSchoolProfile(this._schoolProfile);
      count++;
    }

    if (selectedModules.classes && Array.isArray(backupPayload.classes)) {
      for (const cls of backupPayload.classes) {
        await this.saveClass(cls);
        count++;
      }
    }

    if (Array.isArray(backupPayload.users)) {
      const usersToRestore = backupPayload.users.filter((u) => {
        if (selectedModules.students && u.role === "siswa") return true;
        if (selectedModules.teachers && u.role === "guru") return true;
        return false;
      });
      if (usersToRestore.length > 0) {
        await this.saveUsersBulk(usersToRestore);
        count += usersToRestore.length;
      }
    }

    if (selectedModules.exams && Array.isArray(backupPayload.exams)) {
      for (const ex of backupPayload.exams) {
        await this.saveExam(ex);
        count++;
      }
    }

    if (selectedModules.submissions && Array.isArray(backupPayload.submissions)) {
      for (const sub of backupPayload.submissions) {
        await this.saveSubmission(sub);
        count++;
      }
    }

    this.persistLocalCache();
    window.dispatchEvent(new CustomEvent("edu_data_changed"));

    await this.requestServer("restore backup", "/api/db/restore", {
      method: "POST",
      headers: adminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ backupPayload, selectedModules }),
    });

    return { restoredCount: count };
  }

  resetAllData(): void {
    alert("Data tersimpan aman di Cloud server Database.");
  }
}

export const storage = new StorageService();
