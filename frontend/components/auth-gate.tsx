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
  provider?: "password" | "google";
  google_configured?: boolean;
};

const googleErrors: Record<string, string> = {
  google_cancelled:
    "Google sign-in was canceled. Please try again. / 已取消 Google 登录，请重试。",
  google_invalid_state:
    "This sign-in link has expired or belongs to another browser. Please try again. / 登录请求已失效，请重新登录。",
  google_expired:
    "This sign-in link has expired. Please try again. / 登录请求已过期，请重新登录。",
  google_invitation_required:
    "A valid invitation for this Google email is required. / 此 Google 邮箱需要有效的邀请码。",
  google_invitation_invalid:
    "This invitation is expired, fully used, or belongs to another email. / 邀请码已失效、名额已用完，或与 Google 邮箱不匹配。",
  google_invalid_identity:
    "Google identity could not be verified. Please sign in again. / 无法验证 Google 身份，请重新登录。",
  google_unavailable:
    "Google sign-in is temporarily unavailable. Please try again. / Google 登录暂时不可用，请重试。",
  google_identity_conflict:
    "This account is linked to a different Google identity. Please contact the administrator. / 此账号已绑定其他 Google 身份，请联系管理员。",
  google_link_required:
    "Sign in to your existing account before linking this Google account. Contact the administrator for help. / 请先登录原账号再绑定此 Google 账号；如无法登录，请联系管理员。",
  google_not_configured:
    "Google sign-in is awaiting server configuration. / Google 登录尚待服务端配置。",
};

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.04 46.98 31.88 46.98 24.55Z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.78-4.59l-7.98-6.19A23.85 23.85 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
      />
    </svg>
  );
}

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
  const [oauthError, setOauthError] = useState("");
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
    const url = new URL(window.location.href);
    const code = url.searchParams.get("error");
    if (code?.startsWith("google_")) {
      setOauthError(
        googleErrors[code] ||
          "Google sign-in could not be completed. Please try again. / Google 登录未完成，请重试。",
      );
      url.searchParams.delete("error");
      window.history.replaceState(
        window.history.state,
        "",
        url.pathname + url.search + url.hash,
      );
    }
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
  async function signInWithGoogle(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOauthError("");
    try {
      const result = await post<{ authorization_url: string }>(
        "/auth/google/start",
        {
          next:
            window.location.pathname +
            window.location.search +
            window.location.hash,
          invitation: session?.mode === "invite" ? invitation : "",
        },
      );
      const destination = new URL(result.authorization_url);
      if (destination.origin !== "https://accounts.google.com")
        throw new Error("The service returned an invalid Google sign-in URL.");
      window.location.assign(destination.href);
    } catch (failure) {
      setError(errorText(failure));
      setBusy(false);
    }
  }
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
        ) : session.provider === "google" ? (
          <>
            <h1>Welcome to Connact.ai</h1>
            <p>
              Sign in with your Google account.
              <br />
              使用 Google 账号登录你的独立工作区。
            </p>
            <form onSubmit={signInWithGoogle}>
              {session.mode === "invite" && (
                <label>
                  Invitation code for new accounts / 新账号邀请码
                  <input
                    autoComplete="off"
                    maxLength={200}
                    value={invitation}
                    onChange={(e) => setInvitation(e.target.value)}
                  />
                  <small>
                    Existing members can leave this empty. / 已有账号无需填写。
                  </small>
                </label>
              )}
              {(error || oauthError) && (
                <p className="error-text" role="alert">
                  {error || oauthError}
                </p>
              )}
              {!session.google_configured && (
                <p role="status">
                  Google sign-in is awaiting server configuration. Please
                  contact the administrator.
                  <br />
                  Google 登录尚待服务端配置，请联系管理员。
                </p>
              )}
              <button
                className="button google-sign-in"
                disabled={busy || !session.google_configured}
              >
                <GoogleMark />
                {busy
                  ? "Connecting… / 正在跳转…"
                  : "Continue with Google / 使用 Google 登录"}
              </button>
            </form>
            <small>
              Google verifies your identity; your saved information stays in
              your Connact.ai workspace.
              <br />
              Google 用于验证身份，资料保存在你的 Connact.ai 工作区。
            </small>
            <small>
              Administrators can view the information and files you save.
              <br />
              平台管理员可以查看你保存的信息和上传的文件。
            </small>
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
