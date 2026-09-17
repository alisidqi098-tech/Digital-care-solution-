import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Phone, Video, MoreVertical, Send, ShieldAlert, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";

const TypingDots = () => (
  <div className="flex items-center gap-1 px-1 py-1">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="h-1.5 w-1.5 rounded-full bg-cyan-300 animate-typing-dot"
        style={{ animationDelay: `${i * 0.18}s` }}
      />
    ))}
  </div>
);

export const LiveChat = ({ script = [], patientName = "Giulia Romano" }) => {
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);
  const [takeover, setTakeover] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    if (takeover || !script.length) return undefined;
    let cancelled = false;
    const timers = new Set();
    const wait = (ms) =>
      new Promise((res) => {
        const id = setTimeout(res, ms);
        timers.add(id);
      });

    const play = async () => {
      while (!cancelled) {
        setMessages([]);
        setTyping(false);
        await wait(900);
        for (const m of script) {
          if (cancelled) return;
          setTyping(m.from === "ai");
          await wait(m.from === "ai" ? 1300 : 850);
          if (cancelled) return;
          setTyping(false);
          if (m.from === "ai") {
            for (let i = 1; i <= m.text.length; i += 1) {
              if (cancelled) return;
              const partial = m.text.slice(0, i);
              setMessages((prev) => [...prev.filter((p) => p.id !== m.id), { ...m, text: partial }]);
              await wait(15);
            }
          } else {
            setMessages((prev) => [...prev, m]);
          }
          await wait(1100);
        }
        await wait(8000);
      }
    };
    play();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [takeover, script]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  const confirmTakeover = () => {
    setConfirmOpen(false);
    setTakeover(true);
    toast.warning("Controllo umano attivo", {
      description: "L'AI è in pausa. Stai rispondendo come operatore dello studio.",
    });
  };

  const release = () => {
    setTakeover(false);
    toast.success("AI riattivata", { description: "L'assistente ha ripreso il controllo della conversazione." });
  };

  const sendHuman = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setMessages((prev) => [...prev, { id: `op-${Date.now()}`, from: "operator", text: draft.trim() }]);
    setDraft("");
  };

  const initials = patientName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-5"
    >
      <div
        data-testid="live-chat-smartphone-container"
        className="relative overflow-hidden rounded-[36px] border border-slate-700/70 bg-[#0A0F1A] shadow-[0_0_60px_rgba(0,245,212,0.12)]"
      >
        <div className="mx-auto mt-3 h-5 w-28 rounded-full bg-slate-800/90" />

        <div className="mt-3 flex items-center gap-3 border-b border-slate-800/80 px-5 pb-3.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/30 to-emerald-400/20 font-display text-sm font-bold text-cyan-200">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-100">{patientName}</p>
            <p className={`flex items-center gap-1.5 text-[11px] ${takeover ? "text-amber-400" : "text-emerald-400"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${takeover ? "bg-amber-400" : "bg-emerald-400 animate-pulse"}`} />
              {takeover ? "Operatore umano" : "AI in ascolto"}
            </p>
          </div>
          <div className="flex items-center gap-3 text-slate-500">
            <Phone className="h-4 w-4" />
            <Video className="h-4 w-4" />
            <MoreVertical className="h-4 w-4" />
          </div>
        </div>

        <p className="px-5 pt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/60">
          Chat Pazienti in Tempo Reale
        </p>

        <div ref={scrollRef} className="chat-scroll h-[340px] space-y-3 overflow-y-auto px-4 py-4">
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div
                key={m.id}
                data-testid={`live-chat-message-${m.from}-${i}`}
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={`flex ${m.from === "patient" ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
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
            ))}
          </AnimatePresence>
          {typing && (
            <div className="flex justify-end">
              <div className="rounded-2xl rounded-br-md border border-cyan-400/25 bg-cyan-400/10">
                <TypingDots />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-800/80 px-4 py-3.5">
          {takeover ? (
            <form onSubmit={sendHuman} className="flex items-center gap-2">
              <input
                data-testid="takeover-reply-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Scrivi come operatore…"
                className="min-w-0 flex-1 rounded-full border border-amber-400/30 bg-slate-900/80 px-4 py-2.5 text-[13px] text-slate-100 outline-none placeholder:text-slate-600 focus:border-amber-400/60"
              />
              <button
                data-testid="takeover-reply-send"
                type="submit"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400 text-slate-950 transition-transform hover:scale-105"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <p className="flex items-center justify-center gap-2 py-1.5 text-center text-[11px] text-slate-500">
              <Bot className="h-3.5 w-3.5 text-cyan-400/70" />
              L'AI sta gestendo la conversazione per te
            </p>
          )}
        </div>
      </div>

      {takeover ? (
        <button
          data-testid="takeover-release-button"
          onClick={release}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 py-4 font-display text-sm font-bold tracking-wide text-emerald-300 transition-all duration-200 hover:bg-emerald-400/20 hover:shadow-[0_0_30px_rgba(0,255,135,0.25)]"
        >
          <RotateCcw className="h-4.5 w-4.5" />
          RIAFFIDA IL CONTROLLO ALL'AI
        </button>
      ) : (
        <button
          data-testid="takeover-button"
          onClick={() => setConfirmOpen(true)}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-red-500/50 bg-gradient-to-r from-red-500/20 to-orange-500/20 py-4 font-display text-sm font-bold tracking-wide text-red-300 shadow-[0_0_24px_rgba(255,59,48,0.18)] transition-all duration-200 hover:from-red-500/30 hover:to-orange-500/30 hover:text-red-200 hover:shadow-[0_0_36px_rgba(255,59,48,0.35)]"
        >
          <ShieldAlert className="h-5 w-5" />
          TAKEOVER: Intervieni e blocca l'AI
        </button>
      )}

      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            data-testid="takeover-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6 backdrop-blur-sm"
            onClick={() => setConfirmOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 20 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl border border-red-500/40 bg-[#0D1320] p-8 shadow-[0_0_60px_rgba(255,59,48,0.25)]"
            >
              <div className="mb-5 flex items-start justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-500/40 bg-red-500/15">
                  <ShieldAlert className="h-6 w-6 text-red-400" />
                </span>
                <button data-testid="takeover-modal-close" onClick={() => setConfirmOpen(false)} className="text-slate-500 transition-colors hover:text-slate-300">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <h3 className="font-display text-xl font-bold text-slate-50">Prendere il controllo manuale?</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                L'AI verrà messa in pausa su questa conversazione e risponderai tu come operatore dello studio. Potrai riaffidare il controllo all'AI in qualsiasi momento.
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  data-testid="takeover-modal-cancel"
                  onClick={() => setConfirmOpen(false)}
                  className="flex-1 rounded-xl border border-slate-700 py-3 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800"
                >
                  Annulla
                </button>
                <button
                  data-testid="takeover-modal-confirm"
                  onClick={confirmTakeover}
                  className="flex-1 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 py-3 text-sm font-bold text-white shadow-[0_0_24px_rgba(255,59,48,0.35)] transition-transform hover:scale-[1.02]"
                >
                  Sì, intervengo io
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
