'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User, ArrowLeft, ArrowRight, Flame } from 'lucide-react';
import { useI18n } from '@/i18n/LanguageContext';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';

export default function LoginPage() {
  const router = useRouter();
  const { t, isRtl, dir } = useI18n();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t.auth.invalidCredentials);
      }
      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.common.errorOccurred);
    } finally {
      setLoading(false);
    }
  };

  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#2B090C] via-[#3D1014] to-[#261209] p-4"
      dir={dir}
    >
      {/* Language Switcher at Top */}
      <div className="mb-6 flex justify-center">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-md rounded-2xl border border-[#8B1E24]/60 bg-[#1F0709]/95 p-8 shadow-2xl text-[#FAF6F0]">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8B1E24] to-[#D97706] text-amber-200 border border-amber-400/40 shadow-lg">
            <Flame className="h-8 w-8" />
          </div>
          <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-amber-300">
            {t.auth.loginTitle}
          </h2>
          <p className="mt-1.5 text-xs text-[#E6D7C3]/80">
            {t.auth.loginSubtitle}
          </p>
        </div>

        {error && (
          <div className="mt-5 rounded-xl bg-rose-500/15 border border-rose-500/30 p-3 text-center text-xs font-bold text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#F4ECE1]">{t.auth.username}</label>
            <div className="relative mt-1.5">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className={`block w-full rounded-xl border border-[#6E171C] bg-[#2B090C] py-2.5 ${
                  isRtl ? 'pr-10 pl-3' : 'pl-10 pr-3'
                } text-sm text-white placeholder-[#A68A71] focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400`}
              />
              <div
                className={`pointer-events-none absolute inset-y-0 ${
                  isRtl ? 'right-0 pr-3' : 'left-0 pl-3'
                } flex items-center`}
              >
                <User className="h-4 w-4 text-amber-400/70" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#F4ECE1]">{t.auth.password}</label>
            <div className="relative mt-1.5">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`block w-full rounded-xl border border-[#6E171C] bg-[#2B090C] py-2.5 ${
                  isRtl ? 'pr-10 pl-3' : 'pl-10 pr-3'
                } text-sm text-white placeholder-[#A68A71] focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400`}
              />
              <div
                className={`pointer-events-none absolute inset-y-0 ${
                  isRtl ? 'right-0 pr-3' : 'left-0 pl-3'
                } flex items-center`}
              >
                <Lock className="h-4 w-4 text-amber-400/70" />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#8B1E24] via-[#991B1B] to-[#B45309] py-2.5 px-4 text-sm font-extrabold text-white shadow-lg border border-amber-400/30 transition hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50"
          >
            <span>{loading ? t.auth.loggingIn : t.auth.loginBtn}</span>
            <ArrowIcon className="h-4 w-4" />
          </button>
        </form>


      </div>
    </div>
  );
}
