# Connact.ai

第一阶段可运行 MVP。Next.js / React / TypeScript / Tiptap + FastAPI / SQLAlchemy / Alembic + PostgreSQL。

已实现：简历解析或手动画像 → 人员搜索 → 有来源依据的推荐 → 保存联系人 → 生成和编辑邮件 → 自动保存 → 最终变量预览 → 复制内容。

不包含 Gmail 登录、发送、自动跟进、发送队列或调度器。未来模块只有明确的 Coming Soon 页面。

## 启动

### Docker Compose（标准方式）

需要 Docker Engine / Docker Desktop 和 Compose v2。在项目根目录：

```bash
cp .env.example .env
docker compose up --build -d
# 可选：导入虚构演示数据；仅允许在 Mock 模式执行
docker compose exec backend python -m app.seed
```

打开 <http://127.0.0.1:3100>，API 文档在 <http://127.0.0.1:8000/docs>。

```bash
docker compose logs -f backend frontend
docker compose down
```

数据库和上传文件分别保存在 `postgres_data`、`uploads` 持久卷中。`down` 保留数据；不要在需要保留数据时执行 `down -v`。

### 本地方式（无 Docker）

需要 Node.js 22+、Python 3.12（可用 `PYTHON` 指定解释器）以及首次安装依赖时的网络。本仓库附有仅用于开发的 embedded-postgres 启动器，它启动的是**真实 PostgreSQL 服务**，不是内存数据库或 SQLite 替代品。

```bash
chmod +x scripts/dev.sh
SEED_DEMO=1 ./scripts/dev.sh
```

之后运行 `./scripts/dev.sh` 即可。数据持久化在 `data/postgres`，文件在 `data/uploads`；按 Ctrl+C 停止当前脚本启动的进程。端口为 3100 / 8000 / 54329。

如果已有 PostgreSQL，在 `.env` 设置 `DATABASE_URL` 后运行：

```bash
LOCAL_POSTGRES=0 ./scripts/dev.sh
```

手动启动也可：

```bash
# 终端 1：项目内 PostgreSQL
cd frontend
npm ci
node local-postgres.mjs

# 终端 2：后端，在项目根目录开始
python3.12 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
cd backend
.venv/bin/alembic upgrade head
.venv/bin/python -m app.seed
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000

# 终端 3：前端
cd frontend
npm run dev
```

此开发模式只适用于本地个人工作区：没有完整认证、会话或多用户权限体系。Compose 仅映射到 `127.0.0.1`；后端同时校验 Host 和 Origin。**不要作为公共部署认证方案，不要通过公网反向代理暴露。**

## 演示与使用

种子命令创建 1 个虚构画像、3 位已保存的虚构联系人及 2 份草稿；重复运行不会再创建。Mock 搜索共 16 位虚构人物，邮箱采用保留的 `.example` 域名。没有真实人物，也没有伪造的公开资料链接。

1. **Personas**：新建或选择画像，上传 `demo/sample-resume.pdf` / `demo/sample-resume.docx`，检查字段、编辑、保存；也可完全手填。
2. **People Search**：按职位、公司、地区、关键词、金融领域搜索。选画像后点击 **Recommend first 5**；也可在详情中单独推荐一人。
3. **联系人详情**：查看资料、来源、获取日期、画像版本和推荐依据；保存，或分别触发邮箱补充/公开线索。重复保存会提示已存在。
4. **Email Studio**：从联系人开始写信，或独立新建空白草稿。选择联系目的和写作起点，再生成、缩短或调整语气。可直接手动编辑。
5. 停止输入约 650 ms 后自动保存到服务端；页面内导航会先等待保存。可点击 **Save draft**。失败时保留本地编辑并提示，不显示保存成功。
6. **Preview & copy**：替换变量，检查缺失项，复制主题/正文/全部。缺失变量不可标记为 Reviewed & ready。缺邮箱不妨碍建草稿；Reviewed 仅表示内容审核，不表示发送、邮箱验证或实际可投递。

界面右上角可切换英文 / 简体中文；邮件的 English / 简体中文在编辑器中独立控制，不随界面语言变化。界面语言存于浏览器；业务数据全部存于服务端。

变量：`{{name}}`（联系人全名）、`{{company}}`、`{{title}}`、`{{school}}`（联系人学校）、`{{sender_name}}`（画像姓名）。未知、未完成或缺值变量都会明确标记。

## API 配置

所有密钥只放在根目录 `.env`，不进入浏览器和 Git。修改后重启后端。三个模式独立、显式设置，不根据请求是否成功动态切换：

| 服务 | Mock | 真实模式设置 |
| --- | --- | --- |
| 人员搜索 / 邮箱补充 | `PEOPLE_MODE=mock` | `PEOPLE_MODE=live` + `APOLLO_API_KEY` |
| 公开资料线索 | `PUBLIC_SEARCH_MODE=mock` | `PUBLIC_SEARCH_MODE=live` + `SERPAPI_API_KEY` |
| 画像提取 / 推荐 / 写作 | `AI_MODE=mock` | `AI_MODE=live` + `AI_API_KEY`、`AI_BASE_URL`、`AI_MODEL` |

AI 接口采用可配置的 Chat Completions 兼容格式，需支持 `response_format: json_object` 和 `max_completion_tokens`。默认配置示例指向 OpenAI；模型名可按实际账号可用模型修改。缺密钥返回 503，上游权限/请求错误返回明确 502/429；不会偷偷退回 Mock。

- Apollo 搜索：`POST /api/v1/mixed_people/api_search`。职位 → `person_titles`，地区 → `person_locations`，公司域名 → `q_organization_domains_list`，公司名称/金融领域/关键词 → `q_keywords`。**公司名称和金融领域是关键词匹配，不是精确行业分类。** 姓名或地区若被提供商隐藏，会保留其受限状态，不推测补齐。
- Apollo 邮箱补充：单独 `POST /api/v1/people/match`；不请求私人邮箱和电话。是否返回邮箱取决于真实数据和账号权限，可能消耗 Apollo 额度。
- SerpAPI：`GET /search.json`，最多保存 3 条公开搜索结果；保留链接、摘要和获取日期，并标记待核实线索。不据此自动合并学校或共同经历。
- 每页最多 10 人；一次推荐最多 5 人。邮箱与公开线索补充均由用户单独点击。相同画像版本/联系人快照的推荐复用缓存；邮箱补充缓存复用。每个真实服务默认最多 20 次调用/分钟，限制发生在服务端，单进程运行。
- Mock AI 为可复现的规则生成器，有明确标记，并非调用真实大模型。Mock 简历提取按中英文章节标题提取；布局不标准时可能只提取部分字段，需检查原文手填。不会编造缺失职业信息。

官方适配依据（2026-09-06 查阅）：[Apollo Search](https://docs.apollo.io/reference/people-api-search)、[Apollo Enrichment](https://docs.apollo.io/reference/people-enrichment)、[SerpAPI](https://serpapi.com/search-api)、[Chat Completions](https://developers.openai.com/api/reference/cli/resources/chat/subresources/completions)。真实账号的接口权限、费用和可返回字段以提供商为准。

## Apollo 与 LinkedIn 公开资料的协同设计

Apollo 提供结构化人员搜索与按需邮箱补充；SerpAPI 通过 Google 检索 LinkedIn 公开档案，补充职业背景线索。Apollo 的姓名、机构或档案 URL 用于定位 LinkedIn；核对后的 LinkedIn 信息反向辅助 Apollo 匹配与补充。两路结果关联同一 Contact，分别保留来源、时间与冲突。搜索摘要只能标为待核实线索，不能自动认定同一人、覆盖字段或用于校友陈述。这是双源协同的目标设计：当前 MVP 仍使用通用 Google 查询，尚未实现 LinkedIn 定向检索、反向匹配及自动交叉核验。

SerpAPI 是搜索接口，LinkedIn 是公开资料来源。目标查询示例为 `site:linkedin.com/in/ "姓名" "机构"`，通过 SerpAPI 的 Google Search API 执行，不使用 LinkedIn 登录或直接调用 LinkedIn API。检索覆盖取决于公开页面是否被索引；搜索命中、身份核对和事实确认分别记录。

## 代码边界与数据关系

```text
frontend/components/       六个可用页面、共享 UI、联系人抽屉、Tiptap 编辑器
frontend/lib/              类型、请求客户端、语言上下文、串行自动保存
frontend/app/api/          同源服务端代理；不在客户端暴露供应商调用
backend/app/models.py      Shared Core 持久模型
backend/app/db.py          WorkspaceRepository：统一工作区数据访问
backend/app/routers/       Personas / Contacts / Finance / Drafts
backend/app/services/      文件解析、变量预览、联系人证据与匹配逻辑
backend/app/providers/     四类 Provider 协议与 Mock / Live 实现
backend/alembic/           已生成的可升级/回滚迁移
backend/tests/             业务、隔离、异常、适配器契约测试
frontend/tests/            浏览器闭环测试
demo/                     可上传的虚构简历与无文本 PDF
```

```mermaid
erDiagram
  Workspace ||--o{ Persona : scopes
  Persona ||--o{ PersonaRevision : versions
  Workspace ||--o{ UploadedDocument : protects
  Persona ||--o{ UploadedDocument : imports
  Workspace ||--o{ Contact : scopes
  Contact ||--o{ ContactDomainProfile : domains
  Contact ||--o{ SourceEvidence : cites
  Contact ||--o{ MatchAssessment : matches
  PersonaRevision ||--o{ MatchAssessment : evaluates
  Contact ||--o{ Draft : recipient
  Persona ||--o{ Draft : sender
```

业务表均有 `workspace_id`，不接受客户端指定工作区。当前工作区由后端配置确定，查询和写入经 `WorkspaceRepository`；引用外键也先通过当前工作区查找。联系人提供商 ID 在工作区内唯一，保存动作更新 `saved` 标记。搜索到但未保存的联系人保留为后台候选记录，以便关联来源和匹配，只有 `saved=true` 显示在 Contacts。

Finance 扩展存放在 `ContactDomainProfile(domain="finance")`；Academic 只保留页面/领域扩展位置。画像修改生成不可变 `PersonaRevision`；`MatchAssessment` 引用画像版本、联系人快照指纹和来源 ID。AI 只选择已有资料中的比较维度，推荐文本由服务端用确切字段值构造，避免生成未经证实的共同经历。旧版本推荐不用于新画像。

Draft 关联联系人和画像、记录画像版本与乐观锁 `revision`。写入通过数据库行锁校验版本，不默默覆盖其他标签页的修改。修改画像/联系人后关联草稿退回 Draft，并要求重新检查。服务端清洗富文本和链接协议；预览替换时转义字段，防止将外部资料当作 HTML。

上传只允许 PDF/DOCX、8 MB、PDF 30 页和提取文本 50,000 字符；加密/损坏/无文字 PDF 会失败，当前不做 OCR。存储采用随机文件名、私有目录和文件权限，无公开静态文件路由。下载必须通过工作区范围内的文档 ID。

Gmail、Inbox、Campaign 后续可直接引用现有 Contact 和 Draft；本阶段没有预制发送队列、Redis、调度器或虚假账户连接逻辑。

## 验证

```bash
# 默认使用显式隔离的临时 SQLite 测试库；绝不清空应用数据库
cd backend
.venv/bin/python -m pytest -q

# 验证真实 PostgreSQL 时，必须传专用测试库，会重建其中业务表
TEST_DATABASE_URL=postgresql+psycopg://meridian:meridian@127.0.0.1:54329/meridian_test .venv/bin/python -m pytest -q

cd ../frontend
npm run typecheck
npm run build
npx playwright install chromium
# 先启动前后端；浏览器测试会创建 UI test / Uploaded demo 记录
npm run test:e2e
```

具体验证范围和结果见 [docs/verification.md](docs/verification.md)。Apollo / SerpAPI / AI 真适配器有契约测试，但本次未提供真实 API 密钥，因此不声称完成真实服务端到端验证。当前机器没有 Docker，因此不声称已运行 Compose 容器；本地 PostgreSQL + FastAPI + Next.js 已实际启动并验证。

## 项目命名与设计文件

产品名称统一为 **Connact.ai**。详见[命名规范](docs/naming.md)；最新[设计交付包](outputs/connact-ai-design-package/README.md)包含 Word、Demo、功能表及四期 Prompt。
