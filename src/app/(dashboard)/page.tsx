'use client';
import { useApiQuery } from '@/lib/use-api-query';
import { queryKeys } from '@/lib/query-keys';
import { QueryStatus } from '@/components/data/QueryStatus';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  TrendingUp,
  DollarSign,
  Package,
  Layers,
  ShoppingBag,
  ShieldCheck,
  Landmark,
  Sparkles,
  PieChart as PieIcon,
  BarChart2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { DailyClosingChecklistModal } from '@/components/modals/DailyClosingChecklistModal';
import { GlobalPeriodSelector } from '@/components/layout/GlobalPeriodSelector';
import { useI18n } from '@/i18n/LanguageContext';
import { reportPeriodCopy } from '@/i18n/report-period';
import { resolveReportPeriod } from '@/domain/report-period';
import { useReportPeriodSettings } from '@/components/layout/ReportPeriodContext';

interface DashboardData {
  startDate: string;
  endDate: string;
  startYear: number;
  cards: {
    netSales: number;
    netCOGS: number;
    grossProfit: number;
    cashOperatingExpenses: number;
    inventoryLossesAndIssues: number;
    otherOperatingAdditions: number;
    operatingProfit: number;
    inventoryValue: number;
    cashAndBankTotal: number;
    cashBalance: number;
    bankBalance: number;
    clientDebtTotal: number;
    supplierDebtTotal: number;
    clientCreditTotal: number;
    supplierCreditTotal: number;
    openingEquityDiff: number;
    cumulativeOperatingProfitSinceStart: number;
  };
  monthlyComparison: Array<{
    monthIndex: number;
    year: number;
    month: number;
    monthName: string;
    netSales: number;
    cogs: number;
    grossProfit: number;
    cashExpenses: number;
    operatingProfit: number;
    endingInventoryValue: number;
  }>;
  categorySales: Array<{
    categoryId: string;
    categoryName: string;
    categoryPrefix: string;
    netSales: number;
  }>;
}

export default function DashboardPage() {
  const { t, locale, isRtl, tCategory } = useI18n();
  const { today, startYear } = useReportPeriodSettings();
  const periodCopy = reportPeriodCopy[locale];
  const searchParams = useSearchParams();
  const period = resolveReportPeriod(searchParams, today, startYear);
  const { startDate, endDate } = period;
  const rangeError = period.error ? periodCopy[period.error] : '';

  const query = useApiQuery<DashboardData>(rangeError ? null : queryKeys.dashboard(startDate, endDate));
  const { data, error: queryError, isLoading: loading } = query;
  const error = queryError?.message || '';
  const [closingModalOpen, setClosingModalOpen] = useState(false);

  const header = (
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#E6DDD3] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#241112] flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#F5EFEA] border border-[#E6DDD3] text-[#6E1E24]">
              <TrendingUp className="w-5 h-5" />
            </span>
            <span>{t.dashboard.title}</span>
          </h1>
          <p className="text-xs text-[#6B5648] mt-1.5 mr-1">
            {t.dashboard.selectedPeriod || 'الفترة المحاسبية المحددة:'}{' '}
            <span dir="ltr" data-testid="applied-report-range" className="inline-block font-mono font-bold text-[#241112]">{startDate} – {endDate}</span>
          </p>
          {data && <QueryStatus query={query} />}
          <p className="mt-1.5 max-w-xl text-[11px] leading-5 text-[#6B5648]">{periodCopy.basis}</p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <GlobalPeriodSelector />
          <button
            onClick={() => setClosingModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#6E1E24] hover:bg-[#58161B] text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            <ShieldCheck className="w-4 h-4 text-[#E6B88A]" />
            <span>{t.dashboard.dailyClosingChecklistBtn || 'مراجعة نهاية اليوم (Checklist)'}</span>
          </button>
        </div>
      </div>

  );

  if (!rangeError && (loading || (!error && data && (data.startDate !== startDate || data.endDate !== endDate)))) {
    return (
      <div className="space-y-6">{header}<div className="py-24 text-center space-y-3" role="status">
        <div className="w-10 h-10 border-4 border-[#6E1E24] border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-sm font-semibold text-[#6B5648]">
          {t.common.loading}
        </p>
      </div></div>
    );
  }

  if (rangeError || (!data && error) || !data) {
    return (
      <div className="space-y-6">{header}<div role="alert" className="p-6 bg-white border border-[#E6DDD3] rounded-2xl text-[#6E1E24] text-sm">
        <p className="font-bold">{t.common.errorOccurred}:</p>
        <p>{rangeError || error}</p>
        {!rangeError && queryError && <QueryStatus query={query} />}
      </div></div>
    );
  }

  const cards = data.cards;

  const salesLabel = t.dashboard.chartNetSales || 'صافي المبيعات';
  const profitLabel = t.dashboard.chartOperatingProfit || 'الربح التشغيلي';

  // Chart data formatting
  const chartData = data.monthlyComparison.map((m) => {
    const localizedMonth = t.header.months[m.month - 1].replace(/ \(\d+\)$/, '') + ` ${m.year}`;
    return {
      name: localizedMonth,
      [salesLabel]: Math.round(m.netSales),
      [profitLabel]: Math.round(m.operatingProfit),
    };
  });

  // Total sales across categories
  const totalCategorySales = data.categorySales.reduce((sum, c) => sum + c.netSales, 0);

  return (
    <div className="space-y-6">
      {header}

      {/* 14 Income Statement & Balances Cards — Harmonious Unified Design */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold text-[#6B5648] flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-[#9A6533]" />
          <span>{t.dashboard.incomeStatementTitle || 'قائمة الدخل ومؤشرات الأرصدة (14 بنداً محاسبياً)'}</span>
        </h2>

        {/* Row 1: Operating Revenue & Gross Profit */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Net Sales B10 */}
          <div className="bg-white p-5 rounded-2xl border border-[#E6DDD3] shadow-2xs">
            <div className="flex items-center justify-between text-xs text-[#6B5648]">
              <span className="font-bold">{t.dashboard.cardNetSales || '1. صافي المبيعات (B10)'}</span>
              <div className="w-8 h-8 rounded-xl bg-[#F5EFEA] text-[#6E1E24] flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono text-[#241112] mt-2.5">
              {cards.netSales.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              <span className="text-xs font-normal text-[#8C7362]">{t.common.currency}</span>
            </div>
            <div className="text-[11px] text-[#8C7362] mt-1">{t.dashboard.cardNetSalesDesc || 'بعد المرتجعات بتاريخها'}</div>
          </div>

          {/* 2. COGS B11 */}
          <div className="bg-white p-5 rounded-2xl border border-[#E6DDD3] shadow-2xs">
            <div className="flex items-center justify-between text-xs text-[#6B5648]">
              <span className="font-bold">{t.dashboard.cardCogs || '2. تكلفة المبيعات (B11)'}</span>
              <div className="w-8 h-8 rounded-xl bg-[#F5EFEA] text-[#784A2F] flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono text-[#241112] mt-2.5">
              {cards.netCOGS.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              <span className="text-xs font-normal text-[#8C7362]">{t.common.currency}</span>
            </div>
            <div className="text-[11px] text-[#8C7362] mt-1">{t.dashboard.cardCogsDesc || 'بعد عكس تكلفة المرتجعات'}</div>
          </div>

          {/* 3. Gross Profit B12 */}
          <div className="bg-white p-5 rounded-2xl border border-[#E6DDD3] shadow-2xs">
            <div className="flex items-center justify-between text-xs text-[#6B5648]">
              <span className="font-bold">{t.dashboard.cardGrossProfit || '3. مجمل الربح (B12)'}</span>
              <div className="w-8 h-8 rounded-xl bg-[#F5EFEA] text-[#9A6533] flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono text-[#241112] mt-2.5">
              {cards.grossProfit.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              <span className="text-xs font-normal text-[#8C7362]">{t.common.currency}</span>
            </div>
            <div className="text-[11px] text-[#8C7362] mt-1">{t.dashboard.cardGrossProfitDesc || 'المبيعات ناقص التكلفة'}</div>
          </div>

          {/* 4. Cash Expenses B13 */}
          <div className="bg-white p-5 rounded-2xl border border-[#E6DDD3] shadow-2xs">
            <div className="flex items-center justify-between text-xs text-[#6B5648]">
              <span className="font-bold">{t.dashboard.cardExpenses || '4. المصروفات النقدية (B13)'}</span>
              <div className="w-8 h-8 rounded-xl bg-[#F5EFEA] text-[#6E1E24] flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono text-[#241112] mt-2.5">
              {cards.cashOperatingExpenses.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              <span className="text-xs font-normal text-[#8C7362]">{t.common.currency}</span>
            </div>
            <div className="text-[11px] text-[#8C7362] mt-1">{t.dashboard.cardExpensesDesc || 'بحسب تاريخ الصرف والنثريات'}</div>
          </div>
        </div>

        {/* Row 2: Losses, Operating Profit & Cumulative Profits */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 5. Issues & Damaged Losses */}
          <div className="bg-white p-5 rounded-2xl border border-[#E6DDD3] shadow-2xs">
            <div className="flex items-center justify-between text-xs text-[#6B5648]">
              <span className="font-bold">{t.dashboard.cardLossesIssues || '5. تستر وعينات وتالف وفروق'}</span>
              <div className="w-8 h-8 rounded-xl bg-[#F5EFEA] text-[#784A2F] flex items-center justify-center">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono text-[#241112] mt-2.5">
              {cards.inventoryLossesAndIssues.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              <span className="text-xs font-normal text-[#8C7362]">{t.common.currency}</span>
            </div>
            <div className="text-[11px] text-[#8C7362] mt-1">{t.dashboard.cardLossesIssuesDesc || 'خسائر مخزون ومصروف تالف'}</div>
          </div>

          {/* 6. Operating Profit B14 (Soft Harmonious Highlight Card) */}
          <div className="bg-[#FAF5EE] p-5 rounded-2xl border border-[#D4B895] shadow-2xs">
            <div className="flex items-center justify-between text-xs text-[#6E1E24]">
              <span className="font-bold">{t.dashboard.cardOperatingProfit || '6. الربح التشغيلي (B14)'}</span>
              <div className="w-8 h-8 rounded-xl bg-[#6E1E24] text-[#E6B88A] flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono text-[#6E1E24] mt-2.5">
              {cards.operatingProfit.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              <span className="text-xs font-normal text-[#784A2F]">{t.common.currency}</span>
            </div>
            <div className="text-[11px] text-[#784A2F] mt-1">
              {t.dashboard.cardOperatingProfitDesc || 'صافي ربح التشغيل للفترة قبل الإهلاك'}
            </div>
          </div>

          {/* 14. Cumulative Operating Profit B35 */}
          <div className="bg-white p-5 rounded-2xl border border-[#E6DDD3] shadow-2xs">
            <div className="flex items-center justify-between text-xs text-[#6B5648]">
              <span className="font-bold">{t.dashboard.cardCumulativeProfit || '14. أرباح متراكمة منذ البداية (B35)'}</span>
              <div className="w-8 h-8 rounded-xl bg-[#F5EFEA] text-[#9A6533] flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono text-[#241112] mt-2.5">
              {cards.cumulativeOperatingProfitSinceStart.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              <span className="text-xs font-normal text-[#8C7362]">{t.common.currency}</span>
            </div>
            <div className="text-[11px] text-[#8C7362] mt-1">
              {t.dashboard.cardCumulativeProfitDesc || 'تراكمي لحساب الشركاء'} ({data.startYear})
            </div>
          </div>

          {/* 7. Inventory Value B15 */}
          <div className="bg-white p-5 rounded-2xl border border-[#E6DDD3] shadow-2xs">
            <div className="flex items-center justify-between text-xs text-[#6B5648]">
              <span className="font-bold">{t.dashboard.cardInventoryValue || '7. قيمة المخزون (B15)'}</span>
              <div className="w-8 h-8 rounded-xl bg-[#F5EFEA] text-[#784A2F] flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono text-[#241112] mt-2.5">
              {cards.inventoryValue.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              <span className="text-xs font-normal text-[#8C7362]">{t.common.currency}</span>
            </div>
            <div className="text-[11px] text-[#8C7362] mt-1">
              {t.dashboard.cardInventoryValueDesc || 'رصيد المخزون الفعلي (عود + دهن عود + عطور)'}
            </div>
          </div>
        </div>

        {/* Row 3: Liquidity, Debts & Balances */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* 8. Cash & Bank B16 */}
          <div className="bg-white p-4 rounded-2xl border border-[#E6DDD3] shadow-2xs col-span-1 lg:col-span-2">
            <div className="flex items-center justify-between text-xs text-[#6B5648]">
              <span className="font-bold">{t.dashboard.cardCashAndBank || '8. الخزينة والبنك (B16)'}</span>
              <Landmark className="w-4 h-4 text-[#6E1E24]" />
            </div>
            <div className="text-xl font-bold font-mono text-[#241112] mt-1.5">
              {cards.cashAndBankTotal.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              <span className="text-xs font-normal text-[#8C7362]">{t.common.currency}</span>
            </div>
            <div className="text-[11px] text-[#6B5648] mt-1.5 flex justify-between font-mono bg-[#F9F6F2] px-2.5 py-1 rounded-lg border border-[#E6DDD3]">
              <span>{t.dashboard.cashDrawer || 'خزينة'}: {cards.cashBalance.toLocaleString('en-US')} {t.common.currency}</span>
              <span>{t.dashboard.bank || 'بنك'}: {cards.bankBalance.toLocaleString('en-US')} {t.common.currency}</span>
            </div>
          </div>

          {/* 9. Client Debt B17 */}
          <div className="bg-white p-4 rounded-2xl border border-[#E6DDD3] shadow-2xs">
            <span className="text-[11px] text-[#6B5648] block font-bold">
              {t.dashboard.cardClientDebt || '9. مستحق العملاء (B17)'}
            </span>
            <div className="text-lg font-bold font-mono text-[#241112] mt-1.5">
              {cards.clientDebtTotal.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-[10px] text-[#8C7362] mt-0.5">{t.dashboard.cardClientDebtDesc || 'مديونية العملاء لنا'}</div>
          </div>

          {/* 10. Supplier Debt J9 */}
          <div className="bg-white p-4 rounded-2xl border border-[#E6DDD3] shadow-2xs">
            <span className="text-[11px] text-[#6B5648] block font-bold">
              {t.dashboard.cardSupplierDebt || '10. مستحق الموردين (J9)'}
            </span>
            <div className="text-lg font-bold font-mono text-[#241112] mt-1.5">
              {cards.supplierDebtTotal.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-[10px] text-[#8C7362] mt-0.5">{t.dashboard.cardSupplierDebtDesc || 'مستحقات الموردين علينا'}</div>
          </div>

          {/* 11. Client Credit J10 */}
          <div className="bg-white p-4 rounded-2xl border border-[#E6DDD3] shadow-2xs">
            <span className="text-[11px] text-[#6B5648] block font-bold">
              {t.dashboard.cardClientCredit || '11. دائن العملاء (J10)'}
            </span>
            <div className="text-lg font-bold font-mono text-[#241112] mt-1.5">
              {cards.clientCreditTotal.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-[10px] text-[#8C7362] mt-0.5">{t.dashboard.cardClientCreditDesc || 'مقدمات أو مرتجعات'}</div>
          </div>

          {/* 12. Supplier Credit J11 */}
          <div className="bg-white p-4 rounded-2xl border border-[#E6DDD3] shadow-2xs">
            <span className="text-[11px] text-[#6B5648] block font-bold">
              {t.dashboard.cardSupplierCredit || '12. دائن الموردين (J11)'}
            </span>
            <div className="text-lg font-bold font-mono text-[#241112] mt-1.5">
              {cards.supplierCreditTotal.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-[10px] text-[#8C7362] mt-0.5">{t.dashboard.cardSupplierCreditDesc || 'رصيد لنا عند الموردين'}</div>
          </div>

          {/* 13. Opening Equity Diff J16 */}
          <div className="bg-white p-4 rounded-2xl border border-[#E6DDD3] shadow-2xs">
            <span className="text-[11px] text-[#6B5648] block font-bold">
              {t.dashboard.cardOpeningEquityDiff || '13. فرق الافتتاح (J16)'}
            </span>
            <div
              className={`text-lg font-bold font-mono mt-1.5 ${
                Math.abs(cards.openingEquityDiff) < 0.01
                  ? 'text-[#241112]'
                  : 'text-[#6E1E24]'
              }`}
            >
              {cards.openingEquityDiff.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-[10px] text-[#8C7362] mt-0.5">
              {Math.abs(cards.openingEquityDiff) < 0.01
                ? (t.dashboard.equityBalanced || 'متوازن تماماً ✅')
                : (t.dashboard.equityPending || 'بانتظار مطابقة التأسيس')}
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: 12-Month Comparison & Interactive Chart */}
      <div className="bg-white rounded-2xl border border-[#E6DDD3] p-6 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#F2ECE4] pb-3.5">
          <div>
            <h3 className="text-base font-bold text-[#241112] flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-[#6E1E24]" />
              <span>{periodCopy.chartTitle}</span>
            </h3>
            <p className="text-xs text-[#6B5648] mt-0.5">
              {periodCopy.chartDescription}
            </p>
          </div>
        </div>

        {/* Recharts Bar Chart */}
        <div className="w-full h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE5DC" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B5648' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6B5648' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#241112',
                  border: '1px solid #5C3A21',
                  borderRadius: '12px',
                  color: '#F9F6F2',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey={salesLabel} fill="#6E1E24" radius={[6, 6, 0, 0]} />
              <Bar dataKey={profitLabel} fill="#B07B4E" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 12-Month Comparison Table */}
        <div className="overflow-x-auto rounded-xl border border-[#E6DDD3]">
          <table className={`w-full ${isRtl ? 'text-right' : 'text-left'} text-xs`}>
            <thead className="bg-[#F6F1EB] text-[#241112] font-bold border-b border-[#E6DDD3]">
              <tr>
                <th className="p-3">{t.dashboard.monthCol || 'الشهر'}</th>
                <th className="p-3 text-left">{t.dashboard.netSalesCol || 'صافي المبيعات'}</th>
                <th className="p-3 text-left">{t.dashboard.cogsCol || 'تكلفة المبيعات'}</th>
                <th className="p-3 text-left">{t.dashboard.grossProfitCol || 'مجمل الربح'}</th>
                <th className="p-3 text-left">{t.dashboard.cashExpensesCol || 'مصروفات نقدية'}</th>
                <th className="p-3 text-left">{t.dashboard.operatingProfitCol || 'الربح التشغيلي'}</th>
                <th className="p-3 text-left">{t.dashboard.inventoryValueCol || 'قيمة المخزون'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2ECE4] font-mono">
              {data.monthlyComparison.map((m) => {
                const localizedMonth = t.header.months[m.month - 1].replace(/ \(\d+\)$/, '') + ` ${m.year}`;

                return (
                  <tr key={`${m.year}-${m.month}`} className="hover:bg-[#F9F6F2] transition-colors">
                    <td className="p-2.5 font-bold font-sans text-[#241112]">
                      {localizedMonth}
                    </td>
                    <td className="p-2.5 text-left text-[#241112]">
                      {m.netSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2.5 text-left text-[#6B5648]">
                      {m.cogs.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2.5 text-left text-[#241112]">
                      {m.grossProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2.5 text-left text-[#6B5648]">
                      {m.cashExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2.5 text-left font-bold text-[#6E1E24]">
                      {m.operatingProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2.5 text-left text-[#6B5648]">
                      {m.endingInventoryValue.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Category Sales Table & Progress Overview */}
      <div className="bg-white rounded-2xl border border-[#E6DDD3] p-6 shadow-2xs space-y-5">
        <div className="flex items-center justify-between border-b border-[#F2ECE4] pb-3.5">
          <div>
            <h3 className="text-base font-bold text-[#241112] flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-[#6E1E24]" />
              <span>{t.dashboard.categorySalesTitle || 'صافي المبيعات حسب الفئات الـ 12'}</span>
            </h3>
            <p className="text-xs text-[#6B5648] mt-0.5">
              {t.dashboard.categorySalesSubtitle || 'إجمالي مبيعات الفئات للفترة المحددة ومساهمة كل فئة في الإيراد الكلي'}
            </p>
          </div>
          <div className="text-left font-mono bg-[#F9F6F2] px-3.5 py-2 rounded-xl border border-[#E6DDD3]">
            <span className="text-[11px] text-[#6B5648] block">{t.dashboard.totalCategorySales || 'إجمالي مبيعات الفئات:'}</span>
            <span className="text-base font-bold text-[#6E1E24]">
              {totalCategorySales.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
              <span className="text-xs font-normal">{t.common.currency}</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {data.categorySales.map((c) => {
            const percent =
              totalCategorySales > 0 ? (c.netSales / totalCategorySales) * 100 : 0;

            return (
              <div
                key={c.categoryId}
                className="p-4 rounded-xl border border-[#E6DDD3] bg-[#F9F6F2]/60 hover:bg-[#F9F6F2] transition space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#241112]">
                    {tCategory(c.categoryName)}{' '}
                    <span className="text-[#8C7362] font-mono">({c.categoryPrefix})</span>
                  </span>
                  <span className="font-mono text-xs font-bold text-[#241112]">
                    {c.netSales.toLocaleString('en-US', { minimumFractionDigits: 2 })} {t.common.currency}
                  </span>
                </div>
                <div className="w-full bg-[#E6DDD3] rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-[#6E1E24] h-1.5 rounded-full transition-all"
                    style={{ width: `${percent}%` }}
                  ></div>
                </div>
                <div className="text-[10px] text-[#8C7362] text-left font-mono">
                  {percent.toFixed(1)}% {t.dashboard.ofTotal || 'من الإجمالي'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily Closing Checklist Modal */}
      <DailyClosingChecklistModal
        isOpen={closingModalOpen}
        onClose={() => setClosingModalOpen(false)}
      />
    </div>
  );
}
