import React from "react";
import { useEffect, useState } from "react";
import { SchoolProfile } from "../../types";
import { ImageUpload } from "../common/ImageUpload";
import {
  School,
  Save,
  Check,
  Building2,
  MapPin,
  Calendar,
  UserCheck,
  FileBadge,
  Sparkles,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";

interface SchoolSettingsTabProps {
  initialProfile: SchoolProfile;
  onSave: (updatedProfile: SchoolProfile) => void | Promise<unknown>;
  onResetDefault: () => void;
}

export function SchoolSettingsTab({
  initialProfile,
  onSave,
  onResetDefault,
}: SchoolSettingsTabProps) {
  const [profile, setProfile] = useState<SchoolProfile>(initialProfile);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState<string>("");

  // Ikuti data terbaru dari storage/server (mis. setelah sinkronisasi cloud),
  // kecuali sedang ada perubahan yang belum disimpan.
  useEffect(() => {
    setProfile((prev) => (saveState === "idle" || saveState === "saved" ? initialProfile : prev));
  }, [initialProfile, saveState]);

  const handleChange = (field: keyof SchoolProfile, value: string) => {
    setProfile((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (saveState !== "idle") {
      setSaveState("idle");
      setSaveMessage("");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile.name.trim()) {
      alert("Nama Sekolah wajib diisi!");
      return;
    }
    setSaveState("saving");
    setSaveMessage("");
    try {
      await onSave(profile);
      setSaveState("saved");
      setSaveMessage("Pengaturan sekolah berhasil disimpan ke server.");
      setTimeout(() => setSaveState("idle"), 4000);
    } catch (err: any) {
      setSaveState("error");
      setSaveMessage(
        `Gagal menyimpan ke server: ${err?.message || "periksa koneksi"}. Data hanya tersimpan di perangkat ini.`
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Settings Top Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 shadow-xs">
              <School className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Pengaturan Identitas & Logo Sekolah
              </h2>
              <p className="text-xs text-slate-500">
                Atur nama sekolah, logo resmi, data kepala sekolah, dan teks kop untuk seluruh modul ujian, kartu peserta, dan cetak laporan.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onResetDefault}
            className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 transition"
            title="Kembalikan nama dan logo ke format bawaan contoh"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Format Awal
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSave} className="mt-6 space-y-6">
          {/* Logo & Live Preview Box */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-purple-50/40 rounded-2xl p-5 border border-purple-100">
            <div className="md:col-span-7 space-y-4">
              <div className="flex items-center gap-2">
                <FileBadge className="w-4 h-4 text-purple-700" />
                <h3 className="text-xs font-bold text-purple-900 uppercase tracking-wider">
                  Logo Resmi Satuan Pendidikan
                </h3>
              </div>

              <ImageUpload
                label="Unggah Logo Sekolah dari Perangkat"
                value={profile.logoUrl}
                onChange={(base64) => handleChange("logoUrl", base64)}
                onClear={() => handleChange("logoUrl", "")}
                helperText="Format PNG transparan atau JPG (Maks. 2MB). Disarankan rasio 1:1."
                previewSize="lg"
              />
            </div>

            {/* Live Preview Kop */}
            <div className="md:col-span-5 bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-600" />
                Pratinjau Kop Resmi Ujian
              </div>
              <div className="border border-slate-300 rounded-lg p-3 bg-slate-50 text-center space-y-1">
                {profile.logoUrl ? (
                  <img
                    src={profile.logoUrl}
                    alt="Logo"
                    className="w-12 h-12 object-contain mx-auto mb-1"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-500 font-black text-xs flex items-center justify-center mx-auto mb-1">
                    LOGO
                  </div>
                )}
                <div className="text-xs font-black uppercase text-slate-900 leading-tight">
                  {profile.name || "NAMA SEKOLAH"}
                </div>
                <div className="text-[10px] font-semibold text-slate-600">
                  {profile.headerTitle || "Sistem Ujian Essay Online"} • T.A {profile.academicYear || "2025/2026"}
                </div>
                <div className="text-[9px] text-slate-400">
                  {profile.address || "Alamat Satuan Pendidikan"}
                </div>
              </div>
            </div>
          </div>

          {/* School Basic Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase block mb-1">
                Nama Resmi Satuan Pendidikan *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={profile.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Misal: SMK FALENDANG JAE / SMA NEGERI 1"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase block mb-1">
                NPSN (Nomor Pokok Sekolah Nasional)
              </label>
              <input
                type="text"
                value={profile.npsn || ""}
                onChange={(e) => handleChange("npsn", e.target.value)}
                placeholder="Misal: 69874521"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase block mb-1">
                Tahun Ajaran / Pelajaran
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Calendar className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={profile.academicYear || ""}
                  onChange={(e) => handleChange("academicYear", e.target.value)}
                  placeholder="Misal: 2025/2026"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase block mb-1">
                Judul Header Sistem (Header Bar)
              </label>
              <input
                type="text"
                value={profile.headerTitle || ""}
                onChange={(e) => handleChange("headerTitle", e.target.value)}
                placeholder="Misal: Sistem Ujian Essay Online"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase block mb-1">
                Sub Judul Header (Sub Title)
              </label>
              <input
                type="text"
                value={profile.subTitle || ""}
                onChange={(e) => handleChange("subTitle", e.target.value)}
                placeholder="Misal: Platform Anti Curang Berbasis AI"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 uppercase block mb-1">
              Alamat Lengkap Sekolah (Untuk Kop Dokumen)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <MapPin className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={profile.address || ""}
                onChange={(e) => handleChange("address", e.target.value)}
                placeholder="Misal: Jl. Pendidikan No. 45, Falendang Jae, Sumatera Utara"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
            </div>
          </div>

          {/* Pejabat Penandatangan Cetak Kartu & Berita Acara */}
          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-purple-700" />
              Informasi Pejabat & Penandatangan Cetak Kartu / Laporan
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Kepala Sekolah */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <span className="text-xs font-black text-slate-800 block">
                  Kepala Satuan Pendidikan
                </span>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Nama Lengkap & Gelar
                  </label>
                  <input
                    type="text"
                    value={profile.principalName || ""}
                    onChange={(e) => handleChange("principalName", e.target.value)}
                    placeholder="Drs. H. Mulyadi, M.Pd"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    NIP Kepala Sekolah
                  </label>
                  <input
                    type="text"
                    value={profile.principalNip || ""}
                    onChange={(e) => handleChange("principalNip", e.target.value)}
                    placeholder="196803151992031004"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                </div>
              </div>

              {/* Proktor / Administrator */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <span className="text-xs font-black text-slate-800 block">
                  Proktor / Administrator Ujian
                </span>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Nama Lengkap & Gelar
                  </label>
                  <input
                    type="text"
                    value={profile.proctorName || ""}
                    onChange={(e) => handleChange("proctorName", e.target.value)}
                    placeholder="Drs. Hendrawan"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    NIP Proktor
                  </label>
                  <input
                    type="text"
                    value={profile.proctorNip || ""}
                    onChange={(e) => handleChange("proctorNip", e.target.value)}
                    placeholder="197805122003121002"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-200">
            {saveState === "saved" && (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5 animate-in fade-in">
                <Check className="w-4 h-4" />
                {saveMessage}
              </span>
            )}
            {saveState === "error" && (
              <span className="text-xs font-bold text-rose-600 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                {saveMessage}
              </span>
            )}
            <button
              type="submit"
              disabled={saveState === "saving"}
              className="px-5 py-2.5 bg-purple-900 hover:bg-purple-800 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saveState === "saving" ? "Menyimpan..." : "Simpan Identitas Sekolah"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
