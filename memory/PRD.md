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

## Backlog
- P0: Chat AI reale collegata a LLM (risposte live ai pazienti)
- P0: Sezione Calendario completa (vista settimana/mese)
- P1: Centro notifiche reale (eventi: prenotazione AI, disdetta recuperata, chiamata completata)
- P1: Analitiche con grafici (recharts) per clinica
- P1: Impostazioni AI (tono, orari, regole) persistite per clinica
- P2: Report ROI PDF settimanale brandizzato per clinica
- P2: Reset password self-service
- P2: Dati reali per clinica (oggi ogni nuova clinica parte con dati demo)
