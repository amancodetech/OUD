'use client';
import { createContext, useContext } from 'react';
const ReportPeriodContext = createContext<{ startYear: number; today: string } | null>(null);
export function ReportPeriodProvider({ startYear, today, children }: { startYear: number; today: string; children: React.ReactNode }) {
  return <ReportPeriodContext.Provider value={{ startYear, today }}>{children}</ReportPeriodContext.Provider>;
}
export function useReportPeriodSettings() {
  const settings = useContext(ReportPeriodContext);
  if (!settings) throw new Error('Report period settings are required');
  return settings;
}
