import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { addStudent, uploadStudentsFile, updateStudentById, uploadStudentsUpdateFile, searchStudents } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLastAction } from "@/contexts/LastActionContext";
import {
  UserPlus,
  Upload,
  FileSpreadsheet,
  Phone,
  DollarSign,
  BookOpen,
  Calendar,
  Percent,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
  Edit,
  RefreshCw
} from "lucide-react";

const GRADES = ["Grade 9", "Grade 10", "Grade 11", "Grade 12"];

const emptyForm = {
  name: "",
  year: "",
  numberOfSubjects: "",
  totalFees: "",
  phoneNumber: "",
  discountPercent: "",
  enrollmentDate: new Date().toISOString().split("T")[0],
};

const emptyUpdateForm = {
  name: "",
  year: "",
  phoneNumber: "",
  numberOfSubjects: "",
  totalFees: "",
  discountPercent: "",
};

export function Students() {
  const { isArabic, t } = useLanguage();
  const { setLastAction } = useLastAction();
  const { toast } = useToast();

  const [tab, setTab] = useState<"add" | "upload" | "update">("add");

  // ── Add tab state ──
  const [form, setForm] = useState({ ...emptyForm });
  const [loading, setLoading] = useState(false);
  const [lastAdded, setLastAdded] = useState<any | null>(null);

  // ── Upload (new) tab state ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ ok: boolean; count?: number; message?: string } | null>(null);

  // ── Update tab state ──
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [updateForm, setUpdateForm] = useState({ ...emptyUpdateForm });
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateDone, setUpdateDone] = useState(false);

  // Update-upload (bulk) state
  const updateFileRef = useRef<HTMLInputElement>(null);
  const [updateUploadFile, setUpdateUploadFile] = useState<File | null>(null);
  const [updateUploadLoading, setUpdateUploadLoading] = useState(false);
  const [updateUploadResult, setUpdateUploadResult] = useState<{ ok: boolean; count?: number; message?: string } | null>(null);

  // ── Fee preview (add tab) ──
  const feesNum = parseFloat(form.totalFees) || 0;
  const discountNum = parseFloat(form.discountPercent) || 0;
  const discountAmt = Math.round(feesNum * discountNum / 100);
  const netAmt = feesNum - discountAmt;

  // ── Fee preview (update tab) ──
  const uFeesNum = parseFloat(updateForm.totalFees) || (selectedStudent?.totalFees ?? 0);
  const uDiscountNum = parseFloat(updateForm.discountPercent) !== 0 || updateForm.discountPercent !== ""
    ? parseFloat(updateForm.discountPercent) || 0
    : (selectedStudent?.discountPercent ?? 0);
  const uDiscountAmt = Math.round(uFeesNum * uDiscountNum / 100);
  const uNetAmt = uFeesNum - uDiscountAmt;

  // ── Handlers: Add ──
  const handleSubmit = async () => {
    if (!form.name.trim() || !form.year || !form.totalFees) {
      toast({
        title: t("حقول مطلوبة", "Required fields"),
        description: t("الاسم، الصف، والرسوم مطلوبة", "Name, grade and fees are required"),
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const res = await addStudent({
        name: form.name.trim(),
        year: form.year,
        numberOfSubjects: parseInt(form.numberOfSubjects) || 0,
        totalFees: parseFloat(form.totalFees),
        phoneNumber: form.phoneNumber.trim(),
        discountPercent: parseFloat(form.discountPercent) || 0,
        enrollmentDate: form.enrollmentDate,
        processedBy: "Frontend User",
      });
      if (res.ok) {
        const student = res.data || res;
        setLastAdded(student);
        setLastAction(t(
          `تمت إضافة الطالب: ${form.name} — ${form.year}`,
          `Student added: ${form.name} — ${form.year}`
        ));
        toast({
          title: t("تمت إضافة الطالب بنجاح", "Student added"),
          description: t(`تم تسجيل ${form.name} في ${form.year}`, `${form.name} enrolled in ${form.year}`),
        });
        setForm({ ...emptyForm });
      } else {
        toast({
          title: t("فشل في إضافة الطالب", "Failed to add student"),
          description: res.message || t("حدث خطأ", "An error occurred"),
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: t("خطأ", "Error"),
        description: t("حدث خطأ أثناء إضافة الطالب", "An error occurred while adding student"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Handlers: Upload (new students) ──
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadFile(e.target.files?.[0] || null);
    setUploadResult(null);
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploadLoading(true);
    setUploadResult(null);
    try {
      const res = await uploadStudentsFile(uploadFile);
      if (res.ok) {
        const count = (res.data as any)?.studentsProcessed ?? (res as any).studentsProcessed ?? "?";
        setUploadResult({ ok: true, count });
        setLastAction(t(`رُفع ملف الطلاب: ${count} طالب`, `Students file uploaded: ${count} students`));
        toast({
          title: t("تم رفع الملف بنجاح", "File uploaded"),
          description: t(`تم استيراد ${count} طالب`, `${count} students imported`),
        });
        setUploadFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        setUploadResult({ ok: false, message: res.message });
        toast({ title: t("فشل رفع الملف", "Upload failed"), description: res.message, variant: "destructive" });
      }
    } catch {
      setUploadResult({ ok: false, message: t("خطأ في الاتصال", "Connection error") });
    } finally {
      setUploadLoading(false);
    }
  };

  // ── Handlers: Update ──
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchResults([]);
    setSelectedStudent(null);
    setUpdateDone(false);
    try {
      const res = await searchStudents(searchQuery.trim());
      const students = res.data ?? res.students ?? (Array.isArray(res) ? res : []);
      setSearchResults(students);
      if (students.length === 0) {
        toast({
          title: t("لم يتم العثور على طلاب", "No students found"),
          description: t("جرّب اسمًا مختلفًا أو رقم الطالب", "Try a different name or student ID"),
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: t("خطأ في البحث", "Search error"), variant: "destructive" });
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectStudent = (student: any) => {
    setSelectedStudent(student);
    setUpdateForm({
      name: student.name ?? "",
      year: student.year ?? "",
      phoneNumber: student.phoneNumber ?? student.phone ?? "",
      numberOfSubjects: student.numberOfSubjects != null ? String(student.numberOfSubjects) : "",
      totalFees: student.totalFees != null ? String(student.totalFees) : "",
      discountPercent: student.discountPercent != null ? String(student.discountPercent) : "",
    });
    setUpdateDone(false);
    setSearchResults([]);
  };

  const handleUpdate = async () => {
    if (!selectedStudent) return;
    setUpdateLoading(true);
    try {
      const payload: any = {};
      if (updateForm.name.trim() && updateForm.name !== selectedStudent.name) payload.name = updateForm.name.trim();
      if (updateForm.year && updateForm.year !== selectedStudent.year) payload.year = updateForm.year;
      if (updateForm.phoneNumber !== (selectedStudent.phoneNumber ?? selectedStudent.phone ?? "")) payload.phoneNumber = updateForm.phoneNumber;
      if (updateForm.numberOfSubjects !== "" && updateForm.numberOfSubjects !== String(selectedStudent.numberOfSubjects ?? "")) payload.numberOfSubjects = parseInt(updateForm.numberOfSubjects);
      if (updateForm.totalFees !== "" && parseFloat(updateForm.totalFees) !== selectedStudent.totalFees) payload.totalFees = parseFloat(updateForm.totalFees);
      if (updateForm.discountPercent !== "" && parseFloat(updateForm.discountPercent) !== selectedStudent.discountPercent) payload.discountPercent = parseFloat(updateForm.discountPercent);

      if (Object.keys(payload).length === 0) {
        toast({ title: t("لا تغييرات", "No changes"), description: t("لم يتم تغيير أي حقل", "No fields were modified") });
        setUpdateLoading(false);
        return;
      }

      const res = await updateStudentById(selectedStudent.studentId, payload);
      if (res.ok) {
        setUpdateDone(true);
        setLastAction(t(`تم تحديث الطالب: ${selectedStudent.name}`, `Student updated: ${selectedStudent.name}`));
        toast({
          title: t("تم تحديث البيانات بنجاح", "Student updated"),
          description: t(`تم حفظ التغييرات للطالب ${selectedStudent.name}`, `Changes saved for ${selectedStudent.name}`),
        });
        setSelectedStudent({ ...selectedStudent, ...payload });
      } else {
        toast({ title: t("فشل التحديث", "Update failed"), description: res.message, variant: "destructive" });
      }
    } catch {
      toast({ title: t("خطأ", "Error"), description: t("حدث خطأ أثناء التحديث", "An error occurred during update"), variant: "destructive" });
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleUpdateFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUpdateUploadFile(e.target.files?.[0] || null);
    setUpdateUploadResult(null);
  };

  const handleUpdateUpload = async () => {
    if (!updateUploadFile) return;
    setUpdateUploadLoading(true);
    setUpdateUploadResult(null);
    try {
      const res = await uploadStudentsUpdateFile(updateUploadFile);
      if (res.ok) {
        const count = (res.data as any)?.studentsUpdated ?? (res as any).studentsUpdated ?? "?";
        setUpdateUploadResult({ ok: true, count });
        setLastAction(t(`تم تحديث ${count} طالب من الملف`, `Updated ${count} students from file`));
        toast({
          title: t("تم الرفع بنجاح", "Upload successful"),
          description: t(`تم تحديث ${count} طالب`, `${count} students updated`),
        });
        setUpdateUploadFile(null);
        if (updateFileRef.current) updateFileRef.current.value = "";
      } else {
        setUpdateUploadResult({ ok: false, message: res.message });
        toast({ title: t("فشل الرفع", "Upload failed"), description: res.message, variant: "destructive" });
      }
    } catch {
      setUpdateUploadResult({ ok: false, message: t("خطأ في الاتصال", "Connection error") });
    } finally {
      setUpdateUploadLoading(false);
    }
  };

  return (
    <div className="space-y-6 fade-in" dir={isArabic ? "rtl" : "ltr"}>
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          {t("إدارة الطلاب", "Students Management")}
        </h1>
        <p className="text-muted-foreground">
          {t("إضافة أو تحديث أو رفع ملف الطلاب", "Add, update or bulk-upload students via Excel")}
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 flex-wrap">
        <Button variant={tab === "add" ? "default" : "outline"} onClick={() => setTab("add")} className="gap-2">
          <UserPlus className="h-4 w-4" />
          {t("إضافة طالب", "Add Student")}
        </Button>
        <Button variant={tab === "update" ? "default" : "outline"} onClick={() => setTab("update")} className="gap-2">
          <Edit className="h-4 w-4" />
          {t("تحديث طالب", "Update Student")}
        </Button>
        <Button variant={tab === "upload" ? "default" : "outline"} onClick={() => setTab("upload")} className="gap-2">
          <Upload className="h-4 w-4" />
          {t("رفع ملف Excel", "Upload Excel")}
        </Button>
      </div>

      {/* ── Add Student Form ── */}
      {tab === "add" && (
        <Card className="bg-gradient-card border-primary/20">
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${isArabic ? "flex-row-reverse" : ""}`}>
              <UserPlus className="h-5 w-5 text-primary" />
              {t("بيانات الطالب الجديد", "New Student Details")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div className="space-y-2">
                <Label htmlFor="s-name">{t("الاسم الكامل *", "Full Name *")}</Label>
                <Input id="s-name" placeholder={t("اسم الطالب", "Student name")}
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>

              <div className="space-y-2">
                <Label>{t("الصف / السنة *", "Grade / Year *")}</Label>
                <Select value={form.year} onValueChange={(v) => setForm({ ...form, year: v })}>
                  <SelectTrigger><SelectValue placeholder={t("اختر الصف", "Select grade")} /></SelectTrigger>
                  <SelectContent>
                    {GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="s-phone">{t("رقم الواتساب / الهاتف", "WhatsApp / Phone")}</Label>
                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="s-phone" placeholder="01xxxxxxxxx" value={form.phoneNumber}
                    onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} className="pr-10" />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("يُحوَّل تلقائيًا: 01012345678 → 2001012345678", "Auto-converted: 01012345678 → 2001012345678")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="s-subjects">{t("عدد المواد", "Number of Subjects")}</Label>
                <div className="relative">
                  <BookOpen className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="s-subjects" type="number" min="0" placeholder="0"
                    value={form.numberOfSubjects} onChange={(e) => setForm({ ...form, numberOfSubjects: e.target.value })} className="pr-10" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="s-fees">{t("إجمالي الرسوم (ج.م) *", "Total Fees (EGP) *")}</Label>
                <div className="relative">
                  <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="s-fees" type="number" min="0" placeholder="0"
                    value={form.totalFees} onChange={(e) => setForm({ ...form, totalFees: e.target.value })} className="pr-10" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="s-discount">{t("نسبة الخصم (%)", "Discount (%)")}</Label>
                <div className="relative">
                  <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="s-discount" type="number" min="0" max="100" placeholder="0"
                    value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} className="pr-10" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="s-date">{t("تاريخ التسجيل", "Enrollment Date")}</Label>
                <div className="relative">
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="s-date" type="date" value={form.enrollmentDate}
                    onChange={(e) => setForm({ ...form, enrollmentDate: e.target.value })} className="pr-10" />
                </div>
              </div>
            </div>

            {/* Live fee preview */}
            {feesNum > 0 && (
              <div className="bg-muted/50 rounded-lg p-4 grid grid-cols-3 gap-4 text-center text-sm border border-border">
                <div>
                  <p className="text-muted-foreground">{t("الرسوم", "Fees")}</p>
                  <p className="font-bold">{feesNum.toLocaleString()} {t("ج.م", "EGP")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("الخصم", "Discount")}</p>
                  <p className="font-bold text-destructive">− {discountAmt.toLocaleString()} {t("ج.م", "EGP")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("الصافي", "Net")}</p>
                  <p className="font-bold text-success">{netAmt.toLocaleString()} {t("ج.م", "EGP")}</p>
                </div>
              </div>
            )}

            <div className={`flex gap-3 ${isArabic ? "flex-row-reverse" : ""}`}>
              <Button onClick={handleSubmit} disabled={loading} className="bg-primary hover:bg-primary/90 gap-2">
                <UserPlus className="h-4 w-4" />
                {loading ? t("جاري الحفظ...", "Saving...") : t("إضافة الطالب", "Add Student")}
              </Button>
              <Button variant="outline" onClick={() => { setForm({ ...emptyForm }); setLastAdded(null); }}>
                {t("مسح", "Clear")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success card */}
      {tab === "add" && lastAdded && (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="p-5 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" />
              <div className="space-y-1 text-sm">
                <p className="font-semibold">{t("تم التسجيل بنجاح", "Successfully enrolled")}</p>
                <p>{t("الاسم:", "Name:")} <span className="font-medium">{lastAdded.name}</span></p>
                <p>{t("رقم الطالب:", "Student ID:")} <span className="font-mono text-primary">{lastAdded.studentId}</span></p>
                <p>{t("الصف:", "Grade:")} <span className="font-medium">{lastAdded.year}</span></p>
                <p>{t("الرسوم الصافية:", "Net fees:")} <span className="font-medium">{(lastAdded.netAmount || 0).toLocaleString()} {t("ج.م", "EGP")}</span></p>
                {lastAdded.phoneNumber && (
                  <p>{t("واتساب:", "WhatsApp:")} <span className="font-mono">{lastAdded.phoneNumber}</span></p>
                )}
              </div>
            </div>
            <button onClick={() => setLastAdded(null)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </CardContent>
        </Card>
      )}

      {/* ── Update Student Tab ── */}
      {tab === "update" && (
        <div className="space-y-4">
          {/* Search */}
          <Card className="bg-gradient-card border-primary/20">
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 ${isArabic ? "flex-row-reverse" : ""}`}>
                <Search className="h-5 w-5 text-primary" />
                {t("البحث عن طالب", "Search for Student")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder={t("ابحث بالاسم أو رقم الطالب", "Search by name or student ID")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="flex-1"
                />
                <Button onClick={handleSearch} disabled={searchLoading || !searchQuery.trim()} className="gap-2">
                  {searchLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {t("بحث", "Search")}
                </Button>
              </div>

              {/* Search results */}
              {searchResults.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">{t(`${searchResults.length} نتيجة — اختر طالبًا`, `${searchResults.length} result(s) — select a student`)}</p>
                  {searchResults.map((s) => (
                    <button
                      key={s.studentId}
                      onClick={() => handleSelectStudent(s)}
                      className="w-full text-left flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-accent/30 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-sm">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.year} · {t("رقم الطالب:", "ID:")} <span className="font-mono">{s.studentId}</span></p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>{t("الرسوم الصافية:", "Net:")} {(s.netAmount ?? 0).toLocaleString()} {t("ج.م", "EGP")}</p>
                        <p>{t("المتبقي:", "Remaining:")} {(s.remainingBalance ?? 0).toLocaleString()} {t("ج.م", "EGP")}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Edit form — only shown after selecting a student */}
          {selectedStudent && (
            <Card className="bg-gradient-card border-primary/20">
              <CardHeader>
                <CardTitle className={`flex items-center gap-2 ${isArabic ? "flex-row-reverse" : ""}`}>
                  <Edit className="h-5 w-5 text-primary" />
                  {t("تحديث بيانات الطالب", "Update Student")}
                  <span className="font-mono text-sm text-muted-foreground ml-auto">{selectedStudent.studentId}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {updateDone && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 text-success border border-success/30 text-sm">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    {t("تم حفظ التغييرات بنجاح", "Changes saved successfully")}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="u-name">{t("الاسم الكامل", "Full Name")}</Label>
                    <Input id="u-name" value={updateForm.name}
                      onChange={(e) => setUpdateForm({ ...updateForm, name: e.target.value })} />
                  </div>

                  <div className="space-y-2">
                    <Label>{t("الصف / السنة", "Grade / Year")}</Label>
                    <Select value={updateForm.year} onValueChange={(v) => setUpdateForm({ ...updateForm, year: v })}>
                      <SelectTrigger><SelectValue placeholder={t("اختر الصف", "Select grade")} /></SelectTrigger>
                      <SelectContent>
                        {GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="u-phone">{t("رقم الواتساب / الهاتف", "WhatsApp / Phone")}</Label>
                    <div className="relative">
                      <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="u-phone" placeholder="01xxxxxxxxx" value={updateForm.phoneNumber}
                        onChange={(e) => setUpdateForm({ ...updateForm, phoneNumber: e.target.value })} className="pr-10" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="u-subjects">{t("عدد المواد", "Number of Subjects")}</Label>
                    <div className="relative">
                      <BookOpen className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="u-subjects" type="number" min="0"
                        value={updateForm.numberOfSubjects}
                        onChange={(e) => setUpdateForm({ ...updateForm, numberOfSubjects: e.target.value })} className="pr-10" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="u-fees">{t("إجمالي الرسوم (ج.م)", "Total Fees (EGP)")}</Label>
                    <div className="relative">
                      <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="u-fees" type="number" min="0"
                        value={updateForm.totalFees}
                        onChange={(e) => setUpdateForm({ ...updateForm, totalFees: e.target.value })} className="pr-10" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="u-discount">{t("نسبة الخصم (%)", "Discount (%)")}</Label>
                    <div className="relative">
                      <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="u-discount" type="number" min="0" max="100"
                        value={updateForm.discountPercent}
                        onChange={(e) => setUpdateForm({ ...updateForm, discountPercent: e.target.value })} className="pr-10" />
                    </div>
                  </div>
                </div>

                {/* Updated fee preview */}
                {uFeesNum > 0 && (
                  <div className="bg-muted/50 rounded-lg p-4 grid grid-cols-3 gap-4 text-center text-sm border border-border">
                    <div>
                      <p className="text-muted-foreground">{t("الرسوم", "Fees")}</p>
                      <p className="font-bold">{uFeesNum.toLocaleString()} {t("ج.م", "EGP")}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t("الخصم", "Discount")}</p>
                      <p className="font-bold text-destructive">− {uDiscountAmt.toLocaleString()} {t("ج.م", "EGP")}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t("الصافي", "Net")}</p>
                      <p className="font-bold text-success">{uNetAmt.toLocaleString()} {t("ج.م", "EGP")}</p>
                    </div>
                  </div>
                )}

                <div className={`flex gap-3 ${isArabic ? "flex-row-reverse" : ""}`}>
                  <Button onClick={handleUpdate} disabled={updateLoading} className="bg-primary hover:bg-primary/90 gap-2">
                    {updateLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Edit className="h-4 w-4" />}
                    {updateLoading ? t("جاري الحفظ...", "Saving...") : t("حفظ التغييرات", "Save Changes")}
                  </Button>
                  <Button variant="outline" onClick={() => { setSelectedStudent(null); setSearchQuery(""); setUpdateDone(false); }}>
                    {t("إلغاء", "Cancel")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bulk update via Excel */}
          <Card className="bg-gradient-card border-primary/20">
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 ${isArabic ? "flex-row-reverse" : ""}`}>
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                {t("تحديث جماعي من Excel", "Bulk Update from Excel")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2 border border-border">
                <p className="font-semibold">{t("الأعمدة المطلوبة في ملف التحديث:", "Required columns in update file:")}</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1 text-muted-foreground">
                  {[
                    ["Student_ID", "رقم الطالب (مطلوب)"],
                    ["Total Fees", "الرسوم الجديدة"],
                    ["Discount Percent", "نسبة الخصم"],
                    ["Phone Number", "رقم الهاتف"],
                    ["Grade / Year", "الصف"],
                    ["Number of Subjects", "عدد المواد"],
                  ].map(([en, ar]) => (
                    <div key={en} className="flex items-center gap-1">
                      <span className="text-primary font-mono text-xs">•</span>
                      <span>{isArabic ? ar : en}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  {t(
                    "عمود رقم الطالب مطلوب. الأعمدة الأخرى اختيارية — ستُحدَّث فقط الأعمدة الموجودة.",
                    "Student_ID column is required. Other columns are optional — only present columns will be updated."
                  )}
                </p>
              </div>

              <div
                className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => updateFileRef.current?.click()}
              >
                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                {updateUploadFile ? (
                  <div>
                    <p className="font-medium">{updateUploadFile.name}</p>
                    <p className="text-sm text-muted-foreground">{(updateUploadFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div>
                    <p className="font-medium">{t("انقر لاختيار ملف", "Click to select file")}</p>
                    <p className="text-sm text-muted-foreground">.xlsx, .xls</p>
                  </div>
                )}
                <input ref={updateFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpdateFileChange} />
              </div>

              {updateUploadResult && (
                <div className={`flex items-center gap-3 p-3 rounded-lg text-sm ${updateUploadResult.ok ? "bg-success/10 text-success border border-success/30" : "bg-destructive/10 text-destructive border border-destructive/30"}`}>
                  {updateUploadResult.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                  <span>
                    {updateUploadResult.ok
                      ? t(`تم التحديث بنجاح: ${updateUploadResult.count} طالب`, `Successfully updated ${updateUploadResult.count} students`)
                      : updateUploadResult.message}
                  </span>
                </div>
              )}

              <div className={`flex gap-3 ${isArabic ? "flex-row-reverse" : ""}`}>
                <Button onClick={handleUpdateUpload} disabled={!updateUploadFile || updateUploadLoading} className="bg-primary hover:bg-primary/90 gap-2">
                  <Upload className="h-4 w-4" />
                  {updateUploadLoading ? t("جاري التحديث...", "Updating...") : t("رفع وتحديث", "Upload & Update")}
                </Button>
                {updateUploadFile && (
                  <Button variant="outline" onClick={() => { setUpdateUploadFile(null); setUpdateUploadResult(null); if (updateFileRef.current) updateFileRef.current.value = ""; }}>
                    {t("إلغاء", "Cancel")}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Excel Upload Tab (new students) ── */}
      {tab === "upload" && (
        <Card className="bg-gradient-card border-primary/20">
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${isArabic ? "flex-row-reverse" : ""}`}>
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              {t("رفع ملف الطلاب (Excel)", "Upload Students File (Excel)")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2 border border-border">
              <p className="font-semibold">{t("الأعمدة المطلوبة في الملف:", "Required columns in the file:")}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1 text-muted-foreground">
                {[
                  ["Name", "الاسم"],
                  ["Grade / Year", "الصف"],
                  ["Total Fees", "الرسوم"],
                  ["Phone Number", "رقم الهاتف / واتساب"],
                  ["Number of Subjects", "عدد المواد (اختياري)"],
                ].map(([en, ar]) => (
                  <div key={en} className="flex items-center gap-1">
                    <span className="text-primary font-mono text-xs">•</span>
                    <span>{isArabic ? ar : en}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                {t(
                  "أسماء مقبولة أيضًا: Student Name, Full Name, Mobile, Contact Number, Tuition",
                  "Also accepted: Student Name, Full Name, Mobile, Contact Number, Tuition"
                )}
              </p>
            </div>

            <div
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              {uploadFile ? (
                <div>
                  <p className="font-medium">{uploadFile.name}</p>
                  <p className="text-sm text-muted-foreground">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="font-medium">{t("انقر لاختيار ملف", "Click to select file")}</p>
                  <p className="text-sm text-muted-foreground">.xlsx, .xls</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
            </div>

            {uploadResult && (
              <div className={`flex items-center gap-3 p-3 rounded-lg text-sm ${uploadResult.ok ? "bg-success/10 text-success border border-success/30" : "bg-destructive/10 text-destructive border border-destructive/30"}`}>
                {uploadResult.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                <span>
                  {uploadResult.ok
                    ? t(`تم الاستيراد بنجاح: ${uploadResult.count} طالب`, `Successfully imported ${uploadResult.count} students`)
                    : uploadResult.message}
                </span>
              </div>
            )}

            <div className={`flex gap-3 ${isArabic ? "flex-row-reverse" : ""}`}>
              <Button onClick={handleUpload} disabled={!uploadFile || uploadLoading} className="bg-primary hover:bg-primary/90 gap-2">
                <Upload className="h-4 w-4" />
                {uploadLoading ? t("جاري الرفع...", "Uploading...") : t("رفع وحفظ", "Upload & Save")}
              </Button>
              {uploadFile && (
                <Button variant="outline" onClick={() => { setUploadFile(null); setUploadResult(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                  {t("إلغاء", "Cancel")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
