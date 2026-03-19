import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { saveInOut, getRecentTransactions } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLastAction } from "@/contexts/LastActionContext";
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Calendar,
  FileText,
  DollarSign,
  CreditCard,
  ArrowUp,
  ArrowDown,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  type: 'IN' | 'OUT';
  name: string;
  amount: number;
  method: 'Cash' | 'Other';
  date: string;
  note?: string;
}

export function Transactions() {
  const { isArabic, t } = useLanguage();
  const { setLastAction } = useLastAction();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    type: '',
    name: '',
    amount: '',
    method: '',
    date: new Date().toISOString().split('T')[0],
    note: ''
  });
  const { toast } = useToast();

  const loadTransactions = async () => {
    try {
      const response = await getRecentTransactions();
      if (response.ok) {
        const raw = response.data || [];
        const normalized = (raw || []).map((r: any) => ({
          id: r.Transaction_ID || r.id || r.TransactionId || r.transactionId || '',
          type: (r.Type || r.type || '').toUpperCase(),
          name: r.Subject || r.Payer_Receiver_Name || r.Payer_Receiver || r.Payer || r.Subject || r.Name || '',
          amount: Number(r.Amount || r.amount || 0) || 0,
          method: (r.Payment_Method || r.paymentMethod || r.method || 'Other'),
          date: r.Date || r.date || '',
          note: r.Notes || r.notes || ''
        }));
        setTransactions(normalized);
      }
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  };

  useEffect(() => { loadTransactions(); }, []);

  const handleSaveTransaction = async () => {
    if (!form.type || !form.name || !form.amount || !form.method) {
      toast({ title: "خطأ", description: "يرجى ملء جميع الحقول المطلوبة", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const response = await saveInOut({
        type: form.type,
        amount: parseFloat(form.amount),
        subject: form.name,
        payerReceiverName: form.name,
        paymentMethod: form.method,
        notes: form.note || undefined,
        processedBy: 'Frontend User',
        date: form.date
      });

      if (response.ok) {
        const actionLabel = form.type === 'IN'
          ? t(`إيراد: ${form.name} — ${form.amount} جنيه (${form.date})`, `Revenue: ${form.name} — ${form.amount} EGP (${form.date})`)
          : t(`مصروف: ${form.name} — ${form.amount} جنيه (${form.date})`, `Expense: ${form.name} — ${form.amount} EGP (${form.date})`);
        setLastAction(actionLabel);
        toast({
          title: t('تم حفظ المعاملة بنجاح', 'Transaction saved'),
          description: t(
            `تم تسجيل ${form.type === 'IN' ? 'إيراد' : 'مصروف'} بقيمة ${form.amount} جنيه`,
            `${form.type === 'IN' ? 'Recorded revenue' : 'Recorded expense'} of ${form.amount} EGP`
          )
        });
        setForm({ type: '', name: '', amount: '', method: '', date: new Date().toISOString().split('T')[0], note: '' });
        setShowForm(false);
        loadTransactions();
        try { window.dispatchEvent(new CustomEvent('finance.updated')); } catch(e) {}
      } else {
        toast({ title: "فشل في حفظ المعاملة", description: response.message || "حدث خطأ أثناء حفظ المعاملة", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "خطأ في الحفظ", description: "حدث خطأ أثناء حفظ المعاملة", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 section-enter" dir={isArabic ? "rtl" : "ltr"}>
      <div className={cn("flex justify-between items-start", isArabic ? "flex-row-reverse" : "")}>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("المعاملات المالية", "Financial Transactions")}</h1>
          <p className="text-sm text-muted-foreground">{t("إدارة الإيرادات والمصروفات", "Manage revenue and expenses")}</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-primary hover:bg-primary/90 gap-2 shrink-0">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? t("إلغاء", "Cancel") : t("معاملة جديدة", "New Transaction")}
        </Button>
      </div>

      {/* Transaction Form */}
      {showForm && (
        <Card className="border-border scale-in">
          <CardHeader className="pb-4">
            <CardTitle className={cn("flex items-center gap-2 text-base", isArabic ? "flex-row-reverse" : "")}>
              <div className="p-1.5 rounded-md bg-primary/10">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              {t("معاملة مالية جديدة", "New Financial Transaction")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* IN / OUT toggle buttons */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("نوع المعاملة *", "Transaction Type *")}</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, type: 'IN' })}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-all",
                    form.type === 'IN'
                      ? "bg-success/15 border-success/50 text-success"
                      : "border-border text-muted-foreground hover:border-success/30 hover:text-success/80"
                  )}
                >
                  <ArrowUp className="h-4 w-4" />
                  {t("إيراد", "Revenue IN")}
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, type: 'OUT' })}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-all",
                    form.type === 'OUT'
                      ? "bg-destructive/15 border-destructive/50 text-destructive"
                      : "border-border text-muted-foreground hover:border-destructive/30 hover:text-destructive/80"
                  )}
                >
                  <ArrowDown className="h-4 w-4" />
                  {t("مصروف", "Expense OUT")}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">{t("اسم المعاملة *", "Transaction Name *")}</Label>
                <div className="relative">
                  <FileText className={cn("absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground", isArabic ? "right-3" : "left-3")} />
                  <Input
                    placeholder={t("وصف المعاملة", "Transaction description")}
                    value={form.name}
                    onChange={(e) => setForm({...form, name: e.target.value})}
                    className={cn("h-9 text-sm", isArabic ? "pr-10" : "pl-10")}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">{t("المبلغ *", "Amount *")}</Label>
                <div className="relative">
                  <DollarSign className={cn("absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground", isArabic ? "right-3" : "left-3")} />
                  <Input
                    type="number"
                    placeholder={t("المبلغ", "Amount")}
                    value={form.amount}
                    onChange={(e) => setForm({...form, amount: e.target.value})}
                    className={cn("h-9 text-sm font-semibold", isArabic ? "pr-10" : "pl-10")}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">{t("طريقة الدفع *", "Payment Method *")}</Label>
                <Select value={form.method} onValueChange={(value) => setForm({...form, method: value})}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder={t("اختر طريقة الدفع", "Choose payment method")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">{t("نقدي", "Cash")}</SelectItem>
                    <SelectItem value="Other">{t("أخرى", "Other")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">{t("التاريخ", "Date")}</Label>
                <div className="relative">
                  <Calendar className={cn("absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground", isArabic ? "right-3" : "left-3")} />
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({...form, date: e.target.value})}
                    className={cn("h-9 text-sm", isArabic ? "pr-10" : "pl-10")}
                  />
                </div>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-medium text-muted-foreground">{t("ملاحظات إضافية", "Additional Notes")}</Label>
                <Textarea
                  placeholder={t("ملاحظات اختيارية", "Optional notes")}
                  value={form.note}
                  onChange={(e) => setForm({...form, note: e.target.value})}
                  rows={2}
                  className="text-sm resize-none"
                />
              </div>
            </div>

            <div className={cn("flex gap-3 pt-2", isArabic ? "flex-row-reverse" : "")}>
              <Button onClick={handleSaveTransaction} disabled={loading} className="bg-primary hover:bg-primary/90 gap-2">
                <Plus className="h-4 w-4" />
                {loading ? t("جاري الحفظ...", "Saving...") : t("حفظ المعاملة", "Save Transaction")}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                {t("إلغاء", "Cancel")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions List — table-like layout */}
      {transactions.length > 0 ? (
        <Card className="border-border">
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {transactions.map((transaction, index) => {
                const isIn = transaction.type === 'IN';
                return (
                  <div
                    key={transaction.id || index}
                    className={cn(
                      "table-row-hover flex items-center px-4 py-3 gap-4",
                      isArabic ? "flex-row-reverse" : ""
                    )}
                  >
                    {/* Type icon */}
                    <div className={cn("p-2 rounded-full shrink-0", isIn ? "bg-success/15" : "bg-destructive/15")}>
                      {isIn
                        ? <TrendingUp className="h-4 w-4 text-success" />
                        : <TrendingDown className="h-4 w-4 text-destructive" />
                      }
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{transaction.name}</p>
                      <div className={cn("flex items-center gap-2 mt-0.5", isArabic ? "flex-row-reverse" : "")}>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {transaction.date}
                        </span>
                        <Badge
                          variant={transaction.method === 'Cash' ? 'outline' : 'secondary'}
                          className="text-[10px] h-4 px-1.5"
                        >
                          {transaction.method === 'Cash' ? t('نقدي', 'Cash') : t('أخرى', 'Other')}
                        </Badge>
                      </div>
                      {transaction.note && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{transaction.note}</p>
                      )}
                    </div>

                    {/* Amount */}
                    <div className={cn("text-right shrink-0", isArabic ? "text-left" : "")}>
                      <p className={cn("text-base font-bold stat-number", isIn ? "text-success" : "text-destructive")}>
                        {isIn ? '+' : '-'}{transaction.amount.toLocaleString()}
                        <span className="text-xs font-normal ml-0.5">{t('جنيه', 'EGP')}</span>
                      </p>
                      <Badge variant={isIn ? "default" : "destructive"} className="text-[10px] badge-pill mt-0.5">
                        {isIn ? t('إيراد', 'IN') : t('مصروف', 'OUT')}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border">
          <CardContent className="py-16 text-center">
            <CreditCard className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <h3 className="text-base font-semibold mb-1">{t("لا توجد معاملات", "No Transactions")}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t("ابدأ بتسجيل أول معاملة مالية", "Start by recording your first financial transaction")}</p>
            <Button onClick={() => setShowForm(true)} className="bg-primary hover:bg-primary/90 gap-2">
              <Plus className="h-4 w-4" />
              {t("معاملة جديدة", "New Transaction")}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
