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
import secrets
import time
import ipaddress
import httpx
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse
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


EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Digital Care AI")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")
APP_URL = os.environ.get("APP_URL", "")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} ≠ real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str, reply_to: str | None = None):
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if reply_to or EMAIL_REPLY_TO:
        payload["contact_email"] = reply_to or EMAIL_REPLY_TO
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
        return resp.json().get("id")
    except Exception as e:
        logger.error("Email send error: %s", e)
        return None


def reset_email_html(name: str, link: str) -> str:
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#080C14;padding:32px 0">'
        '<tr><td align="center">'
        '<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#0D1320;border:1px solid rgba(0,245,212,0.25);border-radius:16px;padding:36px;font-family:Arial,sans-serif">'
        '<tr><td>'
        '<p style="color:#00F5D4;font-size:20px;font-weight:bold;margin:0 0 4px">DIGITAL CARE AI</p>'
        f'<p style="color:#F8FAFC;font-size:16px;margin:16px 0 8px">Ciao {escape(name)},</p>'
        '<p style="color:#94A3B8;font-size:14px;line-height:1.6;margin:0 0 24px">Abbiamo ricevuto una richiesta di reimpostazione della password del tuo gestionale. Il link è valido per 1 ora.</p>'
        f'<p style="margin:0 0 24px"><a href="{link}" style="display:inline-block;background:#00F5D4;color:#080C14;font-weight:bold;font-size:14px;text-decoration:none;padding:14px 28px;border-radius:10px">Reimposta la password</a></p>'
        '<p style="color:#64748B;font-size:12px;line-height:1.6;margin:0">Se non hai richiesto tu il reset, ignora questa email. Non ti chiederemo mai la password via email.</p>'
        f'<p style="color:#475569;font-size:11px;margin:24px 0 0">Inviato da {escape(EMAIL_FROM_NAME)}</p>'
        '</td></tr></table></td></tr></table>'
    )


class ForgotInput(BaseModel):
    email: EmailStr


class ResetInput(BaseModel):
    token: str
    password: str


@api_router.post("/auth/forgot-password")
async def forgot_password(input: ForgotInput):
    email = input.email.strip().lower()
    identifier = f"fp:{email}"
    attempts = await db.login_attempts.find_one({"identifier": identifier})
    if attempts and attempts.get("count", 0) >= 3:
        last = attempts.get("last_attempt")
        if last and datetime.now(timezone.utc) - last < timedelta(minutes=15):
            raise HTTPException(status_code=429, detail="Troppe richieste. Riprova tra 15 minuti.")
    await db.login_attempts.update_one(
        {"identifier": identifier},
        {"$inc": {"count": 1}, "$set": {"last_attempt": datetime.now(timezone.utc)}},
        upsert=True,
    )
    user = await db.users.find_one({"email": email})
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "token": token,
            "email": email,
            "expires_at": int(time.time()) + 3600,
            "used": False,
        })
        link = f"{APP_URL}/reset-password?token={token}"
        await send_email(
            to=email,
            subject=f"Reimposta la tua password — {EMAIL_FROM_NAME}",
            html=reset_email_html(user["name"], link),
        )
    return {"ok": True}


@api_router.post("/auth/reset-password")
async def reset_password(input: ResetInput):
    doc = await db.password_reset_tokens.find_one({"token": input.token})
    if not doc or doc.get("used") or doc.get("expires_at", 0) < int(time.time()):
        raise HTTPException(status_code=400, detail="Link non valido o scaduto. Richiedi un nuovo link.")
    if len(input.password) < 8:
        raise HTTPException(status_code=400, detail="La password deve avere almeno 8 caratteri")
    await db.users.update_one({"email": doc["email"]}, {"$set": {"password_hash": hash_password(input.password)}})
    await db.password_reset_tokens.update_one({"token": input.token}, {"$set": {"used": True}})
    return {"ok": True}


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
        "clinic": {"name": clinic["name"], "doctor_name": clinic["doctor_name"], "plan": clinic["plan"], "email": clinic["email"]},
        "metrics": data["metrics"],
        "appointments": sorted((a for a in data["appointments"] if a.get("date") == today), key=lambda a: a["time"]),
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


class AppointmentCreate(BaseModel):
    date: str
    time: str
    patient: str
    phone: str
    treatment: str
    price: float = 0
    visit_type: str = "prima"
    urgency: bool = False
    notes: Optional[str] = ""


@api_router.post("/calendar/appointments")
async def add_appointment(input: AppointmentCreate, user: dict = Depends(require_clinic)):
    appt = {
        "id": str(uuid.uuid4()),
        "date": input.date,
        "time": input.time,
        "patient": input.patient.strip(),
        "treatment": "Urgenza" if input.urgency else input.treatment,
        "source": "segreteria",
        "phone": input.phone.strip(),
        "price": input.price,
        "visit_type": input.visit_type,
        "notes": input.notes or "",
    }
    await db.clinic_data.update_one({"clinic_id": user["clinic_id"]}, {"$push": {"appointments": appt}})
    return appt


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
    clinic = await db.clinics.find_one({"id": user["clinic_id"]}, {"_id": 0})
    if clinic.get("plan") != "elite":
        raise HTTPException(status_code=403, detail="Le chiamate AI sono disponibili solo sul piano Elite")
    data = await db.clinic_data.find_one({"clinic_id": user["clinic_id"]}, {"_id": 0})
    entry = next((w for w in (data or {}).get("waitlist", []) if w["id"] == waitlist_id), None)
    if not entry:
        raise HTTPException(status_code=404, detail="Paziente non trovato in lista d'attesa")
    await push_notification(user["clinic_id"], "call_started", f"L'AI ha avviato la chiamata a {entry['patient']} (lista d'attesa - {entry['treatment']})")
    return {"ok": True, "patient": entry["patient"]}


@api_router.post("/waitlist/{waitlist_id}/call/summary")
async def waitlist_call_summary(waitlist_id: str, user: dict = Depends(require_clinic)):
    clinic = await db.clinics.find_one({"id": user["clinic_id"]}, {"_id": 0})
    if clinic.get("plan") != "elite":
        raise HTTPException(status_code=403, detail="Le chiamate AI sono disponibili solo sul piano Elite")
    data = await db.clinic_data.find_one({"clinic_id": user["clinic_id"]}, {"_id": 0})
    entry = next((w for w in (data or {}).get("waitlist", []) if w["id"] == waitlist_id), None)
    if not entry:
        raise HTTPException(status_code=404, detail="Paziente non trovato in lista d'attesa")
    esito, summary = "da_richiamare", "Il paziente non ha confermato. Consigliato un nuovo tentativo domani mattina."
    try:
        chat = LlmChat(
            api_key=os.environ["EMERGENT_LLM_KEY"],
            session_id=f"callsum-{uuid.uuid4()}",
            system_message=(
                "Generi riassunti realistici e concisi dell'esito di chiamate automatiche di uno studio dentistico. "
                "Rispondi SOLO con un oggetto JSON valido, nient'altro."
            ),
        ).with_model("openai", "gpt-5.4")
        prompt = (
            f"Lo studio {clinic['name']} ha fatto chiamare dall'assistente AI il paziente {entry['patient']} "
            f"(in lista d'attesa per: {entry['treatment']}; nota: {entry['note']}) per proporgli un appuntamento anticipato. "
            "Scrivi l'esito della chiamata in JSON: "
            '{"esito": "confermato" | "non_risposto" | "da_richiamare", "summary": "riassunto di massimo 2 frasi in italiano, con dettagli plausibili (orario proposto, preferenze del paziente)"}. '
            "Nel 70% dei casi il paziente conferma."
        )
        raw = await chat.send_message(UserMessage(text=prompt))
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        parsed = json.loads(match.group(0)) if match else {}
        if parsed.get("esito") in ("confermato", "non_risposto", "da_richiamare") and parsed.get("summary"):
            esito, summary = parsed["esito"], parsed["summary"]
    except Exception as exc:
        logger.error("Call summary LLM error: %s", exc)
    await push_notification(user["clinic_id"], "call_completed", f"Esito chiamata a {entry['patient']}: {summary}")
    return {"esito": esito, "summary": summary, "patient": entry["patient"]}


class ChatHistoryInput(BaseModel):
    history: List[dict]
    conversation_id: Optional[str] = None
    patient_name: Optional[str] = None


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
    settings = {**DEFAULT_SETTINGS, **(data.get("settings") or {})}
    tone_map = {
        "professionale": "professionale, rassicurante e competente",
        "amichevole": "caldo, amichevole e informale",
        "formale": "formale e impeccabile, dando sempre del Lei",
    }
    rules_line = f"Regole dello studio da rispettare SEMPRE: {settings['rules']}. " if settings.get("rules") else ""
    free_slots = compute_free_slots(data, settings, datetime.now(timezone.utc).date())
    slots_line = ", ".join(free_slots[:6]) if free_slots else "nessuno slot libero oggi: proponi il primo giorno feriale disponibile"
    system_message = (
        f"Sei Digital Care AI, l'assistente virtuale dello {clinic['name']} del {clinic['doctor_name']}. "
        f"Tono di voce: {tone_map.get(settings['tone'], tone_map['professionale'])}. "
        "Rispondi SEMPRE in italiano, in stile messaggio chat: massimo 2 frasi brevi. "
        f"Orari dello studio: {settings['work_start']}-{settings['work_end']}. "
        f"{rules_line}"
        f"Agenda di oggi: {agenda}. Slot liberi oggi (calcolati dagli orari reali dello studio): {slots_line}. "
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
        reply_text = BOOKING_RE.sub("", full).strip()
        now_iso = datetime.now(timezone.utc).isoformat()
        messages_to_save = [{"from": m.get("from", "patient"), "text": m.get("text", ""), "ts": now_iso} for m in input.history]
        messages_to_save.append({"from": "ai", "text": reply_text, "ts": now_iso})
        conv_id = input.conversation_id
        if conv_id:
            await db.conversations.update_one(
                {"id": conv_id, "clinic_id": clinic_id},
                {"$set": {"messages": messages_to_save, "updated_at": now_iso, "booking_confirmed": bool(slot)}},
            )
        else:
            conv_id = str(uuid.uuid4())
            await db.conversations.insert_one({
                "id": conv_id,
                "clinic_id": clinic_id,
                "patient_name": input.patient_name or "Paziente",
                "messages": messages_to_save,
                "booking_confirmed": bool(slot),
                "created_at": now_iso,
                "updated_at": now_iso,
            })
        yield f"data: {json.dumps({'done': True, 'booking_confirmed': bool(slot), 'slot': slot, 'conversation_id': conv_id})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@api_router.get("/chat/conversations")
async def list_conversations(user: dict = Depends(require_clinic)):
    convs = await db.conversations.find({"clinic_id": user["clinic_id"]}, {"_id": 0}).sort("updated_at", -1).to_list(50)
    for c in convs:
        msgs = c.get("messages", [])
        c["preview"] = msgs[-1]["text"][:90] if msgs else ""
        c["message_count"] = len(msgs)
        c.pop("messages", None)
    return {"conversations": convs}


@api_router.get("/chat/conversations/{conv_id}")
async def get_conversation(conv_id: str, user: dict = Depends(require_clinic)):
    conv = await db.conversations.find_one({"id": conv_id, "clinic_id": user["clinic_id"]}, {"_id": 0})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversazione non trovata")
    return conv


DEFAULT_SETTINGS = {
    "tone": "professionale",
    "work_start": "09:00",
    "work_end": "18:00",
    "work_days": [1, 2, 3, 4, 5],
    "slot_duration": 30,
    "auto_confirm": True,
    "rules": "",
}


def compute_free_slots(data: dict, settings: dict, target_date) -> list:
    busy = {a["time"] for a in data.get("appointments", []) if a.get("date") == target_date.isoformat()}
    if (target_date.weekday() + 1) not in settings.get("work_days", [1, 2, 3, 4, 5]):
        return []
    start_h, start_m = map(int, settings["work_start"].split(":"))
    end_h, end_m = map(int, settings["work_end"].split(":"))
    dur = int(settings.get("slot_duration", 30))
    now = datetime.now(timezone.utc)
    slots = []
    t = start_h * 60 + start_m
    end = end_h * 60 + end_m
    while t + dur <= end:
        label = f"{t // 60:02d}:{t % 60:02d}"
        if label not in busy and (target_date > now.date() or t > now.hour * 60 + now.minute):
            slots.append(label)
        t += dur
    return slots


class SlotAssignInput(BaseModel):
    waitlist_id: str
    date: str
    time: str


@api_router.post("/slots/assign")
async def assign_slot(input: SlotAssignInput, user: dict = Depends(require_clinic)):
    data = await db.clinic_data.find_one({"clinic_id": user["clinic_id"]})
    entry = next((w for w in (data or {}).get("waitlist", []) if w["id"] == input.waitlist_id), None)
    if not entry:
        raise HTTPException(status_code=404, detail="Paziente non trovato in lista d'attesa")
    appt = {
        "id": str(uuid.uuid4()),
        "date": input.date,
        "time": input.time,
        "patient": entry["patient"],
        "treatment": entry["treatment"],
        "source": "segreteria",
        "notes": f"Da lista d'attesa · {entry['note']}",
    }
    await db.clinic_data.update_one(
        {"clinic_id": user["clinic_id"]},
        {"$push": {"appointments": appt}, "$pull": {"waitlist": {"id": input.waitlist_id}}},
    )
    await push_notification(user["clinic_id"], "booking_ai", f"{entry['patient']} assegnato allo slot delle {input.time} dalla lista d'attesa")
    return {"ok": True, "appointment": appt}


@api_router.get("/slots")
async def get_slots(date: str, user: dict = Depends(require_clinic)):
    data = await db.clinic_data.find_one({"clinic_id": user["clinic_id"]}, {"_id": 0})
    settings = {**DEFAULT_SETTINGS, **((data or {}).get("settings") or {})}
    try:
        target = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Data non valida (formato YYYY-MM-DD)")
    return {"date": date, "slots": compute_free_slots(data or {}, settings, target)}


@api_router.get("/settings")
async def get_settings(user: dict = Depends(require_clinic)):
    data = await db.clinic_data.find_one({"clinic_id": user["clinic_id"]}, {"_id": 0})
    return {**DEFAULT_SETTINGS, **((data or {}).get("settings") or {})}


class SettingsUpdate(BaseModel):
    tone: Optional[str] = None
    work_start: Optional[str] = None
    work_end: Optional[str] = None
    work_days: Optional[List[int]] = None
    slot_duration: Optional[int] = None
    auto_confirm: Optional[bool] = None
    rules: Optional[str] = None


@api_router.put("/settings")
async def update_settings(input: SettingsUpdate, user: dict = Depends(require_clinic)):
    updates = {k: v for k, v in input.model_dump().items() if v is not None}
    if "tone" in updates and updates["tone"] not in ("professionale", "amichevole", "formale"):
        raise HTTPException(status_code=400, detail="Tono non valido")
    if not updates:
        raise HTTPException(status_code=400, detail="Nessuna modifica")
    await db.clinic_data.update_one(
        {"clinic_id": user["clinic_id"]},
        {"$set": {f"settings.{k}": v for k, v in updates.items()}},
    )
    data = await db.clinic_data.find_one({"clinic_id": user["clinic_id"]}, {"_id": 0})
    return {**DEFAULT_SETTINGS, **((data or {}).get("settings") or {})}


class AppointmentUpdate(BaseModel):
    date: Optional[str] = None
    time: Optional[str] = None


@api_router.patch("/calendar/appointments/{appt_id}")
async def move_appointment(appt_id: str, input: AppointmentUpdate, user: dict = Depends(require_clinic)):
    data = await db.clinic_data.find_one({"clinic_id": user["clinic_id"]})
    appts = (data or {}).get("appointments", [])
    found = False
    for a in appts:
        if a.get("id") == appt_id:
            if input.date:
                a["date"] = input.date
            if input.time:
                a["time"] = input.time
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail="Appuntamento non trovato")
    await db.clinic_data.update_one({"clinic_id": user["clinic_id"]}, {"$set": {"appointments": appts}})
    return {"ok": True}


@api_router.delete("/calendar/appointments/{appt_id}")
async def delete_appointment(appt_id: str, user: dict = Depends(require_clinic)):
    result = await db.clinic_data.update_one(
        {"clinic_id": user["clinic_id"]},
        {"$pull": {"appointments": {"id": appt_id}}},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Appuntamento non trovato")
    return {"ok": True}


@api_router.get("/analytics")
async def get_analytics(days: int = 30, user: dict = Depends(require_clinic)):
    data = await db.clinic_data.find_one({"clinic_id": user["clinic_id"]}, {"_id": 0})
    all_daily = (data or {}).get("analytics", [])
    days = max(1, min(days, 90))
    daily = all_daily[-days:]
    previous = all_daily[-2 * days:-days] if len(all_daily) >= 2 * days else []

    def summarize(rows):
        total_chats = sum(d["chats"] for d in rows)
        total_bookings = sum(d["chat_bookings"] for d in rows)
        return {
            "total_chats": total_chats,
            "total_bookings": total_bookings,
            "conversion_rate": round(total_bookings / total_chats * 100) if total_chats else 0,
            "appointments_ai": sum(d["appointments_ai"] for d in rows),
            "value_eur": sum(d["value_eur"] for d in rows),
            "recovered": sum(d["recovered"] for d in rows),
        }

    return {"daily": daily, "summary": summarize(daily), "previous": summarize(previous), "days": days}


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
        "settings": dict(DEFAULT_SETTINGS),
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


def generate_analytics(clinic_id: str) -> list:
    import random
    rng = random.Random(clinic_id)
    today = datetime.now(timezone.utc).date()
    out = []
    for i in range(89, -1, -1):
        d = today - timedelta(days=i)
        weekday = d.weekday() < 5
        base = rng.randint(2, 5) if weekday else rng.randint(0, 1)
        chats = base + rng.randint(1, 4)
        bookings = max(0, chats - rng.randint(0, 2))
        out.append({
            "date": d.isoformat(),
            "appointments_ai": base,
            "appointments_total": base + (rng.randint(1, 3) if weekday else 0),
            "chats": chats,
            "chat_bookings": bookings,
            "value_eur": bookings * rng.choice([60, 80, 100, 120]),
            "recovered": rng.randint(0, 2) if weekday else 0,
        })
    return out


async def seed_conversations(clinic_id: str):
    if await db.conversations.count_documents({"clinic_id": clinic_id}) > 0:
        return
    now = datetime.now(timezone.utc)
    samples = [
        (
            "Elena Vitale",
            [
                {"from": "patient", "text": "Buongiorno, quanto costa una pulizia dei denti?"},
                {"from": "ai", "text": "Buongiorno Elena, l'igiene professionale parte da 80€. Vuole che le fissi un appuntamento questa settimana?"},
                {"from": "patient", "text": "Ci penso e vi faccio sapere, grazie"},
                {"from": "ai", "text": "Certo, resto a disposizione per qualsiasi cosa. Buona giornata!"},
            ],
            False,
            130,
        ),
        (
            "Marco Serra",
            [
                {"from": "patient", "text": "Ciao, devo spostare la mia igiene di giovedì, si può?"},
                {"from": "ai", "text": "Certo Marco! Ho disponibilità venerdì alle 10:00 oppure lunedì alle 9:30. Quale preferisci?"},
                {"from": "patient", "text": "Venerdì alle 10 va benissimo"},
                {"from": "ai", "text": "Fatto, igiene spostata a venerdì alle 10:00. Ti mando il promemoria il giorno prima!"},
            ],
            True,
            1600,
        ),
        (
            "Giulia Romano",
            [
                {"from": "patient", "text": "Buongiorno, ho un forte dolore a un molare. C'è posto oggi?"},
                {"from": "ai", "text": "Buongiorno Giulia, mi dispiace per il dolore. Oggi possiamo vederti alle 11:30 per un'urgenza oppure alle 16:00: quale preferisci?"},
                {"from": "patient", "text": "Perfetto, confermo le 11:30!"},
                {"from": "ai", "text": "Perfetto, la aspettiamo oggi alle 11:30 per l'urgenza. Se il dolore aumenta o hai gonfiore, avvisaci subito."},
            ],
            True,
            60,
        ),
    ]
    for patient_name, msgs, booked, mins in samples:
        ts = (now - timedelta(minutes=mins)).isoformat()
        await db.conversations.insert_one({
            "id": str(uuid.uuid4()),
            "clinic_id": clinic_id,
            "patient_name": patient_name,
            "messages": [{**m, "ts": ts} for m in msgs],
            "booking_confirmed": booked,
            "created_at": ts,
            "updated_at": ts,
        })


async def migrate_clinic_data():
    async for data in db.clinic_data.find({}):
        updates = {}
        appts = data.get("appointments", [])
        if appts and "date" not in appts[0]:
            updates["appointments"] = generate_appointments()
        elif any("id" not in a for a in appts):
            updates["appointments"] = [{**a, "id": a.get("id") or str(uuid.uuid4())} for a in appts]
        if "settings" not in data:
            updates["settings"] = dict(DEFAULT_SETTINGS)
        if len(data.get("analytics", [])) < 90:
            updates["analytics"] = generate_analytics(data["clinic_id"])
        if updates:
            await db.clinic_data.update_one({"_id": data["_id"]}, {"$set": updates})
        await seed_notifications(data["clinic_id"])
        await seed_conversations(data["clinic_id"])


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
