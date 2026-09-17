import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Bot, Building2, Plus, LogOut, Euro, CalendarCheck, Clock, X, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/App";
import BackgroundFX from "@/components/dashboard/BackgroundFX";

const PLANS = [
  { id: "starter", label: "Starter", mrr: 497 },
  { id: "professional", label: "Professional", mrr: 997 },
  { id: "elite", label: "Elite", mrr: 1497 },
];

const EMPTY_FORM = { name: "", doctor_name: "", email: "", password: "", plan: "professional" };

const AddClinicModal = ({ onClose, onCreated }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/admin/clinics", form);
      toast.success(`${form.name} attivata`, { description: `Credenziali create per ${form.email}` });
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Errore durante la creazione della clinica");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      data-testid="add-clinic-modal"
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
        className="glass w-full max-w-lg rounded-3xl p-8"
      >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h3 className="font-display text-xl font-bold text-slate-50">Nuova Clinica</h3>
            <p className="mt-1 text-sm text-slate-500">Crea l'account e le credenziali di accesso per lo studio.</p>
          </div>
          <button data-testid="add-clinic-close" onClick={onClose} className="text-slate-500 transition-colors hover:text-slate-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {[
            ["name", "Nome dello studio", "Studio Dentistico Rossi", "text", "add-clinic-name-input"],
            ["doctor_name", "Nome del dottore", "Dr. Luca Rossi", "text", "add-clinic-doctor-input"],
            ["email", "Email di accesso", "rossi@studioclinico.it", "email", "add-clinic-email-input"],
            ["password", "Password provvisoria", "Minimo 8 caratteri", "text", "add-clinic-password-input"],
          ].map(([key, label, ph, type, testid]) => (
            <div key={key}>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">{label}</label>
              <input
                data-testid={testid}
                type={type}
                required
                minLength={key === "password" ? 8 : undefined}
                value={form[key]}
                onChange={set(key)}
                placeholder={ph}
                className="w-full rounded-xl border border-slate-700/80 bg-slate-900/60 px-4 py-3 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-400/60"
              />
            </div>
          ))}

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Piano</label>
            <div className="grid grid-cols-3 gap-2">
              {PLANS.map((p) => (
                <button
                  key={p.id}
                  data-testid={`add-clinic-plan-${p.id}`}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, plan: p.id }))}
                  className={`rounded-xl border px-3 py-2.5 text-center transition-all ${
                    form.plan === p.id
                      ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-200 shadow-[0_0_16px_rgba(0,245,212,0.15)]"
                      : "border-slate-700/80 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  <span className="block text-sm font-bold">{p.label}</span>
                  <span className="block font-mono text-[11px] text-slate-500">€{p.mrr}/mese</span>
                </button>
              ))}
            </div>
          </div>

          <button
            data-testid="add-clinic-submit"
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 py-3.5 font-display text-sm font-bold text-slate-950 shadow-[0_0_26px_rgba(0,245,212,0.3)] transition-all hover:shadow-[0_0_40px_rgba(0,245,212,0.45)] disabled:opacity-70"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Creazione in corso…" : "Crea account clinica"}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default function AdminConsole() {
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [modal, setModal] = useState(false);

  const load = () => api.get("/admin/overview").then((r) => setData(r.data));
  useEffect(() => {
    load().catch(() => {});
  }, []);

  const toggleStatus = async (clinic) => {
    const next = clinic.status === "attiva" ? "sospesa" : "attiva";
    try {
      await api.patch(`/admin/clinics/${clinic.id}`, { status: next });
      toast.success(`${clinic.name}: account ${next}`);
      load();
    } catch {
      toast.error("Impossibile aggiornare lo stato");
    }
  };

  const totals = data?.totals;
  const stats = totals
    ? [
        { label: "Cliniche Attive", value: totals.clinics_active, icon: Building2, testid: "admin-stat-cliniche" },
        { label: "MRR Totale", value: `€ ${totals.mrr.toLocaleString("it-IT")}`, icon: Euro, testid: "admin-stat-mrr" },
        { label: "Appuntamenti AI (30gg)", value: totals.appointments_ai_month, icon: CalendarCheck, testid: "admin-stat-appuntamenti" },
        { label: "Ore Risparmiate (30gg)", value: `${totals.hours_saved}h`, icon: Clock, testid: "admin-stat-ore" },
      ]
    : [];

  return (
    <div className="relative min-h-screen">
      <BackgroundFX />
      <div className="relative z-10">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-cyan-400/10 bg-[#080C14]/75 px-6 py-4 backdrop-blur-xl lg:px-10">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 shadow-[0_0_18px_rgba(0,245,212,0.25)]">
              <Bot className="h-5 w-5 text-cyan-300" />
            </span>
            <div>
              <p data-testid="admin-logo" className="font-display text-lg font-extrabold tracking-tight text-slate-50">
                Digital Care <span className="bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-transparent">AI</span>
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-300/60">Console Super Admin</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-400 sm:block">{user.name}</span>
            <button
              data-testid="admin-logout-button"
              onClick={logout}
              className="flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-400 transition-colors hover:border-red-500/40 hover:text-red-400"
            >
              <LogOut className="h-3.5 w-3.5" />
              Esci
            </button>
          </div>
        </header>

        <main data-testid="admin-main" className="mx-auto max-w-[1400px] space-y-8 px-6 pb-16 pt-10 lg:px-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="block overflow-hidden">
                <motion.span
                  className="block font-mono text-xs uppercase tracking-[0.3em] text-cyan-300/70"
                  initial={{ y: "110%" }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                >
                  Panoramica globale in tempo reale
                </motion.span>
              </span>
              <span className="mt-2 block overflow-hidden">
                <motion.span
                  className="block font-display text-3xl font-extrabold tracking-tight text-slate-50 sm:text-4xl"
                  initial={{ y: "110%" }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                >
                  Le tue cliniche
                </motion.span>
              </span>
            </div>
            <motion.button
              data-testid="add-clinic-button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              onClick={() => setModal(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-3 font-display text-sm font-bold text-slate-950 shadow-[0_0_26px_rgba(0,245,212,0.3)] transition-all hover:shadow-[0_0_40px_rgba(0,245,212,0.45)]"
            >
              <Plus className="h-4 w-4" />
              Aggiungi Clinica
            </motion.button>
          </div>

          {!data ? (
            <div className="flex h-[40vh] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map(({ label, value, icon: Icon, testid }, i) => (
                  <motion.div
                    key={testid}
                    data-testid={testid}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.25 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                    className="glass glass-hover rounded-2xl p-6"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/10">
                      <Icon className="h-5 w-5 text-cyan-300" />
                    </span>
                    <p className="mt-4 font-display text-3xl font-black tracking-tight text-slate-50">{value}</p>
                    <p className="mt-1.5 text-sm font-medium text-slate-400">{label}</p>
                  </motion.div>
                ))}
              </div>

              <motion.div
                data-testid="admin-clinics-table"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="glass overflow-hidden rounded-2xl"
              >
                <div className="border-b border-slate-800/80 px-6 py-5">
                  <h2 className="font-display text-lg font-bold text-slate-50">Clienti attivi</h2>
                  <p className="text-xs text-slate-500">Ogni clinica accede solo ai propri dati, con credenziali dedicate.</p>
                </div>
                <div className="divide-y divide-slate-800/70">
                  {data.clinics.map((c) => (
                    <div key={c.id} data-testid={`admin-clinic-row-${c.id}`} className="flex flex-wrap items-center gap-4 px-6 py-4 transition-colors hover:bg-cyan-400/[0.03]">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/[0.07] font-display text-sm font-bold text-cyan-300">
                        {c.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-100">{c.name}</p>
                        <p className="truncate text-xs text-slate-500">
                          {c.doctor_name} · {c.email}
                        </p>
                      </div>
                      <span className="rounded-full border border-cyan-400/25 bg-cyan-400/[0.07] px-3 py-1 font-mono text-[11px] font-bold text-cyan-300">
                        {PLANS.find((p) => p.id === c.plan)?.label || c.plan} · €{c.mrr}/m
                      </span>
                      <span className="hidden font-mono text-xs text-slate-500 md:block">
                        {c.appointments_ai} appunt. AI · €{c.value_eur.toLocaleString("it-IT")}
                      </span>
                      <button
                        data-testid={`admin-clinic-status-${c.id}`}
                        onClick={() => toggleStatus(c)}
                        className={`rounded-full border px-3.5 py-1.5 text-[11px] font-bold transition-all ${
                          c.status === "attiva"
                            ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20"
                            : "border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                        }`}
                      >
                        {c.status === "attiva" ? "Attiva" : "Sospesa"}
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </main>
      </div>

      <AnimatePresence>
        {modal && <AddClinicModal onClose={() => setModal(false)} onCreated={load} />}
      </AnimatePresence>
    </div>
  );
}
