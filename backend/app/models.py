import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import JSON, BigInteger, Boolean, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def uuid_column() -> Mapped[uuid.UUID]:
    return mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    STAFF = "STAFF"


class ProjectStatus(str, enum.Enum):
    PLANNING = "PLANNING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    ON_HOLD = "ON_HOLD"
    CANCELLED = "CANCELLED"


class ImageCategory(str, enum.Enum):
    BEFORE = "BEFORE"
    PROGRESS = "PROGRESS"
    AFTER = "AFTER"
    ETC = "ETC"


class CostItemType(str, enum.Enum):
    ESTIMATE = "ESTIMATE"
    CONTRACT = "CONTRACT"
    EXTRA = "EXTRA"
    DISCOUNT = "DISCOUNT"


class CostCategory(str, enum.Enum):
    DEMOLITION = "DEMOLITION"
    CARPENTRY = "CARPENTRY"
    ELECTRICAL = "ELECTRICAL"
    PLUMBING = "PLUMBING"
    WALLPAPER = "WALLPAPER"
    FLOORING = "FLOORING"
    FURNITURE = "FURNITURE"
    OTHER = "OTHER"


class PaymentStage(str, enum.Enum):
    DEPOSIT = "DEPOSIT"
    INTERIM = "INTERIM"
    BALANCE = "BALANCE"
    OTHER = "OTHER"


class PaymentMethod(str, enum.Enum):
    BANK_TRANSFER = "BANK_TRANSFER"
    CASH = "CASH"
    CARD = "CARD"
    OTHER = "OTHER"


class PaymentStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    PAID = "PAID"
    CANCELLED = "CANCELLED"
    REFUNDED = "REFUNDED"


class InquiryStatus(str, enum.Enum):
    NEW = "NEW"
    CONSULTATION_SCHEDULED = "CONSULTATION_SCHEDULED"
    SITE_VISIT_COMPLETED = "SITE_VISIT_COMPLETED"
    ESTIMATE_DRAFTING = "ESTIMATE_DRAFTING"
    ESTIMATE_SENT = "ESTIMATE_SENT"
    REVIEWING = "REVIEWING"
    CONTRACTED = "CONTRACTED"
    LOST = "LOST"
    ON_HOLD = "ON_HOLD"


class SimulationStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PROCESSING = "PROCESSING"
    REVIEW = "REVIEW"
    APPROVED = "APPROVED"
    ARCHIVED = "ARCHIVED"


class ScanSourceType(str, enum.Enum):
    ROOMPLAN = "ROOMPLAN"
    VIDEO = "VIDEO"
    PHOTOS = "PHOTOS"
    MANUAL = "MANUAL"


class ProcessingStatus(str, enum.Enum):
    UPLOADING = "UPLOADING"
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    REVIEW = "REVIEW"
    COMPLETE = "COMPLETE"
    FAILED = "FAILED"


class AssetType(str, enum.Enum):
    FURNITURE = "FURNITURE"
    DECOR = "DECOR"
    FIXTURE = "FIXTURE"


class AssetSourceType(str, enum.Enum):
    CATALOG = "CATALOG"
    USER_UPLOAD = "USER_UPLOAD"
    AI_GENERATED = "AI_GENERATED"


class MaterialType(str, enum.Enum):
    WALLPAPER = "WALLPAPER"
    TILE = "TILE"
    FLOORING = "FLOORING"
    PAINT = "PAINT"
    OTHER = "OTHER"


class AIJobType(str, enum.Enum):
    ROOM_SCAN = "ROOM_SCAN"
    FURNITURE_3D = "FURNITURE_3D"
    MATERIAL_TEXTURE = "MATERIAL_TEXTURE"
    RENDER = "RENDER"


class AIJobStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = uuid_column()
    login_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(100))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.ADMIN)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CompanySettings(Base):
    __tablename__ = "company_settings"

    id: Mapped[uuid.UUID] = uuid_column()
    business_name: Mapped[str] = mapped_column(String(200), default="")
    address: Mapped[str] = mapped_column(String(500), default="")
    business_registration_number: Mapped[str] = mapped_column(String(30), default="")
    representative_name: Mapped[str] = mapped_column(String(100), default="")
    phone: Mapped[str] = mapped_column(String(40), default="")
    fax: Mapped[str] = mapped_column(String(40), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[uuid.UUID] = uuid_column()
    title: Mapped[str] = mapped_column(String(200), index=True)
    customer_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    customer_phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    status: Mapped[ProjectStatus] = mapped_column(Enum(ProjectStatus), default=ProjectStatus.PLANNING, index=True)
    housing_type: Mapped[str | None] = mapped_column(String(60), nullable=True)
    area_pyeong: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    work_scope: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    address: Mapped[str] = mapped_column(String(300))
    address_detail: Mapped[str | None] = mapped_column(String(200), nullable=True)
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    planned_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    actual_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    planned_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    actual_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    images: Mapped[list["ProjectImage"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    cost_items: Mapped[list["CostItem"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    payments: Mapped[list["Payment"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    status_histories: Mapped[list["ProjectStatusHistory"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    simulations: Mapped[list["Simulation"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class ProjectImage(Base):
    __tablename__ = "project_images"
    id: Mapped[uuid.UUID] = uuid_column()
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    category: Mapped[ImageCategory] = mapped_column(Enum(ImageCategory), default=ImageCategory.ETC)
    storage_key: Mapped[str] = mapped_column(String(500))
    original_url: Mapped[str] = mapped_column(String(1000))
    thumbnail_url: Mapped[str] = mapped_column(String(1000))
    original_filename: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(100))
    file_size: Mapped[int] = mapped_column(Integer)
    caption: Mapped[str | None] = mapped_column(String(300), nullable=True)
    taken_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_cover: Mapped[bool] = mapped_column(Boolean, default=False)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    project: Mapped[Project] = relationship(back_populates="images")


class CostItem(Base):
    __tablename__ = "cost_items"
    id: Mapped[uuid.UUID] = uuid_column()
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    category: Mapped[CostCategory] = mapped_column(Enum(CostCategory), default=CostCategory.OTHER)
    item_type: Mapped[CostItemType] = mapped_column(Enum(CostItemType), default=CostItemType.ESTIMATE)
    name: Mapped[str] = mapped_column(String(200))
    supply_amount: Mapped[int] = mapped_column(BigInteger, default=0)
    vat_amount: Mapped[int] = mapped_column(BigInteger, default=0)
    amount: Mapped[int] = mapped_column(BigInteger)
    memo: Mapped[str | None] = mapped_column(Text, nullable=True)
    occurred_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    project: Mapped[Project] = relationship(back_populates="cost_items")


class Payment(Base):
    __tablename__ = "payments"
    id: Mapped[uuid.UUID] = uuid_column()
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    stage: Mapped[PaymentStage] = mapped_column(Enum(PaymentStage), default=PaymentStage.OTHER)
    method: Mapped[PaymentMethod] = mapped_column(Enum(PaymentMethod), default=PaymentMethod.BANK_TRANSFER)
    status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus), default=PaymentStatus.SCHEDULED, index=True)
    supply_amount: Mapped[int] = mapped_column(BigInteger, default=0)
    vat_amount: Mapped[int] = mapped_column(BigInteger, default=0)
    total_amount: Mapped[int] = mapped_column(BigInteger, default=0)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    memo: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    project: Mapped[Project] = relationship(back_populates="payments")


class ProjectStatusHistory(Base):
    __tablename__ = "project_status_histories"
    id: Mapped[uuid.UUID] = uuid_column()
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    from_status: Mapped[ProjectStatus | None] = mapped_column(Enum(ProjectStatus), nullable=True)
    to_status: Mapped[ProjectStatus] = mapped_column(Enum(ProjectStatus))
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    changed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project: Mapped[Project] = relationship(back_populates="status_histories")


class EstimateInquiry(Base):
    __tablename__ = "estimate_inquiries"

    id: Mapped[uuid.UUID] = uuid_column()
    customer_name: Mapped[str] = mapped_column(String(100), index=True)
    customer_phone: Mapped[str] = mapped_column(String(40), index=True)
    status: Mapped[InquiryStatus] = mapped_column(Enum(InquiryStatus), default=InquiryStatus.NEW, index=True)
    address: Mapped[str | None] = mapped_column(String(300), nullable=True)
    address_detail: Mapped[str | None] = mapped_column(String(200), nullable=True)
    housing_type: Mapped[str | None] = mapped_column(String(60), nullable=True)
    area_pyeong: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    desired_budget: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    desired_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    consultation_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    request_details: Mapped[str | None] = mapped_column(Text, nullable=True)
    memo: Mapped[str | None] = mapped_column(Text, nullable=True)
    loss_reason: Mapped[str | None] = mapped_column(String(100), nullable=True)
    converted_project_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("projects.id"), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    estimates: Mapped[list["EstimateDocument"]] = relationship(back_populates="inquiry", cascade="all, delete-orphan")


class EstimateDocument(Base):
    __tablename__ = "estimate_documents"

    id: Mapped[uuid.UUID] = uuid_column()
    inquiry_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("estimate_inquiries.id"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(200), default="인테리어 공사 견적서")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    supply_amount: Mapped[int] = mapped_column(BigInteger, default=0)
    vat_amount: Mapped[int] = mapped_column(BigInteger, default=0)
    total_amount: Mapped[int] = mapped_column(BigInteger, default=0)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    inquiry: Mapped[EstimateInquiry] = relationship(back_populates="estimates")
    lines: Mapped[list["EstimateLine"]] = relationship(back_populates="estimate", cascade="all, delete-orphan", order_by="EstimateLine.sort_order")


class EstimateLine(Base):
    __tablename__ = "estimate_lines"

    id: Mapped[uuid.UUID] = uuid_column()
    estimate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("estimate_documents.id"), index=True)
    category: Mapped[CostCategory] = mapped_column(Enum(CostCategory), default=CostCategory.OTHER)
    name: Mapped[str] = mapped_column(String(200))
    specification: Mapped[str | None] = mapped_column(String(200), nullable=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    unit: Mapped[str] = mapped_column(String(30), default="")
    unit_price: Mapped[int] = mapped_column(BigInteger, default=0)
    supply_amount: Mapped[int] = mapped_column(BigInteger, default=0)
    vat_amount: Mapped[int] = mapped_column(BigInteger, default=0)
    total_amount: Mapped[int] = mapped_column(BigInteger, default=0)
    memo: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    estimate: Mapped[EstimateDocument] = relationship(back_populates="lines")


class Simulation(Base):
    __tablename__ = "simulations"

    id: Mapped[uuid.UUID] = uuid_column()
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    name: Mapped[str] = mapped_column(String(200), default="인테리어 시뮬레이션")
    status: Mapped[SimulationStatus] = mapped_column(Enum(SimulationStatus), default=SimulationStatus.DRAFT, index=True)
    current_version_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    project: Mapped[Project] = relationship(back_populates="simulations")
    versions: Mapped[list["SimulationVersion"]] = relationship(back_populates="simulation", cascade="all, delete-orphan", order_by="SimulationVersion.version")
    scans: Mapped[list["SpaceScan"]] = relationship(back_populates="simulation", cascade="all, delete-orphan")


class SimulationVersion(Base):
    __tablename__ = "simulation_versions"

    id: Mapped[uuid.UUID] = uuid_column()
    simulation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("simulations.id"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    scene_json: Mapped[dict] = mapped_column(JSON)
    preview_2d_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    preview_3d_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    source_scan_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    simulation: Mapped[Simulation] = relationship(back_populates="versions")


class SpaceScan(Base):
    __tablename__ = "space_scans"

    id: Mapped[uuid.UUID] = uuid_column()
    simulation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("simulations.id"), index=True)
    source_type: Mapped[ScanSourceType] = mapped_column(Enum(ScanSourceType))
    status: Mapped[ProcessingStatus] = mapped_column(Enum(ProcessingStatus), default=ProcessingStatus.UPLOADING, index=True)
    input_manifest: Mapped[dict] = mapped_column(JSON, default=dict)
    raw_model_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    normalized_model_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    result_scene_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    simulation: Mapped[Simulation] = relationship(back_populates="scans")


class DesignAsset(Base):
    __tablename__ = "design_assets"

    id: Mapped[uuid.UUID] = uuid_column()
    owner_project_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("projects.id"), nullable=True, index=True)
    asset_type: Mapped[AssetType] = mapped_column(Enum(AssetType), default=AssetType.FURNITURE)
    name: Mapped[str] = mapped_column(String(200))
    source_type: Mapped[AssetSourceType] = mapped_column(Enum(AssetSourceType), default=AssetSourceType.CATALOG)
    model_glb_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    preview_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    width: Mapped[Decimal] = mapped_column(Numeric(8, 3), default=1)
    depth: Mapped[Decimal] = mapped_column(Numeric(8, 3), default=1)
    height: Mapped[Decimal] = mapped_column(Numeric(8, 3), default=1)
    polygon_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    generation_job_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SurfaceMaterial(Base):
    __tablename__ = "surface_materials"

    id: Mapped[uuid.UUID] = uuid_column()
    owner_project_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("projects.id"), nullable=True, index=True)
    material_type: Mapped[MaterialType] = mapped_column(Enum(MaterialType), default=MaterialType.OTHER)
    name: Mapped[str] = mapped_column(String(200))
    albedo_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    normal_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    roughness_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    displacement_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    real_width: Mapped[Decimal] = mapped_column(Numeric(8, 3), default=1)
    real_height: Mapped[Decimal] = mapped_column(Numeric(8, 3), default=1)
    seamless: Mapped[bool] = mapped_column(Boolean, default=False)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AIJob(Base):
    __tablename__ = "ai_jobs"

    id: Mapped[uuid.UUID] = uuid_column()
    job_type: Mapped[AIJobType] = mapped_column(Enum(AIJobType), index=True)
    target_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), index=True)
    provider: Mapped[str] = mapped_column(String(100), default="pending-provider")
    status: Mapped[AIJobStatus] = mapped_column(Enum(AIJobStatus), default=AIJobStatus.QUEUED, index=True)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    input_json: Mapped[dict] = mapped_column(JSON, default=dict)
    output_json: Mapped[dict] = mapped_column(JSON, default=dict)
    provider_task_id: Mapped[str | None] = mapped_column(String(300), nullable=True)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
