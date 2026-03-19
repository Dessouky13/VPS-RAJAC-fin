import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Lock, User, AlertCircle, Languages } from "lucide-react";
import rajacLogo from "@/assets/rajac-logo-hd.png";

export default function Login() {
  const { login } = useAuth();
  const { isArabic, setIsArabic, t } = useLanguage();
  const navigate = useNavigate();

  const [form, setForm]       = useState({ username: "", password: "" });
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.password) {
      setError(t("يرجى إدخال اسم المستخدم وكلمة المرور", "Please enter username and password"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      await login(form.username, form.password);
      navigate("/");
    } catch (err: any) {
      setError(err.message || t("فشل تسجيل الدخول", "Login failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, hsl(123 100% 7%) 0%, hsl(123 70% 18%) 50%, hsl(200 60% 20%) 100%)"
      }}
      dir={isArabic ? "rtl" : "ltr"}
    >
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)",
        backgroundSize: "60px 60px"
      }} />

      {/* Language toggle — top right */}
      <div className={`absolute top-4 ${isArabic ? "left-4" : "right-4"}`}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsArabic(!isArabic)}
          className="gap-2 text-white/80 hover:text-white hover:bg-white/10 border border-white/20"
        >
          <Languages className="h-4 w-4" />
          <span className="text-xs">{isArabic ? "English" : "العربية"}</span>
        </Button>
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Logo + title above card */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <div className="h-20 w-20 bg-white/10 backdrop-blur rounded-2xl border border-white/20 flex items-center justify-center shadow-2xl">
              <img src={rajacLogo} alt="RAJAC" className="h-14 w-14 object-contain" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white">{t("نظام المالية", "Financial System")}</h1>
          <p className="text-sm text-white/60 mt-0.5">{t("مدارس راجاك للغات", "RAJAC Language Schools")}</p>
        </div>

        {/* Login card */}
        <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur dark:bg-card/95">
          <CardHeader className="pb-2 pt-6">
            <h2 className="text-base font-semibold text-center text-foreground">
              {t("تسجيل الدخول إلى حسابك", "Sign in to your account")}
            </h2>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">{t("اسم المستخدم", "Username")}</Label>
                <div className="relative">
                  <User className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${isArabic ? "right-3" : "left-3"}`} />
                  <Input
                    autoComplete="username"
                    placeholder={t("اسم المستخدم", "Username")}
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className={`h-10 text-sm ${isArabic ? "pr-10" : "pl-10"}`}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">{t("كلمة المرور", "Password")}</Label>
                <div className="relative">
                  <Lock className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${isArabic ? "right-3" : "left-3"}`} />
                  <Input
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className={`h-10 text-sm ${isArabic ? "pr-10" : "pl-10"}`}
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span className="text-xs">{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-10 bg-primary hover:bg-primary/90 font-semibold mt-2"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    {t("جاري الدخول...", "Signing in...")}
                  </span>
                ) : (
                  t("دخول", "Sign In")
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-white/40 mt-4">
          {t("نسيت كلمة المرور؟ تواصل مع المدير", "Forgot password? Contact administrator")}
        </p>
      </div>
    </div>
  );
}
