import { useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../convex/_generated/api";

type AuthStep = "signIn" | "signUp";

export default function SignInPage() {
  const { signIn } = useAuthActions();
  const navigate = useNavigate();
  const bootstrapAvailable = useQuery(api.auth.isBootstrapAvailable);
  const [step, setStep] = useState<AuthStep>("signIn");
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsSubmitting(true);

    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("email", email.trim().toLowerCase());
    data.set("flow", step);

    try {
      const authenticated = await signIn("password", data);
      if (authenticated) {
        navigate("/", { replace: true });
      } else if (step === "signUp") {
        setStep("signIn");
        setNotice("Tài khoản đã được tạo. Hãy đăng nhập bằng email và mật khẩu vừa đăng ký.");
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Không thể hoàn tất yêu cầu.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const title = step === "signUp" ? "Khởi tạo tài khoản editor" : "Đăng nhập editor";

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <Link className="auth-back-link" to="/">← Quay lại trang xem</Link>
        <div className="auth-brand-mark" aria-hidden="true">L</div>
        <p className="auth-eyebrow">LUNCH LEDGER</p>
        <h1 id="auth-title">{title}</h1>
        <p className="auth-description">Chỉ editor được phép thay đổi hóa đơn, thành viên và cấu hình.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {(step === "signIn" || step === "signUp") && (
            <label>
              Email
              <input autoComplete="email" type="email" name="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="editor@example.com" />
            </label>
          )}

          {(step === "signIn" || step === "signUp") && (
            <label>
              Mật khẩu
              <input autoComplete={step === "signIn" ? "current-password" : "new-password"} type="password" name="password" minLength={8} required />
            </label>
          )}

          {step === "signUp" && (
            <label>
              Mã khởi tạo một lần
              <input type="password" name="bootstrapCode" autoComplete="off" required />
            </label>
          )}

          {error && <p className="auth-message auth-error" role="alert">{error}</p>}
          {notice && <p className="auth-message" role="status">{notice}</p>}
          <button className="auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Đang xử lý…" : step === "signIn" ? "Đăng nhập" : "Tạo editor"}
          </button>
        </form>

        <div className="auth-secondary-actions">
          {step === "signIn" && (
            <>
              {bootstrapAvailable && (
                <button type="button" onClick={() => { setStep("signUp"); setNotice(""); setError(""); }}>Khởi tạo editor lần đầu</button>
              )}
            </>
          )}
          {step === "signUp" && (
            <button type="button" onClick={() => { setStep("signIn"); setNotice(""); setError(""); }}>Quay lại đăng nhập</button>
          )}
        </div>
      </section>
    </main>
  );
}
