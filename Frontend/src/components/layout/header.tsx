import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Languages, Undo2, X, Shield, User, CalendarClock } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLastAction } from "@/contexts/LastActionContext";
import { useAuth } from "@/contexts/AuthContext";
import rajacLogo from "@/assets/rajac-logo-hd.png";
import { downloadMasterSheet, deleteAllData, updateInstallments, createBackup, undoLastAction, newAcademicYear } from "@/lib/api";

export function Header() {
  const { isArabic, setIsArabic, t } = useLanguage();
  const { lastAction, clearLastAction } = useLastAction();
  const { user, isAdmin } = useAuth();
  const [yearResetLoading, setYearResetLoading] = useState(false);

  const handleUndo = async () => {
    if (confirm(t('تراجع عن آخر إجراء؟ سيتم استعادة النسخة السابقة.', 'Undo last action? This will restore the previous version of sheets.'))) {
      const result = await undoLastAction();
      if (result.ok) { clearLastAction(); alert(t('تم التراجع بنجاح', 'Undone successfully')); }
      else alert(t('فشل التراجع', 'Failed to undo'));
    }
  };

  const handleNewYear = async () => {
    const year = prompt('Enter new academic year (e.g. 2025-2026):');
    if (!year) return;
    const keepStudents = confirm('Keep student records but reset payment data?\n\nOK = Keep students (recommended)\nCancel = Delete all students too');
    if (!confirm(`⚠️ THIS CANNOT BE UNDONE!\n\nArchive all data and start fresh for academic year "${year}"?\nStudents will be ${keepStudents ? 'kept (payments reset to 0)' : 'deleted'}.`)) return;

    setYearResetLoading(true);
    try {
      const result = await newAcademicYear(year, keepStudents);
      alert(result.ok ? `✓ Reset complete for ${year}` : `Error: ${result.message}`);
    } finally {
      setYearResetLoading(false);
    }
  };

  return (
    <header
      className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      dir={isArabic ? "rtl" : "ltr"}
    >
      <div className="flex items-center h-14 px-4 gap-4">

        {/* Logo — visible on mobile (sidebar hidden on mobile) */}
        <div className={`flex items-center gap-2.5 lg:hidden`}>
          <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
            <img src={rajacLogo} alt="RAJAC" className="h-6 w-6 object-contain" />
          </div>
          <span className="text-sm font-bold text-primary">{t("نظام المالية", "Financial System")}</span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Last action pill */}
        {lastAction && (
          <div className="hidden md:flex items-center gap-2 bg-muted border border-border rounded-lg px-3 py-1.5 max-w-xs shadow-sm">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground leading-none mb-0.5">{t("آخر إجراء", "Last action")}</p>
              <p className="text-xs font-medium text-foreground truncate">{lastAction.description}</p>
            </div>
            <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-1 shrink-0" onClick={handleUndo}>
              <Undo2 className="h-2.5 w-2.5" />{t("تراجع", "Undo")}
            </Button>
            <button className="text-muted-foreground hover:text-foreground transition-colors shrink-0" onClick={clearLastAction} aria-label="Dismiss">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Right controls */}
        <div className={`flex items-center gap-2`}>
          <Button variant="outline" size="sm" onClick={() => setIsArabic(!isArabic)} className="gap-1.5 h-8 px-2.5">
            <Languages className="h-3.5 w-3.5" />
            <span className="text-xs hidden sm:inline">{isArabic ? "English" : "العربية"}</span>
          </Button>

          {/* User badge */}
          {user && (
            <div className="hidden sm:flex items-center gap-1.5 bg-muted/60 border border-border rounded-md px-2.5 py-1 text-xs">
              {user.role === 'admin' ? <Shield className="h-3 w-3 text-primary" /> : <User className="h-3 w-3 text-muted-foreground" />}
              <span className="font-medium text-foreground">{user.name}</span>
              <span className="text-muted-foreground capitalize">({user.role})</span>
            </div>
          )}

          {/* Admin dropdown */}
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 px-2.5 hover:bg-accent/50">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="ml-1.5 text-xs hidden sm:inline">Admin</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Data Operations</DropdownMenuLabel>
                <DropdownMenuItem onClick={async () => { await downloadMasterSheet(); }}>
                  Download Master Sheet (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={async () => {
                  const r = await createBackup();
                  alert(r.ok ? 'Backup created' : 'Backup failed');
                }}>
                  Create Backup
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleUndo}>
                  ↶ Undo Last Action
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5" /> Academic Year
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={handleNewYear}
                  disabled={yearResetLoading}
                  className="text-warning focus:text-warning"
                >
                  {yearResetLoading ? 'Resetting...' : '🎓 New Academic Year Reset'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Danger Zone</DropdownMenuLabel>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={async () => { if (confirm('Delete ALL data? Cannot be undone.')) { await deleteAllData(); alert('Deleted'); } }}
                >
                  Delete All Data
                </DropdownMenuItem>
                <DropdownMenuItem onClick={async () => {
                  const dates = prompt('Installment dates (comma-separated YYYY-MM-DD):');
                  if (dates) {
                    const arr = dates.split(',').map((d, i) => ({ number: i + 1, date: d.trim() }));
                    await updateInstallments(arr);
                    alert('Updated');
                  }
                }}>
                  Update Installment Dates
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
