import { useState } from "react";
import { motion } from "framer-motion";
import { X, Loader2, Zap, UserCheck } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

export const SlotAssignModal = ({ slot, date, waitlist, onClose, onAssigned }) => {
  const [saving, setSaving] = useState(null);

  const assign = async (w) => {
    setSaving(w.id);
    try {
      await api.post("/slots/assign", { waitlist_id: w.id, date, time: slot });
      toast.success(`${w.patient} prenotato alle ${slot}`, {
        description: "Aggiunto in agenda e rimosso dalla lista d'attesa.",
      });
      onAssigned();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Errore durante l'assegnazione");
      setSaving(null);
    }
  };

  return (
    <motion.div
      data-testid="slot-assign-modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="glass w-full max-w-md rounded-3xl p-7"
      >
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10">
              <Zap className="h-5 w-5 text-cyan-300" />
            </span>
            <div>
              <h3 className="font-display text-lg font-bold text-slate-50">Slot delle {slot}</h3>
              <p className="text-xs text-slate-500">Assegnalo a un paziente in lista d'attesa</p>
            </div>
          </div>
          <button data-testid="slot-assign-close" onClick={onClose} className="text-slate-500 transition-colors hover:text-slate-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2.5">
          {waitlist.length === 0 && (
            <p className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-500">
              Nessun paziente in lista d'attesa al momento.
            </p>
          )}
          {waitlist.map((w) => (
            <div key={w.id} className="flex items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-900/40 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-100">{w.patient}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {w.treatment} · {w.note}
                </p>
              </div>
              <button
                data-testid={`slot-assign-${w.id}`}
                onClick={() => assign(w)}
                disabled={saving !== null}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3.5 py-2 text-xs font-bold text-emerald-300 transition-all hover:bg-emerald-400/20 hover:shadow-[0_0_16px_rgba(0,255,135,0.25)] disabled:opacity-60"
              >
                {saving === w.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
                Assegna
              </button>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};
