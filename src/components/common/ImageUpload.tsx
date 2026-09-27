import React, { useRef, useState } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";

interface ImageUploadProps {
  label: string;
  value?: string;
  onChange: (base64Url: string) => void;
  onClear?: () => void;
  helperText?: string;
  aspectRatio?: "square" | "rect";
  maxSizeMB?: number;
  previewSize?: "sm" | "md" | "lg";
}

export function ImageUpload({
  label,
  value,
  onChange,
  onClear,
  helperText = "Format JPG, PNG, atau WEBP (Maks. 2MB)",
  aspectRatio = "square",
  maxSizeMB = 2,
  previewSize = "md",
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileProcess = (file: File) => {
    setErrorMsg(null);
    if (!file.type.startsWith("image/")) {
      setErrorMsg("Harap pilih file gambar (JPG, PNG, WEBP).");
      return;
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      setErrorMsg(`Ukuran gambar maksimal ${maxSizeMB}MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        onChange(result);
      }
    };
    reader.onerror = () => {
      setErrorMsg("Gagal membaca file gambar.");
    };
    reader.readAsDataURL(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const previewDimensions = {
    sm: "w-14 h-14",
    md: "w-20 h-20",
    lg: "w-28 h-28",
  }[previewSize];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 block">{label}</label>
        {value && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Hapus Gambar
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Preview box */}
        <div
          className={`relative shrink-0 ${previewDimensions} ${
            aspectRatio === "square" ? "rounded-2xl" : "rounded-xl w-28 h-16"
          } overflow-hidden bg-slate-100 border-2 border-dashed ${
            isDragging ? "border-purple-500 bg-purple-50" : "border-slate-300"
          } flex items-center justify-center transition group shadow-inner`}
        >
          {value ? (
            <img
              src={value}
              alt="Preview"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <ImageIcon className="w-6 h-6 text-slate-400 group-hover:text-purple-600 transition" />
          )}
        </div>

        {/* Upload dropzone / trigger */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex-1 border border-slate-200 hover:border-purple-300 bg-slate-50 hover:bg-purple-50/40 rounded-xl p-3 cursor-pointer transition text-left ${
            isDragging ? "ring-2 ring-purple-500 bg-purple-50" : ""
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg, image/webp"
            onChange={handleInputChange}
            className="hidden"
          />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-purple-600 flex items-center justify-center shadow-xs shrink-0">
              <Upload className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">
                Pilih atau seret gambar ke sini
              </div>
              <div className="text-[10px] text-slate-500">{helperText}</div>
            </div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <p className="text-[11px] text-rose-600 font-semibold">{errorMsg}</p>
      )}
    </div>
  );
}
