# Gaming Life · 游戏人生

独立的游戏化成长产品。目前主线、支线、进度、成就、XP、奖励所和求职冲刺任务包可以在 GitHub Pages 上运行。

- 网页：<https://puss-in-boost.github.io/gaming-life/>
- **V1.5：IndexedDB 本地优先、Supabase 邮箱登录、PostgreSQL 云端存档、RLS 隔离、跨设备恢复和冲突保护**。
- 迁移旧版 V1–V1.4 不会自动清除个人存档；旧 localStorage 作为兼容镜像，采用同一个 `gaming-life-v1-local` 键。
- 不配置云端时完全可以离线使用；要实现多设备同步，需独立 Supabase 项目。

**部署／新项目初始化与安全说明：** 阅读 [`docs/CLOUD_SYNC.md`](docs/CLOUD_SYNC.md)。数据库初始化文件位于 [`supabase/001_gaming_life_states.sql`](supabase/001_gaming_life_states.sql)。

## 使用建议

1. 首次更新后先到「设置」导出一份 JSON 备份，检查原任务、金币和日志无变化。
2. 参照 `docs/CLOUD_SYNC.md` 初始化 Supabase；在设置中填写 URL 和 `sb_publishable_...`（或 anon key）并登录。
3. 首次登录按提示手动选择本地／云端存档。其他设备使用相同账号登录。
4. 做一项小任务，在另一设备刷新/回到页面，验证 XP 与任务记录一致。

**安全原则：** 不在网页或 GitHub 中填写 `service_role`、`sb_secret_` 密钥、数据库密码；云端只使用认证用户的 RLS 权限，保存 JSONB 状态需经过版本比较交换；私密记录不属于仓库代码。

本项目仍为静态页面、无额外部署服务器；Life OS 将来作为人物面板整合。You-jile 与本项目互不影响。