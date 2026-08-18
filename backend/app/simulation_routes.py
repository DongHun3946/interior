from copy import deepcopy
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from .db import get_db
from .models import AIJob, AIJobStatus, AIJobType, AssetSourceType, DesignAsset, MaterialType, ProcessingStatus, Project, ScanSourceType, Simulation, SimulationStatus, SimulationVersion, SpaceScan, SurfaceMaterial, User
from .security import get_current_user
from .simulation_schemas import AIJobOut, AssetCreate, AssetOut, GenerationRequest, MaterialOut, ScanCreate, ScanOut, SceneUpdate, SimulationCreate, SimulationOut, SimulationUpdate, VersionCreate, VersionOut
from .storage import save_scan_upload, save_upload

router = APIRouter(prefix="/api/v1", tags=["interior-simulation"])


def default_scene() -> dict:
    return {
        "schema_version": "1.0",
        "units": "meter",
        "structure": {
            "rooms": [{
                "id": "room-1", "name": "거실", "x": 0, "z": 0,
                "width": 4.8, "depth": 3.8, "height": 2.4,
                "floor_material_id": None, "wall_material_id": None,
                "floor_color": "#d8c7ad", "wall_color": "#f3f0e9",
            }],
            "walls": [], "openings": [], "surfaces": [],
        },
        "placements": [],
        "materials": [],
        "source": {"type": "MANUAL", "scan_id": None, "scale_confidence": 1},
    }


def validate_scene(scene: dict) -> None:
    if scene.get("schema_version") != "1.0" or scene.get("units") != "meter":
        raise HTTPException(status_code=422, detail="지원하는 공간 모델은 schema_version 1.0, meter 단위입니다.")
    structure = scene.get("structure")
    if not isinstance(structure, dict) or not isinstance(structure.get("rooms"), list) or not structure["rooms"]:
        raise HTTPException(status_code=422, detail="공간 모델에는 한 개 이상의 방이 필요합니다.")
    if not isinstance(scene.get("placements", []), list):
        raise HTTPException(status_code=422, detail="가구 배치 정보 형식이 올바르지 않습니다.")
    for room in structure["rooms"]:
        try:
            dimensions = (float(room["width"]), float(room["depth"]), float(room["height"]))
        except (KeyError, TypeError, ValueError):
            raise HTTPException(status_code=422, detail="방의 폭, 깊이, 높이를 숫자로 입력해 주세요.")
        if any(value <= 0 or value > 100 for value in dimensions):
            raise HTTPException(status_code=422, detail="방 치수는 0보다 크고 100m 이하여야 합니다.")


def project_exists(db: Session, project_id: UUID) -> None:
    if not db.scalar(select(Project.id).where(Project.id == project_id, Project.deleted_at.is_(None))):
        raise HTTPException(status_code=404, detail="현장을 찾을 수 없습니다.")


def simulation_query():
    return select(Simulation).options(selectinload(Simulation.versions)).where(Simulation.deleted_at.is_(None))


def simulation_or_404(db: Session, simulation_id: UUID) -> Simulation:
    item = db.scalar(simulation_query().where(Simulation.id == simulation_id))
    if not item:
        raise HTTPException(status_code=404, detail="시뮬레이션을 찾을 수 없습니다.")
    return item


def version_or_404(db: Session, version_id: UUID) -> SimulationVersion:
    item = db.get(SimulationVersion, version_id)
    if not item:
        raise HTTPException(status_code=404, detail="시뮬레이션 버전을 찾을 수 없습니다.")
    return item


@router.get("/projects/{project_id}/simulations", response_model=list[SimulationOut])
def list_simulations(project_id: UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    project_exists(db, project_id)
    return db.scalars(simulation_query().where(Simulation.project_id == project_id).order_by(Simulation.updated_at.desc())).all()


@router.post("/projects/{project_id}/simulations", response_model=SimulationOut, status_code=201)
def create_simulation(project_id: UUID, payload: SimulationCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project_exists(db, project_id)
    simulation = Simulation(project_id=project_id, name=payload.name, created_by=user.id)
    db.add(simulation)
    db.flush()
    version = SimulationVersion(simulation_id=simulation.id, version=1, scene_json=default_scene(), created_by=user.id)
    db.add(version)
    db.flush()
    simulation.current_version_id = version.id
    db.commit()
    return simulation_or_404(db, simulation.id)


@router.get("/simulations/{simulation_id}", response_model=SimulationOut)
def get_simulation(simulation_id: UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return simulation_or_404(db, simulation_id)


@router.patch("/simulations/{simulation_id}", response_model=SimulationOut)
def update_simulation(simulation_id: UUID, payload: SimulationUpdate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    item = simulation_or_404(db, simulation_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    return simulation_or_404(db, simulation_id)


@router.delete("/simulations/{simulation_id}", status_code=204)
def delete_simulation(simulation_id: UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    item = simulation_or_404(db, simulation_id)
    item.deleted_at = datetime.now(timezone.utc)
    item.status = SimulationStatus.ARCHIVED
    db.commit()


@router.get("/simulations/{simulation_id}/versions", response_model=list[VersionOut])
def list_versions(simulation_id: UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    simulation_or_404(db, simulation_id)
    return db.scalars(select(SimulationVersion).where(SimulationVersion.simulation_id == simulation_id).order_by(SimulationVersion.version.desc())).all()


@router.post("/simulations/{simulation_id}/versions", response_model=VersionOut, status_code=201)
def create_version(simulation_id: UUID, payload: VersionCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    simulation = simulation_or_404(db, simulation_id)
    validate_scene(payload.scene_json)
    next_version = (db.scalar(select(func.max(SimulationVersion.version)).where(SimulationVersion.simulation_id == simulation_id)) or 0) + 1
    version = SimulationVersion(
        simulation_id=simulation_id, version=next_version, scene_json=deepcopy(payload.scene_json),
        source_scan_id=payload.source_scan_id, created_by=user.id,
    )
    db.add(version)
    db.flush()
    simulation.current_version_id = version.id
    db.commit()
    db.refresh(version)
    return version


@router.get("/simulation-versions/{version_id}/scene", response_model=VersionOut)
def get_scene(version_id: UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return version_or_404(db, version_id)


@router.put("/simulation-versions/{version_id}/scene", response_model=VersionOut)
def update_scene(version_id: UUID, payload: SceneUpdate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    version = version_or_404(db, version_id)
    simulation = simulation_or_404(db, version.simulation_id)
    if simulation.current_version_id != version.id:
        raise HTTPException(status_code=409, detail="지난 버전은 직접 수정할 수 없습니다. 새 버전을 만든 뒤 수정해 주세요.")
    validate_scene(payload.scene_json)
    version.scene_json = deepcopy(payload.scene_json)
    version.verified_at = None
    db.commit()
    db.refresh(version)
    return version


@router.post("/simulation-versions/{version_id}/verify", response_model=VersionOut)
def verify_scene(version_id: UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    version = version_or_404(db, version_id)
    validate_scene(version.scene_json)
    version.verified_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(version)
    return version


@router.get("/projects/{project_id}/materials", response_model=list[MaterialOut])
def list_materials(project_id: UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    project_exists(db, project_id)
    return db.scalars(select(SurfaceMaterial).where(SurfaceMaterial.deleted_at.is_(None), or_(SurfaceMaterial.owner_project_id == project_id, SurfaceMaterial.owner_project_id.is_(None))).order_by(SurfaceMaterial.created_at.desc())).all()


@router.post("/projects/{project_id}/materials", response_model=MaterialOut, status_code=201)
def create_material(
    project_id: UUID,
    name: str = Form(...),
    material_type: MaterialType = Form(MaterialType.OTHER),
    real_width: float = Form(1),
    real_height: float = Form(1),
    seamless: bool = Form(False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    project_exists(db, project_id)
    if not name.strip() or real_width <= 0 or real_height <= 0:
        raise HTTPException(status_code=422, detail="재질명과 실제 크기를 올바르게 입력해 주세요.")
    try:
        _, url, _ = save_upload(f"materials/{project_id}", file)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    material = SurfaceMaterial(owner_project_id=project_id, material_type=material_type, name=name.strip(), albedo_url=url, real_width=real_width, real_height=real_height, seamless=seamless)
    db.add(material)
    db.commit()
    db.refresh(material)
    return material


@router.get("/projects/{project_id}/assets", response_model=list[AssetOut])
def list_assets(project_id: UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    project_exists(db, project_id)
    return db.scalars(select(DesignAsset).where(DesignAsset.deleted_at.is_(None), or_(DesignAsset.owner_project_id == project_id, DesignAsset.owner_project_id.is_(None))).order_by(DesignAsset.created_at.desc())).all()


@router.post("/design-assets", response_model=AssetOut, status_code=201)
def create_asset(payload: AssetCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    if payload.owner_project_id:
        project_exists(db, payload.owner_project_id)
    item = DesignAsset(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.post("/simulations/{simulation_id}/scans", response_model=ScanOut, status_code=201)
def create_scan(simulation_id: UUID, payload: ScanCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    simulation_or_404(db, simulation_id)
    status = ProcessingStatus.COMPLETE if payload.source_type == ScanSourceType.MANUAL else ProcessingStatus.UPLOADING
    item = SpaceScan(simulation_id=simulation_id, source_type=payload.source_type, status=status, input_manifest=payload.input_manifest, result_scene_json=default_scene() if status == ProcessingStatus.COMPLETE else None)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.post("/simulations/{simulation_id}/scan-files", response_model=ScanOut, status_code=201)
def upload_scan_files(
    simulation_id: UUID,
    source_type: ScanSourceType = Form(...),
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    simulation_or_404(db, simulation_id)
    if source_type not in (ScanSourceType.PHOTOS, ScanSourceType.VIDEO, ScanSourceType.ROOMPLAN):
        raise HTTPException(status_code=422, detail="사진, 동영상 또는 RoomPlan 파일만 업로드할 수 있습니다.")
    if not files:
        raise HTTPException(status_code=422, detail="분석할 파일을 선택해 주세요.")
    manifest_files = []
    try:
        for upload in files:
            key, url, size = save_scan_upload(str(simulation_id), upload)
            manifest_files.append({"storage_key": key, "url": url, "size": size, "mime_type": upload.content_type, "filename": upload.filename})
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    item = SpaceScan(simulation_id=simulation_id, source_type=source_type, status=ProcessingStatus.UPLOADING, input_manifest={"files": manifest_files})
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/simulations/{simulation_id}/scans", response_model=list[ScanOut])
def list_scans(simulation_id: UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    simulation_or_404(db, simulation_id)
    return db.scalars(select(SpaceScan).where(SpaceScan.simulation_id == simulation_id).order_by(SpaceScan.created_at.desc())).all()


@router.post("/space-scans/{scan_id}/process", response_model=AIJobOut, status_code=202)
def process_scan(scan_id: UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    scan = db.get(SpaceScan, scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="공간 스캔을 찾을 수 없습니다.")
    if scan.source_type == ScanSourceType.MANUAL:
        raise HTTPException(status_code=409, detail="수동 공간은 AI 분석이 필요하지 않습니다.")
    scan.status = ProcessingStatus.QUEUED
    job = AIJob(job_type=AIJobType.ROOM_SCAN, target_id=scan.id, input_json=scan.input_manifest)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.post("/design-assets/generate", response_model=AIJobOut, status_code=202)
def generate_asset(payload: GenerationRequest, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    if payload.project_id:
        project_exists(db, payload.project_id)
    if not payload.image_urls:
        raise HTTPException(status_code=422, detail="가구를 여러 각도에서 촬영한 이미지가 한 장 이상 필요합니다.")
    target_id = payload.project_id or UUID(int=0)
    job = AIJob(job_type=AIJobType.FURNITURE_3D, target_id=target_id, provider=payload.provider, input_json={"image_urls": payload.image_urls})
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.post("/projects/{project_id}/design-assets/generate-from-files", response_model=AIJobOut, status_code=202)
def generate_asset_from_files(
    project_id: UUID,
    files: list[UploadFile] = File(...),
    provider: str = Form("pending-provider"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    project_exists(db, project_id)
    if not files:
        raise HTTPException(status_code=422, detail="가구 사진을 선택해 주세요.")
    uploaded = []
    try:
        for upload in files:
            key, url, size = save_upload(f"assets/{project_id}", upload)
            uploaded.append({"storage_key": key, "url": url, "size": size, "mime_type": upload.content_type, "filename": upload.filename})
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    job = AIJob(job_type=AIJobType.FURNITURE_3D, target_id=project_id, provider=provider, input_json={"files": uploaded})
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.get("/ai-jobs/{job_id}", response_model=AIJobOut)
def get_ai_job(job_id: UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    job = db.get(AIJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="AI 작업을 찾을 수 없습니다.")
    return job


@router.post("/ai-jobs/{job_id}/cancel", response_model=AIJobOut)
def cancel_ai_job(job_id: UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    job = db.get(AIJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="AI 작업을 찾을 수 없습니다.")
    if job.status not in (AIJobStatus.QUEUED, AIJobStatus.RUNNING):
        raise HTTPException(status_code=409, detail="대기 또는 실행 중인 작업만 취소할 수 있습니다.")
    job.status = AIJobStatus.CANCELLED
    db.commit()
    db.refresh(job)
    return job


@router.post("/ai-jobs/{job_id}/retry", response_model=AIJobOut)
def retry_ai_job(job_id: UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    job = db.get(AIJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="AI 작업을 찾을 수 없습니다.")
    if job.status not in (AIJobStatus.FAILED, AIJobStatus.CANCELLED):
        raise HTTPException(status_code=409, detail="실패하거나 취소된 작업만 다시 시도할 수 있습니다.")
    job.status = AIJobStatus.QUEUED
    job.progress = 0
    job.error_message = None
    job.attempt_count += 1
    db.commit()
    db.refresh(job)
    return job
