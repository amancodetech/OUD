'use client';
import { useApiQuery } from '@/lib/use-api-query';
import { queryKeys } from '@/lib/query-keys';
import { QueryStatus } from '@/components/data/QueryStatus';
import { usePermissions } from '@/components/layout/PageAccessGate';
import { apiFetch } from '@/lib/client-api';
import { todayInStore } from '@/domain/period';

import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Landmark,
  Plus,
  Search,
  Filter,
  DollarSign,
  AlertCircle,
  Clock,
  ArrowRightLeft,
  Users,
  Building,
  RotateCcw,
  Sparkles,
  Layers,
  Trash2,
  X,
  CreditCard,
  CheckCircle2,
} from 'lucide-react';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { SearchableCombobox } from '@/components/forms/SearchableCombobox';
import { useI18n } from '@/i18n/LanguageContext';
import { useSearchParams } from 'next/navigation';

export default function CashPage() {
  const { t, locale, isRtl, tCashType, tPartyType, tInvoiceKey, tLocalizedName } = useI18n();
  const searchParams = useSearchParams();

  const [filterAccount, setFilterAccount] = useState<'ALL' | 'CASH' | 'BANK'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Transaction Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [operationKey, setOperationKey] = useState(() => crypto.randomUUID());
  const [txType, setTxType] = useState<string>('CUSTOMER_COLLECTION');
  const [txDate, setTxDate] = useState(todayInStore());
  const [txAccount, setTxAccount] = useState<'CASH' | 'BANK'>('CASH');
  const [transferToAccount, setTransferToAccount] = useState<'CASH' | 'BANK'>('BANK');
  const [txAmount, setTxAmount] = useState<number>(0);
  const [txPartyId, setTxPartyId] = useState('');
  const [txInvoiceKey, setTxInvoiceKey] = useState('');
  const [txAssetId, setTxAssetId] = useState('');
  const [txDescription, setTxDescription] = useState('');

  // Options & Dropdown data
  const [partyInvoices, setPartyInvoices] = useState<any[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [txError, setTxError] = useState('');

  useEffect(() => {
    const qType = searchParams.get('type');
    const qPartyId = searchParams.get('partyId');
    const qInvoiceKey = searchParams.get('invoiceKey');
    const qAmount = searchParams.get('amount');

    if (qType || qPartyId) {
      if (qType) setTxType(qType);
      if (qPartyId) setTxPartyId(qPartyId);
      if (qInvoiceKey) setTxInvoiceKey(qInvoiceKey);
      if (qAmount && !isNaN(Number(qAmount))) setTxAmount(Number(qAmount));
      setModalOpen(true);
    }
  }, [searchParams]);

  // Void Modal State
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [txToVoid, setTxToVoid] = useState<any>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState('');

  const permissions = usePermissions();
  const fullCash = permissions.includes('cash_full');
  const query = useApiQuery<any>(queryKeys.cash);
  const summaryQuery = useApiQuery<any>(fullCash ? queryKeys.cashSummary : null);
  const partiesQuery = useApiQuery<any>(queryKeys.partiesLookup());
  const assetsQuery = useApiQuery<any>(fullCash ? queryKeys.fixedAssets : null);
  const transactions: any[] = Array.isArray(query.data) ? query.data : query.data?.data || [];
  const summary = summaryQuery.data?.data || summaryQuery.data || {};
  const parties: any[] = partiesQuery.data?.data || [];
  const clients = parties.filter(p => p.type === 'CLIENT');
  const suppliers = parties.filter(p => p.type === 'SUPPLIER');
  const drivers = parties.filter(p => p.type === 'DRIVER');
  const partners = parties.filter(p => p.type === 'PARTNER');
  const funders = parties.filter(p => p.type === 'FUNDER');
  const assets: any[] = assetsQuery.data?.data?.assets || [];
  const loading = query.isLoading || partiesQuery.isLoading;
  const loadData = () => Promise.all([query.mutate(), summaryQuery.mutate(), partiesQuery.mutate(), assetsQuery.mutate()]);

  // Fetch pending invoices when party changes in collection/refund/payment
  const handlePartyChange = async (partyId: string) => {
    setTxPartyId(partyId);
    setTxInvoiceKey('');
    setPartyInvoices([]);

    if (!partyId) return;
    try {
      const res = await apiFetch(`/api/cash/invoices?partyId=${partyId}&asOfDate=${txDate}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setPartyInvoices(data);
        if (data.length > 0) {
          setTxInvoiceKey(data[0].invoiceKey);
          if (data[0].remainingAmount > 0) {
            setTxAmount(Math.abs(data[0].remainingAmount));
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openNewTransaction = (type: string) => {
    setTxType(type);
    setTxAmount(0);
    setTxPartyId('');
    setTxInvoiceKey('');
    setTxAssetId('');
    setTxDescription('');
    setTxError('');

    if (type === 'INTERNAL_TRANSFER') {
      setTxAccount('CASH');
      setTransferToAccount('BANK');
    }

    if (type === 'OWNER_BROTHER_FINANCING' || type === 'OWNER_BROTHER_REPAYMENT') {
      if (funders.length > 0) setTxPartyId(funders[0].id);
    }

    setModalOpen(true);
  };

  const submitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (txAmount <= 0) {
      setTxError(
        locale === 'ar'
          ? 'يرجى إدخال مبلغ أكبر من الصفر'
          : 'Please enter an amount greater than zero'
      );
      return;
    }

    setSubmitting(true);
    setTxError('');
    try {
      const payload = {
        txDate,
        type: txType,
        account: txAccount,
        transferToAccount: txType === 'INTERNAL_TRANSFER' ? transferToAccount : null,
        amount: txAmount,
        partyId: txPartyId || null,
        invoiceKey: txInvoiceKey || null,
        assetId: txAssetId || null,
        description: txDescription.trim() || null,
      };

      const res = await apiFetch('/api/cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': operationKey },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save transaction');

      setModalOpen(false);
      setOperationKey(crypto.randomUUID());
      await loadData();
    } catch (err: any) {
      setTxError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidReason || voidReason.trim().length < 3) {
      setVoidError(
        locale === 'ar'
          ? 'يرجى كتابة سبب الإلغاء (3 أحرف على الأقل)'
          : 'Please enter the cancellation reason (at least 3 characters)'
      );
      return;
    }

    setVoiding(true);
    setVoidError('');
    try {
      const res = await apiFetch(`/api/cash/${txToVoid.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: voidReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to void transaction');

      setVoidModalOpen(false);
      await loadData();
    } catch (err: any) {
      setVoidError(err.message);
    } finally {
      setVoiding(false);
    }
  };

  const filteredTransactions = transactions.filter((t) => {
    if (filterAccount === 'CASH') {
      if (t.account !== 'CASH' && t.transferToAccount !== 'CASH') return false;
    } else if (filterAccount === 'BANK') {
      if (t.account !== 'BANK' && t.transferToAccount !== 'BANK') return false;
    }

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const matchCode = t.code?.toLowerCase().includes(s);
      const matchParty = t.party?.name?.toLowerCase().includes(s);
      const matchDesc = t.description?.toLowerCase().includes(s);
      const matchInv = t.invoiceKey?.toLowerCase().includes(s);
      if (!matchCode && !matchParty && !matchDesc && !matchInv) return false;
    }

    return true;
  });

  const isIncomingType = (type: string) => {
    return [
      'CUSTOMER_COLLECTION',
      'PARTNER_CONTRIBUTION',
      'LOAN_RECEIVED',
      'OWNER_BROTHER_FINANCING',
      'EXTERNAL_SALES_PROFIT',
      'SUPPLIER_REFUND',
    ].includes(type);
  };

  const dateLocale = locale === 'ar' ? 'ar-EG' : 'en-US';

  if (query.error && !query.data) return <QueryStatus query={query} />;

  return (
    <div className="space-y-6">
      <QueryStatus query={query} />
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Wallet className="w-6 h-6 text-amber-600" />
            {t.cash.title}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {t.cash.subtitle}
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setFilterAccount('ALL')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filterAccount === 'ALL'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.cash.all}
          </button>
          <button
            onClick={() => setFilterAccount('CASH')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filterAccount === 'CASH'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.cash.cashOnly}
          </button>
          <button
            onClick={() => setFilterAccount('BANK')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filterAccount === 'BANK'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.cash.bankOnly}
          </button>
        </div>
      </div>

      {/* 3 Top Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-amber-100 font-medium">{t.cash.currentCashBalance}</p>
            <p className="text-2xl font-black mt-1 font-mono" dir="ltr">
              {summary.cashBalance?.toLocaleString()} <span className="text-xs font-normal">IDR</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
            <Wallet className="w-6 h-6 text-white" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-blue-100 font-medium">{t.cash.currentBankBalance}</p>
            <p className="text-2xl font-black mt-1 font-mono" dir="ltr">
              {summary.bankBalance?.toLocaleString()} <span className="text-xs font-normal">IDR</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
            <Landmark className="w-6 h-6 text-white" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-300 font-medium">{t.cash.totalCashAndBank}</p>
            <p className="text-2xl font-black mt-1 font-mono text-amber-300" dir="ltr">
              {summary.cashAndBankTotal?.toLocaleString()} <span className="text-xs font-normal">IDR</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-amber-400" />
          </div>
        </div>
      </div>

      {/* Categorized Quick Action Buttons */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <h2 className="text-xs font-bold text-slate-700">{t.cash.quickActionsTitle}</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Group 1: Clients & Suppliers */}
          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 space-y-2">
            <span className="text-[11px] font-bold text-slate-500 block">{t.cash.clientsAndSuppliers}</span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => openNewTransaction('CUSTOMER_COLLECTION')}
                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg shadow-sm transition-all"
              >
                {t.cash.customerCollectionBtn}
              </button>
              <button
                onClick={() => openNewTransaction('SUPPLIER_PAYMENT')}
                className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded-lg shadow-sm transition-all"
              >
                {t.cash.supplierPaymentBtn}
              </button>
              <button
                onClick={() => openNewTransaction('CUSTOMER_REFUND')}
                className="px-2.5 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 text-[11px] font-bold rounded-lg border border-rose-200 transition-all"
              >
                {t.cash.customerRefundBtn}
              </button>
              <button
                onClick={() => openNewTransaction('SUPPLIER_REFUND')}
                className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[11px] font-bold rounded-lg border border-emerald-200 transition-all"
              >
                {t.cash.supplierRefundBtn}
              </button>
            </div>
          </div>

          {/* Group 2: Expenses & Drivers */}
          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 space-y-2">
            <span className="text-[11px] font-bold text-slate-500 block">{t.cash.expensesAndDrivers}</span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => openNewTransaction('CASH_EXPENSE')}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold rounded-lg shadow-sm transition-all col-span-2"
              >
                {t.cash.cashExpenseBtn}
              </button>
              <button
                onClick={() => openNewTransaction('DRIVER_CASH_GIFT')}
                className="px-2.5 py-1.5 bg-amber-50 text-amber-800 hover:bg-amber-100 text-[11px] font-bold rounded-lg border border-amber-200 transition-all"
              >
                {t.cash.driverCashGiftBtn}
              </button>
              <button
                onClick={() => openNewTransaction('DRIVER_AMOUNT')}
                className="px-2.5 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 text-[11px] font-bold rounded-lg transition-all"
              >
                {t.cash.driverAmountBtn}
              </button>
            </div>
          </div>

          {/* Group 3: Partners, Assets, Financing */}
          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 space-y-2">
            <span className="text-[11px] font-bold text-slate-500 block">{t.cash.partnersFinancingAssets}</span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => openNewTransaction('INTERNAL_TRANSFER')}
                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg shadow-sm transition-all col-span-2 flex items-center justify-center gap-1"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                {t.cash.internalTransferBtn}
              </button>
              <button
                onClick={() => openNewTransaction('PARTNER_CONTRIBUTION')}
                className="px-2.5 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 text-[11px] font-bold rounded-lg transition-all"
              >
                {t.cash.partnerTxBtn}
              </button>
              <button
                onClick={() => openNewTransaction('ASSET_PURCHASE')}
                className="px-2.5 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 text-[11px] font-bold rounded-lg transition-all"
              >
                {t.cash.assetPurchaseBtn}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search className={`w-4 h-4 text-slate-400 absolute ${isRtl ? 'right-3' : 'left-3'} top-3`} />
          <input
            type="text"
            placeholder={t.cash.searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full ${isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500`}
          />
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">{t.common.loading}</div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">{t.common.noData}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className={`w-full ${isRtl ? 'text-right' : 'text-left'} text-xs`}>
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">{t.cash.txNo}</th>
                  <th className="p-3">{t.cash.txDate}</th>
                  <th className="p-3">{t.cash.txType}</th>
                  <th className="p-3">{t.cash.account}</th>
                  <th className="p-3">{t.cash.partyOrDesc}</th>
                  <th className="p-3">{t.cash.linkedInvoice}</th>
                  <th className={`p-3 ${isRtl ? 'text-left' : 'text-right'}`}>{t.cash.amount}</th>
                  <th className={`p-3 ${isRtl ? 'text-left' : 'text-right'} font-mono`}>{t.cash.runningCash}</th>
                  <th className={`p-3 ${isRtl ? 'text-left' : 'text-right'} font-mono`}>{t.cash.runningBank}</th>
                  <th className={`p-3 ${isRtl ? 'text-left' : 'text-right'} font-mono font-bold`}>{t.cash.runningBalance}</th>
                  <th className="p-3 text-center">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.map((tx) => {
                  const incoming = isIncomingType(tx.type);
                  const isTransfer = tx.type === 'INTERNAL_TRANSFER';

                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        tx.status === 'VOID' ? 'opacity-40 bg-slate-50' : ''
                      }`}
                    >
                      <td className="p-3 font-mono font-bold text-amber-700">{tx.code}</td>
                      <td className="p-3 text-slate-500">
                        {new Date(tx.txDate).toLocaleDateString(dateLocale)}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isTransfer
                              ? 'bg-blue-100 text-blue-800'
                              : incoming
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {tCashType(tx.type)}
                        </span>
                      </td>
                      <td className="p-3">
                        {isTransfer ? (
                          <span className="text-[11px] font-mono">
                            {tx.account === 'CASH' ? t.cash.cashTreasury : t.cash.bankAccount} ➔{' '}
                            {tx.transferToAccount === 'CASH' ? t.cash.cashTreasury : t.cash.bankAccount}
                          </span>
                        ) : (
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              tx.account === 'CASH'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-blue-50 text-blue-800 border border-blue-200'
                            }`}
                          >
                            {tx.account === 'CASH' ? t.cash.cashTreasury : t.cash.bankAccount}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {tx.party ? (
                          <span className="font-medium text-slate-800">
                            {tLocalizedName(tx.party, locale)}{' '}
                            <span className="text-[10px] text-slate-400">({tx.party.code})</span>
                          </span>
                        ) : tx.asset ? (
                          <span className="font-medium text-slate-800">
                            {t.cash.assetLabel} {tx.asset.name}
                          </span>
                        ) : (
                          <span className="text-slate-500">{tx.description || '—'}</span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-[11px]" dir="ltr">
                        {tx.invoiceKey ? tInvoiceKey(tx.invoiceKey) : '—'}
                      </td>
                      <td
                        className={`p-3 ${isRtl ? 'text-left' : 'text-right'} font-mono font-bold ${
                          isTransfer
                            ? 'text-blue-700'
                            : incoming
                            ? 'text-emerald-600'
                            : 'text-rose-600'
                        }`}
                        dir="ltr"
                      >
                        {incoming ? '+' : isTransfer ? '↔' : '-'}
                        {Number(tx.amount).toLocaleString()}
                      </td>
                      <td className={`p-3 ${isRtl ? 'text-left' : 'text-right'} font-mono text-slate-600`} dir="ltr">
                        {tx.runningCash?.toLocaleString()}
                      </td>
                      <td className={`p-3 ${isRtl ? 'text-left' : 'text-right'} font-mono text-slate-600`} dir="ltr">
                        {tx.runningBank?.toLocaleString()}
                      </td>
                      <td className={`p-3 ${isRtl ? 'text-left' : 'text-right'} font-mono font-bold text-slate-900`} dir="ltr">
                        {tx.runningTotal?.toLocaleString()}
                      </td>
                      <td className="p-3 text-center">
                        {tx.status !== 'VOID' && (
                          <button
                            onClick={() => {
                              setTxToVoid(tx);
                              setVoidReason('');
                              setVoidError('');
                              setVoidModalOpen(true);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                            title={t.cash.voidConfirmTitle}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Transaction Modal (Dynamic based on selected txType) */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-amber-400" />
                <h2 className="text-sm font-bold">
                  {t.cash.newTransaction}: {tCashType(txType)}
                </h2>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitTransaction} className="p-5 space-y-4 overflow-y-auto">
              {txError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{txError}</span>
                </div>
              )}

              {/* Type Switcher Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.cash.txType}</label>
                <select
                  value={txType}
                  onChange={(e) => openNewTransaction(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 bg-white"
                >
                  <optgroup label={tPartyType('CLIENT')}>
                    <option value="CUSTOMER_COLLECTION">{tCashType('CUSTOMER_COLLECTION')}</option>
                    <option value="CUSTOMER_REFUND">{tCashType('CUSTOMER_REFUND')}</option>
                  </optgroup>
                  <optgroup label={tPartyType('SUPPLIER')}>
                    <option value="SUPPLIER_PAYMENT">{tCashType('SUPPLIER_PAYMENT')}</option>
                    <option value="SUPPLIER_REFUND">{tCashType('SUPPLIER_REFUND')}</option>
                  </optgroup>
                  <optgroup label={t.cash.expensesAndDrivers}>
                    <option value="CASH_EXPENSE">{tCashType('CASH_EXPENSE')}</option>
                    <option value="DRIVER_CASH_GIFT">{tCashType('DRIVER_CASH_GIFT')}</option>
                    <option value="DRIVER_AMOUNT">{tCashType('DRIVER_AMOUNT')}</option>
                  </optgroup>
                  <optgroup label={t.cash.partnersFinancingAssets}>
                    <option value="INTERNAL_TRANSFER">{tCashType('INTERNAL_TRANSFER')}</option>
                    <option value="PARTNER_CONTRIBUTION">{tCashType('PARTNER_CONTRIBUTION')}</option>
                    <option value="PARTNER_DRAWING">{tCashType('PARTNER_DRAWING')}</option>
                    <option value="PROFIT_DISTRIBUTION">{tCashType('PROFIT_DISTRIBUTION')}</option>
                    <option value="OWNER_BROTHER_FINANCING">{tCashType('OWNER_BROTHER_FINANCING')}</option>
                    <option value="OWNER_BROTHER_REPAYMENT">{tCashType('OWNER_BROTHER_REPAYMENT')}</option>
                    <option value="LOAN_RECEIVED">{tCashType('LOAN_RECEIVED')}</option>
                    <option value="LOAN_REPAYMENT">{tCashType('LOAN_REPAYMENT')}</option>
                    <option value="ASSET_PURCHASE">{tCashType('ASSET_PURCHASE')}</option>
                    <option value="EXTERNAL_SALES_PROFIT">{tCashType('EXTERNAL_SALES_PROFIT')}</option>
                  </optgroup>
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.cash.txDate}*</label>
                <input
                  type="date"
                  required
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Dynamic Party Selector */}
              {['CUSTOMER_COLLECTION', 'CUSTOMER_REFUND'].includes(txType) && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t.sales.customer}*</label>
                  <SearchableCombobox
                    options={clients.map((c) => ({
                      value: c.id,
                      label: `${c.code} | ${tLocalizedName(c, locale)}`,
                    }))}
                    value={txPartyId}
                    onChange={handlePartyChange}
                    placeholder={t.sales.selectCustomer}
                  />
                </div>
              )}

              {['SUPPLIER_PAYMENT', 'SUPPLIER_REFUND'].includes(txType) && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t.purchases.supplier}*</label>
                  <SearchableCombobox
                    options={suppliers.map((s) => ({
                      value: s.id,
                      label: `${s.code} | ${tLocalizedName(s, locale)}`,
                    }))}
                    value={txPartyId}
                    onChange={handlePartyChange}
                    placeholder={t.purchases.selectSupplier}
                  />
                </div>
              )}

              {['DRIVER_AMOUNT', 'DRIVER_CASH_GIFT'].includes(txType) && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{tPartyType('DRIVER')}*</label>
                  <SearchableCombobox
                    options={drivers.map((d) => ({
                      value: d.id,
                      label: `${d.code} | ${tLocalizedName(d, locale)}`,
                      hint: d.carNumber ? `${d.carNumber}` : undefined,
                    }))}
                    value={txPartyId}
                    onChange={setTxPartyId}
                    placeholder={t.cash.selectParty}
                  />
                </div>
              )}

              {['PARTNER_CONTRIBUTION', 'PARTNER_DRAWING', 'PROFIT_DISTRIBUTION'].includes(txType) && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t.partners.partnerName}*</label>
                  <SearchableCombobox
                    options={partners.map((p) => ({
                      value: p.id,
                      label: `${p.code} | ${p.name}`,
                    }))}
                    value={txPartyId}
                    onChange={setTxPartyId}
                    placeholder={t.cash.selectParty}
                  />
                </div>
              )}

              {['OWNER_BROTHER_FINANCING', 'OWNER_BROTHER_REPAYMENT'].includes(txType) && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t.cash.party}*</label>
                  <SearchableCombobox
                    options={funders.map((f) => ({
                      value: f.id,
                      label: `${f.code} | ${f.name}`,
                    }))}
                    value={txPartyId}
                    onChange={setTxPartyId}
                    placeholder={t.cash.selectParty}
                  />
                </div>
              )}

              {/* Dynamic Invoice Selector for Client/Supplier */}
              {['CUSTOMER_COLLECTION', 'CUSTOMER_REFUND', 'SUPPLIER_PAYMENT', 'SUPPLIER_REFUND'].includes(
                txType
              ) && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.cash.linkedInvoice}*
                  </label>
                  <select
                    value={txInvoiceKey}
                    onChange={(e) => {
                      setTxInvoiceKey(e.target.value);
                      const inv = partyInvoices.find((i) => i.invoiceKey === e.target.value);
                      if (inv && inv.remainingAmount > 0) {
                        setTxAmount(Math.abs(inv.remainingAmount));
                      }
                    }}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 bg-white"
                  >
                    <option value="">{t.cash.selectInvoice}</option>
                    {partyInvoices.map((inv) => (
                      <option key={inv.invoiceKey} value={inv.invoiceKey}>
                        {tInvoiceKey(inv.invoiceKey)} — {t.cash.remaining}: {Math.abs(inv.remainingAmount).toLocaleString()} IDR ({inv.statusLabel})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Dynamic Asset Selector */}
              {txType === 'ASSET_PURCHASE' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t.partners.assetName}*</label>
                  <SearchableCombobox
                    options={assets.map((a) => ({
                      value: a.id,
                      label: `${a.code} | ${a.name}`,
                    }))}
                    value={txAssetId}
                    onChange={setTxAssetId}
                    placeholder={t.cash.selectAsset}
                  />
                </div>
              )}

              {/* Account Selection */}
              {txType === 'INTERNAL_TRANSFER' ? (
                <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t.cash.transferFrom}</label>
                    <select
                      value={txAccount}
                      onChange={(e) => {
                        const from = e.target.value as 'CASH' | 'BANK';
                        setTxAccount(from);
                        setTransferToAccount(from === 'CASH' ? 'BANK' : 'CASH');
                      }}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white"
                    >
                      <option value="CASH">{t.cash.cashTreasury}</option>
                      <option value="BANK">{t.cash.bankAccount}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t.cash.transferTo}</label>
                    <select
                      value={transferToAccount}
                      disabled
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-100"
                    >
                      <option value="CASH">{t.cash.cashTreasury}</option>
                      <option value="BANK">{t.cash.bankAccount}</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t.cash.cashAccountLabel}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTxAccount('CASH')}
                      className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                        txAccount === 'CASH'
                          ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {t.cash.cashTreasury}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTxAccount('BANK')}
                      className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                        txAccount === 'BANK'
                          ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {t.cash.bankAccount}
                    </button>
                  </div>
                </div>
              )}

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.cash.amount} (IDR)*
                </label>
                <MoneyInput
                  value={txAmount}
                  onChange={(v) => setTxAmount(Number(v) || 0)}
                  placeholder="0"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.cash.description}</label>
                <input
                  type="text"
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  placeholder={
                    locale === 'ar'
                      ? 'تفاصيل إضافية عن الحركة...'
                      : 'Additional transaction memo...'
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                >
                  {submitting ? t.common.loading : t.cash.saveTransaction}
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  {t.common.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Void Confirmation Modal */}
      {voidModalOpen && txToVoid && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setVoidModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-200" />
                <h2 className="text-sm font-bold">{t.cash.voidConfirmTitle}</h2>
              </div>
              <button
                onClick={() => setVoidModalOpen(false)}
                className="text-rose-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitVoid} className="p-5 space-y-4">
              {voidError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{voidError}</span>
                </div>
              )}

              <p className="text-xs text-slate-600 leading-relaxed">
                {locale === 'ar' ? (
                  <>
                    هل أنت متأكد من إلغاء الحركة النقدية{' '}
                    <strong className="text-slate-900 font-mono">{txToVoid.code}</strong> بمبلغ (
                    <strong className="font-mono text-slate-900">
                      {Number(txToVoid.amount).toLocaleString()} IDR
                    </strong>
                    )؟ سيتم تحويل حالتها إلى ملغاة (<code className="text-rose-600 font-mono">VOID</code>) وإعادة احتساب الرصيد التراكمي.
                  </>
                ) : false ? (
                  <>
                    Apakah Anda yakin ingin membatalkan transaksi kas{' '}
                    <strong className="text-slate-900 font-mono">{txToVoid.code}</strong> sebesar (
                    <strong className="font-mono text-slate-900">
                      {Number(txToVoid.amount).toLocaleString()} IDR
                    </strong>
                    )? Status akan diubah menjadi <code className="text-rose-600 font-mono">VOID</code> dan saldo kumulatif akan dihitung ulang.
                  </>
                ) : (
                  <>
                    Are you sure you want to void cash transaction{' '}
                    <strong className="text-slate-900 font-mono">{txToVoid.code}</strong> for (
                    <strong className="font-mono text-slate-900">
                      {Number(txToVoid.amount).toLocaleString()} IDR
                    </strong>
                    )? Its status will become <code className="text-rose-600 font-mono">VOID</code> and the running balance will be recalculated.
                  </>
                )}
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.cash.voidReasonLabel}
                </label>
                <textarea
                  required
                  rows={2}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder={t.cash.voidReasonPlaceholder}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={voiding}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                >
                  {voiding ? t.cash.voiding : t.cash.confirmVoidBtn}
                </button>
                <button
                  type="button"
                  onClick={() => setVoidModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  {t.cash.cancelBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
