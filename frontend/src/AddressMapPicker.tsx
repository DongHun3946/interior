import { useCallback, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { api } from "./api";
import Modal from "./Modal";
import NaverMap from "./NaverMap";
import type { GeocodeResult } from "./types";

export default function AddressMapPicker({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (result: GeocodeResult) => void;
}) {
  const [position, setPosition] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [result, setResult] = useState<GeocodeResult | null>(null);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");
  const initialCenter = useMemo(
    () => ({ latitude: 37.3943, longitude: 126.9568 }),
    [],
  );
  const markers = useMemo(
    () => (position ? [{ ...position, title: "선택한 위치" }] : []),
    [position],
  );
  const choosePosition = useCallback(
    async (next: { latitude: number; longitude: number }) => {
      setPosition(next);
      setResult(null);
      setResolving(true);
      setError("");
      try {
        setResult(await api.reverseGeocode(next.latitude, next.longitude));
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "선택한 위치의 주소를 확인하지 못했습니다.",
        );
      } finally {
        setResolving(false);
      }
    },
    [],
  );

  return (
    <Modal
      title="지도에서 위치 선택"
      description="지도를 이동·확대한 뒤 등록할 건물이나 도로를 클릭하세요."
      onClose={onClose}
      closeDisabled={resolving}
      maxWidthClass="max-w-4xl"
    >
      <div className="relative">
          <NaverMap
            className="h-[430px] w-full bg-[#edf2ed] sm:h-[520px]"
            markers={markers}
            initialCenter={initialCenter}
            selectable
            onMapClick={choosePosition}
          />
          <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-[#17372b]/90 px-4 py-2 text-xs font-semibold text-white shadow-lg">
            원하는 위치를 클릭하세요
          </div>
        </div>
        <div className="flex flex-col gap-4 border-t border-[#e5eae5] p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            {resolving && (
              <p className="text-sm font-semibold text-[#557060]">
                선택한 위치의 주소를 확인하는 중…
              </p>
            )}
            {result && (
              <>
                <p className="text-sm font-bold text-[#294534]">
                  {result.road_address}
                </p>
                {result.jibun_address &&
                  result.jibun_address !== result.road_address && (
                    <p className="mt-1 text-xs text-[#849188]">
                      지번 {result.jibun_address}
                    </p>
                  )}
              </>
            )}
            {error && <p className="text-sm text-rose-600">{error}</p>}
            {!resolving && !result && !error && (
              <p className="text-sm text-[#849188]">
                아직 선택한 위치가 없습니다.
              </p>
            )}
          </div>
          <div className="flex shrink-0 justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              취소
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!result || resolving}
              onClick={() => result && onSelect(result)}
            >
              <MapPin size={15} /> 이 위치로 등록
            </button>
          </div>
      </div>
    </Modal>
  );
}
