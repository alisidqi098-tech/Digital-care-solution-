import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkle, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/App";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MetricCards } from "./MetricCards";
import { AgendaLive } from "./AgendaLive";
import { Waitlist } from "./Waitlist";
import { LiveChat } from "./LiveChat";
import { PlaceholderView } from "./PlaceholderView";
import BackgroundFX from "./BackgroundFX";

const TICKER = [
  "AI ATTIVA 24/7",
  "RECUPERO DISDETTE AUTOMATICO",
  "AGENDA SEMPRE PIENA",
  "RISPOSTE IMMEDIATE AI PAZIENTI",
  "ZERO TELEFONATE PERSE",
  "ROI MISURABILE OGNI GIORNO",
];

const MaskedLine = ({ children, delay = 0, className = "" }) => (
  <span className={`block overflow-hidden ${className}`}>
    <motion.span
      className="block"
      initial={{ y: "110%" }}
      animate={{ y: 0 }}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.span>
  </span>
);

export default function DashboardView() {
  const { user, logout } = useAuth();
  const [view, setView] = useState("dashboard");
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/dashboard").then((r) => setData(r.data)).catch(() => {});
  }, []);

  const today = new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="relative min-h-screen">
      <BackgroundFX />
      <Sidebar active={view} onNavigate={setView} onLogout={logout} />
      <div className="relative z-10 pl-20">
        <TopBar
          clinicName={data?.clinic?.name || user.clinic_name}
          doctorName={user.name}
          notifications={data?.notifications ?? 0}
        />
        {view !== "dashboard" ? (
          <PlaceholderView view={view} />
        ) : !data ? (
          <div className="flex h-[60vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
          </div>
        ) : (
          <main data-testid="dashboard-main" className="mx-auto max-w-[1500px] space-y-7 px-6 pb-16 pt-8 lg:px-10">
            <header>
              <MaskedLine>
                <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan-300/70">
                  {today} — Panoramica dello studio
                </p>
              </MaskedLine>
              <MaskedLine delay={0.12}>
                <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-50 sm:text-4xl">
                  Buongiorno,{" "}
                  <span className="bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-transparent">
                    {user.name}
                  </span>
                </h1>
              </MaskedLine>
            </header>

            <motion.div
              data-testid="ticker-marquee"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="overflow-hidden border-y border-cyan-400/10 py-2.5"
            >
              <div className="flex w-max animate-marquee items-center gap-10">
                {[...TICKER, ...TICKER].map((t, i) => (
                  <span key={i} className="flex items-center gap-10 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.3em] text-cyan-300/50">
                    {t}
                    <Sparkle className="h-3 w-3 text-cyan-400/40" />
                  </span>
                ))}
              </div>
            </motion.div>

            <MetricCards metrics={data.metrics} />

            <div className="grid gap-6 xl:grid-cols-10">
              <div className="space-y-6 xl:col-span-7">
                <AgendaLive appointments={data.appointments} />
                <Waitlist entries={data.waitlist} />
              </div>
              <div className="xl:col-span-3">
                <LiveChat script={data.chat_script} patientName={data.chat_patient} />
              </div>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
