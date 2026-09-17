import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Bot, User, Loader2, CalendarDays, Plus, X, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, addWeeks,
  format, isSameMonth, isSameDay, isToday,
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

const TREATMENTS = ["Igiene", "Controllo", "Urgenza", "Impianto", "Otturazione", "Faccette"];
const WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const fmtKey = (d) => format(d, "yyyy-MM-dd");

const EMPTY_APPT = {
  patient: "",
  phone: "",
  date: format(new Date(), "yyyy-MM-dd"),
  time: "09:00",
  treatment: "Igiene",
  visit_type: "prima",
  price: "80",
  urgency: false,
  notes: "",
};

const INPUT_CLS =
  "w-full rounded-xl border border-slate-700/80 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-400/60 [color-scheme:dark]";

const AddAppointmentModal = ({ onClose, onSaved }) => {
  const [form, setForm] = useState(EMPTY_APPT);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/calendar/appointments", { ...form, price: parseFloat(form.price) || 0 });
      toast.success(`${form.patient} aggiunto in agenda`, {
        description: `${format(new Date(`${form.date}T${form.time}`), "EEEE d MMMM 'alle' HH:mm", { locale: it })}`,
      });
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Errore durante il salvataggio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      data-testid="add-appointment-modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/80 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 20 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="glass my-auto w-full max-w-lg rounded-3xl p-8"
      >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h3 className="font-display text-xl font-bold text-slate-50">Nuovo Paziente</h3>
            <p className="mt-1 text-sm text-slate-500">Aggiungi manualmente un appuntamento in agenda.</p>
          </div>
          <button data-testid="add-appt-close" onClick={onClose} className="text-slate-500 transition-colors hover:text-slate-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Nome e cognome</label>
              <input data-testid="add-appt-name" required value={form.patient} onChange={set("patient")} placeholder="Mario Rossi" className={INPUT_CLS} />
            </div>
            <div className="col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Numero di telefono</label>
              <input data-testid="add-appt-phone" required value={form.phone} onChange={set("phone")} placeholder="+39 333 1234567" className={INPUT_CLS} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Data</label>
              <input data-testid="add-appt-date" type="date" required value={form.date} onChange={set("date")} className={INPUT_CLS} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Ora</label>
              <input data-testid="add-appt-time" type="time" required value={form.time} onChange={set("time")} className={INPUT_CLS} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Motivo</label>
              <select data-testid="add-appt-treatment" value={form.treatment} onChange={set("treatment")} className={INPUT_CLS}>
                {TREATMENTS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Tipo visita</label>
              <select data-testid="add-appt-visit-type" value={form.visit_type} onChange={set("visit_type")} className={INPUT_CLS}>
                <option value="prima">Prima visita</option>
                <option value="seconda">Seconda visita</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Prezzo (€)</label>
              <input data-testid="add-appt-price" type="number" min="0" step="5" required value={form.price} onChange={set("price")} className={INPUT_CLS} />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-red-400/30 bg-red-400/[0.07] px-4 py-2.5">
                <input
                  data-testid="add-appt-urgency"
                  type="checkbox"
                  checked={form.urgency}
                  onChange={(e) => setForm((f) => ({ ...f, urgency: e.target.checked }))}
                  className="h-4 w-4 accent-red-500"
                />
                <span className="text-sm font-semibold text-red-300">Urgenza</span>
              </label>
            </div>
            <div className="col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Note (opzionale)</label>
              <input data-testid="add-appt-notes" value={form.notes} onChange={set("notes")} placeholder="Es. allergia a penicillina, preferisce il mattino…" className={INPUT_CLS} />
            </div>
          </div>

          <button
            data-testid="add-appt-submit"
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 py-3.5 font-display text-sm font-bold text-slate-950 shadow-[0_0_26px_rgba(0,245,212,0.3)] transition-all hover:shadow-[0_0_40px_rgba(0,245,212,0.45)] disabled:opacity-70"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Salvataggio…" : "Aggiungi in agenda"}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
};

const EditAppointmentModal = ({ appt, onClose, onSaved }) => {
  const [date, setDate] = useState(appt.date);
  const [time, setTime] = useState(appt.time);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/calendar/appointments/${appt.id}`, { date, time });
      toast.success(`${appt.patient} spostato`, {
        description: `${format(new Date(`${date}T${time}`), "EEEE d MMMM 'alle' HH:mm", { locale: it })}`,
      });
      onSaved();
      onClose();
    } catch {
      toast.error("Errore durante lo spostamento");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      data-testid="edit-appointment-modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 20 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="glass w-full max-w-sm rounded-3xl p-8"
      >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h3 className="font-display text-xl font-bold text-slate-50">Sposta appuntamento</h3>
            <p className="mt-1 text-sm text-slate-500">
              {appt.patient} · {appt.treatment}
            </p>
          </div>
          <button data-testid="edit-appt-close" onClick={onClose} className="text-slate-500 transition-colors hover:text-slate-300">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Nuova data</label>
            <input data-testid="edit-appt-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={INPUT_CLS} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Nuova ora</label>
            <input data-testid="edit-appt-time" type="time" required value={time} onChange={(e) => setTime(e.target.value)} className={INPUT_CLS} />
          </div>
          <button
            data-testid="edit-appt-submit"
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 py-3.5 font-display text-sm font-bold text-slate-950 shadow-[0_0_26px_rgba(0,245,212,0.3)] transition-all hover:shadow-[0_0_40px_rgba(0,245,212,0.45)] disabled:opacity-70"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Salvataggio…" : "Conferma spostamento"}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default function CalendarView() {
  const [cursor, setCursor] = useState(new Date());
  const [mode, setMode] = useState("month");
  const [selected, setSelected] = useState(new Date());
  const [appts, setAppts] = useState(null);
  const [modal, setModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const handleDelete = async (a) => {
    if (deleteId !== a.id) {
      setDeleteId(a.id);
      setTimeout(() => setDeleteId((cur) => (cur === a.id ? null : cur)), 3000);
      return;
    }
    try {
      await api.delete(`/calendar/appointments/${a.id}`);
      toast.success(`${a.patient} rimosso dall'agenda`);
      setDeleteId(null);
      setReloadKey((k) => k + 1);
    } catch {
      toast.error("Errore durante la cancellazione");
    }
  };

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
  }, [range, reloadKey]);

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
          <button
            data-testid="calendar-add-button"
            onClick={() => setModal(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2.5 font-display text-sm font-bold text-slate-950 shadow-[0_0_22px_rgba(0,245,212,0.35)] transition-all hover:shadow-[0_0_36px_rgba(0,245,212,0.55)]"
          >
            <Plus className="h-4 w-4" />
            Aggiungi Paziente
          </button>
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
                  {(a.phone || a.price || a.visit_type) && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      {[
                        a.phone,
                        a.visit_type ? (a.visit_type === "prima" ? "1ª visita" : "2ª visita") : null,
                        a.price ? `€${a.price}` : null,
                        a.notes || null,
                      ].filter(Boolean).join(" · ")}
                    </p>
                  )}
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
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    data-testid={`appt-edit-${i}`}
                    onClick={() => setEditTarget(a)}
                    title="Sposta appuntamento"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-slate-500 transition-colors hover:border-cyan-400/40 hover:text-cyan-300"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    data-testid={`appt-delete-${i}`}
                    onClick={() => handleDelete(a)}
                    title={deleteId === a.id ? "Clicca di nuovo per confermare" : "Cancella appuntamento"}
                    className={`flex h-8 items-center justify-center rounded-lg border px-2 text-[11px] font-semibold transition-colors ${
                      deleteId === a.id
                        ? "border-red-500/60 bg-red-500/15 text-red-300"
                        : "border-slate-700 text-slate-500 hover:border-red-500/40 hover:text-red-400"
                    }`}
                  >
                    {deleteId === a.id ? "Conferma" : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {modal && <AddAppointmentModal onClose={() => setModal(false)} onSaved={() => setReloadKey((k) => k + 1)} />}
        {editTarget && <EditAppointmentModal appt={editTarget} onClose={() => setEditTarget(null)} onSaved={() => setReloadKey((k) => k + 1)} />}
      </AnimatePresence>
    </main>
  );
}
