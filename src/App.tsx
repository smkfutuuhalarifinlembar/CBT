import { useState, useEffect } from "react";
import { User, Exam, ExamSubmission, ClassRoom, SchoolProfile } from "./types";
import { storage, INITIAL_SCHOOL_PROFILE } from "./services/storage";
import { Header } from "./components/common/Header";
import { Login } from "./components/auth/Login";
import { StudentDashboard } from "./components/student/StudentDashboard";
import { StudentExamSession } from "./components/exam/StudentExamSession";
import { ExamScoreResult } from "./components/exam/ExamScoreResult";
import { TeacherDashboard } from "./components/teacher/TeacherDashboard";
import { ExamEditorModal } from "./components/teacher/ExamEditorModal";
import { TeacherSubmissionsModal } from "./components/teacher/TeacherSubmissionsModal";
import { AdminDashboard } from "./components/admin/AdminDashboard";
import { PromptDocsModal } from "./components/common/PromptDocsModal";

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => storage.getCurrentUser());
  const [users, setUsers] = useState<User[]>(() => storage.getUsers());
  const [classes, setClasses] = useState<ClassRoom[]>(() => storage.getClasses());
  const [exams, setExams] = useState<Exam[]>(() => storage.getExams());
  const [submissions, setSubmissions] = useState<ExamSubmission[]>(() => storage.getSubmissions());
  const [schoolProfile, setSchoolProfile] = useState(() => storage.getSchoolProfile());

  // Active views / modals
  const [activeExamSession, setActiveExamSession] = useState<Exam | null>(null);
  const [previewExam, setPreviewExam] = useState<Exam | null>(null);
  const [viewingScore, setViewingScore] = useState<{ exam: Exam; submission: ExamSubmission } | null>(null);
  const [editorExam, setEditorExam] = useState<Exam | null>(null);
  const [isCreatingExam, setIsCreatingExam] = useState<boolean>(false);
  const [viewingSubmissionsExam, setViewingSubmissionsExam] = useState<Exam | null>(null);
  const [showPromptDocs, setShowPromptDocs] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<{ scope: string; message: string } | null>(null);

  // Sync state helpers
  const refreshData = () => {
    setUsers(storage.getUsers());
    setClasses(storage.getClasses());
    setExams(storage.getExams());
    setSubmissions(storage.getSubmissions());
    setSchoolProfile(storage.getSchoolProfile());
    setCurrentUser(storage.getCurrentUser());
  };

  useEffect(() => {
    const onDataChanged = () => {
      setUsers(storage.getUsers());
      setClasses(storage.getClasses());
      setExams(storage.getExams());
      setSubmissions(storage.getSubmissions());
    setSchoolProfile(storage.getSchoolProfile());
    };
    const onUserChanged = (e: any) => {
      setCurrentUser(e.detail || null);
    };
    const onSaveError = (e: any) => {
      setSaveError({
        scope: e?.detail?.scope || "data",
        message: e?.detail?.message || "Gagal menyimpan ke server",
      });
    };

    window.addEventListener("edu_data_changed", onDataChanged);
    window.addEventListener("edu_school_changed", onDataChanged);
    window.addEventListener("edu_user_changed", onUserChanged);
    window.addEventListener("edu_save_error", onSaveError);
    return () => {
      window.removeEventListener("edu_data_changed", onDataChanged);
      window.removeEventListener("edu_school_changed", onDataChanged);
      window.removeEventListener("edu_user_changed", onUserChanged);
      window.removeEventListener("edu_save_error", onSaveError);
    };
  }, []);

  const handleUserSelect = (user: User) => {
    storage.setCurrentUser(user);
    setCurrentUser(user);
  };

  const handleLogout = () => {
    storage.logout();
    setCurrentUser(null);
    setActiveExamSession(null);
    setPreviewExam(null);
    setViewingScore(null);
  };

  const handleAddUser = async (newUser: User) => {
    await storage.saveUser(newUser);
    refreshData();
  };

  const handleBulkAddUsers = async (newUsers: User[]) => {
    await storage.saveUsersBulk(newUsers);
    refreshData();
  };

  const handleDeleteUser = (userId: string) => {
    storage.deleteUser(userId);
    refreshData();
  };

  const handleFinishExam = (submission: ExamSubmission) => {
    refreshData();
    const currentExam = activeExamSession || previewExam;
    setActiveExamSession(null);
    setPreviewExam(null);
    if (currentExam) {
      setViewingScore({ exam: currentExam, submission });
    }
  };

  const handleSaveExam = (exam: Exam, shouldPublish: boolean) => {
    const updatedExam: Exam = {
      ...exam,
      status: shouldPublish ? "published" : "draft",
    };
    storage.saveExam(updatedExam);
    refreshData();
    setEditorExam(null);
    setIsCreatingExam(false);
  };

  const handleTogglePublish = (exam: Exam) => {
    const newStatus = exam.status === "published" ? "draft" : "published";
    const updated = { ...exam, status: newStatus as "draft" | "published" };
    storage.saveExam(updated);
    refreshData();
  };

  const handleDeleteExam = (examId: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus ujian ini?")) {
      storage.deleteExam(examId);
      refreshData();
    }
  };

  const handleUpdateSubmission = (sub: ExamSubmission) => {
    storage.saveSubmission(sub);
    refreshData();
  };

  const handleSaveSchoolProfile = async (profile: SchoolProfile) => {
    setSchoolProfile(profile);
    const ok = await storage.saveSchoolProfile(profile);
    if (!ok) {
      // Lempar agar form menampilkan pesan gagal (bukan "berhasil")
      throw new Error("data hanya tersimpan di perangkat ini, server menolak/gagal");
    }
  };

  const handleResetSchoolProfile = () => {
    if (confirm("Kembalikan identitas dan logo sekolah ke pengaturan bawaan?")) {
      const defaultProfile = { ...INITIAL_SCHOOL_PROFILE };
      void storage.saveSchoolProfile(defaultProfile);
      setSchoolProfile(defaultProfile);
      alert("Identitas sekolah berhasil dikembalikan ke pengaturan awal!");
    }
  };

  const handleResetData = () => {
    if (confirm("Reset data akan mengembalikan seluruh data contoh ke kondisi awal. Lanjutkan?")) {
      storage.resetAllData();
      refreshData();
      alert("Seluruh data contoh berhasil di-reset!");
    }
  };

  const handleAddClass = (newClass: ClassRoom) => {
    storage.saveClass(newClass);
    refreshData();
  };

  // If user is not logged in, render the Login portal
  if (!currentUser) {
    return (
      <>
        <Login schoolProfile={schoolProfile}
          onLoginSuccess={(user) => {
            setCurrentUser(user);
            refreshData();
          }}
          onOpenPromptDocs={() => setShowPromptDocs(true)}
        />
        <PromptDocsModal
          isOpen={showPromptDocs}
          onClose={() => setShowPromptDocs(false)}
        />
      </>
    );
  }

  // If student is actively taking an exam
  if (activeExamSession) {
    return (
      <StudentExamSession
        exam={activeExamSession}
        student={currentUser}
        onFinishExam={handleFinishExam}
      />
    );
  }

  // If teacher is previewing the exam
  if (previewExam) {
    return (
      <StudentExamSession
        exam={previewExam}
        student={currentUser}
        isPreviewMode={true}
        onCancelPreview={() => setPreviewExam(null)}
        onFinishExam={handleFinishExam}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Navigation */}
      <Header schoolProfile={schoolProfile}
        currentUser={currentUser}
        users={users}
        onSelectUser={handleUserSelect}
        onLogout={handleLogout}
        onOpenPromptDocs={() => setShowPromptDocs(true)}
        onUpdateCurrentUser={(updatedUser) => {
          storage.saveUser(updatedUser);
          setCurrentUser(updatedUser);
        }}
      />

      {/* Peringatan global: ada data yang gagal tersimpan di server */}
      {saveError && (
        <div className="w-full bg-rose-600 text-white px-4 sm:px-6 py-2.5 flex items-start justify-between gap-3 text-xs font-semibold shadow">
          <span>
            Gagal menyimpan {saveError.scope} ke server: {saveError.message}. Data masih
            tersimpan di perangkat ini, tetapi akan hilang saat sinkronisasi — periksa
            koneksi server lalu ulangi simpan.
          </span>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className="shrink-0 underline hover:no-underline"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Main Role Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8">
        {currentUser.role === "siswa" && (
          <StudentDashboard
            student={currentUser}
            exams={exams}
            submissions={submissions}
            onStartExam={(exam) => {
              const existing = storage.getSubmissionByExamAndStudent(exam.id, currentUser.id);
              if (existing && (existing.status === "graded" || existing.status === "submitted")) {
                alert("Anda sudah mengumpulkan ujian ini dan tidak dapat mengerjakan kembali.");
                setViewingScore({ exam, submission: existing });
                return;
              }
              setActiveExamSession(exam);
            }}
            onViewScore={(exam, sub) => setViewingScore({ exam, submission: sub })}
          />
        )}

        {currentUser.role === "guru" && (
          <TeacherDashboard
            currentUser={currentUser}
            exams={exams}
            submissions={submissions}
            classes={classes}
            users={users}
            onOpenCreate={() => setIsCreatingExam(true)}
            onOpenEdit={(exam) => setEditorExam(exam)}
            onPreviewExam={(exam) => setPreviewExam(exam)}
            onOpenSubmissions={(exam) => setViewingSubmissionsExam(exam)}
            onTogglePublish={handleTogglePublish}
            onDeleteExam={handleDeleteExam}
          />
        )}

        {currentUser.role === "admin" && (
          <AdminDashboard
            schoolProfile={schoolProfile}
            onSaveSchoolProfile={handleSaveSchoolProfile}
            onResetSchoolProfile={handleResetSchoolProfile}
            currentUser={currentUser}
            users={users}
            classes={classes}
            exams={exams}
            submissions={submissions}
            onResetData={handleResetData}
            onAddClass={handleAddClass}
            onAddUser={handleAddUser}
            onUpdateUser={handleAddUser}
            onBulkAddUsers={handleBulkAddUsers}
            onDeleteUser={handleDeleteUser}
            onRefreshData={refreshData}
          />
        )}
      </main>

      {/* Modals */}
      {/* 1. Exam Score Result Modal */}
      {viewingScore && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="max-w-4xl w-full my-auto">
            <ExamScoreResult
              exam={viewingScore.exam}
              submission={viewingScore.submission}
              onClose={() => setViewingScore(null)}
            />
          </div>
        </div>
      )}

      {/* 2. Exam Editor Modal (Create / Edit & Preview) */}
      {(isCreatingExam || editorExam) && (
        <ExamEditorModal
          examToEdit={editorExam}
          classes={classes}
          currentUser={currentUser}
          onSave={handleSaveExam}
          onPreview={(examDraft) => {
            setEditorExam(null);
            setIsCreatingExam(false);
            setPreviewExam(examDraft);
          }}
          onClose={() => {
            setIsCreatingExam(false);
            setEditorExam(null);
          }}
        />
      )}

      {/* 3. Teacher Submissions Review Modal */}
      {viewingSubmissionsExam && (
        <TeacherSubmissionsModal
          exam={viewingSubmissionsExam}
          submissions={submissions}
          onUpdateSubmission={handleUpdateSubmission}
          onClose={() => setViewingSubmissionsExam(null)}
        />
      )}

      {/* 4. Master Prompt & Specs Modal */}
      <PromptDocsModal
        isOpen={showPromptDocs}
        onClose={() => setShowPromptDocs(false)}
      />

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500">
        <p>
          Sistem Ujian Essay/Uraian Online • AI Keyword & Concept Matcher • Powered by Google Gemini 3.8 Flash
        </p>
      </footer>
    </div>
  );
}
