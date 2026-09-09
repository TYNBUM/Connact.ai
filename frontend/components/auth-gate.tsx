"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { api, post, errorText, ApiError } from "@/lib/api";

type Session = {
  mode: "local" | "invite" | "open";
  authenticated: boolean;
  email: string | null;
  workspace_id: string | null;
};

// Six reads, at most 15 seconds each, and 60 seconds of backoff: about 2.5 minutes.
const sessionRetryDelays = [5000, 10000, 15000, 15000, 15000];

function waitForRetry(delay: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, delay);
    signal.addEventListener("abort", finish, { once: true });
    if (signal.aborted) finish();
  });
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invitation, setInvitation] = useState("");
  const [retryAttempt, setRetryAttempt] = useState(0);
  const activeLoad = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    activeLoad.current?.abort();
    const controller = new AbortController();
    activeLoad.current = controller;
    setError("");
    setRetryAttempt(0);
    for (let attempt = 0; attempt <= sessionRetryDelays.length; attempt++) {
      if (controller.signal.aborted) return;
      const request = new AbortController();
      const abort = () => request.abort();
      controller.signal.addEventListener("abort", abort, { once: true });
      const timeout = setTimeout(abort, 15000);
      let failure: unknown;
      try {
        const next = await api<Session>("/auth/session", {
          signal: request.signal,
        });
        if (controller.signal.aborted) return;
        if (
          !next ||
          !["local", "invite", "open"].includes(next.mode) ||
          typeof next.authenticated !== "boolean"
        )
          throw new ApiError(
            "The service returned an invalid response. Please retry. / 服务响应异常，请重试。",
            true,
          );
        setSession(next);
        setError("");
        setRetryAttempt(0);
        return;
      } catch (error) {
        if (controller.signal.aborted) return;
        failure = request.signal.aborted
          ? new ApiError(
              "The service is taking too long to respond. Please retry. / 服务响应超时，请重试。",
              true,
            )
          : error;
      } finally {
        clearTimeout(timeout);
        controller.signal.removeEventListener("abort", abort);
      }
      if (
        !(failure instanceof ApiError && failure.retryable) ||
        attempt === sessionRetryDelays.length
      ) {
        setError(errorText(failure));
        setRetryAttempt(0);
        return;
      }
      setRetryAttempt(attempt + 1);
      await waitForRetry(sessionRetryDelays[attempt], controller.signal);
    }
  }, []);
  useEffect(() => {
    void load();
    const expired = () => {
      void load();
    };
    window.addEventListener("connact-session-expired", expired);
    return () => {
      activeLoad.current?.abort();
      window.removeEventListener("connact-session-expired", expired);
    };
  }, [load]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post(joining ? "/auth/join" : "/auth/login", {
        email,
        password,
        ...(joining && session?.mode === "invite" ? { invitation } : {}),
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
            <p role={error ? "alert" : "status"}>
              {error ||
                (retryAttempt
                  ? `The service is starting or reconnecting… (${retryAttempt}/${sessionRetryDelays.length}) / 服务正在启动或正在重新连接… (${retryAttempt}/${sessionRetryDelays.length})`
                  : "Loading workspace… / 正在加载工作区…")}
            </p>
            {(error || retryAttempt > 0) && (
              <button
                className="button"
                onClick={() => {
                  void load();
                }}
              >
                {error ? "Retry / 重试" : "Retry now / 立即重试"}
              </button>
            )}
          </>
        ) : (
          <>
            <h1>{joining ? "Create your workspace" : "Welcome back"}</h1>
            <p>
              {joining
                ? session.mode === "invite"
                  ? "使用邀请创建独立工作区"
                  : "注册后即可使用独立工作区"
                : "登录你的工作区"}
            </p>
            <form onSubmit={submit}>
              <label>
                {joining ? "Email / 邮箱" : "Email or username / 邮箱或账号"}
                <input
                  required
                  type={joining ? "email" : "text"}
                  autoComplete={joining ? "email" : "username"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                Password / 密码
                <input
                  required
                  type="password"
                  minLength={joining ? 12 : 6}
                  maxLength={128}
                  autoComplete={joining ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {joining && (
                <>
                  <small>Use at least 12 characters. / 至少 12 个字符。</small>
                  {session.mode === "invite" && (
                    <label>
                      Invitation code / 邀请码
                      <input
                        required
                        autoComplete="off"
                        value={invitation}
                        onChange={(e) => setInvitation(e.target.value)}
                      />
                    </label>
                  )}
                  <small>
                    Administrators can view the information and files you save.
                    <br />
                    平台管理员可以查看你保存的信息和上传的文件。
                  </small>
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
                : session.mode === "invite"
                  ? "Have an invitation? Create account / 邀请注册"
                  : "Create account / 免费注册"}
            </button>
            <small>
              Account access issues? Contact the administrator.
              <br />
              账户访问遇到问题，请联系管理员。
            </small>
          </>
        )}
      </section>
    </main>
  );
}
