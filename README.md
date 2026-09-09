# 暗黑之礁 · 监控室

这是一个带主窗口和系统托盘的 Windows 应用程序，不是网页。它无需启动 Dota 2 客户端，使用 Steam 账号连接 Dota 2 Game Coordinator，尝试观战指定好友。桌面应用不会发送 Windows 弹窗通知。

窗口关闭后应用会缩到系统托盘并继续监控。应用同时保留只允许本机访问的 JSON 状态接口。

应用将入礁登录台与牢房观战层分开。点击登录台上的“押入小鱼人演示囚徒”，可以在不登录 Steam 的情况下，使用小鱼人斯拉克的英雄头像演示斯拉达巡猎、牢房点灯动画和模拟战况。演示不会读取或改动真实账号信息。

## 能得到什么

- 好友当前是否存在可观战比赛
- 登录后从 Steam 好友资料中取得头像与昵称，并显示在铁栅囚室中
- 观战请求的结果和 `serverSteamId`
- 如果比赛进入 Valve SourceTV 热门列表：比赛 ID、时间、比分、经济领先等快照
- 如果配置 Steam Web API Key 且 Valve 为该服务器提供统计：在观战层显示 `GetRealtimeStats` 快照
- Valve 快照包含目标玩家时：显示英雄、等级、KDA、补反、个人净资产、当前装备与快照变化战报
- Valve 快照包含世界坐标时：在 Dota 风格战术地图上显示双方十名英雄、存活建筑及目标移动轨迹

桌面观战层约每 20 秒刷新一次。SourceTV 本身是延迟直播，因此这里的“实时”表示持续更新 Valve 当前提供的快照，不保证与玩家屏幕同秒。

普通路人局通常不在 SourceTV 热门列表中。这时服务会保留服务器 ID，并返回 `spectating_unlisted`；这不是程序故障，而是 Valve 当前的数据边界。

## 准备工作

### 直接使用 EXE

推荐运行 `Dota2-Dark-Reef-Monitor-0.7.0-x64-Setup.exe` 完成安装。安装版会创建开始菜单快捷方式。也可以运行不需要安装的 `Dota2-Dark-Reef-Monitor-0.7.0-x64-Portable.exe`。

打开应用后填写：

1. Steam 登录名。
2. 目标好友的 17 位 SteamID64。
3. 首次登录所需的 Steam 密码；应用不会保存密码。
4. 如果提示需要验证，填入 Steam Guard 验证码并重新点击“开启监视”。

成功登录后，刷新令牌保存在 Windows 当前用户的应用数据目录。以后通常可以不填密码直接“命令巡猎”。好友必须能被该账号通过 Steam 好友关系观战；好友隐私、比赛观战设置和 Valve 限制仍然有效。

### 从源码运行

1. 安装 Node.js 24 或更新版本，以及 pnpm 11。
2. 准备一个专用 Steam 小号，并让它与目标玩家成为 Steam 好友。
3. 在项目目录执行：

   ```powershell
   pnpm install --frozen-lockfile
   Copy-Item .env.example .env
   ```

4. 编辑 `.env`：

   ```dotenv
   STEAM_ACCOUNT=专用小号登录名
   STEAM_PASSWORD=首次登录密码
   FRIEND_STEAM_ID64=目标好友的17位SteamID64
   STEAM_SESSION_FILE=./data/session.json
   HTTP_PORT=8787
   REQUEST_LIVE=false
   ```

首次运行时，如果账号启用了 Steam Guard，终端会要求输入验证码。成功后，dotakit 会把刷新令牌写入 `data/session.json`，以后可静默登录。确认会话文件有效后，可以从 `.env` 删除密码。

`data/session.json` 相当于登录凭据：不要发送给别人，不要放进版本控制，并限制服务器上能读取它的用户。

## 运行

桌面应用：

```powershell
pnpm start
```

仅运行无窗口后台服务：

```powershell
pnpm run start:service
```

查询状态：

```powershell
Invoke-RestMethod http://127.0.0.1:8787/health
Invoke-RestMethod http://127.0.0.1:8787/status
```

服务只监听 `127.0.0.1`，不会直接暴露到局域网或公网。

## 状态说明

| `phase` | 含义 |
|---|---|
| `starting` | 服务已启动，尚未完成第一次查询 |
| `unavailable` | 好友未在可观战比赛中，或 Steam/大厅拒绝请求 |
| `spectating_unlisted` | 已取得服务器 ID，但普通路人局没有详细直播统计 |
| `detailed_stats` | 已从 GC SourceTV 或 Valve Web API 得到比赛快照 |
| `transient_error` | Steam/Valve 本次请求超时或临时失败，下轮会重试 |

`REQUEST_LIVE=false` 使用普通延迟观战。设为 `true` 会请求低延迟好友观战，账号没有 Dota Plus 时通常返回 `ERROR_NO_PLUS`。

## 可选：Valve Web API

在 `.env` 设置 `STEAM_WEB_API_KEY` 后，服务会在 GC 热门列表找不到比赛时尝试：

```text
https://api.steampowered.com/IDOTA2MatchStats_570/GetRealtimeStats/v1/
```

请求目标主机和路径写死在程序中，配置不能把服务变成任意 URL 代理。普通路人局可能返回空对象，此时仍会显示 `spectating_unlisted`。

## 验证

```powershell
pnpm test
pnpm run check
pnpm audit
pnpm run build:win
```

测试不需要真实 Steam 账号，也不会访问 Steam。

锁文件通过 pnpm override 将 `steam-user` 的传递依赖固定在 `adm-zip` 0.6.0 和已修复旧公告的 `protobufjs` 7.6.6。当前 `pnpm audit` 会报告 `adm-zip` 的 [GHSA-vwc7-r8mq-g2x9](https://github.com/advisories/GHSA-vwc7-r8mq-g2x9)，且上游尚未发布修复版；该公告针对写入文件系统的解压接口，而 `steam-user` 在本项目调用路径中只用它从内存读取单个压缩条目，不会写入解压目录。升级依赖后仍应重新执行审计和测试。

## 数据源依据

- dotakit 的 `spectateFriend`、SourceTV 与登录接口：https://github.com/beekamai/dotakit#readme
- 英雄与物品 ID、名称和官方图片路径：https://github.com/odota/dotaconstants
- Steam 登录及刷新令牌行为：https://github.com/DoctorMcKay/node-steam-user
- Valve Dota 2 观战 protobuf：https://github.com/SteamDatabase/GameTracking-Dota2/blob/master/Protobufs/dota_gcmessages_client_watch.proto
- Valve 实时玩家与建筑坐标：https://github.com/SteamTracking/Protobufs/blob/master/dota2/dota_gcmessages_common.proto
- Dota 世界地图使用 16384 单位导航网格：https://github.com/SteamTracking/GameTracking-Dota2/blob/master/game/dota/dota.fgd
- [Electron BrowserWindow 与渲染沙箱](https://www.electronjs.org/docs/latest/api/browser-window)
- [electron-builder Windows 安装版与便携版目标](https://www.electron.build/docs/win/)
- [Node.js 环境文件参数](https://nodejs.org/api/cli.html#--env-file-if-existsfile)

本项目与 Valve Corporation 无关联。
