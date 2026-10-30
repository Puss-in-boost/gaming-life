# Gaming Life V2.1 · 回归体验与私人候选箱

## 先要解决什么
玩家长时间不打开时，不追溯虚假奖励、不补做任务，也不强制打卡。首页根据上一次真实记录（而不是页面访问）展示轻量欢迎提示。候选箱一次接收不超过16条建议，并逐项批准、拒绝；不会自动发 XP/金币。旧任务、章节、奖励和存档格式 version:1 继续保留。

## 从 ChatGPT 到候选箱
打开游戏首页 → 私人任务申请箱 →「复制 ChatGPT 整理指令」→ 在相关 ChatGPT 对话里粘贴 → 把生成的 JSON 粘回候选箱 → 加入待审 → 单条审核。也可以直接逐行输入简短任务。示例：

```json
{
  "format": "gaming-life.proposals",
  "version": 1,
  "proposals": [
    {"type": "task", "title": "确认一项现实任务的验收标准", "kind": "side", "area": "career", "repeat": "once", "detail": "得到可核对的结果"},
    {"type": "progress", "taskTitle": "已经存在的任务精确标题", "percent": 30, "note": "已经完成的可核实步骤"}
  ]
}
```

progress 的目标必须已经存在并能按完整标题或ID唯一匹配；0–99%才能申请，100%仍需玩家在游戏内明确确认。批量创建不会覆盖当前焦点主线、发放奖励或修改纪律契约。待审申请和历史审核结果存在玩家原有的私有 JSON 存档 `proposalInbox` 字段，沿用 IndexedDB / Supabase CAS 同步，不执行新 SQL。

**能力边界：** 这不是跨 ChatGPT 会话自动监听；ChatGPT 不会后台扫描对话，候选需主动粘贴或由拥有适当权限的未来集成提交。此前未合并 PR #7 依赖另一张表和 RPC，不能直接合并到 V2.1。

## 数据库保活（可选，独立于候选箱）
旧工作流只探测 REST 根路径；该路径返回成功不足以证明 Postgres 真正被访问。新版查询一个只有固定 id=1 的非个人记录，并检查返回内容。它需要**先手动审核并执行** `supabase/003_keepalive.sql`；不要在没有该表时启动调度。

**当前实际状态（2026-10-30）：** Supabase 项目仍是 `ACTIVE_HEALTHY`，但检查发现 `public.gaming_life_keepalive` 尚未创建。为防止未配置流程定时失败并发送邮件，GitHub Actions 的 `schedule` 已从工作流中移除，暂时仅保留 `workflow_dispatch` 手动验证。**当前不具备自动保活能力**；完成 SQL 审核、配置两个 Actions Secrets、确认手动运行成功后，才应在新 PR 中恢复定时触发。此修复不会执行数据库操作、删除存档或影响游戏页面。


到仓库 Settings → Secrets and variables → Actions 设置：
- `GAMING_LIFE_SUPABASE_URL`：项目 URL
- `GAMING_LIFE_SUPABASE_PUBLISHABLE_KEY`：publishable / anon key，**绝不能用 service_role 或 secret**

在 GitHub Actions 手动运行 `Gaming Life Supabase keepalive`，确认输出 `Database row read OK`，再观察后续12小时的定时运行。缺少配置或没有数据行时工作流应失败，而不是假报保活成功。GitHub Actions 可能延迟/暂停；任何心跳方案都**不保证**免费计划永不休眠，请以 Supabase 控制台项目状态和警告邮件为准。此工作流只影响 gaming-life，不修改 you-jile。

## 验收
- `node tests/v17.test.mjs && node tests/v18.test.mjs && node tests/v19.test.mjs && node tests/v110.test.mjs && node tests/v2.test.mjs && node tests/v21.test.mjs`
- 在旧存档测试：原 XP、金币、任务与完成记录保持一致；新增候选只改变 `proposalInbox`；忽略候选不触动任务；批准进度只记录 0–99%，不自动完成。
- 在真实账号/手机测试云端模式中断、重试与多端冲突；检查候选不会被重复创建。
- 在合并前导出电脑端 JSON 备份，勿把私人备份提交到公开 GitHub。

## 一键打开待审建议（V2.1）
可构造 `https://puss-in-boost.github.io/gaming-life/#inbox=<URL-encoded-json>`。其中 JSON 必须是上述 `gaming-life.proposals` 格式；打开后只**预填**候选，仍需点击「放入待审箱」并逐条批准。页面读取后立即去掉地址中的 hash，不向 GitHub 静态服务器提交候选内容。浏览器历史、聊天链接或外部分享仍可能包含原始内容，所以仅使用非敏感的任务标题与进度；不要放入私人详细记录、账号信息或密钥。过长的提案请用复制粘贴。
