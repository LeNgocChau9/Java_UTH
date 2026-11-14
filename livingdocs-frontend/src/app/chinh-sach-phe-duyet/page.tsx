"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw, SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { reviewService, type ApprovalPolicyItem } from "@/services/reviewService";
import { templateService, type DocTemplateDto } from "@/services/templateService";

type PolicyRow = ApprovalPolicyItem & { templateName?: string };

function mergeTemplates(policies: ApprovalPolicyItem[], templates: DocTemplateDto[]): PolicyRow[] {
  const byType = new Map<string, PolicyRow>();
  for (const policy of policies) {
    const key = policy.docType?.trim().toUpperCase();
    if (!key) continue;
    byType.set(key, { ...policy, docType: key, tiers: policy.tiers === 1 ? 1 : 2 });
  }
  for (const template of templates) {
    const key = template.type?.trim().toUpperCase();
    if (!key || byType.has(key)) {
      if (key && byType.has(key)) {
        byType.get(key)!.templateName = template.name;
      }
      continue;
    }
    const oneTier = key.includes("API");
    byType.set(key, {
      docType: key,
      tiers: oneTier ? 1 : 2,
      templateName: template.name,
      description: oneTier
        ? "Tài liệu tham khảo API: nhân viên chấp thuận là xuất bản ngay."
        : "Tài liệu quan trọng: nhân viên xem xét rồi quản lý phê duyệt xuất bản.",
    });
  }
  return Array.from(byType.values());
}

export default function ApprovalPolicyPage() {
  const [rows, setRows] = useState<PolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [policies, templates] = await Promise.all([
        reviewService.getApprovalPolicies(),
        templateService.getTemplates().catch(() => [] as DocTemplateDto[]),
      ]);
      setRows(mergeTemplates(policies, templates));
    } catch {
      setError("Không tải được chính sách phê duyệt.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function setTiers(docType: string, tiers: 1 | 2) {
    setRows((current) => current.map((row) => (row.docType === docType ? { ...row, tiers } : row)));
  }

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const saved = await reviewService.updateApprovalPolicies(
        rows.map(({ docType, tiers, description }) => ({ docType, tiers, description }))
      );
      setRows((current) => saved.map((policy) => ({
        ...policy,
        tiers: policy.tiers === 1 ? 1 : 2,
        templateName: current.find((row) => row.docType === policy.docType)?.templateName,
      })));
      setMessage("Đã lưu. Mẫu một cấp sẽ được nhân viên xuất bản ngay khi phê duyệt.");
    } catch {
      setError("Không lưu được chính sách. Cần tài khoản Quản lý, Tech Lead hoặc Admin.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="text-[#07543f]" size={22} />
              <h1 className="text-2xl font-bold text-slate-900">Chính sách phê duyệt</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 rounded-lg bg-[#07543f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? <RefreshCw size={15} className="animate-spin" /> : <Check size={15} />}
            Lưu chính sách
          </button>
        </div>

        {message && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Mẫu tài liệu</th>
                <th className="px-4 py-3">Số cấp</th>
                <th className="px-4 py-3">Khi nhân viên phê duyệt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-slate-400">Đang tải mẫu và chính sách...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-slate-400">Chưa có mẫu tài liệu.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.docType}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{row.templateName || row.docType}</div>
                      <div className="font-mono text-xs text-slate-400">{row.docType}</div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={row.tiers}
                        onChange={(event) => setTiers(row.docType, Number(event.target.value) as 1 | 2)}
                        className="rounded-lg border border-slate-300 px-3 py-2"
                      >
                        <option value={1}>Một cấp</option>
                        <option value={2}>Hai cấp</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.tiers === 1
                        ? "Chuyển ngay sang đã xuất bản."
                        : "Chuyển sang quản lý phê duyệt, rồi mới xuất bản."}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
