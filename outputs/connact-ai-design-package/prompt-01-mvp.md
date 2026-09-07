请开发 Connact.ai 第 1 期：简历找人与 AI 写作。

已确认约束：个人工作区可连接多个 Gmail，团队仅预留；默认英文界面并支持简体中文，邮件语言独立；Finance 是核心，Academic 仅占位与契约；四期均不做自动序列。所有模块独立可用，不强制分步向导。不要把 Mock 或 HTML 演示当作真实集成。
管理员后端已列为 Soon 待排期，不属于 P1–P4 的实现范围；只保留 Coming Soon 入口与范围说明，不开放真实管理操作。平台管理员与个人工作区 Owner 是不同角色。
先检查工作区、AGENTS.md 和已实现代码，给出简短实施顺序后直接开发。延续已有数据和模块，不重建整个项目。第三方能力查当前官方文档；没有凭据可显式 Mock，真实失败不能偷偷回退模拟。交付代码、迁移、启动说明、关键验证及真实未验证项。涉及真实发信仅用用户指定测试收件人。

本次只开发第一期最小 MVP：上传简历/手动画像 → 搜索金融联系人 → 看推荐理由 → 保存联系人 → AI 写信 → 编辑、变量预览和保存/复制草稿。

布局：专业 B2B 工作台，左导航、顶部上下文、主内容区及联系人抽屉。Dashboard、Finance、Personas、People Search、Contacts、Email Studio 可用。Academic、Templates、Mailboxes、Inbox、Campaigns、Analytics 为明确 Coming Soon。画像不是搜索或手写草稿的强制前置。

画像：文本型 PDF/DOCX，10 MB 上限，私有存储；提取教育/工作/技能/金融领域/地区/职业目标。保留原文证据，用户校对确认后建立版本。扫描件未支持时说明限制；支持手填及多个画像。

搜索：后端 Apollo 提供结构化人员搜索与按需 enrichment；SerpAPI 通过 Google 定向检索 LinkedIn 公开档案（如 site:linkedin.com/in/ 加姓名与机构），不直接调用 LinkedIn API。两者围绕同一 Contact 相互补充：Apollo 信息定位 LinkedIn，核对后的 LinkedIn URL/职业信息反向辅助 Apollo 匹配；现有适配器只有通用搜索与 Apollo ID 补充，定向查询及反向匹配需实现后验证。独立保留来源与获取时间，摘要保持待核实，冲突不覆盖，不按同名自动合并。实现职位/机构/地区/关键词分页、来源和时间、有限批量补充。邮箱未知如实显示。基于选定画像及来源生成简短推荐理由，不编造校友关系。保存按提供商 ID 去重，支持手工联系人、标签和备注。

AI 写作：在联系人和画像基础上设置目的、CTA、语言、语气、长度。右侧显示可用证据与缺口，允许选取用于写信的事实。生成结构化 subject/body/claims/warnings，在建议区展示，不覆盖正文。支持比较、采纳、丢弃、撤销与局部缩短/改写；建议绑定草稿 revision，过期结果不覆盖新稿。使用 Tiptap 基础富文本与变量节点，缺失变量明确定位；复制内容必须与预览一致。服务端防抖保存、版本冲突保留双方内容；提供草稿库及三个 Finance 写作起点。

技术：Next.js/React/TypeScript/Tiptap + FastAPI + PostgreSQL + Docker Compose。固定本地 workspace，所有查询限定 workspace_id；该模式只限本地。封装搜索、补充、公开搜索、AI Provider。保存 PersonaVersion、SourceEvidence、MatchAssessment、GenerationRun、DraftRevision。第一期不装 Redis、不开发登录、邮箱或发送。

验收：刷新后画像/联系人/草稿存在；同人不重复保存；无证据不造事实；生成失败保留原稿；变量缺失不能标 Ready；旧建议不能覆盖新编辑；Mock 明示；英文默认及中文切换可用。交付可运行闭环，不停在页面骨架。
