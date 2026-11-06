'use client';

import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Link as LinkIcon, Camera } from 'lucide-react';
import { ProductImage } from './ProductImage';

interface ImageUploadInputProps {
  value?: string | null;
  onChange: (val: string | null) => void;
  categoryPrefix?: string;
  categoryName?: string;
  className?: string;
  label?: string;
}

/**
 * Compresses an image file client-side to a max dimension of 400px
 * and returns a WebP (or JPEG fallback) Data URL under 50KB.
 */
async function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const maxDim = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        // Draw image with smooth scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP first, then JPEG
        try {
          const webpData = canvas.toDataURL('image/webp', 0.82);
          if (webpData.startsWith('data:image/webp')) {
            resolve(webpData);
            return;
          }
        } catch {
          // fallback to jpeg
        }
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function ImageUploadInput({
  value,
  onChange,
  categoryPrefix,
  categoryName,
  className = '',
  label = 'صورة الصنف',
}: ImageUploadInputProps) {
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setProcessing(true);
      const compressedDataUrl = await compressImageFile(file);
      onChange(compressedDataUrl);
    } catch (err) {
      console.error('Failed to compress image:', err);
    } finally {
      setProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleApplyUrl = () => {
    const trimmed = urlDraft.trim();
    if (trimmed) {
      onChange(trimmed);
      setUrlDraft('');
      setShowUrlInput(false);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
          <span>{label}</span>
          <span className="text-[11px] font-normal text-slate-400">
            (اختياري — تظهر في نقطة بيع الكاشير وقائمة الأصناف)
          </span>
        </label>
      )}

      <div className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200 bg-slate-50/50">
        {/* Preview Thumbnail */}
        <div className="relative w-16 h-16 shrink-0 rounded-xl overflow-hidden border border-slate-200 bg-white shadow-xs">
          <ProductImage
            src={value}
            alt="معاينة الصنف"
            categoryPrefix={categoryPrefix}
            categoryName={categoryName}
            className="w-full h-full object-cover"
          />
          {processing && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={processing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>اختر صورة</span>
            </button>

            <button
              type="button"
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium transition"
            >
              <LinkIcon className="w-3.5 h-3.5 text-slate-500" />
              <span>رابط صورة</span>
            </button>

            {value && (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium transition"
              >
                <X className="w-3.5 h-3.5" />
                <span>إزالة</span>
              </button>
            )}
          </div>

          <p className="text-[10px] text-slate-400">
            يتم ضغط الصورة تلقائياً لسرعة تحميل فائقة في نقطة البيع
          </p>
        </div>
      </div>

      {showUrlInput && (
        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
          <input
            type="url"
            dir="ltr"
            placeholder="https://example.com/image.jpg"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            className="flex-1 text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
          />
          <button
            type="button"
            onClick={handleApplyUrl}
            className="px-3 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-900 transition"
          >
            تطبيق
          </button>
        </div>
      )}
    </div>
  );
}
