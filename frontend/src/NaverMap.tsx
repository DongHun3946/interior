import { useEffect, useRef, useState } from "react";
import { reportAppError } from "./errors";

declare global {
  interface Window {
    naver?: any;
    navermap_authFailure?: () => void;
  }
}

export interface MapMarker {
  latitude: number;
  longitude: number;
  title?: string;
}

let sdkPromise: Promise<void> | null = null;

function loadNaverMaps(): Promise<void> {
  if (window.naver?.maps) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  const key = import.meta.env.VITE_NAVER_MAP_KEY_ID;
  if (!key)
    return Promise.reject(
      new Error("지도 서비스를 사용할 수 있도록 준비되지 않았습니다."),
    );
  sdkPromise = new Promise((resolve, reject) => {
    const callback = `initNaverMap_${Date.now()}`;
    (window as any)[callback] = () => {
      delete (window as any)[callback];
      resolve();
    };
    window.navermap_authFailure = () =>
      reject(new Error("지도 서비스에 연결할 수 없습니다."));
    const script = document.createElement("script");
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(key)}&callback=${callback}`;
    script.async = true;
    script.onerror = () =>
      reject(new Error("지도를 불러오는 중 연결 문제가 발생했습니다."));
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export default function NaverMap({
  markers,
  className = "",
  selectable = false,
  initialCenter,
  onMapClick,
}: {
  markers: MapMarker[];
  className?: string;
  selectable?: boolean;
  initialCenter?: MapMarker;
  onMapClick?: (position: { latitude: number; longitude: number }) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if ((!markers.length && !selectable) || !container.current) return;
    setError("");
    loadNaverMaps()
      .then(() => {
        if (!container.current || !window.naver?.maps) return;
        const firstPosition = markers[0] || initialCenter || {
          latitude: 37.5665,
          longitude: 126.978,
        };
        const center = new window.naver.maps.LatLng(
          firstPosition.latitude,
          firstPosition.longitude,
        );
        const map = new window.naver.maps.Map(container.current, {
          center,
          zoom: markers.length === 1 || initialCenter ? 16 : 13,
          zoomControl: true,
          draggableCursor: selectable ? "crosshair" : undefined,
        });
        const bounds = new window.naver.maps.LatLngBounds();
        markers.forEach((item) => {
          const position = new window.naver.maps.LatLng(
            item.latitude,
            item.longitude,
          );
          const marker = new window.naver.maps.Marker({
            position,
            map,
            title: item.title || "",
          });
          bounds.extend(position);
          if (item.title) {
            const info = new window.naver.maps.InfoWindow({
              content: `<div style="padding:10px 12px;font-size:12px;font-weight:600">${item.title.replace(/[<>]/g, "")}</div>`,
            });
            window.naver.maps.Event.addListener(marker, "click", () =>
              info.open(map, marker),
            );
          }
        });
        if (markers.length > 1)
          map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
        if (selectable && onMapClick) {
          window.naver.maps.Event.addListener(map, "click", (event: any) => {
            const latitude = typeof event.coord.lat === "function" ? event.coord.lat() : event.coord.y;
            const longitude = typeof event.coord.lng === "function" ? event.coord.lng() : event.coord.x;
            onMapClick({ latitude: Number(latitude), longitude: Number(longitude) });
          });
        }
      })
      .catch((reason) => {
        const message =
          reason instanceof Error
            ? reason.message
            : "지도를 불러오지 못했습니다.";
        setError(message);
        reportAppError(reason, message);
      });
  }, [markers, selectable, initialCenter, onMapClick]);

  if (!markers.length && !selectable)
    return (
      <div
        className={`flex items-center justify-center bg-[#eef1f3] text-sm text-[#8b95a1] ${className}`}
      >
        등록된 좌표가 없습니다.
      </div>
    );
  if (error)
    return (
      <div
        className={`flex items-center justify-center bg-[#eef1f3] px-6 text-center text-sm text-[#8b95a1] ${className}`}
      >
        {error}
      </div>
    );
  return <div ref={container} className={className} />;
}
