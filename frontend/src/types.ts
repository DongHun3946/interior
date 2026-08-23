export type ProjectStatus =
  | "PLANNING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "ON_HOLD"
  | "CANCELLED";
export type ImageCategory = "BEFORE" | "PROGRESS" | "AFTER" | "ETC";
export type CostItemType = "ESTIMATE" | "CONTRACT" | "EXTRA" | "DISCOUNT";
export type CostCategory =
  | "DEMOLITION"
  | "CARPENTRY"
  | "ELECTRICAL"
  | "PLUMBING"
  | "WALLPAPER"
  | "FLOORING"
  | "FURNITURE"
  | "OTHER";

export interface Image {
  id: string;
  project_id: string;
  category: ImageCategory;
  original_url: string;
  thumbnail_url: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  caption?: string;
  classification?: string;
  sort_order: number;
  is_cover: boolean;
  is_public: boolean;
}
export interface Project {
  id: string;
  title: string;
  customer_name?: string;
  customer_phone?: string;
  status: ProjectStatus;
  housing_type?: string;
  area_pyeong?: number;
  work_scope?: string;
  description?: string;
  address: string;
  address_detail?: string;
  latitude?: number;
  longitude?: number;
  planned_start_date?: string;
  actual_start_date?: string;
  planned_end_date?: string;
  actual_end_date?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  images: Image[];
}
export interface ProjectListItem {
  id: string;
  title: string;
  status: ProjectStatus;
  address: string;
  latitude?: number;
  longitude?: number;
  planned_start_date?: string;
  planned_end_date?: string;
  actual_end_date?: string;
  is_public: boolean;
  cover_image?: Image;
}
export interface Cost {
  id: string;
  project_id: string;
  category: CostCategory;
  item_type: CostItemType;
  name: string;
  supply_amount: number;
  vat_amount: number;
  amount: number;
  memo?: string;
  occurred_on?: string;
  created_at: string;
}
export interface CostSummary {
  estimate: number;
  contract: number;
  extra: number;
  discount: number;
  final_total: number;
  supply_total: number;
  vat_total: number;
}
export type PaymentStage =
  | "DEPOSIT"
  | "INTERIM"
  | "BALANCE"
  | "LUMP_SUM"
  | "OTHER";
export type PaymentMethod = "BANK_TRANSFER" | "CASH" | "CARD" | "OTHER";
export interface Payment {
  id: string;
  project_id: string;
  stage: PaymentStage;
  method: PaymentMethod;
  supply_amount: number;
  vat_amount: number;
  total_amount: number;
  paid_at?: string;
  memo?: string;
  created_at: string;
}
export interface PaymentSummary {
  final_supply: number;
  final_vat: number;
  final_total: number;
  paid_supply: number;
  paid_vat: number;
  paid_total: number;
  receivable_supply: number;
  receivable_vat: number;
  receivable_total: number;
}
export interface GeocodeResult {
  road_address: string;
  jibun_address?: string;
  latitude: number;
  longitude: number;
}
export interface PublicImage {
  id: string;
  category: ImageCategory;
  original_url: string;
  thumbnail_url: string;
  caption?: string;
  classification?: string;
  sort_order: number;
  is_cover: boolean;
}
export interface PublicProjectListItem {
  id: string;
  title: string;
  status: ProjectStatus;
  public_address: string;
  housing_type?: string;
  area_pyeong?: number;
  actual_end_date?: string;
  cover_image?: PublicImage;
}
export interface PublicProject extends PublicProjectListItem {
  description?: string;
  work_scope?: string;
  latitude?: number;
  longitude?: number;
  images: PublicImage[];
}
export interface Dashboard {
  total: number;
  planning: number;
  in_progress: number;
  completed: number;
  on_hold: number;
  cancelled: number;
  total_contract: number;
  total_extra: number;
  total_paid: number;
}
export interface User {
  id: string;
  login_id: string;
  name: string;
  role: string;
}

export interface CompanySettings {
  business_name: string;
  address: string;
  business_registration_number: string;
  representative_name: string;
  phone: string;
  fax: string;
}

export type InquiryStatus =
  | "NEW"
  | "CONSULTATION_SCHEDULED"
  | "SITE_VISIT_COMPLETED"
  | "ESTIMATE_DRAFTING"
  | "ESTIMATE_SENT"
  | "REVIEWING"
  | "CONTRACTED"
  | "LOST"
  | "ON_HOLD";
export interface EstimateLine {
  id?: string;
  estimate_id?: string;
  category: CostCategory;
  name: string;
  specification?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  supply_amount?: number;
  vat_amount?: number;
  total_amount?: number;
  memo?: string;
  sort_order: number;
}

export interface EstimateDocument {
  id: string;
  inquiry_id: string;
  version: number;
  title: string;
  notes?: string;
  supply_amount: number;
  vat_amount: number;
  total_amount: number;
  sent_at?: string;
  created_at: string;
  updated_at: string;
  lines: EstimateLine[];
}

export interface EstimateInquiry {
  id: string;
  customer_name: string;
  customer_phone: string;
  status: InquiryStatus;
  address?: string;
  address_detail?: string;
  housing_type?: string;
  area_pyeong?: number;
  desired_budget?: number;
  desired_start_date?: string;
  consultation_date?: string;
  request_details?: string;
  memo?: string;
  loss_reason?: string;
  converted_project_id?: string;
  converted_project_archived?: boolean;
  created_at: string;
  updated_at: string;
  estimates?: EstimateDocument[];
  latest_estimate?: EstimateDocument;
}

export interface InquiryStats {
  total: number;
  new_this_month: number;
  active: number;
  contracted: number;
  lost: number;
  conversion_rate: number;
  status_counts: Record<InquiryStatus, number>;
}

export type SimulationStatus =
  | "DRAFT"
  | "PROCESSING"
  | "REVIEW"
  | "APPROVED"
  | "ARCHIVED";
export type MaterialType =
  | "WALLPAPER"
  | "TILE"
  | "FLOORING"
  | "PAINT"
  | "OTHER";
export type ScanSourceType = "ROOMPLAN" | "VIDEO" | "PHOTOS" | "MANUAL";
export type ProcessingStatus =
  | "UPLOADING"
  | "QUEUED"
  | "PROCESSING"
  | "REVIEW"
  | "COMPLETE"
  | "FAILED";
export type AIJobStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED";

export interface SceneRoom {
  id: string;
  name: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  floor_material_id?: string | null;
  wall_material_id?: string | null;
  floor_color?: string;
  wall_color?: string;
}

export interface ScenePlacement {
  id: string;
  asset_id?: string;
  name: string;
  category: string;
  position: { x: number; z: number };
  size: { width: number; depth: number; height: number };
  rotation: number;
  color: string;
}

export interface SceneDocument {
  schema_version: "1.0";
  units: "meter";
  structure: {
    rooms: SceneRoom[];
    walls: unknown[];
    openings: unknown[];
    surfaces: unknown[];
  };
  placements: ScenePlacement[];
  materials: unknown[];
  source: {
    type: ScanSourceType;
    scan_id?: string | null;
    scale_confidence: number;
  };
}

export interface SimulationVersion {
  id: string;
  simulation_id: string;
  version: number;
  scene_json: SceneDocument;
  preview_2d_url?: string;
  preview_3d_url?: string;
  source_scan_id?: string;
  verified_at?: string;
  created_at: string;
}

export interface Simulation {
  id: string;
  project_id: string;
  name: string;
  status: SimulationStatus;
  current_version_id: string;
  created_at: string;
  updated_at: string;
  versions: SimulationVersion[];
}

export interface SurfaceMaterial {
  id: string;
  owner_project_id?: string;
  material_type: MaterialType;
  name: string;
  albedo_url?: string;
  real_width: number;
  real_height: number;
  seamless: boolean;
  created_at: string;
}

export interface SpaceScan {
  id: string;
  simulation_id: string;
  source_type: ScanSourceType;
  status: ProcessingStatus;
  input_manifest: Record<string, unknown>;
  result_scene_json?: SceneDocument;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface AIJob {
  id: string;
  job_type: "ROOM_SCAN" | "FURNITURE_3D" | "MATERIAL_TEXTURE" | "RENDER";
  target_id: string;
  provider: string;
  status: AIJobStatus;
  progress: number;
  input_json: Record<string, unknown>;
  output_json: Record<string, unknown>;
  attempt_count: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
}
