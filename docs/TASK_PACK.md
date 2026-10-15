# Gaming Life：私人任务包协议

公开 GitHub 仓库只发布可复用的任务包格式、验证规则和游戏程序。**个人任务包内容、章节安排、导入历史及完成记录不提交公开仓库**。它们是玩家 JSON 存档的一部分；登录 Supabase 后由现有 RLS（行级安全策略）保护。

## 通用任务包示例（仅演示格式）

```json
{
  "format":"gaming-life.quest-pack",
  "version":1,
  "packId":"example-chapter-1",
  "title":"示例冒险",
  "focusId":"step-one",
  "storyline":{
    "id":"example-arc",
    "title":"示例长期目标",
    "goal":"完成自己定义且可以验收的长期成果",
    "chapters":[{"id":"start","title":"第一章 · 行动","goal":"完成一项可验证的行动"}]
  },
  "quests":[{"id":"step-one","title":"完成一个实际成果","detail":"留下一份可核实的结果","kind":"main","area":"learning","repeat":"daily","xp":30,"coins":15,"chapterId":"start","targetCount":5}]
}
```

协议仍是 `version:1`，旧版本包兼容。主要校验：`packId` 为 3–60 位字母数字或 `_-`，任务 `id` 唯一、任务数 1–30；标题不超过65字、说明不超过250字；`kind` 为 `main` 或 `side`，`repeat` 为 `once`、`daily` 或 `weekly`，`xp` 为5–80，`coins` 可选0–80；`area` 为 career / learning / finance / social / health / explore。

可选 `storyline` 为长期目标及其 `chapters`（最多12章）；`quest.chapterId` 必须引用本包的一个章节；`quest.targetCount` 为累计达成次数1–100。缺少 `chapterId` 的旧任务包仍可导入。

## 如何私下使用

1. 从 ChatGPT 获取针对本人情况编写的任务包 JSON，不提交 GitHub 文件或 PR。
2. 登录 Gaming Life；在「设置 → 私人任务包库」或「今日」点击「导入私人任务包」。
3. 预览并确认之后，任务/章节生效，**完整包定义写入 `state.privatePacks`**。旧版已导入的 `packKey` 任务会在升级时尽量恢复为私人任务包，历史 XP、金币和事件不受影响。
4. 同一账号设备之间的任务包库与人物存档一起在 Supabase 的 `gaming_life_states.payload` 中同步；本地优先设备仍会有浏览器私有副本，手机云端优先不持久化完整状态。
5. 私人包可单独导出 JSON；「移出库」只删除存档中的包定义，不删除已创建的任务、章节、历史奖励或事件。

**安全说明：** 默认不向 ChatGPT 或第三方自动上传任务包。用户主动点击「复制当前状态」或「导出 JSON」才会生成可分享的数据；请勿把包含个人信息的备份上传公开仓库。公网仓库此前的历史提交仍可能包含旧版个人化模板——仅删除当前代码不能抹除历史 Git 记录。

## 游戏规则

任务包重复导入采用 `packId + quest.id` 匹配更新现有任务，不自动修改真实完成结果，不重复发放 XP。首次导入/手动创建才记录发布时间；旧任务没有可信日期时显示「未知」。外部任务包不能自动开启强制每日契约；只有玩家手动确认才生效。
