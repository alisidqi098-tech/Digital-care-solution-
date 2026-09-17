import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MessagesSquare, Bot, ShieldAlert, CalendarCheck, Loader2, RefreshCw } from "lucide-react";
import api from "@/lib/api";

const timeAgo = (iso) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "adesso";
  if (mins < 60) return `${mins} min fa`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h fa`;
  return `${Math.round(h / 24)}g fa`;
};

const Bubble = ({ m, i }) => (
  <motion.div
    key={i}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay: i * 0.04 }}
    className={`flex ${m.from === "patient" ? "justify-start" : "justify-end"}`}
  >
    <div
      className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
        m.from === "patient"
          ? "rounded-bl-md bg-slate-800/90 text-slate-200"
          : m.from === "operator"
            ? "rounded-br-md border border-amber-400/40 bg-amber-400/15 text-amber-100"
            : "rounded-br-md border border-cyan-400/30 bg-cyan-400/10 text-cyan-50"
      }`}
    >
      {m.from !== "patient" && (
        <span className={`mb-1 flex items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-[0.18em] ${m.from === "operator" ? "text-amber-400" : "text-cyan-300/80"}`}>
          {m.from === "operator" ? <ShieldAlert className="h-2.5 w-2.5" /> : <Bot className="h-2.5 w-2.5" />}
          {m.from === "operator" ? "Operatore" : "Digital Care AI"}
        </span>
      )}
      {m.text}
    </div>
  </motion.div>
);

export default function ChatHistoryView() {
  const [convs, setConvs] = useState(null);
  const [active, setActive] = useState(null);
  const [loadingConv, setLoadingConv] = useState(false);

  const load = async () => {
    const { data } = await api.get("/chat/conversations");
    setConvs(data.conversations);
    return data.conversations;
  };

  const open = async (id) => {
    setLoadingConv(true);
    try {
      const { data } = await api.get(`/chat/conversations/${id}`);
      setActive(data);
    } finally {
      setLoadingConv(false);
    }
  };

  useEffect(() => {
    load()
      .then((list) => {
        if (list.length) open(list[0].id);
      })
      .catch(() => setConvs([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main data-testid="chat-history-view" className="mx-auto max-w-[1500px] space-y-6 px-6 pb-16 pt-8 lg:px-10">
      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/10">
            <MessagesSquare className="h-5 w-5 text-cyan-300" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-50 sm:text-3xl">Chat & Pazienti</h1>
            <p className="text-xs text-slate-500">Storico delle conversazioni gestite dall'AI, salvate in automatico</p>
          </div>
        </div>
        <button
          data-testid="chat-history-refresh"
          onClick={load}
          className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-400 transition-colors hover:border-cyan-400/40 hover:text-cyan-300"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Aggiorna
        </button>
      </motion.header>

      {!convs ? (
        <div className="flex h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="glass overflow-hidden rounded-2xl xl:col-span-4"
          >
            <div className="border-b border-slate-800/80 px-5 py-4">
              <p className="font-display text-sm font-bold text-slate-50">Conversazioni</p>
              <p className="text-[11px] text-slate-500">{convs.length} in archivio</p>
            </div>
            <div className="chat-scroll max-h-[560px] divide-y divide-slate-800/60 overflow-y-auto">
              {convs.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-500">Nessuna conversazione salvata. Scrivi nella chat live per crearne una.</p>}
              {convs.map((c) => {
                const initials = c.patient_name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                const isActive = active?.id === c.id;
                return (
                  <button
                    key={c.id}
                    data-testid={`conversation-item-${c.id}`}
                    onClick={() => open(c.id)}
                    className={`flex w-full items-start gap-3 px-5 py-4 text-left transition-colors ${isActive ? "bg-cyan-400/[0.07]" : "hover:bg-cyan-400/[0.03]"}`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/30 to-emerald-400/20 font-display text-xs font-bold text-cyan-200">
                      {initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-slate-100">{c.patient_name}</span>
                        <span className="shrink-0 font-mono text-[10px] text-slate-500">{timeAgo(c.updated_at)}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">{c.preview}</span>
                      <span className="mt-1.5 flex items-center gap-2">
                        <span className="font-mono text-[10px] text-slate-600">{c.message_count} messaggi</span>
                        {c.booking_confirmed && (
                          <span className="flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                            <CalendarCheck className="h-2.5 w-2.5" />
                            Prenotato
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="glass overflow-hidden rounded-2xl xl:col-span-6"
          >
            {loadingConv ? (
              <div className="flex h-[560px] items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-cyan-300" />
              </div>
            ) : !active ? (
              <div className="flex h-[560px] items-center justify-center text-sm text-slate-500">Seleziona una conversazione</div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-slate-800/80 px-6 py-4">
                  <div>
                    <p data-testid="conversation-active-name" className="font-display text-sm font-bold text-slate-50">{active.patient_name}</p>
                    <p className="text-[11px] text-slate-500">Iniziata {timeAgo(active.created_at)}</p>
                  </div>
                  {active.booking_confirmed && (
                    <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-300">
                      <CalendarCheck className="h-3.5 w-3.5" />
                      Appuntamento fissato
                    </span>
                  )}
                </div>
                <div data-testid="conversation-messages" className="chat-scroll h-[500px] space-y-3 overflow-y-auto px-6 py-5">
                  {active.messages.map((m, i) => (
                    <Bubble key={i} m={m} i={i} />
                  ))}
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </main>
  );
}
