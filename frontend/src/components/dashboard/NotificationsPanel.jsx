import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CalendarCheck, Phone, Undo2, ShieldAlert, CheckCheck } from "lucide-react";
import api from "@/lib/api";

const TYPE_META = {
  booking_ai: { icon: CalendarCheck, color: "text-emerald-300", bg: "border-emerald-400/30 bg-emerald-400/10" },
  call_started: { icon: Phone, color: "text-cyan-300", bg: "border-cyan-400/30 bg-cyan-400/10" },
  call_completed: { icon: Phone, color: "text-emerald-300", bg: "border-emerald-400/30 bg-emerald-400/10" },
  recovered: { icon: Undo2, color: "text-amber-300", bg: "border-amber-400/30 bg-amber-400/10" },
  takeover: { icon: ShieldAlert, color: "text-red-300", bg: "border-red-400/30 bg-red-400/10" },
};

const timeAgo = (iso) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "adesso";
  if (mins < 60) return `${mins} min fa`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h fa`;
  return `${Math.round(h / 24)}g fa`;
};

export const NotificationsPanel = () => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  const load = async () => {
    try {
      const { data } = await api.get("/notifications");
      setItems(data.items);
      setUnread(data.unread);
    } catch {}
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const markAllRead = async () => {
    await api.post("/notifications/read-all").catch(() => {});
    load();
  };

  return (
    <div ref={ref} className="relative">
      <button
        data-testid="topbar-notifications"
        onClick={() => setOpen((o) => !o)}
        className={`relative flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
          open ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300" : "border-cyan-400/15 bg-[#0D1320]/70 text-slate-300 hover:border-cyan-400/40 hover:text-cyan-300"
        }`}
      >
        <Bell className="h-4.5 w-4.5" />
        {unread > 0 && (
          <span data-testid="notifications-badge" className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-cyan-400 px-1 font-mono text-[10px] font-bold text-slate-950 shadow-[0_0_10px_rgba(0,245,212,0.6)]">
            {unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            data-testid="notifications-panel"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="glass absolute right-0 top-12 z-50 w-[380px] overflow-hidden rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-4">
              <div>
                <p className="font-display text-sm font-bold text-slate-50">Centro Notifiche</p>
                <p className="text-[11px] text-slate-500">Eventi dell'AI in tempo reale</p>
              </div>
              {unread > 0 && (
                <button
                  data-testid="notifications-read-all"
                  onClick={markAllRead}
                  className="flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/[0.07] px-3 py-1.5 text-[11px] font-semibold text-cyan-300 transition-colors hover:bg-cyan-400/15"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Segna lette
                </button>
              )}
            </div>
            <div className="chat-scroll max-h-[380px] divide-y divide-slate-800/60 overflow-y-auto">
              {items.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-500">Nessuna notifica.</p>}
              {items.map((n) => {
                const meta = TYPE_META[n.type] || TYPE_META.booking_ai;
                const Icon = meta.icon;
                return (
                  <div key={n.id} data-testid={`notification-item-${n.id}`} className={`flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-cyan-400/[0.03] ${n.read ? "opacity-60" : ""}`}>
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${meta.bg}`}>
                      <Icon className={`h-4 w-4 ${meta.color}`} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-snug text-slate-200">{n.text}</p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(0,245,212,0.7)]" />}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
