import { useEffect, useState, type FormEvent } from "react";
import { Building2, CheckCircle2, Save } from "lucide-react";

import { api } from "./api";
import type { CompanySettings } from "./types";

const emptySettings: CompanySettings = {
  business_name: "",
  address: "",
  business_registration_number: "",
  representative_name: "",
  phone: "",
  fax: "",
};

export default function CompanySettingsPage() {
  const [form, setForm] = useState<CompanySettings>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .companySettings()
      .then(setForm)
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "업체 정보를 불러오지 못했습니다.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const set = (key: keyof CompanySettings, value: string) => {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const updated = await api.updateCompanySettings(form);
      setForm(updated);
      setSaved(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "업체 정보를 저장하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-5 sm:p-8">
      <form onSubmit={submit} className="panel mx-auto max-w-5xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e6ebe7] px-6 py-6 sm:px-8">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-[#e8f1e9] p-3 text-[#376246]">
              <Building2 size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#203a2d]">업체 정보</h2>
              <p className="mt-1 text-sm text-[#7b8980]">
                견적서와 고객 안내에 사용할 업체 기본 정보를 관리합니다.
              </p>
            </div>
          </div>
          {saved && (
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <CheckCircle2 size={17} /> 저장되었습니다
            </p>
          )}
        </div>

        <div className="p-6 sm:p-8">
          {loading ? (
            <p className="py-16 text-center text-sm text-[#7b8980]">
              업체 정보를 불러오는 중입니다.
            </p>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="label">상호</label>
                <input
                  className="field"
                  value={form.business_name}
                  onChange={(event) => set("business_name", event.target.value)}
                />
              </div>
              <div>
                <label className="label">대표자</label>
                <input
                  className="field"
                  value={form.representative_name}
                  onChange={(event) =>
                    set("representative_name", event.target.value)
                  }
                />
              </div>
              <div>
                <label className="label">사업자등록번호</label>
                <input
                  className="field"
                  value={form.business_registration_number}
                  inputMode="numeric"
                  onChange={(event) =>
                    set("business_registration_number", event.target.value)
                  }
                />
              </div>
              <div>
                <label className="label">전화번호</label>
                <input
                  className="field"
                  type="tel"
                  value={form.phone}
                  onChange={(event) => set("phone", event.target.value)}
                />
              </div>
              <div>
                <label className="label">FAX</label>
                <input
                  className="field"
                  type="tel"
                  value={form.fax}
                  onChange={(event) => set("fax", event.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">주소</label>
                <input
                  className="field"
                  value={form.address}
                  onChange={(event) => set("address", event.target.value)}
                />
              </div>
            </div>
          )}

          {error && (
            <p className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          )}

          {!loading && (
            <div className="mt-8 flex justify-end border-t border-[#e9ede9] pt-6">
              <button className="btn-primary" disabled={saving}>
                <Save size={16} />
                {saving ? "저장 중…" : "업체 정보 저장"}
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
