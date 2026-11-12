# Windows局域网认知训练网站设计
日期2026-11-09；依据用户五项新要求及docs/research.md。用户已委托自行设置实施，采用此前推荐的React/TS + ASP.NET Core + SQLite。

## 绑定要求
- Windows集中存储并提供同源网页/API，监听0.0.0.0:8787；手机/iPad/Windows浏览器访问，无CDN/原站依赖。
- 40款真实游戏，公开名称与核心特殊规则保留。每局3个独立题/回合，汇总保存。30级为独立难度设计。
- 设备=浏览器持久随机凭证；服务记录id/name/UA/firstSeenUtc/lastSeenUtc/lastIP。不用IP/UA/MAC认证。换浏览器或清cookie成为新设备，旧数据不删除。
- 每设备多个账号，只列本设备创建的账号ID/昵称，选择并输入正确密码登录；允许不同设备同名，进度按账号隔离，会话绑定设备。
- 首页全部卡片给年龄段建议和数字基础，另列必要识字条件；支持年龄与无需数字筛选。建议是按规则理解负荷拟定，不是临床常模。
- 固定8787；已有仓库默认直接构建部署、保留本地修改，不自动拉取/重置。仅显式-Update快进更新；不存在则克隆。保留仓库现有Public状态。
- bootstrap.ps1 独立入口优先通过 `DEVTOOLS_ROOT` 复用匹配版本和架构的构建工具。缺失时下载并校验 Git、Node 24.22.1 和 .NET SDK 10.0.403，Node 与 SDK 安装到源码目录的 `.tools/`。构建自包含 win-x64/win-arm64 版本。数据在发布目录外，构建成功才切换，健康检查失败时回滚。无关进程占端口时报告冲突并退出。
- 密码用Identity PasswordHasher；随机HttpOnly设备cookie和登录cookie；注册/登录/写操作CSRF、输入校验和限速；不存明文密码。完整设备列表仅服务主机loopback可见。
- 源码、MIT、gitignore、锁文件、研究/测试/部署文档进Git；数据库/密钥/发布输出不进Git；不依赖Actions/Artifact。
- 专用clone内feat/initial-release隔离分支；阶段提交，验证后更新用户新仓库main，保留历史。

## 游戏契约
GameProps={level:number;seed:number;onFinish:(result:GameResult)=>void}
GameResult={score:number(0..100);accuracy:number(0..1);durationMs:number;metrics:Record<string,number|string|boolean>}
各组导出Record<number,ComponentType<GameProps>>：groupA=1..14，groupB=15..27，groupC=28..40。
每组件代表一个题/回合，实际操作后onFinish且最多一次；宿主负责3回合聚合并保存。
共享GameFrame、ChoiceButtons、useElapsed、makeResult、Glyph、seeded，具体接口见client/src/games/shared.tsx/types.ts。

## HTTP契约（camelCase JSON）
GET /api/bootstrap -> {device:{id,name,firstSeenUtc,lastSeenUtc},accounts:[{id,displayName}],user:null|{id,displayName},csrfToken,isHost:boolean,version:string}
POST /api/accounts {displayName,password} ->201 {id,displayName}，不自动登录
POST /api/login {accountId,password} ->200 {id,displayName}
POST /api/logout ->204
POST /api/device/name {name} ->200
GET /api/host/devices ->设备数组（仅loopback，包含accountCount）
GET /api/records ->{records:[RunDto],progress:[{gameId,lastLevel,highestLevel,bestScore,plays,lastPlayedAtUtc}]}，仅当前用户
POST /api/records {id:UUID,gameId:1..40,level:1..30,seed:number,score:0..100,accuracy:0..1,durationMs:number,metrics:object} ->201；同用户同id重复幂等200，不得覆盖别人
GET /api/records/export ->当前用户JSON下载
POST /api/password {currentPassword,newPassword} ->204
所有POST必须X-CSRF-TOKEN（取自bootstrap）；fetch credentials same-origin
GET /api/health ->{status:"ok",application:"brain-training-web",version:string}
支持BRAIN_DATA_DIR与--data-dir配置；发布默认数据目录由部署脚本指定。RunDto含上述提交字段及completedAtUtc。
