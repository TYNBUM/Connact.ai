# Render 免费试用部署

使用同一地区的两个 Free Docker Web Service 和一个 Free PostgreSQL：

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

- `BOOTSTRAP_INVITE_EMAIL`：用户指定的登录邮箱。
- `BOOTSTRAP_INVITE_TOKEN_HASH`：本地产生的强随机邀请码的 SHA-256；原始邀请码仅交给用户，不放进服务器日志。

这两个变量仅创建一个七天有效的邀请码，不创建账号或设置密码。用户通过网页设置自己的密码。
重启不会续期或重新开启已使用的邀请码；已有该邮箱账号时不再创建。注册后可删除这两个环境变量。
部署不导入本地工作区数据。

## 免费试用限制

Free Web Service 会在 15 分钟无流量后休眠，冷启动约需一分钟；两个 Web Service 共享工作区每月 750 小时额度。
本地上传文件在重启/重新部署/休眠后丢失，待处理的解析可能需要重新上传；已存入 PostgreSQL 的联系人、草稿和解析结果仍受数据库生命周期约束。
Free PostgreSQL 30 天后到期，不能用于长期保存真实客户数据。模型与搜索提供商仍按各自用量计费。

公开仓库直接连接不会授予 Render 新的 GitHub 账号权限；普通 Public Git Repository 部署不保证自动随 push 更新，需要从 Render 手动部署最新提交。

参考：[Render 免费实例](https://render.com/docs/free)、[Docker 部署](https://render.com/docs/docker)、[默认环境变量](https://render.com/docs/environment-variables)。
