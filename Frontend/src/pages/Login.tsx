import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Lock, User, AlertCircle } from "lucide-react";
import rajacLogo from "@/assets/rajac-logo-hd.png";

export default function Login() {
  const { login } = useAuth();
  const { isArabic, t } = useLanguage();
  const navigate = useNavigate();

  const [form, setForm]     = useState({ username: "", password: "" });
  const [error, setError]   = useState("");
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir={isArabic ? "rtl" : "ltr"}>
      <div className="w-full max-w-sm space-y-6">

        {/* Logo + title */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="h-20 w-20 bg-primary/10 rounded-2xl border border-primary/20 flex items-center justify-center">
              <img src={rajacLogo} alt="RAJAC" className="h-16 w-16 object-contain" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary">{t("نظام المالية", "Financial System")}</h1>
            <p className="text-sm text-muted-foreground">{t("مدارس راجاك للغات", "RAJAC Language Schools")}</p>
          </div>
        </div>

        {/* Login card */}
        <Card className="bg-gradient-card border-primary/20 shadow-xl">
          <CardHeader className="pb-2">
            <h2 className="text-lg font-semibold text-center text-foreground">
              {t("تسجيل الدخول", "Sign In")}
            </h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">{t("اسم المستخدم", "Username")}</Label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    autoComplete="username"
                    placeholder={t("اسم المستخدم", "Username")}
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="pr-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t("كلمة المرور", "Password")}</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="pr-10"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90">
                {loading ? t("جاري الدخول...", "Signing in...") : t("دخول", "Sign In")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          {t("نسيت كلمة المرور؟ تواصل مع المدير", "Forgot password? Contact administrator")}
        </p>
      </div>
    </div>
  );
}
