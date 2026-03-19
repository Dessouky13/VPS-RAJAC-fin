import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getOverdueList } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { Calendar, AlertTriangle, DollarSign, Phone, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface OverdueStudent {
  studentId?: string;
  fullName: string;
  phone?: string;
  dueDate?: string;
  amountDue?: number;
  remaining?: number;
  installmentNumber?: number | null;
}

export function DueReport() {
  const { isArabic, t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [overdueStudents, setOverdueStudents] = useState<OverdueStudent[]>([]);
  const [filters, setFilters] = useState({ installmentNumber: 1 });
  const { toast } = useToast();

  const loadOverdueList = async () => {
    setLoading(true);
    try {
      const response = await getOverdueList();
      if (response.ok && response.data) {
        const inst = filters.installmentNumber;
        const filtered = (response.data || []).filter((s: any) => {
          let sn: any = null;
          if (s.installmentNumber !== undefined && s.installmentNumber !== null) sn = s.installmentNumber;
          else if (s.paymentNo !== undefined && s.paymentNo !== null) sn = s.paymentNo;
          else if (s.raw) {
            sn = s.raw.installmentNumber || s.raw.Installment_Number || s.raw.paymentNo || s.raw.installment;
          }
          return Number(sn) === Number(inst);
        });
        setOverdueStudents(filtered);
        toast({
          title: t("تم تحميل التقرير", "Report Loaded"),
          description: t(`تم العثور على ${filtered.length} طالب متأخر`, `Found ${filtered.length} overdue students`),
        });
      } else {
        toast({
          title: t("خطأ في تحميل التقرير", "Error Loading Report"),
          description: response.message || t("حدث خطأ أثناء تحميل التقرير", "Error occurred while loading report"),
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: t("خطأ في تحميل التقرير", "Error Loading Report"),
        description: t("حدث خطأ أثناء تحميل التقرير", "Error occurred while loading report"),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOverdueList(); }, [filters.installmentNumber]);

  const overdueCount = overdueStudents.length;
  const totalDue = overdueStudents.reduce((sum, s) => sum + (s.amountDue || 0), 0);

  return (
    <div className="space-y-6 section-enter" dir={isArabic ? "rtl" : "ltr"}>
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("تقرير المدفوعات المستحقة", "Due Payments Report")}</h1>
        <p className="text-sm text-muted-foreground">{t("عرض الطلاب المتأخرين في السداد", "View students with overdue payments")}</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <div className={cn("flex items-center gap-3", isArabic ? "flex-row-reverse" : "")}>
              <div className="p-2 rounded-lg bg-destructive/15">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive stat-number">{overdueCount}</p>
                <p className="text-xs text-muted-foreground">{t("طلاب متأخرون", "Overdue Students")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4">
            <div className={cn("flex items-center gap-3", isArabic ? "flex-row-reverse" : "")}>
              <div className="p-2 rounded-lg bg-warning/15">
                <DollarSign className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-warning stat-number">{totalDue.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{t("جنيه مستحق", "EGP Overdue")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className={cn("flex items-center gap-3", isArabic ? "flex-row-reverse" : "")}>
              <div className="p-2 rounded-lg bg-muted">
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold stat-number">{filters.installmentNumber}</p>
                <p className="text-xs text-muted-foreground">{t("رقم الدفعة", "Installment #")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-border">
        <CardHeader className="pb-4">
          <CardTitle className={cn("flex items-center gap-2 text-base", isArabic ? "flex-row-reverse" : "")}>
            <div className="p-1.5 rounded-md bg-primary/10">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            {t("فلاتر التقرير", "Report Filters")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn("flex gap-3 items-end flex-wrap", isArabic ? "flex-row-reverse" : "")}>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("رقم الدفعة", "Payment Number")}</label>
              <Select
                value={filters.installmentNumber.toString()}
                onValueChange={(value) => setFilters(prev => ({ ...prev, installmentNumber: parseInt(value) }))}
              >
                <SelectTrigger className="w-36 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t("الدفعة 1", "Installment 1")}</SelectItem>
                  <SelectItem value="2">{t("الدفعة 2", "Installment 2")}</SelectItem>
                  <SelectItem value="3">{t("الدفعة 3", "Installment 3")}</SelectItem>
                  <SelectItem value="4">{t("الدفعة 4", "Installment 4")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={loadOverdueList} disabled={loading} className="bg-primary hover:bg-primary/90 gap-2 h-9">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              {t("تحديث التقرير", "Refresh Report")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-border">
        <CardHeader className="pb-4">
          <CardTitle className={cn("flex items-center gap-2 text-base", isArabic ? "flex-row-reverse" : "")}>
            <div className="p-1.5 rounded-md bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            {t("الطلاب المتأخرون في السداد", "Overdue Students")}
            {overdueCount > 0 && (
              <Badge variant="destructive" className="ml-auto badge-pill">{overdueCount}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {overdueStudents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-semibold">{t("اسم الطالب", "Student Name")}</TableHead>
                  <TableHead className="text-xs font-semibold">{t("الهاتف", "Phone")}</TableHead>
                  <TableHead className="text-xs font-semibold">{t("تاريخ الاستحقاق", "Due Date")}</TableHead>
                  <TableHead className="text-xs font-semibold">{t("المبلغ المطلوب", "Amount Due")}</TableHead>
                  <TableHead className="text-xs font-semibold">{t("الحالة", "Status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdueStudents.map((student, index) => (
                  <TableRow
                    key={index}
                    className={cn(
                      "table-row-hover",
                      index % 2 === 0 ? "bg-background" : "bg-muted/20"
                    )}
                  >
                    <TableCell className="font-medium text-sm py-3">{student.fullName}</TableCell>
                    <TableCell className="py-3">
                      {student.phone ? (
                        <a
                          href={`https://wa.me/${student.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-primary hover:underline text-sm font-mono"
                        >
                          <Phone className="h-3 w-3" />
                          {student.phone}
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm py-3 text-muted-foreground">{student.dueDate || '—'}</TableCell>
                    <TableCell className="py-3">
                      <span className="font-bold text-destructive stat-number text-sm">
                        {(student.amountDue || 0).toLocaleString()} <span className="font-normal text-xs">EGP</span>
                      </span>
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge variant="destructive" className="badge-pill flex items-center gap-1 w-fit">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        {t("متأخر", "Overdue")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              {loading ? (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  {t("جاري تحميل التقرير...", "Loading report...")}
                </div>
              ) : (
                <div>
                  <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-30" />
                  <p className="text-sm text-muted-foreground">{t("لا توجد مدفوعات متأخرة", "No overdue payments")}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
