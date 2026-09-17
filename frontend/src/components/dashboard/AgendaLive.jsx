import { motion } from "framer-motion";
import { Bot, User, CalendarDays } from "lucide-react";

const TREATMENT_STYLES = {
  Igiene: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300",
  Urgenza: "border-red-400/30 bg-red-400/10 text-red-300",
  Impianto: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  Controllo: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  Otturazione: "border-teal-400/30 bg-teal-400/10 text-teal-300",
  Faccette: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
};

export const AgendaLive = ({ appointments }) => (
  <motion.section
    data-testid="agenda-live-container"
    initial={{ opacity: 0, y: 28 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.7, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
    className="glass rounded-2xl p-6"
  >
    <div className="mb-5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/10">
          <CalendarDays className="h-5 w-5 text-cyan-300" />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-slate-50">Agenda Live</h2>
          <p className="text-xs text-slate-500">Gli appuntamenti di oggi, aggiornati in tempo reale</p>
        </div>
      </div>
      <span className="flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/[0.07] px-3 py-1 font-mono text-[10px] font-bold tracking-[0.18em] text-emerald-300">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        LIVE
      </span>
    </div>

    <div data-testid="agenda-table" className="divide-y divide-slate-800/70">
      {appointments.map((a, i) => (
        <motion.div
          key={`${a.time}-${a.patient}`}
          initial={{ opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.7 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="group flex items-center gap-4 py-3.5 transition-colors hover:bg-cyan-400/[0.03] sm:px-3 sm:-mx-3 sm:rounded-xl"
        >
          <span className="w-14 shrink-0 font-mono text-sm font-bold text-cyan-300">{a.time}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-100">{a.patient}</p>
            <span className={`mt-1 inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${TREATMENT_STYLES[a.treatment] || TREATMENT_STYLES.Controllo}`}>
              {a.treatment}
            </span>
          </div>
          {a.source === "ai" ? (
            <span
              data-testid={`agenda-badge-ai-${i}`}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 shadow-[0_0_14px_rgba(0,255,135,0.12)]"
            >
              <Bot className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Prenotato da AI</span>
              <span className="sm:hidden">AI</span>
            </span>
          ) : (
            <span
              data-testid={`agenda-badge-segreteria-${i}`}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-600/50 bg-slate-700/30 px-3 py-1.5 text-[11px] font-semibold text-slate-400"
            >
              <User className="h-3.5 w-3.5" />
              Segreteria
            </span>
          )}
        </motion.div>
      ))}
    </div>
  </motion.section>
);
