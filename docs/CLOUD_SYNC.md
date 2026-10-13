# Gaming Life V1.5：本地优先 + Supabase 数据同步

## 与 You-jile 的关系

- 同样使用 GitHub 托管及部署、**Supabase Auth + PostgreSQL + Row Level Security (RLS)**。
- Gaming Life 继续在 **GitHub Pages 静态部署**：不必为了云存储迁移到 Next.js 或 Vercel。
- **不复用 You-jile 的交易表、密码或数据库项目**。创建新 Supabase 项目；跨设备登录同一个 Gaming Life 账号。
- 与 You-jile 不同：采用 IndexedDB 本地优先，断网仍可写入；同步在网络可用时自动尝试，发生分歧时要求用户决定，而非静默覆盖。

## 一次性开通（需由 Supabase 控制台管理员操作）

1. 在 [Supabase 控制台](https://supabase.com/dashboard) 新建独立项目 `gaming-life`。**如果当前免费项目名额不够，可以先将已用项目升级或选择其他组织，不要改动 You-jile 正式库。**
2. 在新项目的 **SQL Editor** 完整运行 [`supabase/001_gaming_life_states.sql`](../supabase/001_gaming_life_states.sql)。脚本可重复执行，不删除历史存档。
3. Project Settings → API Keys，复制 **Project URL** 以及 **publishable** 或 `anon` key。不要使用 `service_role`、`sb_secret_`、数据库连接字符串。
4. Authentication → URL Configuration：Site URL 设置为 `https://puss-in-boost.github.io/gaming-life/`。Redirect URLs 加入该地址。配置邮箱确认邮件（首次注册可能需要先确认邮件）。
5. 打开 Gaming Life → 设置 → 云端同步，填写 Project URL 和公开 key，使用邮箱注册、确认邮箱、登录。
6. **首次登录不会强制覆盖本地记录**：如果云端是空的，确认上传当前设备存档；如果有云端数据，先备份，再选择使用本地或云端。第二台设备重复填写相同公开项目配置并登录同一个账号。

## 本地备份与冲突处理

- 所有新增、完成、撤销、金币兑换、任务包导入等操作先写入浏览器 `IndexedDB`；现有 `gaming-life-v1-local` localStorage 继续作为兼容镜像。
- 浏览器现存的 V1–V1.4 数据会在首次进入此版本时复制到 IndexedDB；**不会自动删除 localStorage 旧记录**。
- 登录凭证与 Supabase 公钥配置存在 IndexedDB，GitHub 仓库不包含任何私人存档、密码或秘钥。
- 自动同步：本机完成操作约 1.7 秒后尝试上传；再次打开/联网/回到标签页时检查云端。离线变更不丢弃，重新联网后继续尝试。
- 使用一个用户一行 JSONB 存档，数据库用 `revision` 实现原子比较交换（CAS）。本地与云端都修改过时弹出冲突处理：可以备份后采用本地或云端。**当前不支持自动合并两个设备的任务事件。**
- 采用云端时，自动下载本机完整 JSON 备份；采用本机时自动下载原云端 JSON 备份（原云端也临时复制到本机 IndexedDB）。请勿把 JSON 备份上传公开 GitHub。
- 仍建议定期用「设置 → 导出 JSON 备份」制作外部备份。IndexedDB、localStorage 和浏览器缓存都不是跨硬盘的可靠备份。
- 升级代码后首次使用建议导出 JSON 备份；不同浏览器的本地数据不天然相同。

## 限制

- **云端需要你亲自创建 Supabase 项目、执行 SQL、设置 Auth，并填入 URL/公开 key 才能工作；仅合并 PR 不会自动开通云端。**
- 未配置 Supabase 时应用保持完整的本地模式。
- 目前无实时 WebSocket（依赖联网、页面聚焦及编辑后定时同步）；不是秒级实时多人协作。
- 有冲突时不会自动合并，选择版本将替换当前活动存档，切换前请保存下载的备份。
- 若 IndexedDB 不可用，应用会显示降级警告；不要在私人浏览模式下依赖长期保存。
- 云端数据存储在所用 Supabase 项目中，个人内容受 RLS 与该项目安全配置控制；用户自行决定是否启用云端。