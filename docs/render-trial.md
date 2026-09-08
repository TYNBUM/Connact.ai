# Render 免费试用部署

使用同一地区的两个 Free Docker Web Service 和一个 Free PostgreSQL：

## 当前试用实例（2026-09-08）

- 网站：<https://connact-ai.onrender.com>
- 后端：<https://connact-ai-api.onrender.com>；健康检查 `/api/health`。
- 地区：Singapore。前端、后端、PostgreSQL 均为 Free。
- 数据库：`connact-ai-db`，Render 显示到期日为 2026-10-08。
- 两个 Web Service 使用账号已连接的 GitHub `TYNBUM/Connact.ai`，跟踪 `main`，分别以 `frontend`、`backend` 为根目录自动部署。
- 已验证：网站 HTTP 200；后端和前端代理健康检查返回 PostgreSQL 正常；会话处于邀请登录模式；未登录访问配置返回 401，未允许的 Origin 返回 403。
- 提供商 API Key 尚待授权导入；不能视为 AI/查人端到端验收通过。

| 服务 | Root Directory | Dockerfile | 环境配置 |
| --- | --- | --- | --- |
| Connact.ai 前端 | `frontend` | `./Dockerfile` | `BACKEND_URL` 指向后端 HTTPS 地址，`PORT=10000` |
| Connact.ai 后端 | `backend` | `./Dockerfile` | 见下方列表 |
| PostgreSQL | 无 | 无 | Free，连接串仅保存在 Render 环境变量中 |

后端环境变量：

- `DATABASE_URL`：Render PostgreSQL 的内部连接串。应用自动将 `postgres://` / `postgresql://` 转为已安装的 `postgresql+psycopg://` 驱动。
- `AUTH_MODE=invite`，`PUBLIC_ORIGIN` 必须为实际前端 HTTPS 地址。
- `PORT=10000`，`UPLOAD_DIR=/app/data/uploads`。Render 自带的 `RENDER_EXTERNAL_HOSTNAME` 自动加入后端 Host 白名单。
- `AI_MODE=live`、`PEOPLE_MODE=live`、`PUBLIC_SEARCH_MODE=live`。
- `AI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1`、`AI_PROVIDER=bailian`、`AI_MODEL=qwen-plus`、`AI_MODELS=qwen-plus,qwen-turbo,qwen-max`。
- `AI_API_KEY`、`SERPAPI_API_KEY`、`APIFY_API_KEY`、可选 `APOLLO_API_KEY`，仅导入服务端 Environment，不能进入仓库或前端。

前端在未显式配置 `PUBLIC_ORIGIN` 时使用 Render 的 `RENDER_EXTERNAL_URL` 校验 Origin。
后端 Docker 启动时先迁移数据库，然后创建首次邀请码（若有配置），最后启动单 API 进程和后台 worker。

## 免费实例的首次邀请

Free 实例没有 Shell/one-off jobs。初次部署可以设置：

- `BOOTSTRAP_INVITE_EMAIL`：可选的指定登录邮箱。留空或不设置时，邀请码允许任意邮箱注册。
- `BOOTSTRAP_INVITE_TOKEN_HASH`：本地产生的强随机邀请码的 SHA-256；原始邀请码仅交给用户，不放进服务器日志。
- `BOOTSTRAP_INVITE_MAX_USES`：最多成功注册人数，默认 1；本次四人共享试用配置为 4。

这些变量仅创建一个七天有效的邀请码，不创建账号或设置密码。用户通过网页设置自己的密码。邀请码区分大小写，每个账号使用独立邮箱并拥有独立工作区。
成功注册才消耗名额；重复邮箱或失败的注册不消耗名额。PostgreSQL 在注册事务中锁定邀请码记录，防止并发注册超出人数上限。
重启不会续期、重置已用名额或重新开启已耗尽的邀请码；绑定邮箱且该邮箱账号已存在时不再创建。完成注册后可删除这些环境变量。
部署不导入本地工作区数据。

## 免费试用限制

Free Web Service 会在 15 分钟无流量后休眠，冷启动约需一分钟；两个 Web Service 共享工作区每月 750 小时额度。
本地上传文件在重启/重新部署/休眠后丢失，待处理的解析可能需要重新上传；已存入 PostgreSQL 的联系人、草稿和解析结果仍受数据库生命周期约束。
Free PostgreSQL 30 天后到期，不能用于长期保存真实客户数据。模型与搜索提供商仍按各自用量计费。

若在其他账号使用 Public Git Repository 方式连接，普通公开仓库部署不保证自动随 push 更新，需要从 Render 手动部署最新提交。当前实例使用已有 GitHub 连接。

参考：[Render 免费实例](https://render.com/docs/free)、[Docker 部署](https://render.com/docs/docker)、[默认环境变量](https://render.com/docs/environment-variables)。
