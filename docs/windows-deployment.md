# Windows 局域网部署

在提供网站的 Windows 10/11 主机上打开 **Windows PowerShell 5.1**，粘贴下面这一条命令。支持 x64 和 ARM64；首次安装需要联网。程序和构建工具均安装到当前用户目录，不需要 Docker、GitHub Actions、Artifact 或 Windows 服务。

```powershell
& { $ErrorActionPreference = 'Stop'; Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force; [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12; $scriptFile = Join-Path ([IO.Path]::GetTempPath()) ('brain-training-bootstrap-' + [Guid]::NewGuid().ToString('N') + '.ps1'); try { Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/Ancho5515/brain-training-web/main/bootstrap.ps1' -OutFile $scriptFile; & $scriptFile } finally { if (Test-Path -LiteralPath $scriptFile) { Remove-Item -LiteralPath $scriptFile -Force } } }
```

该命令直接从公开仓库下载独立入口。建议先查看 [bootstrap.ps1 源码](https://github.com/Ancho5515/brain-training-web/blob/main/bootstrap.ps1)。命令中的执行策略设置仅影响当前 PowerShell 进程，不修改用户或系统策略。组织策略强制禁止脚本时，请由主机管理员处理。

也支持简写入口；它没有临时文件，不能直接附带脚本参数：

```powershell
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12; irm 'https://raw.githubusercontent.com/Ancho5515/brain-training-web/main/bootstrap.ps1' | iex
```

## 首次运行与访问

默认位置为 `%LOCALAPPDATA%\BrainTrainingWeb`。脚本寻找当前目录所属的仓库，其次查找安装目录中的 `repo`，再检查已有部署记录的源码位置；找不到才克隆公开仓库。候选仓库必须位于正确的 Git 根目录、`origin` 必须对应 `Ancho5515/brain-training-web`，并含客户端和服务端项目。当前目录属于其他仓库时会报错，请切换到普通目录，或者显式指定 `-RepoDir`。

缺少 Git 时，脚本从 Git for Windows 官方发布页下载本机架构的 portable MinGit **2.56.0.4** ZIP，并按该官方发布中公开的固定 SHA256 校验；不依赖匿名 GitHub API 配额。Node 固定为 **24.22.1**，按官方 `SHASUMS256.txt` 核验 SHA256；.NET SDK 固定为 **10.0.403**，按 Microsoft 官方 10.0 发布元数据核验 SHA512。Node 和 .NET 缺少校验值或校验失败时直接终止。工具不加入系统 PATH，不安装到系统目录。Git、Node、.NET 和 npm 依赖遵循各自许可，仓库的 MIT 许可不替代第三方许可。

构建执行 `client` 的 `npm ci` 和 `npm run build`，再将服务端发布为本机架构的 self-contained `win-x64` 或 `win-arm64` 应用，并把 `client/dist` 复制到发布目录的 `wwwroot`。发布后不需要预装 .NET Runtime，也不需要手机/iPad联网访问 CDN。

成功后，主机浏览器打开：

```text
http://localhost:8787
```

手机、iPad、其他 Windows 浏览器连接同一局域网，输入脚本显示的地址，例如 `http://192.168.1.20:8787`。也可在主机运行 `ipconfig` 查 IPv4 地址。网站固定监听 `0.0.0.0:8787`；主机保持开机并避免睡眠。路由器的访客网络或无线隔离可能阻断设备互访。

后台进程独立于部署命令运行，关闭 PowerShell 窗口后仍可使用。它不是系统服务：注销、重启或手动停止后，重新运行同一部署命令即可构建并启动。主机 IP 变化后应使用新地址访问；浏览器凭证与源站地址相关，换地址或浏览器时可能被识别为新设备，旧记录仍保留。

## 再次部署、更新与停止

**再次部署直接重复最上方的公开命令。默认绝不 fetch、pull、reset 或 clean 已有源码。** 本地改动会作为本次构建输入保留。也可从已有仓库运行：

```powershell
& .\bootstrap.ps1
```

从其他目录指定现有源码：

```powershell
& 'C:\path\brain-training-web\bootstrap.ps1' -RepoDir 'C:\path\brain-training-web'
```

只有显式 `-Update` 才获取远端并执行快进合并；工作区必须干净、当前分支必须跟踪 `origin`。脚本不会 stash、重置、重建分支或解决冲突。无法快进时部署终止，原服务继续运行。

```powershell
& .\bootstrap.ps1 -Update
```

停止默认安装：

```powershell
& .\scripts\stop.ps1
```

停止前核对保存的 PID、进程启动时间、可执行文件路径及安装目录。PID 已被其他进程复用或无法核实时会拒绝停止。不会通过进程名批量结束程序，不删除账号、记录、密钥或发布版本。

## 数据、日志与安全切换

| 默认目录 | 内容 |
| --- | --- |
| `%LOCALAPPDATA%\BrainTrainingWeb\repo` | 首次自动克隆的源码；已有外部源码可直接复用 |
| `%LOCALAPPDATA%\BrainTrainingWeb\tools` | 当前用户专用 Git、Node、.NET SDK |
| `%LOCALAPPDATA%\BrainTrainingWeb\releases\<版本>` | 每次独立的发布文件；包含网页与 self-contained 服务端 |
| `%LOCALAPPDATA%\BrainTrainingWeb\data` | SQLite 数据库和 Data Protection 密钥，独立于版本目录 |
| `%LOCALAPPDATA%\BrainTrainingWeb\logs` | 每次后台启动的标准输出及错误日志 |
| `%LOCALAPPDATA%\BrainTrainingWeb\state\current.json` | 当前发布路径、固定端口、数据路径及进程身份 |

首次可指定 `-InstallDir`、`-DataDir` 或环境变量 `BRAIN_DATA_DIR`。显式 `-DataDir` 优先于环境变量。路径可包含空格；数据目录必须位于源码和发布目录之外。

```powershell
& .\bootstrap.ps1 -InstallDir 'D:\BrainTrainingWeb' -DataDir 'D:\BrainTrainingData'
```

以后使用同一 `-InstallDir`；已保存的数据路径自动沿用。重复部署时若传入不同的数据路径，脚本会报错，避免出现一个空数据库。自定义安装路径的停止命令为 `& .\scripts\stop.ps1 -InstallDir 'D:\BrainTrainingWeb'`。备份时先停止服务，再完整复制数据目录，包括数据库相关文件和密钥；仅复制数据库而丢失密钥会影响已有登录凭证。

当前进程会继续提供网站，直到客户端构建和服务端发布全部成功。切换前再次检查端口；只有当前安装拥有的进程才会被停止。新版本启动后要求：它独占固定端口、进程身份匹配，且 `GET /api/health` 同时返回 `application: "brain-training-web"` 和 `status: "ok"`。健康检查失败会停止候选版本，并在原版本此前运行的情况下自动重新启动原版本，继续使用同一个数据目录。原版本本来没有运行时，不会因回滚意外启动它。

构建失败不停止原服务。无关进程占用 8787 时会显示 PID 并失败，绝不杀掉它，也不会改端口。构建后若其他程序抢占端口，同样拒绝干预；此时请自行解决冲突，再重新部署。回滚自身失败时，错误会明确指出，并保留数据和日志供排查。旧发布目录保留供检查，脚本不会清理运行数据。

## 防火墙与排查

Windows 防火墙可能首次提示是否允许访问。可信局域网请将网络配置文件设为“专用”，只允许需要的专用网络。默认部署不修改防火墙。

需要脚本建规则时，在**以管理员身份运行**的 PowerShell 中、使用同一 Windows 账号和安装目录，显式添加 `-OpenFirewall`：

```powershell
& .\bootstrap.ps1 -OpenFirewall
```

规则仅允许 TCP 8787、Private 配置文件、LocalSubnet 来源。不自动提权，不开放 Public 配置文件或路由器端口。未提升权限、组策略限制或规则创建失败时会明确显示“Firewall was NOT ...”，服务仍可在主机本地使用；这不代表手机已经连通。不同管理员账号会使用其自己的 `%LOCALAPPDATA%`，因此应传入原安装的 `-InstallDir`。

| 现象 | 检查 |
| --- | --- |
| 主机正常、手机无法访问 | 同一局域网、正确 IPv4、专用网络防火墙 TCP 8787、路由器访客隔离 |
| 8787 端口冲突 | 看报错 PID；`Get-NetTCPConnection -LocalPort 8787 -State Listen`；自行处理占用程序 |
| 下载或校验失败 | 核查网络代理、HTTPS 证书、磁盘空间及官方站点；不要跳过哈希校验 |
| `npm ci` / 发布失败 | 保留控制台错误；源码必须完整，锁文件应与 package.json 一致；原服务继续运行 |
| 新版健康失败 | 查看 `logs` 最新 stderr/stdout；确认回滚提示，再访问旧版本 |
| 找不到旧账号 | 核对数据路径；使用同一浏览器、主机地址和浏览器数据；清 cookie 会成为新设备 |

联网构建主要访问 GitHub 及其下载域名、nodejs.org、Microsoft .NET 下载域名、npm Registry 和 NuGet。构建完毕后局域网游戏与数据服务均由这台主机提供。

## 已执行与待执行验证

仓库提供无需 Pester 的断言测试和全脚本 AST 解析；在 PowerShell 中运行：

```powershell
& .\scripts\tests\parse-scripts.ps1
& .\scripts\tests\run-tests.ps1
```

这些测试覆盖源码选择、版本/架构和哈希选择、PID复用拒绝、端口冲突、构建失败不停止原服务、健康失败回滚以及数据路径保持。构建/进程/HTTP 边界使用模拟输入，真实文件状态与切换逻辑实际执行。

本次自动验证环境为 Linux 上的 PowerShell 7.5.4；**尚未在真实 Windows PowerShell 5.1、Windows x64/ARM64、防火墙或手机/iPad局域网环境执行端到端安装**。代码按 PowerShell 5.1 语法编写；实际 Windows 首装、关闭窗口后的进程存活及双架构发布仍需要主机验收，不能以 AST 或模拟测试代替。
