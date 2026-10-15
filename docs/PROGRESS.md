# Gaming Life · 任务进度与双主线

任务状态包含：未开始、进行中、待确认、已完成。进行中和待确认只更新用户备注，不提前奖励 XP 与金币；只有玩家明确点击「完成任务」才会创建不可重复的对应周期事件。

`state.questProgress` 以 `taskId@period` 为键；once 跨日持续，daily 按日期，weekly 按周一；`state.progressHistory` 留存最近150条进度足迹。撤销已完成事件时，若奖励币余额不足则遵循防透支约束。

`state.mainId` 是今天优先推进的一条主线，`state.secondaryMainId` 是并行主线；切换优先级不删除其他任务，也不扣除 XP。

玩家可以自行创建长期主线并设置最终目标与章节，任务可关联章节；章节进度来自真实的完成事件，最终目标须独立确认。强制每日契约默认关闭，且仅由玩家手动开启。

## 隐私

旧版本曾将部分个性化任务放入公开网页代码。新版本不再公开内置个人任务或包；任务通过用户确认导入后存进私人存档及 `state.privatePacks`，并由现有 Supabase Auth + RLS 隔离，不随 GitHub Pages 的代码部署发布。仅使用私有浏览器存储时请自行定期备份。

详情见 [任务包协议](TASK_PACK.md) 和 [云端同步](CLOUD_SYNC.md)。
