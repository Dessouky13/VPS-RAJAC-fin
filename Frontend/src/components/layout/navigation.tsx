import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Users,
  CreditCard,
  AlertCircle,
  ArrowLeftRight,
  Wallet,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Shield,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import rajacLogo from "@/assets/rajac-logo-hd.png";

interface NavItem {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { id: "dashboard",    labelAr: "لوحة التحكم",         labelEn: "Overview",          icon: LayoutDashboard, adminOnly: true },
  { id: "fees",         labelAr: "إدارة الرسوم",         labelEn: "Fee Management",    icon: CreditCard,      adminOnly: true },
  { id: "students",     labelAr: "الطلاب",               labelEn: "Students",          icon: Users },
  { id: "due-report",   labelAr: "المستحقات",            labelEn: "Due Payments",      icon: AlertCircle,     adminOnly: true },
  { id: "transactions", labelAr: "الإيرادات والمصروفات", labelEn: "Transactions",      icon: ArrowLeftRight,  adminOnly: true },
  { id: "balances",     labelAr: "النقد والبنك",          labelEn: "Balances",          icon: Wallet,          adminOnly: true },
  { id: "teachers",     labelAr: "المعلمون",             labelEn: "Teachers",          icon: GraduationCap,   adminOnly: true },
];

interface NavigationProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export function Navigation({ activeSection, onSectionChange }: NavigationProps) {
  const { isArabic } = useLanguage();
  const { isAdmin, user, logout } = useAuth();
  const visibleItems = navItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col w-60 shrink-0 border-r border-border bg-card",
        "min-h-[calc(100vh-3.5rem)]"
      )}
      dir={isArabic ? "rtl" : "ltr"}
    >
      {/* Logo area */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <div className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
          <img src={rajacLogo} alt="RAJAC" className="h-7 w-7 object-contain" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-primary leading-tight truncate">RAJAC</p>
          <p className="text-xs text-muted-foreground leading-tight truncate">Finance</p>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                isArabic ? "flex-row-reverse text-right" : "text-left",
                isActive
                  ? "nav-item-active font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              />
              <span className="truncate">
                {isArabic ? item.labelAr : item.labelEn}
              </span>
            </button>
          );
        })}
      </nav>

      {/* User badge + logout */}
      <div className="border-t border-border px-3 py-4 space-y-2">
        {user && (
          <div className={cn(
            "flex items-center gap-2 px-2 py-2 rounded-lg bg-muted/50",
            isArabic ? "flex-row-reverse" : ""
          )}>
            <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              {user.role === "admin"
                ? <Shield className="h-3.5 w-3.5 text-primary" />
                : <User className="h-3.5 w-3.5 text-muted-foreground" />
              }
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground truncate">{user.name}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{user.role}</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className={cn(
            "w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs",
            isArabic ? "flex-row-reverse" : ""
          )}
        >
          <LogOut className="h-3.5 w-3.5" />
          {isArabic ? "خروج" : "Logout"}
        </Button>
      </div>
    </aside>
  );
}
