import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  MapPin,
  Ruler,
  X,
} from "lucide-react";
import { api, mediaUrl } from "./api";
import NaverMap from "./NaverMap";
import Pagination from "./Pagination";
import type { PublicProject, PublicProjectListItem } from "./types";

const PUBLIC_PROJECTS_PAGE_SIZE = 3;

const dateText = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
      })
    : "";

const UUID_PATTERN =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";
const projectPathPattern = new RegExp(`^/projects/(${UUID_PATTERN})/?$`);

const projectIdFromPath = () =>
  window.location.pathname.match(projectPathPattern)?.[1];

export default function PublicPortfolio() {
  const initialId = projectIdFromPath();
  const [items, setItems] = useState<PublicProjectListItem[]>([]);
  const [selected, setSelected] = useState<PublicProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState<number | null>(null);

  const openProject = async (id: string, push = true) => {
    setLoading(true);
    setError("");
    try {
      const project = await api.publicProject(id);
      setSelected(project);
      if (push) history.pushState({}, "", `/projects/${id}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "시공 사례를 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  };
  const goList = (push = true) => {
    setSelected(null);
    setLightbox(null);
    if (push) history.pushState({}, "", "/projects");
  };

  useEffect(() => {
    const onPop = () => {
      const id = projectIdFromPath();
      id ? openProject(id, false) : goList(false);
    };
    window.addEventListener("popstate", onPop);
    api
      .publicProjects()
      .then((result) => {
        setItems(result);
        if (initialId) return openProject(initialId, false);
      })
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (lightbox === null) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [lightbox]);

  const marker = useMemo(
    () =>
      selected?.latitude && selected?.longitude
        ? [
            {
              latitude: Number(selected.latitude),
              longitude: Number(selected.longitude),
              title: selected.public_address,
            },
          ]
        : [],
    [selected],
  );
  const visibleItems = items.slice(
    (page - 1) * PUBLIC_PROJECTS_PAGE_SIZE,
    page * PUBLIC_PROJECTS_PAGE_SIZE,
  );

  if (selected)
    return (
      <div className="min-h-screen bg-white text-[#191f28]">
        <header className="sticky top-0 z-20 border-b border-[#244b3b] bg-[#17372b]/95 text-white backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
            <button
              onClick={() => goList()}
              className="flex items-center gap-2 text-sm font-semibold"
            >
              <ArrowLeft size={18} />
              시공 사례
            </button>
            <a href="/" className="text-sm font-bold text-white">
              Jeil Interior
            </a>
          </div>
        </header>
        <main>
          {selected.cover_image && (
            <div className="h-[42vh] min-h-80 w-full bg-[#eef1f3]">
              <img
                src={mediaUrl(selected.cover_image.original_url)}
                alt={`${selected.title} 대표 사진`}
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <div className="mx-auto max-w-5xl px-5 py-10 sm:py-16">
            <p className="text-sm font-semibold text-[#2f7a4b]">
              {selected.public_address}
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-[-.04em] sm:text-5xl">
              {selected.title}
            </h1>
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-[#6b7684]">
              <span className="flex items-center gap-1.5">
                <Building2 size={16} />
                {selected.housing_type || "인테리어"}
              </span>
              {selected.area_pyeong && (
                <span className="flex items-center gap-1.5">
                  <Ruler size={16} />
                  {selected.area_pyeong}평
                </span>
              )}
              <span>{dateText(selected.actual_end_date)}</span>
            </div>
            {selected.description && (
              <p className="mt-10 max-w-3xl whitespace-pre-wrap text-base leading-8 text-[#4e5968]">
                {selected.description}
              </p>
            )}
            {selected.work_scope && (
              <section className="mt-12 rounded-2xl bg-[#f7f8fa] p-6">
                <p className="text-sm font-bold">공사 범위</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#6b7684]">
                  {selected.work_scope}
                </p>
              </section>
            )}
            <section className="mt-14">
              <h2 className="text-2xl font-bold tracking-[-.03em]">
                공간의 변화
              </h2>
              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
                {selected.images.map((image, index) => (
                  <button
                    type="button"
                    key={image.id}
                    onClick={() => setLightbox(index)}
                    className="group relative aspect-square overflow-hidden rounded-2xl bg-[#eef1f3]"
                    aria-label={`${selected.title} ${image.classification || "현장"} 사진 크게 보기`}
                  >
                    <img
                      src={mediaUrl(image.thumbnail_url)}
                      alt={`${selected.title} ${image.classification || "현장"} 사진`}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                    {image.classification && (
                      <span className="absolute bottom-3 left-3 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
                        {image.classification}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>
            <section className="mt-14">
              <div className="mb-5 flex items-center gap-2">
                <MapPin size={20} />
                <h2 className="text-2xl font-bold tracking-[-.03em]">위치</h2>
              </div>
              <p className="mb-4 text-sm text-[#6b7684]">
                {selected.public_address}
              </p>
              <NaverMap
                markers={marker}
                className="h-80 overflow-hidden rounded-2xl"
              />
            </section>
          </div>
        </main>
        {lightbox !== null && selected.images[lightbox] && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="사진 크게 보기"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setLightbox(null);
            }}
          >
            <button
              type="button"
              className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75 sm:right-5 sm:top-5"
              onClick={() => setLightbox(null)}
              aria-label="사진 닫기"
            >
              <X />
            </button>
            <img
              src={mediaUrl(selected.images[lightbox].original_url)}
              alt={`${selected.title} ${selected.images[lightbox].classification || "현장"} 사진`}
              className="max-h-[calc(100dvh-1rem)] max-w-full object-contain sm:max-h-[90vh]"
            />
          </div>
        )}
      </div>
    );

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-[#191f28]">
      <header className="bg-[#17372b] text-white">
        <div className="mx-auto flex max-w-6xl items-center px-5 py-5">
          <a href="/" className="font-bold tracking-[-.02em] text-white">
            Jeil Interior
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-[#2f7a4b]">PORTFOLIO</p>
          <h1 className="mt-3 text-4xl font-bold leading-tight tracking-[-.05em] sm:text-6xl">
            우리가 완성한
            <br />
            공간을 소개합니다.
          </h1>
          <p className="mt-6 text-base leading-7 text-[#6b7684]">
            생활 방식과 취향을 세심하게 담아낸 시공 사례를 만나보세요.
          </p>
        </div>
        {error && (
          <p className="mt-10 rounded-2xl bg-red-50 p-5 text-sm text-red-700">
            {error}
          </p>
        )}
        {loading ? (
          <p className="py-24 text-center text-sm text-[#8b95a1]">
            시공 사례를 불러오는 중입니다…
          </p>
        ) : items.length ? (
          <div className="mt-14">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visibleItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => openProject(item.id)}
                  className="group overflow-hidden rounded-3xl bg-white text-left shadow-[0_4px_18px_rgba(31,42,52,.05)]"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-[#eef1f3]">
                    {item.cover_image ? (
                      <img
                        src={mediaUrl(item.cover_image.thumbnail_url)}
                        alt={`${item.title} 대표 사진`}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[#b0b8c1]">
                        <Building2 size={32} />
                      </div>
                    )}
                  </div>
                  <div className="p-6">
                    <p className="text-xs font-semibold text-[#2f7a4b]">
                      {item.public_address}
                    </p>
                    <div className="mt-2 flex items-start justify-between gap-3">
                      <h2 className="text-xl font-bold tracking-[-.03em]">
                        {item.title}
                      </h2>
                      <ArrowRight
                        size={19}
                        className="mt-1 shrink-0 text-[#8b95a1]"
                      />
                    </div>
                    <p className="mt-3 text-sm text-[#8b95a1]">
                      {[
                        item.housing_type,
                        item.area_pyeong ? `${item.area_pyeong}평` : "",
                        dateText(item.actual_end_date),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            <Pagination
              page={page}
              pageSize={PUBLIC_PROJECTS_PAGE_SIZE}
              total={items.length}
              onPageChange={setPage}
            />
          </div>
        ) : (
          <div className="mt-14 rounded-3xl bg-white py-24 text-center">
            <p className="text-sm text-[#8b95a1]">
              공개된 시공 사례가 아직 없습니다.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
