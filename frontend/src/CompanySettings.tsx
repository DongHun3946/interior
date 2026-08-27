import { useEffect, useState, type FormEvent } from "react";
import { Building2, Clock3, Save, ShieldCheck } from "lucide-react";

import { api } from "./api";
import DropdownSelect, { type DropdownOption } from "./DropdownSelect";
import type { CompanySettings } from "./types";
import { showSuccessToast } from "./Toast";

const sessionTimeoutOptions: DropdownOption[] = [
  { value: "60", label: "1시간" },
  { value: "240", label: "4시간" },
  { value: "480", label: "8시간 (권장)" },
  { value: "720", label: "12시간" },
  { value: "1440", label: "24시간" },
  { value: "10080", label: "7일" },
];

const emptySettings: CompanySettings = {
  business_name: "",
  address: "",
  business_registration_number: "",
  representative_name: "",
  phone: "",
  fax: "",
  session_timeout_minutes: 480,
};

export default function CompanySettingsPage() {
  const [form, setForm] = useState<CompanySettings>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

  const set = <K extends keyof CompanySettings,>(
    key: K,
    value: CompanySettings[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const updated = await api.updateCompanySettings(form);
      setForm(updated);
      showSuccessToast("업체 정보를 저장했습니다.");
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
        </div>

        <div className="p-6 sm:p-8">
          {loading ? (
            <p className="py-16 text-center text-sm text-[#7b8980]">
              업체 정보를 불러오는 중입니다.
            </p>
          ) : (
            <div className="space-y-8">
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
              <section className="rounded-2xl border border-[#dce6de] bg-[#f7faf7] p-5 sm:p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e5f0e7] text-[#3f704e]">
                      <ShieldCheck size={19} />
                    </span>
                    <div>
                      <h3 className="font-bold text-[#294534]">로그인 보안</h3>
                      <p className="mt-1 text-sm leading-6 text-[#718078]">
                        관리자가 다시 로그인하기 전까지 유지할 시간을 설정합니다.
                      </p>
                    </div>
                  </div>
                  <div className="w-full shrink-0 sm:w-56">
                    <label className="label flex items-center gap-1.5">
                      <Clock3 size={14} /> 로그인 유지 시간
                    </label>
                    <DropdownSelect
                      value={String(form.session_timeout_minutes)}
                      options={sessionTimeoutOptions}
                      onChange={(value) =>
                        set("session_timeout_minutes", Number(value))
                      }
                      ariaLabel="로그인 유지 시간"
                    />
                  </div>
                </div>
                <div className="mt-4 rounded-xl border border-[#e1e8e2] bg-white px-4 py-3 text-xs leading-5 text-[#68786e]">
                  변경한 시간은 <strong className="text-[#365642]">다음 로그인부터</strong>{" "}
                  발급되는 JWT에 적용됩니다. 공용 컴퓨터에서는 사용 후 반드시 로그아웃해 주세요.
                </div>
              </section>
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
                {saving ? "저장 중…" : "설정 저장"}
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
