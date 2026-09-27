import React, { useState, useRef } from "react";
import { ExamQuestion, QuestionKind } from "../../types";
import {
  convertParsedToExamQuestions,
  downloadQuestionTemplateXlsx,
  parseQuestionFile,
  parseQuestionText,
  ParsedQuestionRow,
} from "../../utils/excelQuestionImport";
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  Trash2,
  Sparkles,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

interface BulkQuestionUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportQuestions: (questions: ExamQuestion[], mode: "replace" | "append") => void;
  existingQuestionsCount: number;
  /** Batasi jenis soal yang boleh diimpor (mis. ujian PG saja). */
  allowedKinds?: QuestionKind[];
}

const ACCEPTED_FILES =
  ".xlsx,.xlsm,.xls,.ods,.csv,.txt,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/plain";

export function BulkQuestionUploadModal({
  isOpen,
  onClose,
  onImportQuestions,
  existingQuestionsCount,
  allowedKinds = ["pg", "essay"],
}: BulkQuestionUploadModalProps) {
  const [activeInputTab, setActiveInputTab] = useState<"file" | "paste">("file");
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>("");
  const [pastedText, setPastedText] = useState<string>("");
  const [parsedRows, setParsedRows] = useState<ParsedQuestionRow[]>([]);
  const [importMode, setImportMode] = useState<"replace" | "append">(
    existingQuestionsCount > 0 ? "append" : "replace"
  );
  const [defaultPoints, setDefaultPoints] = useState<number>(20);
  const [isReading, setIsReading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const essayOnly = allowedKinds.length === 1 && allowedKinds[0] === "essay";
  const pgOnly = allowedKinds.length === 1 && allowedKinds[0] === "pg";

  const downloadQuestionTemplate = () => {
    void downloadQuestionTemplateXlsx({
      filename: essayOnly ? "template_soal_uraian_guru.xlsx" : "template_soal_ujian.xlsx",
      kinds: allowedKinds,
    });
  };

  const kindLabel = (kind: QuestionKind) => (kind === "pg" ? "Pilihan Ganda" : "Essay");

  /** Tandai baris dengan jenis yang tidak cocok jenis ujian sebagai tidak valid. */
  const applyKindFilter = (rows: ParsedQuestionRow[]): ParsedQuestionRow[] => {
    if (allowedKinds.length > 1) return rows;
    return rows.map((row) => {
      if (allowedKinds.includes(row.type)) return row;
      return {
        ...row,
        isValid: false,
        selected: false,
        errorMessage: `Soal ${kindLabel(row.type)} tidak dapat diimpor ke ujian ${kindLabel(
          allowedKinds[0]
        )}`,
      };
    });
  };

  const applyRows = (rows: ParsedQuestionRow[]) => {
    const filtered = applyKindFilter(rows);
    setParsedRows(filtered);
    const valid = filtered.filter((r) => r.isValid).length;
    const skipped = filtered.length - valid;
    if (filtered.length === 0) {
      setStatusMessage({
        type: "error",
        text: "Tidak ada soal yang terbaca. Pastikan baris judul kolom dan minimal satu baris soal tersedia.",
      });
    } else if (valid === 0) {
      setStatusMessage({
        type: "error",
        text: `${filtered.length} baris terbaca tetapi tidak ada yang valid. Periksa pratinjau di bawah.`,
      });
    } else {
      setStatusMessage({
        type: "success",
        text: `${valid} soal berhasil dibaca${
          skipped > 0 ? `, ${skipped} baris dilewati karena tidak valid` : ""
        }.`,
      });
    }
  };

  const readFile = async (file: File) => {
    setFileName(file.name);
    setIsReading(true);
    setStatusMessage(null);
    try {
      const rows = await parseQuestionFile(file, defaultPoints);
      applyRows(rows);
    } catch (err) {
      console.error("Gagal membaca file:", err);
      setParsedRows([]);
      setStatusMessage({
        type: "error",
        text: `Gagal membaca file: ${
          err instanceof Error ? err.message : "format berkas tidak dikenali"
        }. Gunakan template .xlsx yang diunduh atau berkas .csv.`,
      });
    } finally {
      setIsReading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    void readFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    void readFile(file);
  };

  const handlePasteSubmit = () => {
    if (!pastedText.trim()) return;
    setFileName("Salin-Tempel Teks Spreadsheet");
    setStatusMessage(null);
    applyRows(parseQuestionText(pastedText, defaultPoints));
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
    const remaining = parsedRows.filter((_, i) => i !== index);
    setParsedRows(remaining.map((r, i) => ({ ...r, number: i + 1 })));
  };

  const handleApplyDefaultPointsToAll = (pts: number) => {
    setDefaultPoints(pts);
    setParsedRows((prev) => prev.map((r) => ({ ...r, maxScore: pts })));
  };

  const handleConfirmImport = () => {
    const selected = parsedRows.filter((r) => r.selected && r.isValid);
    if (selected.length === 0) {
      alert("Pilih minimal satu soal yang valid untuk dimasukkan ke lembar ujian.");
      return;
    }

    onImportQuestions(convertParsedToExamQuestions(selected), importMode);
    onClose();
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const selectedCount = parsedRows.filter((r) => r.selected && r.isValid).length;
  const totalSelectedPoints = parsedRows
    .filter((r) => r.selected && r.isValid)
    .reduce((sum, r) => sum + r.maxScore, 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-teal-950 via-teal-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/30 border border-teal-400/40 flex items-center justify-center text-teal-300">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                <span>Upload Massal Soal</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/30 border border-teal-400/40 text-teal-200 uppercase">
                  Excel (.xlsx)
                </span>
              </h2>
              <p className="text-xs text-teal-200">
                Impor banyak soal {pgOnly ? "pilihan ganda" : "uraian"}, model kunci jawaban,
                kata kunci AI, dan bobot nilai sekaligus.
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

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Download Template Box */}
          <div className="bg-teal-50/70 p-4 rounded-2xl border border-teal-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-teal-950 block">
                Format Spreadsheet Soal {essayOnly ? "Uraian" : "Ujian"}:
              </span>
              <span className="text-[11px] text-teal-800">
                {pgOnly
                  ? "Kolom: No Soal, Pertanyaan, Opsi A-E, Kunci Jawaban, Bobot Nilai, Pembahasan."
                  : essayOnly
                  ? "Kolom: No Soal, Pertanyaan, Kunci Jawaban Model, Kata Kunci Wajib (koma), Bobot Nilai, Panduan Rubrik."
                  : "Kolom: No Soal, Tipe Soal (PG/Essay), Pertanyaan, Opsi A-E, Kunci Jawaban, Bobot Nilai, Kata Kunci, Rubrik."}
              </span>
            </div>
            <button
              type="button"
              onClick={downloadQuestionTemplate}
              className="px-3.5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-sm shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Template Soal (.xlsx)</span>
            </button>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              onClick={() => setActiveInputTab("file")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeInputTab === "file"
                  ? "bg-teal-900 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Unggah Berkas (.xlsx / .csv)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveInputTab("paste")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeInputTab === "paste"
                  ? "bg-teal-900 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Salin / Tempel Teks (Paste)</span>
            </button>
          </div>

          {/* File Upload Zone */}
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
                  ? "border-teal-600 bg-teal-50"
                  : "border-slate-300 hover:border-teal-500 bg-slate-50/60 hover:bg-teal-50/30"
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept={ACCEPTED_FILES}
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center shadow-xs">
                {isReading ? (
                  <RefreshCw className="w-6 h-6 animate-spin" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>
              <div className="text-xs">
                <span className="font-bold text-slate-800">
                  {isReading ? "Membaca berkas..." : "Klik untuk memilih file Excel (.xlsx)"}
                </span>{" "}
                <span className="text-slate-500">atau seret file ke area ini</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Mendukung .xlsx, .xls, .ods, .csv (pemisah koma/titik koma/tab) dan .txt
              </p>
              {fileName && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-100 text-teal-950 font-bold rounded-lg text-xs mt-1 border border-teal-200">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-teal-700" />
                  <span>{fileName}</span>
                </div>
              )}
            </div>
          )}

          {/* Paste Zone */}
          {activeInputTab === "paste" && (
            <div className="space-y-2">
              <textarea
                rows={5}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder='Tempelkan baris soal dari Excel atau Sheets di sini... Contoh:&#10;1,"Jelaskan proses fotosintesis...","Fotosintesis adalah...","klorofil, cahaya, glukosa",25,"Rubrik skor..."&#10;2,"Apa perbedaan Mitosis dan Meiosis?","Mitosis sel tubuh...","mitosis, meiosis",25,"Rubrik skor..."'
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
              <button
                type="button"
                onClick={handlePasteSubmit}
                className="px-4 py-2 bg-teal-900 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs"
              >
                <span>Proses Teks & Tampilkan Pratinjau</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`flex items-start gap-2 p-3 rounded-2xl border text-xs font-semibold ${
                statusMessage.type === "success"
                  ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                  : "bg-rose-50 text-rose-900 border-rose-200"
              }`}
            >
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-teal-50 p-3.5 rounded-2xl border border-teal-100">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-teal-700" />
                  <span className="text-xs font-bold text-teal-950">
                    Pratinjau Soal: {validCount} soal terbaca ({selectedCount} dipilih • Total{" "}
                    {totalSelectedPoints} Poin)
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Default points apply */}
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700">
                    <span>Set Semua Bobot:</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={defaultPoints}
                      onChange={(e) => handleApplyDefaultPointsToAll(Number(e.target.value))}
                      className="w-14 px-2 py-1 bg-white border border-teal-300 rounded-lg text-xs font-bold text-center"
                    />
                    <span>Poin</span>
                  </div>

                  {/* Mode Replace vs Append if questions already exist */}
                  {existingQuestionsCount > 0 && (
                    <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-teal-200 text-xs font-bold">
                      <label className="flex items-center gap-1 cursor-pointer text-slate-700">
                        <input
                          type="radio"
                          name="importMode"
                          value="append"
                          checked={importMode === "append"}
                          onChange={() => setImportMode("append")}
                          className="text-teal-600"
                        />
                        <span>Tambah ({existingQuestionsCount} ada)</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer text-slate-700 ml-1">
                        <input
                          type="radio"
                          name="importMode"
                          value="replace"
                          checked={importMode === "replace"}
                          onChange={() => setImportMode("replace")}
                          className="text-teal-600"
                        />
                        <span>Ganti Semua</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Questions List Preview Cards */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-72 overflow-y-auto divide-y divide-slate-100">
                {parsedRows.map((row, idx) => (
                  <div
                    key={row.id}
                    className={`p-3.5 transition flex items-start gap-3 ${
                      !row.isValid
                        ? "bg-rose-50/60"
                        : row.selected
                        ? "bg-teal-50/20 hover:bg-teal-50/40"
                        : "opacity-60 bg-slate-50/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={row.selected}
                      disabled={!row.isValid}
                      onChange={() => handleToggleRow(idx)}
                      className="mt-1 rounded text-teal-600 focus:ring-teal-500"
                    />

                    <div className="w-6 h-6 rounded-lg bg-teal-900 text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </div>

                    <div className="flex-1 space-y-1.5 text-xs min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-slate-900 leading-snug">
                          <span
                            className={`text-[10px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded border mr-1.5 ${
                              row.type === "pg"
                                ? "bg-sky-50 text-sky-700 border-sky-200"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}
                          >
                            {row.type === "pg" ? "PG" : "Essay"}
                          </span>
                          {row.question}
                          {!row.isValid && (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded ml-2">
                              {row.errorMessage || "Data Kurang Lengkap"}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded-md shrink-0">
                          {row.maxScore} Poin
                        </span>
                      </div>

                      {row.type === "pg" && row.options.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1">
                          {row.options.map((opt) => (
                            <span
                              key={opt.label}
                              className="text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded"
                            >
                              {opt.label}. {opt.text}
                            </span>
                          ))}
                        </div>
                      )}

                      {row.type === "pg" ? (
                        <div className="bg-sky-50 text-sky-950 p-2 rounded-xl border border-sky-200/70 text-[11px] leading-relaxed">
                          <span className="font-bold text-sky-900 block">Kunci Jawaban:</span>
                          {row.answerKey || "(belum diisi)"}
                        </div>
                      ) : (
                        <div className="bg-emerald-50 text-emerald-950 p-2 rounded-xl border border-emerald-200/70 text-[11px] leading-relaxed">
                          <span className="font-bold text-emerald-900 block">Kunci Model:</span>
                          {row.answerKey}
                        </div>
                      )}

                      {row.keywords && row.keywords.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 pt-0.5">
                          <span className="text-[10px] font-bold text-slate-500">Kata Kunci AI:</span>
                          {row.keywords.map((kw, kidx) => (
                            <span
                              key={kidx}
                              className="text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      )}

                      {row.rubricGuide && (
                        <p className="text-[11px] text-slate-500 italic">
                          Rubrik: {row.rubricGuide}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteRow(idx)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition shrink-0"
                      title="Hapus baris ini"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition"
          >
            Batal
          </button>

          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={handleConfirmImport}
            className="px-5 py-2.5 bg-teal-900 hover:bg-teal-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition"
          >
            <CheckCircle2 className="w-4 h-4 text-teal-300" />
            <span>
              Masukkan {selectedCount} Soal ke Lembar Ujian ({totalSelectedPoints} Poin)
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
