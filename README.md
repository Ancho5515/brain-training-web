# Brain Training Web

可在 Windows 局域网主机部署的认知训练网页。40 款小游戏均有 30 级难度，每局完成 3 回合后可保存到当前账号。目录标明建议年龄、数字基础和必要的识字条件，可按年龄和是否需要数字筛选。

## 在 Windows 上运行

在本仓库根目录用 Windows PowerShell 运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\bootstrap.ps1
```

部署后，主机访问 `http://localhost:8787`。同一局域网内的手机、iPad 和其他电脑使用脚本显示的主机 IPv4 地址，端口为 `8787`。没有本地仓库时可使用部署文档中的独立入口。 [Windows 部署与验收](docs/windows-deployment.md)

账号列表按浏览器的设备凭证分组。可在同一浏览器创建多个账号，各自保存训练记录并导出 JSON。SQLite 数据库与服务密钥保存在独立的数据目录中。

各游戏的公开玩法与来源已整理。 [调研文档](docs/research.md)

项目源码采用 MIT 许可，第三方依赖遵循各自许可。 [许可证](LICENSE)
