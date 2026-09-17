import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, MessagesSquare, CalendarCheck, Euro, Loader2 } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { format, parseISO } from "date-fns";
import api from "@/lib/api";

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-4 py-3">
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-xs font-semibold" style={{ color: p.color || p.fill }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

const ChartCard = ({ title, sub, children, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    className="glass rounded-2xl p-6"
  >
    <h3 className="font-display text-base font-bold tracking-tight text-slate-50">{title}</h3>
    <p className="mb-5 text-xs text-slate-500">{sub}</p>
    {children}
  </motion.div>
);

export default function AnalyticsView() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/analytics").then((r) => setData(r.data)).catch(() => {});
  }, []);

  const daily = useMemo(
    () =>
      (data?.daily || []).map((d) => ({
        ...d,
        day: format(parseISO(d.date), "d/M"),
      })),
    [data]
  );

  const cumulative = useMemo(() => {
    let acc = 0;
    return daily.map((d) => ({ day: d.day, valore: (acc += d.value_eur) }));
  }, [daily]);

  if (!data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
      </div>
    );
  }

  const { summary } = data;
  const kpis = [
    { testid: "analytics-kpi-conversione", label: "Conversione chat → prenotazione", value: `${summary.conversion_rate}%`, icon: TrendingUp, accent: true },
    { testid: "analytics-kpi-chat", label: "Conversazioni gestite (30gg)", value: summary.total_chats, icon: MessagesSquare },
    { testid: "analytics-kpi-prenotazioni", label: "Prenotazioni da chat (30gg)", value: summary.total_bookings, icon: CalendarCheck },
    { testid: "analytics-kpi-valore", label: "Valore generato (30gg)", value: `€ ${summary.value_eur.toLocaleString("it-IT")}`, icon: Euro, accent: true },
  ];

  return (
    <main data-testid="analytics-view" className="mx-auto max-w-[1500px] space-y-6 px-6 pb-16 pt-8 lg:px-10">
      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center gap-3"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/10">
          <BarChart3 className="h-5 w-5 text-cyan-300" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-50 sm:text-3xl">Analitiche</h1>
          <p className="text-xs text-slate-500">ROI, conversioni chat e andamento appuntamenti — ultimi 30 giorni</p>
        </div>
      </motion.header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ testid, label, value, icon: Icon, accent }, i) => (
          <motion.div
            key={testid}
            data-testid={testid}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="glass glass-hover rounded-2xl p-5"
          >
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl border ${accent ? "border-emerald-400/30 bg-emerald-400/10" : "border-cyan-400/25 bg-cyan-400/10"}`}>
              <Icon className={`h-5 w-5 ${accent ? "text-emerald-300" : "text-cyan-300"}`} />
            </span>
            <p className={`mt-4 font-display text-3xl font-black tracking-tight ${accent ? "text-neon-gradient" : "text-slate-50"}`}>{value}</p>
            <p className="mt-1.5 text-xs font-medium text-slate-400">{label}</p>
          </motion.div>
        ))}
      </div>

      <ChartCard title="Andamento appuntamenti" sub="Appuntamenti totali vs fissati dall'AI, per giorno" delay={0.35}>
        <div data-testid="analytics-chart-appointments" className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="gradAi" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00F5D4" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#00F5D4" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradTot" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#64748B" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#64748B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "#64748B", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#1E293B" }} interval={4} />
              <YAxis tick={{ fill: "#64748B", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(0,245,212,0.3)" }} />
              <Area type="monotone" dataKey="appointments_total" name="Totali" stroke="#64748B" strokeWidth={1.5} fill="url(#gradTot)" />
              <Area type="monotone" dataKey="appointments_ai" name="Fissati dall'AI" stroke="#00F5D4" strokeWidth={2.5} fill="url(#gradAi)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Conversione chat" sub="Conversazioni vs prenotazioni confermate, per giorno" delay={0.45}>
          <div data-testid="analytics-chart-conversion" className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ top: 5, right: 10, left: -18, bottom: 0 }} barGap={2}>
                <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: "#64748B", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#1E293B" }} interval={4} />
                <YAxis tick={{ fill: "#64748B", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0,245,212,0.05)" }} />
                <Bar dataKey="chats" name="Conversazioni" fill="#334155" radius={[4, 4, 0, 0]} />
                <Bar dataKey="chat_bookings" name="Prenotazioni" fill="#00FF87" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Valore generato cumulato" sub="Fatturato recuperato dall'AI, progressivo (€)" delay={0.55}>
          <div data-testid="analytics-chart-value" className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cumulative} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00FF87" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#00FF87" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: "#64748B", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#1E293B" }} interval={4} />
                <YAxis tick={{ fill: "#64748B", fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(0,255,135,0.3)" }} />
                <Area type="monotone" dataKey="valore" name="Valore (€)" stroke="#00FF87" strokeWidth={2.5} fill="url(#gradValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    </main>
  );
}
