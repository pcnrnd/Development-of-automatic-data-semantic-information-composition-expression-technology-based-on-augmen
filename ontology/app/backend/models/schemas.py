"""
API 요청/응답용 Pydantic 모델.
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class ImportResult(BaseModel):
    triplesLoaded: int
    validationConforms: bool
    report: Optional[str] = None


class Triple(BaseModel):
    subject: str
    predicate: str
    object: str


class TripleResponse(BaseModel):
    subject: str
    predicate: str
    object: str
    subject_label: Optional[str] = None
    object_label: Optional[str] = None


class BulkTripleOperation(BaseModel):
    add: List[Triple] = []
    delete: List[Triple] = []


class WorkOrder(BaseModel):
    workOrderNumber: str
    plannedQuantity: int
    actualQuantity: Optional[int] = 0
    status: str
    equipment_id: Optional[str] = None


class QualityControl(BaseModel):
    product_id: str
    qualityResult: str
    timestamp: datetime


class EquipmentStatus(BaseModel):
    equipment_id: str
    status: str
    lastMaintenance: Optional[datetime] = None
    nextMaintenance: Optional[datetime] = None
