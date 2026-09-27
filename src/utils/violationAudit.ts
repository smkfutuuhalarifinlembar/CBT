import {
  ViolationEvent,
  ViolationLog,
  ViolationSeverity,
  ViolationSource,
} from "../types";

export const VIOLATION_MAX_LOGS = 200;

export interface ViolationCategoryInfo {
  key: string;
  label: string;
  source: ViolationSource;
  description: string;
}

const contains = (text: string, ...words: string[]) =>
  words.some((w) => text.includes(w));

/**
 * Klasifikasi kejadian berdasarkan sumber & kata kunci pada `reason`, sehingga
 * log lama yang hanya menyimpan kalimat bebas tetap bisa dibaca.
 */
export function classifyViolation(log: {
  reason?: string;
  source?: ViolationSource;
  severity?: ViolationSeverity;
}): { source: ViolationSource; severity: ViolationSeverity } {
  const reason = (log.reason || "").toLowerCase();

  const source: ViolationSource =
    log.source ||
    (contains(reason, "developer", "tombol fungsi", "otomatis dikumpulkan", "diskualifikasi")
      ? "sistem"
      : contains(reason, "kamera", "wajah", "gerak", "pencahayaan", "terlalu gelap")
      ? "kamera"
      : contains(reason, "layar", "fullscreen", "minimize", "tab", "fokus", "jendela", "sistem")
      ? "layar"
      : "sistem");

  const severity: ViolationSeverity =
    log.severity ||
    (contains(reason, "batas pelanggaran", "tidak diizinkan", "dinonaktifkan", "otomatis dikumpulkan", "diskualifikasi")
      ? "kritis"
      : source === "kamera" && contains(reason, "terlalu gelap", "tidak terdeteksi")
      ? "peringatan"
      : "pelanggaran");

  return { source, severity };
}

/** Ringkasan audit per jenis tindakan, untuk laporan guru. */
export const VIOLATION_CATEGORIES: ViolationCategoryInfo[] = [
  {
    key: "fullscreen",
    label: "Keluar Layar Penuh",
    source: "layar",
    description: "Siswa keluar dari mode layar penuh (minimize jendela atau menekan Esc).",
  },
  {
    key: "tab_switch",
    label: "Berpindah Tab / Minimize",
    source: "layar",
    description: "Tab ujian disembunyikan, ditutup, atau berpindah ke tab/aplikasi lain.",
  },
  {
    key: "focus",
    label: "Fokus Layar Hilang",
    source: "layar",
    description: "Jendela ujian kehilangan fokus karena aplikasi lain dibuka.",
  },
  {
    key: "devtools",
    label: "Alat Bantu Curang",
    source: "sistem",
    description: "Siswa mencoba membuka Developer Tools atau tombol fungsi sistem.",
  },
  {
    key: "camera_denied",
    label: "Kamera Ditolak / Mati",
    source: "kamera",
    description: "Izin kamera pengawas ditolak atau kamera dinonaktifkan saat ujian.",
  },
  {
    key: "camera_dark",
    label: "Kamera Tertutup / Gelap",
    source: "kamera",
    description: "Lensa kamera tertutup atau pencahayaan terlalu gelap.",
  },
  {
    key: "camera_motion",
    label: "Gerak Berlebih",
    source: "kamera",
    description: "Geriak tidak wajar (berdiri/berpaling) terdeteksi di area wajah.",
  },
  {
    key: "camera_absent",
    label: "Wajah Tidak Ada",
    source: "kamera",
    description: "Wajah siswa tidak berada di bingkai kamera saat mengerjakan ujian.",
  },
  {
    key: "force_submit",
    label: "Ujian Dihentikan Otomatis",
    source: "sistem",
    description: "Batas pelanggaran tercapai sehingga lembar jawaban dikumpulkan otomatis.",
  },
  {
    key: "other",
    label: "Lainnya",
    source: "sistem",
    description: "Kejadian lain di luar kategori baku.",
  },
];

export function getViolationCategory(reason?: string): ViolationCategoryInfo {
  const text = (reason || "").toLowerCase();
  if (contains(text, "batas pelanggaran", "otomatis dikumpulkan", "diskualifikasi")) {
    return VIOLATION_CATEGORIES.find((c) => c.key === "force_submit")!;
  }
  if (contains(text, "layar penuh", "fullscreen", "exited")) {
    return VIOLATION_CATEGORIES.find((c) => c.key === "fullscreen")!;
  }
  if (contains(text, "developer", "tombol fungsi")) {
    return VIOLATION_CATEGORIES.find((c) => c.key === "devtools")!;
  }
  if (contains(text, "kamera", "izin")) {
    if (contains(text, "tidak diizinkan", "dinonaktifkan", "denied")) {
      return VIOLATION_CATEGORIES.find((c) => c.key === "camera_denied")!;
    }
    if (contains(text, "gelap", "tertutup", "pencahayaan")) {
      return VIOLATION_CATEGORIES.find((c) => c.key === "camera_dark")!;
    }
    if (contains(text, "wajah", "tidak terdeteksi")) {
      return VIOLATION_CATEGORIES.find((c) => c.key === "camera_absent")!;
    }
    if (contains(text, "gerak", "pergerakan")) {
      return VIOLATION_CATEGORIES.find((c) => c.key === "camera_motion")!;
    }
  }
  if (contains(text, "fokus")) {
    return VIOLATION_CATEGORIES.find((c) => c.key === "focus")!;
  }
  if (contains(text, "tab", "diminimalkan", "minimize", "berpindah")) {
    return VIOLATION_CATEGORIES.find((c) => c.key === "tab_switch")!;
  }
  return VIOLATION_CATEGORIES.find((c) => c.key === "other")!;
}

export interface ViolationAuditRow {
  index: number;
  log: ViolationLog;
  category: ViolationCategoryInfo;
  source: ViolationSource;
  severity: ViolationSeverity;
  /** Waktu kejadian siap tampil ("14:03:22"). */
  timeLabel: string;
  /** Menit ke-N sejak ujian dimulai. */
  elapsedLabel: string;
  questionLabel: string;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Hanya认認 format ISO 8601 agar "14.03.22" versi lama tidak salah di-parse. */
const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

export function toIsoTimestamp(timestamp?: string): string | null {
  if (!timestamp || !ISO_TIMESTAMP_RE.test(timestamp.trim())) return null;
  const parsed = Date.parse(timestamp);
  return isNaN(parsed) ? null : new Date(parsed).toISOString();
}

/** Ubah timestamp log (ISO atau "HH.MM.SS" versi lama) menjadi jam lokal. */
export function formatViolationTime(timestamp?: string): string {
  if (!timestamp) return "-";
  const iso = toIsoTimestamp(timestamp);
  if (iso) {
    return new Date(iso).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
  // Log lama: "14.03.22"
  const parts = timestamp.trim().split(".");
  if (parts.length >= 3) {
    return `${pad2(Number(parts[0]) || 0)}:${pad2(Number(parts[1]) || 0)}:${pad2(
      Number(parts[2]) || 0
    )}`;
  }
  return timestamp;
}

/** Ubah kejadian sensor menjadi catatan log yang siap disimpan. */
export function createViolationLog(
  event: ViolationEvent,
  ctx: { count: number; startedAt?: string; questionNumber?: number }
): ViolationLog {
  const now = new Date();
  let elapsedSeconds: number | undefined;
  if (ctx.startedAt) {
    const started = new Date(ctx.startedAt).getTime();
    if (!isNaN(started)) {
      elapsedSeconds = Math.max(0, Math.round((now.getTime() - started) / 1000));
    }
  }

  return {
    timestamp: now.toISOString(),
    reason: event.reason,
    detail: event.detail,
    source: event.source,
    severity: event.severity,
    evidence: event.evidence,
    count: ctx.count,
    elapsedSeconds,
    questionNumber: ctx.questionNumber,
  };
}

/** Jaga agar log tidak tumbuh tanpa batas di perangkat siswa. */
export function capViolationLogs(logs: ViolationLog[]): ViolationLog[] {
  return logs.length > VIOLATION_MAX_LOGS
    ? logs.slice(logs.length - VIOLATION_MAX_LOGS)
    : logs;
}

export function buildViolationAudit(
  logs: ViolationLog[] | undefined,
  startedAt?: string
): ViolationAuditRow[] {
  if (!Array.isArray(logs)) return [];

  const startedMs = startedAt ? new Date(startedAt).getTime() : NaN;

  return logs
    .map((log, idx) => {
      const { source, severity } = classifyViolation(log);
      const category = getViolationCategory(log.reason);

      let elapsedSeconds: number | undefined =
        typeof log.elapsedSeconds === "number" ? log.elapsedSeconds : undefined;
      if (elapsedSeconds === undefined && !isNaN(startedMs)) {
        const at = log.timestamp ? Date.parse(toIsoTimestamp(log.timestamp) || "") : NaN;
        if (!isNaN(at)) {
          elapsedSeconds = Math.max(0, Math.round((at - startedMs) / 1000));
        }
      }

      return {
        index: idx + 1,
        log,
        category,
        source: log.source || source,
        severity: log.severity || severity,
        timeLabel: formatViolationTime(log.timestamp),
        elapsedLabel:
          typeof elapsedSeconds === "number"
            ? `menit ke-${Math.floor(elapsedSeconds / 60) + 1}`
            : "-",
        questionLabel: log.questionNumber ? `Soal #${log.questionNumber}` : "-",
      };
    })
    .reverse();
}

export interface ViolationSummary {
  total: number;
  bySeverity: Record<ViolationSeverity, number>;
  bySource: Record<ViolationSource, number>;
  topCategories: Array<{ category: ViolationCategoryInfo; count: number }>;
  highestSeverity: ViolationSeverity | null;
  summaryText: string;
}

export function summarizeViolations(
  logs: ViolationLog[] | undefined
): ViolationSummary {
  const rows = buildViolationAudit(logs);
  const bySeverity: Record<ViolationSeverity, number> = {
    peringatan: 0,
    pelanggaran: 0,
    kritis: 0,
  };
  const bySource: Record<ViolationSource, number> = {
    layar: 0,
    kamera: 0,
    sistem: 0,
  };
  const byCategory = new Map<string, { category: ViolationCategoryInfo; count: number }>();

  for (const row of rows) {
    bySeverity[row.severity] += 1;
    bySource[row.source] += 1;
    const entry = byCategory.get(row.category.key);
    if (entry) entry.count += 1;
    else byCategory.set(row.category.key, { category: row.category, count: 1 });
  }

  const topCategories = Array.from(byCategory.values())
    .filter((e) => e.category.key !== "other" || e.count > 0)
    .sort((a, b) => b.count - a.count);

  const highestSeverity: ViolationSeverity | null = rows.length
    ? bySeverity.kritis > 0
      ? "kritis"
      : bySeverity.pelanggaran > 0
      ? "pelanggaran"
      : "peringatan"
    : null;

  const summaryText = rows.length
    ? topCategories
        .slice(0, 3)
        .map((e) => `${e.category.label} (${e.count}x)`)
        .join(", ")
    : "Tidak ada pelanggaran";

  return {
    total: rows.length,
    bySeverity,
    bySource,
    topCategories,
    highestSeverity,
    summaryText,
  };
}

export const SEVERITY_LABEL: Record<ViolationSeverity, string> = {
  peringatan: "Peringatan",
  pelanggaran: "Pelanggaran",
  kritis: "Kritis",
};

export const SOURCE_LABEL: Record<ViolationSource, string> = {
  layar: "Kunci Layar",
  kamera: "Kamera Proctor",
  sistem: "Sistem",
};
