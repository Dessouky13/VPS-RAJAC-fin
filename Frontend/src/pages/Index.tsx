import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Navigation } from "@/components/layout/navigation";
import { Fees } from "@/components/sections/fees";
import { DueReport } from "@/components/sections/due-report";
import { Transactions } from "@/components/sections/transactions";
import { Balances } from "@/components/sections/balances";
import { Teachers } from "@/components/sections/teachers";
import { Students } from "@/components/sections/students";
import { Dashboard } from "@/components/sections/dashboard";
import { useAuth } from "@/contexts/AuthContext";
import { getAnalytics } from "@/lib/api";
import { Users, Wallet, AlertTriangle } from "lucide-react";

const Index = () => {
  const { isAdmin } = useAuth();
  const [activeSection, setActiveSection] = useState(() => isAdmin ? "fees" : "students");
  const [sectionKey, setSectionKey] = useState(0);

  // Quick-stat chips state (admin only)
  const [quickStats, setQuickStats] = useState<{
    totalStudents: number;
    cashOnHand: number;
    overdueCount: number;
  } | null>(null);

  const loadQuickStats = async () => {
    if (!isAdmin) return;
    try {
      const res = await getAnalytics();
      if (res.ok && res.data) {
        const a = res.data.analytics || res.data;
        setQuickStats({
          totalStudents: a?.students?.totalStudents ?? 0,
          cashOnHand: a?.cash?.totalCashInHand ?? 0,
          overdueCount: a?.overduePayments?.totalOverdue ?? 0,
        });
      }
    } catch {
      // non-critical — ignore
    }
  };

  useEffect(() => {
    loadQuickStats();
    const onUpdate = () => loadQuickStats();
    window.addEventListener("finance.updated", onUpdate as EventListener);
    return () => window.removeEventListener("finance.updated", onUpdate as EventListener);
  }, [isAdmin]);

  const handleSectionChange = (section: string) => {
    setActiveSection(section);
    setSectionKey(k => k + 1);
  };

  const renderSection = () => {
    switch (activeSection) {
      case "dashboard":
        return <Dashboard />;
      case "students":
        return <Students />;
      case "fees":
        return <Fees />;
      case "due-report":
        return <DueReport />;
      case "transactions":
        return <Transactions />;
      case "balances":
        return <Balances />;
      case "teachers":
        return <Teachers />;
      default:
        return <Fees />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Navigation
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
        />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {/* Admin quick-stats bar */}
          {isAdmin && quickStats && (
            <div className="border-b border-border bg-muted/30 px-6 py-2">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 bg-background border border-border rounded-full px-3 py-1 text-xs font-medium shadow-sm">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  <span className="text-muted-foreground">Total Students:</span>
                  <span className="font-bold text-foreground stat-number">{quickStats.totalStudents}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-background border border-border rounded-full px-3 py-1 text-xs font-medium shadow-sm">
                  <Wallet className="h-3.5 w-3.5 text-success" />
                  <span className="text-muted-foreground">Cash:</span>
                  <span className="font-bold text-success stat-number">EGP {quickStats.cashOnHand.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-background border border-border rounded-full px-3 py-1 text-xs font-medium shadow-sm">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                  <span className="text-muted-foreground">Overdue:</span>
                  <span className="font-bold text-warning stat-number">{quickStats.overdueCount}</span>
                </div>
              </div>
            </div>
          )}

          <div className="p-6 lg:p-8">
            <div key={sectionKey} className="section-enter">
              {renderSection()}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
