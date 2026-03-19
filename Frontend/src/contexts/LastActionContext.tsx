import { createContext, useContext, useState, ReactNode } from "react";

interface LastActionState {
  description: string;
  timestamp: Date;
} | null;

interface LastActionContextValue {
  lastAction: { description: string; timestamp: Date } | null;
  setLastAction: (description: string) => void;
  clearLastAction: () => void;
}

const LastActionContext = createContext<LastActionContextValue>({
  lastAction: null,
  setLastAction: () => {},
  clearLastAction: () => {},
});

export function LastActionProvider({ children }: { children: ReactNode }) {
  const [lastAction, setLastActionState] = useState<{ description: string; timestamp: Date } | null>(null);

  const setLastAction = (description: string) => {
    setLastActionState({ description, timestamp: new Date() });
  };

  const clearLastAction = () => {
    setLastActionState(null);
  };

  return (
    <LastActionContext.Provider value={{ lastAction, setLastAction, clearLastAction }}>
      {children}
    </LastActionContext.Provider>
  );
}

export function useLastAction() {
  return useContext(LastActionContext);
}
