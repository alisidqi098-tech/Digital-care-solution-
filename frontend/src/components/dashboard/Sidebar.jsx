import { LayoutDashboard, CalendarDays, MessagesSquare, BarChart3, Settings, LogOut, Bot } from "lucide-react";

const ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, testid: "sidebar-nav-dashboard" },
  { id: "calendario", label: "Calendario", icon: CalendarDays, testid: "sidebar-nav-calendario" },
  { id: "chat", label: "Chat & Pazienti", icon: MessagesSquare, testid: "sidebar-nav-chat" },
  { id: "analitiche", label: "Analitiche", icon: BarChart3, testid: "sidebar-nav-analitiche" },
  { id: "impostazioni", label: "Impostazioni AI", icon: Settings, testid: "sidebar-nav-impostazioni" },
];

export const Sidebar = ({ active, onNavigate, onLogout }) => (
  <aside
    data-testid="sidebar"
    className="group fixed left-0 top-0 z-40 flex h-screen w-20 flex-col border-r border-cyan-400/10 bg-[#0A0F1A]/85 py-6 backdrop-blur-xl transition-[width] duration-300 ease-out hover:w-60"
  >
    <div className="flex items-center gap-3 px-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 shadow-[0_0_18px_rgba(0,245,212,0.25)]">
        <Bot className="h-5 w-5 text-cyan-300" />
      </span>
      <span className="whitespace-nowrap font-display text-sm font-bold tracking-tight text-slate-100 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        Digital Care <span className="text-cyan-300">AI</span>
      </span>
    </div>

    <nav className="mt-10 flex flex-1 flex-col gap-1.5 px-3">
      {ITEMS.map(({ id, label, icon: Icon, testid }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            data-testid={testid}
            onClick={() => onNavigate(id)}
            className={`relative flex items-center gap-4 rounded-xl px-3.5 py-3 text-left transition-colors duration-200 ${
              isActive
                ? "bg-cyan-400/10 text-cyan-300 shadow-[inset_0_0_20px_rgba(0,245,212,0.06)]"
                : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
            }`}
          >
            {isActive && <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(0,245,212,0.8)]" />}
            <Icon className="h-5 w-5 shrink-0" />
            <span className="whitespace-nowrap text-sm font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              {label}
            </span>
          </button>
        );
      })}
    </nav>

    <div className="px-3">
      <button
        data-testid="sidebar-logout-button"
        onClick={onLogout}
        className="flex w-full items-center gap-4 rounded-xl px-3.5 py-3 text-slate-500 transition-colors duration-200 hover:bg-red-500/10 hover:text-red-400"
      >
        <LogOut className="h-5 w-5 shrink-0" />
        <span className="whitespace-nowrap text-sm font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          Esci
        </span>
      </button>
    </div>
  </aside>
);
