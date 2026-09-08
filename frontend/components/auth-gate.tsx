"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api, post, errorText } from "@/lib/api";

type Session = {
  mode: "local" | "invite";
  authenticated: boolean;
  email: string | null;
  workspace_id: string | null;
};

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invitation, setInvitation] = useState("");
  const load = () =>
    api<Session>("/auth/session")
      .then(setSession)
      .catch((e) => setError(errorText(e)));
  useEffect(() => {
    void load();
    const expired = () => {
      void load();
    };
    window.addEventListener("connact-session-expired", expired);
    return () => window.removeEventListener("connact-session-expired", expired);
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post(joining ? "/auth/join" : "/auth/login", {
        email,
        password,
        ...(joining ? { invitation } : {}),
      });
      setPassword("");
      setInvitation("");
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  if (session?.authenticated) return <>{children}</>;
  return (
    <main className="auth-page">
      <section className="auth-card">
        <img src="/connact-logo-dark.svg" alt="Connact.ai" width={190} />
        {!session ? (
          <>
            <p>{error || "Loading workspace… / 正在加载工作区…"}</p>
            {error && (
              <button
                className="button"
                onClick={() => {
                  setError("");
                  void load();
                }}
              >
                Retry / 重试
              </button>
            )}
          </>
        ) : (
          <>
            <h1>{joining ? "Create your workspace" : "Welcome back"}</h1>
            <p>{joining ? "使用邀请创建独立工作区" : "登录你的工作区"}</p>
            <form onSubmit={submit}>
              <label>
                Email / 邮箱
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                Password / 密码
                <input
                  required
                  type="password"
                  minLength={12}
                  maxLength={128}
                  autoComplete={joining ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {joining && (
                <>
                  <small>Use at least 12 characters. / 至少 12 个字符。</small>
                  <label>
                    Invitation code / 邀请码
                    <input
                      required
                      autoComplete="off"
                      value={invitation}
                      onChange={(e) => setInvitation(e.target.value)}
                    />
                  </label>
                </>
              )}
              {error && (
                <p className="error-text" role="alert">
                  {error}
                </p>
              )}
              <button className="button primary" disabled={busy}>
                {busy
                  ? "Please wait…"
                  : joining
                    ? "Create account / 注册"
                    : "Sign in / 登录"}
              </button>
            </form>
            <button
              className="button ghost"
              onClick={() => {
                setJoining(!joining);
                setError("");
              }}
            >
              {joining
                ? "Already have an account? Sign in / 登录"
                : "Have an invitation? Create account / 邀请注册"}
            </button>
            <small>
              Account access issues? Contact the person who invited you.
              <br />
              账户访问遇到问题，请联系邀请人。
            </small>
          </>
        )}
      </section>
    </main>
  );
}
