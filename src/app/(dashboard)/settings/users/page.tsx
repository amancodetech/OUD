'use client';
import { useUiText } from '@/i18n/interface-text';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  UserPlus,
  ShieldCheck,
  KeyRound,
  Check,
  AlertCircle,
  Edit3,
  ArrowRight,
  Lock,
  Sparkles,
} from 'lucide-react';
import {
  ALL_PERMISSIONS,
  PERMISSION_PRESETS,
  PermissionKey,
} from '@/lib/permissions';

interface UserRecord {
  id: string;
  username: string;
  displayName: string;
  role: 'ADMIN' | 'ACCOUNTANT' | 'CASHIER';
  permissions: PermissionKey[];
  isActive: boolean;
  createdAt: string;
}

export default function UsersManagementPage() {
  const ui = useUiText();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form state (used for Create or Edit)
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'ACCOUNTANT' | 'CASHIER'>('CASHIER');
  const [selectedPreset, setSelectedPreset] = useState<
    'RECEPTION' | 'CASHIER' | 'ACCOUNTANT' | 'ADMIN' | 'CUSTOM'
  >('RECEPTION');
  const [permissions, setPermissions] = useState<PermissionKey[]>(
    PERMISSION_PRESETS.RECEPTION.permissions
  );
  const [isActive, setIsActive] = useState(true);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/users');
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'فشل جلب قائمة المستخدمين');
      }
      setUsers(json.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'خطأ في التحميل');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const applyPreset = (presetKey: 'RECEPTION' | 'CASHIER' | 'ACCOUNTANT' | 'ADMIN') => {
    setSelectedPreset(presetKey);
    const preset = PERMISSION_PRESETS[presetKey];
    setRole(preset.role);
    setPermissions([...preset.permissions]);
  };

  const togglePermission = (key: PermissionKey) => {
    if (role === 'ADMIN') return; // Admin always has all permissions
    setSelectedPreset('CUSTOM');
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const resetFormToReception = () => {
    setEditingUserId(null);
    setUsername('');
    setDisplayName('');
    setPassword('');
    setIsActive(true);
    applyPreset('RECEPTION');
  };

  const startEditUser = (u: UserRecord) => {
    setEditingUserId(u.id);
    setUsername(u.username);
    setDisplayName(u.displayName);
    setPassword('');
    setRole(u.role);
    setPermissions(u.permissions || []);
    setIsActive(u.isActive);
    setSelectedPreset(u.role === 'ADMIN' ? 'ADMIN' : 'CUSTOM');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (editingUserId) {
        const res = await fetch(`/api/users/${editingUserId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName,
            role,
            permissions,
            isActive,
            password: password.trim() || undefined,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'فشل تحديث الحساب');
        setSuccessMsg(`تم تحديث حساب وصلاحيات «${displayName}» بنجاح.`);
      } else {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            displayName,
            password,
            role,
            permissions,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'فشل إنشاء الحساب');
        setSuccessMsg(`تم إنشاء حساب «${displayName}» (${username}) وتفعيل صلاحياته بنجاح.`);
      }

      resetFormToReception();
      await loadUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActiveQuick = async (u: UserRecord) => {
    try {
      setError(null);
      const res = await fetch(`/api/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'فشل تغيير حالة الحساب');
      await loadUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث الحالة');
    }
  };

  // Group permissions by category
  const permissionGroups = Array.from(new Set(ALL_PERMISSIONS.map((p) => p.group)));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E6DDD3] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[#241112] flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#F5EFEA] border border-[#E6DDD3] text-[#6E1E24]">
              <Users className="h-5 w-5" />
            </span>
            <span>{ui("إدارة المستخدمين والصلاحيات (حسابات الريسبشن والموظفين)")}</span>
          </h1>
          <p className="text-xs text-[#6B5648] mt-1">
            {ui("إنشاء حسابات لموظفي الاستقبال (الريسبشن)، البائعين، والمحاسبين وتحديد الشاشات والصلاحيات المسموحة لكل حساب بدقة")}</p>
        </div>

        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6DDD3] bg-white px-3.5 py-2 text-xs font-bold text-[#241112] hover:bg-[#F5EFEA] transition"
        >
          <ArrowRight className="h-4 w-4 text-[#6E1E24]" />
          <span>{ui("العودة إلى الإعدادات")}</span>
        </Link>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 p-4 border border-rose-200 text-xs font-bold text-rose-800 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
          <Check className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Create / Edit User & Permissions Card */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-[#E6DDD3] p-6 shadow-2xs space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F2ECE4] pb-4">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-[#6E1E24]" />
            <h2 className="text-base font-bold text-[#241112]">
              {editingUserId
                ? `تعديل الحساب والصلاحيات: ${displayName} (${username})`
                : ui("إضافة حساب موظف جديد وتحديد صلاحياته")}
            </h2>
          </div>

          {editingUserId && (
            <button
              type="button"
              onClick={resetFormToReception}
              className="text-xs font-bold text-[#6E1E24] hover:underline"
            >
              {ui("+ إلغاء التعديل وإضافة حساب جديد")}</button>
          )}
        </div>

        {/* Step 1: Quick Role / Preset Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-[#241112]">
            {ui("1. اختر قالب الوظيفة السريع (يمكنك بعدها تخصيص الصلاحيات بالأسفل):")}</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(
              [
                {
                  key: 'RECEPTION',
                  title: ui("موظف ريسبشن (استقبال)"),
                  subtitle: ui("تسجيل زوار السائقين + العملاء + التستر والمبيعات"),
                },
                {
                  key: 'CASHIER',
                  title: ui("كاشير / بائع معرض"),
                  subtitle: ui("المبيعات + التحصيل + المرتجعات + استعلام المخزون"),
                },
                {
                  key: 'ACCOUNTANT',
                  title: ui("محاسب"),
                  subtitle: ui("كافة العمليات والتقارير والمشتريات والتصنيع"),
                },
                {
                  key: 'ADMIN',
                  title: ui("مدير النظام"),
                  subtitle: ui("صلاحية كاملة شاملة الإعدادات والمستخدمين"),
                },
              ] as const
            ).map((p) => {
              const active = selectedPreset === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyPreset(p.key)}
                  className={`text-right p-3.5 rounded-xl border transition-all ${
                    active
                      ? 'bg-[#FAF5EE] border-[#6E1E24] ring-1 ring-[#6E1E24]'
                      : 'bg-[#F9F6F2]/60 border-[#E6DDD3] hover:bg-[#F5EFEA]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#241112]">{ui(p.title)}</span>
                    {active && (
                      <span className="w-5 h-5 rounded-full bg-[#6E1E24] text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#6B5648] mt-1">{ui(p.subtitle)}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Account Credentials */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-[#241112]">
              {ui("اسم الدخول (Username) *")}</label>
            <input
              type="text"
              required
              disabled={Boolean(editingUserId)}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={ui("مثال: reception1")}
              className="mt-1.5 block w-full rounded-xl border border-[#E6DDD3] bg-[#F9F6F2] py-2 px-3 text-sm font-mono text-[#241112] focus:border-[#6E1E24] focus:bg-white focus:outline-none disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#241112]">
              {ui("الاسم الظاهر للموظف *")}</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={ui("مثال: موظف الريسبشن - أحمد")}
              className="mt-1.5 block w-full rounded-xl border border-[#E6DDD3] bg-[#F9F6F2] py-2 px-3 text-sm text-[#241112] focus:border-[#6E1E24] focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#241112]">
              {editingUserId
                ? ui("كلمة مرور جديدة (اتركها فارغة للإبقاء على الحالية)")
                : ui("كلمة المرور *")}
            </label>
            <div className="relative mt-1.5">
              <input
                type="password"
                required={!editingUserId}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={editingUserId ? ui("•••••••• (اختياري)") : ui("أدخل كلمة المرور")}
                className="block w-full rounded-xl border border-[#E6DDD3] bg-[#F9F6F2] py-2 px-3 text-sm text-[#241112] focus:border-[#6E1E24] focus:bg-white focus:outline-none"
              />
              <KeyRound className="w-4 h-4 text-[#8C7362] absolute left-3 top-2.5 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Step 3: Granular Permissions Matrix */}
        <div className="space-y-3 border-t border-[#F2ECE4] pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-bold text-[#241112] flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-[#6E1E24]" />
              <span>{ui("2. تحديد الصلاحيات والشاشات المسموحة لهذا الحساب:")}</span>
            </label>
            <span className="text-[11px] font-semibold text-[#6E1E24] bg-[#FAF5EE] px-2.5 py-1 rounded-lg border border-[#D4B895]">
              {ui("تم تفعيل")}{permissions.length} {ui("من أصل")}{ALL_PERMISSIONS.length} {ui("صلاحية")}</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {permissionGroups.map((groupName) => {
              const groupItems = ALL_PERMISSIONS.filter((p) => p.group === groupName);
              return (
                <div
                  key={ui(groupName)}
                  className="rounded-xl border border-[#E6DDD3] bg-[#F9F6F2]/50 p-4 space-y-3"
                >
                  <h3 className="text-xs font-bold text-[#6E1E24] border-b border-[#E6DDD3] pb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#9A6533]" />
                    <span>{ui(groupName)}</span>
                  </h3>

                  <div className="space-y-2.5">
                    {groupItems.map((perm) => {
                      const checked =
                        role === 'ADMIN' || permissions.includes(perm.key);
                      return (
                        <label
                          key={perm.key}
                          className={`flex items-start gap-2.5 p-2 rounded-lg border transition cursor-pointer ${
                            checked
                              ? 'bg-white border-[#D4B895]'
                              : 'bg-transparent border-transparent hover:bg-white/60'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={role === 'ADMIN'}
                            onChange={() => togglePermission(perm.key)}
                            className="mt-0.5 h-4 w-4 rounded border-[#C8A98E] text-[#6E1E24] focus:ring-[#6E1E24]"
                          />
                          <div className="text-xs">
                            <div className="font-bold text-[#241112]">{ui(perm.label)}</div>
                            <div className="text-[11px] text-[#6B5648] leading-relaxed">
                              {ui(perm.description)}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Submit Bar */}
        <div className="flex items-center justify-end gap-3 border-t border-[#F2ECE4] pt-4">
          {editingUserId && (
            <button
              type="button"
              onClick={resetFormToReception}
              className="rounded-xl border border-[#E6DDD3] bg-white px-4 py-2 text-xs font-bold text-[#6B5648] hover:bg-[#F5EFEA]"
            >
              {ui("إلغاء")}</button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-[#6E1E24] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#58161B] shadow-xs transition"
          >
            <Check className="h-4 w-4 text-[#E6B88A]" />
            <span>
              {saving
                ? ui("جارٍ الحفظ...")
                : editingUserId
                ? ui("حفظ تعديلات الحساب والصلاحيات")
                : ui("إنشاء الحساب وتفعيل الصلاحيات")}
            </span>
          </button>
        </div>
      </form>

      {/* Existing Users Table */}
      <div className="bg-white rounded-2xl border border-[#E6DDD3] p-6 shadow-2xs space-y-4">
        <h2 className="text-base font-bold text-[#241112] flex items-center gap-2">
          <Lock className="h-4 w-4 text-[#6E1E24]" />
          <span>{ui("الحسابات المسجلة في النظام (")}{users.length})</span>
        </h2>

        {loading ? (
          <div className="py-10 text-center text-xs text-[#6B5648]">
            {ui("جارٍ تحميل قائمة الحسابات...")}</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#E6DDD3]">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#F6F1EB] text-[#241112] font-bold border-b border-[#E6DDD3]">
                <tr>
                  <th className="p-3">{ui("اسم الدخول")}</th>
                  <th className="p-3">{ui("الاسم الظاهر")}</th>
                  <th className="p-3">{ui("الدور")}</th>
                  <th className="p-3">{ui("الصلاحيات المفعّلة")}</th>
                  <th className="p-3 text-center">{ui("الحالة")}</th>
                  <th className="p-3 text-center">{ui("إجراءات")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2ECE4]">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-[#F9F6F2] transition-colors">
                    <td className="p-3 font-mono font-bold text-[#6E1E24]">
                      {u.username}
                    </td>
                    <td className="p-3 font-bold text-[#241112]">{u.displayName}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-[#F5EFEA] text-[#241112] border border-[#E6DDD3]">
                        {u.role === 'ADMIN'
                          ? ui("مدير النظام")
                          : u.role === 'ACCOUNTANT'
                          ? ui("محاسب")
                          : ui("ريسبشن / كاشير")}
                      </span>
                    </td>
                    <td className="p-3">
                      {u.role === 'ADMIN' ? (
                        <span className="text-[11px] font-semibold text-emerald-800">
                          {ui("كافة الصلاحيات (")}{ALL_PERMISSIONS.length})
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-md">
                          {(u.permissions || []).slice(0, 5).map((pKey) => {
                            const def = ALL_PERMISSIONS.find((d) => d.key === pKey);
                            return (
                              <span
                                key={pKey}
                                className="px-2 py-0.5 rounded bg-[#FAF5EE] border border-[#E6DDD3] text-[10px] font-semibold text-[#5C3A21]"
                              >
                                {def ? def.label : pKey}
                              </span>
                            );
                          })}
                          {(u.permissions || []).length > 5 && (
                            <span className="px-2 py-0.5 rounded bg-[#F5EFEA] text-[10px] font-bold text-[#6E1E24]">
                              +{(u.permissions || []).length - 5} {ui("أخرى")}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleActiveQuick(u)}
                        disabled={u.username === 'admin'}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                          u.isActive
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        } disabled:opacity-60`}
                      >
                        {u.isActive ? ui("نشط") : ui("موقوف")}
                      </button>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => startEditUser(u)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#E6DDD3] bg-white px-3 py-1.5 text-xs font-bold text-[#6E1E24] hover:bg-[#F5EFEA] transition"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>{ui("تعديل الصلاحيات")}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
