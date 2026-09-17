import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Crown, FileDown, Mail, Settings, Stethoscope } from "lucide-react";
import { AIFace } from "./AIFace";
import { NotificationsPanel } from "./NotificationsPanel";
import { downloadFile } from "@/lib/download";

const AVATAR =
  "https://images.unsplash.com/photo-1622253692010-333f2da6031d?crop=entropy&cs=srgb&fm=jpg&w=400&q=80";

const PLAN_LABELS = { starter: "Starter", professional: "Professional", elite: "Elite" };

export const TopBar = ({ clinicName, doctorName, clinic, onOpenSettings }) => {
  const [clinicOpen, setClinicOpen] = useState(false);
  return (
  <header
    data-testid="topbar"
    className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-cyan-400/10 bg-[#080C14]/75 px-6 py-4 backdrop-blur-xl lg:px-10"
  >
    <div className="flex min-w-0 items-center gap-4">
      <span data-testid="topbar-logo" className="whitespace-nowrap font-display text-lg font-extrabold tracking-tight text-slate-50">
        Digital Care <span className="bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-transparent">AI</span>
      </span>
      <span className="hidden h-6 w-px bg-cyan-400/20 sm:block" />
      <div className="relative hidden sm:block">
        <button
          data-testid="topbar-clinic-name"
          onClick={() => setClinicOpen((o) => !o)}
          className="flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:border-cyan-400/40"
        >
          <span className="max-w-[220px] truncate">{clinicName}</span>
          <ChevronDown className={`h-3.5 w-3.5 text-cyan-300/70 transition-transform duration-200 ${clinicOpen ? "rotate-180" : ""}`} />
        </button>
        <AnimatePresence>
          {clinicOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setClinicOpen(false)} />
              <motion.div
                data-testid="clinic-dropdown"
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="glass absolute left-0 top-11 z-50 w-80 rounded-2xl p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-display text-base font-bold leading-tight text-slate-50">{clinicName}</p>
                  {clinic?.plan && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-amber-300">
                      <Crown className="h-3 w-3" />
                      {PLAN_LABELS[clinic.plan] || clinic.plan}
                    </span>
                  )}
                </div>
                <div className="mt-3 space-y-2 text-[13px]">
                  <p className="flex items-center gap-2 text-slate-300">
                    <Stethoscope className="h-3.5 w-3.5 shrink-0 text-cyan-300/70" />
                    {clinic?.doctor_name || doctorName}
                  </p>
                  {clinic?.email && (
                    <p className="flex items-center gap-2 text-slate-400">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-cyan-300/70" />
                      {clinic.email}
                    </p>
                  )}
                </div>
                <div className="mt-4 space-y-2 border-t border-slate-800/80 pt-4">
                  <button
                    data-testid="clinic-dropdown-settings"
                    onClick={() => {
                      setClinicOpen(false);
                      onOpenSettings?.();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl border border-slate-700/80 px-3.5 py-2.5 text-xs font-semibold text-slate-300 transition-colors hover:border-cyan-400/40 hover:text-cyan-300"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    Impostazioni AI dello studio
                  </button>
                  <button
                    data-testid="clinic-dropdown-report"
                    onClick={() => downloadFile("/report/roi", "report-roi.pdf")}
                    className="flex w-full items-center gap-2.5 rounded-xl border border-slate-700/80 px-3.5 py-2.5 text-xs font-semibold text-slate-300 transition-colors hover:border-cyan-400/40 hover:text-cyan-300"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    Scarica Report ROI
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>

    <div className="flex items-center gap-3 lg:gap-5">
      <div
        data-testid="ai-status-indicator"
        className="flex items-center gap-3 rounded-full border border-emerald-400/30 bg-emerald-400/[0.06] py-1.5 pl-2 pr-4"
      >
        <span className="animate-pulse-ring rounded-full">
          <AIFace size={36} />
        </span>
        <span className="hidden md:block">
          <span className="block font-mono text-[11px] font-bold tracking-[0.18em] text-emerald-300">AI ATTIVA 24/7</span>
          <span className="block text-[10px] text-slate-400">In ascolto</span>
        </span>
      </div>

      <NotificationsPanel />

      <div data-testid="topbar-user-profile" className="flex items-center gap-3">
        <img
          src={AVATAR}
          alt={doctorName}
          className="h-10 w-10 rounded-full border border-cyan-400/30 object-cover shadow-[0_0_14px_rgba(0,245,212,0.2)]"
        />
        <span className="hidden lg:block">
          <span className="block text-sm font-semibold text-slate-100">{doctorName}</span>
          <span className="block text-[11px] text-slate-500">Titolare</span>
        </span>
      </div>
    </div>
  </header>
  );
};
