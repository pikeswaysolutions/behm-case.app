from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from supabase import create_client, Client
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
import io
import csv
from openpyxl import load_workbook
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR.parent / '.env')

# Supabase connection
supabase_url = os.environ['SUPABASE_URL']
supabase_key = os.environ['SUPABASE_KEY']
supabase: Client = create_client(supabase_url, supabase_key)

# JWT settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'behm-funeral-home-secret-key-2024')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security
security = HTTPBearer()

app = FastAPI(title="Behm Funeral Home Management")
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================

class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str = "director"
    director_id: Optional[str] = None
    can_edit_cases: bool = False
    is_active: bool = True

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    director_id: Optional[str] = None
    can_edit_cases: Optional[bool] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

class User(UserBase):
    id: str
    created_at: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

class DirectorBase(BaseModel):
    name: str
    is_active: bool = True

class DirectorCreate(DirectorBase):
    pass

class Director(DirectorBase):
    id: str
    created_at: str

class ServiceTypeBase(BaseModel):
    name: str
    is_active: bool = True

class ServiceType(ServiceTypeBase):
    id: str

class SaleTypeBase(BaseModel):
    name: str
    is_active: bool = True

class SaleType(SaleTypeBase):
    id: str

class CaseBase(BaseModel):
    case_number: str
    date_of_death: str
    customer_first_name: str
    customer_last_name: str
    service_type_id: str
    sale_type_id: Optional[str] = None
    director_id: str
    date_paid_in_full: Optional[str] = None
    payments_received: float = 0
    average_age: Optional[float] = None
    total_sale: float = 0

class CaseCreate(CaseBase):
    pass

class CaseUpdate(BaseModel):
    case_number: Optional[str] = None
    date_of_death: Optional[str] = None
    customer_first_name: Optional[str] = None
    customer_last_name: Optional[str] = None
    service_type_id: Optional[str] = None
    sale_type_id: Optional[str] = None
    director_id: Optional[str] = None
    date_paid_in_full: Optional[str] = None
    payments_received: Optional[float] = None
    average_age: Optional[float] = None
    total_sale: Optional[float] = None

class Case(CaseBase):
    id: str
    total_balance_due: float
    created_at: str
    service_type_name: Optional[str] = None
    sale_type_name: Optional[str] = None
    director_name: Optional[str] = None

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")

        response = supabase.from_("users").select("*").eq("id", user_id).eq("is_active", True).execute()
        if not response.data or len(response.data) == 0:
            raise HTTPException(status_code=401, detail="User not found")
        return response.data[0]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate):
    existing = supabase.from_("users").select("id").eq("email", user_data.email).execute()
    if existing.data and len(existing.data) > 0:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_dict = {
        "id": str(uuid.uuid4()),
        "email": user_data.email,
        "name": user_data.name,
        "role": user_data.role,
        "director_id": user_data.director_id,
        "can_edit_cases": user_data.can_edit_cases,
        "is_active": True,
        "password_hash": hash_password(user_data.password),
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    response = supabase.from_("users").insert(user_dict).execute()

    token = create_access_token({"sub": user_dict["id"]})
    user_response = {k: v for k, v in user_dict.items() if k != "password_hash"}
    return {"access_token": token, "token_type": "bearer", "user": user_response}

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    response = supabase.from_("users").select("*").eq("email", credentials.email).execute()
    if not response.data or len(response.data) == 0:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user = response.data[0]
    if not verify_password(credentials.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account is deactivated")

    token = create_access_token({"sub": user["id"]})
    user_response = {k: v for k, v in user.items() if k != "password_hash"}
    return {"access_token": token, "token_type": "bearer", "user": user_response}

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {k: v for k, v in current_user.items() if k != "password_hash"}

# ==================== USER MANAGEMENT (Admin Only) ====================

@api_router.get("/users", response_model=List[User])
async def list_users(admin: dict = Depends(require_admin)):
    response = supabase.from_("users").select("id, email, name, role, director_id, can_edit_cases, is_active, created_at").execute()
    return response.data

@api_router.post("/users", response_model=User, status_code=status.HTTP_201_CREATED)
async def create_user(user_data: UserCreate, admin: dict = Depends(require_admin)):
    existing = supabase.from_("users").select("id").eq("email", user_data.email).execute()
    if existing.data and len(existing.data) > 0:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_dict = {
        "id": str(uuid.uuid4()),
        "email": user_data.email,
        "name": user_data.name,
        "role": user_data.role,
        "director_id": user_data.director_id,
        "can_edit_cases": user_data.can_edit_cases,
        "is_active": True,
        "password_hash": hash_password(user_data.password),
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    response = supabase.from_("users").insert(user_dict).execute()
    return {k: v for k, v in user_dict.items() if k != "password_hash"}

@api_router.put("/users/{user_id}", response_model=User)
async def update_user(user_id: str, user_update: UserUpdate, admin: dict = Depends(require_admin)):
    update_data = {k: v for k, v in user_update.model_dump().items() if v is not None}
    if "password" in update_data:
        update_data["password_hash"] = hash_password(update_data.pop("password"))

    if update_data:
        supabase.from_("users").update(update_data).eq("id", user_id).execute()

    response = supabase.from_("users").select("id, email, name, role, director_id, can_edit_cases, is_active, created_at").eq("id", user_id).execute()
    if not response.data or len(response.data) == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return response.data[0]

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    response = supabase.from_("users").update({"is_active": False}).eq("id", user_id).execute()
    if not response.data or len(response.data) == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deactivated"}

# ==================== FUNERAL DIRECTORS ====================

@api_router.get("/directors", response_model=List[Director])
async def list_directors(current_user: dict = Depends(get_current_user)):
    response = supabase.from_("directors").select("*").execute()
    return response.data

@api_router.post("/directors", response_model=Director, status_code=status.HTTP_201_CREATED)
async def create_director(director_data: DirectorCreate, admin: dict = Depends(require_admin)):
    director_dict = {
        "id": str(uuid.uuid4()),
        "name": director_data.name,
        "is_active": director_data.is_active,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    response = supabase.from_("directors").insert(director_dict).execute()
    return response.data[0]

@api_router.put("/directors/{director_id}", response_model=Director)
async def update_director(director_id: str, director_data: DirectorCreate, admin: dict = Depends(require_admin)):
    update_data = director_data.model_dump()
    supabase.from_("directors").update(update_data).eq("id", director_id).execute()

    response = supabase.from_("directors").select("*").eq("id", director_id).execute()
    if not response.data or len(response.data) == 0:
        raise HTTPException(status_code=404, detail="Director not found")
    return response.data[0]

@api_router.delete("/directors/{director_id}")
async def delete_director(director_id: str, admin: dict = Depends(require_admin)):
    response = supabase.from_("directors").update({"is_active": False}).eq("id", director_id).execute()
    if not response.data or len(response.data) == 0:
        raise HTTPException(status_code=404, detail="Director not found")
    return {"message": "Director deactivated"}

@api_router.post("/directors/{director_id}/reassign")
async def reassign_director_cases(
    director_id: str,
    new_director_id: str = Query(...),
    admin: dict = Depends(require_admin)
):
    response = supabase.from_("cases").update({"director_id": new_director_id}).eq("director_id", director_id).execute()
    return {"message": f"Reassigned {len(response.data)} cases"}

# ==================== SERVICE TYPES ====================

@api_router.get("/service-types", response_model=List[ServiceType])
async def list_service_types(current_user: dict = Depends(get_current_user)):
    response = supabase.from_("service_types").select("*").execute()
    return response.data

@api_router.post("/service-types", response_model=ServiceType, status_code=status.HTTP_201_CREATED)
async def create_service_type(type_data: ServiceTypeBase, admin: dict = Depends(require_admin)):
    type_dict = {
        "id": str(uuid.uuid4()),
        "name": type_data.name,
        "is_active": type_data.is_active
    }
    response = supabase.from_("service_types").insert(type_dict).execute()
    return response.data[0]

@api_router.put("/service-types/{type_id}", response_model=ServiceType)
async def update_service_type(type_id: str, type_data: ServiceTypeBase, admin: dict = Depends(require_admin)):
    supabase.from_("service_types").update(type_data.model_dump()).eq("id", type_id).execute()
    response = supabase.from_("service_types").select("*").eq("id", type_id).execute()
    if not response.data or len(response.data) == 0:
        raise HTTPException(status_code=404, detail="Service type not found")
    return response.data[0]

@api_router.delete("/service-types/{type_id}")
async def delete_service_type(type_id: str, admin: dict = Depends(require_admin)):
    supabase.from_("service_types").update({"is_active": False}).eq("id", type_id).execute()
    return {"message": "Service type deactivated"}

# ==================== SALE TYPES ====================

@api_router.get("/sale-types", response_model=List[SaleType])
async def list_sale_types(current_user: dict = Depends(get_current_user)):
    response = supabase.from_("sale_types").select("*").execute()
    return response.data

@api_router.post("/sale-types", response_model=SaleType, status_code=status.HTTP_201_CREATED)
async def create_sale_type(type_data: SaleTypeBase, admin: dict = Depends(require_admin)):
    type_dict = {
        "id": str(uuid.uuid4()),
        "name": type_data.name,
        "is_active": type_data.is_active
    }
    response = supabase.from_("sale_types").insert(type_dict).execute()
    return response.data[0]

@api_router.put("/sale-types/{type_id}", response_model=SaleType)
async def update_sale_type(type_id: str, type_data: SaleTypeBase, admin: dict = Depends(require_admin)):
    supabase.from_("sale_types").update(type_data.model_dump()).eq("id", type_id).execute()
    response = supabase.from_("sale_types").select("*").eq("id", type_id).execute()
    if not response.data or len(response.data) == 0:
        raise HTTPException(status_code=404, detail="Sale type not found")
    return response.data[0]

@api_router.delete("/sale-types/{type_id}")
async def delete_sale_type(type_id: str, admin: dict = Depends(require_admin)):
    supabase.from_("sale_types").update({"is_active": False}).eq("id", type_id).execute()
    return {"message": "Sale type deactivated"}

# ==================== CASES ====================

def enrich_case(case: dict) -> dict:
    case["total_balance_due"] = float(case.get("total_sale", 0)) - float(case.get("payments_received", 0))
    return case

@api_router.get("/cases", response_model=List[Case])
async def list_cases(
    current_user: dict = Depends(get_current_user),
    director_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    query = supabase.from_("cases_enriched").select("*")

    if current_user.get("role") != "admin":
        if current_user.get("director_id"):
            query = query.eq("director_id", current_user["director_id"])
        else:
            return []
    elif director_id:
        query = query.eq("director_id", director_id)

    if start_date:
        query = query.gte("date_of_death", start_date)
    if end_date:
        query = query.lte("date_of_death", end_date)

    response = query.execute()
    return [enrich_case(case) for case in response.data]

@api_router.get("/cases/{case_id}", response_model=Case)
async def get_case(case_id: str, current_user: dict = Depends(get_current_user)):
    response = supabase.from_("cases_enriched").select("*").eq("id", case_id).execute()
    if not response.data or len(response.data) == 0:
        raise HTTPException(status_code=404, detail="Case not found")

    case = response.data[0]

    if current_user.get("role") != "admin" and case.get("director_id") != current_user.get("director_id"):
        raise HTTPException(status_code=403, detail="Access denied")

    return enrich_case(case)

@api_router.post("/cases", response_model=Case, status_code=status.HTTP_201_CREATED)
async def create_case(case_data: CaseCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin" and not current_user.get("can_edit_cases"):
        raise HTTPException(status_code=403, detail="You don't have permission to create cases")

    existing = supabase.from_("cases").select("id").eq("case_number", case_data.case_number).execute()
    if existing.data and len(existing.data) > 0:
        raise HTTPException(status_code=400, detail="Case number already exists")

    case_dict = case_data.model_dump()
    case_dict["id"] = str(uuid.uuid4())
    case_dict["created_at"] = datetime.now(timezone.utc).isoformat()

    supabase.from_("cases").insert(case_dict).execute()

    response = supabase.from_("cases_enriched").select("*").eq("id", case_dict["id"]).execute()
    return enrich_case(response.data[0])

@api_router.put("/cases/{case_id}", response_model=Case)
async def update_case(case_id: str, case_update: CaseUpdate, current_user: dict = Depends(get_current_user)):
    case_response = supabase.from_("cases").select("*").eq("id", case_id).execute()
    if not case_response.data or len(case_response.data) == 0:
        raise HTTPException(status_code=404, detail="Case not found")

    case = case_response.data[0]

    if current_user.get("role") != "admin":
        if case.get("director_id") != current_user.get("director_id"):
            raise HTTPException(status_code=403, detail="Access denied")
        if not current_user.get("can_edit_cases"):
            raise HTTPException(status_code=403, detail="You don't have permission to edit cases")

    update_data = {k: v for k, v in case_update.model_dump().items() if v is not None}

    if "case_number" in update_data and update_data["case_number"] != case.get("case_number"):
        existing = supabase.from_("cases").select("id").eq("case_number", update_data["case_number"]).execute()
        if existing.data and len(existing.data) > 0:
            raise HTTPException(status_code=400, detail="Case number already exists")

    if update_data:
        supabase.from_("cases").update(update_data).eq("id", case_id).execute()

    response = supabase.from_("cases_enriched").select("*").eq("id", case_id).execute()
    return enrich_case(response.data[0])

@api_router.delete("/cases/{case_id}")
async def delete_case(case_id: str, admin: dict = Depends(require_admin)):
    response = supabase.from_("cases").delete().eq("id", case_id).execute()
    if not response.data or len(response.data) == 0:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"message": "Case deleted"}

# ==================== REPORTS & DASHBOARD ====================

@api_router.get("/reports/dashboard")
async def get_dashboard(
    current_user: dict = Depends(get_current_user),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    grouping: str = "monthly"
):
    query = supabase.from_("cases_enriched").select("*")

    if current_user.get("role") != "admin" and current_user.get("director_id"):
        query = query.eq("director_id", current_user["director_id"])

    if start_date:
        query = query.gte("date_of_death", start_date)
    if end_date:
        query = query.lte("date_of_death", end_date)

    cases = query.execute().data

    directors_response = supabase.from_("directors").select("*").eq("is_active", True).execute()
    director_map = {d["id"]: d["name"] for d in directors_response.data}

    director_metrics = {}
    for case in cases:
        did = case.get("director_id")
        if did not in director_metrics:
            director_metrics[did] = {
                "director_id": did,
                "director_name": director_map.get(did, "Unknown"),
                "case_count": 0,
                "total_sales": 0,
                "payments_received": 0,
                "total_balance_due": 0,
                "ages": []
            }
        dm = director_metrics[did]
        dm["case_count"] += 1
        dm["total_sales"] += float(case.get("total_sale", 0))
        dm["payments_received"] += float(case.get("payments_received", 0))
        dm["total_balance_due"] += float(case.get("total_sale", 0)) - float(case.get("payments_received", 0))
        if case.get("average_age"):
            dm["ages"].append(float(case["average_age"]))

    for dm in director_metrics.values():
        dm["average_age"] = sum(dm["ages"]) / len(dm["ages"]) if dm["ages"] else 0
        del dm["ages"]

    all_ages = [float(c.get("average_age")) for c in cases if c.get("average_age") is not None]
    grand_totals = {
        "case_count": sum(dm["case_count"] for dm in director_metrics.values()),
        "total_sales": sum(dm["total_sales"] for dm in director_metrics.values()),
        "payments_received": sum(dm["payments_received"] for dm in director_metrics.values()),
        "total_balance_due": sum(dm["total_balance_due"] for dm in director_metrics.values()),
        "average_age": sum(all_ages) / len(all_ages) if all_ages else 0
    }

    time_series = {}
    for case in cases:
        dod = str(case.get("date_of_death", ""))[:7] if grouping == "monthly" else str(case.get("date_of_death", ""))[:4]
        if dod not in time_series:
            time_series[dod] = {"period": dod, "cases": 0, "sales": 0, "payments": 0}
        time_series[dod]["cases"] += 1
        time_series[dod]["sales"] += float(case.get("total_sale", 0))
        time_series[dod]["payments"] += float(case.get("payments_received", 0))

    return {
        "director_metrics": list(director_metrics.values()),
        "grand_totals": grand_totals,
        "time_series": sorted(time_series.values(), key=lambda x: x["period"])
    }

@api_router.get("/reports/director/{director_id}")
async def get_director_report(
    director_id: str,
    current_user: dict = Depends(get_current_user),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    if current_user.get("role") != "admin" and current_user.get("director_id") != director_id:
        raise HTTPException(status_code=403, detail="Access denied")

    query = supabase.from_("cases_enriched").select("*").eq("director_id", director_id)

    if start_date:
        query = query.gte("date_of_death", start_date)
    if end_date:
        query = query.lte("date_of_death", end_date)

    cases = query.execute().data
    enriched_cases = [enrich_case(c) for c in cases]

    metrics = {
        "case_count": len(cases),
        "total_sales": sum(float(c.get("total_sale", 0)) for c in cases),
        "payments_received": sum(float(c.get("payments_received", 0)) for c in cases),
        "total_balance_due": sum(float(c.get("total_sale", 0)) - float(c.get("payments_received", 0)) for c in cases),
        "average_age": sum(float(c.get("average_age", 0)) for c in cases if c.get("average_age")) / max(len([c for c in cases if c.get("average_age")]), 1)
    }

    return {"cases": enriched_cases, "metrics": metrics}

# ==================== EXPORT ====================

@api_router.get("/export/csv")
async def export_csv(
    current_user: dict = Depends(get_current_user),
    director_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    query = supabase.from_("cases_enriched").select("*")

    if current_user.get("role") != "admin":
        if current_user.get("director_id"):
            query = query.eq("director_id", current_user["director_id"])
        else:
            raise HTTPException(status_code=403, detail="No director assigned")
    elif director_id:
        query = query.eq("director_id", director_id)

    if start_date:
        query = query.gte("date_of_death", start_date)
    if end_date:
        query = query.lte("date_of_death", end_date)

    cases = query.execute().data
    enriched = [enrich_case(c) for c in cases]

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Case Number", "Date of Death", "First Name", "Last Name",
        "Service Type", "Sale Type", "Director", "Date Paid In Full",
        "Payments Received", "Average Age", "Total Sale", "Balance Due"
    ])

    for c in enriched:
        writer.writerow([
            c.get("case_number", ""),
            c.get("date_of_death", ""),
            c.get("customer_first_name", ""),
            c.get("customer_last_name", ""),
            c.get("service_type_name", ""),
            c.get("sale_type_name", ""),
            c.get("director_name", ""),
            c.get("date_paid_in_full", ""),
            c.get("payments_received", 0),
            c.get("average_age", ""),
            c.get("total_sale", 0),
            c.get("total_balance_due", 0)
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=cases_export.csv"}
    )

@api_router.get("/export/pdf")
async def export_pdf(
    current_user: dict = Depends(get_current_user),
    director_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    query = supabase.from_("cases_enriched").select("*")

    if current_user.get("role") != "admin":
        if current_user.get("director_id"):
            query = query.eq("director_id", current_user["director_id"])
        else:
            raise HTTPException(status_code=403, detail="No director assigned")
    elif director_id:
        query = query.eq("director_id", director_id)

    if start_date:
        query = query.gte("date_of_death", start_date)
    if end_date:
        query = query.lte("date_of_death", end_date)

    cases = query.execute().data
    enriched = [enrich_case(c) for c in cases]

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(letter))
    styles = getSampleStyleSheet()
    elements = []

    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=18, alignment=1)
    elements.append(Paragraph("Behm Funeral Home - Cases Report", title_style))
    elements.append(Spacer(1, 20))

    data = [["Case #", "Date of Death", "Name", "Service", "Director", "Total Sale", "Payments", "Balance"]]
    for c in enriched:
        data.append([
            c.get("case_number", ""),
            c.get("date_of_death", ""),
            f"{c.get('customer_first_name', '')} {c.get('customer_last_name', '')}",
            c.get("service_type_name", ""),
            c.get("director_name", ""),
            f"${float(c.get('total_sale', 0)):,.2f}",
            f"${float(c.get('payments_received', 0)):,.2f}",
            f"${float(c.get('total_balance_due', 0)):,.2f}"
        ])

    table = Table(data)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.Color(0.11, 0.16, 0.25)),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.Color(0.95, 0.97, 0.98)),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 1, colors.Color(0.8, 0.85, 0.88)),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.Color(0.95, 0.97, 0.98)])
    ]))
    elements.append(table)

    doc.build(elements)
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=cases_report.pdf"}
    )

# ==================== IMPORT ====================

@api_router.post("/import/excel")
async def import_excel(file: UploadFile = File(...), admin: dict = Depends(require_admin)):
    if not file.filename.endswith(('.xlsx', '.xls', '.xlsm')):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload an Excel file.")

    contents = await file.read()
    wb = load_workbook(filename=io.BytesIO(contents), data_only=True)
    ws = wb.active

    directors_response = supabase.from_("directors").select("*").execute()
    directors = {d["name"].lower(): d["id"] for d in directors_response.data}

    service_types_response = supabase.from_("service_types").select("*").execute()
    service_types = {s["name"].lower(): s["id"] for s in service_types_response.data}

    sale_types_response = supabase.from_("sale_types").select("*").execute()
    sale_types = {s["name"].lower(): s["id"] for s in sale_types_response.data}

    imported = 0
    skipped = 0
    errors = []

    headers = {}
    for col in range(1, ws.max_column + 1):
        cell_val = str(ws.cell(row=1, column=col).value or "").lower().strip()
        headers[cell_val] = col

    for row in range(2, ws.max_row + 1):
        try:
            case_num_col = headers.get("case number", headers.get("case #", 1))
            case_number = str(ws.cell(row=row, column=case_num_col).value or "").strip()

            if not case_number:
                continue

            existing = supabase.from_("cases").select("id").eq("case_number", case_number).execute()
            if existing.data and len(existing.data) > 0:
                skipped += 1
                continue

            dod_col = headers.get("date of death", 2)
            dod_val = ws.cell(row=row, column=dod_col).value
            if isinstance(dod_val, datetime):
                date_of_death = dod_val.strftime("%Y-%m-%d")
            else:
                date_of_death = str(dod_val) if dod_val else ""

            first_name = str(ws.cell(row=row, column=headers.get("customer first name", headers.get("first name", 3))).value or "")
            last_name = str(ws.cell(row=row, column=headers.get("customer last name", headers.get("last name", 4))).value or "")

            service_type_val = str(ws.cell(row=row, column=headers.get("service type", 5)).value or "").lower().strip()
            service_type_id = service_types.get(service_type_val)
            if not service_type_id and service_type_val:
                new_st = {"id": str(uuid.uuid4()), "name": service_type_val.title(), "is_active": True}
                supabase.from_("service_types").insert(new_st).execute()
                service_types[service_type_val] = new_st["id"]
                service_type_id = new_st["id"]

            sale_type_val = str(ws.cell(row=row, column=headers.get("sale type", 6)).value or "").lower().strip()
            sale_type_id = sale_types.get(sale_type_val)
            if not sale_type_id and sale_type_val:
                new_slt = {"id": str(uuid.uuid4()), "name": sale_type_val.title(), "is_active": True}
                supabase.from_("sale_types").insert(new_slt).execute()
                sale_types[sale_type_val] = new_slt["id"]
                sale_type_id = new_slt["id"]

            director_val = str(ws.cell(row=row, column=headers.get("director", headers.get("funeral director", 7))).value or "").lower().strip()
            director_id = directors.get(director_val)
            if not director_id and director_val:
                new_dir = {"id": str(uuid.uuid4()), "name": director_val.title(), "is_active": True, "created_at": datetime.now(timezone.utc).isoformat()}
                supabase.from_("directors").insert(new_dir).execute()
                directors[director_val] = new_dir["id"]
                director_id = new_dir["id"]

            def parse_float(val):
                if val is None:
                    return 0
                try:
                    return float(val)
                except (ValueError, TypeError):
                    return 0

            def parse_date(val):
                if val is None:
                    return None
                if isinstance(val, datetime):
                    return val.strftime("%Y-%m-%d")
                return str(val) if val else None

            case_dict = {
                "id": str(uuid.uuid4()),
                "case_number": case_number,
                "date_of_death": date_of_death,
                "customer_first_name": first_name,
                "customer_last_name": last_name,
                "service_type_id": service_type_id or "",
                "sale_type_id": sale_type_id,
                "director_id": director_id or "",
                "date_paid_in_full": parse_date(ws.cell(row=row, column=headers.get("date paid in full", headers.get("pif", 8))).value),
                "payments_received": parse_float(ws.cell(row=row, column=headers.get("payments received", 9)).value),
                "average_age": parse_float(ws.cell(row=row, column=headers.get("avg age", headers.get("average age", 10))).value),
                "total_sale": parse_float(ws.cell(row=row, column=headers.get("total sale", 11)).value),
                "created_at": datetime.now(timezone.utc).isoformat()
            }

            supabase.from_("cases").insert(case_dict).execute()
            imported += 1

        except Exception as e:
            errors.append(f"Row {row}: {str(e)}")

    return {
        "imported": imported,
        "skipped": skipped,
        "errors": errors[:10]
    }

@api_router.get("/")
async def root():
    return {"message": "Behm Funeral Home Management API"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
