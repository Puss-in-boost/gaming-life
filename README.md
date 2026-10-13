# Gaming Life · 游戏人生 V1.1

**一个主线，少量支线，完成即获得经验。** Gaming Life 是独立应用；原 Life OS 未来作为人物面板逐步整合，而非 Gaming Life 的容器。

## 立即体验

网页部署于 GitHub Pages：<https://puss-in-boost.github.io/gaming-life/>。部署源码位于 `index.html`，不需要 npm 或数据库。

## V1.1：ChatGPT 任务大厅协作

1. 在 ChatGPT 告诉你的短期目标或最新近况，让它生成符合 [`docs/TASK_PACK.md`](docs/TASK_PACK.md) 的任务包 JSON。
2. 网页首页点击 **「导入任务包」** → 粘贴 JSON → **检查任务包** → 核对预览 → **确认导入**。
3. 完成任务获得 XP、显示奖励反馈；误点可以撤销。
4. 当计划改变，点击首页 **「复制当前状态」**，将状态 JSON 粘贴给 ChatGPT，生成下一版任务包。

相同 `packId + quest id` 重复导入会更新而非复制任务，保留历史完成记录，不自动领取经验值。原有 `gaming-life-v1-local` 存储键不变，V1 的进度将继续使用。

## 其他功能

- 页面：今日冒险、章节/里程碑、日志、设置。
- 本地关键词一句话记录需用户确认，**不是 AI 自动理解**。
- 设置可手动新建/停用任务、导出/导入 JSON 完整备份。
- 当前数据只保存在浏览器 `localStorage`，换设备不自动同步。谨防清除站点数据，定期备份。
- 「复制当前状态」只提供有限摘要，默认不包含你的随手日志及敏感详细记录。
- V1.1 无付费 API、无后台上传、无 Supabase，同步和 IndexedDB 仍处于规划。

## 部署

推送 `main` 分支后，`.github/workflows/pages.yml` 会通过 GitHub Pages 发布静态网页。请在仓库 Settings → Pages 选择 Source = GitHub Actions。

## 安全和边界

公开仓库只包含代码和演示数据；**不要提交真实个人备份文件**。任务包先验证结构、数量和 XP 范围；导入前要求用户确认。聊天无法自动读取浏览器数据，也不会自动修改任务。

参见 [任务包协议](docs/TASK_PACK.md) 和 [架构与未来 Life OS 人物面板](docs/ARCHITECTURE.md)。