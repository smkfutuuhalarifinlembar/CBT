import React, { useState, useMemo } from "react";
import {
  Printer,
  X,
  FileText,
  Filter,
  Layers,
  ArrowUpDown,
  Search,
  QrCode,
  ExternalLink,
  ShieldCheck,
  User as UserIcon,
  CheckCircle2,
  Grid
} from "lucide-react";
import { User, ClassRoom, SchoolProfile } from "../../types";

interface PrintExamCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  classes: ClassRoom[];
  schoolProfile?: SchoolProfile;
  currentUser: User;
}

export const PrintExamCardsModal: React.FC<PrintExamCardsModalProps> = ({
  isOpen,
  onClose,
  users,
  classes,
  schoolProfile,
  currentUser,
}) => {
  const [printFormat, setPrintFormat] = useState<"cards" | "table">("cards");
  const [printClassFilter, setPrintClassFilter] = useState<string>("all");
  const [printRoleFilter, setPrintRoleFilter] = useState<string>("siswa");
  const [cardsPerPage, setCardsPerPage] = useState<4 | 6 | 8>(4); // 4, 6, or 8 cards per A4 page
  const [sortBy, setSortBy] = useState<"name" | "class" | "nisn">("class");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [noticeMessage, setNoticeMessage] = useState<{
    type: "info" | "warning";
    text: string;
  } | null>(null);

  // Filter and sort users
  const printableUsers = useMemo(() => {
    let result = users.filter((u) => {
      if (printRoleFilter !== "all" && u.role !== printRoleFilter) return false;
      if (printClassFilter !== "all" && u.className !== printClassFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = u.name.toLowerCase().includes(q);
        const matchNisn = (u.nisn || "").toLowerCase().includes(q);
        const matchNip = (u.nip || "").toLowerCase().includes(q);
        const matchEmail = u.email.toLowerCase().includes(q);
        const matchClass = (u.className || "").toLowerCase().includes(q);
        if (!matchName && !matchNisn && !matchNip && !matchEmail && !matchClass) {
          return false;
        }
      }
      return true;
    });

    result.sort((a, b) => {
      if (sortBy === "class") {
        const classA = a.className || "";
        const classB = b.className || "";
        if (classA !== classB) return classA.localeCompare(classB);
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "nisn") {
        const nisnA = a.nisn || a.nip || "";
        const nisnB = b.nisn || b.nip || "";
        return nisnA.localeCompare(nisnB);
      }
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [users, printRoleFilter, printClassFilter, searchQuery, sortBy]);

  // Chunk users into exact pages according to cardsPerPage (4, 6, or 8)
  const cardPages = useMemo(() => {
    const pages: User[][] = [];
    const size = cardsPerPage;
    for (let i = 0; i < printableUsers.length; i += size) {
      pages.push(printableUsers.slice(i, i + size));
    }
    return pages;
  }, [printableUsers, cardsPerPage]);

  if (!isOpen) return null;

  // Direct print using current window with clean print stylesheets
  const handleDirectPrint = () => {
    window.print();
  };

  // Standalone print window option for 100% isolated rendering in a separate popup window
  const handleOpenPrintWindow = () => {
    let printWindow: Window | null = null;
    try {
      printWindow = window.open("", "_blank", "width=1150,height=900,menubar=no,toolbar=no,location=no,status=no");
    } catch (err) {
      console.warn("window.open call blocked:", err);
    }

    if (!printWindow || printWindow.closed || typeof printWindow.closed === "undefined") {
      setNoticeMessage({
        type: "warning",
        text: "Pop-up jendela baru diblokir oleh peramban atau iFrame. Mengalihkan ke jendela pratinjau cetak langsung...",
      });
      setTimeout(() => {
        window.print();
      }, 500);
      return;
    }

    setNoticeMessage({
      type: "info",
      text: "Jendela Khusus cetak mandiri berhasil dibuka! Silakan gunakan tombol cetak di jendela tersebut.",
    });

    const schoolName = schoolProfile?.name || "SMK FUTUUHAL ARIFIN LEMBAR";
    const academicYear = schoolProfile?.academicYear || "2025/2026";
    const logoHtml = schoolProfile?.logoUrl
      ? `<img src="${schoolProfile.logoUrl}" style="width: 36px; height: 36px; object-fit: contain; margin-right: 8px;" />`
      : `<div style="width: 34px; height: 34px; background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 11px; border-radius: 6px; margin-right: 8px;">SMK</div>`;

    let contentHtml = "";

    if (printFormat === "cards") {
      contentHtml = cardPages
        .map((pageUsers, pageIdx) => {
          const cardsHtml = pageUsers
            .map((u) => {
              const roleBadge = (u.role || "siswa").toUpperCase();
              const nisnNipLabel = u.role === "siswa" ? "NISN" : "NIP";
              const nisnNipVal = u.nisn || u.nip || "-";
              const classVal = u.className || "-";
              const passVal = u.password || "password123";

              return `
                <div class="exam-card card-size-${cardsPerPage}">
                  <div class="card-header">
                    <div style="display: flex; align-items: center; overflow: hidden;">
                      ${logoHtml}
                      <div style="min-width: 0;">
                        <div class="school-title">${schoolName}</div>
                        <div class="card-subtitle">KARTU AKSES UJIAN ONLINE • TP ${academicYear}</div>
                      </div>
                    </div>
                    <span class="role-badge">${roleBadge}</span>
                  </div>

                  <div class="card-body">
                    <div class="student-info">
                      <div class="info-group">
                        <span class="info-label">NAMA PESERTA</span>
                        <span class="info-value name-val">${u.name}</span>
                      </div>
                      <div class="info-row">
                        <div class="info-group">
                          <span class="info-label">${nisnNipLabel}</span>
                          <span class="info-value font-mono font-bold">${nisnNipVal}</span>
                        </div>
                        <div class="info-group">
                          <span class="info-label">KELAS / ROMBEL</span>
                          <span class="info-value font-bold">${classVal}</span>
                        </div>
                      </div>
                    </div>

                    <div class="qr-box">
                      ${
                        u.avatar
                          ? `<img src="${u.avatar}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px;" />`
                          : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h.01"/><path d="M17 7h.01"/><path d="M7 17h.01"/><path d="M17 17h.01"/>
                            </svg>
                            <span style="font-size: 6px; font-family: monospace; color: #64748b; margin-top: 1px; font-weight: bold;">KODE SESI</span>`
                      }
                    </div>
                  </div>

                  <div class="cred-box">
                    <div class="cred-title">KREDENSIAL MASUK SISTEM (LOGIN):</div>
                    <div class="cred-row">
                      <span class="cred-label">Username / Email:</span>
                      <span class="cred-val font-mono">${u.email}</span>
                    </div>
                    <div class="cred-row" style="margin-top: 2px; padding-top: 2px; border-top: 1px dashed #cbd5e1;">
                      <span class="cred-label" style="font-weight: bold;">Kata Sandi:</span>
                      <span class="cred-pass font-mono">${passVal}</span>
                    </div>
                  </div>

                  <div class="card-footer">
                    <div class="rules-text">
                      * Kartu disimpan & dibawa saat ujian.<br/>
                      * Dilarang membagikan sandi login.
                    </div>
                    <div class="sig-box">
                      <div class="sig-title">Proktor / Pengawas</div>
                      <div class="sig-line"></div>
                      <div class="sig-name">${schoolProfile?.proctorName || currentUser.name}</div>
                    </div>
                  </div>
                </div>
              `;
            })
            .join("");

          return `
            <div class="print-page-sheet grid-${cardsPerPage}">
              <div class="page-top-header">
                <div>
                  <strong>${schoolName}</strong> — KARTU PESERTA UJIAN ESSAY ONLINE (TP ${academicYear})
                </div>
                <div>
                  Lembar ${pageIdx + 1} dari ${cardPages.length} &bull; Total ${printableUsers.length} Peserta (${cardsPerPage} Kartu / Lembar)
                </div>
              </div>
              <div class="cards-grid grid-${cardsPerPage}-layout">
                ${cardsHtml}
              </div>
            </div>
          `;
        })
        .join("");
    } else {
      // Table Format
      const rowsHtml = printableUsers
        .map(
          (u, idx) => `
          <tr>
            <td style="text-align: center; font-weight: bold; width: 35px;">${idx + 1}</td>
            <td style="font-weight: bold;">${u.name}</td>
            <td style="font-family: monospace; font-size: 10px;">${u.nisn || u.nip || "-"}</td>
            <td>${u.className || "-"}</td>
            <td style="font-family: monospace; font-size: 10px;">${u.email}</td>
            <td style="font-family: monospace; font-weight: bold; background: #f8fafc;">${u.password || "password123"}</td>
            <td style="text-align: center; color: #94a3b8; font-size: 9px; width: 120px;">............................</td>
          </tr>
        `
        )
        .join("");

      contentHtml = `
        <div class="table-document">
          <div class="doc-header">
            <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 8px;">
              ${logoHtml}
              <div>
                <h1 style="margin: 0; font-size: 16px; font-weight: 900; text-transform: uppercase;">${schoolName}</h1>
                <h2 style="margin: 2px 0 0; font-size: 13px; font-weight: bold; text-transform: uppercase; color: #334155;">
                  DAFTAR REKAPITULASI AKUN & KREDENSIAL PESERTA UJIAN
                </h2>
                <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                  Tahun Pelajaran ${academicYear} • Filter Rombel: ${printClassFilter === "all" ? "Semua Kelas" : printClassFilter} • Peran: ${printRoleFilter.toUpperCase()}
                </div>
              </div>
            </div>
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 35px; text-align: center;">NO</th>
                <th>NAMA LENGKAP</th>
                <th>NISN / NIP</th>
                <th>KELAS</th>
                <th>USERNAME / EMAIL</th>
                <th>KATA SANDI</th>
                <th style="width: 120px; text-align: center;">PARAF / TTD</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="signature-section">
            <div class="sig-block">
              <div>Mengetahui,</div>
              <div style="font-weight: bold;">Kepala Sekolah</div>
              <div class="sig-space"></div>
              <div class="sig-person">${schoolProfile?.principalName || "Kepala Sekolah"}</div>
              <div class="sig-nip">NIP. ${schoolProfile?.principalNip || "-"}</div>
            </div>

            <div class="sig-block">
              <div>Lembar, ${new Date().toLocaleDateString("id-ID")}</div>
              <div style="font-weight: bold;">Proktor / Administrator Ujian</div>
              <div class="sig-space"></div>
              <div class="sig-person">${schoolProfile?.proctorName || currentUser.name}</div>
              <div class="sig-nip">NIP. ${schoolProfile?.proctorNip || currentUser.nip || "-"}</div>
            </div>
          </div>
        </div>
      `;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="utf-8" />
          <title>Cetak Kartu Ujian - ${schoolName}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 7mm 7mm 7mm 7mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              margin: 0;
              padding: 0;
              color: #0f172a;
              background: #f8fafc;
              font-size: 11px;
            }
            
            /* Top Floating Toolbar for the standalone popup */
            .popup-toolbar {
              position: sticky;
              top: 0;
              left: 0;
              right: 0;
              background: #0f172a;
              color: #ffffff;
              padding: 10px 20px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
              z-index: 9999;
            }
            .popup-toolbar-title {
              font-size: 13px;
              font-weight: bold;
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .popup-toolbar-badge {
              background: #3b82f6;
              color: #fff;
              font-size: 10px;
              padding: 2px 8px;
              border-radius: 9999px;
              font-weight: bold;
            }
            .popup-toolbar-actions {
              display: flex;
              align-items: center;
              gap: 10px;
            }
            .btn-print {
              background: #2563eb;
              color: white;
              border: none;
              padding: 7px 16px;
              font-size: 12px;
              font-weight: bold;
              border-radius: 8px;
              cursor: pointer;
              display: flex;
              align-items: center;
              gap: 6px;
              transition: background 0.2s;
            }
            .btn-print:hover {
              background: #1d4ed8;
            }
            .btn-close {
              background: #334155;
              color: white;
              border: none;
              padding: 7px 14px;
              font-size: 12px;
              font-weight: bold;
              border-radius: 8px;
              cursor: pointer;
            }
            .btn-close:hover {
              background: #475569;
            }

            .document-container {
              max-width: 210mm;
              margin: 15px auto;
              background: #ffffff;
              box-shadow: 0 0 20px rgba(0,0,0,0.08);
              padding: 0;
            }

            .print-page-sheet {
              page-break-after: always;
              break-after: page;
              page-break-inside: avoid;
              break-inside: avoid;
              width: 100%;
              height: 280mm;
              max-height: 280mm;
              display: flex;
              flex-direction: column;
              justify-content: flex-start;
              box-sizing: border-box;
              padding: 6mm 7mm 4mm 7mm;
              background: #ffffff;
              overflow: hidden;
            }
            .print-page-sheet:last-child {
              page-break-after: auto;
              break-after: auto;
            }
            .page-top-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 1.5px solid #0f172a;
              padding-bottom: 2mm;
              margin-bottom: 3mm;
              font-size: 8px;
              color: #334155;
              text-transform: uppercase;
              font-weight: bold;
            }
            .cards-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              flex: 1;
              box-sizing: border-box;
            }

            /* Layout Grid Sizing */
            .grid-4-layout {
              grid-template-rows: repeat(2, 1fr);
              gap: 5mm;
              height: calc(280mm - 18mm);
            }
            .grid-6-layout {
              grid-template-rows: repeat(3, 1fr);
              gap: 3.5mm;
              height: calc(280mm - 18mm);
            }
            .grid-8-layout {
              grid-template-rows: repeat(4, 1fr);
              gap: 2.5mm;
              height: calc(280mm - 18mm);
            }

            .exam-card {
              border: 1.5px solid #0f172a;
              border-radius: 6px;
              background: #fff;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              page-break-inside: avoid;
              break-inside: avoid;
              box-sizing: border-box;
              overflow: hidden;
            }

            /* 4 Cards per page (Large) */
            .card-size-4 {
              padding: 8px 12px;
            }
            .card-size-4 .school-title {
              font-size: 10px;
              font-weight: 900;
            }
            .card-size-4 .name-val {
              font-size: 11.5px;
              font-weight: 900;
            }
            .card-size-4 .qr-box {
              height: 48px;
            }

            /* 6 Cards per page (Standard) */
            .card-size-6 {
              padding: 6px 9px;
            }
            .card-size-6 .school-title {
              font-size: 9px;
              font-weight: 900;
            }
            .card-size-6 .name-val {
              font-size: 10px;
              font-weight: 900;
            }
            .card-size-6 .qr-box {
              height: 40px;
            }

            /* 8 Cards per page (Compact) */
            .card-size-8 {
              padding: 4px 7px;
            }
            .card-size-8 .school-title {
              font-size: 8px;
              font-weight: 900;
            }
            .card-size-8 .card-subtitle {
              font-size: 6.5px;
            }
            .card-size-8 .name-val {
              font-size: 9px;
              font-weight: 900;
            }
            .card-size-8 .qr-box {
              height: 34px;
            }
            .card-size-8 .cred-box {
              padding: 2px 4px;
              margin-bottom: 2px;
            }

            .card-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 1px solid #cbd5e1;
              padding-bottom: 2px;
              margin-bottom: 3px;
            }
            .school-title {
              text-transform: uppercase;
              letter-spacing: -0.2px;
              color: #0f172a;
              line-height: 1.1;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .card-subtitle {
              font-size: 7px;
              font-weight: 700;
              color: #475569;
              text-transform: uppercase;
            }
            .role-badge {
              font-size: 7.5px;
              font-weight: 800;
              padding: 1px 4px;
              background: #f1f5f9;
              border: 1px solid #cbd5e1;
              border-radius: 3px;
              color: #1e293b;
              margin-left: 4px;
            }
            .card-body {
              display: grid;
              grid-template-columns: 1fr 42px;
              gap: 4px;
              margin-bottom: 3px;
              align-items: center;
            }
            .info-group {
              margin-bottom: 1px;
            }
            .info-label {
              font-size: 6.5px;
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
              display: block;
            }
            .info-value {
              font-size: 9px;
              color: #0f172a;
              display: block;
              line-height: 1.15;
            }
            .info-row {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 3px;
              margin-top: 1px;
            }
            .qr-box {
              border: 1px dashed #94a3b8;
              border-radius: 4px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              background: #f8fafc;
              padding: 2px;
              box-sizing: border-box;
            }
            .cred-box {
              background: #f8fafc;
              border: 1px solid #cbd5e1;
              border-radius: 4px;
              padding: 2.5px 5px;
              margin-bottom: 3px;
            }
            .cred-title {
              font-size: 6.5px;
              font-weight: 800;
              color: #475569;
              text-transform: uppercase;
              letter-spacing: 0.2px;
              margin-bottom: 1px;
            }
            .cred-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 8.5px;
            }
            .cred-label {
              color: #475569;
            }
            .cred-val {
              font-weight: 700;
              color: #0f172a;
            }
            .cred-pass {
              font-weight: 900;
              background: #fff;
              border: 1px solid #94a3b8;
              padding: 0 4px;
              border-radius: 3px;
              color: #0f172a;
              font-size: 9px;
            }
            .card-footer {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              border-top: 1px solid #e2e8f0;
              padding-top: 2px;
              font-size: 6.5px;
              color: #64748b;
            }
            .rules-text {
              max-width: 120px;
              line-height: 1.15;
            }
            .sig-box {
              text-align: center;
            }
            .sig-title {
              font-size: 6px;
              color: #64748b;
            }
            .sig-line {
              width: 50px;
              border-bottom: 1px solid #94a3b8;
              margin: 6px 0 1px;
            }
            .sig-name {
              font-size: 6.5px;
              font-weight: 700;
              color: #334155;
            }

            /* Table Document Styles */
            .table-document {
              padding: 8mm 6mm;
            }
            .doc-header {
              border-bottom: 2px solid #0f172a;
              padding-bottom: 8px;
              margin-bottom: 10px;
              text-align: center;
            }
            .data-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 9px;
              margin-bottom: 14px;
            }
            .data-table th, .data-table td {
              border: 1px solid #0f172a;
              padding: 4px 6px;
              text-align: left;
            }
            .data-table thead {
              display: table-header-group;
              background: #f1f5f9;
            }
            .data-table tr {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .signature-section {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 30px;
              margin-top: 20px;
              page-break-inside: avoid;
              break-inside: avoid;
              text-align: center;
              font-size: 10px;
            }
            .sig-space {
              height: 40px;
            }
            .sig-person {
              font-weight: bold;
              text-decoration: underline;
            }
            .sig-nip {
              font-size: 8px;
              color: #64748b;
              font-family: monospace;
            }
            .font-mono {
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            }
            .font-bold {
              font-weight: bold;
            }

            /* Media Print: Hides toolbar and sets pure A4 sheets */
            @media print {
              .popup-toolbar {
                display: none !important;
              }
              body {
                background: #ffffff !important;
              }
              .document-container {
                margin: 0 !important;
                box-shadow: none !important;
                max-width: 100% !important;
                width: 100% !important;
              }
              .print-page-sheet {
                padding: 0 0 2mm 0 !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="popup-toolbar">
            <div class="popup-toolbar-title">
              <span>📄 Dokumen Siap Cetak: ${schoolName}</span>
              <span class="popup-toolbar-badge">${printableUsers.length} Peserta</span>
              <span class="popup-toolbar-badge" style="background:#475569;">${printFormat === "cards" ? `${cardsPerPage} Kartu / Lembar` : "Tabel Rekap"}</span>
            </div>
            <div class="popup-toolbar-actions">
              <button class="btn-print" onclick="window.print()">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"></polyline>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                  <rect width="12" height="8" x="6" y="14"></rect>
                </svg>
                <span>Cetak / Simpan PDF</span>
              </button>
              <button class="btn-close" onclick="window.close()">Tutup Jendela</button>
            </div>
          </div>

          <div class="document-container">
            ${contentHtml}
          </div>

          <script>
            function autoPrint() {
              setTimeout(function() {
                try {
                  window.focus();
                  window.print();
                } catch(e) {
                  console.error("Print trigger:", e);
                }
              }, 400);
            }
            if (document.readyState === 'complete') {
              autoPrint();
            } else {
              window.addEventListener('load', autoPrint);
              document.addEventListener('DOMContentLoaded', autoPrint);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md overflow-y-auto p-3 sm:p-6 flex flex-col items-center print-modal-backdrop">
      {/* Notice Banner if popup was blocked or opened */}
      {noticeMessage && (
        <div
          className={`w-full max-w-5xl mb-3 px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-3 shadow-md ${
            noticeMessage.type === "warning"
              ? "bg-amber-50 border-amber-300 text-amber-900"
              : "bg-emerald-50 border-emerald-300 text-emerald-900"
          }`}
        >
          <span>{noticeMessage.text}</span>
          <button
            type="button"
            onClick={() => setNoticeMessage(null)}
            className="text-slate-500 hover:text-slate-800 text-xs underline cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Print Controls Header (Hidden in actual print) */}
      <div className="w-full max-w-5xl bg-white rounded-2xl p-4 sm:p-5 shadow-2xl mb-4 no-print border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">
                  Cetak Kartu Ujian & Rekapitulasi Kredensial
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold">
                  {printableUsers.length} Peserta
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Pilih muatan kartu per lembar kertas (4, 6, atau 8 kartu), lalu cetak langsung atau simpan sebagai PDF.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDirectPrint}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 transition"
              title="Cetak kartu langsung ke printer atau simpan PDF"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Sekarang (Print / PDF)</span>
            </button>

            <button
              type="button"
              onClick={handleOpenPrintWindow}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              title="Buka dokumen di jendela cetak mandiri terisolasi"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Jendela Khusus</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-4 mt-4 border-t border-slate-100 text-xs">
          {/* Format */}
          <div>
            <label className="font-bold text-slate-600 block mb-1">Format Dokumen</label>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setPrintFormat("cards")}
                className={`py-1.5 px-2 rounded-lg font-bold text-center text-xs transition ${
                  printFormat === "cards"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Kartu (Grid)
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat("table")}
                className={`py-1.5 px-2 rounded-lg font-bold text-center text-xs transition ${
                  printFormat === "table"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Tabel Rekap
              </button>
            </div>
          </div>

          {/* Cards Per Sheet Option (4, 6, 8) */}
          {printFormat === "cards" ? (
            <div>
              <label className="font-bold text-slate-600 block mb-1">Muatan Kartu / Lembar</label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setCardsPerPage(4)}
                  className={`py-1 px-1.5 rounded-lg font-bold text-center text-xs transition ${
                    cardsPerPage === 4
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-700 hover:text-slate-900"
                  }`}
                  title="4 Kartu per lembar (Format Besar & Jelas)"
                >
                  4 Kartu
                </button>
                <button
                  type="button"
                  onClick={() => setCardsPerPage(6)}
                  className={`py-1 px-1.5 rounded-lg font-bold text-center text-xs transition ${
                    cardsPerPage === 6
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-700 hover:text-slate-900"
                  }`}
                  title="6 Kartu per lembar (Format Standar)"
                >
                  6 Kartu
                </button>
                <button
                  type="button"
                  onClick={() => setCardsPerPage(8)}
                  className={`py-1 px-1.5 rounded-lg font-bold text-center text-xs transition ${
                    cardsPerPage === 8
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-700 hover:text-slate-900"
                  }`}
                  title="8 Kartu per lembar (Format Ringkas / Hemat Kertas)"
                >
                  8 Kartu
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="font-bold text-slate-600 block mb-1">Urutkan Berdasarkan</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                <option value="class">Kelas lalu Nama (A-Z)</option>
                <option value="name">Nama Lengkap (A-Z)</option>
                <option value="nisn">NISN / NIP</option>
              </select>
            </div>
          )}

          {/* Filter Class */}
          <div>
            <label className="font-bold text-slate-600 block mb-1">Rombel / Kelas</label>
            <select
              value={printClassFilter}
              onChange={(e) => setPrintClassFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              <option value="all">Semua Kelas ({users.filter(u => u.role === "siswa").length} Siswa)</option>
              {classes.map((c) => {
                const count = users.filter((u) => u.className === c.name && u.role === "siswa").length;
                return (
                  <option key={c.id} value={c.name}>
                    {c.name} ({count} Siswa)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Filter Role */}
          <div>
            <label className="font-bold text-slate-600 block mb-1">Filter Peran</label>
            <select
              value={printRoleFilter}
              onChange={(e) => setPrintRoleFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              <option value="siswa">Siswa Peserta Ujian</option>
              <option value="guru">Guru Pengampu</option>
              <option value="admin">Administrator</option>
              <option value="all">Semua Akun</option>
            </select>
          </div>

          {/* Search Box */}
          <div>
            <label className="font-bold text-slate-600 block mb-1">Cari Peserta</label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama/NISN..."
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>
        </div>

        {/* Quick summary banner */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              Menampilkan <strong>{printableUsers.length}</strong> peserta &bull; Total{" "}
              <strong>{printFormat === "cards" ? cardPages.length : Math.ceil(printableUsers.length / 25)}</strong> lembar cetak ({cardsPerPage} kartu per lembar).
            </span>
          </div>
          <div className="font-medium text-slate-400">
            Kertas A4 Portrait &bull; Margin 7mm
          </div>
        </div>
      </div>

      {/* Embedded Print CSS: Completely isolates #printable-area and hides all rest of UI */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 7mm 7mm 7mm 7mm;
          }
          *, *::before, *::after {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            width: 100% !important;
            height: auto !important;
            min-height: 100% !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            font-size: 10pt !important;
          }
          /* Hide EVERYTHING in the page */
          body * {
            visibility: hidden !important;
          }
          /* Expose ONLY the printable card container and its descendants */
          #printable-area,
          #printable-area * {
            visibility: visible !important;
          }
          #printable-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
          }
          .no-print,
          .print-modal-backdrop > *:not(#printable-area) {
            display: none !important;
            visibility: hidden !important;
          }
          .print-page-sheet {
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            width: 100% !important;
            min-height: 275mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: flex-start !important;
            padding: 0 0 4mm 0 !important;
            margin-bottom: 0 !important;
            background: #ffffff !important;
            box-sizing: border-box !important;
          }
          .print-page-sheet:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .print-card-unit {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .print-table-row {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .print-signature-block {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Printable Document Sheet Area */}
      <div
        id="printable-area"
        className="w-full max-w-5xl bg-white text-slate-900 rounded-2xl p-4 sm:p-8 shadow-2xl space-y-6"
      >
        {printableUsers.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-40 text-slate-400" />
            <p className="text-base font-bold text-slate-700">
              Tidak ada data yang cocok dengan filter yang dipilih.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Silakan ganti filter kelas atau peran di bilah atas.
            </p>
          </div>
        ) : printFormat === "cards" ? (
          /* Cards Format with Chunked Physical Pages */
          <div className="space-y-8">
            {cardPages.map((pageUsers, pageIdx) => (
              <div
                key={pageIdx}
                className="print-page-sheet bg-white border-b-2 border-slate-200 pb-6 mb-6 print:border-none print:pb-0 print:mb-0"
              >
                {/* Page Header */}
                <div className="border-b border-slate-800 pb-2 mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {schoolProfile?.logoUrl ? (
                      <img
                        src={schoolProfile.logoUrl}
                        alt="Logo"
                        className="w-7 h-7 object-contain rounded"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded bg-slate-900 text-white flex items-center justify-center font-black text-[10px]">
                        SMK
                      </div>
                    )}
                    <div>
                      <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
                        KARTU PESERTA UJIAN ESSAY ONLINE — {schoolProfile?.name || "SMK FUTUUHAL ARIFIN LEMBAR"}
                      </h2>
                      <p className="text-[10px] font-semibold text-slate-600 uppercase">
                        TAHUN PELAJARAN {schoolProfile?.academicYear || "2025/2026"} &bull; {printClassFilter === "all" ? "SEMUA KELAS" : `KELAS ${printClassFilter}`} &bull; ({cardsPerPage} KARTU / LEMBAR)
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-[10px] font-bold text-slate-500">
                    Lembar {pageIdx + 1} dari {cardPages.length}
                  </div>
                </div>

                {/* Grid of Cards (2 Columns Layout per Sheet) */}
                <div
                  className={`grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-3 ${
                    cardsPerPage === 8 ? "gap-y-2" : cardsPerPage === 6 ? "gap-y-2.5" : "gap-y-3.5"
                  }`}
                >
                  {pageUsers.map((u) => (
                    <div
                      key={u.id}
                      className={`print-card-unit border-2 border-slate-800 rounded-xl bg-white text-slate-900 flex flex-col justify-between shadow-sm ${
                        cardsPerPage === 8
                          ? "p-2.5 space-y-1.5"
                          : cardsPerPage === 6
                          ? "p-3 space-y-2"
                          : "p-4 space-y-2.5"
                      }`}
                    >
                      {/* Card Kop */}
                      <div className="flex items-center justify-between border-b border-slate-300 pb-1.5">
                        <div className="flex items-center gap-2">
                          {schoolProfile?.logoUrl ? (
                            <img
                              src={schoolProfile.logoUrl}
                              alt="Logo"
                              className="w-7 h-7 rounded object-contain bg-white border border-slate-200 p-0.5"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded bg-slate-900 text-white flex items-center justify-center font-black text-[10px]">
                              SMK
                            </div>
                          )}
                          <div>
                            <div className="text-[10px] font-black tracking-tight uppercase line-clamp-1">
                              {schoolProfile?.name || "SMK FUTUUHAL ARIFIN LEMBAR"}
                            </div>
                            <div className="text-[8px] text-slate-600 uppercase font-bold">
                              KARTU AKSES UJIAN ONLINE
                            </div>
                          </div>
                        </div>
                        <span className="text-[8px] font-black px-2 py-0.5 rounded bg-slate-100 border border-slate-300 uppercase">
                          {u.role}
                        </span>
                      </div>

                      {/* Student Info & QR */}
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="col-span-2 space-y-0.5">
                          <div>
                            <span className="text-[7.5px] uppercase font-bold text-slate-500 block">
                              Nama Peserta:
                            </span>
                            <span className="font-black text-slate-900 text-xs sm:text-sm leading-tight block">
                              {u.name}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                            <div>
                              <span className="text-[7.5px] uppercase font-bold text-slate-500 block">
                                {u.role === "siswa" ? "NISN:" : "NIP:"}
                              </span>
                              <span className="font-mono font-bold text-slate-800 text-[10px]">
                                {u.nisn || u.nip || "-"}
                              </span>
                            </div>
                            <div>
                              <span className="text-[7.5px] uppercase font-bold text-slate-500 block">
                                Kelas / Rombel:
                              </span>
                              <span className="font-bold text-slate-800 text-[10px]">
                                {u.className || "-"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-center justify-center border border-dashed border-slate-300 rounded-lg p-1 bg-slate-50 min-h-[50px]">
                          {u.avatar ? (
                            <img
                              src={u.avatar}
                              alt={u.name}
                              className="w-10 h-12 object-cover rounded border border-slate-300"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <>
                              <QrCode className="w-5 h-5 text-slate-600 mb-0.5" />
                              <span className="text-[6.5px] font-mono text-slate-500">KODE SESI</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Credentials Highlight Box */}
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-300 space-y-0.5">
                        <div className="text-[7.5px] font-bold uppercase tracking-wider text-slate-600">
                          Kredensial Masuk (Login Ujian):
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-600">Username/Email:</span>
                          <span className="font-mono font-bold text-slate-900">
                            {u.email}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] pt-0.5 border-t border-slate-200">
                          <span className="text-slate-900 font-bold">Kata Sandi:</span>
                          <span className="font-mono font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300 text-[11px]">
                            {u.password || "password123"}
                          </span>
                        </div>
                      </div>

                      {/* Card Footer Rules & Signature */}
                      <div className="text-[7.5px] text-slate-500 border-t border-slate-200 pt-1 flex justify-between items-end">
                        <div className="max-w-[150px] leading-tight text-[7px]">
                          * Dilarang memberikan sandi kepada peserta lain.<br/>
                          * Ujian diawasi sistem proctoring anti-curang.
                        </div>
                        <div className="text-center">
                          <div className="text-[7px] text-slate-500 font-medium">
                            {schoolProfile?.proctorName ? "Proktor Ujian" : "Ttd Pengawas"}
                          </div>
                          <div className="h-3 border-b border-slate-400 w-16"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Table Format */
          <div>
            <div className="border-b-2 border-slate-900 pb-3 mb-4 text-center">
              <h2 className="text-base sm:text-lg font-black uppercase tracking-wider">
                DAFTAR REKAPITULASI AKUN & KATA SANDI PESERTA UJIAN
              </h2>
              <p className="text-xs font-semibold text-slate-700 uppercase">
                {schoolProfile?.name || "SMK FUTUUHAL ARIFIN LEMBAR"} &bull; TAHUN AJARAN {schoolProfile?.academicYear || "2025/2026"}
              </p>
              <div className="flex justify-center gap-4 text-[11px] text-slate-600 mt-1 font-mono">
                <span>Rombel: {printClassFilter === "all" ? "Semua Kelas" : printClassFilter}</span>
                <span>&bull;</span>
                <span>Peran: {printRoleFilter.toUpperCase()}</span>
                <span>&bull;</span>
                <span>Tanggal: {new Date().toLocaleDateString("id-ID")}</span>
              </div>
            </div>

            <table className="w-full text-left text-xs border border-slate-900">
              <thead className="bg-slate-100 uppercase font-black text-[11px] border-b border-slate-900">
                <tr>
                  <th className="p-2 border-r border-slate-900 text-center w-10">No</th>
                  <th className="p-2 border-r border-slate-900">Nama Lengkap</th>
                  <th className="p-2 border-r border-slate-900">NISN / NIP</th>
                  <th className="p-2 border-r border-slate-900">Kelas</th>
                  <th className="p-2 border-r border-slate-900">Email (Username)</th>
                  <th className="p-2 border-r border-slate-900 font-black">Kata Sandi</th>
                  <th className="p-2 text-center w-28">Paraf Pengambilan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {printableUsers.map((u, idx) => (
                  <tr key={u.id} className="print-table-row border-b border-slate-300">
                    <td className="p-2 border-r border-slate-900 text-center font-bold">
                      {idx + 1}
                    </td>
                    <td className="p-2 border-r border-slate-900 font-bold">{u.name}</td>
                    <td className="p-2 border-r border-slate-900 font-mono text-[11px]">
                      {u.nisn || u.nip || "-"}
                    </td>
                    <td className="p-2 border-r border-slate-900">{u.className || "-"}</td>
                    <td className="p-2 border-r border-slate-900 font-mono text-[11px]">
                      {u.email}
                    </td>
                    <td className="p-2 border-r border-slate-900 font-mono font-bold text-slate-900 bg-slate-50">
                      {u.password || "password123"}
                    </td>
                    <td className="p-2 text-center text-slate-400 font-mono text-[9px]">
                      ....................
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Signatures */}
            <div className="print-signature-block grid grid-cols-2 gap-8 pt-8 mt-6 text-xs text-center">
              <div>
                <div className="font-semibold text-slate-600">Mengetahui,</div>
                <div className="font-bold text-slate-900">Kepala Sekolah</div>
                <div className="h-16"></div>
                <div className="font-bold underline">{schoolProfile?.principalName || "Kepala Sekolah"}</div>
                <div className="text-[10px] text-slate-500 font-mono">NIP. {schoolProfile?.principalNip || "-"}</div>
              </div>

              <div>
                <div className="font-semibold text-slate-600">Lembar, {new Date().toLocaleDateString("id-ID")}</div>
                <div className="font-bold text-slate-900">Proktor / Administrator Ujian</div>
                <div className="h-16"></div>
                <div className="font-bold underline">{schoolProfile?.proctorName || currentUser.name}</div>
                <div className="text-[10px] text-slate-500 font-mono">NIP. {schoolProfile?.proctorNip || currentUser.nip || "-"}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
