import { ChevronDown } from "lucide-react";
import { AIFace } from "./AIFace";
import { NotificationsPanel } from "./NotificationsPanel";

const AVATAR =
  "https://images.unsplash.com/photo-1622253692010-333f2da6031d?crop=entropy&cs=srgb&fm=jpg&w=400&q=80";

export const TopBar = ({ clinicName, doctorName, notifications = 0 }) => (
  <header
    data-testid="topbar"
    className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-cyan-400/10 bg-[#080C14]/75 px-6 py-4 backdrop-blur-xl lg:px-10"
  >
    <div className="flex min-w-0 items-center gap-4">
      <span data-testid="topbar-logo" className="whitespace-nowrap font-display text-lg font-extrabold tracking-tight text-slate-50">
        Digital Care <span className="bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-transparent">AI</span>
      </span>
      <span className="hidden h-6 w-px bg-cyan-400/20 sm:block" />
      <button
        data-testid="topbar-clinic-name"
        className="hidden items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:border-cyan-400/40 sm:flex"
      >
        <span className="max-w-[220px] truncate">{clinicName}</span>
        <ChevronDown className="h-3.5 w-3.5 text-cyan-300/70" />
      </button>
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
