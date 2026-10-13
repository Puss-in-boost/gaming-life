# Gaming Life · 游戏人生

静态个人成长游戏，部署于 GitHub Pages：<https://puss-in-boost.github.io/gaming-life/>。

## V1.6：一套云端存档，两种设备运行模式

- **电脑默认本地优先**：完整游戏存档保存在浏览器 IndexedDB，并保留 `localStorage` 兼容镜像；断网仍能记录，联网后按修订版 CAS 与 Supabase 对账。
- **全新手机默认云端优先**：登录后从 Supabase 读取完整记录，只在当前页面内存中使用；完成任务立即尝试提交云端，未成功前不能继续编辑；**不在手机的 IndexedDB / `localStorage` 持久化完整游戏存档，也不会自动下载 JSON 文件**。
- **已使用 V1.5 的手机不会强制切换**：保留既有本地进度；在设置中确认后才切换到云端优先，并清理该设备上的旧完整本地存档。可先自行导出 JSON，避免丢失未同步进展。
- **模式可以手动切换**：在「设置 → 云端同步」切回本地优先后，才会重新保存离线副本。

两种模式使用同一 Supabase Auth + PostgreSQL + RLS（行级安全策略）后端；数据库 RPC 以修订号比较交换，发生双方修改时要求人工决定，不自动合并。**云端优先模式下断网不能编辑；网络保存失败时未同步进展仅保留在当前页面内存中，离开页面可能丢失。** 遇到失败请在页面内重试「立即检查同步」，或手动导出 JSON。

首次连接请阅读 [`docs/CLOUD_SYNC.md`](docs/CLOUD_SYNC.md)。SQL 初始化脚本位于 [`supabase/001_gaming_life_states.sql`](supabase/001_gaming_life_states.sql)，V1.6 **不需要执行额外 SQL 迁移**。项目仍使用 GitHub Pages，无需 Vercel 或服务器端 API。

## 使用与验证

1. 更新后先在已有电脑上导出 JSON 备份，并确认 Supabase 显示「已云端同步」。
2. 在手机打开网站并用同一 Supabase 项目和账号登录。全新手机自动云端优先；已有 V1.5 手机需手动选择「☁️ 直接使用云端」。
3. 查看任务、XP 和奖励币，与电脑核对一致；在手机在线完成一项测试进度，等待云端同步后再回电脑检查。
4. 在断网状态下，手机不应允许修改任务；电脑本地优先仍可离线记录。

本地回归测试（需要 Python Playwright 与 Chromium）：`python tests/test_cloud_mode.py`。测试使用模拟的 Supabase API，**不代表已经在真实 Supabase 上验证**。上线后仍需在真实账号及手机浏览器做一次完整验收。