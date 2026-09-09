import type { Metadata } from "next";
import PublicSite, {
  SupportContact,
  publicStyles as styles,
} from "@/components/public-site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy policy — Connact.ai",
  description:
    "How Connact.ai uses Google sign-in information, workspace content, connected providers, and account data.",
};

export default function PrivacyPage() {
  return (
    <PublicSite current="privacy">
      <article className={styles.policy}>
        <header className={styles.policyHeader}>
          <p className={styles.eyebrow}>Your information</p>
          <h1>Privacy policy</h1>
          <p className={styles.lead}>
            This policy explains how the current Connact.ai service handles your
            account and workspace information.
          </p>
          <p className={styles.policyDate}>
            Last updated: September 10, 2026 ·{" "}
            <a href="#chinese" lang="zh-CN">
              中文说明 ↓
            </a>
          </p>
        </header>

        <div className={styles.policyCallout}>
          <strong>Google sign-in is for identity only.</strong>
          <p>
            Signing in does not give Connact.ai permission to read your Gmail
            messages, access your inbox, or send email on your behalf.
          </p>
        </div>

        <section>
          <h2>1. Who to contact</h2>
          <p>
            This policy applies to the Connact.ai application and its public
            pages. For privacy questions, account access, corrections, or
            deletion requests, contact the service administrator:{" "}
            <SupportContact />
          </p>
        </section>

        <section>
          <h2>2. Information we receive and store</h2>
          <p>
            <strong>Account information.</strong> Google sign-in requests the
            OpenID, email, and basic profile permissions. Google may return
            basic profile details with the sign-in response. The current
            implementation stores your verified email address and Google&apos;s
            stable account identifier to recognize your account; it does not
            persist your Google name or profile photo. We also store your
            workspace association, account creation and last sign-in times, and
            administrator status. Existing password accounts have a password
            hash, not a plain-text password.
          </p>
          <p>
            <strong>Workspace content.</strong> This includes information you
            enter or upload, such as resumes and other documents, extracted
            document text, personas and their revisions, contacts, professional
            profiles, source evidence, notes, tags, search queries, email
            drafts, writing instructions, AI suggestions, reusable templates,
            and sequence plans. Processing jobs may retain input snapshots,
            results, provider and model details, timestamps, and error
            information.
          </p>
          <p>
            <strong>Session and technical information.</strong> The service uses
            cookies for login sessions and temporary sign-in protection. The
            database stores hashed session identifiers and temporary OAuth state
            records. Your browser stores preferences such as the display theme.
            The application and hosting infrastructure process request metadata
            and operational logs to serve requests and diagnose errors.
          </p>
        </section>

        <section>
          <h2>3. How information is used</h2>
          <p>
            We use account information to authenticate you and associate you
            with your workspace. Workspace information supports the features you
            use: organizing personas, searching for people, preparing profile
            details, saving contacts, producing writing suggestions, and
            maintaining drafts and outreach plans. Session and technical
            information supports account security, service operation, and
            troubleshooting.
          </p>
          <p>
            Google identity information is used for account access. The OAuth
            implementation verifies the Google sign-in response and does not
            persist Google access tokens, refresh tokens, or ID tokens. It does
            not request Gmail permissions.
          </p>
        </section>

        <section>
          <h2>4. Connected services and data sharing</h2>
          <p>
            Connact.ai uses hosting and database infrastructure to run the
            service and store application data. Google processes sign-in
            requests under its own{" "}
            <a href="https://policies.google.com/privacy">privacy policy</a>.
            Public pages also load fonts from Google Fonts, which receives the
            browser requests needed to deliver those fonts.
          </p>
          <p>
            When live integrations are enabled, actions you initiate can send
            relevant information to the configured provider. People search can
            send search terms to SerpAPI and profile identifiers to Apify;
            preparing a search page can automatically retrieve details for the
            people on that page. A separate email lookup can send contact
            identifiers to Apollo. AI document processing and writing can send
            relevant document text, persona details, contact context, draft
            text, and instructions to the selected AI service.
          </p>
          <p>
            These providers process submitted information under their own terms
            and privacy policies. Available providers depend on the deployment
            configuration and your selected action or model. Avoid including
            information you do not want processed by those services.
          </p>
        </section>

        <section>
          <h2>5. Workspace access and administration</h2>
          <p>
            Ordinary account access is scoped to that account&apos;s workspace.
            Authorized service administrators can inspect user records and
            workspace data, including personas, contact details, drafts, job
            records, and uploaded documents. Administrators can download
            uploaded files. A personal workspace therefore does not mean that
            its contents are inaccessible to service administrators.
          </p>
        </section>

        <section>
          <h2>6. Retention, deletion, and your choices</h2>
          <p>
            Account and workspace records remain stored unless removed through
            an available application action or an administrator-assisted
            process. Some content has revisions, cached results, or processing
            records; removing or editing one item does not necessarily erase all
            related records. There is no automatic account-wide deletion feature
            in the current version.
          </p>
          <p>
            To request access, correction, or deletion, contact{" "}
            <SupportContact />. Include the account email and the scope of your
            request. The administrator may need to verify account ownership and
            explain which records can be removed and any remaining
            infrastructure copies. Do not send passwords, access tokens, or
            identity documents unless a specific verification method has first
            been agreed.
          </p>
          <p>
            You can sign out to end the current application session and revoke
            the Google connection in your{" "}
            <a href="https://myaccount.google.com/connections">
              Google Account settings
            </a>
            . Revoking Google access does not itself delete your Connact.ai
            records or necessarily end an existing Connact.ai session.
          </p>
        </section>

        <section>
          <h2>7. Changes to this policy</h2>
          <p>
            This page may be updated as the service changes. The date above
            identifies the current version. Any future Gmail connection would
            require separate permissions and an updated explanation of how that
            information is used.
          </p>
        </section>

        <section id="chinese" lang="zh-CN" className={styles.policyChinese}>
          <p className={styles.eyebrow}>中文说明</p>
          <h2>Connact.ai 如何处理你的信息</h2>
          <p>
            <strong>Google 登录：</strong>仅申请
            OpenID、邮箱和基本资料权限，用于确认身份。
            当前程序保存经验证的邮箱和 Google 稳定账号标识；不持久保存 Google
            姓名、头像或 access token、refresh token、ID token，不申请读取或发送
            Gmail 邮件的权限。
            应用会保存账号所属工作区、创建及最近登录时间、管理员状态，并通过
            Cookie 维持应用会话。
          </p>
          <p>
            <strong>工作区内容：</strong>
            保存你输入或上传的简历、文档及提取文本、个人背景及修订记录、
            联系人、职业资料、来源、备注、标签、搜索条件、邮件草稿、写作指令、AI
            建议、模板和联系计划。
            处理任务还可能保存输入快照、结果、服务商、模型、时间及错误信息。
          </p>
          <p>
            <strong>外部服务：</strong>
            启用真实服务时，你发起的操作会向已配置的服务商发送相应信息。
            搜索可使用 SerpAPI，搜索结果页的职业资料可自动通过 Apify
            补充；单独的邮箱查询可使用 Apollo。 文档解析与 AI
            写作可向所选模型服务商发送相关文档文本、个人背景、联系人资料、草稿和指令。
            托管及数据库服务负责运行和存储；公开页面通过 Google Fonts
            加载字体。这些外部服务有各自的隐私政策。
          </p>
          <p>
            <strong>管理员访问：</strong>
            普通账号只能访问自己的工作区；获授权的服务管理员可以查看账号及
            工作区记录，包括个人背景、联系人、草稿、任务和上传文档，并可下载上传的文件。
          </p>
          <p>
            <strong>保留与删除：</strong>
            账号和工作区信息会保留，除非通过已有功能或管理员协助删除。
            编辑或移除单个项目不一定清除历史版本、缓存及相关任务记录；当前没有账号级一键彻底删除功能。
            如需访问、更正或删除信息，请联系 <SupportContact chinese />
            ，说明账号邮箱与请求范围；管理员可能需要核验账号归属，并说明可删除范围及基础设施中可能剩余的副本。
            在 Google
            账号中撤销连接不会自动删除本站数据，也不一定结束已有本站登录会话。
          </p>
          <p>
            本说明于 2026 年 9 月 10 日更新。将来如接入
            Gmail，需要另行授权并更新数据用途说明。
          </p>
        </section>
      </article>
    </PublicSite>
  );
}
