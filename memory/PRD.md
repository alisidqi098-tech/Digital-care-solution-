# PRD — Digital Care AI

## Problem Statement (originale)
Dashboard principale (Gestionale) per un SaaS High-Ticket "Digital Care AI" rivolto a cliniche dentistiche. Design premium dark mode, accenti verde acqua/ciano neon, glassmorphism, icone Lucide. Struttura: Top Bar (logo + nome studio + indicatore "AI ATTIVA 24/7" pulsante + notifiche/profilo), 4 Hero Metrics ROI (48 appuntamenti AI +12%, 14 disdette recuperate, 56h risparmiate, €3.200 valore generato), colonna sinistra 70% (Agenda Live con badge "Prenotato da AI"/"Segreteria" + Lista d'Attesa con bottone "Fai chiamare dall'AI"), colonna destra 30% (Live AI Chat simulata smartphone + grosso pulsante TAKEOVER rosso), sidebar stretta (Dashboard, Calendario, Chat & Pazienti, Analitiche, Impostazioni AI).
Aggiunta utente: gestionale multi-tenant per privacy dei dottori — doppio ruolo: Super Admin (proprietario, crea cliniche, gestisce abbonamenti, panoramica globale) e Dottore/Clinica (vede solo la propria dashboard). Login email+password, account creati manualmente dall'admin.

## User Personas
- **Super Admin** (proprietario di Digital Care AI): crea account cliniche, assegna credenziali, gestisce piani/abbonamenti, monitora metriche globali.
- **Dottore/Titolare clinica**: accede con credenziali fornite, vede solo i dati del proprio studio, monitora ROI dell'AI, può fare takeover manuale sulle chat.

## Architettura
- Frontend: React 19 + Tailwind + framer-motion + lenis, componenti in /app/frontend/src/components/{auth,dashboard,admin}
- Backend: FastAPI + MongoDB (motor), JWT (PyJWT) + bcrypt, cookie httpOnly + Bearer fallback, brute-force lockout (5 tentativi/15min)
- Ruoli: admin → /api/admin/* ; clinic → /api/dashboard (dati isolati per clinic_id)
- Piani: starter €497 / professional €997 / elite €1497

## Implementato (17 Set 2026)
- Login page premium (masked line reveal, glass card, error shake)
- Dashboard clinica: TopBar con AI status pulsante, 4 ROI card con count-up animato, marquee editoriale, Agenda Live con badge AI/Segreteria, Waitlist con simulazione chiamata AI + toast, Live Chat smartphone con typewriter loop, TAKEOVER con modale di conferma + risposta operatore + rilascio controllo, sidebar espandibile on-hover, sezioni placeholder (Calendario, Chat & Pazienti, Analitiche, Impostazioni AI)
- Console Super Admin: metriche globali (cliniche attive, MRR, appuntamenti AI, ore risparmiate), tabella clienti con piano/stato, toggle Attiva/Sospesa (login bloccato se sospesa), modale "Nuova Clinica" che crea account + credenziali + dati demo
- Seed: admin + clinica demo "Studio Dentistico Bellini"
- Fix: clipping bg-clip:text (padding-right), paint artifact gradienti post-animazione

## Credenziali test
Vedi /app/memory/test_credentials.md — admin@digitalcare.ai / Admin2026! ; bellini@studiobellini.it / Bellini2026!

## Implementato (17 Set 2026 — seconda iterazione)
- Chat AI REALE: endpoint SSE /api/chat/reply con GPT-5.4 (Emergent LLM Key), streaming token live nella chat, contesto agenda dello studio nel system prompt, marcatore [[PRENOTATO:HH:MM]] per rilevare conferme e creare notifiche. Input demo "scrivi come paziente" + takeover operatore invariato
- Calendario completo: vista Mese e Settimana (date-fns, locale IT), appuntamenti datati in Mongo (35 seed su ±12 giorni, solo feriali), dettaglio giorno con badge AI/Segreteria, endpoint /api/calendar
- Centro Notifiche: collection notifications per clinica, pannello dropdown nella TopBar con badge unread, polling 20s, "segna tutte lette", eventi reali da prenotazione chat AI e chiamata waitlist (endpoint /api/waitlist/{id}/call)
- Report ROI PDF: fpdf2 brandizzato (header dark, 4 box metriche, sintesi settimanale, riga ROI%), download da dashboard clinica (/api/report/roi) e da console admin per clinica (/api/admin/clinics/{id}/report)
- Login: bottoni accesso demo rapido "Entra come Super Admin" / "Entra come Studio Bellini"

## Implementato (17 Set 2026 — terza iterazione)
- Analitiche: endpoint /api/analytics (30 giorni daily seedati deterministicamente per clinica), vista con 4 KPI (conversione chat 83%, conversazioni, prenotazioni, valore) + 3 grafici recharts (andamento appuntamenti area, conversione chat bar, valore cumulato)
- Memoria Conversazioni: collection conversations, /api/chat/reply accetta conversation_id e persiste messaggi a fine stream (done event ritorna conversation_id), endpoint lista/dettaglio, vista "Chat & Pazienti" con archivio, badge "Prenotato", 3 conversazioni seedate

## Implementato (17 Set 2026 — quarta iterazione)
- Filtri Analitiche: selettore periodo 7/30/90 giorni (dati seed estesi a 90gg), summary periodo precedente dal backend, badge delta (+/-% e punti) su ogni KPI con "vs N giorni precedenti"

## Implementato (17 Set 2026 — quinta iterazione)
- Faccina AI brand (componente AIFace: cerchio nero, anello ciano glow, due occhi ovali con blink CSS) in TopBar status pill e logo sidebar
- Chiamate AI waitlist limitate al piano Elite: gate backend 403 + UI locked "Solo Elite" per piani inferiori
- Riassunto esito chiamata: dopo ~6s POST /api/waitlist/{id}/call/summary genera via GPT-5.4 esito (confermato/non_risposto/da_richiamare) + riassunto 2 frasi, card espandibile sotto il paziente + notifica call_completed
- Calendario: bottone "Aggiungi Paziente" con modale completo (nome, telefono, data, ora, motivo, tipo visita 1ª/2ª, prezzo, urgenza, note) → POST /api/calendar/appointments, dettaglio giorno mostra telefono/tipo visita/prezzo/note

## Implementato (17 Set 2026 — sesta iterazione)
- Impostazioni AI: GET/PUT /api/settings per clinica (tono professionale/amichevole/formale, orari, giorni, durata slot, auto-conferma, regole custom) — il system prompt della chat le usa davvero (verificato: tono amichevole + regola "chiedi se c'è gonfiore" seguita dall'AI)
- Modifica Appuntamenti: id su tutti gli appuntamenti (migrazione), PATCH/DELETE /api/calendar/appointments/{id}, bottoni sposta/cancella nel dettaglio giorno con modale e doppia conferma
- AIFace: occhi che si muovono con direzione e intervalli casuali (non ripetitivo), blink mantenuto, nessuna bocca

## Implementato (17 Set 2026 — settima iterazione)
- Slot Liberi Reali: compute_free_slots da orari/giorni/durata slot delle impostazioni meno appuntamenti occupati; endpoint /api/slots, strip "Slot liberi oggi" in dashboard, chat AI propone slot reali (non più fissi 11:30/16:00)
- Reset Password via email: Resend managed (EMERGENT_EMAIL_KEY), POST /api/auth/forgot-password (rate limit 3/15min, no user enumeration) + /api/auth/reset-password (token 1h, single-use), pagina /reset-password, modale "Password dimenticata?" sulla login, email HTML brandizzata dark. Nota: invio verificato 202 su delivered@resend.dev; l'email demo bellini@studiobellini.it è fittizia e viene bloccata dal proxy anti-undeliverable (con email reali funziona)
- Faccina AI hero: grande (96px) centrata in cima alla dashboard con pulse ring, saluto centrato
- Agenda del giorno ordinata per orario

## Implementato (17 Set 2026 — ottava iterazione)
- Prenota dallo Slot: chip slot liberi cliccabili in dashboard → modale assegnazione paziente da waitlist (POST /api/slots/assign: crea appuntamento, rimuove da waitlist, notifica)
- Notifiche: apertura pannello = mark-all-read automatico (badge scompare), rimosso bottone manuale
- Dropdown Studio in TopBar: piano con badge, dottore, email, azioni rapide (Impostazioni AI, Report ROI) — endpoint dashboard ora include clinic.email
- Dettaglio giorno calendario: telefono (chip ciano mono), prezzo (chip verde), tipo visita accanto al nome paziente

## Backlog
- P2: Dati reali per clinica (oggi ogni nuova clinica parte con dati demo)
- P2: Reset password self-service
- P2: Dati reali per clinica (oggi ogni nuova clinica parte con dati demo)
- P2: Invio report PDF via email settimanale automatico (Resend)
