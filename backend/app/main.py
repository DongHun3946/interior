from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from uuid import UUID

import httpx
from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from .core.config import get_settings
from .db import Base, engine, get_db
from .models import CompanySettings, EstimateDocument, EstimateInquiry, EstimateLine, ImageCategory, InquiryStatus, Payment, Project, ProjectImage, ProjectStatus, ProjectStatusHistory, User, UserRole
from .schemas import AdminImageList, AdminImageOut, CompanySettingsOut, CompanySettingsUpdate, ContractEstimateLineOut, ContractEstimateReference, CostSummary, DashboardSummary, EstimateCreate, EstimateOut, EstimateUpdate, GeocodeResult, ImageOut, ImageUpdate, InquiryConvert, InquiryCreate, InquiryList, InquiryListItem, InquiryOut, InquiryStats, InquiryUpdate, PaymentCreate, PaymentOut, PaymentSummary, PaymentUpdate, ProjectCreate, ProjectList, ProjectListItem, ProjectOut, ProjectUpdate, PublicImageOut, PublicProjectListItem, PublicProjectOut, StatusChange, StatusHistoryOut, Token, UserOut
from .security import create_access_token, get_current_user, hash_password, verify_password
from .schema_compat import ensure_schema_compatibility
from .storage import save_upload
from .simulation_routes import router as simulation_router

settings = get_settings()
Path(settings.media_dir).mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_schema_compatibility(engine)
    Path(settings.media_dir).mkdir(parents=True, exist_ok=True)
    with Session(engine) as db:
        admin = db.scalar(select(User).where(User.login_id == settings.admin_login_id))
        if not admin:
            admin = db.scalar(
                select(User)
                .where(User.role == UserRole.ADMIN)
                .order_by(User.created_at)
            )
            if admin:
                admin.login_id = settings.admin_login_id
            else:
                db.add(User(login_id=settings.admin_login_id, password_hash=hash_password(settings.admin_password), name="관리자", role=UserRole.ADMIN))
            db.commit()
    yield


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.mount("/media", StaticFiles(directory=settings.media_dir), name="media")
app.include_router(simulation_router)


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in (UserRole.ADMIN, UserRole.STAFF):
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다.")
    return user


def project_or_404(db: Session, project_id: UUID) -> Project:
    project = db.scalar(select(Project).options(joinedload(Project.images.and_(ProjectImage.deleted_at.is_(None)))).where(Project.id == project_id, Project.deleted_at.is_(None)))
    if not project:
        raise HTTPException(status_code=404, detail="현장을 찾을 수 없습니다.")
    return project


def inquiry_or_404(db: Session, inquiry_id: UUID) -> EstimateInquiry:
    result = db.execute(
        select(EstimateInquiry)
        .options(joinedload(EstimateInquiry.estimates).joinedload(EstimateDocument.lines))
        .where(EstimateInquiry.id == inquiry_id, EstimateInquiry.deleted_at.is_(None))
    ).unique()
    inquiry = result.scalar_one_or_none()
    if not inquiry:
        raise HTTPException(status_code=404, detail="견적 문의를 찾을 수 없습니다.")
    return inquiry


def replace_estimate_lines(estimate: EstimateDocument, payload_lines: list, db: Session) -> None:
    estimate.lines.clear()
    supply_total = 0
    vat_total = 0
    for index, payload in enumerate(payload_lines):
        values = payload.model_dump()
        sort_order = values.pop("sort_order", index)
        quantity = Decimal(values["quantity"])
        effective_quantity = quantity if quantity > 0 else Decimal(1)
        supply_amount = int(effective_quantity * values["unit_price"])
        vat_amount = int(round(supply_amount * 0.1))
        line = EstimateLine(
            **values,
            sort_order=sort_order,
            supply_amount=supply_amount,
            vat_amount=vat_amount,
            total_amount=supply_amount + vat_amount,
        )
        estimate.lines.append(line)
        supply_total += supply_amount
        vat_total += vat_amount
    estimate.supply_amount = supply_total
    estimate.vat_amount = vat_total
    estimate.total_amount = supply_total + vat_total
    db.flush()


def contract_estimate_for_project(
    db: Session, project_id: UUID
) -> EstimateDocument | None:
    result = db.execute(
        select(EstimateDocument)
        .options(joinedload(EstimateDocument.lines))
        .join(Project, Project.contract_estimate_id == EstimateDocument.id)
        .where(Project.id == project_id, Project.deleted_at.is_(None))
    ).unique()
    return result.scalar_one_or_none()


def project_finance_summary(db: Session, project_id: UUID) -> PaymentSummary:
    estimate = contract_estimate_for_project(db, project_id)
    final_supply = estimate.supply_amount if estimate else 0
    final_vat = estimate.vat_amount if estimate else 0
    payments = db.scalars(select(Payment).where(Payment.project_id == project_id, Payment.deleted_at.is_(None))).all()
    paid_supply = sum(item.supply_amount for item in payments)
    paid_vat = sum(item.vat_amount for item in payments)
    return PaymentSummary(
        final_supply=final_supply,
        final_vat=final_vat,
        final_total=final_supply + final_vat,
        paid_supply=paid_supply,
        paid_vat=paid_vat,
        paid_total=paid_supply + paid_vat,
        receivable_supply=final_supply - paid_supply,
        receivable_vat=final_vat - paid_vat,
        receivable_total=(final_supply + final_vat) - (paid_supply + paid_vat),
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/auth/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.login_id == form_data.username))
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호를 확인해주세요.")
    company = db.scalar(select(CompanySettings).order_by(CompanySettings.created_at).limit(1))
    session_timeout_minutes = company.session_timeout_minutes if company else 480
    return Token(
        access_token=create_access_token(
            str(user.id), expires_minutes=session_timeout_minutes
        ),
        user=UserOut.model_validate(user),
    )


@app.get("/api/v1/auth/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user


@app.get("/api/v1/company-settings", response_model=CompanySettingsOut)
def get_company_settings(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    company = db.scalar(select(CompanySettings).order_by(CompanySettings.created_at).limit(1))
    return company or CompanySettingsOut()


@app.put("/api/v1/company-settings", response_model=CompanySettingsOut)
def update_company_settings(payload: CompanySettingsUpdate, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    company = db.scalar(select(CompanySettings).order_by(CompanySettings.created_at).limit(1))
    if not company:
        company = CompanySettings()
        db.add(company)
    for key, value in payload.model_dump().items():
        setattr(company, key, value.strip() if isinstance(value, str) else value)
    db.commit()
    db.refresh(company)
    return company


def _reverse_address_text(item: dict) -> str:
    region = item.get("region") or {}
    parts = [
        (region.get(key) or {}).get("name", "").strip()
        for key in ("area1", "area2", "area3", "area4")
    ]
    land = item.get("land") or {}
    land_name = str(land.get("name") or "").strip()
    if land_name and land_name not in parts:
        parts.append(land_name)
    number1 = str(land.get("number1") or "").strip()
    number2 = str(land.get("number2") or "").strip()
    if number1:
        parts.append(f"{number1}-{number2}" if number2 else number1)
    return " ".join(part for part in parts if part)


@app.get("/api/v1/maps/reverse-geocode", response_model=GeocodeResult)
def reverse_geocode(
    latitude: Decimal = Query(..., ge=-90, le=90),
    longitude: Decimal = Query(..., ge=-180, le=180),
    _: User = Depends(require_admin),
):
    if not settings.naver_maps_client_id or not settings.naver_maps_client_secret:
        raise HTTPException(status_code=503, detail="Naver Maps API 키가 설정되지 않았습니다.")
    try:
        response = httpx.get(
            "https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc",
            params={
                "coords": f"{longitude},{latitude}",
                "output": "json",
                "orders": "roadaddr,addr",
            },
            headers={
                "x-ncp-apigw-api-key-id": settings.naver_maps_client_id,
                "x-ncp-apigw-api-key": settings.naver_maps_client_secret,
                "Accept": "application/json",
            },
            timeout=10,
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 401:
            raise HTTPException(status_code=502, detail="Naver Maps API Key ID와 API Key를 확인해 주세요.") from exc
        if exc.response.status_code == 403:
            raise HTTPException(status_code=502, detail="Naver Maps 애플리케이션에서 Reverse Geocoding API를 선택해 주세요.") from exc
        if exc.response.status_code == 429:
            raise HTTPException(status_code=502, detail="Reverse Geocoding API 이용 한도를 확인해 주세요.") from exc
        raise HTTPException(status_code=502, detail="선택한 위치의 주소를 확인하지 못했습니다.") from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail="선택한 위치의 주소를 확인하지 못했습니다.") from exc

    results = response.json().get("results", [])
    road_address = next((_reverse_address_text(item) for item in results if item.get("name") == "roadaddr"), "")
    jibun_address = next((_reverse_address_text(item) for item in results if item.get("name") == "addr"), "")
    if not road_address and not jibun_address:
        raise HTTPException(status_code=404, detail="선택한 위치에서 주소를 찾을 수 없습니다. 건물이나 도로에 더 가까운 위치를 선택해 주세요.")
    return GeocodeResult(
        road_address=road_address or jibun_address,
        jibun_address=jibun_address or None,
        latitude=latitude,
        longitude=longitude,
    )


@app.get("/api/v1/dashboard/summary", response_model=DashboardSummary)
def dashboard(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    counts = {status.value.lower(): db.scalar(select(func.count(Project.id)).where(Project.status == status, Project.deleted_at.is_(None))) or 0 for status in ProjectStatus}
    total_contract = db.scalar(
        select(func.coalesce(func.sum(EstimateDocument.total_amount), 0))
        .join(Project, Project.contract_estimate_id == EstimateDocument.id)
        .where(Project.deleted_at.is_(None))
    ) or 0
    total_extra = 0
    total_paid = db.scalar(select(func.coalesce(func.sum(Payment.total_amount), 0)).where(Payment.deleted_at.is_(None))) or 0
    return DashboardSummary(total=sum(counts.values()), planning=counts["planning"], in_progress=counts["in_progress"], completed=counts["completed"], on_hold=counts["on_hold"], cancelled=counts["cancelled"], total_contract=int(total_contract), total_extra=int(total_extra), total_paid=int(total_paid))


@app.get("/api/v1/projects", response_model=ProjectList)
def list_projects(page: int = Query(1, ge=1), page_size: int = Query(12, ge=1, le=100), status_filter: ProjectStatus | None = Query(None, alias="status"), q: str | None = None, sort_by: str = Query("updated_at", alias="sort", pattern="^(created_at|updated_at)$"), archived: bool = False, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    conditions = [Project.deleted_at.is_not(None) if archived else Project.deleted_at.is_(None)]
    if status_filter:
        conditions.append(Project.status == status_filter)
    if q:
        like = f"%{q}%"
        conditions.append(or_(Project.title.ilike(like), Project.address.ilike(like), Project.customer_name.ilike(like)))
    total = db.scalar(select(func.count(Project.id)).where(*conditions)) or 0
    order_column = Project.created_at if sort_by == "created_at" else Project.updated_at
    projects = db.scalars(select(Project).options(joinedload(Project.images)).where(*conditions).order_by(order_column.desc(), Project.id.desc()).offset((page - 1) * page_size).limit(page_size)).unique().all()
    items = []
    for project in projects:
        active_images = [image for image in sorted(project.images, key=lambda x: x.sort_order) if image.deleted_at is None]
        cover = next((image for image in active_images if image.is_cover), None) or next(iter(active_images), None)
        items.append(ProjectListItem.model_validate({**project.__dict__, "cover_image": cover}))
    return ProjectList(items=items, page=page, page_size=page_size, total=total)


@app.post("/api/v1/projects", response_model=ProjectOut, status_code=201)
def create_project(payload: ProjectCreate, user: User = Depends(require_admin), db: Session = Depends(get_db)):
    project = Project(**payload.model_dump(), created_by=user.id)
    db.add(project)
    db.flush()
    db.add(ProjectStatusHistory(project_id=project.id, to_status=project.status, changed_by=user.id, note="현장 등록"))
    db.commit()
    db.refresh(project)
    return project


@app.get("/api/v1/projects/{project_id}", response_model=ProjectOut)
def get_project(project_id: UUID, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    return project_or_404(db, project_id)


@app.patch("/api/v1/projects/{project_id}", response_model=ProjectOut)
def update_project(project_id: UUID, payload: ProjectUpdate, user: User = Depends(require_admin), db: Session = Depends(get_db)):
    project = project_or_404(db, project_id)
    changes = payload.model_dump(exclude_unset=True)
    old_status = project.status
    for key, value in changes.items():
        setattr(project, key, value)
    if "status" in changes and changes["status"] != old_status:
        db.add(ProjectStatusHistory(project_id=project.id, from_status=old_status, to_status=changes["status"], changed_by=user.id, note="현장 정보 수정 중 상태 변경"))
    db.commit()
    db.refresh(project)
    return project_or_404(db, project.id)


@app.delete("/api/v1/projects/{project_id}", status_code=204)
def delete_project(project_id: UUID, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    project = project_or_404(db, project_id)
    project.deleted_at = datetime.now(timezone.utc)
    db.commit()


@app.patch("/api/v1/projects/{project_id}/restore", response_model=ProjectOut)
def restore_project(project_id: UUID, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    project = db.scalar(select(Project).where(Project.id == project_id, Project.deleted_at.is_not(None)))
    if not project:
        raise HTTPException(status_code=404, detail="삭제된 현장을 찾을 수 없습니다.")
    project.deleted_at = None
    db.commit()
    return project_or_404(db, project.id)


@app.patch("/api/v1/projects/{project_id}/status", response_model=ProjectOut)
def change_status(project_id: UUID, payload: StatusChange, user: User = Depends(require_admin), db: Session = Depends(get_db)):
    project = project_or_404(db, project_id)
    if project.status != payload.status:
        old = project.status
        project.status = payload.status
        if payload.status == ProjectStatus.COMPLETED and not project.actual_end_date:
            project.actual_end_date = datetime.now(timezone.utc).date()
        db.add(ProjectStatusHistory(project_id=project.id, from_status=old, to_status=payload.status, changed_by=user.id, note=payload.note))
        db.commit()
    return project_or_404(db, project.id)


@app.get("/api/v1/projects/{project_id}/status-history", response_model=list[StatusHistoryOut])
def status_history(project_id: UUID, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    project_or_404(db, project_id)
    return db.scalars(select(ProjectStatusHistory).where(ProjectStatusHistory.project_id == project_id).order_by(ProjectStatusHistory.created_at.desc())).all()


@app.get("/api/v1/projects/{project_id}/costs", response_model=dict)
def list_costs(project_id: UUID, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    project_or_404(db, project_id)
    estimate = contract_estimate_for_project(db, project_id)
    if not estimate:
        return {
            "items": [],
            "estimate": None,
            "summary": CostSummary(
                contract=0,
                final_total=0,
                supply_total=0,
                vat_total=0,
            ),
        }
    items = [
        ContractEstimateLineOut(
            id=line.id,
            project_id=project_id,
            category=line.category,
            name=line.name,
            specification=line.specification,
            quantity=line.quantity,
            unit=line.unit,
            unit_price=line.unit_price,
            supply_amount=line.supply_amount,
            vat_amount=line.vat_amount,
            amount=line.total_amount,
            memo=line.memo,
            created_at=estimate.created_at,
        )
        for line in estimate.lines
    ]
    return {
        "items": items,
        "estimate": ContractEstimateReference(
            id=estimate.id,
            inquiry_id=estimate.inquiry_id,
            version=estimate.version,
            title=estimate.title,
            total_amount=estimate.total_amount,
        ),
        "summary": CostSummary(
            contract=estimate.total_amount,
            final_total=estimate.total_amount,
            supply_total=estimate.supply_amount,
            vat_total=estimate.vat_amount,
        ),
    }


@app.get("/api/v1/projects/{project_id}/payments", response_model=dict)
def list_payments(project_id: UUID, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    project_or_404(db, project_id)
    payments = db.scalars(select(Payment).where(Payment.project_id == project_id, Payment.deleted_at.is_(None)).order_by(Payment.paid_at.desc().nullslast(), Payment.created_at.desc())).all()
    return {"items": [PaymentOut.model_validate(item) for item in payments], "summary": project_finance_summary(db, project_id)}


@app.post("/api/v1/projects/{project_id}/payments", response_model=PaymentOut, status_code=201)
def create_payment(project_id: UUID, payload: PaymentCreate, user: User = Depends(require_admin), db: Session = Depends(get_db)):
    project_or_404(db, project_id)
    values = payload.model_dump()
    values["paid_at"] = values["paid_at"] or datetime.now(timezone.utc)
    payment = Payment(project_id=project_id, created_by=user.id, total_amount=values["supply_amount"] + values["vat_amount"], **values)
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


@app.patch("/api/v1/projects/{project_id}/payments/{payment_id}", response_model=PaymentOut)
def update_payment(project_id: UUID, payment_id: UUID, payload: PaymentUpdate, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    payment = db.scalar(select(Payment).where(Payment.id == payment_id, Payment.project_id == project_id, Payment.deleted_at.is_(None)))
    if not payment:
        raise HTTPException(status_code=404, detail="입금 내역을 찾을 수 없습니다.")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(payment, key, value)
    payment.total_amount = payment.supply_amount + payment.vat_amount
    db.commit()
    db.refresh(payment)
    return payment


@app.delete("/api/v1/projects/{project_id}/payments/{payment_id}", status_code=204)
def delete_payment(project_id: UUID, payment_id: UUID, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    payment = db.scalar(select(Payment).where(Payment.id == payment_id, Payment.project_id == project_id, Payment.deleted_at.is_(None)))
    if not payment:
        raise HTTPException(status_code=404, detail="입금 내역을 찾을 수 없습니다.")
    payment.deleted_at = datetime.now(timezone.utc)
    db.commit()


@app.post("/api/v1/projects/{project_id}/images", response_model=ImageOut, status_code=201)
def upload_image(project_id: UUID, category: ImageCategory = Query(ImageCategory.ETC), is_public: bool = Query(False), is_cover: bool = Query(False), file: UploadFile = File(...), _: User = Depends(require_admin), db: Session = Depends(get_db)):
    project_or_404(db, project_id)
    try:
        storage_key, url, size = save_upload(str(project_id), file)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    has_active_cover = db.scalar(select(ProjectImage.id).where(ProjectImage.project_id == project_id, ProjectImage.is_cover.is_(True), ProjectImage.deleted_at.is_(None)).limit(1)) is not None
    is_cover = is_cover or not has_active_cover
    if is_cover:
        db.query(ProjectImage).filter(ProjectImage.project_id == project_id, ProjectImage.is_cover.is_(True)).update({"is_cover": False})
    next_order = db.scalar(select(func.coalesce(func.max(ProjectImage.sort_order), -1) + 1).where(ProjectImage.project_id == project_id, ProjectImage.deleted_at.is_(None))) or 0
    image = ProjectImage(project_id=project_id, category=category, storage_key=storage_key, original_url=url, thumbnail_url=url, original_filename=file.filename or "image", mime_type=file.content_type or "application/octet-stream", file_size=size, sort_order=int(next_order), is_cover=is_cover, is_public=is_public)
    db.add(image)
    db.commit()
    db.refresh(image)
    return image


@app.get("/api/v1/images", response_model=AdminImageList)
def list_all_images(
    page: int = Query(1, ge=1),
    page_size: int = Query(48, ge=1, le=100),
    project_id: UUID | None = None,
    classification: str | None = None,
    is_public: bool | None = None,
    q: str | None = None,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    conditions = [
        ProjectImage.deleted_at.is_(None),
        Project.deleted_at.is_(None),
    ]
    if project_id:
        conditions.append(ProjectImage.project_id == project_id)
    if classification == "__unclassified__":
        conditions.append(or_(ProjectImage.classification.is_(None), ProjectImage.classification == ""))
    elif classification:
        conditions.append(ProjectImage.classification == classification)
    if is_public is not None:
        conditions.append(ProjectImage.is_public.is_(is_public))
    if q and q.strip():
        keyword = f"%{q.strip()}%"
        conditions.append(or_(Project.title.ilike(keyword), ProjectImage.original_filename.ilike(keyword), ProjectImage.classification.ilike(keyword)))

    total = db.scalar(
        select(func.count(ProjectImage.id))
        .join(Project, Project.id == ProjectImage.project_id)
        .where(*conditions)
    ) or 0
    rows = db.execute(
        select(ProjectImage, Project.title, Project.status, Project.address)
        .join(Project, Project.id == ProjectImage.project_id)
        .where(*conditions)
        .order_by(ProjectImage.created_at.desc(), ProjectImage.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    classifications = db.scalars(
        select(ProjectImage.classification)
        .join(Project, Project.id == ProjectImage.project_id)
        .where(
            ProjectImage.deleted_at.is_(None),
            Project.deleted_at.is_(None),
            ProjectImage.classification.is_not(None),
            ProjectImage.classification != "",
        )
        .distinct()
        .order_by(ProjectImage.classification)
    ).all()
    items = [
        AdminImageOut.model_validate(
            {
                **image.__dict__,
                "project_title": project_title,
                "project_status": project_status,
                "project_address": project_address,
            }
        )
        for image, project_title, project_status, project_address in rows
    ]
    return AdminImageList(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        classifications=[value for value in classifications if value],
    )


@app.get("/api/v1/projects/{project_id}/images", response_model=list[ImageOut])
def list_images(project_id: UUID, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    project_or_404(db, project_id)
    return db.scalars(select(ProjectImage).where(ProjectImage.project_id == project_id, ProjectImage.deleted_at.is_(None)).order_by(ProjectImage.sort_order)).all()


@app.patch("/api/v1/projects/{project_id}/images/{image_id}", response_model=ImageOut)
def update_image(project_id: UUID, image_id: UUID, payload: ImageUpdate, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    image = db.scalar(select(ProjectImage).where(ProjectImage.id == image_id, ProjectImage.project_id == project_id, ProjectImage.deleted_at.is_(None)))
    if not image:
        raise HTTPException(status_code=404, detail="사진을 찾을 수 없습니다.")
    values = payload.model_dump(exclude_unset=True)
    if values.get("is_cover"):
        db.query(ProjectImage).filter(ProjectImage.project_id == project_id, ProjectImage.id != image_id, ProjectImage.deleted_at.is_(None)).update({"is_cover": False})
    for key, value in values.items():
        setattr(image, key, value)
    db.commit()
    db.refresh(image)
    return image


@app.delete("/api/v1/projects/{project_id}/images/{image_id}", status_code=204)
def delete_image(project_id: UUID, image_id: UUID, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    image = db.scalar(select(ProjectImage).where(ProjectImage.id == image_id, ProjectImage.project_id == project_id, ProjectImage.deleted_at.is_(None)))
    if not image:
        raise HTTPException(status_code=404, detail="사진을 찾을 수 없습니다.")
    was_cover = image.is_cover
    image.is_cover = False
    image.deleted_at = datetime.now(timezone.utc)
    if was_cover:
        replacement = db.scalar(select(ProjectImage).where(ProjectImage.project_id == project_id, ProjectImage.id != image_id, ProjectImage.deleted_at.is_(None)).order_by(ProjectImage.sort_order, ProjectImage.created_at).limit(1))
        if replacement:
            replacement.is_cover = True
    db.commit()


def inquiry_list_item(inquiry: EstimateInquiry, converted_project_archived: bool = False) -> InquiryListItem:
    latest = max(inquiry.estimates, key=lambda item: item.version, default=None)
    return InquiryListItem.model_validate({
        **inquiry.__dict__,
        "converted_project_archived": converted_project_archived,
        "latest_estimate": latest,
    })


@app.get("/api/v1/estimate-inquiries/stats", response_model=InquiryStats)
def estimate_inquiry_stats(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    today = date.today()
    month_start = today.replace(day=1)
    conditions = [EstimateInquiry.deleted_at.is_(None)]
    inquiries = db.execute(
        select(EstimateInquiry)
        .options(joinedload(EstimateInquiry.estimates).joinedload(EstimateDocument.lines))
        .where(*conditions)
    ).unique().scalars().all()
    status_counts = {status.value: sum(1 for item in inquiries if item.status == status) for status in InquiryStatus}
    terminal = {InquiryStatus.CONTRACTED, InquiryStatus.LOST}
    active = [item for item in inquiries if item.status not in terminal]
    contracted = status_counts[InquiryStatus.CONTRACTED.value]
    lost = status_counts[InquiryStatus.LOST.value]
    decided = contracted + lost
    return InquiryStats(
        total=len(inquiries),
        new_this_month=sum(1 for item in inquiries if item.created_at.date() >= month_start),
        active=len(active),
        contracted=contracted,
        lost=lost,
        conversion_rate=round(contracted / decided * 100, 1) if decided else 0,
        status_counts=status_counts,
    )


@app.get("/api/v1/estimate-inquiries", response_model=InquiryList)
def list_estimate_inquiries(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: InquiryStatus | None = Query(None, alias="status"),
    q: str | None = None,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    conditions = [EstimateInquiry.deleted_at.is_(None)]
    if status_filter:
        conditions.append(EstimateInquiry.status == status_filter)
    if q:
        like = f"%{q}%"
        conditions.append(or_(
            EstimateInquiry.customer_name.ilike(like),
            EstimateInquiry.customer_phone.ilike(like),
            EstimateInquiry.address.ilike(like),
        ))
    total = db.scalar(select(func.count(EstimateInquiry.id)).where(*conditions)) or 0
    inquiries = db.execute(
        select(EstimateInquiry)
        .options(joinedload(EstimateInquiry.estimates).joinedload(EstimateDocument.lines))
        .where(*conditions)
        .order_by(EstimateInquiry.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).unique().scalars().all()
    converted_project_ids = [item.converted_project_id for item in inquiries if item.converted_project_id]
    archived_project_ids = set(db.scalars(
        select(Project.id).where(
            Project.id.in_(converted_project_ids),
            Project.deleted_at.is_not(None),
        )
    ).all()) if converted_project_ids else set()
    return InquiryList(
        items=[
            inquiry_list_item(item, item.converted_project_id in archived_project_ids)
            for item in inquiries
        ],
        page=page,
        page_size=page_size,
        total=total,
    )


@app.post("/api/v1/estimate-inquiries", response_model=InquiryOut, status_code=201)
def create_estimate_inquiry(payload: InquiryCreate, user: User = Depends(require_admin), db: Session = Depends(get_db)):
    inquiry = EstimateInquiry(**payload.model_dump(), created_by=user.id)
    db.add(inquiry)
    db.commit()
    return inquiry_or_404(db, inquiry.id)


@app.get("/api/v1/estimate-inquiries/{inquiry_id}", response_model=InquiryOut)
def get_estimate_inquiry(inquiry_id: UUID, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    inquiry = inquiry_or_404(db, inquiry_id)
    converted_project_archived = bool(inquiry.converted_project_id and db.scalar(
        select(Project.id).where(
            Project.id == inquiry.converted_project_id,
            Project.deleted_at.is_not(None),
        )
    ))
    return InquiryOut.model_validate({
        **inquiry.__dict__,
        "converted_project_archived": converted_project_archived,
        "estimates": sorted(inquiry.estimates, key=lambda item: item.version, reverse=True),
    })


@app.patch("/api/v1/estimate-inquiries/{inquiry_id}", response_model=InquiryOut)
def update_estimate_inquiry(inquiry_id: UUID, payload: InquiryUpdate, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    inquiry = inquiry_or_404(db, inquiry_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(inquiry, key, value)
    db.commit()
    return inquiry_or_404(db, inquiry.id)


@app.delete("/api/v1/estimate-inquiries/{inquiry_id}", status_code=204)
def delete_estimate_inquiry(inquiry_id: UUID, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    inquiry = inquiry_or_404(db, inquiry_id)
    inquiry.deleted_at = datetime.now(timezone.utc)
    db.commit()


@app.post("/api/v1/estimate-inquiries/{inquiry_id}/estimates", response_model=EstimateOut, status_code=201)
def create_estimate_document(inquiry_id: UUID, payload: EstimateCreate, user: User = Depends(require_admin), db: Session = Depends(get_db)):
    inquiry = inquiry_or_404(db, inquiry_id)
    version = (db.scalar(select(func.max(EstimateDocument.version)).where(EstimateDocument.inquiry_id == inquiry_id)) or 0) + 1
    values = payload.model_dump(exclude={"lines"})
    estimate = EstimateDocument(inquiry_id=inquiry_id, version=version, created_by=user.id, **values)
    db.add(estimate)
    db.flush()
    replace_estimate_lines(estimate, payload.lines, db)
    if inquiry.status in (InquiryStatus.NEW, InquiryStatus.CONSULTATION_SCHEDULED, InquiryStatus.SITE_VISIT_COMPLETED):
        inquiry.status = InquiryStatus.ESTIMATE_DRAFTING
    db.commit()
    return db.execute(select(EstimateDocument).options(joinedload(EstimateDocument.lines)).where(EstimateDocument.id == estimate.id)).unique().scalar_one()


@app.patch("/api/v1/estimate-inquiries/{inquiry_id}/estimates/{estimate_id}", response_model=EstimateOut)
def update_estimate_document(inquiry_id: UUID, estimate_id: UUID, payload: EstimateUpdate, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    inquiry = inquiry_or_404(db, inquiry_id)
    estimate = db.execute(
        select(EstimateDocument).options(joinedload(EstimateDocument.lines)).where(
            EstimateDocument.id == estimate_id,
            EstimateDocument.inquiry_id == inquiry_id,
        )
    ).unique().scalar_one_or_none()
    if not estimate:
        raise HTTPException(status_code=404, detail="견적서를 찾을 수 없습니다.")
    changes = payload.model_dump(exclude_unset=True, exclude={"lines"})
    for key, value in changes.items():
        setattr(estimate, key, value)
    if payload.lines is not None:
        replace_estimate_lines(estimate, payload.lines, db)
    db.commit()
    return db.execute(select(EstimateDocument).options(joinedload(EstimateDocument.lines)).where(EstimateDocument.id == estimate.id)).unique().scalar_one()


@app.delete("/api/v1/estimate-inquiries/{inquiry_id}/estimates/{estimate_id}", status_code=204)
def delete_estimate_document(inquiry_id: UUID, estimate_id: UUID, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    estimate = db.scalar(select(EstimateDocument).where(EstimateDocument.id == estimate_id, EstimateDocument.inquiry_id == inquiry_id))
    if not estimate:
        raise HTTPException(status_code=404, detail="견적서를 찾을 수 없습니다.")
    db.delete(estimate)
    db.commit()


@app.post("/api/v1/estimate-inquiries/{inquiry_id}/convert", response_model=ProjectOut, status_code=201)
def convert_inquiry_to_project(inquiry_id: UUID, payload: InquiryConvert, user: User = Depends(require_admin), db: Session = Depends(get_db)):
    inquiry = inquiry_or_404(db, inquiry_id)
    if inquiry.converted_project_id:
        raise HTTPException(status_code=409, detail="이미 현장으로 전환된 견적 문의입니다.")
    latest = max(inquiry.estimates, key=lambda item: item.version, default=None)
    project = Project(
        title=payload.project_title or f"{inquiry.customer_name} 고객 현장",
        customer_name=inquiry.customer_name,
        customer_phone=inquiry.customer_phone,
        status=ProjectStatus.PLANNING,
        housing_type=inquiry.housing_type,
        area_pyeong=inquiry.area_pyeong,
        work_scope=inquiry.request_details,
        description=None,
        internal_memo=inquiry.memo,
        address=inquiry.address or "주소 미정",
        address_detail=inquiry.address_detail,
        planned_start_date=payload.planned_start_date,
        planned_end_date=payload.planned_end_date,
        contract_estimate_id=latest.id if latest else None,
        created_by=user.id,
    )
    db.add(project)
    db.flush()
    db.add(ProjectStatusHistory(project_id=project.id, to_status=ProjectStatus.PLANNING, changed_by=user.id, note="견적 상담에서 계약 전환"))
    inquiry.status = InquiryStatus.CONTRACTED
    inquiry.converted_project_id = project.id
    db.commit()
    return project_or_404(db, project.id)


@app.get("/api/v1/public/projects", response_model=list[PublicProjectListItem])
def public_projects(db: Session = Depends(get_db)):
    projects = db.scalars(select(Project).options(joinedload(Project.images)).where(Project.is_public.is_(True), Project.status == ProjectStatus.COMPLETED, Project.deleted_at.is_(None)).order_by(Project.actual_end_date.desc().nullslast(), Project.updated_at.desc())).unique().all()
    return [
        PublicProjectListItem(
            id=project.id,
            title=project.title,
            status=project.status,
            public_address=project.address,
            housing_type=project.housing_type,
            area_pyeong=project.area_pyeong,
            actual_end_date=project.actual_end_date,
            cover_image=PublicImageOut.model_validate(next((i for i in project.images if i.is_cover and i.is_public and i.deleted_at is None), None), from_attributes=True) if next((i for i in project.images if i.is_cover and i.is_public and i.deleted_at is None), None) else None,
        )
        for project in projects
    ]


@app.get("/api/v1/public/projects/{project_id}", response_model=PublicProjectOut)
def public_project(project_id: UUID, db: Session = Depends(get_db)):
    project = db.scalar(select(Project).options(joinedload(Project.images)).where(Project.id == project_id, Project.is_public.is_(True), Project.status == ProjectStatus.COMPLETED, Project.deleted_at.is_(None)))
    if not project:
        raise HTTPException(status_code=404, detail="공개된 시공 사례를 찾을 수 없습니다.")
    public_images = [PublicImageOut.model_validate(image, from_attributes=True) for image in sorted(project.images, key=lambda item: item.sort_order) if image.is_public and image.deleted_at is None]
    cover = next((image for image in public_images if image.is_cover), None)
    return PublicProjectOut(
        id=project.id,
        title=project.title,
        status=project.status,
        public_address=project.address,
        housing_type=project.housing_type,
        area_pyeong=project.area_pyeong,
        actual_end_date=project.actual_end_date,
        cover_image=cover,
        description=None,
        work_scope=project.work_scope or project.description,
        latitude=project.latitude,
        longitude=project.longitude,
        images=public_images,
    )
