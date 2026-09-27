import { ExamQuestion, QuestionKind, MCQOption } from "../types";
import { OPTION_LABELS, defaultMcqOptions } from "./examHelpers";

/**
 * Pustaka SheetJS cukup berat (~400 KB), jadi dimuat saat teacher benar-benar
 * memakai template/import, bukan ikut ter-bundle di awal halaman siswa.
 */
let xlsxLoader: Promise<any> | null = null;

function loadXlsx(): Promise<any> {
  if (!xlsxLoader) {
    xlsxLoader = import("xlsx").then((mod) => (mod as any)?.default ?? mod);
  }
  return xlsxLoader;
}

export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const TEMPLATE_HEADERS = [
  "No Soal",
  "Tipe Soal",
  "Pertanyaan",
  "Opsi A",
  "Opsi B",
  "Opsi C",
  "Opsi D",
  "Opsi E",
  "Kunci Jawaban",
  "Bobot Nilai",
  "Kata Kunci Wajib (Pisahkan Koma)",
  "Panduan Rubrik / Pembahasan",
];

export interface ParsedQuestionRow {
  id: string;
  number: number;
  type: QuestionKind;
  question: string;
  options: MCQOption[];
  answerKey: string;
  keywords: string[];
  rubricGuide: string;
  maxScore: number;
  isValid: boolean;
  errorMessage?: string;
  selected: boolean;
}

export interface DownloadTemplateOptions {
  filename?: string;
  kinds?: QuestionKind[];
}

const SAMPLE_PG_ROWS: (string | number)[][] = [
  [
    1,
    "PG",
    "Organel sel yang berfungsi sebagai tempat berlangsungnya respirasi seluler dan penghasil energi utama (ATP) adalah...",
    "Ribosom",
    "Mitokondria",
    "Badan Golgi",
    "Lisosom",
    "Retikulum Endoplasma",
    "B",
    20,
    "",
    "Mitokondria adalah pusat respirasi aerob penghasil ATP melalui fosforilasi oksidatif.",
  ],
  [
    2,
    "PG",
    "Proses pembelahan sel yang menghasilkan dua sel anak identik dengan jumlah kromosom diploid (2n) disebut...",
    "Meiosis",
    "Mitosis",
    "Amitosis",
    "Sitokinesis",
    "Fertilisasi",
    "B",
    20,
    "",
    "Mitosis mempertahankan jumlah kromosom diploid (2n) untuk pertumbuhan dan perbaikan jaringan.",
  ],
];

const SAMPLE_ESSAY_ROWS: (string | number)[][] = [
  [
    1,
    "Essay",
    "Jelaskan tahapan reaksi terang dan reaksi gelap pada fotosintesis tumbuhan beserta tempat berlangsungnya!",
    "",
    "",
    "",
    "",
    "",
    "Reaksi terang berlangsung di membran tilakoid kloroplas menghasilkan ATP dan NADPH. Reaksi gelap (siklus Calvin) berlangsung di stroma kloroplas menghasilkan glukosa.",
    30,
    "reaksi terang, reaksi gelap, tilakoid, stroma, ATP, NADPH, glukosa, kloroplas",
    "Menjelaskan lokasi reaksi 10 poin, produk reaksi terang 10 poin, mekanisme reaksi gelap 10 poin.",
  ],
  [
    2,
    "Essay",
    "Uraikan bagaimana teori seleksi alam Darwin menjelaskan evolusi leher panjang jerapah!",
    "",
    "",
    "",
    "",
    "",
    "Menurut Darwin, terdapat variasi panjang leher jerapah. Saat makanan di pohon tinggi, jerapah berleher panjang bertahan hidup (survival of the fittest) dan mewariskan sifatnya.",
    30,
    "seleksi alam, variasi, adaptasi, survival of the fittest, jerapah leher panjang, pewarisan sifat",
    "Variasi awal leher (10 poin), seleksi lingkungan (10 poin), pewarisan ke generasi (10 poin).",
  ],
  [
    3,
    "Essay",
    "Sebutkan dan jelaskan tiga faktor lingkungan utama yang memengaruhi laju respirasi seluler!",
    "",
    "",
    "",
    "",
    "",
    "Suhu memengaruhi kinetika enzim, ketersediaan substrat glukosa menyediakan bahan bakar, dan konsentrasi oksigen berperan sebagai akseptor elektron terakhir.",
    20,
    "suhu, substrat, glukosa, enzim, oksigen, akseptor elektron",
    "Menyebutkan 3 faktor (10 poin), penjelasan mekanisme masing-masing (10 poin).",
  ],
];

export async function downloadQuestionTemplateXlsx(
  options: DownloadTemplateOptions = {}
): Promise<void> {
  const XLSX = await loadXlsx();
  const { filename = "template_soal_ujian.xlsx", kinds = ["pg", "essay"] } = options;
  const wb = XLSX.utils.book_new();

  const sampleRows: (string | number)[][] = [];
  if (kinds.includes("pg")) sampleRows.push(...SAMPLE_PG_ROWS);
  if (kinds.includes("essay")) sampleRows.push(...SAMPLE_ESSAY_ROWS);

  const rows: any[][] = [TEMPLATE_HEADERS, ...sampleRows];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 8 },
    { wch: 12 },
    { wch: 45 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 24 },
    { wch: 12 },
    { wch: 35 },
    { wch: 40 },
  ];
  if (ws["!ref"]) {
    ws["!autofilter"] = { ref: ws["!ref"] };
  }
  XLSX.utils.book_append_sheet(wb, ws, "Soal Ujian");

  const guideData = [
    ["PETUNJUK PENGISIAN TEMPLATE SOAL (.XLSX)"],
    [""],
    ["Jangan mengubah, menghapus, atau mengurutkan ulang baris judul (baris 1)."],
    ["Hapus baris contoh sebelum mengisi soal Anda sendiri."],
    [""],
    ["1. TIPE SOAL:", "Isi 'PG' untuk Pilihan Ganda atau 'Essay' (atau 'Uraian') untuk soal Essay."],
    ["2. PERTANYAAN:", "Teks soal pertanyaan ujian (wajib diisi)."],
    ["3. OPSI A - E:", "Khusus soal PG. Tuliskan teks pilihan jawaban (minimal Opsi A dan B)."],
    ["4. KUNCI JAWABAN:", "- Untuk PG: Masukkan huruf kunci ('A', 'B', 'C', 'D', atau 'E')."],
    ["", "- Untuk Essay: Tuliskan jawaban acuan/model guru untuk pedoman AI."],
    ["5. BOBOT NILAI:", "Angka bobot nilai (contoh: 20). Jika dikosongkan, menggunakan bobot default."],
    ["6. KATA KUNCI:", "Khusus Essay. Pisahkan dengan tanda koma (contoh: fotosintesis, klorofil)."],
    ["7. RUBRIK / PEMBAHASAN:", "Untuk Essay: panduan rubrik. Untuk PG: pembahasan soal."],
  ];
  const guideWs = XLSX.utils.aoa_to_sheet(guideData);
  guideWs["!cols"] = [{ wch: 24 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(wb, guideWs, "Petunjuk Pengisian");

  const outBytes = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([outBytes], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function normalizeHeaderName(val: unknown): string {
  if (val == null) return "";
  return String(val)
    .toLowerCase()
    .replace(/[\s_\-/().]/g, "");
}

/**
 * Cari indeks kolom berdasarkan daftar predicate berurutan dari paling spesifik.
 * Urutan penting: "No Soal" juga mengandung "soal", sehingga kolom pertanyaan
 * harus dicocokkan lebih dulu lewat kata "pertanyaan" agar tidak tertukar.
 */
function resolveColumn(
  normalizedHeader: string[],
  matcherGroups: ((h: string) => boolean)[]
): number {
  for (const matches of matcherGroups) {
    const idx = normalizedHeader.findIndex((h) => h && matches(h));
    if (idx !== -1) return idx;
  }
  return -1;
}

const has = (...parts: string[]) => (h: string) => parts.some((p) => h.includes(p));

export function parseQuestionMatrix(
  matrix: any[][],
  defaultPoints = 20
): ParsedQuestionRow[] {
  if (!matrix || matrix.length === 0) return [];

  let headerRowIdx = -1;
  for (let r = 0; r < Math.min(matrix.length, 5); r++) {
    const row = matrix[r] || [];
    const joined = row.map(normalizeHeaderName).join(" ");
    if (
      joined.includes("pertanyaan") ||
      joined.includes("soal") ||
      joined.includes("kunci") ||
      joined.includes("tipe")
    ) {
      headerRowIdx = r;
      break;
    }
  }

  const rawHeader = headerRowIdx !== -1 ? matrix[headerRowIdx] || [] : [];
  const normalizedHeader = rawHeader.map(normalizeHeaderName);

  let noIdx = resolveColumn(normalizedHeader, [
    has("nos", "nomorsoal", "number", "no"),
    has("nomor"),
  ]);
  let typeIdx = resolveColumn(normalizedHeader, [
    has("tipesoal", "jenissoal", "tipe", "jenis", "format", "tipepertanyaan"),
  ]);
  let qIdx = resolveColumn(normalizedHeader, [
    has("pertanyaan", "questiontext", "soalpertanyaan"),
    has("soal", "question", "soalteks"),
    has("uraian", "esai", "tanya"),
  ]);
  let keyIdx = resolveColumn(normalizedHeader, [
    (h) => h.includes("kunci") && (h.includes("jawaban") || h.includes("answer")),
    has("kunci", "answerkey", "kuncibenar"),
    has("jawabanbenar", "jawapan"),
    has("modeljawaban", "kuncimodel", "model"),
    has("answer", "jawaban"),
  ]);
  let scoreIdx = resolveColumn(normalizedHeader, [
    has("bobot", "skor", "score", "point"),
    has("nilai", "poin"),
  ]);
  let kwIdx = resolveColumn(normalizedHeader, [
    (h) => h.includes("kata") && h.includes("kunci"),
    has("katakunci", "keyword", "konsep", "kata"),
  ]);
  let rubricIdx = resolveColumn(normalizedHeader, [
    has("rubrik", "pembahasan", "pedoman", "panduan", "guide", "bahas"),
  ]);

  const optionIndices: Record<string, number> = {};
  for (const lbl of OPTION_LABELS) {
    const low = lbl.toLowerCase();
    const named = normalizedHeader.findIndex(
      (h) =>
        h === `opsi${low}` ||
        h === `pilihan${low}` ||
        h === `opt${low}` ||
        h === `jawaban${low}` ||
        h === `${low}.`
    );
    if (named !== -1) {
      optionIndices[lbl] = named;
      continue;
    }
    const bare = normalizedHeader.findIndex((h, i) => h === low && (qIdx === -1 || i > qIdx));
    if (bare !== -1) {
      optionIndices[lbl] = bare;
    }
  }

  const startRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;

  if (headerRowIdx === -1) {
    noIdx = 0;
    qIdx = 1;
    keyIdx = 2;
    kwIdx = 3;
    scoreIdx = 4;
    rubricIdx = 5;
  }

  const results: ParsedQuestionRow[] = [];

  for (let r = startRow; r < matrix.length; r++) {
    const row = matrix[r];
    if (!row || row.every((c: any) => c == null || String(c).trim() === "")) continue;

    const cellVal = (idx: number): string => {
      if (idx === -1 || idx == null || row[idx] == null) return "";
      return String(row[idx]).trim();
    };

    const rawQText = qIdx !== -1 ? cellVal(qIdx) : cellVal(1) || cellVal(0);
    const rawKey = keyIdx !== -1 ? cellVal(keyIdx) : cellVal(2);
    const rawType = typeIdx !== -1 ? cellVal(typeIdx).toLowerCase() : "";
    const rawScore = scoreIdx !== -1 ? Number(cellVal(scoreIdx)) : defaultPoints;
    const rawKw = kwIdx !== -1 ? cellVal(kwIdx) : "";
    const rawRubric = rubricIdx !== -1 ? cellVal(rubricIdx) : "";

    const collectedOptions: MCQOption[] = [];
    for (const lbl of OPTION_LABELS) {
      const col = optionIndices[lbl];
      if (col !== undefined && col !== -1) {
        const text = cellVal(col);
        if (text) {
          collectedOptions.push({ label: lbl, text });
        }
      }
    }

    let kind: QuestionKind = "essay";
    const isExplicitPg =
      rawType.includes("pg") ||
      rawType.includes("pilihan") ||
      rawType.includes("multiple") ||
      rawType.includes("mcq");
    const isExplicitEssay =
      rawType.includes("essay") ||
      rawType.includes("uraian") ||
      rawType.includes("esai");

    if (isExplicitPg) {
      kind = "pg";
    } else if (isExplicitEssay) {
      kind = "essay";
    } else if (collectedOptions.length >= 2) {
      kind = "pg";
    } else if (rawKey && /^[A-Fa-f]$/.test(rawKey.trim()) && collectedOptions.length > 0) {
      kind = "pg";
    } else {
      kind = "essay";
    }

    const finalOptions: MCQOption[] =
      kind === "pg"
        ? collectedOptions.length > 0
          ? collectedOptions
          : defaultMcqOptions()
        : [];

    let isValid = true;
    const errors: string[] = [];

    if (!rawQText) {
      isValid = false;
      errors.push("Teks pertanyaan wajib diisi");
    }

    if (kind === "pg") {
      if (finalOptions.filter((o) => o.text.trim()).length < 2) {
        isValid = false;
        errors.push("Soal PG minimal harus memiliki 2 opsi jawaban");
      }
      if (!rawKey) {
        isValid = false;
        errors.push("Kunci jawaban PG wajib ditentukan (A, B, C, dst.)");
      } else if (!/^[A-Fa-f]$/.test(rawKey.trim())) {
        isValid = false;
        errors.push("Kunci jawaban PG harus berupa huruf (A-E)");
      }
    } else {
      if (!rawKey) {
        isValid = false;
        errors.push("Kunci jawaban model guru wajib diisi");
      }
    }

    const parsedKeywords = rawKw
      ? rawKw
          .split(/[,;\n]/)
          .map((k) => k.trim())
          .filter((k) => k.length > 0)
      : [];

    results.push({
      id: `imported-q-${Date.now()}-${r}-${Math.random().toString(36).substring(2, 6)}`,
      number: results.length + 1,
      type: kind,
      question: rawQText,
      options: finalOptions,
      answerKey: rawKey,
      keywords: parsedKeywords,
      rubricGuide: rawRubric,
      maxScore: !isNaN(rawScore) && rawScore > 0 ? rawScore : defaultPoints,
      isValid,
      errorMessage: errors.length > 0 ? errors.join("; ") : undefined,
      selected: isValid,
    });
  }

  return results;
}

/** Pecah teks CSV/TSV (dengan tanda kutip) menjadi matriks sel. */
export function parseDelimitedText(rawText: string): string[][] {
  const cleanText = String(rawText || "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim();
  if (!cleanText) return [];

  const firstLine = cleanText.split("\n")[0] || "";
  const countOf = (ch: string) => firstLine.split(ch).length - 1;
  const commaCount = countOf(",");
  const semicolonCount = countOf(";");
  const tabCount = countOf("\t");

  let delimiter = ",";
  if (semicolonCount > commaCount && semicolonCount > tabCount) {
    delimiter = ";";
  } else if (tabCount > commaCount && tabCount > semicolonCount) {
    delimiter = "\t";
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  const pushRow = () => {
    currentRow.push(currentField.trim());
    if (currentRow.some((field) => field.length > 0)) {
      rows.push(currentRow);
    }
    currentRow = [];
    currentField = "";
  };

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
    } else if (char === "\n" && !inQuotes) {
      pushRow();
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    pushRow();
  }

  return rows;
}

export function parseQuestionText(
  rawText: string,
  defaultPoints = 20
): ParsedQuestionRow[] {
  return parseQuestionMatrix(parseDelimitedText(rawText), defaultPoints);
}

export function isSpreadsheetFile(file: File): boolean {
  const name = (file?.name || "").toLowerCase();
  if (/\.(xlsx|xlsm|xlsb|xls|ods|ots|numbers)$/.test(name)) return true;
  const mime = (file?.type || "").toLowerCase();
  return (
    mime === XLSX_MIME ||
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    mime.includes("ms-excel") ||
    mime.includes("opendocument.spreadsheet")
  );
}

/** Baca satu sheet dan skoring kecocokan judul kolom. */
function scoreSheetMatrix(matrix: any[][]): number {
  const header = (matrix[0] || []).map(normalizeHeaderName);
  let score = 0;
  if (header.some((h) => h.includes("pertanyaan"))) score += 4;
  if (header.some((h) => h.includes("kunci") && h.includes("jawaban"))) score += 3;
  if (header.some((h) => h.includes("kunci"))) score += 1;
  if (header.some((h) => h.includes("bobot") || h.includes("nilai"))) score += 1;
  if (header.some((h) => h.includes("rubrik") || h.includes("pembahasan"))) score += 1;
  const dataRows = matrix
    .slice(1)
    .filter((r) => r && r.some((c: any) => c != null && String(c).trim() !== "")).length;
  return score * 1000 + Math.min(dataRows, 999);
}

export async function parseQuestionWorkbook(
  data: ArrayBuffer | Uint8Array,
  defaultPoints = 20
): Promise<ParsedQuestionRow[]> {
  const XLSX = await loadXlsx();
  const wb = XLSX.read(data, { type: "array" });
  if (!wb.SheetNames || wb.SheetNames.length === 0) return [];

  const named = wb.SheetNames.find((s) => s.toLowerCase().includes("soal"));
  const candidates = named
    ? [named, ...wb.SheetNames.filter((s) => s !== named)]
    : [...wb.SheetNames];

  let best: { rows: ParsedQuestionRow[]; score: number } | null = null;
  for (const name of candidates) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    let matrix: any[][];
    try {
      matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: false });
    } catch {
      continue;
    }
    if (!matrix || matrix.length === 0) continue;
    const score = scoreSheetMatrix(matrix);
    if (!best || score > best.score) {
      best = { rows: parseQuestionMatrix(matrix, defaultPoints), score };
    }
    if (score >= 4000) break;
  }

  return best?.rows || [];
}

/** Baca file spreadsheet biner (xlsx/xls/ods) maupun teks (csv/tsv) lalu parse. */
export async function parseQuestionFile(
  file: File,
  defaultPoints = 20
): Promise<ParsedQuestionRow[]> {
  if (isSpreadsheetFile(file)) {
    const buffer = await file.arrayBuffer();
    return parseQuestionWorkbook(buffer, defaultPoints);
  }
  const text = await file.text();
  return parseQuestionText(text, defaultPoints);
}

export function convertParsedToExamQuestions(
  rows: ParsedQuestionRow[]
): ExamQuestion[] {
  return rows.map((r, idx) => {
    const isPg = r.type === "pg";
    const id = `q-${Date.now()}-${idx + 1}-${Math.random().toString(36).substring(2, 6)}`;

    if (isPg) {
      const cleanKey = (r.answerKey || "").trim().toUpperCase();
      return {
        id,
        number: idx + 1,
        type: "pg" as const,
        question: r.question,
        options: r.options.map((opt, oIdx) => ({
          label: OPTION_LABELS[oIdx] || opt.label,
          text: opt.text.trim(),
        })),
        correctAnswer: cleanKey,
        answerKey: r.rubricGuide || "",
        keywords: [],
        rubricGuide: r.rubricGuide || "",
        maxScore: r.maxScore,
      };
    }

    return {
      id,
      number: idx + 1,
      type: "essay" as const,
      question: r.question,
      answerKey: r.answerKey,
      keywords: r.keywords,
      rubricGuide: r.rubricGuide,
      maxScore: r.maxScore,
      options: [],
      correctAnswer: "",
    };
  });
}
