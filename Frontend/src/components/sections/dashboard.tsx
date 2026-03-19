import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  TrendingUp,
  TrendingDown,
  CreditCard,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useEffect, useState } from 'react';
import { getAnalytics, getRecentTransactions } from '@/lib/api';

export function Dashboard() {
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await getAnalytics();
        if (res.ok && res.data) setAnalytics(res.data.analytics || res.data);
        const tx = await getRecentTransactions();
        if (tx.ok) {
          const payload = tx.data || [];
          const anyPayload: any = payload;
          const list = Array.isArray(payload) ? payload : (anyPayload.transactions || anyPayload);
          setTransactions(list || []);
        }
      } catch (err) {
        console.error('Failed to load analytics', err);
      } finally {
        setLoading(false);
      }
    };
    load();
    const onUpdate = () => { load(); };
    window.addEventListener('finance.updated', onUpdate as EventListener);
    return () => { window.removeEventListener('finance.updated', onUpdate as EventListener); };
  }, []);

  const totalStudents     = analytics?.students?.totalStudents     || 0;
  const activeStudents    = analytics?.students?.activeStudents    || 0;
  const totalIncome       = analytics?.financial?.totalIncome      || analytics?.transactions?.totalIncome || 0;
  const netProfit         = analytics?.financial?.netProfit        || 0;
  const totalExpenses     = analytics?.financial?.totalExpenses    || 0;
  const cashBalance       = analytics?.cash?.totalCashInHand       || 0;
  const bankBalance       = analytics?.bank?.totalInBank           || 0;

  // Student fees overview
  const expectedFees  = analytics?.fees?.totalExpected   || 0;
  const collectedFees = analytics?.fees?.totalCollected  || 0;
  const outstanding   = analytics?.fees?.totalOutstanding || 0;
  const collectionRate = expectedFees > 0 ? Math.round((collectedFees / expectedFees) * 100) : 0;

  const statCards = [
    {
      label: "Total Students",
      value: totalStudents,
      icon: Users,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Active Students",
      value: activeStudents,
      icon: Users,
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      label: "Total Income",
      value: `EGP ${totalIncome.toLocaleString()}`,
      icon: TrendingUp,
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      label: "Net Profit",
      value: `EGP ${netProfit.toLocaleString()}`,
      icon: CreditCard,
      color: netProfit >= 0 ? "text-success" : "text-destructive",
      bg: netProfit >= 0 ? "bg-success/10" : "bg-destructive/10",
    },
  ];

  // financial bar proportions
  const financialMax = Math.max(totalIncome, totalExpenses, 1);
  const incomeWidth  = Math.round((totalIncome   / financialMax) * 100);
  const expenseWidth = Math.round((totalExpenses / financialMax) * 100);
  const profitWidth  = Math.round((Math.max(netProfit, 0) / financialMax) * 100);

  return (
    <div className="space-y-6 section-enter">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Overview</h1>
        <p className="text-sm text-muted-foreground">School financial snapshot</p>
      </div>

      {/* Row 1 — 4 stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.label} className="bg-gradient-card border-border">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-lg ${card.bg}`}>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </div>
              <p className={`text-xl font-bold stat-number ${card.color}`}>{card.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Row 2 — 2 wide cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Financial breakdown */}
        <Card className="bg-gradient-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Financial Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Income</span>
                <span className="font-semibold text-success stat-number">EGP {totalIncome.toLocaleString()}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-success rounded-full transition-all" style={{ width: `${incomeWidth}%` }} />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Expenses</span>
                <span className="font-semibold text-destructive stat-number">EGP {totalExpenses.toLocaleString()}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-destructive rounded-full transition-all" style={{ width: `${expenseWidth}%` }} />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Net Profit</span>
                <span className={`font-semibold stat-number ${netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>EGP {netProfit.toLocaleString()}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${netProfit >= 0 ? 'bg-primary' : 'bg-destructive'}`} style={{ width: `${profitWidth}%` }} />
              </div>
            </div>
            <div className="pt-2 grid grid-cols-2 gap-3">
              <div className="p-3 bg-success/10 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">Cash</p>
                <p className="text-sm font-bold text-success stat-number">{cashBalance.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">Bank</p>
                <p className="text-sm font-bold text-primary stat-number">{bankBalance.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Student fees */}
        <Card className="bg-gradient-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              Student Fees Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Expected</span>
                <span className="font-semibold stat-number">EGP {expectedFees.toLocaleString()}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-muted-foreground/40 rounded-full w-full" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Collected</span>
                <span className="font-semibold text-success stat-number">EGP {collectedFees.toLocaleString()}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-success rounded-full transition-all" style={{ width: `${collectionRate}%` }} />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Outstanding</span>
                <span className="font-semibold text-warning stat-number">EGP {outstanding.toLocaleString()}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-warning rounded-full transition-all" style={{ width: `${Math.max(0, 100 - collectionRate)}%` }} />
              </div>
            </div>
            <div className="pt-2 flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/10">
              <span className="text-xs text-muted-foreground">Collection Rate</span>
              <span className="text-lg font-bold text-primary stat-number">{collectionRate}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3 — Recent transactions */}
      <Card className="bg-gradient-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && (
            <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
          )}
          {!loading && transactions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
          )}
          <div className="space-y-1">
            {transactions.slice(0, 10).map((tx: any, i: number) => {
              const isIn = (tx.Type || tx.type || '').toUpperCase() === 'IN';
              const name = tx.Payer_Receiver_Name || tx.Payer_Receiver || tx.Subject || tx.Payer || tx.Name || 'Transaction';
              const amount = Number(tx.Amount || tx.amount || 0);
              const date = tx.Date || tx.date || '';
              return (
                <div key={i} className="table-row-hover flex items-center justify-between px-3 py-2.5 rounded-lg">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-1.5 rounded-full shrink-0 ${isIn ? 'bg-success/15' : 'bg-destructive/15'}`}>
                      {isIn
                        ? <ArrowUp className="h-3 w-3 text-success" />
                        : <ArrowDown className="h-3 w-3 text-destructive" />
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{name}</p>
                      <p className="text-xs text-muted-foreground">{date}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold stat-number shrink-0 ml-3 ${isIn ? 'text-success' : 'text-destructive'}`}>
                    {isIn ? '+' : '-'}{amount.toLocaleString()} EGP
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
