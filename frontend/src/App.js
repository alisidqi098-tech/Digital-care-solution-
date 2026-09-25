import { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import Lenis from "lenis";
import { AuthProvider, useAuth } from "@/AuthContext"; // <-- Importato dal nuovo file
import LoginPage from "@/components/auth/LoginPage";
import ResetPasswordPage from "@/components/auth/ResetPasswordPage";
import DashboardView from "@/components/dashboard/DashboardView";
import AdminConsole from "@/components/admin/AdminConsole";

const Protected = ({ children }) => {
  const { user } = useAuth();
  if (!user) return ;
  return children;
};

const RoleHome = () => {
  const { user } = useAuth();
  return user?.role === "admin" ?  : ;
};

function App() {
  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.12, smoothWheel: true });
    let raf;
    const loop = (t) => {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return (
