import type {
  Cost,
  Dashboard,
  EstimateDocument,
  EstimateInquiry,
  GeocodeResult,
  Image,
  Payment,
  PaymentSummary,
  Project,
  ProjectListItem,
  ProjectStatus,
  CostSummary,
  PublicProject,
  PublicProjectListItem,
  User,
  InquiryStats,
  AIJob,
  MaterialType,
  Simulation,
  SimulationVersion,
  SpaceScan,
  SurfaceMaterial,
} from "./types";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const token = () => localStorage.getItem("interior_token");

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (
    !(options.body instanceof FormData) &&
    !(options.body instanceof URLSearchParams)
  )
    headers.set("Content-Type", "application/json");
  if (token()) headers.set("Authorization", `Bearer ${token()}`);
  const response = await fetch(`${API}${path}`, { ...options, headers });
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "요청을 처리하지 못했습니다." }));
    throw new Error(error.detail || "요청을 처리하지 못했습니다.");
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export const mediaUrl = (path?: string) =>
  path?.startsWith("http") ? path : `${API}${path || ""}`;
export const api = {
  login: (email: string, password: string) =>
    request<{ access_token: string; user: User }>("/api/v1/auth/login", {
      method: "POST",
      body: new URLSearchParams({ username: email, password }),
    }),
  me: () => request<User>("/api/v1/auth/me"),
  dashboard: () => request<Dashboard>("/api/v1/dashboard/summary"),
  projects: (params = "") =>
    request<{
      items: ProjectListItem[];
      total: number;
      page: number;
      page_size: number;
    }>(
      `/api/v1/projects${params ? (params.startsWith("?") ? params : `?${params}`) : ""}`,
    ),
  project: (id: string) => request<Project>(`/api/v1/projects/${id}`),
  createProject: (body: unknown) =>
    request<Project>("/api/v1/projects", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateProject: (id: string, body: unknown) =>
    request<Project>(`/api/v1/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteProject: (id: string) =>
    request<void>(`/api/v1/projects/${id}`, { method: "DELETE" }),
  status: (id: string, status: ProjectStatus, note?: string) =>
    request<Project>(`/api/v1/projects/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, note }),
    }),
  costs: (id: string) =>
    request<{ items: Cost[]; summary: CostSummary }>(
      `/api/v1/projects/${id}/costs`,
    ),
  createCost: (id: string, body: unknown) =>
    request<Cost>(`/api/v1/projects/${id}/costs`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteCost: (projectId: string, costId: string) =>
    request<void>(`/api/v1/projects/${projectId}/costs/${costId}`, {
      method: "DELETE",
    }),
  payments: (id: string) =>
    request<{ items: Payment[]; summary: PaymentSummary }>(
      `/api/v1/projects/${id}/payments`,
    ),
  createPayment: (id: string, body: unknown) =>
    request<Payment>(`/api/v1/projects/${id}/payments`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updatePayment: (projectId: string, paymentId: string, body: unknown) =>
    request<Payment>(`/api/v1/projects/${projectId}/payments/${paymentId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deletePayment: (projectId: string, paymentId: string) =>
    request<void>(`/api/v1/projects/${projectId}/payments/${paymentId}`, {
      method: "DELETE",
    }),
  geocode: (query: string) =>
    request<GeocodeResult[]>(
      `/api/v1/maps/geocode?q=${encodeURIComponent(query)}`,
    ),
  reverseGeocode: (latitude: number, longitude: number) =>
    request<GeocodeResult>(
      `/api/v1/maps/reverse-geocode?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`,
    ),
  publicProjects: () =>
    request<PublicProjectListItem[]>("/api/v1/public/projects"),
  publicProject: (id: string) =>
    request<PublicProject>(`/api/v1/public/projects/${id}`),
  uploadImage: (
    id: string,
    file: File,
    category: string,
    isCover = false,
    isPublic = false,
  ) => {
    const form = new FormData();
    form.append("file", file);
    return request<Image>(
      `/api/v1/projects/${id}/images?category=${category}&is_cover=${isCover}&is_public=${isPublic}`,
      { method: "POST", body: form },
    );
  },
  deleteImage: (projectId: string, imageId: string) =>
    request<void>(`/api/v1/projects/${projectId}/images/${imageId}`, {
      method: "DELETE",
    }),
  updateImage: (projectId: string, imageId: string, body: unknown) =>
    request<Image>(`/api/v1/projects/${projectId}/images/${imageId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  inquiryStats: () => request<InquiryStats>("/api/v1/estimate-inquiries/stats"),
  inquiries: (params = "") =>
    request<{
      items: EstimateInquiry[];
      total: number;
      page: number;
      page_size: number;
    }>(`/api/v1/estimate-inquiries${params}`),
  inquiry: (id: string) =>
    request<EstimateInquiry>(`/api/v1/estimate-inquiries/${id}`),
  createInquiry: (body: unknown) =>
    request<EstimateInquiry>("/api/v1/estimate-inquiries", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateInquiry: (id: string, body: unknown) =>
    request<EstimateInquiry>(`/api/v1/estimate-inquiries/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteInquiry: (id: string) =>
    request<void>(`/api/v1/estimate-inquiries/${id}`, { method: "DELETE" }),
  createEstimate: (inquiryId: string, body: unknown) =>
    request<EstimateDocument>(
      `/api/v1/estimate-inquiries/${inquiryId}/estimates`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  updateEstimate: (inquiryId: string, estimateId: string, body: unknown) =>
    request<EstimateDocument>(
      `/api/v1/estimate-inquiries/${inquiryId}/estimates/${estimateId}`,
      { method: "PATCH", body: JSON.stringify(body) },
    ),
  deleteEstimate: (inquiryId: string, estimateId: string) =>
    request<void>(
      `/api/v1/estimate-inquiries/${inquiryId}/estimates/${estimateId}`,
      { method: "DELETE" },
    ),
  convertInquiry: (id: string, body: unknown = {}) =>
    request<Project>(`/api/v1/estimate-inquiries/${id}/convert`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  simulations: (projectId: string) =>
    request<Simulation[]>(`/api/v1/projects/${projectId}/simulations`),
  createSimulation: (projectId: string, name = "인테리어 시뮬레이션") =>
    request<Simulation>(`/api/v1/projects/${projectId}/simulations`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  updateSimulation: (id: string, body: unknown) =>
    request<Simulation>(`/api/v1/simulations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  saveScene: (versionId: string, scene_json: unknown) =>
    request<SimulationVersion>(
      `/api/v1/simulation-versions/${versionId}/scene`,
      {
        method: "PUT",
        body: JSON.stringify({ scene_json }),
      },
    ),
  createSimulationVersion: (simulationId: string, scene_json: unknown) =>
    request<SimulationVersion>(`/api/v1/simulations/${simulationId}/versions`, {
      method: "POST",
      body: JSON.stringify({ scene_json }),
    }),
  verifySimulationVersion: (versionId: string) =>
    request<SimulationVersion>(
      `/api/v1/simulation-versions/${versionId}/verify`,
      { method: "POST" },
    ),
  materials: (projectId: string) =>
    request<SurfaceMaterial[]>(`/api/v1/projects/${projectId}/materials`),
  uploadMaterial: (
    projectId: string,
    file: File,
    body: {
      name: string;
      material_type: MaterialType;
      real_width: number;
      real_height: number;
      seamless: boolean;
    },
  ) => {
    const form = new FormData();
    form.append("file", file);
    Object.entries(body).forEach(([key, value]) =>
      form.append(key, String(value)),
    );
    return request<SurfaceMaterial>(`/api/v1/projects/${projectId}/materials`, {
      method: "POST",
      body: form,
    });
  },
  uploadScan: (
    simulationId: string,
    sourceType: "PHOTOS" | "VIDEO" | "ROOMPLAN",
    files: File[],
  ) => {
    const form = new FormData();
    form.append("source_type", sourceType);
    files.forEach((file) => form.append("files", file));
    return request<SpaceScan>(
      `/api/v1/simulations/${simulationId}/scan-files`,
      { method: "POST", body: form },
    );
  },
  processScan: (scanId: string) =>
    request<AIJob>(`/api/v1/space-scans/${scanId}/process`, { method: "POST" }),
  generateFurnitureFromFiles: (projectId: string, files: File[]) => {
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    return request<AIJob>(
      `/api/v1/projects/${projectId}/design-assets/generate-from-files`,
      { method: "POST", body: form },
    );
  },
  scans: (simulationId: string) =>
    request<SpaceScan[]>(`/api/v1/simulations/${simulationId}/scans`),
};
