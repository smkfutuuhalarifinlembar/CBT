import React, { useState, useRef } from "react";
import { User, UserRole, ClassRoom } from "../../types";
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  Users,
  Eye,
  EyeOff,
  Trash2,
  FileText,
  Loader2,
  ArrowRight,
} from "lucide-react";

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: ClassRoom[];
  onImportUsers: (users: User[]) => Promise<void> | void;
}

interface ParsedUserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  nipNisn: string;
  password: string;
  className?: string;
  classId?: string;
  isValid: boolean;
  errorMessage?: string;
  selected: boolean;
}

export function BulkUploadModal({
  isOpen,
  onClose,
  classes,
  onImportUsers,
}: BulkUploadModalProps) {
  const [activeInputTab, setActiveInputTab] = useState<"file" | "paste">("file");
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>("");
  const [pastedText, setPastedText] = useState<string>("");
  const [parsedRows, setParsedRows] = useState<ParsedUserRow[]>([]);
  const [defaultClassId, setDefaultClassId] = useState<string>(classes[0]?.id || "");
  const [defaultRole, setDefaultRole] = useState<UserRole>("siswa");
  const [showPasswords, setShowPasswords] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [importStatus, setImportStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Function to download CSV Templates
  const downloadTemplate = (type: "siswa" | "guru") => {
    let csvHeader = "";
    let csvRows = "";
    let filename = "";

    if (type === "siswa") {
      csvHeader = "Nama Lengkap,NISN / Username,Email,Password,Kelas\n";
      csvRows =
        "Budi Santoso,0054892119,budi@siswa.sch.id,password123,XII IPA 1\n" +
        "Siti Aminah,0054892120,siti@siswa.sch.id,password123,XII IPA 1\n" +
        "Ahmad Fauzi,0054892121,ahmad@siswa.sch.id,password123,XII IPS 2\n";
      filename = "template_upload_siswa.csv";
    } else {
      csvHeader = "Nama Lengkap,NIP / Username,Email,Password,Role\n";
      csvRows =
        "Drs. Bambang Sudarsono,198501152010012020,bambang@sekolah.sch.id,password123,guru\n" +
        "Nur Hidayati S.Pd,199008202015022001,nur@sekolah.sch.id,password123,guru\n";
      filename = "template_upload_guru.csv";
    }

    const blob = new Blob(["\uFEFF" + csvHeader + csvRows], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Robust line and field parser for CSV / TSV / Semicolon
  const parseCSVText = (rawText: string) => {
    setImportStatus(null);
    if (!rawText.trim()) {
      setParsedRows([]);
      return;
    }

    // Clean BOM
    const cleanText = rawText.replace(/^\uFEFF/, "").trim();
    const rawLines = cleanText.split(/\r?\n/);
    if (rawLines.length === 0) return;

    // Detect delimiter from first line (, ; or \t)
    const firstLine = rawLines[0];
    let delimiter = ",";
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;

    if (semicolonCount > commaCount && semicolonCount > tabCount) {
      delimiter = ";";
    } else if (tabCount > commaCount && tabCount > semicolonCount) {
      delimiter = "\t";
    }

    // Split line respecting quotes
    const splitCSVLine = (line: string, delim: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delim && !inQuotes) {
          result.push(current.trim().replace(/^"|"$/g, ""));
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^"|"$/g, ""));
      return result;
    };

    const headerCols = splitCSVLine(rawLines[0], delimiter).map((c) =>
      c.toLowerCase().replace(/[\s_\-/]/g, "")
    );

    // Identify column indexes
    let nameIdx = headerCols.findIndex((h) =>
      h.includes("nama") || h.includes("name") || h.includes("siswa") || h.includes("guru")
    );
    let emailIdx = headerCols.findIndex((h) =>
      h.includes("email") || h.includes("surel") || h.includes("username") || h.includes("user")
    );
    let roleIdx = headerCols.findIndex((h) =>
      h.includes("role") || h.includes("peran") || h.includes("tipe") || h.includes("jabatan")
    );
    let nipNisnIdx = headerCols.findIndex((h) =>
      h.includes("nisn") || h.includes("nip") || h.includes("noinduk") || h.includes("nis") || h.includes("nomorinduk")
    );
    let passIdx = headerCols.findIndex((h) =>
      h.includes("password") || h.includes("sandi") || h.includes("katasandi") || h.includes("pass")
    );
    let classIdx = headerCols.findIndex((h) =>
      h.includes("kelas") || h.includes("class") || h.includes("rombel")
    );

    // If no header found, assume standard positional order: name, nisn/nip, email, password, class
    const isFirstLineHeader = nameIdx !== -1 || emailIdx !== -1 || roleIdx !== -1 || nipNisnIdx !== -1;
    const startIndex = isFirstLineHeader ? 1 : 0;

    if (!isFirstLineHeader) {
      nameIdx = 0;
      nipNisnIdx = 1;
      emailIdx = 2;
      passIdx = 3;
      classIdx = 4;
    }

    const results: ParsedUserRow[] = [];

    for (let i = startIndex; i < rawLines.length; i++) {
      const line = rawLines[i].trim();
      if (!line) continue;

      const cols = splitCSVLine(line, delimiter);
      if (cols.length === 0 || cols.every((c) => !c)) continue;

      const rawName = nameIdx !== -1 && cols[nameIdx] ? cols[nameIdx] : (cols[0] || `Pengguna ${i}`);
      const rawNipNisn = nipNisnIdx !== -1 && cols[nipNisnIdx] ? cols[nipNisnIdx] : (cols[1] || "");
      
      let rawEmail = emailIdx !== -1 && cols[emailIdx] ? cols[emailIdx] : "";
      if (!rawEmail && rawNipNisn) {
        rawEmail = `${rawNipNisn}@sekolah.sch.id`;
      } else if (!rawEmail) {
        rawEmail = `user${i}@sekolah.sch.id`;
      }

      let rawRole: UserRole = defaultRole;
      if (roleIdx !== -1 && cols[roleIdx]) {
        const rLower = cols[roleIdx].toLowerCase();
        if (rLower.includes("guru") || rLower.includes("teacher") || rLower.includes("pendidik")) {
          rawRole = "guru";
        } else if (rLower.includes("admin")) {
          rawRole = "admin";
        } else {
          rawRole = "siswa";
        }
      }

      const rawPass = passIdx !== -1 && cols[passIdx] ? cols[passIdx] : "password123";
      const rawClassName = classIdx !== -1 && cols[classIdx] ? cols[classIdx] : "";

      // Match class
      let targetClass = classes.find(
        (c) => c.name.toLowerCase() === rawClassName.toLowerCase().trim()
      );
      if (!targetClass && defaultClassId) {
        targetClass = classes.find((c) => c.id === defaultClassId);
      }

      const isValid = Boolean(rawName && (rawEmail || rawNipNisn));
      const errorMessage = !isValid ? "Nama dan NISN/Email wajib terisi" : undefined;

      results.push({
        id: `import-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        name: rawName.trim(),
        email: rawEmail.trim(),
        role: rawRole,
        nipNisn: rawNipNisn.trim(),
        password: rawPass.trim() || "password123",
        className: targetClass ? targetClass.name : rawClassName || undefined,
        classId: targetClass ? targetClass.id : undefined,
        isValid,
        errorMessage,
        selected: isValid,
      });
    }

    setParsedRows(results);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      parseCSVText(content);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      parseCSVText(content);
    };
    reader.readAsText(file);
  };

  const handlePasteSubmit = () => {
    if (!pastedText.trim()) return;
    setFileName("Teks Manual / Salin-Tempel");
    parseCSVText(pastedText);
  };

  const handleToggleSelectAll = (checked: boolean) => {
    setParsedRows((prev) =>
      prev.map((row) => (row.isValid ? { ...row, selected: checked } : row))
    );
  };

  const handleToggleRow = (index: number) => {
    setParsedRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, selected: !r.selected } : r))
    );
  };

  const handleDeleteRow = (index: number) => {
    setParsedRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleApplyDefaultClass = (clsId: string) => {
    setDefaultClassId(clsId);
    const cls = classes.find((c) => c.id === clsId);
    if (!cls) return;

    setParsedRows((prev) =>
      prev.map((r) =>
        r.role === "siswa"
          ? { ...r, classId: cls.id, className: cls.name }
          : r
      )
    );
  };

  const handleExecuteImport = async () => {
    const selectedRows = parsedRows.filter((r) => r.selected && r.isValid);
    if (selectedRows.length === 0) {
      alert("Tidak ada baris data valid yang dipilih untuk diimpor.");
      return;
    }

    setIsProcessing(true);
    setImportStatus(null);

    try {
      const usersToSave: User[] = selectedRows.map((r) => {
        const u: User = {
          id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: r.name,
          email: r.email,
          role: r.role,
          password: r.password || "password123",
        };
        if (r.role === "siswa") {
          if (r.nipNisn) u.nisn = r.nipNisn;
          if (r.classId) u.classId = r.classId;
          if (r.className) u.className = r.className;
        } else {
          if (r.nipNisn) u.nip = r.nipNisn;
        }
        return u;
      });

      await onImportUsers(usersToSave);

      setImportStatus({
        type: "success",
        message: `Berhasil mengimpor dan mendaftarkan ${usersToSave.length} akun pengguna ke sistem!`,
      });

      setTimeout(() => {
        setIsProcessing(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      setIsProcessing(false);
      setImportStatus({
        type: "error",
        message: err.message || "Gagal memproses data pengguna.",
      });
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const selectedCount = parsedRows.filter((r) => r.selected && r.isValid).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600/30 border border-purple-400/40 flex items-center justify-center text-purple-300">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                <span>Upload Massal Pengguna</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/30 border border-purple-400/40 text-purple-200 uppercase">
                  CSV / Excel
                </span>
              </h2>
              <p className="text-xs text-purple-200">
                Impor daftar siswa, guru, atau admin secara serentak dari file spreadsheet.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Status message */}
          {importStatus && (
            <div
              className={`p-4 rounded-2xl flex items-center gap-3 border text-sm font-semibold ${
                importStatus.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-rose-50 text-rose-800 border-rose-200"
              }`}
            >
              {importStatus.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <span>{importStatus.message}</span>
            </div>
          )}

          {/* Template Download Section */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-slate-800 block">
                Unduh Format Contoh Spreadsheet:
              </span>
              <span className="text-[11px] text-slate-500">
                Gunakan template resmi untuk format penulisan Nama, NISN/NIP, Kelas, dan Kata Sandi.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => downloadTemplate("siswa")}
                className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Template Siswa (.csv)</span>
              </button>
              <button
                type="button"
                onClick={() => downloadTemplate("guru")}
                className="px-3 py-1.5 bg-white hover:bg-teal-50 text-teal-700 border border-teal-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Template Guru (.csv)</span>
              </button>
            </div>
          </div>

          {/* Tab Selection: File vs Paste */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              onClick={() => setActiveInputTab("file")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeInputTab === "file"
                  ? "bg-purple-900 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload File CSV / Excel</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveInputTab("paste")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeInputTab === "paste"
                  ? "bg-purple-900 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Salin / Tempel Teks (Paste)</span>
            </button>
          </div>

          {/* Input Type 1: File Drag & Drop */}
          {activeInputTab === "file" && (
            <div
              onDragEnter={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setDragActive(false);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                dragActive
                  ? "border-purple-600 bg-purple-50"
                  : "border-slate-300 hover:border-purple-500 bg-slate-50/60 hover:bg-purple-50/30"
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv, text/csv, .txt, application/vnd.ms-excel"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-xs">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-slate-800">
                  Klik untuk memilih file CSV
                </span>{" "}
                <span className="text-slate-500">atau seret file ke area ini</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Mendukung file .CSV (pemisah koma, titik koma (;), atau tab dari MS Excel)
              </p>
              {fileName && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-100 text-purple-900 font-bold rounded-lg text-xs mt-1 border border-purple-200">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-purple-700" />
                  <span>{fileName}</span>
                </div>
              )}
            </div>
          )}

          {/* Input Type 2: Direct Paste */}
          {activeInputTab === "paste" && (
            <div className="space-y-2">
              <textarea
                rows={5}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Tempelkan baris data dari spreadsheet di sini... Contoh:&#10;Budi Santoso,0054892119,budi@siswa.sch.id,password123,XII IPA 1&#10;Siti Aminah,0054892120,siti@siswa.sch.id,password123,XII IPA 1"
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
              <button
                type="button"
                onClick={handlePasteSubmit}
                className="px-4 py-2 bg-purple-900 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs"
              >
                <span>Proses Teks & Pratinjau</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Parsed Preview Section */}
          {parsedRows.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-purple-50 p-3.5 rounded-2xl border border-purple-100">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-700" />
                  <span className="text-xs font-bold text-purple-950">
                    Pratinjau Hasil Impor: {validCount} baris terdeteksi ({selectedCount} dipilih)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Default Class Selector */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-600">
                      Rombel Siswa:
                    </span>
                    <select
                      value={defaultClassId}
                      onChange={(e) => handleApplyDefaultClass(e.target.value)}
                      className="px-2.5 py-1 bg-white border border-purple-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Password Toggle */}
                  <button
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                  >
                    {showPasswords ? (
                      <EyeOff className="w-3 h-3 text-amber-600" />
                    ) : (
                      <Eye className="w-3 h-3 text-slate-500" />
                    )}
                    <span>{showPasswords ? "Tutup Sandi" : "Lihat Sandi"}</span>
                  </button>
                </div>
              </div>

              {/* Table Preview */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 sticky top-0">
                    <tr>
                      <th className="p-2.5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedCount === validCount && validCount > 0}
                          onChange={(e) => handleToggleSelectAll(e.target.checked)}
                          className="rounded text-purple-600"
                        />
                      </th>
                      <th className="p-2.5">Nama Pengguna</th>
                      <th className="p-2.5">Peran</th>
                      <th className="p-2.5">NISN / NIP</th>
                      <th className="p-2.5">Email / Username</th>
                      <th className="p-2.5">Kata Sandi</th>
                      <th className="p-2.5">Kelas</th>
                      <th className="p-2.5 text-center w-12">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((row, idx) => (
                      <tr
                        key={row.id}
                        className={`hover:bg-slate-50/80 transition ${
                          !row.isValid ? "bg-rose-50/50" : row.selected ? "bg-purple-50/20" : ""
                        }`}
                      >
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            disabled={!row.isValid}
                            onChange={() => handleToggleRow(idx)}
                            className="rounded text-purple-600"
                          />
                        </td>
                        <td className="p-2.5 font-bold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span>{row.name}</span>
                            {!row.isValid && (
                              <span className="text-[9px] font-bold px-1 rounded bg-rose-100 text-rose-700">
                                Invalid
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              row.role === "admin"
                                ? "bg-purple-100 text-purple-800"
                                : row.role === "guru"
                                ? "bg-teal-100 text-teal-800"
                                : "bg-indigo-100 text-indigo-800"
                            }`}
                          >
                            {row.role}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono text-[11px] text-slate-600">
                          {row.nipNisn || "-"}
                        </td>
                        <td className="p-2.5 font-mono text-[11px] text-slate-600">
                          {row.email}
                        </td>
                        <td className="p-2.5 font-mono text-[11px]">
                          {showPasswords ? (
                            <span className="text-purple-700 font-bold bg-purple-50 px-1.5 py-0.5 rounded">
                              {row.password}
                            </span>
                          ) : (
                            <span className="text-slate-400">••••••••</span>
                          )}
                        </td>
                        <td className="p-2.5 font-semibold text-slate-700">
                          {row.role === "siswa" ? row.className || "Belum dipilih" : "-"}
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(idx)}
                            className="p-1 hover:bg-rose-100 text-rose-600 rounded-lg transition"
                            title="Hapus baris ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition"
          >
            Batal
          </button>

          <button
            type="button"
            disabled={selectedCount === 0 || isProcessing}
            onClick={handleExecuteImport}
            className="px-5 py-2.5 bg-purple-900 hover:bg-purple-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan ke Database...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-purple-300" />
                <span>Simpan {selectedCount} Pengguna ke Database</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
