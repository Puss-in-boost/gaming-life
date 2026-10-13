# ChatGPT ↔ Gaming Life 任务包协议（V1.4）

任务包仍使用 `gaming-life.quest-pack` 的 `version:1` 格式；V1.3 增加可选 `coins` 字段，旧 V1.1 包仍能导入。

## 示例

```json
{
  "format": "gaming-life.quest-pack",
  "version": 1,
  "packId": "graduation-2026-week-42",
  "title": "毕业试炼：本周计划",
  "focusId": "thesis-next",
  "quests": [
    {"id":"thesis-next","title":"推进一项论文或送审具体成果","detail":"完成真实改动并留下结果，按当前送审阶段调整","kind":"main","area":"career","repeat":"daily","xp":50,"coins":25},
    {"id":"workout","title":"按原计划完成训练或恢复","detail":"不要为了金币过度训练","kind":"side","area":"health","repeat":"daily","xp":20,"coins":10},
    {"id":"learn","title":"讲清楚一个感兴趣的概念","detail":"本周选择一次进行即可","kind":"side","area":"learning","repeat":"weekly","xp":20,"coins":10}
  ]
}
```

规则：`packId` 3–60 位英文字母、数字、`-`、`_`；同一包和同一项任务使用稳定 id 才能幂等更新。每项标题最多65字、说明最多250字、`xp` 5–80 整数；可选 `coins` 0–80 整数，不填时按任务类型与 XP 推算，仍受每日/每周金币上限约束。`kind` 仅为 `main` / `side`；`area` 仅为 `career` / `learning` / `finance` / `social` / `health` / `explore`；`repeat` 为 `once` / `daily` / `weekly`；`focusId` 可指向当前包的一个主线任务；每包1–30项。

网页内置「✨ 领取本期推荐任务」，不必每天复制 JSON。外部 ChatGPT 任务包依然通过「导入任务包 → 预览 → 确认」进行。再次导入 `packId + quest.id` 相同的任务只更新配置，不删除历史事件或补发金币。

## 状态快照与隐私

首页「复制当前状态」让用户主动复制 XP、已完成事项、币余额、预算剩余和任务摘要给 ChatGPT。不会自动上传个人记录或后台调用 AI API。

## ChatGPT 的任务规划原则

- **以最新真实状态为准。** 不因过去曾经修改论文，就假定某章节现在仍未完成。
- 优先一个重要主线和最多两个可选支线；具体成果优先于小时数。
- 体魄训练按照既定安排，膝盖不适优先恢复；睡眠与社交不搞惩罚式 KPI。
- 计划调整时尽量沿用原包的 `packId` / `quest.id`；XP / 币独立、明确且不过度发放。
- 不以正常吃饭、普通娱乐、睡眠或休息作为必须用币购买的权利。

## V1.4 进度状态与并行主线

V1.4 未改变原有 `gaming-life.quest-pack` `version:1` 的 JSON 格式。任务包**不能直接指定完成状态**，避免 ChatGPT 输出任务包时自动替玩家领取 XP。

网页中新加入了「进行中」「待确认」状态与进度笔记，用户主动记录，不提前发放奖励。复制给 ChatGPT 的 `gaming-life.state-snapshot` 包含 `currentMain.status`、`currentMain.progressNote`、`secondaryMain` 和最多12条 `recentProgress`。笔记由玩家自行决定是否复制/发送。

内置求职任务包使用固定 `packId: career-applications-202610`、`focusId: first-three-applications`，含简历核对、八个目标岗位、首批三份真实投递、后续每周五份投递。先预览确认；重复导入幂等，不视为已投递。

具体规则见 [`PROGRESS.md`](PROGRESS.md)。