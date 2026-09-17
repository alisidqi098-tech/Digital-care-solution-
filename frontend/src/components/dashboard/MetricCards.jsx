import { useEffect, useState } from "react";
import { motion, animate } from "framer-motion";
import { CalendarCheck, Undo2, Clock, TrendingUp, ArrowUpRight } from "lucide-react";

const CountUp = ({ value, prefix = "", suffix = "", accent = false }) => {
  const [display, setDisplay] = useState("0");
  useEffect(() => {
    const controls = animate(0, value, {
      duration: 1.8,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v).toLocaleString("it-IT")),
    });
    return () => controls.stop();
  }, [value]);
  return (
    <span className={`font-display text-3xl font-black tracking-tight lg:text-4xl ${accent ? "text-neon-gradient" : "text-slate-50"}`}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
};

export const MetricCards = ({ metrics }) => {
  const [animDone, setAnimDone] = useState(false);
  const cards = [
    {
      testid: "roi-card-appuntamenti",
      label: "Appuntamenti Fissati dall'AI",
      sub: "Ultimi 30 giorni",
      value: metrics.appointments_ai,
      icon: CalendarCheck,
      delta: `+${metrics.delta_pct}%`,
    },
    {
      testid: "roi-card-disdette",
      label: "Disdette Recuperate",
      sub: "Slot riempiti automaticamente",
      value: metrics.recovered,
      icon: Undo2,
    },
    {
      testid: "roi-card-ore",
      label: "Ore Segreteria Risparmiate",
      sub: "Tempo restituito al team",
      value: metrics.hours_saved,
      suffix: "h",
      icon: Clock,
    },
    {
      testid: "roi-card-valore-stimato",
      label: "Valore Generato Stimato",
      sub: "Fatturato recuperato dall'AI",
      value: metrics.value_eur,
      prefix: "€ ",
      icon: TrendingUp,
      accent: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ testid, label, sub, value, icon: Icon, delta, accent, prefix, suffix }, i) => (
        <motion.div
          key={testid}
          data-testid={testid}
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
          onAnimationComplete={() => setAnimDone(true)}
          className="glass glass-hover rounded-2xl p-6"
        >
          <div className="flex items-start justify-between">
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl border ${accent ? "border-emerald-400/30 bg-emerald-400/10" : "border-cyan-400/25 bg-cyan-400/10"}`}>
              <Icon className={`h-5 w-5 ${accent ? "text-emerald-300" : "text-cyan-300"}`} />
            </span>
            {delta && (
              <span className="flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 font-mono text-[11px] font-bold text-emerald-300">
                <ArrowUpRight className="h-3 w-3" />
                {delta}
              </span>
            )}
          </div>
          <div className="mt-5">
            <CountUp value={value} prefix={prefix} suffix={suffix} accent={accent && animDone} />
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-200">{label}</p>
          <p className="mt-0.5 text-xs text-slate-500">{sub}</p>
        </motion.div>
      ))}
    </div>
  );
};
