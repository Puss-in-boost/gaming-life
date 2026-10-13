# ChatGPT ↔ Gaming Life 任务包协议（V1.1）

## 从 ChatGPT 接收新任务

对 ChatGPT 说「请根据我最新的目标和我的 Gaming Life 当前状态生成一个 V1.1 任务包」，将生成的 JSON **原样复制**到 Gaming Life 的「导入任务包」窗口。应用会先展示预览，只有用户确认后才保存。

任务包示例：

```json
{
  "format": "gaming-life.quest-pack",
  "version": 1,
  "packId": "autumn-2026-week-42",
  "title": "本周：逐步推进重要目标",
  "focusId": "priority-step",
  "quests": [
    {
      "id": "priority-step",
      "title": "完成一个重要目标的明确交付",
      "detail": "保存并记下可以验证的成果",
      "kind": "main",
      "area": "career",
      "repeat": "once",
      "xp": 50
    },
    {
      "id": "read-something",
      "title": "学习一个感兴趣的新概念",
      "detail": "能用自己的话解释即可",
      "kind": "side",
      "area": "learning",
      "repeat": "daily",
      "xp": 15
    }
  ]
}
```

- `format` 必须是 `gaming-life.quest-pack`；`version` 必须是 `1`。
- `packId` 使用 3–60 位英文字母、数字、`-` 或 `_`，同一个任务包的更新应**保留 packId**。
- 每个 `quests[].id` 在同一包内唯一，需为英文字母、数字、`-` 或 `_`，长度 1–60；修改同一任务时保留 id。
- `title` 不超过65字；`detail` 不超过250字；`xp` 为 5–80 的整数。
- `kind` 只能是 `main`（主线）或 `side`（支线）。
- `area` 可选 `career` / `learning` / `finance` / `social` / `health` / `explore`。
- `repeat` 可选 `once` / `daily` / `weekly`。
- `focusId` 可选，填写本包内 `main` 任务的 id，用于选择当前主线。
- 一包最多30个任务。强烈建议一次只创建1个主线和1–2个支线。

导入不允许指定历史完成状态，不会发放 XP。再次导入同一个 `packId` + `id` 只更新对应任务，不重复增加。旧完成事件依然保留，历史经验分数使用完成时的值。旧任务不会因为新任务包而被自动删除。

## 把状态反馈给 ChatGPT

首页点击「复制当前状态」，将 JSON 直接粘贴到 ChatGPT。它包含：当前角色等级与 XP、当前主线、当天支线、已启用任务、近7天最多40项完成记录、阶段里程碑状态。默认**不导出**日常随手日志、个人财务和其他隐私内容。

复制动作完全由用户触发；当前无登录、后台 AI 调用、Supabase 同步。无法复制时会下载状态 JSON 文件。

## 生成任务包的建议

请 ChatGPT 做到：

1. 先识别当前最重要目标和真实约束，而不是自动把生活变成 KPI。
2. 优先一个明确主线，最多两个可选支线；完成标准必须能核实。
3. 按难度分配经验：短任务10–20、深度任务30–50，特殊困难任务可达80。
4. 非工作活动也可以获得 XP，但不要鼓励过度训练、牺牲睡眠或将休息视为失败。
5. 根据用户发回的 `gaming-life.state-snapshot` 调整现有任务时保留原来的 `packId` / `id`，避免重复导入。