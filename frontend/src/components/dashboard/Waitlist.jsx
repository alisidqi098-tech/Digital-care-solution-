import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Users, Loader2, Lock, PhoneOutgoing, PhoneMissed, PhoneCall, Crown } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

const ESITO_META = {
  confermato: { label: "Appuntamento confermato", cls: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300", icon: PhoneOutgoing },
  non_risposto: { label: "Nessuna risposta", cls: "border-red-400/30 bg-red-400/10 text-red-300", icon: PhoneMissed },
  da_richiamare: { label: "Da richiamare", cls: "border-amber-400/30 bg-amber-400/10 text-amber-300", icon: PhoneCall },
};

export const Waitlist = ({ entries, plan }) => {
  const [calls, setCalls] = useState({});
  const elite = plan === "elite";

  const startCall = async (id, name) => {
    setCalls((c) => ({ ...c, [id]: { state: "calling" } }));
    try {
      await api.post(`/waitlist/${id}/call`);
      toast.info(`Chiamata AI in corso verso ${name}…`, {
        description: "L'assistente sta proponendo gli slot liberi in agenda.",
      });
    } catch {
      setCalls((c) => ({ ...c, [id]: null }));
      toast.error("Impossibile avviare la chiamata");
      return;
    }
    setTimeout(async () => {
      try {
        const { data } = await api.post(`/waitlist/${id}/call/summary`);
        setCalls((c) => ({ ...c, [id]: { state: "done", ...data } }));
        toast.success(`Chiamata a ${name} completata`, {
          description: "Leggi il riassunto dell'esito sotto il paziente.",
        });
      } catch {
        setCalls((c) => ({
          ...c,
          [id]: { state: "done", esito: "da_richiamare", summary: "Esito non disponibile al momento. Riprova più tardi." },
        }));
      }
    }, 6000);
  };

  return (
    <motion.section
      data-testid="waitlist-container"
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="glass rounded-2xl p-6"
    >
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-400/10">
            <Users className="h-5 w-5 text-amber-300" />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight text-slate-50">Lista d'Attesa</h2>
            <p className="text-xs text-slate-500">Pazienti pronti a riempire il primo buco libero</p>
          </div>
        </div>
        {!elite && (
          <span className="flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-amber-300">
            <Crown className="h-3 w-3" />
            Solo Elite
          </span>
        )}
      </div>

      <div className="space-y-3">
        {entries.map((w) => {
          const call = calls[w.id];
          const meta = call?.state === "done" ? ESITO_META[call.esito] || ESITO_META.da_richiamare : null;
          const MetaIcon = meta?.icon;
          return (
            <div key={w.id}>
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-900/40 px-4 py-3.5 transition-colors hover:border-cyan-400/25">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-100">{w.patient}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {w.treatment} · {w.note}
                  </p>
                </div>
                {!elite ? (
                  <span
                    data-testid={`waitlist-locked-${w.id}`}
                    className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/50 px-4 py-2 text-xs font-semibold text-slate-500"
                    title="Le chiamate AI sono disponibili solo sul piano Elite"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    Chiamata AI — Elite
                  </span>
                ) : call?.state === "done" ? (
                  <span className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold ${meta.cls}`}>
                    <MetaIcon className="h-3.5 w-3.5" />
                    {meta.label}
                  </span>
                ) : (
                  <button
                    data-testid={`waitlist-ai-call-button-${w.id}`}
                    onClick={() => startCall(w.id, w.patient)}
                    disabled={call?.state === "calling"}
                    className="flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-xs font-bold text-cyan-300 transition-all duration-200 hover:bg-cyan-400/20 hover:shadow-[0_0_18px_rgba(0,245,212,0.3)] disabled:opacity-70"
                  >
                    {call?.state === "calling" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Phone className="h-3.5 w-3.5" />}
                    {call?.state === "calling" ? "Chiamata in corso…" : "Fai chiamare dall'AI"}
                  </button>
                )}
              </div>
              <AnimatePresence>
                {call?.state === "done" && call.summary && (
                  <motion.div
                    data-testid={`waitlist-call-summary-${w.id}`}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className={`mx-2 mt-1.5 rounded-xl border px-4 py-3 ${meta.cls} bg-opacity-5`}>
                      <p className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.2em] opacity-80">
                        <MetaIcon className="h-3 w-3" />
                        Riassunto esito chiamata
                      </p>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-slate-200">{call.summary}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </motion.section>
  );
};
