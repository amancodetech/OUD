'use client';
import React, { useRef, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Calendar, Check, ChevronDown, X } from 'lucide-react';
import { useI18n } from '@/i18n/LanguageContext';
import { reportPeriodCopy } from '@/i18n/report-period';
import { presetReportPeriod, reportPeriodQuery, resolveReportPeriod, validReportRange, REPORT_PRESETS, type ReportPeriod, type ReportPreset } from '@/domain/report-period';
import { useReportPeriodSettings } from './ReportPeriodContext';

export function GlobalPeriodSelector() {
  const router = useRouter(), pathname = usePathname(), query = useSearchParams();
  const { locale, dir } = useI18n();
  const { today, startYear } = useReportPeriodSettings();
  const copy = reportPeriodCopy[locale];
  const applied = resolveReportPeriod(query, today, startYear);
  const [draft, setDraft] = useState<ReportPeriod>(applied);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const error = validReportRange(draft.startDate, draft.endDate, startYear);
  const format = (date: string) => date ? new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(date + 'T00:00:00Z')) : '—';
  function showPicker() {
    setDraft(applied.error ? presetReportPeriod('this_month', today, startYear) : applied);
    dialog.current?.showModal();
    setOpen(true);
  }
  function closePicker() { dialog.current?.close(); }
  function selectPreset(preset: ReportPreset) {
    setDraft(preset === 'custom' ? { ...draft, preset } : presetReportPeriod(preset, today, startYear));
  }
  function apply(event: React.FormEvent) {
    event.preventDefault();
    if (error) return;
    router.push(`${pathname}?${reportPeriodQuery(query, draft)}`, { scroll: false });
    closePicker();
  }
  return (
    <>
      <button type="button" onClick={showPicker} aria-haspopup="dialog" aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-[#DCCBBC] bg-white px-3.5 py-2.5 text-start text-xs text-[#241112] shadow-2xs transition hover:border-[#6E1E24] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6E1E24] sm:w-auto">
        <Calendar className="h-4 w-4 shrink-0 text-[#6E1E24]" aria-hidden="true" />
        <span className="min-w-0"><span className="block font-bold">{copy.presets[applied.preset]}</span>
          <span className="mt-0.5 block text-[11px] text-[#6B5648]">{applied.error ? copy[applied.error] : <span dir="ltr">{format(applied.startDate)} – {format(applied.endDate)}</span>}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#6B5648]" aria-hidden="true" />
      </button>
      <dialog ref={dialog} dir={dir} aria-labelledby="report-period-title" aria-describedby="report-period-description"
        onClose={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closePicker(); } }}
        className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-2xl border border-[#E6DDD3] bg-white p-0 text-[#241112] shadow-xl backdrop:bg-[#241112]/40">
        <form onSubmit={apply}>
          <div className="flex items-start justify-between gap-3 border-b border-[#E6DDD3] p-5">
            <div><h2 id="report-period-title" className="text-base font-bold">{copy.title}</h2><p id="report-period-description" className="mt-1 text-xs text-[#6B5648]">{copy.description}</p></div>
            <button type="button" onClick={closePicker} aria-label={copy.cancel} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-[#F5EFEA] focus-visible:outline-2 focus-visible:outline-[#6E1E24]"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid sm:grid-cols-[180px_1fr]">
            <div className="grid grid-cols-2 gap-1.5 border-b border-[#E6DDD3] bg-[#F9F6F2] p-3 sm:grid-cols-1 sm:border-b-0" role="group" aria-label={copy.title}>
              {REPORT_PRESETS.map(preset => {
                const disabled = preset !== 'custom' && !!presetReportPeriod(preset, today, startYear).error;
                return <button key={preset} type="button" disabled={disabled} aria-pressed={draft.preset === preset} onClick={() => selectPreset(preset)}
                  className={`flex min-h-11 items-center justify-between gap-2 rounded-lg px-3 text-start text-xs font-semibold focus-visible:outline-2 focus-visible:outline-[#6E1E24] disabled:opacity-40 ${draft.preset === preset ? 'bg-[#6E1E24] text-white' : 'text-[#49352B] hover:bg-[#EEE4D9]'}`}>
                  {copy.presets[preset]}{draft.preset === preset && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                </button>;
              })}
            </div>
            <div className="space-y-4 p-5">
              {(['startDate', 'endDate'] as const).map((field, index) => <label key={field} className="block text-xs font-bold">
                <span>{index === 0 ? copy.from : copy.to}</span>
                <input type="date" required min={`${startYear}-01-01`} max={field === 'startDate' ? draft.endDate || '2099-12-31' : '2099-12-31'} value={draft[field]}
                  onChange={event => setDraft({ ...draft, preset: 'custom', [field]: event.target.value })} aria-invalid={!!error} aria-describedby={error ? 'report-period-error' : undefined}
                  className="mt-2 block min-h-11 w-full min-w-0 rounded-lg border border-[#DCCBBC] bg-white px-3 text-sm font-normal text-[#241112] focus:border-[#6E1E24] focus:outline-2 focus:outline-offset-1 focus:outline-[#6E1E24]" />
              </label>)}
              {error && <p id="report-period-error" role="alert" className="text-xs text-[#9C252C]">{copy[error]}</p>}
              <p className="rounded-xl bg-[#F9F6F2] p-3 text-xs leading-6 text-[#6B5648]">{copy.basis}</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-[#E6DDD3] p-4">
            <button type="button" onClick={closePicker} className="min-h-11 rounded-xl border border-[#DCCBBC] px-4 text-xs font-bold hover:bg-[#F9F6F2]">{copy.cancel}</button>
            <button type="submit" disabled={!!error} className="min-h-11 rounded-xl bg-[#6E1E24] px-5 text-xs font-bold text-white hover:bg-[#58161B] disabled:cursor-not-allowed disabled:opacity-40">{copy.apply}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
