# Brain Training Web Implementation Plan
> For agentic workers: implement assigned independent files against fixed contracts, then review full integration.
**Goal:** Windows LAN40-game app with browser-device accounts, age/numeracy and repeatable deployment.
**Architecture:** React/TS + single ASP.NET Core/SQLite host.
**Tech Stack:** SDK10.0.403, Node24.22.1, React/Vite, SQLite, browser tests.
**Spec:** docs/superpowers/specs/2026-11-09-brain-training-design.md

## Global Constraints
Windows, port8787, server-side persistent browser/account/run isolation,40 playable games, all age/numeracy metadata, original/permitted code/assets, no runtime data inGit, existing checkout preserved, no Actions/Artifact.

## Review Focus
- IP change/cookie reset and cross-device enumeration.
- Wrong-device login, CSRF, unauthorized record access.
- Hardest levels remain solvable; sorting/OR/multiple answers/directed routes.
- Deploy failure or unrelated port occupation preserves current app/data.
- Touch cancel, backgrounding, session switch and repeated saves.

### 任务 1 后端

- [x] 实现 Identity 密码哈希、设备与会话凭证、SQLite 记录和仅回环访问的主机设备清单。
- [x] Release 集成测试通过 15 项，覆盖设备隔离、同设备多账号、密码、CSRF、幂等保存和重启持久化。

### 任务 2 游戏 1–14

- [x] 14 款按种子出题并可操作结算，覆盖有序和无序作答、计数条件、算式优先级及旋转判定。
- [x] 本机 Edge 第 1、15、30 级共 42 组交互与结算通过。

### 任务 3 游戏 15–27

- [x] 13 款已接入游戏宿主。规则测试覆盖左右镜像、数值排序、着色并集、中文词义、颜色与形状联合计数、线索更正、每张牌只答一次和有效单据计算。
- [x] 本机 Edge 第 1、15、30 级共 39 组交互与结算通过。

### 任务 4 游戏 28–40

- [x] 13 款可操作结算。规则测试覆盖画圆、折叠、立方体、多个合法解、有向加权路线和圆盘移动。
- [x] 本机 Edge 第 1、15、30 级共 39 组交互与结算通过。画圆按笔迹净转角计算覆盖率，回归测试覆盖低采样密度和跨圆长弦。

### 任务 5 Windows 部署

- [x] 使用校验过的固定工具和依赖锁文件，暂存发布后按固定端口 8787 切换。健康检查失败时恢复原版本。
- [x] Windows PowerShell 5.1 脚本解析、部署断言和 Windows x64 实际发布通过。已生成并校验 Windows ARM64 自包含产物。 [部署验收](../../windows-deployment.md#已执行与待执行验证)

### 任务 6 整合

- [x] 40 张目录卡片与可运行组件逐一对应。生产构建及前端 71 项测试通过。
- [x] 在本机 Edge 的桌面、手机和平板视口验证目录、各游戏和触控输入。验证实际发布中的多账号切换、三回合保存、草稿恢复、断线补存、导出和设备隔离。
- [x] 独立复核新增游戏规则和难度，并修复从游戏页进入训练记录或设备页的导航。
- [ ] 使用实体手机和 iPad Air 从另一台设备访问部署主机，检查触屏和局域网连通。Windows ARM64 实机启动及防火墙规则仍待验证。
