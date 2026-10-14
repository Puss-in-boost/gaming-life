# Gaming Life V1.7 · AI 任务申请箱

## 上线顺序

1. 审查 PR 中的 `proposals.js`、`index.html`、`cloud.js` 和 `supabase/002_ai_proposals.sql`。
2. 在 Supabase **gaming-life** 项目（不是 you-jile）打开 SQL Editor，手动执行 `supabase/002_ai_proposals.sql`。本 PR **没有执行 SQL**。
3. 再合并本 PR，等待 GitHub Pages 更新，强制刷新手机和电脑网页。
4. 保证 V1.6 已云端同步。进入「申请」页面，点「提交今天的公司项目」，会先出现待审申请，**不会直接改变游戏存档**。
5. 展开申请可编辑任务标题、说明、类别、领域、周期、XP、金币；点击「批准」后执行单一 SQL RPC 事务，审批状态和云端 JSON 存档一起提交。
6. 返回今日任务检查新任务；旧论文主线的优先级不会被偷偷更改。跨端刷新并检查修订号。
7. 从 ChatGPT 生成 `gaming-life.proposal` JSON 并粘贴；或在申请页面提交一条进度更新申请，再审核。

## 数据模型与权限
`gaming_life_task_proposals` 按 `auth.uid()` 隔离，`unique(user_id,dedupe_key)` 去重。
客户端只拥有 SELECT/INSERT 权限；不能自行将申请标为 approved，也不能 UPDATE/DELETE。
安全定义者 RPC 再检查用户身份、归属、状态和游戏存档 revision；批准操作同时锁定申请行和存档行，写入申请状态和新游戏存档，失败会回滚。
拒绝不修改正式游戏存档。主线申请不会覆盖旧主线设置，进度更新不会增加 XP/金币/完成事件。
多端冲突返回 stale_revision，要求用户先同步，再重试审核。

## 示例任务
稳定 dedupeKey：`company-chiller-fixed-speed-model-20261014`。
标题「定频离心式冷水机性能公式研究」，一次性主线 50 XP/25 金币。
现阶段明确为文献调研、核查 PLR/COP 口径、非线性候选模型及研究路线；不包含 TRNSYS 仿真。
示例**只作为网页的一键提交候选**，不会在数据库迁移中偷偷写入。

## 申请 JSON 模板
```json
{
  "format": "gaming-life.proposal",
  "version": 1,
  "dedupeKey": "my-project-stage1-20261014",
  "kind": "create",
  "title": "建立第一阶段研究路线",
  "source": "ChatGPT 对话 · 用户主动提交",
  "payload": {
    "title": "建立第一阶段研究路线",
    "detail": "明确基础公式和研究步骤",
    "kind": "main",
    "area": "career",
    "repeat": "once",
    "xp": 50,
    "coins": 25
  }
}
```

进度更新需 `kind: "progress"`，`payload: {"targetTaskId":"真实任务ID","status":"doing","note":"具体成果"}`；状态只支持 `doing` 或 `review`。
当前不会抓取 ChatGPT 的全部历史聊天；必须在聊天中主动生成申请，或手动提交到网页。
手机云端优先和电脑本地优先不变，审批时必须联网及云端同步。

## 验证与发布限制
PR 仅包含代码和 SQL，未直接执行 SQL，也未修改真实数据。发布前需对单一用户重复申请、多用户 RLS、
拒绝、不完整数据、两端并发 stale_revision、已完成周期的进度申请进行真实数据库验收。
