import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Settings, Loader2, Save, Clock, MessageSquareText, CalendarClock, ScrollText } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

const TONES = [
  { id: "professionale", label: "Professionale", desc: "Rassicurante e competente, stile clinico premium" },
  { id: "amichevole", label: "Amichevole", desc: "Caldo e informale, mette a proprio agio i pazienti" },
  { id: "formale", label: "Formale", desc: "Impeccabile e cerimoniale, dà sempre del Lei" },
];

const DAY_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

const INPUT_CLS =
  "rounded-xl border border-slate-700/80 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 outline-none transition-colors focus:border-cyan-400/60 [color-scheme:dark]";

const Toggle = ({ checked, onChange, testid }) => (
  <button
    data-testid={testid}
    type="button"
    onClick={() => onChange(!checked)}
    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${checked ? "bg-cyan-400/80 shadow-[0_0_14px_rgba(0,245,212,0.4)]" : "bg-slate-700"}`}
  >
    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all duration-200 ${checked ? "left-6" : "left-1"}`} />
  </button>
);

const Section = ({ icon: Icon, title, sub, children, delay = 0 }) => (
  <motion.section
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    className="glass rounded-2xl p-6"
  >
    <div className="mb-5 flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/10">
        <Icon className="h-5 w-5 text-cyan-300" />
      </span>
      <div>
        <h2 className="font-display text-lg font-bold tracking-tight text-slate-50">{title}</h2>
        <p className="text-xs text-slate-500">{sub}</p>
      </div>
    </div>
    {children}
  </motion.section>
);

export default function ImpostazioniView() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/settings").then((r) => setSettings(r.data)).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put("/settings", settings);
      setSettings(data);
      toast.success("Impostazioni salvate", { description: "L'assistente AI userà le nuove regole da subito in chat." });
    } catch {
      toast.error("Errore durante il salvataggio");
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
      </div>
    );
  }

  const toggleDay = (d) =>
    setSettings((s) => ({
      ...s,
      work_days: s.work_days.includes(d) ? s.work_days.filter((x) => x !== d) : [...s.work_days, d].sort((a, b) => a - b),
    }));

  return (
    <main data-testid="impostazioni-view" className="mx-auto max-w-[1100px] space-y-6 px-6 pb-16 pt-8 lg:px-10">
      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/10">
            <Settings className="h-5 w-5 text-cyan-300" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-50 sm:text-3xl">Impostazioni AI</h1>
            <p className="text-xs text-slate-500">Tono di voce, orari e regole del tuo assistente — attive subito in chat</p>
          </div>
        </div>
        <button
          data-testid="settings-save-button"
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-3 font-display text-sm font-bold text-slate-950 shadow-[0_0_26px_rgba(0,245,212,0.3)] transition-all hover:shadow-[0_0_40px_rgba(0,245,212,0.45)] disabled:opacity-70"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Salvataggio…" : "Salva impostazioni"}
        </button>
      </motion.header>

      <Section icon={MessageSquareText} title="Tono di voce" sub="Come l'AI parla con i tuoi pazienti" delay={0.15}>
        <div className="grid gap-3 sm:grid-cols-3">
          {TONES.map((t) => (
            <button
              key={t.id}
              data-testid={`settings-tone-${t.id}`}
              onClick={() => setSettings((s) => ({ ...s, tone: t.id }))}
              className={`rounded-2xl border p-5 text-left transition-all duration-200 ${
                settings.tone === t.id
                  ? "border-cyan-400/60 bg-cyan-400/10 shadow-[0_0_24px_rgba(0,245,212,0.15)]"
                  : "border-slate-800 bg-slate-900/40 hover:border-cyan-400/30"
              }`}
            >
              <p className={`font-display text-base font-bold ${settings.tone === t.id ? "text-cyan-300" : "text-slate-200"}`}>{t.label}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{t.desc}</p>
            </button>
          ))}
        </div>
      </Section>

      <Section icon={Clock} title="Orari dello studio" sub="L'AI propone appuntamenti solo in questi orari e giorni" delay={0.25}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <input data-testid="settings-work-start" type="time" value={settings.work_start} onChange={(e) => setSettings((s) => ({ ...s, work_start: e.target.value }))} className={INPUT_CLS} />
            <span className="text-sm text-slate-500">→</span>
            <input data-testid="settings-work-end" type="time" value={settings.work_end} onChange={(e) => setSettings((s) => ({ ...s, work_end: e.target.value }))} className={INPUT_CLS} />
          </div>
          <div className="flex gap-1.5">
            {DAY_LABELS.map((label, i) => {
              const day = i + 1;
              const active = settings.work_days.includes(day);
              return (
                <button
                  key={day}
                  data-testid={`settings-day-${day}`}
                  onClick={() => toggleDay(day)}
                  className={`h-9 w-11 rounded-lg border text-xs font-bold transition-all ${
                    active ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300" : "border-slate-800 text-slate-600 hover:border-slate-600"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      <Section icon={CalendarClock} title="Prenotazioni" sub="Come l'AI gestisce gli slot in agenda" delay={0.35}>
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Durata slot</label>
            <select data-testid="settings-slot-duration" value={settings.slot_duration} onChange={(e) => setSettings((s) => ({ ...s, slot_duration: Number(e.target.value) }))} className={INPUT_CLS}>
              {[15, 30, 45, 60].map((m) => (
                <option key={m} value={m}>{m} minuti</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <Toggle testid="settings-auto-confirm" checked={settings.auto_confirm} onChange={(v) => setSettings((s) => ({ ...s, auto_confirm: v }))} />
            <div>
              <p className="text-sm font-semibold text-slate-200">Conferma automatica</p>
              <p className="text-xs text-slate-500">L'AI blocca lo slot senza chiedere conferma alla segreteria</p>
            </div>
          </div>
        </div>
      </Section>

      <Section icon={ScrollText} title="Regole personalizzate" sub="Istruzioni speciali che l'AI rispetta sempre in chat" delay={0.45}>
        <textarea
          data-testid="settings-rules"
          rows={4}
          value={settings.rules}
          onChange={(e) => setSettings((s) => ({ ...s, rules: e.target.value }))}
          placeholder="Es. Non proporre mai impianti al telefono, solo consulto in studio. Per le urgenze chiedere sempre se c'è gonfiore. I pazienti VIP del Dott. Bellini hanno priorità sugli slot delle 9:00."
          className="w-full rounded-xl border border-slate-700/80 bg-slate-900/60 px-4 py-3 text-sm leading-relaxed text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-400/60"
        />
        <p className="mt-2 text-[11px] text-slate-600">Queste regole vengono iniettentae nel contesto dell'assistente a ogni conversazione.</p>
      </Section>
    </main>
  );
}
