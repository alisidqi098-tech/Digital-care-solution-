import { useState } from "react";
import { motion } from "framer-motion";
import { Phone, Users, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

export const Waitlist = ({ entries }) => {
  const [calls, setCalls] = useState({});

  const startCall = async (id, name) => {
    setCalls((c) => ({ ...c, [id]: "calling" }));
    try {
      await api.post(`/waitlist/${id}/call`);
    } catch {}
    setTimeout(() => {
      setCalls((c) => ({ ...c, [id]: "done" }));
      toast.success(`L'AI sta chiamando ${name}`, {
        description: "Evento registrato nel Centro Notifiche.",
      });
    }, 2200);
  };

  return (
    <motion.section
      data-testid="waitlist-container"
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="glass rounded-2xl p-6"
    >
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-400/10">
          <Users className="h-5 w-5 text-amber-300" />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-slate-50">Lista d'Attesa</h2>
          <p className="text-xs text-slate-500">Pazienti pronti a riempire il primo buco libero</p>
        </div>
      </div>

      <div className="space-y-3">
        {entries.map((w) => {
          const state = calls[w.id];
          return (
            <div
              key={w.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-900/40 px-4 py-3.5 transition-colors hover:border-cyan-400/25"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-100">{w.patient}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {w.treatment} · {w.note}
                </p>
              </div>
              {state === "done" ? (
                <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3.5 py-2 text-xs font-semibold text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  AI in chiamata
                </span>
              ) : (
                <button
                  data-testid={`waitlist-ai-call-button-${w.id}`}
                  onClick={() => startCall(w.id, w.patient)}
                  disabled={state === "calling"}
                  className="flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-xs font-bold text-cyan-300 transition-all duration-200 hover:bg-cyan-400/20 hover:shadow-[0_0_18px_rgba(0,245,212,0.3)] disabled:opacity-70"
                >
                  {state === "calling" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Phone className="h-3.5 w-3.5" />}
                  {state === "calling" ? "Chiamata in corso…" : "Fai chiamare dall'AI"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </motion.section>
  );
};
