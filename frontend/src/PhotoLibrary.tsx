import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Camera,
  Eye,
  EyeOff,
  ImageIcon,
  MapPin,
  Maximize2,
  RotateCcw,
  Search,
  Star,
} from "lucide-react";
import { api, mediaUrl } from "./api";
import DropdownSelect, { type DropdownOption } from "./DropdownSelect";
import PhotoClassificationEditor from "./PhotoClassificationEditor";
import PhotoViewerModal from "./PhotoViewerModal";
import Pagination from "./Pagination";
import type { AdminImage, AdminImageList, ProjectListItem } from "./types";
import { showSuccessToast } from "./Toast";

const classificationPresets = [
  "거실",
  "주방",
  "싱크대",
  "도배",
  "욕실",
  "침실",
  "현관",
  "베란다",
  "붙박이장",
  "바닥",
  "조명",
];

type PhotoView = "projects" | "all";
type VisibilityFilter = "" | "public" | "private";
const photoPageSize = (view: PhotoView) => (view === "projects" ? 2 : 8);

function PhotoCard({
  image,
  classificationOptions,
  saving,
  onUpdate,
  onPreview,
  onOpenProject,
}: {
  image: AdminImage;
  classificationOptions: string[];
  saving: boolean;
  onUpdate: (
    image: AdminImage,
    values: Record<string, unknown>,
  ) => Promise<void>;
  onPreview: (image: AdminImage) => void;
  onOpenProject: (projectId: string) => void;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-[#d5dfd7] bg-white shadow-[0_8px_24px_rgba(24,55,43,.09)]">
      <div className="group relative aspect-[4/3] bg-[#edf2ed]">
        <button
          type="button"
          className="h-full w-full cursor-zoom-in overflow-hidden text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#628b72]"
          onClick={() => onPreview(image)}
          aria-label={`${image.project_title} 사진 크게 보기`}
        >
          <img
            src={mediaUrl(image.thumbnail_url)}
            alt={`${image.project_title} ${image.classification || "현장"} 사진`}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]"
          />
          <span className="absolute bottom-2.5 right-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-black/55 text-white opacity-100 shadow-sm backdrop-blur-sm transition sm:opacity-0 sm:group-hover:opacity-100">
            <Maximize2 size={15} />
          </span>
        </button>
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
          {image.is_cover && (
            <span className="flex items-center gap-1 rounded-lg border border-white/30 bg-[rgba(39,91,57,0.92)] px-2 py-1 text-[10px] font-bold text-white shadow-[0_2px_8px_rgba(16,38,25,.28)] backdrop-blur-sm">
              <Star size={11} fill="currentColor" /> 대표
            </span>
          )}
          {image.classification && (
            <span className="rounded-lg border border-white/70 bg-[rgba(255,255,255,0.94)] px-2 py-1 text-[10px] font-bold text-[#294534] shadow-[0_2px_8px_rgba(16,38,25,.22)] backdrop-blur-sm">
              {image.classification}
            </span>
          )}
        </div>
        <button
          type="button"
          disabled={saving}
          className={`absolute right-2.5 top-2.5 flex min-h-10 items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold shadow-sm backdrop-blur-sm transition disabled:cursor-wait disabled:opacity-60 ${
            image.is_public
              ? "border border-white/30 bg-[rgba(47,113,72,0.92)] text-white shadow-[0_2px_8px_rgba(16,38,25,.28)] hover:bg-[#2b633e]"
              : "border border-white/25 bg-[rgba(35,48,40,0.88)] text-white shadow-[0_2px_8px_rgba(16,38,25,.30)] hover:bg-[#1f2d25]"
          }`}
          onClick={() => onUpdate(image, { is_public: !image.is_public })}
          aria-label={
            image.is_public ? "사진 비공개로 변경" : "사진 공개로 변경"
          }
        >
          {image.is_public ? <Eye size={12} /> : <EyeOff size={12} />}
          {image.is_public ? "공개" : "비공개"}
        </button>
      </div>
      <div className="border-t border-[#e5ebe6] p-3.5">
        <button
          type="button"
          className="group/title flex w-full items-start justify-between gap-3 text-left"
          onClick={() => onOpenProject(image.project_id)}
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-[#294534]">
              {image.project_title}
            </span>
            <span className="mt-1 flex items-center gap-1 truncate text-[11px] text-[#8a978f]">
              <MapPin size={11} className="shrink-0" />
              <span className="truncate">{image.project_address}</span>
            </span>
          </span>
          <ArrowRight
            size={15}
            className="mt-0.5 shrink-0 text-[#819087] transition-transform group-hover/title:translate-x-0.5"
          />
        </button>
        <div className="mt-3 border-t border-[#edf1ed] pt-3">
          <PhotoClassificationEditor
            value={image.classification || ""}
            options={classificationOptions}
            disabled={saving}
            onSave={(classification) =>
              onUpdate(image, { classification: classification || null })
            }
          />
        </div>
      </div>
    </article>
  );
}

export default function PhotoLibrary({
  onOpenProject,
  onOpenProjectPhotos,
}: {
  onOpenProject: (projectId: string) => void;
  onOpenProjectPhotos: (projectId: string) => void;
}) {
  const [data, setData] = useState<AdminImageList | null>(null);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [view, setView] = useState<PhotoView>("all");
  const [projectId, setProjectId] = useState("");
  const [classification, setClassification] = useState("");
  const [visibility, setVisibility] = useState<VisibilityFilter>("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [savingImageId, setSavingImageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewImage, setPreviewImage] = useState<AdminImage | null>(null);

  useEffect(() => {
    api
      .projects("page_size=100&sort=updated_at")
      .then((result) => setProjects(result.items))
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(photoPageSize(view)),
    });
    if (projectId) params.set("project_id", projectId);
    if (classification) params.set("classification", classification);
    if (visibility)
      params.set("is_public", visibility === "public" ? "true" : "false");
    if (searchQuery) params.set("q", searchQuery);
    setLoading(true);
    setError("");
    api
      .images(`?${params.toString()}`)
      .then(setData)
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "사진 목록을 불러오지 못했습니다.",
        ),
      )
      .finally(() => setLoading(false));
  }, [
    classification,
    page,
    projectId,
    refreshKey,
    searchQuery,
    view,
    visibility,
  ]);

  useEffect(load, [load]);

  const classificationOptions = useMemo(
    () =>
      Array.from(
        new Set([...classificationPresets, ...(data?.classifications || [])]),
      ),
    [data?.classifications],
  );
  const groupedPhotos = useMemo(() => {
    const groups = new Map<
      string,
      { title: string; address: string; images: AdminImage[] }
    >();
    for (const image of data?.items || []) {
      const group = groups.get(image.project_id) || {
        title: image.project_title,
        address: image.project_address,
        images: [],
      };
      group.images.push(image);
      groups.set(image.project_id, group);
    }
    return Array.from(groups.entries());
  }, [data?.items]);

  const projectOptions: DropdownOption[] = [
    { value: "", label: "모든 현장" },
    ...projects.map((project) => ({ value: project.id, label: project.title })),
  ];
  const classificationFilterOptions: DropdownOption[] = [
    { value: "", label: "모든 분류" },
    { value: "__unclassified__", label: "미분류" },
    ...classificationOptions.map((value) => ({ value, label: value })),
  ];
  const visibilityOptions: DropdownOption[] = [
    { value: "", label: "전체 공개 상태" },
    { value: "public", label: "공개 사진" },
    { value: "private", label: "비공개 사진" },
  ];
  const changeFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };
  const resetFilters = () => {
    setProjectId("");
    setClassification("");
    setVisibility("");
    setSearchInput("");
    setSearchQuery("");
    setPage(1);
  };
  const updatePhoto = async (
    image: AdminImage,
    values: Record<string, unknown>,
  ) => {
    setSavingImageId(image.id);
    setError("");
    try {
      await api.updateImage(image.project_id, image.id, values);
      setRefreshKey((current) => current + 1);
      showSuccessToast("사진 정보를 수정했습니다.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "사진 정보를 변경하지 못했습니다.",
      );
    } finally {
      setSavingImageId(null);
    }
  };
  const photoCard = (image: AdminImage) => (
    <PhotoCard
      key={image.id}
      image={image}
      classificationOptions={classificationOptions}
      saving={savingImageId === image.id}
      onUpdate={updatePhoto}
      onPreview={setPreviewImage}
      onOpenProject={onOpenProject}
    />
  );

  return (
    <div className="space-y-5 p-5 sm:p-8">
      {previewImage && (
        <PhotoViewerModal
          imageUrl={mediaUrl(previewImage.original_url)}
          alt={`${previewImage.project_title} ${previewImage.classification || "현장"} 사진`}
          projectTitle={previewImage.project_title}
          classification={previewImage.classification}
          onClose={() => setPreviewImage(null)}
        />
      )}
      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-5 bg-gradient-to-r from-[#edf4ed] to-[#f8faf7] p-5 sm:flex-row sm:items-end sm:justify-between sm:p-7">
          <div>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#487158] shadow-sm">
              <Camera size={19} />
            </span>
            <h2 className="serif mt-4 text-2xl text-[#20382a]">
              현장 사진 모아보기
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-[#748379]">
              모든 현장의 사진을 한곳에서 찾고 분류와 공개 상태를 관리하세요.
            </p>
          </div>
          <div className="flex rounded-xl border border-[#d6e1d8] bg-white p-1 shadow-sm">
            {[
              ["all", "전체 사진"],
              ["projects", "현장별 보기"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`min-h-11 rounded-lg px-3.5 py-2 text-xs font-bold transition sm:px-4 ${
                  view === value
                    ? "bg-[#294c35] text-white shadow-sm"
                    : "text-[#718078] hover:bg-[#f2f6f2]"
                }`}
                onClick={() => {
                  setView(value as PhotoView);
                  setPage(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="border-t border-[#e4ebe5] p-4 sm:p-5">
          <form
            className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-[minmax(210px,1fr)_minmax(160px,.7fr)_minmax(160px,.7fr)_minmax(220px,1fr)_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setSearchQuery(searchInput.trim());
            }}
          >
            <DropdownSelect
              value={projectId}
              options={projectOptions}
              onChange={(value) => changeFilter(setProjectId, value)}
              ariaLabel="현장 필터"
            />
            <DropdownSelect
              value={classification}
              options={classificationFilterOptions}
              onChange={(value) => changeFilter(setClassification, value)}
              ariaLabel="사진 분류 필터"
            />
            <DropdownSelect
              value={visibility}
              options={visibilityOptions}
              onChange={(value) =>
                changeFilter(
                  (next) => setVisibility(next as VisibilityFilter),
                  value,
                )
              }
              ariaLabel="공개 상태 필터"
            />
            <div className="relative min-w-0">
              <Search
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#87968d]"
              />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="field h-full pl-10"
                placeholder="현장명·파일명 검색"
                aria-label="사진 검색"
              />
            </div>
            <div className="flex gap-2 sm:col-span-2 xl:col-span-1">
              <button type="submit" className="btn-primary flex-1">
                <Search size={15} /> 검색
              </button>
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={resetFilters}
                disabled={
                  !projectId &&
                  !classification &&
                  !visibility &&
                  !searchInput &&
                  !searchQuery &&
                  page === 1
                }
              >
                <RotateCcw size={15} /> 초기화
              </button>
            </div>
          </form>
        </div>
      </section>

      {error && (
        <p className="rounded-xl border border-[#f0d4d1] bg-[#fff1ef] px-4 py-3 text-sm text-[#a14e4e]">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-sm font-semibold text-[#52665a]">
          총 <span className="text-[#2d6641]">{data?.total || 0}</span>장의 사진
        </p>
        {loading && (
          <span className="text-xs font-medium text-[#87958c]">
            불러오는 중…
          </span>
        )}
      </div>

      {!loading && !data?.items.length ? (
        <section className="panel flex min-h-64 flex-col items-center justify-center p-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf3ed] text-[#76917d]">
            <ImageIcon size={21} />
          </span>
          <h3 className="mt-4 font-bold text-[#344d3d]">
            조건에 맞는 사진이 없습니다
          </h3>
          <p className="mt-1.5 text-sm text-[#89958d]">
            다른 현장이나 분류를 선택해 보세요.
          </p>
        </section>
      ) : view === "projects" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {groupedPhotos.map(([groupProjectId, group]) => (
            <section key={groupProjectId} className="panel p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-bold text-[#294534]">
                      {group.title}
                    </h3>
                    <span className="shrink-0 rounded-full bg-[#edf3ed] px-2 py-1 text-[10px] font-bold text-[#607566]">
                      {group.images.length}장
                    </span>
                  </div>
                  <p className="mt-1 flex items-center gap-1 truncate text-xs text-[#8c9890]">
                    <MapPin size={12} className="shrink-0" />
                    <span className="truncate">{group.address}</span>
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-secondary min-h-11 self-start px-3 py-2 text-xs sm:self-auto"
                  onClick={() => onOpenProjectPhotos(groupProjectId)}
                >
                  현장 사진 열기 <ArrowRight size={14} />
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.images.map(photoCard)}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {(data?.items || []).map(photoCard)}
        </div>
      )}

      <Pagination
        page={page}
        pageSize={data?.page_size || photoPageSize(view)}
        total={data?.total || 0}
        loading={loading}
        onPageChange={setPage}
      />
    </div>
  );
}
