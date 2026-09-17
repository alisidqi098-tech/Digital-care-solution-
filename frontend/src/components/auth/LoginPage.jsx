import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Bot, Mail, Lock, Loader2 } from "lucide-react";
import { useAuth } from "@/App";
import BackgroundFX from "@/components/dashboard/BackgroundFX";

const MaskedLine = ({ children, delay = 0, className = "", onComplete }) => (
  <span className={`block overflow-hidden ${className}`}>
    <motion.span
      className="block"
      initial={{ y: "110%" }}
      animate={{ y: 0 }}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
      onAnimationComplete={onComplete}
    >
      {children}
    </motion.span>
  </span>
);

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [grad, setGrad] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate("/", { replace: true });
    } catch {
      setError("Credenziali non valide. Controlla email e password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      <BackgroundFX />

      <div className="relative z-10 hidden flex-col justify-between p-12 lg:flex xl:p-16">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 shadow-[0_0_20px_rgba(0,245,212,0.25)]">
            <Bot className="h-6 w-6 text-cyan-300" />
          </span>
          <span className="font-display text-xl font-extrabold tracking-tight text-slate-50">
            Digital Care <span className="bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-transparent">AI</span>
          </span>
        </div>

        <div>
          <MaskedLine delay={0.1}>
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-cyan-300/70">Gestionale per cliniche dentistiche</p>
          </MaskedLine>
          <MaskedLine delay={0.22} className="mt-5">
            <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-50 xl:text-6xl">
              Il tuo studio.
            </h1>
          </MaskedLine>
          <MaskedLine delay={0.34} onComplete={() => setGrad(true)}>
            <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight xl:text-6xl">
              <span className={grad ? "text-neon-gradient" : "text-cyan-300"}>Sempre in ascolto.</span>
            </h1>
          </MaskedLine>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.8 }}
            className="mt-6 max-w-md text-base leading-relaxed text-slate-400"
          >
            L'assistente AI che risponde ai pazienti, riempie l'agenda e recupera le disdette. 24 ore su 24, 7 giorni su 7.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.8 }}
          className="flex gap-10"
        >
          {[
            ["+48", "Appuntamenti / mese"],
            ["24/7", "Copertura AI"],
            ["€3.2K", "Valore recuperato"],
          ].map(([v, l]) => (
            <div key={l}>
              <p className="font-display text-2xl font-black text-cyan-300">{v}</p>
              <p className="mt-1 text-xs text-slate-500">{l}</p>
            </div>
          ))}
        </motion.div>
      </div>

      <div className="relative z-10 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="glass w-full max-w-md rounded-3xl p-8 sm:p-10"
        >
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10">
              <Bot className="h-5 w-5 text-cyan-300" />
            </span>
            <span className="font-display text-lg font-extrabold text-slate-50">
              Digital Care <span className="text-cyan-300">AI</span>
            </span>
          </div>

          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-50">Accedi al tuo gestionale</h2>
          <p className="mt-1.5 text-sm text-slate-500">Area riservata — ogni studio vede solo i propri dati.</p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="login-email" className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="login-email"
                  data-testid="login-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="dottore@studioclinico.it"
                  className="w-full rounded-xl border border-slate-700/80 bg-slate-900/60 py-3.5 pl-11 pr-4 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-400/60 focus:shadow-[0_0_20px_rgba(0,245,212,0.12)]"
                />
              </div>
            </div>
            <div>
              <label htmlFor="login-password" className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="login-password"
                  data-testid="login-password-input"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-700/80 bg-slate-900/60 py-3.5 pl-11 pr-4 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-400/60 focus:shadow-[0_0_20px_rgba(0,245,212,0.12)]"
                />
              </div>
            </div>

            {error && (
              <motion.p
                data-testid="login-error"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: [0, -6, 6, -3, 3, 0] }}
                transition={{ duration: 0.4 }}
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
              >
                {error}
              </motion.p>
            )}

            <button
              data-testid="login-form-submit-button"
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 py-3.5 font-display text-sm font-bold tracking-wide text-slate-950 shadow-[0_0_30px_rgba(0,245,212,0.3)] transition-all duration-200 hover:shadow-[0_0_44px_rgba(0,245,212,0.5)] disabled:opacity-70"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Accesso in corso…" : "Accedi alla Dashboard"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-600">
            Accesso riservato agli studi abilitati da Digital Care AI.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
