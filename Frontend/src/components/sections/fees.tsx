import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { savePayment, updateStudentDiscount, getStudentByIdentifier, updateStudentTotalFees, API_CF } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Search,
  User,
  DollarSign,
  CreditCard,
  Calendar,
  Percent,
  Save,
  Edit2,
  Phone,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Student {
  studentID?: string;
  name: string;
  grade: string;
  baseFees: number;
  discountPct?: number;
  netFees: number;
  totalPaid: number;
  unpaid: number;
  phoneNumber?: string;
  Phone_Number?: string;
  phone?: string;
  id?: string;
  fees?: number;
  discount?: number;
  paidAmount?: number;
  remainingAmount?: number;
  paid?: number;
  remaining?: number;
  netAmount?: number;
  Net_Amount?: number;
  remainingBalance?: number;
  Remaining_Balance?: number;
}

export function Fees() {
  const { isArabic, t } = useLanguage();
  const [searchName, setSearchName] = useState("");
  const [grades] = useState(["All","Grade_9","Grade_10","Grade_11","Grade_12","Unknown"]);
  const [selectedGrade, setSelectedGrade] = useState<string>('All');
  const [studentsByGrade, setStudentsByGrade] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [previousStudentState, setPreviousStudentState] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    discountPct: "",
    amount: "",
    method: "",
    date: new Date().toISOString().split('T')[0]
  });
  const [canEditDiscount, setCanEditDiscount] = useState(false);
  const { toast } = useToast();

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editTotalFeesValue, setEditTotalFeesValue] = useState("");

  const handleSearch = async () => {
    if (!searchName.trim()) {
      toast({
        title: t("خطأ", "Error"),
        description: t("يرجى إدخال اسم الطالب", "Please enter student name"),
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await getStudentByIdentifier(searchName);
      if (response.ok && response.data) {
        const student: any = response.data;
        const normalizedStudent = {
          ...student,
          baseFees: student.baseFees || student.fees || 0,
          discountPct: student.discountPct || student.discount || 0,
          netFees: student.netFees || student.netAmount || student.Net_Amount || 0,
          totalPaid: student.totalPaid || student.paidAmount || 0,
          unpaid: student.unpaid || student.remainingAmount || student.remaining || student.remainingBalance || 0
        };

        setSelectedStudent(normalizedStudent);
        setCanEditDiscount(!normalizedStudent.discountPct || normalizedStudent.discountPct === 0);
        setPaymentForm(prev => ({
          ...prev,
          discountPct: String(normalizedStudent.discountPct || '')
        }));

        toast({
          title: t("تم العثور على الطالب", "Student Found"),
          description: t(`تم العثور على ${student.name}`, `Found ${student.name}`),
        });
      } else {
        setSelectedStudent(null);
        toast({
          title: t("لم يتم العثور على الطالب", "Student Not Found"),
          description: t("تأكد من صحة الاسم", "Please check the name spelling"),
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "خطأ في البحث",
        description: "حدث خطأ أثناء البحث عن الطالب",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      if (!selectedGrade || selectedGrade === 'All') {
        setStudentsByGrade([]);
        return;
      }
      try {
        const res = await fetch(`${API_CF}/students?grade=${encodeURIComponent(selectedGrade)}`);
        const data = await res.json();
        const raw = data.students || [];
        const filtered = raw.map((s: any) => ({
          id: s.Student_ID || s.studentId || s.id,
          name: s.Name || s.name
        }));
        setStudentsByGrade(filtered);
      } catch (err) {
        console.error('Failed to load students for grade', err);
        setStudentsByGrade([]);
      }
    };
    load();
  }, [selectedGrade]);

  const handleSelectStudentFromGrade = async (id: string) => {
    const s = studentsByGrade.find(st => st.id === id);
    if (s) {
      try {
        const response = await getStudentByIdentifier(s.name);
        if (response.ok && response.data) {
          const student: any = response.data;
          const normalizedStudent = {
            ...student,
            baseFees: student.baseFees || student.fees || 0,
            discountPct: student.discountPct || student.discount || 0,
            netFees: student.netFees || student.netAmount || student.Net_Amount || 0,
            totalPaid: student.totalPaid || student.paidAmount || 0,
            unpaid: student.unpaid || student.remainingAmount || student.remaining || student.remainingBalance || 0
          };

          setSearchName(s.name);
          setSelectedStudent(normalizedStudent);
          setCanEditDiscount(!normalizedStudent.discountPct || normalizedStudent.discountPct === 0);
          setPaymentForm(prev => ({
            ...prev,
            discountPct: String(normalizedStudent.discountPct || '')
          }));
        }
      } catch (error) {
        console.error('Error selecting student from grade dropdown:', error);
      }
    }
  };

  const handleUpdateDiscount = async () => {
    if (!selectedStudent || !paymentForm.discountPct) return;
    setPreviousStudentState(JSON.parse(JSON.stringify(selectedStudent)));
    setLoading(true);
    try {
      const response = await updateStudentDiscount({
        studentId: selectedStudent.studentID || selectedStudent.id,
        discountPercent: parseFloat(paymentForm.discountPct)
      });
      if (response.ok) {
        toast({ title: "تم تحديث الخصم", description: `تم تطبيق خصم ${paymentForm.discountPct}%` });
        setCanEditDiscount(false);
        handleSearch();
      }
    } catch (error) {
      toast({ title: "خطأ في تحديث الخصم", description: "حدث خطأ أثناء تحديث الخصم", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = () => {
    if (previousStudentState) {
      setSelectedStudent(previousStudentState);
      setPaymentForm(prev => ({
        ...prev,
        discountPct: String(previousStudentState.discountPct || '')
      }));
      setPreviousStudentState(null);
      toast({
        title: t("تم التراجع عن الإجراء", "Action Undone"),
        description: t("تم استعادة بيانات الطالب السابقة", "Student data restored to previous state"),
      });
    }
  };

  const handleSavePayment = async () => {
    if (!selectedStudent) {
      toast({ title: "خطأ", description: "يرجى البحث عن طالب أولاً", variant: "destructive" });
      return;
    }
    if (!paymentForm.amount || !paymentForm.method) {
      toast({ title: "خطأ", description: "يرجى ملء جميع الحقول المطلوبة", variant: "destructive" });
      return;
    }

    const paymentAmount = parseFloat(paymentForm.amount);
    const unpaidAmount = selectedStudent.unpaid || selectedStudent.remainingAmount || selectedStudent.remaining || 0;
    if (paymentAmount > unpaidAmount) {
      toast({ title: "خطأ في المبلغ", description: `المبلغ أكبر من المبلغ المتبقي (${unpaidAmount} جنيه)`, variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      setPreviousStudentState(JSON.parse(JSON.stringify(selectedStudent)));
      const response = await savePayment({
        studentId: selectedStudent.studentID || selectedStudent.id,
        amountPaid: paymentAmount,
        paymentMethod: paymentForm.method,
        discountPercent: paymentForm.discountPct ? parseFloat(paymentForm.discountPct) : undefined,
        processedBy: 'Frontend User'
      });

      if (response.ok) {
        toast({ title: "تم حفظ الدفع بنجاح", description: `تم تسجيل دفع ${paymentForm.amount} جنيه للطالب ${selectedStudent.name}` });

        const returnedStudent = (response.data && (response.data.student || response.data)) || (response.student || null);
        if (returnedStudent) {
          const upd = returnedStudent;
          setSelectedStudent({
            ...upd,
            name: upd.name || upd.Name || selectedStudent.name,
            studentID: upd.id || upd.studentID || upd.Student_ID || selectedStudent.studentID,
            grade: upd.grade || upd.year || upd.Year || selectedStudent.grade,
            baseFees: upd.baseFees || upd.fees || Number(upd.Total_Fees) || selectedStudent.baseFees,
            discountPct: upd.discountPct || upd.discount || 0,
            netFees: upd.netFees || upd.netAmount || Number(upd.Net_Amount) || selectedStudent.netFees,
            totalPaid: upd.totalPaid || upd.paidAmount || Number(upd.Total_Paid) || selectedStudent.totalPaid,
            unpaid: upd.unpaid || upd.remainingAmount || Number(upd.Remaining_Balance) || selectedStudent.unpaid
          });
        } else {
          await handleSearch();
        }

        try { window.dispatchEvent(new CustomEvent('finance.updated')); } catch (e) {}

        setPaymentForm(prev => ({
          discountPct: prev.discountPct,
          amount: "",
          method: "",
          date: new Date().toISOString().split('T')[0]
        }));
        setSelectedGrade('All');
        setStudentsByGrade([]);
      } else {
        toast({ title: "فشل في حفظ الدفع", description: response.message || "حدث خطأ أثناء حفظ الدفع", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "خطأ في الحفظ", description: "حدث خطأ أثناء حفظ الدفع", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditDialog = () => {
    if (!selectedStudent) return;
    setEditTotalFeesValue(String(selectedStudent.baseFees || selectedStudent.fees || 0));
    setIsEditDialogOpen(true);
  };

  const handleSaveTotalFees = async () => {
    if (!selectedStudent) return;
    const newTotalFees = parseFloat(editTotalFeesValue);
    if (isNaN(newTotalFees)) {
      toast({ title: t("خطأ في الإدخال", "Invalid Input"), description: t("يجب إدخال رقم صحيح", "Please enter a valid number"), variant: "destructive" });
      return;
    }
    if (newTotalFees < 0) {
      toast({ title: t("خطأ في الإدخال", "Invalid Input"), description: t("لا يمكن أن تكون الرسوم سالبة", "Total fees cannot be negative"), variant: "destructive" });
      return;
    }
    if (newTotalFees > 1000000) {
      toast({ title: t("خطأ في الإدخال", "Invalid Input"), description: t("الرسوم تتجاوز الحد الأقصى المسموح (1,000,000 جنيه)", "Total fees exceed maximum allowed (1,000,000 EGP)"), variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      setPreviousStudentState(JSON.parse(JSON.stringify(selectedStudent)));
      const response = await updateStudentTotalFees({
        studentId: selectedStudent.studentID || selectedStudent.id || '',
        totalFees: newTotalFees,
        updatedBy: 'Frontend User'
      });

      if (response.ok && response.data) {
        toast({
          title: t("تم تحديث الرسوم بنجاح", "Fees Updated Successfully"),
          description: t(`تم تحديث إجمالي الرسوم إلى ${newTotalFees.toLocaleString()} جنيه`, `Total fees updated to ${newTotalFees.toLocaleString()} EGP`),
        });
        const updatedData = response.data.student || response.data;
        setSelectedStudent({
          ...selectedStudent,
          baseFees: updatedData.totalFees || newTotalFees,
          fees: updatedData.totalFees || newTotalFees,
          discountPct: updatedData.discountPercent || selectedStudent.discountPct,
          netFees: updatedData.netAmount || 0,
          netAmount: updatedData.netAmount || 0,
          unpaid: updatedData.remainingBalance || 0,
          remainingAmount: updatedData.remainingBalance || 0,
          remaining: updatedData.remainingBalance || 0
        });
        setIsEditDialogOpen(false);
        try { window.dispatchEvent(new CustomEvent('finance.updated')); } catch (e) {}
      } else {
        toast({ title: t("فشل في تحديث الرسوم", "Failed to Update Fees"), description: response.message || t("حدث خطأ أثناء تحديث الرسوم", "An error occurred while updating fees"), variant: "destructive" });
      }
    } catch (error) {
      toast({ title: t("خطأ في التحديث", "Update Error"), description: t("حدث خطأ أثناء تحديث الرسوم", "An error occurred while updating fees"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const phoneVal = selectedStudent?.phoneNumber || selectedStudent?.Phone_Number || selectedStudent?.phone;

  return (
    <div className="space-y-6 section-enter" dir={isArabic ? "rtl" : "ltr"}>
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("إدارة الرسوم", "Fee Management")}</h1>
        <p className="text-sm text-muted-foreground">{t("البحث عن الطلاب وتسجيل المدفوعات", "Search students and record payments")}</p>
      </div>

      {/* Search Section */}
      <Card className="border-border">
        <CardHeader className="pb-4">
          <CardTitle className={cn("flex items-center gap-2 text-base", isArabic ? "flex-row-reverse" : "")}>
            <div className="p-1.5 rounded-md bg-primary/10">
              <Search className="h-4 w-4 text-primary" />
            </div>
            {t("البحث عن طالب", "Search Student")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-xs font-medium">{t("الصف", "Grade")}</Label>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25"
              >
                {grades.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div className="md:col-span-3 space-y-1.5">
              <Label className="text-xs font-medium">{t("اختر طالبًا", "Select Student")}</Label>
              <select
                value={selectedStudent?.studentID || ''}
                onChange={(e) => { const val = e.target.value; if (val) handleSelectStudentFromGrade(val); }}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25"
              >
                {studentsByGrade.length === 0
                  ? <option value="">{t("اختر صفًا لرؤية الطلاب", "Select a grade to see students")}</option>
                  : studentsByGrade.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)
                }
              </select>
            </div>

            <div className="md:col-span-5 space-y-1.5">
              <Label className="text-xs font-medium">{t("الاسم الكامل للطالب", "Student Full Name")}</Label>
              <div className="relative">
                <Search className={cn("absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground", isArabic ? "right-3" : "left-3")} />
                <Input
                  placeholder={t("أدخل الاسم الكامل للطالب", "Enter student full name")}
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className={cn("text-sm", isArabic ? "pr-10" : "pl-10")}
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <Button onClick={handleSearch} disabled={loading} className="w-full bg-primary hover:bg-primary/90 gap-2">
                <Search className="h-4 w-4" />
                {loading ? t("جاري البحث...", "Searching...") : t("بحث", "Search")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Student Details */}
      {selectedStudent && (
        <Card className="border-l-4 border-l-primary border-border scale-in">
          <CardHeader className="pb-4">
            <div className={cn("flex items-center justify-between", isArabic ? "flex-row-reverse" : "")}>
              <CardTitle className={cn("flex items-center gap-2 text-base", isArabic ? "flex-row-reverse" : "")}>
                <div className="p-1.5 rounded-md bg-primary/10">
                  <User className="h-4 w-4 text-primary" />
                </div>
                {t("بيانات الطالب", "Student Details")}
              </CardTitle>
              {previousStudentState && (
                <Button variant="outline" size="sm" onClick={handleUndo} className="gap-1.5 text-xs h-8">
                  ↶ {t("تراجع", "Undo")}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Stat chips row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Name */}
              <div className="col-span-2 sm:col-span-1 p-3 bg-muted/50 rounded-lg border border-border">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{t("الاسم", "Name")}</p>
                <p className="text-sm font-semibold truncate">{selectedStudent.name}</p>
              </div>
              {/* Grade */}
              <div className="p-3 bg-muted/50 rounded-lg border border-border">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{t("الصف", "Grade")}</p>
                <Badge variant="outline" className="text-xs">{selectedStudent.grade}</Badge>
              </div>
              {/* Total Fees */}
              <div className="p-3 bg-muted/50 rounded-lg border border-border relative">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{t("إجمالي الرسوم", "Total Fees")}</p>
                <div className="flex items-center gap-1">
                  <p className="text-sm font-bold text-primary stat-number">
                    {(selectedStudent.baseFees || selectedStudent.fees || 0).toLocaleString()}
                  </p>
                  <Button variant="ghost" size="icon" className="h-5 w-5 -mt-0.5" onClick={handleOpenEditDialog} title={t("تعديل", "Edit")}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {/* Net Amount */}
              <div className="p-3 bg-muted/50 rounded-lg border border-border">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{t("الصافي", "Net")}</p>
                <p className="text-sm font-bold stat-number">
                  {selectedStudent.netFees?.toLocaleString()}
                  {(selectedStudent.discountPct || selectedStudent.discount) ? (
                    <span className="text-[10px] text-success ml-1">-{selectedStudent.discountPct || selectedStudent.discount}%</span>
                  ) : null}
                </p>
              </div>
              {/* Paid */}
              <div className="p-3 bg-success/10 rounded-lg border border-success/20">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{t("مدفوع", "Paid")}</p>
                <p className="text-sm font-bold text-success stat-number">{(selectedStudent.totalPaid || 0).toLocaleString()}</p>
              </div>
              {/* Remaining */}
              <div className="p-3 bg-warning/10 rounded-lg border border-warning/20">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{t("متبقي", "Remaining")}</p>
                <p className="text-sm font-bold text-warning stat-number">{(selectedStudent.unpaid || 0).toLocaleString()}</p>
              </div>
            </div>

            {/* WhatsApp */}
            {phoneVal && (
              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg border border-border w-fit">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a
                  href={`https://wa.me/${phoneVal.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary hover:underline font-mono"
                >
                  {phoneVal}
                </a>
              </div>
            )}

            {/* Payment Form */}
            <div className="border-t pt-5">
              <div className={cn("flex items-center gap-2 mb-4", isArabic ? "flex-row-reverse" : "")}>
                <div className="p-1.5 rounded-md bg-primary/10">
                  <CreditCard className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-sm font-semibold">{t("تسجيل دفع جديد", "Record New Payment")}</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Discount */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t("الخصم (%)", "Discount (%)")}</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Percent className={cn("absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground", isArabic ? "right-3" : "left-3")} />
                      <Input
                        type="number"
                        placeholder="0"
                        value={paymentForm.discountPct}
                        onChange={(e) => setPaymentForm({...paymentForm, discountPct: e.target.value})}
                        className={cn(isArabic ? "pr-10" : "pl-10")}
                        disabled={!canEditDiscount}
                      />
                    </div>
                    {canEditDiscount && paymentForm.discountPct && (
                      <Button type="button" size="sm" variant="outline" onClick={handleUpdateDiscount} disabled={loading} className="text-xs">
                        {t("تطبيق", "Apply")}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Amount */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t("مبلغ الدفع *", "Payment Amount *")}</Label>
                  <div className="relative">
                    <DollarSign className={cn("absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground", isArabic ? "right-3" : "left-3")} />
                    <Input
                      type="number"
                      placeholder={t("المبلغ", "Amount")}
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                      className={cn("text-base font-semibold", isArabic ? "pr-10" : "pl-10")}
                    />
                  </div>
                </div>

                {/* Method */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t("طريقة الدفع *", "Payment Method *")}</Label>
                  <Select value={paymentForm.method} onValueChange={(value) => setPaymentForm({...paymentForm, method: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("اختر طريقة الدفع", "Choose payment method")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">{t("نقدي", "Cash")}</SelectItem>
                      <SelectItem value="Visa">{t("فيزا", "Visa")}</SelectItem>
                      <SelectItem value="Instapay">{t("إنستاباي", "InstaPay")}</SelectItem>
                      <SelectItem value="Check">{t("شيك", "Check")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t("تاريخ الدفع", "Payment Date")}</Label>
                  <div className="relative">
                    <Calendar className={cn("absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground", isArabic ? "right-3" : "left-3")} />
                    <Input
                      type="date"
                      value={paymentForm.date}
                      onChange={(e) => setPaymentForm({...paymentForm, date: e.target.value})}
                      className={cn(isArabic ? "pr-10" : "pl-10")}
                    />
                  </div>
                </div>
              </div>

              {/* Amount preview */}
              {paymentForm.amount && (
                <div className="mt-4 p-3 bg-primary/5 border border-primary/15 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm">
                    {t("ستدفع", "You will record payment of")}{" "}
                    <span className="font-bold text-primary stat-number">{parseFloat(paymentForm.amount || '0').toLocaleString()} {t("جنيه", "EGP")}</span>
                  </span>
                  {parseFloat(paymentForm.amount) > (selectedStudent.unpaid || 0) && (
                    <div className="flex items-center gap-1 text-destructive text-xs ml-auto">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {t("يتجاوز المبلغ المتبقي", "Exceeds remaining balance")}
                    </div>
                  )}
                </div>
              )}

              <div className={cn("flex justify-end mt-5", isArabic ? "justify-start" : "")}>
                <Button onClick={handleSavePayment} disabled={loading} className="bg-primary hover:bg-primary/90 gap-2 px-6">
                  <Save className="h-4 w-4" />
                  {loading ? t("جاري الحفظ...", "Saving...") : t("حفظ الدفع", "Save Payment")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Total Fees Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]" dir={isArabic ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className={cn("flex items-center gap-2", isArabic ? "flex-row-reverse" : "")}>
              <Edit2 className="h-5 w-5" />
              <span>{t("تعديل إجمالي الرسوم", "Edit Total Fees")}</span>
            </DialogTitle>
            <DialogDescription>
              {t("قم بتعديل إجمالي الرسوم للطالب. سيتم إعادة حساب جميع المبالغ تلقائياً.", "Edit the student's total fees. All amounts will be automatically recalculated.")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="editTotalFees">{t("إجمالي الرسوم (جنيه مصري)", "Total Fees (EGP)")}</Label>
              <Input
                id="editTotalFees"
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                value={editTotalFeesValue}
                onChange={(e) => setEditTotalFeesValue(e.target.value)}
                placeholder={t("أدخل إجمالي الرسوم", "Enter total fees")}
                className="text-lg font-semibold"
                onKeyPress={(e) => { if (e.key === 'Enter') handleSaveTotalFees(); }}
              />
              <p className="text-xs text-muted-foreground">
                {t("سيتم إعادة حساب: الخصم، المبلغ الصافي، المبلغ المتبقي", "Will recalculate: Discount, Net Amount, Remaining Balance")}
              </p>
            </div>
            {selectedStudent && (
              <div className="bg-muted p-3 rounded-lg space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("الطالب:", "Student:")}</span>
                  <span className="font-medium">{selectedStudent.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("الرسوم الحالية:", "Current Fees:")}</span>
                  <span className="font-medium stat-number">{(selectedStudent.baseFees || 0).toLocaleString()} {t("جنيه", "EGP")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("الرسوم الجديدة:", "New Fees:")}</span>
                  <span className="font-medium text-primary stat-number">
                    {editTotalFeesValue ? parseFloat(editTotalFeesValue).toLocaleString() : '0'} {t("جنيه", "EGP")}
                  </span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className={cn(isArabic ? "flex-row-reverse" : "")}>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={loading}>
              {t("إلغاء", "Cancel")}
            </Button>
            <Button onClick={handleSaveTotalFees} disabled={loading}>
              {loading ? t("جاري الحفظ...", "Saving...") : t("حفظ", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
