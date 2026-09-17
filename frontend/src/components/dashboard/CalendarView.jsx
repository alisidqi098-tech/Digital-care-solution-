import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Bot, User, Loader2, CalendarDays } from "lucide-react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, addWeeks,
  format, isSameMonth, isSameDay, isToday, parseISO,
} from "date-fns";
import { it } from "date-fns/locale";
import api from "@/lib/api";

const TREATMENT_STYLES = {
  Igiene: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300",
  Urgenza: "border-red-400/30 bg-red-400/10 text-red-300",
  Impianto: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  Controllo: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  Otturazione: "border-teal-400/30 bg-teal-400/10 text-teal-300",
  Faccette: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
};

const WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const fmtKey = (d) => format(d, "yyyy-MM-dd");

export default function CalendarView() {
  const [cursor, setCursor] = useState(new Date());
  const [mode, setMode] = useState("month");
  const [selected, setSelected] = useState(new Date());
  const [appts, setAppts] = useState(null);

  const range = useMemo(() => {
    if (mode === "month") {
      return {
        start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
      };
    }
    return {
      start: startOfWeek(cursor, { weekStartsOn: 1 }),
      end: endOfWeek(cursor, { weekStartsOn: 1 }),
    };
  }, [cursor, mode]);

  useEffect(() => {
    setAppts(null);
    api
      .get(`/calendar?start=${fmtKey(range.start)}&end=${fmtKey(range.end)}`)
      .then((r) => setAppts(r.data.appointments))
      .catch(() => setAppts([]));
  }, [range]);

  const byDay = useMemo(() => {
    const map = {};
    (appts || []).forEach((a) => {
      (map[a.date] = map[a.date] || []).push(a);
    });
    Object.values(map).forEach((list) => list.sort((a, b) => a.time.localeCompare(b.time)));
    return map;
  }, [appts]);

  const days = useMemo(() => {
    const out = [];
    let d = range.start;
    while (d <= range.end) {
      out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }, [range]);

  const navigate = (dir) => setCursor((c) => (mode === "month" ? addMonths(c, dir) : addWeeks(c, dir)));
  const selectedAppts = byDay[fmtKey(selected)] || [];

  return (
    <main data-testid="calendar-view" className="mx-auto max-w-[1500px] space-y-6 px-6 pb-16 pt-8 lg:px-10">
      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/10">
            <CalendarDays className="h-5 w-5 text-cyan-300" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-extrabold capitalize tracking-tight text-slate-50 sm:text-3xl">
              {mode === "month" ? format(cursor, "MMMM yyyy", { locale: it }) : `Settimana del ${format(range.start, "d MMMM", { locale: it })}`}
            </h1>
            <p className="text-xs text-slate-500">Gli appuntamenti dello studio, inclusi quelli fissati dall'AI</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-slate-700/80 p-1">
            {["month", "week"].map((m) => (
              <button
                key={m}
                data-testid={`calendar-mode-${m}`}
                onClick={() => setMode(m)}
                className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
                  mode === m ? "bg-cyan-400/15 text-cyan-300 shadow-[0_0_14px_rgba(0,245,212,0.15)]" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {m === "month" ? "Mese" : "Settimana"}
              </button>
            ))}
          </div>
          <button data-testid="calendar-prev-button" onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700/80 text-slate-400 transition-colors hover:border-cyan-400/40 hover:text-cyan-300">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button data-testid="calendar-today-button" onClick={() => { setCursor(new Date()); setSelected(new Date()); }} className="rounded-xl border border-cyan-400/30 bg-cyan-400/[0.07] px-4 py-2 text-xs font-bold text-cyan-300 transition-colors hover:bg-cyan-400/15">
            Oggi
          </button>
          <button data-testid="calendar-next-button" onClick={() => navigate(1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700/80 text-slate-400 transition-colors hover:border-cyan-400/40 hover:text-cyan-300">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </motion.header>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="glass overflow-hidden rounded-2xl"
      >
        <div className="grid grid-cols-7 border-b border-slate-800/80">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-3 py-3 text-center font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
              {d}
            </div>
          ))}
        </div>

        {!appts ? (
          <div className="flex h-[420px] items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-cyan-300" />
          </div>
        ) : mode === "month" ? (
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = fmtKey(day);
              const list = byDay[key] || [];
              const inMonth = isSameMonth(day, cursor);
              const isSel = isSameDay(day, selected);
              return (
                <button
                  key={key}
                  data-testid={`calendar-day-${key}`}
                  onClick={() => setSelected(day)}
                  className={`min-h-[104px] border-b border-r border-slate-800/50 p-2 text-left align-top transition-colors [&:nth-child(7n)]:border-r-0 ${
                    isSel ? "bg-cyan-400/[0.08]" : "hover:bg-cyan-400/[0.03]"
                  } ${inMonth ? "" : "opacity-35"}`}
                >
                  <span className={`mb-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${isToday(day) ? "bg-cyan-400 text-slate-950 shadow-[0_0_12px_rgba(0,245,212,0.5)]" : "text-slate-400"}`}>
                    {format(day, "d")}
                  </span>
                  <span className="block space-y-1">
                    {list.slice(0, 2).map((a, i) => (
                      <span key={i} className={`block truncate rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${TREATMENT_STYLES[a.treatment] || TREATMENT_STYLES.Controllo}`}>
                        {a.time} {a.patient}
                      </span>
                    ))}
                    {list.length > 2 && <span className="block px-1 font-mono text-[10px] text-slate-500">+{list.length - 2} altri</span>}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = fmtKey(day);
              const list = byDay[key] || [];
              return (
                <div key={key} className="min-h-[380px] border-r border-slate-800/50 p-2.5 last:border-r-0">
                  <div className="mb-3 text-center">
                    <p className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${isToday(day) ? "bg-cyan-400 text-slate-950 shadow-[0_0_12px_rgba(0,245,212,0.5)]" : "text-slate-300"}`}>
                      {format(day, "d")}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {list.map((a, i) => (
                      <div key={i} className={`rounded-lg border px-2 py-1.5 ${TREATMENT_STYLES[a.treatment] || TREATMENT_STYLES.Controllo}`}>
                        <p className="font-mono text-[10px] font-bold">{a.time}</p>
                        <p className="truncate text-[11px] font-semibold">{a.patient}</p>
                        <p className="text-[10px] opacity-80">{a.treatment}</p>
                      </div>
                    ))}
                    {list.length === 0 && <p className="pt-6 text-center text-[10px] text-slate-700">—</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {mode === "month" && (
        <motion.div
          data-testid="calendar-day-detail"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="glass rounded-2xl p-6"
        >
          <h2 className="font-display text-lg font-bold capitalize tracking-tight text-slate-50">
            {format(selected, "EEEE d MMMM", { locale: it })}
          </h2>
          <p className="text-xs text-slate-500">{selectedAppts.length} appuntamenti</p>
          <div className="mt-4 divide-y divide-slate-800/70">
            {selectedAppts.length === 0 && <p className="py-4 text-sm text-slate-500">Nessun appuntamento in questa giornata.</p>}
            {selectedAppts.map((a, i) => (
              <div key={i} className="flex items-center gap-4 py-3">
                <span className="w-14 shrink-0 font-mono text-sm font-bold text-cyan-300">{a.time}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-100">{a.patient}</p>
                  <span className={`mt-1 inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${TREATMENT_STYLES[a.treatment] || TREATMENT_STYLES.Controllo}`}>
                    {a.treatment}
                  </span>
                </div>
                {a.source === "ai" ? (
                  <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-300">
                    <Bot className="h-3.5 w-3.5" />
                    Prenotato da AI
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-600/50 bg-slate-700/30 px-3 py-1.5 text-[11px] font-semibold text-slate-400">
                    <User className="h-3.5 w-3.5" />
                    Segreteria
                  </span>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </main>
  );
}
