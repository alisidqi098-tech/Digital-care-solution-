import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Bot, Lock, Loader2, CheckCircle2 } from "lucide-react";
import api from "@/lib/api";
import BackgroundFX from "@/components/dashboard/BackgroundFX";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("La password deve avere almeno 8 caratteri.");
      return;
    }
    if (password !== confirm) {
      setError("Le password non coincidono.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
      setTimeout(() => navigate("/login", { replace: true }), 2500);
    } catch (err) {
      setError(err.response?.data?.detail || "Link non valido o scaduto. Richiedi un nuovo link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-6">
      <BackgroundFX />
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="glass relative z-10 w-full max-w-md rounded-3xl p-8 sm:p-10"
      >
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10">
            <Bot className="h-5 w-5 text-cyan-300" />
          </span>
          <span className="font-display text-lg font-extrabold text-slate-50">
            Digital Care <span className="text-cyan-300">AI</span>
          </span>
        </div>

        {done ? (
          <div data-testid="reset-success" className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-400/10">
              <CheckCircle2 className="h-7 w-7 text-emerald-300" />
            </span>
            <h2 className="mt-5 font-display text-2xl font-bold text-slate-50">Password aggiornata</h2>
            <p className="mt-2 text-sm text-slate-400">Verrai reindirizzato alla pagina di accesso…</p>
          </div>
        ) : (
          <>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-50">Imposta una nuova password</h2>
            <p className="mt-1.5 text-sm text-slate-500">Scegli una password sicura per il tuo gestionale.</p>

            {!token && (
              <p data-testid="reset-no-token" className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                Link non valido: manca il token. Richiedi un nuovo link dalla pagina di accesso.
              </p>
            )}

            <form onSubmit={submit} className="mt-7 space-y-5">
              <div>
                <label htmlFor="reset-password" className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                  Nuova password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    id="reset-password"
                    data-testid="reset-password-input"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimo 8 caratteri"
                    className="w-full rounded-xl border border-slate-700/80 bg-slate-900/60 py-3.5 pl-11 pr-4 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-400/60"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="reset-confirm" className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                  Conferma password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    id="reset-confirm"
                    data-testid="reset-confirm-input"
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Ripeti la password"
                    className="w-full rounded-xl border border-slate-700/80 bg-slate-900/60 py-3.5 pl-11 pr-4 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-400/60"
                  />
                </div>
              </div>

              {error && (
                <p data-testid="reset-error" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </p>
              )}

              <button
                data-testid="reset-submit-button"
                type="submit"
                disabled={loading || !token}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 py-3.5 font-display text-sm font-bold tracking-wide text-slate-950 shadow-[0_0_30px_rgba(0,245,212,0.3)] transition-all hover:shadow-[0_0_44px_rgba(0,245,212,0.5)] disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Aggiornamento…" : "Aggiorna password"}
              </button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-xs text-slate-600">
          <Link to="/login" className="text-cyan-400/80 transition-colors hover:text-cyan-300">
            ← Torna al login
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
