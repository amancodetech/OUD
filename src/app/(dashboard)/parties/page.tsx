'use client';
import { QueryStatus } from '@/components/data/QueryStatus';
import { useApiQuery } from '@/lib/use-api-query';
import { queryKeys } from '@/lib/query-keys';
import { apiFetch } from '@/lib/client-api';

import React, { useState } from 'react';
import Link from 'next/link';
import { PartyType } from '@prisma/client';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { formatMoney } from '@/domain/decimal';
import { Contact, Plus, Search, X, Check, Pencil, Trash2, FileText, AlertTriangle } from 'lucide-react';
import { useI18n } from '@/i18n/LanguageContext';
import { tLocalizedName } from '@/i18n/translate-domain';

interface PartyRow {
  version: number;
  id: string;
  code: string;
  name: string;
  nameId?: string | null;
  nameEn?: string | null;
  type: PartyType;
  phone?: string | null;
  country?: string | null;
  address?: string | null;
  supplierCategory?: string | null;
  supplierCategoryEn?: string | null;
  carNumber?: string | null;
  openingBalance: any;
  profitShareRatio: any;
  openingCapital: any;
  carryoverReferrals: number;
  isDriverGiftEnabled: boolean;
  debtAsOf: any;
  creditAsOf: any;
  signedAsOf: any;
  coverageAsOf: string;
}

export default function PartiesPage() {
  const { t, locale, isRtl, tPartyType } = useI18n();

  const partyQuery = useApiQuery<{ ok: boolean; data: PartyRow[] }>(queryKeys.parties);
  const parties = partyQuery.data?.data || [];
  const fetchParties = () => partyQuery.mutate();
  const loading = partyQuery.isLoading;
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formNameEn, setFormNameEn] = useState('');
  const [formType, setFormType] = useState<PartyType>('CLIENT');
  const [formPhone, setFormPhone] = useState('');
  const [formCountry, setFormCountry] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formSupplierCategory, setFormSupplierCategory] = useState('');
  const [formSupplierCategoryEn, setFormSupplierCategoryEn] = useState('');
  const [formCarNumber, setFormCarNumber] = useState('');
  const [formOpeningBalance, setFormOpeningBalance] = useState('0');
  const [formProfitShareRatio, setFormProfitShareRatio] = useState('0');
  const [formOpeningCapital, setFormOpeningCapital] = useState('0');
  const [formCarryover, setFormCarryover] = useState(0);
  const [formDriverGiftEnabled, setFormDriverGiftEnabled] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<PartyRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editNameEn, setEditNameEn] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editSupplierCategory, setEditSupplierCategory] = useState('');
  const [editSupplierCategoryEn, setEditSupplierCategoryEn] = useState('');
  const [editCarNumber, setEditCarNumber] = useState('');
  const [editProfitShareRatio, setEditProfitShareRatio] = useState('0');
  const [editOpeningCapital, setEditOpeningCapital] = useState('0');
  const [editDriverGiftEnabled, setEditDriverGiftEnabled] = useState(true);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingParty, setDeletingParty] = useState<PartyRow | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleOpenEdit = (p: PartyRow) => {
    setEditingParty(p);
    setEditName(p.name);
    setEditNameEn(p.nameEn || '');
    setEditPhone(p.phone || '');
    setEditCountry(p.country || '');
    setEditAddress(p.address || '');
    setEditSupplierCategory(p.supplierCategory || '');
    setEditSupplierCategoryEn(p.supplierCategoryEn || '');
    setEditCarNumber(p.carNumber || '');
    setEditProfitShareRatio(
      p.profitShareRatio ? String(parseFloat(String(p.profitShareRatio)) * 100) : '0'
    );
    setEditOpeningCapital(p.openingCapital ? String(p.openingCapital) : '0');
    setEditDriverGiftEnabled(p.isDriverGiftEnabled ?? true);
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingParty) return;
    setEditError(null);
    setEditSubmitting(true);

    try {
      const res = await apiFetch(`/api/parties/${editingParty.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json'   , 'If-Match': JSON.stringify(String(editingParty.version)) },
        body: JSON.stringify({
          name: editName,
          nameEn: editNameEn.trim() || null,
          phone: editPhone || null,
          country: editCountry || null,
          address: editAddress || null,
          supplierCategory:
            editingParty.type === 'SUPPLIER' || editingParty.type === 'CLIENT'
              ? editSupplierCategory || null
              : null,
          supplierCategoryEn:
            editingParty.type === 'SUPPLIER' || editingParty.type === 'CLIENT'
              ? editSupplierCategoryEn.trim() || null
              : null,
          carNumber: editingParty.type === 'DRIVER' ? editCarNumber || null : null,
          isDriverGiftEnabled: editingParty.type === 'DRIVER' ? editDriverGiftEnabled : undefined,
          profitShareRatio:
            editingParty.type === 'PARTNER' ? parseFloat(editProfitShareRatio) / 100 : undefined,
          openingCapital: editingParty.type === 'PARTNER' ? editOpeningCapital : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t.common.errorOccurred);
      }

      setIsEditModalOpen(false);
      fetchParties();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : t.common.errorOccurred);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleOpenDelete = (p: PartyRow) => {
    setDeletingParty(p);
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingParty) return;
    setDeleteError(null);
    setDeleteSubmitting(true);

    try {
      const res = await apiFetch(`/api/parties/${deletingParty.id}`, {
        method: 'DELETE',
        headers: { 'If-Match': JSON.stringify(String(deletingParty.version)) },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t.common.errorOccurred);
      }

      setIsDeleteModalOpen(false);
      fetchParties();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : t.common.errorOccurred);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSubmitting(true);

    try {
      const res = await apiFetch('/api/parties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'  },
        body: JSON.stringify({
          name: formName,
          nameEn: formNameEn.trim() || null,
          type: formType,
          phone: formPhone || null,
          country: formCountry || null,
          address: formAddress || null,
          supplierCategory:
            formType === 'SUPPLIER' || formType === 'CLIENT' ? formSupplierCategory || null : null,
          supplierCategoryEn:
            formType === 'SUPPLIER' || formType === 'CLIENT' ? formSupplierCategoryEn.trim() || null : null,
          carNumber: formType === 'DRIVER' ? formCarNumber : null,
          openingBalance: formOpeningBalance,
          profitShareRatio: formType === 'PARTNER' ? parseFloat(formProfitShareRatio) / 100 : 0,
          openingCapital: formOpeningCapital,
          carryoverReferrals: formCarryover,
          isDriverGiftEnabled: formDriverGiftEnabled,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t.common.errorOccurred);
      }

      setIsModalOpen(false);
      resetForm();
      fetchParties();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : t.common.errorOccurred);
    } finally {
      setFormSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormNameEn('');
    setFormPhone('');
    setFormCountry('');
    setFormAddress('');
    setFormSupplierCategory('');
    setFormSupplierCategoryEn('');
    setFormCarNumber('');
    setFormOpeningBalance('0');
    setFormProfitShareRatio('0');
    setFormOpeningCapital('0');
    setFormCarryover(0);
    setFormDriverGiftEnabled(true);
    setFormError(null);
  };

  const filtered = parties.filter((p) => {
    const matchesType = selectedType === 'ALL' || p.type === selectedType;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(term) ||
      (p.nameEn && p.nameEn.toLowerCase().includes(term)) ||
      p.code.toLowerCase().includes(term) ||
      (p.phone && p.phone.includes(term)) ||
      (p.supplierCategory && p.supplierCategory.toLowerCase().includes(term)) ||
      (p.supplierCategoryEn && p.supplierCategoryEn.toLowerCase().includes(term));
    return matchesType && matchesSearch;
  });

  const getPartyTypeLabel = (type: PartyType): string => {
    return tPartyType(type);
  };

  const getCoverageLabel = (cov: string): string => {
    if (cov === 'متوازن') return locale === 'ar' ? 'متوازن' : locale === 'id' ? 'Seimbang' : 'Balanced';
    if (cov === 'مستحق') return locale === 'ar' ? 'مستحق' : locale === 'id' ? 'Jatuh Tempo' : 'Due';
    if (cov === 'رصيد دائن') return locale === 'ar' ? 'رصيد دائن' : locale === 'id' ? 'Saldo Kredit' : 'Credit';
    return cov;
  };

  if (partyQuery.error && !partyQuery.data) return <QueryStatus query={partyQuery} />;

  return (
    <div className="space-y-6">
      <QueryStatus query={partyQuery} />
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Contact className="h-5 w-5 text-amber-600" />
            {t.parties.title}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {t.parties.subtitle}
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 shadow"
        >
          <Plus className="h-4 w-4" />
          <span>{t.parties.addParty}</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'ALL', label: t.common.all },
            { id: 'CLIENT', label: tPartyType('CLIENT') },
            { id: 'SUPPLIER', label: tPartyType('SUPPLIER') },
            { id: 'DRIVER', label: tPartyType('DRIVER') },
            { id: 'PARTNER', label: tPartyType('PARTNER') },
            { id: 'FUNDER', label: locale === 'ar' ? 'الممولون' : locale === 'id' ? 'Penyandang Dana' : 'Funders' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedType(tab.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                selectedType === tab.id
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className={`absolute top-2.5 h-4 w-4 text-slate-400 ${isRtl ? 'right-2.5' : 'left-2.5'}`} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t.common.search}
            className={`w-full rounded-md border border-slate-300 py-1.5 text-xs focus:border-amber-500 focus:outline-none ${
              isRtl ? 'pr-8 pl-3' : 'pl-8 pr-3'
            }`}
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className={`w-full text-xs ${isRtl ? 'text-right' : 'text-left'}`}>
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
              <tr>
                <th className="py-3 px-4">{t.parties.code}</th>
                <th className="py-3 px-4">{t.parties.name}</th>
                <th className="py-3 px-4">{t.parties.companyOrStore || (locale === 'id' ? 'Nama Perusahaan / Toko' : isRtl ? 'اسم المؤسسة / المتجر' : 'Company / Store')}</th>
                <th className="py-3 px-4">{t.parties.type}</th>
                <th className="py-3 px-4">{t.parties.phone}</th>
                <th className={`py-3 px-4 ${isRtl ? 'text-left' : 'text-right'}`}>{t.parties.openingBalance}</th>
                <th className={`py-3 px-4 ${isRtl ? 'text-left' : 'text-right'}`}>
                  {t.parties.currentDue || (locale === 'id' ? 'Tagihan Saat Ini' : isRtl ? 'المستحق الحالي' : 'Current Due')}
                </th>
                <th className={`py-3 px-4 ${isRtl ? 'text-left' : 'text-right'}`}>
                  {t.parties.creditBalance || (locale === 'id' ? 'Saldo Kredit' : isRtl ? 'الرصيد الدائن' : 'Credit Balance')}
                </th>
                <th className={`py-3 px-4 ${isRtl ? 'text-left' : 'text-right'}`}>{t.debts.netBalance}</th>
                <th className="py-3 px-4 text-center">
                  {t.parties.coverageStatus || (locale === 'id' ? 'Status Saldo' : isRtl ? 'حالة التغطية' : 'Balance Status')}
                </th>
                <th className="py-3 px-4 text-center">
                  {t.common.actions}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-500">
                    {t.common.loading}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-500">
                    {t.common.noData}
                  </td>
                </tr>
              ) : (
                filtered.map((party) => {
                  const hasDebt = parseFloat(String(party.debtAsOf || 0)) > 0.01;
                  const hasCredit = parseFloat(String(party.creditAsOf || 0)) > 0.01;
                  return (
                    <tr key={party.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono font-bold text-amber-800">
                        {party.code}
                      </td>
                      <td className="py-3 px-4 text-slate-900">
                        <div className="font-semibold text-slate-900">
                          {tLocalizedName(party, locale)}
                        </div>
                        {locale !== 'ar' && party.name && party.name !== tLocalizedName(party, locale) && (
                          <div className="text-[10px] text-slate-400 font-normal" dir="rtl">
                            {party.name}
                          </div>
                        )}
                        {locale === 'ar' && party.nameEn && (
                          <div className="text-[10px] text-slate-400 font-normal font-sans" dir="ltr">
                            {party.nameEn}
                          </div>
                        )}
                        {party.carNumber && (
                          <span className={`${isRtl ? 'mr-2' : 'ml-2'} text-[10px] text-amber-700 font-mono`}>
                            [{locale === 'ar' ? 'سيارة' : locale === 'id' ? 'Kendaraan' : 'Vehicle'}: {party.carNumber}]
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {party.supplierCategory || party.supplierCategoryEn ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold w-fit">
                              {locale === 'ar'
                                ? (party.supplierCategory || party.supplierCategoryEn)
                                : (party.supplierCategoryEn || party.supplierCategory)}
                            </span>
                            {locale === 'ar' && party.supplierCategoryEn && party.supplierCategory && (
                              <span className="text-[10px] text-slate-400 font-normal font-sans" dir="ltr">
                                {party.supplierCategoryEn}
                              </span>
                            )}
                            {locale !== 'ar' && party.supplierCategory && party.supplierCategory !== (party.supplierCategoryEn || party.supplierCategory) && (
                              <span className="text-[10px] text-slate-400 font-normal" dir="rtl">
                                {party.supplierCategory}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-normal">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                          {getPartyTypeLabel(party.type)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {party.phone && <div dir="ltr" className={isRtl ? 'text-right font-mono' : 'text-left font-mono'}>{party.phone}</div>}
                        {party.address && <div>{party.address}</div>}
                        {!party.phone && !party.address && '—'}
                      </td>
                      <td className={`py-3 px-4 font-mono ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                        {formatMoney(party.openingBalance)}
                      </td>
                      <td
                        className={`py-3 px-4 font-mono font-bold ${isRtl ? 'text-left' : 'text-right'} ${
                          hasDebt ? 'text-rose-700' : 'text-slate-500'
                        }`}
                        dir="ltr"
                      >
                        {formatMoney(party.debtAsOf)}
                      </td>
                      <td
                        className={`py-3 px-4 font-mono font-bold ${isRtl ? 'text-left' : 'text-right'} ${
                          hasCredit ? 'text-emerald-700' : 'text-slate-500'
                        }`}
                        dir="ltr"
                      >
                        {formatMoney(party.creditAsOf)}
                      </td>
                      <td className={`py-3 px-4 font-mono font-bold ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                        {formatMoney(party.signedAsOf)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            party.coverageAsOf === 'متوازن'
                              ? 'bg-slate-100 text-slate-600'
                              : party.coverageAsOf === 'مستحق'
                              ? 'bg-rose-100 text-rose-800'
                              : party.coverageAsOf === 'رصيد دائن'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {getCoverageLabel(party.coverageAsOf)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(party)}
                            title={locale === 'ar' ? 'تعديل البيانات' : locale === 'id' ? 'Ubah Data' : 'Edit'}
                            className="p-1 rounded text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <Link
                            href={`/parties/${party.id}/statement`}
                            title={locale === 'ar' ? 'كشف الحساب' : locale === 'id' ? 'Rekening Koran' : 'Statement'}
                            className="p-1 rounded text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                          >
                            <FileText className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(party)}
                            title={t.common.delete}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Party Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">{t.parties.addParty}</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 rounded-md bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700">{t.parties.type} *</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as PartyType)}
                    className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none"
                  >
                    <option value="CLIENT">{tPartyType('CLIENT')} (C)</option>
                    <option value="SUPPLIER">{tPartyType('SUPPLIER')} (SUP)</option>
                    <option value="DRIVER">{tPartyType('DRIVER')} (D)</option>
                    <option value="PARTNER">{tPartyType('PARTNER')} (PR)</option>
                    <option value="FUNDER">{tPartyType('FUNDER')} (F)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">{t.parties.name} {locale === 'ar' ? '(بالعربية)' : '(Arab)'} *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={t.parties.name}
                    className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">الاسم بالإنجليزية (English Name)</label>
                  <input
                    type="text"
                    value={formNameEn}
                    onChange={(e) => setFormNameEn(e.target.value)}
                    placeholder="e.g. Al-Midyhaf Oud Co."
                    className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none font-sans"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">{t.parties.phone}</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="0812..."
                    className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none text-left"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">{t.parties.cityOrCountry}</label>
                  <input
                    type="text"
                    value={formCountry}
                    onChange={(e) => setFormCountry(e.target.value)}
                    placeholder={locale === 'ar' ? 'إندونيسيا، السعودية...' : locale === 'id' ? 'Indonesia, Arab Saudi...' : 'Indonesia, Saudi Arabia...'}
                    className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">{t.common.notes}</label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder={locale === 'ar' ? 'المدينة، الحي...' : locale === 'id' ? 'Kota, Wilayah, Alamat...' : 'City, Area, Address...'}
                  className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Conditional: SUPPLIER or CLIENT */}
              {(formType === 'SUPPLIER' || formType === 'CLIENT') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      {t.parties.companyOrStore || (locale === 'id' ? 'Nama Perusahaan / Toko' : isRtl ? 'اسم المؤسسة / المتجر' : 'Company / Store Name')}{' '}
                      <span className="text-slate-400 font-normal">({locale === 'ar' ? 'بالعربية' : locale === 'id' ? 'Arab' : 'Arabic'})</span>
                    </label>
                    <input
                      type="text"
                      value={formSupplierCategory}
                      onChange={(e) => setFormSupplierCategory(e.target.value)}
                      placeholder={locale === 'ar' ? 'بخور حكاية، مصنع الصقر...' : locale === 'id' ? 'Contoh: بخور حكاية، مصنع الصقر...' : 'Company / Store (Arabic)...'}
                      className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      {locale === 'ar' ? 'اسم المؤسسة / المتجر (بالإنجليزية)' : locale === 'id' ? 'Nama Perusahaan / Toko (Inggris)' : 'Company / Store Name (English)'}
                    </label>
                    <input
                      type="text"
                      value={formSupplierCategoryEn}
                      onChange={(e) => setFormSupplierCategoryEn(e.target.value)}
                      placeholder="e.g. Hikaya Bakhoor, Falcon Factory"
                      className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none font-sans"
                      dir="ltr"
                    />
                  </div>
                </div>
              )}

              {/* Conditional: DRIVER */}
              {formType === 'DRIVER' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      {locale === 'ar' ? 'رقم السيارة' : locale === 'id' ? 'Nomor Plat Kendaraan' : 'Vehicle Plate No.'}
                    </label>
                    <input
                      type="text"
                      value={formCarNumber}
                      onChange={(e) => setFormCarNumber(e.target.value)}
                      placeholder="B 1234 XYZ"
                      className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      {locale === 'ar' ? 'عملاء مرحلون دون هدية' : locale === 'id' ? 'Wisatawan Bawaan Tanpa Hadiah' : 'Carryover Tourists'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formCarryover}
                      onChange={(e) => setFormCarryover(parseInt(e.target.value, 10) || 0)}
                      className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Conditional: PARTNER */}
              {formType === 'PARTNER' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      {t.partners.capitalSharePercent}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      max={100}
                      value={formProfitShareRatio}
                      onChange={(e) => setFormProfitShareRatio(e.target.value)}
                      placeholder="60"
                      className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      {locale === 'ar' ? 'مثال: 60 تعني 60%' : locale === 'id' ? 'Contoh: 60 berarti 60%' : 'e.g. 60 means 60%'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      {t.partners.capitalContributed}
                    </label>
                    <div className="mt-1">
                      <MoneyInput
                        value={formOpeningCapital}
                        onChange={setFormOpeningCapital}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Conditional: CLIENT, SUPPLIER, FUNDER Opening Balance */}
              {(formType === 'CLIENT' || formType === 'SUPPLIER' || formType === 'FUNDER') && (
                <div className="border-t pt-3">
                  <label className="block text-xs font-bold text-slate-700">{t.parties.openingBalance}</label>
                  <div className="mt-1">
                    <MoneyInput
                      value={formOpeningBalance}
                      onChange={setFormOpeningBalance}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {formType === 'CLIENT'
                      ? locale === 'ar'
                        ? 'موجب = العميل مدين للمحل (لنا عنده) | سالب = العميل دائن (له رصيد مقدم)'
                        : locale === 'id'
                        ? 'Positif = Pelanggan berhutang ke toko | Negatif = Saldo deposit pelanggan'
                        : 'Positive = Customer owes us | Negative = Customer deposit balance'
                      : formType === 'SUPPLIER'
                      ? locale === 'ar'
                        ? 'موجب = المحل مدين للمورد (علينا له) | سالب = للمحل رصيد عند المورد'
                        : locale === 'id'
                        ? 'Positif = Toko berhutang ke supplier | Negatif = Saldo toko di supplier'
                        : 'Positive = We owe supplier | Negative = Advance balance with supplier'
                      : locale === 'ar'
                      ? 'موجب = تمويل افتتاحي مستحق للممول'
                      : locale === 'id'
                      ? 'Positif = Modal pendanaan awal terhutang ke penyandang dana'
                      : 'Positive = Opening capital due to funder'}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={formSubmitting}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex items-center gap-1.5 rounded-md bg-amber-600 px-5 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:bg-amber-400"
                >
                  <Check className="h-4 w-4" />
                  <span>{formSubmitting ? t.common.saving : t.common.save}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Party Modal */}
      {isEditModalOpen && editingParty && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setIsEditModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Pencil className="h-4 w-4 text-amber-600" />
                <span>{locale === 'ar' ? `تعديل بيانات: ${editingParty.name}` : locale === 'id' ? `Ubah Data: ${editingParty.name}` : `Edit: ${editingParty.name}`}</span>
                <span className="text-xs font-mono text-amber-800 bg-amber-50 px-2 py-0.5 rounded">
                  {editingParty.code}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editError && (
              <div className="mt-3 rounded-md bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                {editError}
              </div>
            )}

            <form onSubmit={handleUpdate} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700">{t.parties.name} {locale === 'ar' ? '(بالعربية)' : '(Arab)'} *</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    الاسم بالإنجليزية (English Name)
                  </label>
                  <input
                    type="text"
                    value={editNameEn}
                    onChange={(e) => setEditNameEn(e.target.value)}
                    placeholder="e.g. Al-Midyhaf Oud Co."
                    className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none font-sans"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700">{t.parties.phone}</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none text-left"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">{t.parties.cityOrCountry}</label>
                  <input
                    type="text"
                    value={editCountry}
                    onChange={(e) => setEditCountry(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  {t.common.notes} / {locale === 'ar' ? 'العنوان' : locale === 'id' ? 'Alamat' : 'Address'}
                </label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              {(editingParty.type === 'SUPPLIER' || editingParty.type === 'CLIENT') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      {t.parties.companyOrStore || (locale === 'id' ? 'Nama Perusahaan / Toko' : isRtl ? 'اسم المؤسسة / المتجر' : 'Company / Store Name')}{' '}
                      <span className="text-slate-400 font-normal">({locale === 'ar' ? 'بالعربية' : locale === 'id' ? 'Arab' : 'Arabic'})</span>
                    </label>
                    <input
                      type="text"
                      value={editSupplierCategory}
                      onChange={(e) => setEditSupplierCategory(e.target.value)}
                      placeholder={locale === 'ar' ? 'بخور حكاية، مصنع الصقر...' : locale === 'id' ? 'Contoh: بخور حكاية، مصنع الصقر...' : 'Company / Store (Arabic)...'}
                      className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      {locale === 'ar' ? 'اسم المؤسسة / المتجر (بالإنجليزية)' : locale === 'id' ? 'Nama Perusahaan / Toko (Inggris)' : 'Company / Store Name (English)'}
                    </label>
                    <input
                      type="text"
                      value={editSupplierCategoryEn}
                      onChange={(e) => setEditSupplierCategoryEn(e.target.value)}
                      placeholder="e.g. Hikaya Bakhoor, Falcon Factory"
                      className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none font-sans"
                      dir="ltr"
                    />
                  </div>
                </div>
              )}

              {editingParty.type === 'DRIVER' && (
                <div className="space-y-3 border-t pt-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      {locale === 'ar' ? 'رقم السيارة' : locale === 'id' ? 'Nomor Plat Kendaraan' : 'Vehicle Plate No.'}
                    </label>
                    <input
                      type="text"
                      value={editCarNumber}
                      onChange={(e) => setEditCarNumber(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editDriverGiftEnabled}
                      onChange={(e) => setEditDriverGiftEnabled(e.target.checked)}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span>{locale === 'ar' ? 'تفعيل نظام احتساب هدايا السائقين' : locale === 'id' ? 'Aktifkan Sistem Pelacakan Hadiah Supir' : 'Enable Driver Gift Tracking'}</span>
                  </label>
                </div>
              )}

              {editingParty.type === 'PARTNER' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      {locale === 'ar' ? 'نسبة الربح (%)' : locale === 'id' ? 'Porsi Bagi Hasil (%)' : 'Profit Share (%)'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={editProfitShareRatio}
                      onChange={(e) => setEditProfitShareRatio(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none text-left"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      {locale === 'ar' ? 'رأس المال الافتتاحي' : locale === 'id' ? 'Modal Awal Disetor' : 'Opening Capital'}
                    </label>
                    <input
                      type="number"
                      value={editOpeningCapital}
                      onChange={(e) => setEditOpeningCapital(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none text-left"
                      dir="ltr"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={editSubmitting}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="flex items-center gap-1.5 rounded-md bg-amber-600 px-5 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:bg-amber-400"
                >
                  <Check className="h-4 w-4" />
                  <span>{editSubmitting ? t.common.saving : t.common.save}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Party Confirmation Modal */}
      {isDeleteModalOpen && deletingParty && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setIsDeleteModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-rose-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-700 border-b border-rose-100 pb-3">
              <div className="p-2 bg-rose-50 rounded-xl">
                <AlertTriangle className="h-6 w-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {locale === 'ar' ? 'تأكيد حذف جهة التعامل' : locale === 'id' ? 'Konfirmasi Hapus Pihak' : 'Confirm Delete Party'}
                </h3>
                <p className="text-xs text-slate-500">
                  {deletingParty.name} ({deletingParty.code})
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="mt-3 rounded-md bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                {deleteError}
              </div>
            )}

            <p className="mt-4 text-xs text-slate-600 leading-relaxed">
              {locale === 'ar'
                ? 'هل أنت متأكد من رغبتك في حذف هذه الجهة؟ سيتم فحص النظام والتأكد من عدم وجود أي فواتير أو حركات مالية مسجلة باسمها لحماية القيود.'
                : locale === 'id'
                ? 'Apakah Anda yakin ingin menghapus pihak ini? Sistem akan memeriksa dan memastikan tidak ada faktur atau transaksi keuangan tertaut untuk melindungi integritas buku besar.'
                : 'Are you sure you want to delete this entity? The system will verify there are no transactions or invoices linked to it to protect ledger integrity.'}
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={deleteSubmitting}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteSubmitting}
                className="flex items-center gap-1.5 rounded-md bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:bg-rose-400"
              >
                <Trash2 className="h-4 w-4" />
                <span>
                  {deleteSubmitting
                    ? locale === 'ar'
                      ? 'جاري الحذف...'
                      : locale === 'id'
                      ? 'Menghapus...'
                      : 'Deleting...'
                    : locale === 'ar'
                    ? 'تأكيد الحذف'
                    : locale === 'id'
                    ? 'Konfirmasi Hapus'
                    : 'Confirm Delete'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
