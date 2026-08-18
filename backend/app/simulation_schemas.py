from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from .models import AIJobStatus, AIJobType, AssetSourceType, AssetType, MaterialType, ProcessingStatus, ScanSourceType, SimulationStatus


class SimulationCreate(BaseModel):
    name: str = Field(default="인테리어 시뮬레이션", min_length=1, max_length=200)


class SimulationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    status: SimulationStatus | None = None


class VersionCreate(BaseModel):
    scene_json: dict[str, Any]
    source_scan_id: UUID | None = None


class SceneUpdate(BaseModel):
    scene_json: dict[str, Any]


class VersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    simulation_id: UUID
    version: int
    scene_json: dict[str, Any]
    preview_2d_url: str | None
    preview_3d_url: str | None
    source_scan_id: UUID | None
    verified_at: datetime | None
    created_at: datetime


class SimulationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    name: str
    status: SimulationStatus
    current_version_id: UUID | None
    created_at: datetime
    updated_at: datetime
    versions: list[VersionOut] = Field(default_factory=list)


class ScanCreate(BaseModel):
    source_type: ScanSourceType
    input_manifest: dict[str, Any] = Field(default_factory=dict)


class ScanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    simulation_id: UUID
    source_type: ScanSourceType
    status: ProcessingStatus
    input_manifest: dict[str, Any]
    raw_model_url: str | None
    normalized_model_url: str | None
    result_scene_json: dict[str, Any] | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime


class AssetCreate(BaseModel):
    owner_project_id: UUID | None = None
    asset_type: AssetType = AssetType.FURNITURE
    name: str = Field(min_length=1, max_length=200)
    source_type: AssetSourceType = AssetSourceType.CATALOG
    width: float = Field(default=1, gt=0, le=20)
    depth: float = Field(default=1, gt=0, le=20)
    height: float = Field(default=1, gt=0, le=20)
    preview_url: str | None = None
    model_glb_url: str | None = None


class AssetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    owner_project_id: UUID | None
    asset_type: AssetType
    name: str
    source_type: AssetSourceType
    model_glb_url: str | None
    preview_url: str | None
    width: float
    depth: float
    height: float
    generation_job_id: UUID | None
    created_at: datetime


class MaterialOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    owner_project_id: UUID | None
    material_type: MaterialType
    name: str
    albedo_url: str | None
    real_width: float
    real_height: float
    seamless: bool
    created_at: datetime


class AIJobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    job_type: AIJobType
    target_id: UUID
    provider: str
    status: AIJobStatus
    progress: int
    input_json: dict[str, Any]
    output_json: dict[str, Any]
    attempt_count: int
    error_message: str | None
    created_at: datetime
    updated_at: datetime


class GenerationRequest(BaseModel):
    project_id: UUID | None = None
    image_urls: list[str] = Field(default_factory=list)
    provider: str = "pending-provider"
