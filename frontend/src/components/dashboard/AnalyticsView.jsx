import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, MessagesSquare, CalendarCheck, Euro, Loader2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { format, parseISO } from "date-fns";
import api from "@/lib/api";

const PERIODS = [7, 30, 90];

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

const DeltaBadge = ({ delta, unit = "%" }) => {
  if (delta === null || delta === undefined) return null;
  const positive = delta >= 0;
  return (
    <span
      className={`flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[11px] font-bold ${
        positive
          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
          : "border-red-400/30 bg-red-400/10 text-red-300"
      }`}
    >
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {positive ? "+" : ""}
      {delta}
      {unit}
    </span>
  );
};

export default function AnalyticsView() {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setData(null);
    api.get(`/analytics?days=${days}`).then((r) => setData(r.data)).catch(() => {});
  }, [days]);

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

  const tickInterval = days > 40 ? 12 : days > 10 ? 4 : 0;

  const pctDelta = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);

  const summary = data?.summary;
  const previous = data?.previous;
  const kpis = summary
    ? [
        {
          testid: "analytics-kpi-conversione",
          label: "Conversione chat → prenotazione",
          value: `${summary.conversion_rate}%`,
          icon: TrendingUp,
          accent: true,
          delta: previous && previous.total_chats > 0 ? summary.conversion_rate - previous.conversion_rate : null,
          unit: " pt",
        },
        {
          testid: "analytics-kpi-chat",
          label: `Conversazioni gestite (${days}gg)`,
          value: summary.total_chats,
          icon: MessagesSquare,
          delta: previous && previous.total_chats > 0 ? pctDelta(summary.total_chats, previous.total_chats) : null,
        },
        {
          testid: "analytics-kpi-prenotazioni",
          label: `Prenotazioni da chat (${days}gg)`,
          value: summary.total_bookings,
          icon: CalendarCheck,
          delta: previous && previous.total_chats > 0 ? pctDelta(summary.total_bookings, previous.total_bookings) : null,
        },
        {
          testid: "analytics-kpi-valore",
          label: `Valore generato (${days}gg)`,
          value: `€ ${summary.value_eur.toLocaleString("it-IT")}`,
          icon: Euro,
          accent: true,
          delta: previous && previous.total_chats > 0 ? pctDelta(summary.value_eur, previous.value_eur) : null,
        },
      ]
    : [];

  return (
    <main data-testid="analytics-view" className="mx-auto max-w-[1500px] space-y-6 px-6 pb-16 pt-8 lg:px-10">
      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/10">
            <BarChart3 className="h-5 w-5 text-cyan-300" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-50 sm:text-3xl">Analitiche</h1>
            <p className="text-xs text-slate-500">ROI, conversioni chat e andamento appuntamenti — ultimi {days} giorni</p>
          </div>
        </div>
        <div className="flex rounded-xl border border-slate-700/80 p-1">
          {PERIODS.map((d) => (
            <button
              key={d}
              data-testid={`analytics-period-${d}`}
              onClick={() => setDays(d)}
              className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
                days === d ? "bg-cyan-400/15 text-cyan-300 shadow-[0_0_14px_rgba(0,245,212,0.15)]" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {d}gg
            </button>
          ))}
        </div>
      </motion.header>

      {!data ? (
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map(({ testid, label, value, icon: Icon, accent, delta, unit }, i) => (
              <motion.div
                key={testid}
                data-testid={testid}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="glass glass-hover rounded-2xl p-5"
              >
                <div className="flex items-start justify-between">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl border ${accent ? "border-emerald-400/30 bg-emerald-400/10" : "border-cyan-400/25 bg-cyan-400/10"}`}>
                    <Icon className={`h-5 w-5 ${accent ? "text-emerald-300" : "text-cyan-300"}`} />
                  </span>
                  <DeltaBadge delta={delta} unit={unit} />
                </div>
                <p className={`mt-4 font-display text-3xl font-black tracking-tight ${accent ? "text-neon-gradient" : "text-slate-50"}`}>{value}</p>
                <p className="mt-1.5 text-xs font-medium text-slate-400">{label}</p>
                {delta !== null && delta !== undefined && <p className="mt-0.5 text-[10px] text-slate-600">vs {days} giorni precedenti</p>}
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
                  <XAxis dataKey="day" tick={{ fill: "#64748B", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#1E293B" }} interval={tickInterval} />
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
                    <XAxis dataKey="day" tick={{ fill: "#64748B", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#1E293B" }} interval={tickInterval} />
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
                    <XAxis dataKey="day" tick={{ fill: "#64748B", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#1E293B" }} interval={tickInterval} />
                    <YAxis tick={{ fill: "#64748B", fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(0,255,135,0.3)" }} />
                    <Area type="monotone" dataKey="valore" name="Valore (€)" stroke="#00FF87" strokeWidth={2.5} fill="url(#gradValue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>
        </>
      )}
    </main>
  );
}
