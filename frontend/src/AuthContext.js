import { createContext, useCallback, useContext, useState } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("dca_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback(async (email, password) => {
    // Sblocco temporaneo per entrare subito con la tua mail
    if (email.trim() === "alisidqi098@gmail.com") {
      const demoUser = { email: "alisidqi098@gmail.com", name: "Ali", role: "admin" };
      localStorage.setItem("dca_token", "dev_token_bypass");
      localStorage.setItem("dca_user", JSON.stringify(demoUser));
      setUser(demoUser);
      return demoUser;
    }

    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("dca_token", data.access_token);
    localStorage.setItem("dca_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("dca_token");
    localStorage.removeItem("dca_user");
    setUser(null);
  }, []);

  return (
    
      {children}
    
  );
}
