import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
} from "react";
import {
  Box,
  Check,
  CheckCircle2,
  Clock3,
  CopyPlus,
  Cuboid,
  Grid2X2,
  ImagePlus,
  Layers3,
  LoaderCircle,
  Move,
  Plus,
  RotateCw,
  Save,
  ScanLine,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { api, mediaUrl } from "./api";
import DropdownSelect, { type DropdownOption } from "./DropdownSelect";
import type {
  MaterialType,
  SceneDocument,
  ScenePlacement,
  SceneRoom,
  Simulation,
  SimulationVersion,
  SpaceScan,
  SurfaceMaterial,
} from "./types";

const furnitureCatalog = [
  {
    name: "3인 소파",
    category: "sofa",
    size: [2.1, 0.9, 0.82],
    color: "#78917f",
  },
  {
    name: "거실 테이블",
    category: "table",
    size: [1.2, 0.65, 0.42],
    color: "#a58261",
  },
  {
    name: "퀸 침대",
    category: "bed",
    size: [1.6, 2.0, 0.55],
    color: "#a2aab4",
  },
  {
    name: "수납장",
    category: "cabinet",
    size: [1.2, 0.45, 1.8],
    color: "#8a735f",
  },
] as const;

const materialLabels: Record<MaterialType, string> = {
  WALLPAPER: "도배",
  TILE: "타일",
  FLOORING: "바닥재",
  PAINT: "페인트",
  OTHER: "기타",
};
const materialTypeOptions: DropdownOption[] = Object.entries(materialLabels).map(
  ([value, label]) => ({ value, label }),
);
const scanSourceOptions: DropdownOption[] = [
  { value: "PHOTOS", label: "여러 장의 공간 사진" },
  { value: "VIDEO", label: "공간 동영상" },
  { value: "ROOMPLAN", label: "Apple RoomPlan 결과" },
];

const cloneScene = (scene: SceneDocument): SceneDocument =>
  structuredClone(scene);
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function Plan2D({
  scene,
  materials,
  selectedId,
  onSelect,
  onMove,
}: {
  scene: SceneDocument;
  materials: SurfaceMaterial[];
  selectedId?: string;
  onSelect: (id?: string) => void;
  onMove: (x: number, z: number) => void;
}) {
  const room = scene.structure.rooms[0];
  const width = 800;
  const height = 520;
  const scale = Math.min(650 / room.width, 390 / room.depth);
  const roomW = room.width * scale;
  const roomH = room.depth * scale;
  const left = (width - roomW) / 2;
  const top = (height - roomH) / 2;
  const floorMaterial = materials.find(
    (item) => item.id === room.floor_material_id,
  );
  const clickFloor = (event: MouseEvent<SVGSVGElement>) => {
    if (!selectedId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) * width) / rect.width;
    const py = ((event.clientY - rect.top) * height) / rect.height;
    onMove(
      clamp((px - width / 2) / scale, -room.width / 2, room.width / 2),
      clamp((py - height / 2) / scale, -room.depth / 2, room.depth / 2),
    );
  };
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-full min-h-[420px] w-full select-none"
      onClick={clickFloor}
      role="img"
      aria-label="2D 평면도"
    >
      <defs>
        <pattern
          id="plan-grid"
          width={scale / 2}
          height={scale / 2}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M ${scale / 2} 0 L 0 0 0 ${scale / 2}`}
            fill="none"
            stroke="#dfe5df"
            strokeWidth="1"
          />
        </pattern>
        {floorMaterial?.albedo_url && (
          <pattern
            id="floor-texture-2d"
            width="100"
            height="100"
            patternUnits="userSpaceOnUse"
          >
            <image
              href={mediaUrl(floorMaterial.albedo_url)}
              width="100"
              height="100"
              preserveAspectRatio="xMidYMid slice"
            />
          </pattern>
        )}
      </defs>
      <rect width={width} height={height} fill="#f8faf8" rx="18" />
      <rect
        x={left}
        y={top}
        width={roomW}
        height={roomH}
        fill={
          floorMaterial
            ? "url(#floor-texture-2d)"
            : room.floor_color || "#d8c7ad"
        }
        opacity=".72"
      />
      <rect
        x={left}
        y={top}
        width={roomW}
        height={roomH}
        fill="url(#plan-grid)"
      />
      <rect
        x={left}
        y={top}
        width={roomW}
        height={roomH}
        fill="none"
        stroke="#263b31"
        strokeWidth="10"
      />
      <g fill="#52645a" fontSize="13" fontWeight="700">
        <text x={width / 2} y={top - 22} textAnchor="middle">
          {room.width.toFixed(2)} m
        </text>
        <text
          x={left - 25}
          y={height / 2}
          textAnchor="middle"
          transform={`rotate(-90 ${left - 25} ${height / 2})`}
        >
          {room.depth.toFixed(2)} m
        </text>
      </g>
      {scene.placements.map((item) => {
        const x = width / 2 + item.position.x * scale;
        const y = height / 2 + item.position.z * scale;
        const w = item.size.width * scale;
        const h = item.size.depth * scale;
        const selected = item.id === selectedId;
        return (
          <g
            key={item.id}
            transform={`translate(${x} ${y}) rotate(${item.rotation})`}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(item.id);
            }}
            className="cursor-move"
          >
            <rect
              x={-w / 2}
              y={-h / 2}
              width={w}
              height={h}
              rx="5"
              fill={item.color}
              stroke={selected ? "#e08a2e" : "#32493d"}
              strokeWidth={selected ? 4 : 2}
            />
            <line
              x1="0"
              y1={-h / 2}
              x2="0"
              y2={-h / 2 - 10}
              stroke={selected ? "#e08a2e" : "#32493d"}
              strokeWidth="2"
            />
            <text
              y="4"
              textAnchor="middle"
              fill="white"
              fontSize={Math.max(9, Math.min(13, w / 7))}
              fontWeight="700"
              transform={`rotate(${-item.rotation})`}
            >
              {item.name}
            </text>
          </g>
        );
      })}
      {!scene.placements.length && (
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          fill="#77857d"
          fontSize="15"
        >
          왼쪽 목록에서 가구를 추가해 보세요
        </text>
      )}
      {selectedId && (
        <text
          x={width / 2}
          y={height - 16}
          textAnchor="middle"
          fill="#6f7f76"
          fontSize="12"
        >
          평면의 원하는 곳을 클릭하면 선택한 가구가 이동합니다
        </text>
      )}
    </svg>
  );
}

type Point = { x: number; y: number };
const points = (items: Point[]) =>
  items.map((point) => `${point.x},${point.y}`).join(" ");

function Scene3D({
  scene,
  materials,
  selectedId,
  onSelect,
}: {
  scene: SceneDocument;
  materials: SurfaceMaterial[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const room = scene.structure.rooms[0];
  const unit = Math.min(72, 320 / Math.max(room.width, room.depth));
  const iso = (x: number, z: number, y = 0): Point => ({
    x: 430 + (x - z) * unit * 0.72,
    y: 370 + (x + z) * unit * 0.34 - y * unit,
  });
  const x0 = -room.width / 2,
    x1 = room.width / 2,
    z0 = -room.depth / 2,
    z1 = room.depth / 2;
  const floor = [iso(x0, z0), iso(x1, z0), iso(x1, z1), iso(x0, z1)];
  const backWall = [
    iso(x0, z0),
    iso(x1, z0),
    iso(x1, z0, room.height),
    iso(x0, z0, room.height),
  ];
  const sideWall = [
    iso(x0, z0),
    iso(x0, z1),
    iso(x0, z1, room.height),
    iso(x0, z0, room.height),
  ];
  const floorMaterial = materials.find(
    (item) => item.id === room.floor_material_id,
  );
  const wallMaterial = materials.find(
    (item) => item.id === room.wall_material_id,
  );
  const cuboid = (item: ScenePlacement) => {
    const angle = (item.rotation * Math.PI) / 180;
    const hw = item.size.width / 2,
      hd = item.size.depth / 2;
    const rotate = (x: number, z: number) => ({
      x: item.position.x + x * Math.cos(angle) - z * Math.sin(angle),
      z: item.position.z + x * Math.sin(angle) + z * Math.cos(angle),
    });
    const corners = [
      rotate(-hw, -hd),
      rotate(hw, -hd),
      rotate(hw, hd),
      rotate(-hw, hd),
    ];
    const bottom = corners.map((p) => iso(p.x, p.z));
    const top = corners.map((p) => iso(p.x, p.z, item.size.height));
    return { bottom, top };
  };
  return (
    <svg
      viewBox="0 0 860 540"
      className="h-full min-h-[420px] w-full"
      role="img"
      aria-label="3D 공간 미리보기"
    >
      <defs>
        {floorMaterial?.albedo_url && (
          <pattern
            id="floor-texture-3d"
            width="100"
            height="100"
            patternUnits="userSpaceOnUse"
          >
            <image
              href={mediaUrl(floorMaterial.albedo_url)}
              width="100"
              height="100"
              preserveAspectRatio="xMidYMid slice"
            />
          </pattern>
        )}
        {wallMaterial?.albedo_url && (
          <pattern
            id="wall-texture-3d"
            width="100"
            height="100"
            patternUnits="userSpaceOnUse"
          >
            <image
              href={mediaUrl(wallMaterial.albedo_url)}
              width="100"
              height="100"
              preserveAspectRatio="xMidYMid slice"
            />
          </pattern>
        )}
        <filter id="shadow">
          <feDropShadow dx="0" dy="5" stdDeviation="5" floodOpacity=".17" />
        </filter>
      </defs>
      <rect width="860" height="540" rx="18" fill="#eef3ef" />
      <ellipse
        cx="430"
        cy="417"
        rx="320"
        ry="70"
        fill="#cfd9d1"
        opacity=".48"
      />
      <polygon
        points={points(backWall)}
        fill={
          wallMaterial ? "url(#wall-texture-3d)" : room.wall_color || "#f3f0e9"
        }
        stroke="#8e9c93"
      />
      <polygon
        points={points(sideWall)}
        fill={
          wallMaterial ? "url(#wall-texture-3d)" : room.wall_color || "#e4e2dc"
        }
        stroke="#829188"
        opacity=".9"
      />
      <polygon
        points={points(floor)}
        fill={
          floorMaterial
            ? "url(#floor-texture-3d)"
            : room.floor_color || "#d8c7ad"
        }
        stroke="#718078"
        strokeWidth="2"
      />
      {[...scene.placements]
        .sort(
          (a, b) => a.position.x + a.position.z - b.position.x - b.position.z,
        )
        .map((item) => {
          const { bottom, top } = cuboid(item);
          const selected = selectedId === item.id;
          return (
            <g
              key={item.id}
              onClick={() => onSelect(item.id)}
              className="cursor-pointer"
              filter="url(#shadow)"
            >
              <polygon
                points={points([bottom[1], bottom[2], top[2], top[1]])}
                fill={item.color}
                opacity=".78"
                stroke={selected ? "#e18325" : "#4d6257"}
                strokeWidth={selected ? 4 : 1}
              />
              <polygon
                points={points([bottom[2], bottom[3], top[3], top[2]])}
                fill={item.color}
                opacity=".62"
                stroke={selected ? "#e18325" : "#4d6257"}
                strokeWidth={selected ? 4 : 1}
              />
              <polygon
                points={points(top)}
                fill={item.color}
                stroke={selected ? "#e18325" : "#4d6257"}
                strokeWidth={selected ? 4 : 1}
              />
              <text
                x={top.reduce((sum, p) => sum + p.x, 0) / 4}
                y={top.reduce((sum, p) => sum + p.y, 0) / 4 + 4}
                textAnchor="middle"
                fill="white"
                fontSize="11"
                fontWeight="700"
              >
                {item.name}
              </text>
            </g>
          );
        })}
      <g transform="translate(742 445)" fontSize="10" fontWeight="700">
        <line x1="0" y1="0" x2="40" y2="19" stroke="#cc695f" strokeWidth="3" />
        <text x="46" y="24" fill="#9a4f48">
          X
        </text>
        <line x1="0" y1="0" x2="-40" y2="19" stroke="#4d7ab0" strokeWidth="3" />
        <text x="-52" y="24" fill="#3f6898">
          Z
        </text>
        <line x1="0" y1="0" x2="0" y2="-40" stroke="#4d8f60" strokeWidth="3" />
        <text x="5" y="-35" fill="#3d774e">
          Y
        </text>
      </g>
    </svg>
  );
}

export default function SimulationWorkspace({
  projectId,
}: {
  projectId: string;
}) {
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [simulation, setSimulation] = useState<Simulation>();
  const [version, setVersion] = useState<SimulationVersion>();
  const [scene, setScene] = useState<SceneDocument>();
  const [materials, setMaterials] = useState<SurfaceMaterial[]>([]);
  const [scans, setScans] = useState<SpaceScan[]>([]);
  const [view, setView] = useState<"2d" | "3d">("2d");
  const [panel, setPanel] = useState<
    "space" | "furniture" | "materials" | "ai"
  >("space");
  const [selectedId, setSelectedId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [materialForm, setMaterialForm] = useState({
    name: "",
    material_type: "WALLPAPER" as MaterialType,
    real_width: 1,
    real_height: 1,
    seamless: true,
  });
  const [materialFile, setMaterialFile] = useState<File>();
  const [scanFiles, setScanFiles] = useState<File[]>([]);
  const [furnitureFiles, setFurnitureFiles] = useState<File[]>([]);
  const [scanSource, setScanSource] = useState<"PHOTOS" | "VIDEO" | "ROOMPLAN">(
    "PHOTOS",
  );
  const materialInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [items, materialItems] = await Promise.all([
        api.simulations(projectId),
        api.materials(projectId),
      ]);
      setSimulations(items);
      setMaterials(materialItems);
      if (items.length) chooseSimulation(items[0]);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "시뮬레이션을 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [projectId]);
  useEffect(() => {
    if (simulation)
      api
        .scans(simulation.id)
        .then(setScans)
        .catch(() => undefined);
  }, [simulation?.id]);

  const chooseSimulation = (item: Simulation) => {
    const current =
      item.versions.find(
        (candidate) => candidate.id === item.current_version_id,
      ) || item.versions.at(-1);
    setSimulation(item);
    setVersion(current);
    setScene(current ? cloneScene(current.scene_json) : undefined);
    setDirty(false);
    setSelectedId(undefined);
  };
  const changeScene = (updater: (draft: SceneDocument) => void) => {
    setScene((current) => {
      if (!current) return current;
      const next = cloneScene(current);
      updater(next);
      return next;
    });
    setDirty(true);
    setNotice("");
  };
  const room = scene?.structure.rooms[0];
  const selected = scene?.placements.find((item) => item.id === selectedId);
  const isCurrent = Boolean(
    version && simulation && version.id === simulation.current_version_id,
  );

  const createSimulation = async () => {
    setSaving(true);
    setError("");
    try {
      const item = await api.createSimulation(projectId);
      setSimulations((current) => [item, ...current]);
      chooseSimulation(item);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "시뮬레이션을 만들지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  };
  const save = async () => {
    if (!scene || !version || !simulation || !isCurrent) return;
    setSaving(true);
    setError("");
    try {
      const updated = await api.saveScene(version.id, scene);
      const next = {
        ...simulation,
        versions: simulation.versions.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      };
      setSimulation(next);
      setSimulations((items) =>
        items.map((item) => (item.id === next.id ? next : item)),
      );
      setVersion(updated);
      setDirty(false);
      setNotice("현재 버전에 저장했습니다.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "저장하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  };
  const saveAsVersion = async () => {
    if (!scene || !simulation) return;
    setSaving(true);
    setError("");
    try {
      const created = await api.createSimulationVersion(simulation.id, scene);
      const next = {
        ...simulation,
        current_version_id: created.id,
        versions: [...simulation.versions, created],
      };
      setSimulation(next);
      setSimulations((items) =>
        items.map((item) => (item.id === next.id ? next : item)),
      );
      setVersion(created);
      setDirty(false);
      setNotice(`버전 ${created.version}으로 저장했습니다.`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "새 버전을 만들지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  };
  const verify = async () => {
    if (!version || !simulation || dirty) return;
    setSaving(true);
    try {
      const updated = await api.verifySimulationVersion(version.id);
      const next = {
        ...simulation,
        versions: simulation.versions.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      };
      setSimulation(next);
      setSimulations((items) =>
        items.map((item) => (item.id === next.id ? next : item)),
      );
      setVersion(updated);
      setNotice("치수를 확인한 버전으로 표시했습니다.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "확인 처리하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  };
  const addFurniture = (catalog: (typeof furnitureCatalog)[number]) => {
    const item: ScenePlacement = {
      id: crypto.randomUUID(),
      name: catalog.name,
      category: catalog.category,
      position: { x: 0, z: 0 },
      size: {
        width: catalog.size[0],
        depth: catalog.size[1],
        height: catalog.size[2],
      },
      rotation: 0,
      color: catalog.color,
    };
    changeScene((draft) => {
      draft.placements.push(item);
    });
    setSelectedId(item.id);
  };
  const uploadMaterial = async () => {
    if (!materialFile || !materialForm.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const created = await api.uploadMaterial(
        projectId,
        materialFile,
        materialForm,
      );
      setMaterials((items) => [created, ...items]);
      setMaterialFile(undefined);
      setMaterialForm((current) => ({ ...current, name: "" }));
      if (materialInput.current) materialInput.current.value = "";
      setNotice("재질을 라이브러리에 추가했습니다.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "재질을 업로드하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  };
  const uploadScan = async () => {
    if (!simulation || !scanFiles.length) return;
    setSaving(true);
    setError("");
    try {
      const scan = await api.uploadScan(simulation.id, scanSource, scanFiles);
      setScans((items) => [scan, ...items]);
      setScanFiles([]);
      await api.processScan(scan.id);
      setScans((items) =>
        items.map((item) =>
          item.id === scan.id ? { ...item, status: "QUEUED" } : item,
        ),
      );
      setNotice("파일 업로드가 끝났으며 AI 공간 분석 대기열에 등록했습니다.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "분석 파일을 등록하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  };
  const generateFurniture = async () => {
    if (!furnitureFiles.length) return;
    setSaving(true);
    setError("");
    try {
      await api.generateFurnitureFromFiles(projectId, furnitureFiles);
      setFurnitureFiles([]);
      setNotice("가구 사진을 업로드하고 3D 모델 생성 대기열에 등록했습니다.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "가구 생성 작업을 등록하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="panel flex min-h-64 items-center justify-center text-sm text-[#718078]">
        <LoaderCircle className="mr-2 animate-spin" size={18} />
        시뮬레이션을 준비하는 중입니다…
      </div>
    );
  if (!simulation || !scene || !room || !version)
    return (
      <div className="panel flex min-h-[420px] flex-col items-center justify-center p-8 text-center">
        <div className="rounded-3xl bg-[#edf4ef] p-5 text-[#3d7650]">
          <Cuboid size={38} />
        </div>
        <h3 className="mt-5 text-xl font-bold text-[#243b2f]">
          첫 공간을 만들어 보세요
        </h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-[#7c8981]">
          방 치수를 입력하면 같은 설계가 2D 평면도와 3D 공간으로 동시에
          만들어집니다.
        </p>
        <button
          className="btn-primary mt-6"
          onClick={createSimulation}
          disabled={saving}
        >
          <Plus size={16} />
          시뮬레이션 만들기
        </button>
        {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="panel flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl bg-[#e9f2eb] p-2.5 text-[#386d49]">
            <Layers3 size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-[#294534]">{simulation.name}</h3>
              {version.verified_at && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                  <CheckCircle2 size={12} />
                  치수 확인
                </span>
              )}
              {dirty && (
                <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">
                  저장 전 변경
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-[#87938b]">
              버전 {version.version} · {scene.placements.length}개 가구
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownSelect
            className="w-full sm:w-auto sm:min-w-32"
            value={version.id}
            options={[...simulation.versions].reverse().map((item) => ({
              value: item.id,
              label: `버전 ${item.version}${
                item.id === simulation.current_version_id ? " (현재)" : ""
              }`,
            }))}
            compact
            ariaLabel="시뮬레이션 버전"
            onChange={(value) => {
              const target = simulation.versions.find(
                (item) => item.id === value,
              );
              if (target) {
                setVersion(target);
                setScene(cloneScene(target.scene_json));
                setDirty(false);
                setSelectedId(undefined);
              }
            }}
          />
          <button
            className="btn-secondary flex-1 sm:flex-none"
            onClick={saveAsVersion}
            disabled={saving}
          >
            <CopyPlus size={15} />
            {isCurrent ? "새 버전" : "이 버전 복원"}
          </button>
          <button
            className="btn-secondary flex-1 sm:flex-none"
            onClick={verify}
            disabled={saving || dirty || Boolean(version.verified_at)}
          >
            <Check size={15} />
            치수 확인
          </button>
          <button
            className="btn-primary flex-1 sm:flex-none"
            onClick={save}
            disabled={saving || !dirty || !isCurrent}
          >
            <Save size={15} />
            {saving ? "처리 중…" : "저장"}
          </button>
        </div>
      </div>
      {(error || notice) && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${error ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}
        >
          {error || notice}
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="panel overflow-hidden">
          <div className="grid grid-cols-4 border-b border-[#e9ede9] bg-[#f9faf9]">
            {(
              [
                ["space", Grid2X2, "공간"],
                ["furniture", Box, "가구"],
                ["materials", ImagePlus, "재질"],
                ["ai", Sparkles, "AI"],
              ] as const
            ).map(([key, Icon, label]) => (
              <button
                key={key}
                onClick={() => setPanel(key)}
                className={`flex flex-col items-center gap-1 px-1 py-3 text-[11px] font-bold ${panel === key ? "bg-white text-[#326444]" : "text-[#8b978f] hover:text-[#52675a]"}`}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
          </div>
          <div className="max-h-[660px] space-y-5 overflow-y-auto p-4">
            {panel === "space" && (
              <>
                <div>
                  <p className="label">공간 이름</p>
                  <input
                    className="field"
                    value={room.name}
                    onChange={(e) =>
                      changeScene((draft) => {
                        draft.structure.rooms[0].name = e.target.value;
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      ["width", "가로 (m)"],
                      ["depth", "세로 (m)"],
                      ["height", "높이 (m)"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key}>
                      <span className="label">{label}</span>
                      <input
                        className="field"
                        type="number"
                        min="0.5"
                        max="100"
                        step="0.1"
                        value={room[key]}
                        onChange={(e) =>
                          changeScene((draft) => {
                            draft.structure.rooms[0][key] = clamp(
                              Number(e.target.value),
                              0.5,
                              100,
                            );
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                <div className="border-t border-[#edf0ed] pt-4">
                  <p className="label">기본 색상</p>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-xs text-[#718078]">
                      바닥
                      <input
                        className="mt-1 h-10 w-full rounded-lg border border-[#dfe5df] p-1"
                        type="color"
                        value={room.floor_color || "#d8c7ad"}
                        onChange={(e) =>
                          changeScene((draft) => {
                            draft.structure.rooms[0].floor_color =
                              e.target.value;
                            draft.structure.rooms[0].floor_material_id = null;
                          })
                        }
                      />
                    </label>
                    <label className="text-xs text-[#718078]">
                      벽
                      <input
                        className="mt-1 h-10 w-full rounded-lg border border-[#dfe5df] p-1"
                        type="color"
                        value={room.wall_color || "#f3f0e9"}
                        onChange={(e) =>
                          changeScene((draft) => {
                            draft.structure.rooms[0].wall_color =
                              e.target.value;
                            draft.structure.rooms[0].wall_material_id = null;
                          })
                        }
                      />
                    </label>
                  </div>
                </div>
              </>
            )}
            {panel === "furniture" && (
              <>
                <div>
                  <p className="label">가구 카탈로그</p>
                  <div className="grid grid-cols-2 gap-2">
                    {furnitureCatalog.map((item) => (
                      <button
                        key={item.name}
                        className="rounded-xl border border-[#e2e7e2] p-3 text-left transition hover:border-[#82a08c] hover:bg-[#f3f7f3]"
                        onClick={() => addFurniture(item)}
                      >
                        <span
                          className="mb-2 block h-5 w-5 rounded"
                          style={{ background: item.color }}
                        />
                        <span className="text-xs font-bold text-[#3f5649]">
                          {item.name}
                        </span>
                        <span className="mt-1 block text-[10px] text-[#929d96]">
                          {item.size[0]} × {item.size[1]}m
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                {selected ? (
                  <div className="space-y-3 border-t border-[#edf0ed] pt-4">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-sm text-[#385040]">
                        {selected.name}
                      </p>
                      <button
                        className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                        onClick={() => {
                          changeScene((draft) => {
                            draft.placements = draft.placements.filter(
                              (item) => item.id !== selected.id,
                            );
                          });
                          setSelectedId(undefined);
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label>
                        <span className="label">X 위치</span>
                        <input
                          className="field py-2"
                          type="number"
                          step="0.1"
                          value={selected.position.x}
                          onChange={(e) =>
                            changeScene((draft) => {
                              const item = draft.placements.find(
                                (p) => p.id === selected.id,
                              );
                              if (item)
                                item.position.x = Number(e.target.value);
                            })
                          }
                        />
                      </label>
                      <label>
                        <span className="label">Z 위치</span>
                        <input
                          className="field py-2"
                          type="number"
                          step="0.1"
                          value={selected.position.z}
                          onChange={(e) =>
                            changeScene((draft) => {
                              const item = draft.placements.find(
                                (p) => p.id === selected.id,
                              );
                              if (item)
                                item.position.z = Number(e.target.value);
                            })
                          }
                        />
                      </label>
                    </div>
                    <label>
                      <span className="label flex items-center gap-1">
                        <RotateCw size={12} />
                        회전 {selected.rotation}°
                      </span>
                      <input
                        className="w-full accent-[#3d7650]"
                        type="range"
                        min="0"
                        max="345"
                        step="15"
                        value={selected.rotation}
                        onChange={(e) =>
                          changeScene((draft) => {
                            const item = draft.placements.find(
                              (p) => p.id === selected.id,
                            );
                            if (item) item.rotation = Number(e.target.value);
                          })
                        }
                      />
                    </label>
                  </div>
                ) : (
                  <p className="rounded-xl bg-[#f5f7f5] p-3 text-xs leading-5 text-[#7d8981]">
                    가구를 추가하거나 도면에서 선택하면 위치와 회전을 조정할 수
                    있습니다.
                  </p>
                )}
              </>
            )}
            {panel === "materials" && (
              <>
                <div>
                  <p className="label">등록된 재질</p>
                  <div className="space-y-2">
                    {materials.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-[#e4e9e4] p-2"
                      >
                        <div className="flex items-center gap-2">
                          {item.albedo_url ? (
                            <img
                              src={mediaUrl(item.albedo_url)}
                              className="h-10 w-10 rounded-lg object-cover"
                            />
                          ) : (
                            <span className="h-10 w-10 rounded-lg bg-[#e8e6df]" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold text-[#3c5245]">
                              {item.name}
                            </p>
                            <p className="text-[10px] text-[#8b978f]">
                              {materialLabels[item.material_type]} ·{" "}
                              {item.real_width}×{item.real_height}m
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-1">
                          <button
                            className={`rounded-lg px-2 py-1.5 text-[10px] font-bold ${room.floor_material_id === item.id ? "bg-[#2e6542] text-white" : "bg-[#f1f4f1] text-[#5e7065]"}`}
                            onClick={() =>
                              changeScene((draft) => {
                                draft.structure.rooms[0].floor_material_id =
                                  item.id;
                              })
                            }
                          >
                            바닥 적용
                          </button>
                          <button
                            className={`rounded-lg px-2 py-1.5 text-[10px] font-bold ${room.wall_material_id === item.id ? "bg-[#2e6542] text-white" : "bg-[#f1f4f1] text-[#5e7065]"}`}
                            onClick={() =>
                              changeScene((draft) => {
                                draft.structure.rooms[0].wall_material_id =
                                  item.id;
                              })
                            }
                          >
                            벽 적용
                          </button>
                        </div>
                      </div>
                    ))}
                    {!materials.length && (
                      <p className="text-xs text-[#8b978f]">
                        아직 등록된 재질이 없습니다.
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-2 border-t border-[#edf0ed] pt-4">
                  <p className="text-sm font-bold text-[#3b5244]">
                    사진으로 재질 추가
                  </p>
                  <input
                    ref={materialInput}
                    type="file"
                    accept="image/*"
                    className="field p-2 text-xs"
                    onChange={(e) => setMaterialFile(e.target.files?.[0])}
                  />
                  <input
                    className="field py-2"
                    placeholder="재질명"
                    value={materialForm.name}
                    onChange={(e) =>
                      setMaterialForm({ ...materialForm, name: e.target.value })
                    }
                  />
                  <DropdownSelect
                    value={materialForm.material_type}
                    options={materialTypeOptions}
                    ariaLabel="재질 유형"
                    onChange={(value) =>
                      setMaterialForm({
                        ...materialForm,
                        material_type: value as MaterialType,
                      })
                    }
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="field py-2"
                      type="number"
                      step="0.1"
                      min="0.01"
                      value={materialForm.real_width}
                      onChange={(e) =>
                        setMaterialForm({
                          ...materialForm,
                          real_width: Number(e.target.value),
                        })
                      }
                    />
                    <input
                      className="field py-2"
                      type="number"
                      step="0.1"
                      min="0.01"
                      value={materialForm.real_height}
                      onChange={(e) =>
                        setMaterialForm({
                          ...materialForm,
                          real_height: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <p className="text-[10px] text-[#8b978f]">
                    실제 가로 × 세로 크기(m)
                  </p>
                  <button
                    className="btn-primary w-full"
                    disabled={!materialFile || !materialForm.name || saving}
                    onClick={uploadMaterial}
                  >
                    <Upload size={14} />
                    재질 등록
                  </button>
                </div>
              </>
            )}
            {panel === "ai" && (
              <>
                <div className="rounded-xl bg-[#eef5f0] p-3">
                  <div className="flex items-center gap-2 font-bold text-sm text-[#345a40]">
                    <ScanLine size={17} />
                    사진·영상 공간 분석
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#6e7d74]">
                    방을 겹치게 촬영한 사진이나 천천히 한 바퀴 촬영한 영상을
                    등록합니다. RoomPlan 결과 파일도 받을 수 있습니다.
                  </p>
                </div>
                <DropdownSelect
                  value={scanSource}
                  options={scanSourceOptions}
                  ariaLabel="공간 분석 자료 유형"
                  onChange={(value) =>
                    setScanSource(value as typeof scanSource)
                  }
                />
                <input
                  className="field p-2 text-xs"
                  type="file"
                  multiple={scanSource === "PHOTOS"}
                  accept={
                    scanSource === "VIDEO"
                      ? "video/*"
                      : scanSource === "PHOTOS"
                        ? "image/*"
                        : ".json,.usdz,model/vnd.usdz+zip"
                  }
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setScanFiles(Array.from(e.target.files || []))
                  }
                />
                <button
                  className="btn-primary w-full"
                  onClick={uploadScan}
                  disabled={!scanFiles.length || saving}
                >
                  <Sparkles size={15} />
                  {saving
                    ? "등록 중…"
                    : `${scanFiles.length || ""} AI 분석 등록`}
                </button>
                <div className="border-t border-[#edf0ed] pt-4">
                  <p className="label">최근 분석 작업</p>
                  <div className="space-y-2">
                    {scans.map((scan) => (
                      <div
                        key={scan.id}
                        className="flex items-center justify-between rounded-lg bg-[#f6f8f6] px-3 py-2"
                      >
                        <span className="text-xs font-semibold text-[#52645a]">
                          {scan.source_type}
                        </span>
                        <span
                          className={`flex items-center gap-1 text-[10px] font-bold ${scan.status === "FAILED" ? "text-rose-600" : scan.status === "COMPLETE" ? "text-emerald-600" : "text-amber-600"}`}
                        >
                          <Clock3 size={11} />
                          {scan.status}
                        </span>
                      </div>
                    ))}
                    {!scans.length && (
                      <p className="text-xs text-[#929d96]">
                        등록된 분석 작업이 없습니다.
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-2 rounded-xl border border-dashed border-[#d7dfd8] p-3 text-xs leading-5 text-[#78857d]">
                  <b className="text-[#4f6356]">가구 사진으로 3D 생성</b>
                  <p>
                    가구의 정면·측면·후면 사진을 올리면 생성 작업 대기열에
                    등록합니다.
                  </p>
                  <input
                    className="field p-2 text-xs"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) =>
                      setFurnitureFiles(Array.from(event.target.files || []))
                    }
                  />
                  <button
                    className="btn-secondary w-full"
                    onClick={generateFurniture}
                    disabled={!furnitureFiles.length || saving}
                  >
                    <Cuboid size={14} />
                    {furnitureFiles.length
                      ? `${furnitureFiles.length}장으로 생성 요청`
                      : "가구 사진 선택"}
                  </button>
                  <p className="text-[10px] text-[#929d96]">
                    실제 모델 생성 완료에는 외부 AI 공급자 연결이 필요합니다.
                  </p>
                </div>
              </>
            )}
          </div>
        </aside>
        <section className="panel min-w-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#e8ece8] p-3">
            <div className="flex rounded-xl bg-[#eef2ef] p-1">
              <button
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold ${view === "2d" ? "bg-white text-[#315f40] shadow-sm" : "text-[#7d8a82]"}`}
                onClick={() => setView("2d")}
              >
                <Grid2X2 size={15} />
                2D 평면도
              </button>
              <button
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold ${view === "3d" ? "bg-white text-[#315f40] shadow-sm" : "text-[#7d8a82]"}`}
                onClick={() => setView("3d")}
              >
                <Cuboid size={15} />
                3D 공간
              </button>
            </div>
            <span className="hidden items-center gap-1 text-xs text-[#89958d] sm:flex">
              <Move size={13} />
              {view === "2d"
                ? "가구 선택 후 평면을 클릭해 이동"
                : "가구를 클릭해 선택"}
            </span>
          </div>
          <div className="bg-[#f8faf8] p-2 sm:p-4">
            {view === "2d" ? (
              <Plan2D
                scene={scene}
                materials={materials}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onMove={(x, z) =>
                  selected &&
                  changeScene((draft) => {
                    const item = draft.placements.find(
                      (p) => p.id === selected.id,
                    );
                    if (item)
                      item.position = {
                        x: Number(x.toFixed(2)),
                        z: Number(z.toFixed(2)),
                      };
                  })
                }
              />
            ) : (
              <Scene3D
                scene={scene}
                materials={materials}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
