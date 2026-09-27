import React from "react";
import { useState, useRef } from "react";
import { User, SchoolProfile } from "../../types";
import {
  FileText,
  UserCheck,
  ChevronDown,
  Sparkles,
  ShieldAlert,
  GraduationCap,
  BookOpen,
  LogOut,
  School,
  Camera,
} from "lucide-react";

interface HeaderProps {
  currentUser: User;
  users: User[];
  schoolProfile?: SchoolProfile;
  onSelectUser: (user: User) => void;
  onLogout: () => void;
  onOpenPromptDocs: () => void;
  onUpdateCurrentUser?: (updatedUser: User) => void;
}

export function Header({
  currentUser,
  users,
  schoolProfile,
  onSelectUser,
  onLogout,
  onOpenPromptDocs,
  onUpdateCurrentUser,
}: HeaderProps) {
  const [showRoleMenu, setShowRoleMenu] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Ukuran foto maksimal 2MB!");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      if (onUpdateCurrentUser) {
        onUpdateCurrentUser({
          ...currentUser,
          avatar: base64,
        });
      }
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const roleBadgeStyle =
    currentUser.role === "admin"
      ? "bg-purple-100 text-purple-800 border-purple-200"
      : currentUser.role === "guru"
      ? "bg-teal-100 text-teal-800 border-teal-200"
      : "bg-indigo-100 text-indigo-800 border-indigo-200";

  const RoleIcon =
    currentUser.role === "admin"
      ? ShieldAlert
      : currentUser.role === "guru"
      ? BookOpen
      : GraduationCap;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          {schoolProfile?.logoUrl ? (
            <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 p-0.5 shadow-md overflow-hidden shrink-0 flex items-center justify-center">
              <img
                src={schoolProfile.logoUrl}
                alt="Logo Sekolah"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-700 via-indigo-600 to-teal-500 text-white flex items-center justify-center shadow-md shrink-0">
              <FileText className="w-5 h-5" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-900 text-base sm:text-lg tracking-tight">
                {schoolProfile?.headerTitle || "Sistem Ujian Essay"}
              </span>
              <span
                className={`text-[10px] uppercase font-black px-2 py-0.5 rounded border ${roleBadgeStyle}`}
              >
                Panel {currentUser.role}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              {schoolProfile?.name
                ? `${schoolProfile.name} • Pencocokan Uraian Otomatis & Anti-Kecurangan`
                : "Pencocokan Uraian Otomatis • Kamera Pengawas • Kiosk Lockdown"}
            </p>
          </div>
        </div>

        {/* Right tools */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Database Status Badge */}
          <div
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold"
            title="Tersambung ke Database PostgreSQL lokal"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Database Lokal</span>
          </div>

          {/* Prompt Master Button */}
          <button
            type="button"
            onClick={onOpenPromptDocs}
            className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 flex items-center gap-1.5 transition shadow-xs"
            title="Lihat Prompt Master AI Bahasa Indonesia"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden md:inline">Prompt Master Ujian AI</span>
            <span className="md:hidden">Prompt</span>
          </button>

          {/* User Profile Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-2xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100/80 transition"
            >
              {currentUser.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-7 h-7 rounded-xl object-cover border border-slate-200 shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                    currentUser.role === "admin"
                      ? "bg-purple-100 text-purple-700"
                      : currentUser.role === "guru"
                      ? "bg-teal-100 text-teal-700"
                      : "bg-indigo-100 text-indigo-700"
                  }`}
                >
                  <RoleIcon className="w-4 h-4" />
                </div>
              )}
              <div className="text-left hidden sm:block">
                <div className="text-xs font-bold text-slate-900 leading-tight">
                  {currentUser.name}
                </div>
                <div className="text-[10px] text-slate-500 capitalize">
                  Peran: <strong className="text-slate-800 uppercase">{currentUser.role}</strong>
                  {currentUser.className ? ` • ${currentUser.className}` : ""}
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 ml-1" />
            </button>

            {/* Dropdown */}
            {showRoleMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowRoleMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  {/* Current user summary */}
                  <div className="px-3 py-2.5 border-b border-slate-100 mb-1.5 bg-slate-50 rounded-xl flex items-center gap-3">
                    <div className="relative group shrink-0">
                      {currentUser.avatar ? (
                        <img
                          src={currentUser.avatar}
                          alt={currentUser.name}
                          className="w-11 h-11 rounded-xl object-cover border border-slate-200"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                            currentUser.role === "admin"
                              ? "bg-purple-100 text-purple-700"
                              : currentUser.role === "guru"
                              ? "bg-teal-100 text-teal-700"
                              : "bg-indigo-100 text-indigo-700"
                          }`}
                        >
                          <RoleIcon className="w-5 h-5" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center hover:bg-slate-950 shadow transition"
                        title="Unggah Foto Profil dari Perangkat"
                      >
                        <Camera className="w-3 h-3" />
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarUpload}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 truncate">{currentUser.name}</div>
                      <div className="text-[11px] text-slate-500 truncate">{currentUser.email}</div>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[9px] uppercase font-black px-2 py-0.5 rounded border ${roleBadgeStyle}`}
                        >
                          {currentUser.role}
                        </span>
                        {currentUser.nip && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            NIP: {currentUser.nip}
                          </span>
                        )}
                        {currentUser.nisn && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            NISN: {currentUser.nisn}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Switch user options (Admin only) */}
                  {currentUser.role === "admin" && (
                    <>
                      <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Beralih Akun (Supervisi Admin)
                      </div>

                      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                        {users.map((u) => {
                          const isCurrent = u.id === currentUser.id;
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                onSelectUser(u);
                                setShowRoleMenu(false);
                              }}
                              className={`w-full text-left p-2 rounded-xl transition flex items-center justify-between text-xs ${
                                isCurrent
                                  ? "bg-indigo-50 border border-indigo-200 font-bold text-indigo-900"
                                  : "hover:bg-slate-50 text-slate-700"
                              }`}
                            >
                              <div>
                                <div className="font-semibold text-slate-900">{u.name}</div>
                                <div className="text-[10px] text-slate-500">
                                  {u.role.toUpperCase()} {u.className ? `• ${u.className}` : ""}
                                </div>
                              </div>
                              {isCurrent && <UserCheck className="w-4 h-4 text-indigo-600" />}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* Logout button */}
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setShowRoleMenu(false);
                        onLogout();
                      }}
                      className="w-full px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center justify-center gap-2 transition"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Keluar (Logout)</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Quick Logout Header Button */}
          <button
            type="button"
            onClick={onLogout}
            className="p-2 rounded-xl border border-slate-200 hover:border-rose-300 bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition"
            title="Keluar dari akun saat ini"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
