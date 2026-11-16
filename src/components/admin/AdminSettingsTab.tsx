import React, { useEffect, useState } from 'react';
import { KeyRound, Plus, RefreshCw, Save, Shield, Trash2, Upload, Users } from 'lucide-react';
import {
  AcademySettings,
  AdminInvite,
  AdminRole,
  AdminUser,
  BatchItem,
  ExamNotice,
  ExamResult,
  PortalSecuritySettings,
  StudentRecord,
} from '../../types/portal';
import {
  createAdminInvite,
  removeAdminInvite,
  saveAcademySettingsDoc,
  saveBatchItem,
  savePortalSecurityAndRotateIfNeeded,
  updateAdminUserRole,
} from '../../services/portalService';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface AdminSettingsTabProps {
  academySettings: AcademySettings;
  portalSecurity: PortalSecuritySettings | null;
  batches: BatchItem[];
  admins: AdminUser[];
  invites: AdminInvite[];
  students: StudentRecord[];
  notices: ExamNotice[];
  results: ExamResult[];
  currentAdmin: AdminUser;
  onRefresh: () => Promise<void>;
}

export const AdminSettingsTab: React.FC<AdminSettingsTabProps> = ({
  academySettings,
  portalSecurity,
  batches,
  admins,
  invites,
  students,
  notices,
  results,
  currentAdmin,
  onRefresh,
}) => {
  const isSuper = currentAdmin.role === 'super_admin';
  const canManageBatches = isSuper || currentAdmin.role === 'admin';

  const [section, setSection] = useState<'academy' | 'batches' | 'admins' | 'security'>('academy');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Academy Form
  const [formAcademy, setFormAcademy] = useState<AcademySettings>(academySettings);

  useEffect(() => {
    setFormAcademy(academySettings);
  }, [academySettings]);

  // Batch Form
  const [batchId, setBatchId] = useState('');
  const [batchName, setBatchName] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [batchDesc, setBatchDesc] = useState('');
  const [batchOrder, setBatchOrder] = useState('1');
  const [batchActive, setBatchActive] = useState(true);

  // Invite Form
  const [invEmail, setInvEmail] = useState('');
  const [invName, setInvName] = useState('');
  const [invRole, setInvRole] = useState<AdminRole>('verifier');

  // Portal Security Form
  const [secForm, setSecForm] = useState<PortalSecuritySettings>(
    portalSecurity || {
      portalAccessKey: '',
      requireManualPaymentReview: true,
      autoNotifyTemplateBn: '',
      autoNotifyTemplateEn: '',
    }
  );
  useEffect(() => {
    if (portalSecurity) {
      setSecForm(portalSecurity);
    }
  }, [portalSecurity]);
  const [confirmRotate, setConfirmRotate] = useState(false);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 150 * 1024) {
      setMsg('Logo image must be under 150 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFormAcademy((prev) => ({ ...prev, logoUrl: String(reader.result || '') }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAcademy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuper) return;
    setSaving(true);
    setMsg('');
    try {
      await saveAcademySettingsDoc(formAcademy, currentAdmin);
      await onRefresh();
      setMsg('Academy settings saved successfully.');
    } catch {
      setMsg('Failed to save academy settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageBatches) return;
    setSaving(true);
    setMsg('');
    try {
      await saveBatchItem(
        {
          id: batchId || batchName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          name: batchName,
          code: batchCode,
          description: batchDesc,
          isActive: batchActive,
          sortOrder: Number(batchOrder) || 1,
        },
        currentAdmin
      );
      setBatchId('');
      setBatchName('');
      setBatchCode('');
      setBatchDesc('');
      await onRefresh();
      setMsg('Batch configuration saved.');
    } catch {
      setMsg('Failed to save batch.');
    } finally {
      setSaving(false);
    }
  };

  const handleInviteAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuper) return;
    setSaving(true);
    setMsg('');
    try {
      await createAdminInvite(
        { email: invEmail, displayName: invName, role: invRole },
        currentAdmin
      );
      setInvEmail('');
      setInvName('');
      await onRefresh();
      setMsg('Staff invite created. They can now sign in with Google using that email.');
    } catch {
      setMsg('Failed to invite admin.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSecurity = async (rotateKey: boolean) => {
    if (!isSuper) return;
    setSaving(true);
    setMsg('');
    try {
      const nextKey = await savePortalSecurityAndRotateIfNeeded(
        secForm,
        rotateKey,
        students,
        notices,
        results,
        currentAdmin
      );
      setSecForm((prev) => ({ ...prev, portalAccessKey: nextKey }));
      await onRefresh();
      setMsg(
        rotateKey
          ? 'Portal access key rotated and synced to all approved students.'
          : 'Notification & security settings saved.'
      );
    } catch {
      setMsg('Failed to update portal security settings.');
    } finally {
      setSaving(false);
      setConfirmRotate(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
            Academy & Portal Configuration
          </h2>
          <p className="text-xs text-slate-600">
            Configure academy branding, contact details, batches, admin roles, privacy policy, and portal security.
          </p>
        </div>

        <div className="inline-flex flex-wrap rounded-md border border-slate-200 bg-slate-100 p-1">
          {[
            { id: 'academy', label: 'Academy & Legal' },
            { id: 'batches', label: 'Batches' },
            { id: 'admins', label: 'Admin Roles' },
            { id: 'security', label: 'Templates & Security' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSection(t.id as any)}
              className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                section === t.id ? 'bg-white text-[#0B1F3A] shadow-sm' : 'text-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {msg && (
        <div className="rounded-md border border-[#99F6E4] bg-[#F0FDFA] p-3 text-xs font-medium text-[#0F766E]">
          {msg}
        </div>
      )}

      {!isSuper && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Super Admin privileges are required to modify academy settings, admin roles, or portal security keys.
        </div>
      )}

      {/* 1. Academy & Legal */}
      {section === 'academy' && (
        <form
          onSubmit={handleSaveAcademy}
          className="rounded-lg border border-slate-200 bg-white p-6 space-y-5"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">Academy Name</label>
              <input
                type="text"
                disabled={!isSuper}
                value={formAcademy.academyName}
                onChange={(e) => setFormAcademy({ ...formAcademy, academyName: e.target.value })}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Tagline</label>
              <input
                type="text"
                disabled={!isSuper}
                value={formAcademy.tagline}
                onChange={(e) => setFormAcademy({ ...formAcademy, tagline: e.target.value })}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Office Phone</label>
              <input
                type="text"
                disabled={!isSuper}
                value={formAcademy.contactPhone}
                onChange={(e) => setFormAcademy({ ...formAcademy, contactPhone: e.target.value })}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Office WhatsApp</label>
              <input
                type="text"
                disabled={!isSuper}
                value={formAcademy.officeWhatsapp}
                onChange={(e) => setFormAcademy({ ...formAcademy, officeWhatsapp: e.target.value })}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Contact Email</label>
              <input
                type="email"
                disabled={!isSuper}
                value={formAcademy.contactEmail}
                onChange={(e) => setFormAcademy({ ...formAcademy, contactEmail: e.target.value })}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Office Hours</label>
              <input
                type="text"
                disabled={!isSuper}
                value={formAcademy.officeHours}
                onChange={(e) => setFormAcademy({ ...formAcademy, officeHours: e.target.value })}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">Office Address</label>
              <input
                type="text"
                disabled={!isSuper}
                value={formAcademy.officeAddress}
                onChange={(e) => setFormAcademy({ ...formAcademy, officeAddress: e.target.value })}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Academy Logo (Upload or Path)</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="text"
                  disabled={!isSuper}
                  value={formAcademy.logoUrl}
                  onChange={(e) => setFormAcademy({ ...formAcademy, logoUrl: e.target.value })}
                  className="block w-full rounded-md border border-slate-300 px-3 py-2 text-xs disabled:bg-slate-100"
                />
                {isSuper && (
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-xs font-medium hover:bg-slate-50 whitespace-nowrap shrink-0">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Upload</span>
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">Bangla Official Instruction</label>
              <textarea
                rows={3}
                disabled={!isSuper}
                value={formAcademy.banglaInstruction}
                onChange={(e) => setFormAcademy({ ...formAcademy, banglaInstruction: e.target.value })}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Bangla Official Notice</label>
              <textarea
                rows={3}
                disabled={!isSuper}
                value={formAcademy.banglaNotice}
                onChange={(e) => setFormAcademy({ ...formAcademy, banglaNotice: e.target.value })}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Privacy Policy</label>
              <textarea
                rows={4}
                disabled={!isSuper}
                value={formAcademy.privacyPolicy}
                onChange={(e) => setFormAcademy({ ...formAcademy, privacyPolicy: e.target.value })}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-xs disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Verification Terms</label>
              <textarea
                rows={4}
                disabled={!isSuper}
                value={formAcademy.termsText}
                onChange={(e) => setFormAcademy({ ...formAcademy, termsText: e.target.value })}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-xs disabled:bg-slate-100"
              />
            </div>
          </div>

          {isSuper && (
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md bg-[#1D5FA7] px-5 py-2 text-xs font-semibold text-white hover:bg-[#164A84] disabled:opacity-60"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Save Academy Settings</span>
              </button>
            </div>
          )}
        </form>
      )}

      {/* 2. Batch Management */}
      {section === 'batches' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {canManageBatches && (
            <form
              onSubmit={handleSaveBatch}
              className="rounded-lg border border-slate-200 bg-white p-5 space-y-4 lg:col-span-5"
            >
              <h3 className="font-display text-sm font-bold text-[#0B1F3A]">
                {batchId ? 'Edit Batch' : 'Add New BCS Batch'}
              </h3>
              <div>
                <label className="block text-xs font-medium text-slate-700">Batch Name</label>
                <input
                  type="text"
                  required
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="47th BCS Comprehensive Batch"
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Batch Code</label>
                  <input
                    type="text"
                    required
                    value={batchCode}
                    onChange={(e) => setBatchCode(e.target.value)}
                    placeholder="BCS-47"
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Sort Order</label>
                  <input
                    type="number"
                    value={batchOrder}
                    onChange={(e) => setBatchOrder(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Description</label>
                <textarea
                  rows={2}
                  value={batchDesc}
                  onChange={(e) => setBatchDesc(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={batchActive}
                  onChange={(e) => setBatchActive(e.target.checked)}
                />
                <span>Active on Public Registration Form</span>
              </label>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#1D5FA7] px-4 py-2 text-xs font-semibold text-white hover:bg-[#164A84]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{batchId ? 'Update Batch' : 'Add Batch'}</span>
              </button>
            </form>
          )}

          <div className={`space-y-3 ${canManageBatches ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
            {batches.map((b) => (
              <div
                key={b.id}
                className="rounded-lg border border-slate-200 bg-white p-4 flex items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono font-semibold text-[#1D5FA7]">{b.code}</span>
                    <span aria-hidden="true">·</span>
                    <span>{b.isActive ? 'Active' : 'Archived'}</span>
                  </div>
                  <p className="font-display text-sm font-bold text-[#0B1F3A]">{b.name}</p>
                  <p className="text-xs text-slate-600">{b.description}</p>
                </div>
                {canManageBatches && (
                  <button
                    type="button"
                    onClick={() => {
                      setBatchId(b.id);
                      setBatchName(b.name);
                      setBatchCode(b.code);
                      setBatchDesc(b.description);
                      setBatchOrder(String(b.sortOrder));
                      setBatchActive(b.isActive);
                    }}
                    className="rounded border border-slate-200 px-3 py-1 text-xs font-medium hover:bg-slate-50"
                  >
                    Edit
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Admin Users & Roles */}
      {section === 'admins' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {isSuper && (
            <form
              onSubmit={handleInviteAdmin}
              className="rounded-lg border border-slate-200 bg-white p-5 space-y-4 lg:col-span-5"
            >
              <div className="flex items-center gap-2 text-sm font-bold text-[#0B1F3A]">
                <Users className="h-4 w-4 text-[#1D5FA7]" />
                <h3>Invite Staff / Admin</h3>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Google Email Address</label>
                <input
                  type="email"
                  required
                  value={invEmail}
                  onChange={(e) => setInvEmail(e.target.value)}
                  placeholder="staff@example.com"
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Staff Display Name</label>
                <input
                  type="text"
                  required
                  value={invName}
                  onChange={(e) => setInvName(e.target.value)}
                  placeholder="Academic Coordinator"
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Assigned Role</label>
                <select
                  value={invRole}
                  onChange={(e) => setInvRole(e.target.value as AdminRole)}
                  className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="verifier">verifier (Payment & WhatsApp status review)</option>
                  <option value="admin">admin (Students, Exams & Batches)</option>
                  <option value="viewer">viewer (Read-only analytics)</option>
                  <option value="super_admin">super_admin (Full system & settings)</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-[#0B1F3A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#16345C]"
              >
                Send Staff Invite
              </button>
            </form>
          )}

          <div className={`space-y-5 ${isSuper ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
            <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
              <h3 className="text-sm font-bold text-[#0B1F3A]">Active Admin Users</h3>
              <div className="divide-y divide-slate-100">
                {admins.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs">
                    <div>
                      <p className="font-semibold text-[#0B1F3A]">{a.displayName}</p>
                      <p className="font-mono text-slate-500">{a.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        disabled={!isSuper || a.uid === currentAdmin.uid}
                        value={a.role}
                        onChange={(e) =>
                          updateAdminUserRole(a, e.target.value as AdminRole, a.active, currentAdmin).then(
                            onRefresh
                          )
                        }
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs disabled:bg-slate-100"
                      >
                        <option value="super_admin">super_admin</option>
                        <option value="admin">admin</option>
                        <option value="verifier">verifier</option>
                        <option value="viewer">viewer</option>
                      </select>
                      <button
                        type="button"
                        disabled={!isSuper || a.uid === currentAdmin.uid}
                        onClick={() =>
                          updateAdminUserRole(a, a.role, !a.active, currentAdmin).then(onRefresh)
                        }
                        className={`rounded border px-2.5 py-1 font-medium disabled:opacity-50 ${
                          a.active
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 bg-slate-100 text-slate-600'
                        }`}
                      >
                        {a.active ? 'Active' : 'Suspended'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {invites.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
                <h3 className="text-sm font-bold text-[#0B1F3A]">Pending Invites</h3>
                <div className="divide-y divide-slate-100">
                  {invites.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between py-2.5 text-xs">
                      <div>
                        <p className="font-medium text-[#0B1F3A]">{inv.email}</p>
                        <p className="text-slate-500">Role: {inv.role}</p>
                      </div>
                      {isSuper && (
                        <button
                          type="button"
                          onClick={() => removeAdminInvite(inv, currentAdmin).then(onRefresh)}
                          className="rounded border border-red-200 p-1.5 text-red-700 hover:bg-red-50"
                          aria-label="Revoke invite"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Templates & Portal Security */}
      {section === 'security' && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-6">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-bold text-[#0B1F3A]">
                <Shield className="h-4 w-4 text-[#1D5FA7]" />
                <h3>Approved Student Portal Key & WhatsApp Templates</h3>
              </div>
              <p className="text-xs text-slate-600">
                Approved students receive the portal access key automatically on their private status card to unlock restricted notices and exam results.
              </p>
            </div>
            {isSuper && (
              <button
                type="button"
                onClick={() => setConfirmRotate(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#0B1F3A] hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Rotate Access Key</span>
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">
              Current Restricted Portal Key
            </label>
            <div className="mt-1 flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
              <KeyRound className="h-3.5 w-3.5 text-slate-400" />
              <span>{secForm.portalAccessKey || 'Not initialized'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                WhatsApp Message Template (Bangla)
              </label>
              <textarea
                rows={3}
                disabled={!isSuper}
                value={secForm.autoNotifyTemplateBn}
                onChange={(e) => setSecForm({ ...secForm, autoNotifyTemplateBn: e.target.value })}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-xs disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                WhatsApp Message Template (English)
              </label>
              <textarea
                rows={3}
                disabled={!isSuper}
                value={secForm.autoNotifyTemplateEn}
                onChange={(e) => setSecForm({ ...secForm, autoNotifyTemplateEn: e.target.value })}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-xs disabled:bg-slate-100"
              />
            </div>
          </div>

          {isSuper && (
            <div className="flex justify-end">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveSecurity(false)}
                className="rounded-md bg-[#1D5FA7] px-5 py-2 text-xs font-semibold text-white hover:bg-[#164A84]"
              >
                Save Notification Templates
              </button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmRotate}
        title="Rotate Restricted Exam Portal Key"
        description="Rotating the portal key will generate a new secret access key, re-publish all approved notices and results under the new key, and update every Approved student's status token. Proceed?"
        confirmLabel="Rotate Key"
        loading={saving}
        onCancel={() => setConfirmRotate(false)}
        onConfirm={() => handleSaveSecurity(true)}
      />
    </div>
  );
};
