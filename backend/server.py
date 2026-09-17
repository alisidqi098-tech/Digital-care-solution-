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

import io
import json
import re
from fastapi.responses import StreamingResponse
from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
from fpdf import FPDF

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
    today = datetime.now(timezone.utc).date().isoformat()
    return {
        "clinic": {"name": clinic["name"], "doctor_name": clinic["doctor_name"], "plan": clinic["plan"]},
        "metrics": data["metrics"],
        "appointments": [a for a in data["appointments"] if a.get("date") == today],
        "waitlist": data["waitlist"],
        "chat_script": data.get("chat_script", []),
        "chat_patient": data.get("chat_patient", "Paziente"),
        "notifications": data.get("notifications", 0),
    }


@api_router.get("/calendar")
async def get_calendar(start: str, end: str, user: dict = Depends(require_clinic)):
    data = await db.clinic_data.find_one({"clinic_id": user["clinic_id"]}, {"_id": 0})
    if not data:
        raise HTTPException(status_code=404, detail="Dati dello studio non trovati")
    appts = [a for a in data["appointments"] if start <= a.get("date", "") <= end]
    return {"appointments": appts}


@api_router.get("/notifications")
async def get_notifications(user: dict = Depends(require_clinic)):
    items = await db.notifications.find({"clinic_id": user["clinic_id"]}, {"_id": 0}).sort("created_at", -1).to_list(20)
    unread = await db.notifications.count_documents({"clinic_id": user["clinic_id"], "read": False})
    return {"items": items, "unread": unread}


@api_router.post("/notifications/read-all")
async def read_all_notifications(user: dict = Depends(require_clinic)):
    await db.notifications.update_many({"clinic_id": user["clinic_id"]}, {"$set": {"read": True}})
    return {"ok": True}


@api_router.post("/waitlist/{waitlist_id}/call")
async def call_waitlist(waitlist_id: str, user: dict = Depends(require_clinic)):
    data = await db.clinic_data.find_one({"clinic_id": user["clinic_id"]}, {"_id": 0})
    entry = next((w for w in (data or {}).get("waitlist", []) if w["id"] == waitlist_id), None)
    if not entry:
        raise HTTPException(status_code=404, detail="Paziente non trovato in lista d'attesa")
    await push_notification(user["clinic_id"], "call_started", f"L'AI ha avviato la chiamata a {entry['patient']} (lista d'attesa - {entry['treatment']})")
    return {"ok": True, "patient": entry["patient"]}


class ChatHistoryInput(BaseModel):
    history: List[dict]


BOOKING_RE = re.compile(r"\[\[PRENOTATO:(\d{2}:\d{2})\]\]")


@api_router.post("/chat/reply")
async def chat_reply(input: ChatHistoryInput, user: dict = Depends(require_clinic)):
    clinic = await db.clinics.find_one({"id": user["clinic_id"]}, {"_id": 0})
    data = await db.clinic_data.find_one({"clinic_id": user["clinic_id"]}, {"_id": 0})
    today = datetime.now(timezone.utc).date().isoformat()
    agenda = ", ".join(
        f"{a['time']} {a['patient']} ({a['treatment']})"
        for a in data["appointments"] if a.get("date") == today
    )
    system_message = (
        f"Sei Digital Care AI, l'assistente virtuale dello {clinic['name']} del {clinic['doctor_name']}. "
        "Rispondi SEMPRE in italiano, con tono cordiale, empatico e professionale, in stile messaggio chat: massimo 2 frasi brevi. "
        f"Agenda di oggi: {agenda}. Slot ancora liberi oggi: 11:30 (solo urgenze) e 16:00. "
        "Se il paziente descrive un'urgenza o chiede un appuntamento, proponi uno degli slot liberi. "
        "SOLO quando il paziente accetta esplicitamente uno slot, conferma la prenotazione aggiungendo ALLA FINE del messaggio il marcatore [[PRENOTATO:HH:MM]] con l'orario confermato. "
        "Non usare MAI il marcatore senza una conferma esplicita del paziente. Non rivelare di essere un modello linguistico."
    )
    transcript = "\n".join(
        ("Paziente: " if m.get("from") == "patient" else "Assistente: ") + m.get("text", "")
        for m in input.history[-12:]
    )
    prompt = f"Conversazione finora:\n{transcript}\n\nScrivi la prossima risposta dell'Assistente."
    clinic_id = user["clinic_id"]

    async def event_generator():
        full = ""
        pending = ""
        try:
            chat = LlmChat(
                api_key=os.environ["EMERGENT_LLM_KEY"],
                session_id=f"chat-{clinic_id}-{uuid.uuid4()}",
                system_message=system_message,
            ).with_model("openai", "gpt-5.4")
            async for ev in chat.stream_message(UserMessage(text=prompt)):
                if isinstance(ev, TextDelta):
                    full += ev.content
                    pending += ev.content
                    if len(pending) > 24:
                        safe, pending = pending[:-24], pending[-24:]
                        yield f"data: {json.dumps({'token': safe})}\n\n"
                elif isinstance(ev, StreamDone):
                    break
        except Exception as exc:
            logger.error("LLM error: %s", exc)
            if not full:
                full = "Mi scusi, ho avuto un problema tecnico. Un operatore dello studio la ricontatterà a breve."
                yield f"data: {json.dumps({'token': full})}\n\n"
        booking = BOOKING_RE.search(full)
        remainder = BOOKING_RE.sub("", pending).strip()
        if remainder:
            yield f"data: {json.dumps({'token': remainder})}\n\n"
        slot = booking.group(1) if booking else None
        if slot:
            await push_notification(clinic_id, "booking_ai", f"L'AI ha fissato un appuntamento per le {slot} dalla chat pazienti")
        yield f"data: {json.dumps({'done': True, 'booking_confirmed': bool(slot), 'slot': slot})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def build_roi_pdf(clinic: dict, metrics: dict) -> bytes:
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()
    today = datetime.now(timezone.utc).date()
    week_start = today - timedelta(days=6)

    pdf.set_fill_color(8, 12, 20)
    pdf.rect(0, 0, 210, 42, "F")
    pdf.set_xy(14, 10)
    pdf.set_text_color(0, 245, 212)
    pdf.set_font("helvetica", "B", 19)
    pdf.cell(0, 9, "DIGITAL CARE AI")
    pdf.set_xy(14, 21)
    pdf.set_text_color(248, 250, 252)
    pdf.set_font("helvetica", "", 11)
    pdf.cell(0, 7, f"Report ROI Settimanale  |  {clinic['name']}")
    pdf.set_xy(14, 30)
    pdf.set_text_color(148, 163, 184)
    pdf.set_font("helvetica", "", 9)
    pdf.cell(0, 6, f"Periodo: {week_start.strftime('%d/%m/%Y')} - {today.strftime('%d/%m/%Y')}  |  Piano: {clinic['plan'].capitalize()}  |  {clinic['doctor_name']}")

    boxes = [
        ("APPUNTAMENTI FISSATI DALL'AI", str(metrics["appointments_ai"]), f"+{metrics['delta_pct']}% vs mese scorso"),
        ("DISDETTE RECUPERATE", str(metrics["recovered"]), "slot riempiti automaticamente"),
        ("ORE SEGRETERIA RISPARMIATE", f"{metrics['hours_saved']}h", "tempo restituito al team"),
        ("VALORE GENERATO STIMATO", f"EUR {metrics['value_eur']:,}".replace(",", "."), "fatturato recuperato"),
    ]
    x = 14.0
    for label, value, sub in boxes:
        pdf.set_fill_color(240, 253, 250)
        pdf.set_draw_color(0, 200, 180)
        pdf.set_line_width(0.3)
        pdf.rect(x, 52, 43, 30, "DF")
        pdf.set_xy(x + 3, 56)
        pdf.set_text_color(13, 19, 32)
        pdf.set_font("helvetica", "B", 15)
        pdf.cell(37, 8, value)
        pdf.set_xy(x + 3, 65)
        pdf.set_font("helvetica", "B", 6.5)
        pdf.multi_cell(37, 3.2, label)
        pdf.set_xy(x + 3, 75)
        pdf.set_font("helvetica", "", 6.5)
        pdf.set_text_color(100, 116, 139)
        pdf.cell(37, 4, sub)
        x += 46.5

    pdf.set_xy(14, 94)
    pdf.set_text_color(13, 19, 32)
    pdf.set_font("helvetica", "B", 13)
    pdf.cell(0, 8, "La settimana in sintesi")
    pdf.set_y(104)
    highlights = [
        "L'assistente AI ha risposto a ogni richiesta dei pazienti in pochi secondi, 24 ore su 24, 7 giorni su 7.",
        f"{metrics['appointments_ai']} appuntamenti fissati automaticamente negli ultimi 30 giorni, senza telefonate della segreteria.",
        f"{metrics['recovered']} disdette recuperate riassegnando gli slot ai pazienti in lista d'attesa.",
        f"{metrics['hours_saved']} ore di lavoro amministrativo restituite al team dello studio.",
    ]
    for h in highlights:
        pdf.set_x(14)
        pdf.set_text_color(0, 180, 160)
        pdf.set_font("helvetica", "B", 10)
        pdf.cell(6, 6, chr(149))
        pdf.set_text_color(51, 65, 85)
        pdf.set_font("helvetica", "", 10)
        pdf.multi_cell(170, 6, h)
        pdf.ln(1.5)

    ratio = metrics["value_eur"] / clinic["mrr"]
    roi = round(ratio * 100)
    y = pdf.get_y() + 4
    pdf.set_fill_color(8, 12, 20)
    pdf.rect(14, y, 182, 24, "F")
    pdf.set_xy(18, y + 4)
    pdf.set_text_color(0, 255, 135)
    pdf.set_font("helvetica", "B", 12)
    pdf.cell(0, 7, f"ROI dell'investimento: {roi}%")
    pdf.set_xy(18, y + 12)
    pdf.set_text_color(148, 163, 184)
    pdf.set_font("helvetica", "", 8.5)
    pdf.cell(0, 5, f"Ogni euro investito in Digital Care AI ne ha generati {ratio:.1f}. Stima su valore medio trattamenti e show-up storico.")

    pdf.set_xy(14, 280)
    pdf.set_text_color(148, 163, 184)
    pdf.set_font("helvetica", "I", 8)
    pdf.cell(0, 5, f"Generato automaticamente da Digital Care AI il {today.strftime('%d/%m/%Y')}")
    return bytes(pdf.output())


@api_router.get("/report/roi")
async def roi_report(user: dict = Depends(require_clinic)):
    clinic = await db.clinics.find_one({"id": user["clinic_id"]}, {"_id": 0})
    data = await db.clinic_data.find_one({"clinic_id": user["clinic_id"]}, {"_id": 0})
    if not clinic or not data:
        raise HTTPException(status_code=404, detail="Dati dello studio non trovati")
    pdf_bytes = build_roi_pdf(clinic, data["metrics"])
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=report-roi.pdf"},
    )


@api_router.get("/admin/clinics/{clinic_id}/report")
async def admin_roi_report(clinic_id: str, admin: dict = Depends(require_admin)):
    clinic = await db.clinics.find_one({"id": clinic_id}, {"_id": 0})
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinica non trovata")
    data = await db.clinic_data.find_one({"clinic_id": clinic_id}, {"_id": 0})
    pdf_bytes = build_roi_pdf(clinic, data["metrics"])
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=report-roi.pdf"},
    )


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


async def push_notification(clinic_id: str, type_: str, text: str):
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "clinic_id": clinic_id,
        "type": type_,
        "text": text,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read": False,
    })


APPT_TEMPLATE = [
    (-12, "09:30", "Franco Neri", "Igiene", "segreteria"),
    (-12, "11:00", "Silvia Gatti", "Controllo", "ai"),
    (-10, "10:00", "Roberto Conti", "Otturazione", "ai"),
    (-10, "15:00", "Laura Pellegrini", "Igiene", "segreteria"),
    (-8, "09:00", "Giuseppe Riva", "Impianto", "segreteria"),
    (-8, "14:30", "Martina Bassi", "Faccette", "ai"),
    (-6, "10:30", "Alessandro Fontana", "Controllo", "ai"),
    (-6, "16:00", "Valentina Ricci", "Igiene", "ai"),
    (-4, "09:15", "Stefano Marchetti", "Urgenza", "ai"),
    (-4, "11:45", "Federica Leone", "Controllo", "segreteria"),
    (-2, "09:00", "Tommaso Galli", "Igiene", "ai"),
    (-2, "14:00", "Elisa Barbieri", "Otturazione", "segreteria"),
    (-1, "10:00", "Nicola Ferraro", "Controllo", "ai"),
    (-1, "15:30", "Giorgia Villa", "Igiene", "ai"),
    (0, "09:00", "Maria Ferrari", "Igiene", "ai"),
    (0, "09:45", "Luca Bianchi", "Controllo", "segreteria"),
    (0, "10:30", "Anna Colombo", "Faccette", "ai"),
    (0, "11:30", "Giulia Romano", "Urgenza", "ai"),
    (0, "14:00", "Paolo Greco", "Impianto", "segreteria"),
    (0, "15:15", "Sara Marino", "Otturazione", "ai"),
    (0, "16:30", "Davide Russo", "Igiene", "ai"),
    (1, "09:30", "Francesca Sartori", "Igiene", "ai"),
    (1, "11:00", "Andrea Mancini", "Controllo", "segreteria"),
    (1, "15:00", "Beatrice Rizzo", "Faccette", "ai"),
    (2, "10:00", "Lorenzo Moretti", "Otturazione", "ai"),
    (2, "14:30", "Camilla Rinaldi", "Igiene", "segreteria"),
    (3, "09:00", "Mattia Caruso", "Controllo", "ai"),
    (3, "16:00", "Aurora Gentile", "Igiene", "ai"),
    (5, "09:45", "Riccardo Lombardi", "Impianto", "segreteria"),
    (5, "11:30", "Sofia Mariani", "Controllo", "ai"),
    (6, "10:30", "Gabriele Ferrero", "Igiene", "ai"),
    (8, "09:00", "Alice Benedetti", "Faccette", "ai"),
    (8, "14:00", "Edoardo Palmieri", "Controllo", "segreteria"),
    (9, "10:00", "Greta Santoro", "Igiene", "ai"),
    (10, "11:00", "Pietro Lombardo", "Otturazione", "ai"),
]


def generate_appointments() -> list:
    today = datetime.now(timezone.utc).date()
    out = []
    for offset, time_, patient, treatment, source in APPT_TEMPLATE:
        d = today + timedelta(days=offset)
        if d.weekday() >= 5:
            continue
        out.append({"date": d.isoformat(), "time": time_, "patient": patient, "treatment": treatment, "source": source})
    return out


def default_clinic_data(clinic_id: str) -> dict:
    return {
        "clinic_id": clinic_id,
        "notifications": 3,
        "metrics": {"appointments_ai": 48, "delta_pct": 12, "recovered": 14, "hours_saved": 56, "value_eur": 3200},
        "appointments": generate_appointments(),
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


async def seed_notifications(clinic_id: str):
    if await db.notifications.count_documents({"clinic_id": clinic_id}) > 0:
        return
    now = datetime.now(timezone.utc)
    seeds = [
        ("booking_ai", "L'AI ha fissato un'urgenza per Giulia Romano alle 11:30", 25),
        ("recovered", "Disdetta delle 15:00 recuperata: slot riassegnato a Sara Marino", 95),
        ("call_started", "L'AI ha completato la chiamata a Elena Vitale (lista d'attesa)", 190),
        ("booking_ai", "L'AI ha fissato un'igiene per Davide Russo alle 16:30", 320),
    ]
    for type_, text, mins in seeds:
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "clinic_id": clinic_id,
            "type": type_,
            "text": text,
            "created_at": (now - timedelta(minutes=mins)).isoformat(),
            "read": False,
        })


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
    await seed_notifications(clinic_id)
    logger.info("Clinica demo seedata: %s", email)


async def migrate_clinic_data():
    async for data in db.clinic_data.find({}):
        appts = data.get("appointments", [])
        if appts and "date" not in appts[0]:
            await db.clinic_data.update_one({"_id": data["_id"]}, {"$set": {"appointments": generate_appointments()}})
        await seed_notifications(data["clinic_id"])


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await seed_admin()
    await seed_demo_clinic()
    await migrate_clinic_data()


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
