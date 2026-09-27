/**
 * Helper header untuk endpoint admin /api/db/*.
 * VITE_ADMIN_API_KEY dibakar saat build (terlihat di bundle browser) —
 * hanya untuk identifikasi frontend resmi, BUKAN rahasia utama.
 * Rahasia sebenarnya (password, hash) diverifikasi di server.
 */
export const ADMIN_API_KEY = (import.meta as any).env?.VITE_ADMIN_API_KEY || "";

export function adminHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return ADMIN_API_KEY
    ? { ...extra, "x-admin-key": ADMIN_API_KEY }
    : { ...extra };
}
