from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .models import CostCategory, ImageCategory, InquiryStatus, PaymentMethod, PaymentStage, ProjectStatus, ProjectType, UserRole


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    login_id: str
    name: str
    role: UserRole


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class CompanySettingsUpdate(BaseModel):
    business_name: str = Field(default="", max_length=200)
    address: str = Field(default="", max_length=500)
    business_registration_number: str = Field(default="", max_length=30)
    representative_name: str = Field(default="", max_length=100)
    phone: str = Field(default="", max_length=40)
    fax: str = Field(default="", max_length=40)
    session_timeout_minutes: int = Field(default=480, ge=30, le=10_080)


class CompanySettingsOut(CompanySettingsUpdate):
    model_config = ConfigDict(from_attributes=True)


class ProjectBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    customer_name: str | None = None
    customer_phone: str | None = None
    project_type: ProjectType = ProjectType.INTERIOR
    status: ProjectStatus = ProjectStatus.PLANNING
    housing_type: str | None = None
    area_pyeong: Decimal | None = Field(default=None, ge=0)
    work_scope: str | None = None
    description: str | None = None
    internal_memo: str | None = None
    address: str = Field(min_length=1, max_length=300)
    address_detail: str | None = None
    latitude: Decimal | None = Field(default=None, ge=-90, le=90)
    longitude: Decimal | None = Field(default=None, ge=-180, le=180)
    planned_start_date: date | None = None
    actual_start_date: date | None = None
    planned_end_date: date | None = None
    actual_end_date: date | None = None
    is_public: bool = False

    @model_validator(mode="after")
    def validate_planned_date_range(self):
        if (
            self.planned_start_date
            and self.planned_end_date
            and self.planned_end_date < self.planned_start_date
        ):
            raise ValueError("공사 종료일은 시작일보다 빠를 수 없습니다.")
        return self


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    title: str | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    project_type: ProjectType = ProjectType.INTERIOR
    status: ProjectStatus | None = None
    housing_type: str | None = None
    area_pyeong: Decimal | None = Field(default=None, ge=0)
    work_scope: str | None = None
    description: str | None = None
    internal_memo: str | None = None
    address: str | None = None
    address_detail: str | None = None
    latitude: Decimal | None = Field(default=None, ge=-90, le=90)
    longitude: Decimal | None = Field(default=None, ge=-180, le=180)
    planned_start_date: date | None = None
    actual_start_date: date | None = None
    planned_end_date: date | None = None
    actual_end_date: date | None = None
    is_public: bool | None = None

    @model_validator(mode="after")
    def validate_planned_date_range(self):
        if (
            self.planned_start_date
            and self.planned_end_date
            and self.planned_end_date < self.planned_start_date
        ):
            raise ValueError("공사 종료일은 시작일보다 빠를 수 없습니다.")
        return self


class ImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    category: ImageCategory
    original_url: str
    thumbnail_url: str
    original_filename: str
    mime_type: str
    file_size: int
    caption: str | None
    classification: str | None
    taken_at: datetime | None
    sort_order: int
    is_cover: bool
    is_public: bool


class ImageUpdate(BaseModel):
    category: ImageCategory | None = None
    caption: str | None = None
    classification: str | None = Field(default=None, max_length=100)
    sort_order: int | None = Field(default=None, ge=0)
    is_cover: bool | None = None
    is_public: bool | None = None


class AdminImageOut(ImageOut):
    project_title: str
    project_status: ProjectStatus
    project_address: str


class AdminImageList(BaseModel):
    items: list[AdminImageOut]
    total: int
    page: int
    page_size: int
    classifications: list[str] = Field(default_factory=list)


class ContractEstimateLineOut(BaseModel):
    id: UUID
    project_id: UUID
    category: CostCategory
    item_type: Literal["CONTRACT"] = "CONTRACT"
    name: str
    specification: str | None = None
    quantity: Decimal
    unit: str
    unit_price: int
    supply_amount: int
    vat_amount: int
    amount: int
    memo: str | None = None
    created_at: datetime


class PaymentCreate(BaseModel):
    stage: PaymentStage = PaymentStage.OTHER
    method: PaymentMethod = PaymentMethod.BANK_TRANSFER
    supply_amount: int = Field(ge=0, le=9_000_000_000_000)
    vat_amount: int = Field(default=0, ge=0, le=9_000_000_000_000)
    paid_at: datetime | None = None
    memo: str | None = None


class PaymentUpdate(BaseModel):
    stage: PaymentStage | None = None
    method: PaymentMethod | None = None
    supply_amount: int | None = Field(default=None, ge=0, le=9_000_000_000_000)
    vat_amount: int | None = Field(default=None, ge=0, le=9_000_000_000_000)
    paid_at: datetime | None = None
    memo: str | None = None


class PaymentOut(PaymentCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    total_amount: int
    created_at: datetime


class StatusChange(BaseModel):
    status: ProjectStatus
    note: str | None = None


class StatusHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    from_status: ProjectStatus | None
    to_status: ProjectStatus
    note: str | None
    created_at: datetime


class ProjectOut(ProjectBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    contract_estimate_id: UUID | None = None
    created_at: datetime
    updated_at: datetime
    images: list[ImageOut] = Field(default_factory=list)


class ProjectListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    title: str
    project_type: ProjectType
    status: ProjectStatus
    address: str
    latitude: Decimal | None
    longitude: Decimal | None
    planned_start_date: date | None
    planned_end_date: date | None
    actual_end_date: date | None
    is_public: bool
    cover_image: ImageOut | None = None


class Page(BaseModel):
    page: int
    page_size: int
    total: int


class ProjectList(Page):
    items: list[ProjectListItem]


class CostSummary(BaseModel):
    contract: int
    final_total: int
    supply_total: int
    vat_total: int


class ContractEstimateReference(BaseModel):
    id: UUID
    inquiry_id: UUID
    version: int
    title: str
    total_amount: int


class PaymentSummary(BaseModel):
    final_supply: int
    final_vat: int
    final_total: int
    paid_supply: int
    paid_vat: int
    paid_total: int
    receivable_supply: int
    receivable_vat: int
    receivable_total: int


class GeocodeResult(BaseModel):
    road_address: str
    jibun_address: str | None = None
    latitude: Decimal
    longitude: Decimal


class PublicImageOut(BaseModel):
    id: UUID
    category: ImageCategory
    original_url: str
    thumbnail_url: str
    caption: str | None = None
    classification: str | None = None
    sort_order: int
    is_cover: bool


class PublicProjectListItem(BaseModel):
    id: UUID
    title: str
    status: ProjectStatus
    public_address: str
    housing_type: str | None = None
    area_pyeong: Decimal | None = None
    actual_end_date: date | None = None
    cover_image: PublicImageOut | None = None


class PublicProjectOut(PublicProjectListItem):
    description: str | None = None
    work_scope: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    images: list[PublicImageOut] = Field(default_factory=list)


class DashboardSummary(BaseModel):
    total: int
    planning: int
    in_progress: int
    completed: int
    on_hold: int
    cancelled: int
    total_contract: int
    total_extra: int
    total_paid: int


class EstimateLineCreate(BaseModel):
    category: CostCategory = CostCategory.OTHER
    name: str = Field(min_length=1, max_length=200)
    specification: str | None = None
    quantity: Decimal = Field(default=0, ge=0)
    unit: str = Field(default="", max_length=30)
    unit_price: int = Field(default=0, ge=0, le=9_000_000_000_000)
    memo: str | None = None
    sort_order: int = Field(default=0, ge=0)


class EstimateLineOut(EstimateLineCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    estimate_id: UUID
    supply_amount: int
    vat_amount: int
    total_amount: int


class EstimateCreate(BaseModel):
    title: str = Field(default="인테리어 공사 견적서", min_length=1, max_length=200)
    notes: str | None = None
    lines: list[EstimateLineCreate] = Field(default_factory=list)


class EstimateUpdate(BaseModel):
    title: str | None = None
    notes: str | None = None
    lines: list[EstimateLineCreate] | None = None


class EstimateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    inquiry_id: UUID
    version: int
    title: str
    notes: str | None
    supply_amount: int
    vat_amount: int
    total_amount: int
    sent_at: datetime | None
    created_at: datetime
    updated_at: datetime
    lines: list[EstimateLineOut] = Field(default_factory=list)


class InquiryBase(BaseModel):
    customer_name: str = Field(min_length=1, max_length=100)
    customer_phone: str = Field(min_length=1, max_length=40)
    status: InquiryStatus = InquiryStatus.NEW
    address: str | None = None
    address_detail: str | None = None
    housing_type: str | None = None
    area_pyeong: Decimal | None = Field(default=None, ge=0)
    desired_budget: int | None = Field(default=None, ge=0)
    desired_start_date: date | None = None
    consultation_date: datetime | None = None
    consultation_reserved_at: datetime | None = None
    request_details: str | None = None
    memo: str | None = None
    loss_reason: str | None = None


class InquiryCreate(InquiryBase):
    pass


class InquiryUpdate(BaseModel):
    customer_name: str | None = None
    customer_phone: str | None = None
    status: InquiryStatus | None = None
    address: str | None = None
    address_detail: str | None = None
    housing_type: str | None = None
    area_pyeong: Decimal | None = Field(default=None, ge=0)
    desired_budget: int | None = Field(default=None, ge=0)
    desired_start_date: date | None = None
    consultation_date: datetime | None = None
    consultation_reserved_at: datetime | None = None
    request_details: str | None = None
    memo: str | None = None
    loss_reason: str | None = None


class InquiryListItem(InquiryBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    converted_project_id: UUID | None
    converted_project_archived: bool = False
    created_at: datetime
    updated_at: datetime
    latest_estimate: EstimateOut | None = None


class InquiryOut(InquiryBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    converted_project_id: UUID | None
    converted_project_archived: bool = False
    created_at: datetime
    updated_at: datetime
    estimates: list[EstimateOut] = Field(default_factory=list)


class InquiryList(Page):
    items: list[InquiryListItem]


class InquiryConvert(BaseModel):
    project_title: str | None = Field(default=None, max_length=200)
    planned_start_date: date | None = None
    planned_end_date: date | None = None

    @model_validator(mode="after")
    def validate_planned_date_range(self):
        if (
            self.planned_start_date
            and self.planned_end_date
            and self.planned_end_date < self.planned_start_date
        ):
            raise ValueError("공사 종료일은 시작일보다 빠를 수 없습니다.")
        return self


class ContractEstimateApply(BaseModel):
    estimate_id: UUID


class ContractEstimateHistoryOut(BaseModel):
    id: UUID
    project_id: UUID
    from_estimate_id: UUID | None
    to_estimate_id: UUID
    changed_by: UUID | None
    created_at: datetime


class InquiryStats(BaseModel):
    total: int
    new_this_month: int
    active: int
    contracted: int
    lost: int
    conversion_rate: float
    status_counts: dict[str, int]
