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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getTeachers, addTeacher, payTeacher, deleteTeacher, updateTeacher } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  User,
  DollarSign,
  BookOpen,
  Hash,
  Save,
  CreditCard,
  Edit2,
  Trash2,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Teacher {
  id: string;
  name: string;
  subject: string;
  numberOfClasses: number;
  totalAmount: number;
  totalPaid: number;
  remainingBalance: number;
  createdAt: string;
}

export function Teachers() {
  const { isArabic } = useLanguage();
  const { toast } = useToast();

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  const [newTeacher, setNewTeacher] = useState({ name: "", subject: "", numberOfClasses: "", totalAmount: "" });
  const [payment, setPayment] = useState({ teacherName: "", amount: "", method: "" });

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [editForm, setEditForm] = useState({ name: "", subject: "", numberOfClasses: "", totalAmount: "" });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState<Teacher | null>(null);

  useEffect(() => { loadTeachers(); }, []);

  const loadTeachers = async () => {
    try {
      const response = await getTeachers();
      if (response.ok && response.data) setTeachers(response.data);
    } catch (error) {
      toast({ title: isArabic ? "خطأ" : "Error", description: isArabic ? "فشل في تحميل المعلمين" : "Failed to load teachers", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await addTeacher({
        name: newTeacher.name,
        subject: newTeacher.subject,
        numberOfClasses: parseInt(newTeacher.numberOfClasses),
        totalAmount: parseFloat(newTeacher.totalAmount)
      });
      if (response.ok) {
        toast({ title: isArabic ? "نجح" : "Success", description: isArabic ? "تم إضافة المعلم بنجاح" : "Teacher added successfully" });
        setNewTeacher({ name: "", subject: "", numberOfClasses: "", totalAmount: "" });
        await loadTeachers();
      } else {
        throw new Error(response.message || "Failed to add teacher");
      }
    } catch (error) {
      toast({ title: isArabic ? "خطأ" : "Error", description: isArabic ? "فشل في إضافة المعلم" : "Failed to add teacher", variant: "destructive" });
    }
  };

  const handlePayTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await payTeacher({
        teacherName: payment.teacherName,
        amount: parseFloat(payment.amount),
        method: payment.method
      });
      if (response.ok) {
        toast({ title: isArabic ? "نجح" : "Success", description: isArabic ? "تم تسجيل الدفعة بنجاح" : "Payment recorded successfully" });
        setPayment({ teacherName: "", amount: "", method: "" });
        await loadTeachers();
      } else {
        throw new Error(response.message || "Failed to record payment");
      }
    } catch (error) {
      toast({ title: isArabic ? "خطأ" : "Error", description: isArabic ? "فشل في تسجيل الدفعة" : "Failed to record payment", variant: "destructive" });
    }
  };

  const handleOpenEditDialog = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setEditForm({ name: teacher.name, subject: teacher.subject, numberOfClasses: String(teacher.numberOfClasses), totalAmount: String(teacher.totalAmount) });
    setIsEditDialogOpen(true);
  };

  const handleUpdateTeacher = async () => {
    if (!editingTeacher) return;
    try {
      const response = await updateTeacher(editingTeacher.id, {
        name: editForm.name,
        subject: editForm.subject,
        numberOfClasses: parseInt(editForm.numberOfClasses),
        totalAmount: parseFloat(editForm.totalAmount)
      });
      if (response.ok) {
        toast({ title: isArabic ? "نجح" : "Success", description: isArabic ? "تم تحديث المعلم بنجاح" : "Teacher updated successfully" });
        setIsEditDialogOpen(false);
        setEditingTeacher(null);
        await loadTeachers();
      } else {
        throw new Error(response.message || "Failed to update teacher");
      }
    } catch (error) {
      toast({ title: isArabic ? "خطأ" : "Error", description: isArabic ? "فشل في تحديث المعلم" : "Failed to update teacher", variant: "destructive" });
    }
  };

  const handleOpenDeleteConfirm = (teacher: Teacher) => {
    setTeacherToDelete(teacher);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!teacherToDelete) return;
    try {
      const response = await deleteTeacher(teacherToDelete.id);
      if (response.ok) {
        toast({ title: isArabic ? "نجح" : "Success", description: isArabic ? "تم حذف المعلم بنجاح" : "Teacher deleted successfully" });
        setDeleteConfirmOpen(false);
        setTeacherToDelete(null);
        await loadTeachers();
      } else {
        throw new Error(response.message || "Failed to delete teacher");
      }
    } catch (error) {
      toast({ title: isArabic ? "خطأ" : "Error", description: isArabic ? "فشل في حذف المعلم" : "Failed to delete teacher", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-muted-foreground">{isArabic ? "جاري التحميل..." : "Loading..."}</div>
      </div>
    );
  }

  const fieldClass = "h-9 text-sm";
  const labelClass = "text-xs font-medium text-muted-foreground";

  return (
    <div className="space-y-6 section-enter" dir={isArabic ? "rtl" : "ltr"}>
      <div>
        <h1 className="text-2xl font-bold text-foreground">{isArabic ? "إدارة المعلمين" : "Teachers"}</h1>
        <p className="text-sm text-muted-foreground">{isArabic ? "إدارة المعلمين والرواتب" : "Manage teachers and salary payments"}</p>
      </div>

      {/* Add Teacher + Pay Teacher forms side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add Teacher */}
        <Card className="border-border">
          <CardHeader className="pb-4">
            <CardTitle className={cn("flex items-center gap-2 text-base", isArabic ? "flex-row-reverse" : "")}>
              <div className="p-1.5 rounded-md bg-primary/10">
                <User className="h-4 w-4 text-primary" />
              </div>
              {isArabic ? "إضافة معلم جديد" : "Add New Teacher"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddTeacher} className="space-y-3">
              <div className="space-y-1.5">
                <Label className={labelClass}>{isArabic ? "الاسم" : "Name"}</Label>
                <Input className={fieldClass} value={newTeacher.name} onChange={(e) => setNewTeacher({ ...newTeacher, name: e.target.value })} placeholder={isArabic ? "أدخل اسم المعلم" : "Enter teacher name"} required />
              </div>
              <div className="space-y-1.5">
                <Label className={labelClass}>{isArabic ? "المادة" : "Subject"}</Label>
                <Input className={fieldClass} value={newTeacher.subject} onChange={(e) => setNewTeacher({ ...newTeacher, subject: e.target.value })} placeholder={isArabic ? "أدخل المادة" : "Enter subject"} required />
              </div>
              <div className="space-y-1.5">
                <Label className={labelClass}>{isArabic ? "عدد الطلاب" : "Number of Students"}</Label>
                <div className="relative">
                  <Hash className={cn("absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground", isArabic ? "right-3" : "left-3")} />
                  <Input className={cn(fieldClass, isArabic ? "pr-10" : "pl-10")} type="number" value={newTeacher.numberOfClasses} onChange={(e) => setNewTeacher({ ...newTeacher, numberOfClasses: e.target.value })} placeholder="10" required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className={labelClass}>{isArabic ? "إجمالي المبلغ" : "Total Amount"}</Label>
                <div className="relative">
                  <DollarSign className={cn("absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground", isArabic ? "right-3" : "left-3")} />
                  <Input className={cn(fieldClass, "font-semibold", isArabic ? "pr-10" : "pl-10")} type="number" step="0.01" value={newTeacher.totalAmount} onChange={(e) => setNewTeacher({ ...newTeacher, totalAmount: e.target.value })} placeholder="1000.00" required />
                </div>
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 gap-2 mt-1">
                <Save className="h-4 w-4" />
                {isArabic ? "إضافة المعلم" : "Add Teacher"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Pay Teacher */}
        <Card className="border-border">
          <CardHeader className="pb-4">
            <CardTitle className={cn("flex items-center gap-2 text-base", isArabic ? "flex-row-reverse" : "")}>
              <div className="p-1.5 rounded-md bg-success/10">
                <CreditCard className="h-4 w-4 text-success" />
              </div>
              {isArabic ? "دفع للمعلم" : "Pay Teacher"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePayTeacher} className="space-y-3">
              <div className="space-y-1.5">
                <Label className={labelClass}>{isArabic ? "المعلم" : "Teacher"}</Label>
                <Select value={payment.teacherName} onValueChange={(value) => setPayment({ ...payment, teacherName: value })}>
                  <SelectTrigger className={fieldClass}>
                    <SelectValue placeholder={isArabic ? "اختر المعلم" : "Select teacher"} />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.name}>{teacher.name} — {teacher.subject}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className={labelClass}>{isArabic ? "المبلغ" : "Amount"}</Label>
                <div className="relative">
                  <DollarSign className={cn("absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground", isArabic ? "right-3" : "left-3")} />
                  <Input className={cn(fieldClass, "font-semibold", isArabic ? "pr-10" : "pl-10")} type="number" step="0.01" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} placeholder="500.00" required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className={labelClass}>{isArabic ? "طريقة الدفع" : "Payment Method"}</Label>
                <Select value={payment.method} onValueChange={(value) => setPayment({ ...payment, method: value })}>
                  <SelectTrigger className={fieldClass}>
                    <SelectValue placeholder={isArabic ? "اختر طريقة الدفع" : "Select payment method"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">{isArabic ? "نقدي" : "Cash"}</SelectItem>
                    <SelectItem value="Bank Transfer">{isArabic ? "تحويل بنكي" : "Bank Transfer"}</SelectItem>
                    <SelectItem value="Check">{isArabic ? "شيك" : "Check"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full bg-success hover:bg-success/90 text-success-foreground gap-2 mt-1">
                <DollarSign className="h-4 w-4" />
                {isArabic ? "تسجيل الدفعة" : "Record Payment"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Teachers Grid */}
      <Card className="border-border">
        <CardHeader className="pb-4">
          <CardTitle className={cn("flex items-center gap-2 text-base", isArabic ? "flex-row-reverse" : "")}>
            <div className="p-1.5 rounded-md bg-primary/10">
              <GraduationCap className="h-4 w-4 text-primary" />
            </div>
            {isArabic ? "قائمة المعلمين" : "Teachers List"}
            <span className="ml-auto text-xs font-normal text-muted-foreground">{teachers.length} {isArabic ? "معلم" : "teachers"}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {teachers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{isArabic ? "لا يوجد معلمون مسجلون" : "No teachers registered yet"}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teachers.map((teacher) => {
                const paidPct = teacher.totalAmount > 0 ? Math.min(100, Math.round((teacher.totalPaid / teacher.totalAmount) * 100)) : 0;
                const fullyPaid = teacher.remainingBalance <= 0;
                return (
                  <Card key={teacher.id} className={cn("border relative overflow-hidden", fullyPaid ? "border-success/30 bg-success/5" : "border-border bg-card")}>
                    {/* Edit / Delete — top right */}
                    <div className={cn("absolute top-3 flex gap-1", isArabic ? "left-3" : "right-3")}>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={() => handleOpenEditDialog(teacher)} title={isArabic ? "تعديل" : "Edit"}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => handleOpenDeleteConfirm(teacher)} title={isArabic ? "حذف" : "Delete"}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <CardContent className="p-4 space-y-3">
                      {/* Name + subject */}
                      <div className={cn("flex items-start gap-2 pr-14", isArabic ? "flex-row-reverse pl-14 pr-0" : "")}>
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{teacher.name}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <BookOpen className="h-3 w-3" />
                            <span className="truncate">{teacher.subject}</span>
                          </div>
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 bg-muted/50 rounded-md">
                          <p className="text-muted-foreground">{isArabic ? "الطلاب" : "Students"}</p>
                          <p className="font-bold stat-number">{teacher.numberOfClasses}</p>
                        </div>
                        <div className="p-2 bg-muted/50 rounded-md">
                          <p className="text-muted-foreground">{isArabic ? "المجموع" : "Total"}</p>
                          <p className="font-bold stat-number">{teacher.totalAmount.toLocaleString()}</p>
                        </div>
                        <div className="p-2 bg-success/10 rounded-md">
                          <p className="text-muted-foreground">{isArabic ? "مدفوع" : "Paid"}</p>
                          <p className="font-bold text-success stat-number">{teacher.totalPaid.toLocaleString()}</p>
                        </div>
                        <div className={cn("p-2 rounded-md", fullyPaid ? "bg-success/10" : "bg-warning/10")}>
                          <p className="text-muted-foreground">{isArabic ? "متبقي" : "Remaining"}</p>
                          <p className={cn("font-bold stat-number", fullyPaid ? "text-success" : "text-warning")}>{teacher.remainingBalance.toLocaleString()}</p>
                        </div>
                      </div>

                      {/* Salary progress bar */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{isArabic ? "نسبة الدفع" : "Payment progress"}</span>
                          <span className={cn("font-semibold", fullyPaid ? "text-success" : "text-foreground")}>{paidPct}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all", fullyPaid ? "bg-success" : "bg-primary")}
                            style={{ width: `${paidPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Status badge */}
                      <Badge variant={fullyPaid ? "default" : "destructive"} className="text-[10px] badge-pill">
                        {fullyPaid ? (isArabic ? "مكتمل الدفع" : "Fully Paid") : (isArabic ? "دفع جزئي" : "Partial Payment")}
                      </Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Teacher Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]" dir={isArabic ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className={cn("flex items-center gap-2", isArabic ? "flex-row-reverse" : "")}>
              <Edit2 className="h-5 w-5" />
              <span>{isArabic ? "تعديل بيانات المعلم" : "Edit Teacher"}</span>
            </DialogTitle>
            <DialogDescription>{isArabic ? "قم بتعديل بيانات المعلم" : "Update teacher information"}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {[
              { id: "editName", label: isArabic ? "الاسم" : "Name", value: editForm.name, onChange: (v: string) => setEditForm({ ...editForm, name: v }), type: "text" },
              { id: "editSubject", label: isArabic ? "المادة" : "Subject", value: editForm.subject, onChange: (v: string) => setEditForm({ ...editForm, subject: v }), type: "text" },
              { id: "editClasses", label: isArabic ? "عدد الطلاب" : "Number of Students", value: editForm.numberOfClasses, onChange: (v: string) => setEditForm({ ...editForm, numberOfClasses: v }), type: "number" },
              { id: "editAmount", label: isArabic ? "إجمالي المبلغ" : "Total Amount", value: editForm.totalAmount, onChange: (v: string) => setEditForm({ ...editForm, totalAmount: v }), type: "number" },
            ].map((field) => (
              <div key={field.id} className="grid gap-2">
                <Label htmlFor={field.id} className="text-xs text-muted-foreground">{field.label}</Label>
                <Input id={field.id} type={field.type} value={field.value} onChange={(e) => field.onChange(e.target.value)} className="h-9 text-sm" />
              </div>
            ))}
          </div>
          <DialogFooter className={cn(isArabic ? "flex-row-reverse" : "")}>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>{isArabic ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleUpdateTeacher}>{isArabic ? "حفظ التعديلات" : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent dir={isArabic ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle className={isArabic ? "text-right" : ""}>{isArabic ? "تأكيد الحذف" : "Confirm Deletion"}</AlertDialogTitle>
            <AlertDialogDescription className={isArabic ? "text-right" : ""}>
              {isArabic
                ? `هل أنت متأكد من حذف المعلم "${teacherToDelete?.name}"؟ هذا الإجراء لا يمكن التراجع عنه.`
                : `Are you sure you want to delete teacher "${teacherToDelete?.name}"? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={isArabic ? "flex-row-reverse" : ""}>
            <AlertDialogCancel>{isArabic ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isArabic ? "حذف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
