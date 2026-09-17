from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr
from typing import Optional, List
import os
import uuid
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"
PLANS = {"starter": 497, "professional": 997, "elite": 1497}

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(hours=12), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Non autenticato")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Tipo di token non valido")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token scaduto")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token non valido")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Utente non trovato")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Accesso riservato al super admin")
    return user


async def require_clinic(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "clinic":
        raise HTTPException(status_code=403, detail="Accesso riservato alle cliniche")
    return user


async def public_user(user: dict) -> dict:
    clinic_name = None
    if user.get("clinic_id"):
        clinic = await db.clinics.find_one({"id": user["clinic_id"]}, {"_id": 0, "name": 1})
        clinic_name = clinic["name"] if clinic else None
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "clinic_id": user.get("clinic_id"),
        "clinic_name": clinic_name,
    }


class LoginInput(BaseModel):
    email: str
    password: str


class ClinicCreate(BaseModel):
    name: str
    doctor_name: str
    email: EmailStr
    password: str
    plan: str = "professional"


class ClinicUpdate(BaseModel):
    status: Optional[str] = None
    plan: Optional[str] = None


@api_router.post("/auth/login")
async def login(input: LoginInput, request: Request, response: Response):
    email = input.email.strip().lower()
    identifier = f"{request.client.host}:{email}"

    attempts = await db.login_attempts.find_one({"identifier": identifier})
    if attempts and attempts.get("count", 0) >= 5:
        locked_since = attempts.get("last_attempt")
        if locked_since and datetime.now(timezone.utc) - locked_since < timedelta(minutes=15):
            raise HTTPException(status_code=429, detail="Troppi tentativi. Riprova tra 15 minuti.")

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(input.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$set": {"last_attempt": datetime.now(timezone.utc)}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Credenziali non valide")

    if user.get("role") == "clinic":
        clinic = await db.clinics.find_one({"id": user.get("clinic_id")})
        if clinic and clinic.get("status") == "sospesa":
            raise HTTPException(status_code=403, detail="Account sospeso. Contatta Digital Care AI.")

    await db.login_attempts.delete_one({"identifier": identifier})

    access_token = create_access_token(user["id"], email)
    refresh_token = create_refresh_token(user["id"])
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=True, samesite="none", max_age=43200, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=True, samesite="none", max_age=604800, path="/")

    return {"access_token": access_token, "token_type": "bearer", "user": await public_user(user)}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return await public_user(user)


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logout effettuato"}


@api_router.get("/dashboard")
async def get_dashboard(user: dict = Depends(require_clinic)):
    clinic = await db.clinics.find_one({"id": user["clinic_id"]}, {"_id": 0})
    data = await db.clinic_data.find_one({"clinic_id": user["clinic_id"]}, {"_id": 0})
    if not clinic or not data:
        raise HTTPException(status_code=404, detail="Dati dello studio non trovati")
    return {
        "clinic": {"name": clinic["name"], "doctor_name": clinic["doctor_name"], "plan": clinic["plan"]},
        "metrics": data["metrics"],
        "appointments": data["appointments"],
        "waitlist": data["waitlist"],
        "chat_script": data["chat_script"],
        "chat_patient": data["chat_patient"],
        "notifications": data.get("notifications", 0),
    }


@api_router.get("/admin/overview")
async def admin_overview(admin: dict = Depends(require_admin)):
    clinics = await db.clinics.find({}, {"_id": 0}).to_list(1000)
    result = []
    for c in clinics:
        data = await db.clinic_data.find_one({"clinic_id": c["id"]}, {"_id": 0})
        metrics = data["metrics"] if data else {}
        result.append({
            "id": c["id"],
            "name": c["name"],
            "doctor_name": c["doctor_name"],
            "email": c["email"],
            "plan": c["plan"],
            "mrr": c["mrr"],
            "status": c["status"],
            "created_at": c["created_at"],
            "appointments_ai": metrics.get("appointments_ai", 0),
            "value_eur": metrics.get("value_eur", 0),
            "hours_saved": metrics.get("hours_saved", 0),
        })
    active = [c for c in result if c["status"] == "attiva"]
    totals = {
        "clinics_active": len(active),
        "mrr": sum(c["mrr"] for c in active),
        "appointments_ai_month": sum(c["appointments_ai"] for c in result),
        "hours_saved": sum(c["hours_saved"] for c in result),
    }
    return {"totals": totals, "clinics": result}


@api_router.post("/admin/clinics")
async def create_clinic(input: ClinicCreate, admin: dict = Depends(require_admin)):
    email = input.email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Esiste già un account con questa email")
    if input.plan not in PLANS:
        raise HTTPException(status_code=400, detail="Piano non valido")
    if len(input.password) < 8:
        raise HTTPException(status_code=400, detail="La password deve avere almeno 8 caratteri")

    clinic_id = str(uuid.uuid4())
    clinic = {
        "id": clinic_id,
        "name": input.name.strip(),
        "doctor_name": input.doctor_name.strip(),
        "email": email,
        "plan": input.plan,
        "mrr": PLANS[input.plan],
        "status": "attiva",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.clinics.insert_one(clinic)
    await db.users.insert_one({
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(input.password),
        "name": input.doctor_name.strip(),
        "role": "clinic",
        "clinic_id": clinic_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.clinic_data.insert_one(default_clinic_data(clinic_id))
    clinic.pop("_id", None)
    return clinic


@api_router.patch("/admin/clinics/{clinic_id}")
async def update_clinic(clinic_id: str, input: ClinicUpdate, admin: dict = Depends(require_admin)):
    updates = {}
    if input.status in ("attiva", "sospesa"):
        updates["status"] = input.status
    if input.plan in PLANS:
        updates["plan"] = input.plan
        updates["mrr"] = PLANS[input.plan]
    if not updates:
        raise HTTPException(status_code=400, detail="Nessuna modifica valida")
    result = await db.clinics.update_one({"id": clinic_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Clinica non trovata")
    return await db.clinics.find_one({"id": clinic_id}, {"_id": 0})


def default_clinic_data(clinic_id: str) -> dict:
    return {
        "clinic_id": clinic_id,
        "notifications": 3,
        "metrics": {"appointments_ai": 48, "delta_pct": 12, "recovered": 14, "hours_saved": 56, "value_eur": 3200},
        "appointments": [
            {"time": "09:00", "patient": "Maria Ferrari", "treatment": "Igiene", "source": "ai"},
            {"time": "09:45", "patient": "Luca Bianchi", "treatment": "Controllo", "source": "segreteria"},
            {"time": "10:30", "patient": "Anna Colombo", "treatment": "Faccette", "source": "ai"},
            {"time": "11:30", "patient": "Giulia Romano", "treatment": "Urgenza", "source": "ai"},
            {"time": "14:00", "patient": "Paolo Greco", "treatment": "Impianto", "source": "segreteria"},
            {"time": "15:15", "patient": "Sara Marino", "treatment": "Otturazione", "source": "ai"},
            {"time": "16:30", "patient": "Davide Russo", "treatment": "Igiene", "source": "ai"},
        ],
        "waitlist": [
            {"id": "w1", "patient": "Elena Vitale", "treatment": "Igiene", "note": "Preferisce mattina"},
            {"id": "w2", "patient": "Marco Serra", "treatment": "Controllo", "note": "Disponibile anche oggi"},
            {"id": "w3", "patient": "Chiara De Luca", "treatment": "Impianto", "note": "Consulto già fissato"},
        ],
        "chat_patient": "Giulia Romano",
        "chat_script": [
            {"id": "m1", "from": "patient", "text": "Buongiorno all'AI. Ho un forte dolore a un molare, c'è posto oggi?"},
            {"id": "m2", "from": "ai", "text": "Buongiorno Giulia, mi dispiace per il dolore. Controllo subito l'agenda dello studio."},
            {"id": "m3", "from": "ai", "text": "Ho uno slot per un'urgenza oggi alle 11:30 con il Dottore. Glielo blocco?"},
            {"id": "m4", "from": "patient", "text": "Sì perfetto, grazie mille!"},
            {"id": "m5", "from": "ai", "text": "Fatto. Urgenza confermata per le 11:30. Le ho inviato le istruzioni pre-visita. A dopo!"},
        ],
    }


async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@digitalcare.ai").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin2026!")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Digital Care AI",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Admin seedato: %s", admin_email)
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})


async def seed_demo_clinic():
    email = "bellini@studiobellini.it"
    if await db.users.find_one({"email": email}):
        return
    clinic_id = str(uuid.uuid4())
    await db.clinics.insert_one({
        "id": clinic_id,
        "name": "Studio Dentistico Bellini",
        "doctor_name": "Dr. Marco Bellini",
        "email": email,
        "plan": "elite",
        "mrr": PLANS["elite"],
        "status": "attiva",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.users.insert_one({
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password("Bellini2026!"),
        "name": "Dr. Marco Bellini",
        "role": "clinic",
        "clinic_id": clinic_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.clinic_data.insert_one(default_clinic_data(clinic_id))
    logger.info("Clinica demo seedata: %s", email)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await seed_admin()
    await seed_demo_clinic()


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
