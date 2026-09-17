import { motion } from "framer-motion";
import { CalendarDays, MessagesSquare, BarChart3, Settings } from "lucide-react";

const META = {
  calendario: { icon: CalendarDays, title: "Calendario", desc: "Vista settimanale e mensile dell'agenda dello studio." },
  chat: { icon: MessagesSquare, title: "Chat & Pazienti", desc: "Tutte le conversazioni gestite dall'AI e lo storico pazienti." },
  analitiche: { icon: BarChart3, title: "Analitiche", desc: "Report approfonditi su ROI, conversioni e performance dell'AI." },
  impostazioni: { icon: Settings, title: "Impostazioni AI", desc: "Voce, tono, orari e regole comportamentali del tuo assistente." },
};

export const PlaceholderView = ({ view }) => {
  const meta = META[view] || META.calendario;
  const Icon = meta.icon;
  return (
    <main data-testid={`placeholder-${view}`} className="mx-auto flex max-w-[1500px] flex-col items-center px-6 pb-16 pt-24 text-center lg:px-10">
      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex h-20 w-20 items-center justify-center rounded-3xl border border-cyan-400/25 bg-cyan-400/10 shadow-[0_0_40px_rgba(0,245,212,0.15)]"
      >
        <Icon className="h-9 w-9 text-cyan-300" />
      </motion.span>
      <span className="mt-8 block overflow-hidden">
        <motion.span
          className="block font-display text-3xl font-extrabold tracking-tight text-slate-50 sm:text-4xl"
          initial={{ y: "110%" }}
          animate={{ y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          {meta.title}
        </motion.span>
      </span>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.6 }}
        className="mt-3 max-w-md text-sm text-slate-400"
      >
        {meta.desc}
      </motion.p>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.6 }}
        className="mt-6 rounded-full border border-cyan-400/25 bg-cyan-400/[0.07] px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.25em] text-cyan-300/80"
      >
        In arrivo
      </motion.span>
    </main>
  );
};
