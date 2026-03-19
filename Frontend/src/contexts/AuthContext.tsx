import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";

export type UserRole = "admin" | "hr";

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  name: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAdmin: boolean;
  isHR: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null, token: null, isAdmin: false, isHR: false,
  login: async () => {}, logout: () => {}
});

const TOKEN_KEY = "rajac_token";

function decodeToken(token: string): (AuthUser & { exp: number }) | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (payload.exp * 1000 < Date.now()) return null;
    return { id: payload.id, username: payload.username, role: payload.role, name: payload.name, exp: payload.exp };
  } catch {
    return null;
  }
}

const REFRESH_INTERVAL_MS = 60_000;      // check every 60 s
const REFRESH_THRESHOLD_S  = 15 * 60;   // refresh when < 15 min left

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    return t ? decodeToken(t) : null;
  });
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  // Silent token refresh — runs on an interval while logged in
  useEffect(() => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    if (!token) return;

    // Expire check on mount
    if (!decodeToken(token)) { logout(); return; }

    refreshTimerRef.current = setInterval(async () => {
      const current = localStorage.getItem(TOKEN_KEY);
      if (!current) return;
      const decoded = decodeToken(current);
      if (!decoded) { logout(); return; }

      const secondsLeft = decoded.exp - Math.floor(Date.now() / 1000);
      if (secondsLeft < REFRESH_THRESHOLD_S) {
        const { refreshToken } = await import('@/lib/api');
        const newToken = await refreshToken();
        if (newToken) {
          localStorage.setItem(TOKEN_KEY, newToken);
          const newDecoded = decodeToken(newToken);
          setToken(newToken);
          if (newDecoded) setUser({ id: newDecoded.id, username: newDecoded.username, role: newDecoded.role, name: newDecoded.name });
        } else {
          // Refresh failed — log out at expiry
          if (secondsLeft <= 0) logout();
        }
      }
    }, REFRESH_INTERVAL_MS);

    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current); };
  }, [token]);

  const login = async (username: string, password: string) => {
    const { loginUser } = await import("@/lib/api");
    const res = await loginUser(username, password);
    if (!(res.success || res.ok) || !res.token) throw new Error(res.error || res.message || "Login failed");
    const decoded = decodeToken(res.token);
    if (!decoded) throw new Error("Invalid token received");
    localStorage.setItem(TOKEN_KEY, res.token);
    setToken(res.token);
    setUser({ id: decoded.id, username: decoded.username, role: decoded.role, name: decoded.name });
  };

  return (
    <AuthContext.Provider value={{
      user, token,
      isAdmin: user?.role === "admin",
      isHR:    user?.role === "admin" || user?.role === "hr",
      login, logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
