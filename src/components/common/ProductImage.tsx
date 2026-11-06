'use client';

import React, { useState } from 'react';
import {
  Flame,
  Droplets,
  Sparkles,
  Coffee,
  Package,
  Gift,
  Boxes,
  CircleDot,
  Crown,
  Layers,
} from 'lucide-react';

interface ProductImageProps {
  src?: string | null;
  alt?: string;
  categoryPrefix?: string;
  categoryName?: string;
  className?: string;
  roundedClassName?: string;
}

export function ProductImage({
  src,
  alt = '',
  categoryPrefix = '',
  categoryName = '',
  className = 'w-full h-full',
  roundedClassName = 'rounded-xl',
}: ProductImageProps) {
  const [hasError, setHasError] = useState(false);

  if (src && !hasError) {
    return (
      <img
        src={src}
        alt={alt}
        onError={() => setHasError(true)}
        className={`object-cover ${roundedClassName} ${className}`}
        loading="lazy"
      />
    );
  }

  // Fallback icon and gradient based on category prefix or name
  const p = (categoryPrefix || '').toUpperCase();
  const n = (categoryName || '').toLowerCase();

  let Icon = Sparkles;
  let bgGradient = 'from-amber-600/15 to-amber-700/25 text-amber-800';

  if (p === 'NA' || p === 'OUD' || n.includes('عود') || n.includes('طبيعي')) {
    Icon = Flame;
    bgGradient = 'from-amber-800/20 to-amber-950/30 text-amber-900';
  } else if (p === 'OO' || p === 'DHN' || n.includes('دهن') || n.includes('زيت')) {
    Icon = Droplets;
    bgGradient = 'from-amber-500/20 to-yellow-600/30 text-amber-700';
  } else if (p === 'SB' || p === 'MSB' || n.includes('سبحة') || n.includes('مسبح')) {
    Icon = CircleDot;
    bgGradient = 'from-emerald-700/20 to-teal-800/30 text-emerald-800';
  } else if (p === 'CF' || p === 'COF' || n.includes('قهو') || n.includes('بن')) {
    Icon = Coffee;
    bgGradient = 'from-stone-700/20 to-stone-900/30 text-stone-800';
  } else if (p === 'PE' || p === 'PER' || n.includes('عطر') || n.includes('رشوش')) {
    Icon = Sparkles;
    bgGradient = 'from-purple-700/20 to-pink-800/30 text-purple-800';
  } else if (p === 'BX' || p === 'BOX' || n.includes('بوكس') || n.includes('علب')) {
    Icon = Boxes;
    bgGradient = 'from-blue-700/20 to-indigo-800/30 text-blue-800';
  } else if (p === 'WD' || p === 'ACC' || n.includes('مبخر') || n.includes('إكسسوار')) {
    Icon = Crown;
    bgGradient = 'from-yellow-700/20 to-amber-800/30 text-amber-800';
  } else if (p === 'PF' || n.includes('توزيع') || n.includes('هدايا')) {
    Icon = Gift;
    bgGradient = 'from-rose-700/20 to-rose-900/30 text-rose-800';
  } else if (p === 'RM' || n.includes('خام')) {
    Icon = Layers;
    bgGradient = 'from-slate-700/20 to-slate-900/30 text-slate-800';
  }

  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br border border-amber-900/10 ${bgGradient} ${roundedClassName} ${className}`}
    >
      <Icon className="w-1/2 h-1/2 opacity-75 drop-shadow-xs" />
    </div>
  );
}
