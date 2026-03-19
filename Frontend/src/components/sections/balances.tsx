import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getCashSummary, getOverdueList, saveBankDeposit } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  DollarSign,
  Banknote,
  CreditCard,
  RefreshCw,
  ArrowUpDown,
  Plus,
  Wallet,
  TrendingUp,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CashSummary {
  availableCash: number;
  availableBank: number;
}

interface OverdueStudent {
  FullName: string;
  DueDate: string;
}

export function Balances() {
  const { isArabic, t } = useLanguage();
  const [cashSummary, setCashSummary] = useState<CashSummary>({ availableCash: 0, availableBank: 0 });
  const [activePaymentNo, setActivePaymentNo] = useState<number>(1);
  const [overdueStudents, setOverdueStudents] = useState<OverdueStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [depositForm, setDepositForm] = useState({ amount: "", date: new Date().toISOString().split('T')[0], note: "" });
  const { toast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const cashResponse = await getCashSummary();
      if (cashResponse.ok) setCashSummary(cashResponse.data);

      const overdueResponse = await getOverdueList();
      if (overdueResponse.ok) setOverdueStudents(overdueResponse.data || []);
    } catch (error) {
      console.error('Failed to load balance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOverdueData = async (paymentNo: number) => {
    setActivePaymentNo(paymentNo);
    try {
      const overdueResponse = await getOverdueList();
      if (overdueResponse.ok) setOverdueStudents(overdueResponse.data || []);
    } catch (error) {
      console.error('Failed to load overdue data:', error);
    }
  };

  const handleBankDeposit = async () => {
    if (!depositForm.amount) {
      toast({ title: "خطأ", description: "يرجى إدخال مبلغ الإيداع", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const response = await saveBankDeposit({
        amount: parseFloat(depositForm.amount),
        bankName: 'Default Bank',
        depositedBy: 'Frontend User',
        notes: depositForm.note || undefined
      });

      if (response.ok) {
        toast({ title: "تم الإيداع بنجاح", description: `تم إيداع ${depositForm.amount} جنيه في البنك` });

        const amt = parseFloat(depositForm.amount || '0') || 0;
        setCashSummary(prev => ({
          availableCash: Math.max(0, prev.availableCash - amt),
          availableBank: prev.availableBank + amt
        }));

        setDepositForm({ amount: "", date: new Date().toISOString().split('T')[0], note: "" });
        setShowDepositForm(false);

        setTimeout(() => loadData(), 500);
        try { window.dispatchEvent(new CustomEvent('finance.updated')); } catch(e) {}
      } else {
        toast({ title: "فشل في الإيداع", description: response.message || "حدث خطأ أثناء الإيداع", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "خطأ في الإيداع", description: "حدث خطأ أثناء إيداع المبلغ", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const onUpdate = () => loadData();
    window.addEventListener('finance.updated', onUpdate as EventListener);
    return () => window.removeEventListener('finance.updated', onUpdate as EventListener);
  }, []);

  const totalBalance = cashSummary.availableCash + cashSummary.availableBank;
  const cashPct   = totalBalance > 0 ? Math.round((cashSummary.availableCash / totalBalance) * 100) : 50;
  const bankPct   = 100 - cashPct;

  return (
    <div className="space-y-6 section-enter" dir={isArabic ? "rtl" : "ltr"}>
      <div className={cn("flex justify-between items-start", isArabic ? "flex-row-reverse" : "")}>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("لوحة الأرصدة", "Balance Dashboard")}</h1>
          <p className="text-sm text-muted-foreground">{t("النقد والبنك والودائع والمدفوعات المتأخرة", "Cash, bank, deposits and overdue payments")}</p>
        </div>
        <Button onClick={loadData} disabled={loading} variant="outline" className="gap-2 shrink-0">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          {t("تحديث", "Refresh")}
        </Button>
      </div>

      {/* 3 Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total */}
        <Card className="border-border bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-5">
            <div className={cn("flex items-start gap-3", isArabic ? "flex-row-reverse" : "")}>
              <div className="p-2.5 rounded-xl bg-primary/15 shrink-0">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t("إجمالي الرصيد", "Total Balance")}</p>
                <p className="text-2xl font-bold text-primary stat-number">{totalBalance.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{t("جنيه", "EGP")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cash */}
        <Card className="border-border bg-gradient-to-br from-success/5 to-success/10 border-success/20">
          <CardContent className="p-5">
            <div className={cn("flex items-start gap-3", isArabic ? "flex-row-reverse" : "")}>
              <div className="p-2.5 rounded-xl bg-success/15 shrink-0">
                <Banknote className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t("النقد المتاح", "Available Cash")}</p>
                <p className="text-2xl font-bold text-success stat-number">{cashSummary.availableCash.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{t("جنيه", "EGP")} · {cashPct}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bank */}
        <Card className="border-border bg-gradient-to-br from-accent/30 to-accent/10 border-border">
          <CardContent className="p-5">
            <div className={cn("flex items-start gap-3", isArabic ? "flex-row-reverse" : "")}>
              <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t("رصيد البنك", "Bank Balance")}</p>
                <p className="text-2xl font-bold text-foreground stat-number">{cashSummary.availableBank.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{t("جنيه", "EGP")} · {bankPct}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cash vs Bank breakdown */}
      <Card className="border-border">
        <CardHeader className="pb-4">
          <CardTitle className={cn("flex items-center justify-between", isArabic ? "flex-row-reverse" : "")}>
            <div className={cn("flex items-center gap-2 text-base", isArabic ? "flex-row-reverse" : "")}>
              <div className="p-1.5 rounded-md bg-primary/10">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              {t("ملخص مالي", "Financial Summary")}
            </div>
            <Button size="sm" onClick={() => setShowDepositForm(!showDepositForm)} className="bg-primary hover:bg-primary/90 gap-1.5 text-xs h-8">
              {showDepositForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {t("إيداع بنكي", "Bank Deposit")}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Visual proportion bar */}
          <div>
            <div className={cn("flex justify-between text-xs mb-2 text-muted-foreground", isArabic ? "flex-row-reverse" : "")}>
              <span>{t("النقد", "Cash")} ({cashPct}%)</span>
              <span>{t("البنك", "Bank")} ({bankPct}%)</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden flex">
              <div className="h-full bg-success transition-all" style={{ width: `${cashPct}%` }} />
              <div className="h-full bg-primary flex-1 transition-all" />
            </div>
          </div>

          {/* Side by side boxes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-success/10 rounded-xl border border-success/20 text-center">
              <Banknote className="h-6 w-6 text-success mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">{t("النقد", "Cash")}</p>
              <p className="text-xl font-bold text-success stat-number">{cashSummary.availableCash.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{t("جنيه", "EGP")}</p>
            </div>
            <div className="p-4 bg-primary/10 rounded-xl border border-primary/20 text-center">
              <CreditCard className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">{t("البنك", "Bank")}</p>
              <p className="text-xl font-bold text-primary stat-number">{cashSummary.availableBank.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{t("جنيه", "EGP")}</p>
            </div>
          </div>

          {/* Bank Deposit Form */}
          {showDepositForm && (
            <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/30">
              <h4 className={cn("text-sm font-semibold flex items-center gap-2", isArabic ? "flex-row-reverse" : "")}>
                <ArrowUpDown className="h-4 w-4 text-primary" />
                {t("إيداع من النقد إلى البنك", "Transfer from Cash to Bank")}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t("مبلغ الإيداع", "Deposit Amount")}</Label>
                  <div className="relative">
                    <DollarSign className={cn("absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground", isArabic ? "right-3" : "left-3")} />
                    <Input
                      type="number"
                      placeholder={t("المبلغ", "Amount")}
                      value={depositForm.amount}
                      onChange={(e) => setDepositForm({...depositForm, amount: e.target.value})}
                      className={cn("h-9 text-sm font-semibold", isArabic ? "pr-10" : "pl-10")}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t("تاريخ الإيداع", "Deposit Date")}</Label>
                  <Input
                    type="date"
                    value={depositForm.date}
                    onChange={(e) => setDepositForm({...depositForm, date: e.target.value})}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t("ملاحظة (اختياري)", "Note (Optional)")}</Label>
                <Textarea
                  placeholder={t("ملاحظة...", "Note...")}
                  value={depositForm.note}
                  onChange={(e) => setDepositForm({...depositForm, note: e.target.value})}
                  rows={2}
                  className="text-sm resize-none"
                />
              </div>
              <div className={cn("flex gap-2", isArabic ? "flex-row-reverse" : "")}>
                <Button onClick={handleBankDeposit} disabled={loading} size="sm" className="flex-1 bg-primary hover:bg-primary/90">
                  {loading ? t("جاري الإيداع...", "Processing...") : t("إيداع", "Deposit")}
                </Button>
                <Button onClick={() => setShowDepositForm(false)} variant="outline" size="sm" className="flex-1">
                  {t("إلغاء", "Cancel")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
