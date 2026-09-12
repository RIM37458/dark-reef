# 暗黑之礁

这是一个带主窗口和系统托盘的 Windows 应用程序，不是网页。它无需启动 Dota 2 客户端，使用 Steam 账号连接 Dota 2 Game Coordinator，尝试观战指定好友。发现目标比赛时，应用会按用户配置请求 Windows 桌面通知；Windows 系统设置决定通知最终是否展示。

窗口关闭后应用会缩到系统托盘并继续监控。正式桌面版不开放本机 HTTP 接口；源码中的无界面服务模式才提供只监听回环地址的 JSON 状态接口。

应用发布为两个互相独立的 EXE。正式版包含 Steam 好友监控、正式选人识图、私人英雄池和海渊战术台，不包含演示入口；演示版启动后直接进入十人征召演示，不提供 Steam 登录、进程捕获、OCR 或私人库接口。两个安装版使用不同应用 ID、安装名称和快捷方式，可以同时安装。

正式版首页有三个主入口，依次为“海渊战术台”“深海军备”“监控室”。战术台无需 Steam 登录，会自动绑定 `dota2.exe` 的可见主窗口，每 1.2 秒读取英雄格与顶部十个英雄槽；识别到本机阵营后，敌方英雄会自动进入技能冷却记录区。游戏时间由程序定期读取画面顶部并自动同步，不再要求手动校准。

正式选人识图已经并入海渊战术台。它不读取 Dota 内存、不注入代码、不会代替玩家点击英雄；127 个英雄肖像基准与中文职责 OCR 均随 EXE 本地打包。英雄格身份从当前校准画面学习，不再假定玩家使用默认四属性顺序；自定义布局的几何位置无法可靠匹配时，程序会停止网格禁用推断并在控制条显示推荐英雄名称。顶部英雄需要连续两帧得到唯一匹配才会锁定，重复或低置信度结果保持未知；英雄格收起后，顶部十格继续作为阵容来源。程序通过稳定的本机玩家槽标记区分阵营，并直接读取“优势路 / 中路 / 劣势路 / 辅助 / 纯辅助”职责标记；1–5 号位只作为玩家常用简称。职责未确认时仍展示敌我阵容，但锁住个人英雄推荐，避免把团队缺口误报成你的选人建议。

覆盖层会在五名敌方英雄头像下方显示“大招 / BKB”两行关键冷却状态。动画分类模型尚未随此版本发布，因此状态保持“观察中”，不会用未经验证的颜色规则自动启动错误倒计时。开发者需要采集本地训练素材时，可在启动前显式设置 `DARK_REEF_TRAINING_CAPTURE=1`；此时程序仅对经过 `dota2.exe` 进程核验的窗口以每秒 4 帧采集 960×540 JPEG，不录音、不上传，素材位于 `%APPDATA%\dota-friend-watcher\visual-training-captures`，总量上限 768 MB。正式使用默认不采集，避免持续截图、JPEG 编码和磁盘写入影响游戏。

战术台内置 OpenDota 职业比赛两两对位快照，每条证据保留胜场、对局数、英雄自身基准胜率、抓取时间和来源，少于 40 局的关系不参与排序。它另有独立的高手相性规则层，判断控制衔接、前后排配合与资源冲突；出处和复核版本保留在库内，普通界面只显示简短战术注释。装备建议使用 OpenDota 的职业比赛分阶段购买次数；该接口没有提供分母，因此程序只展示“购买记录次数”，不会伪造装备胜率。

“深海军备”允许创建自己的方案，把英雄头像拖进“绝活”“赢过”“玩过”等分组，并记录某个英雄特别克制或特别怕的对手。数据只保存在本机，并作为客观统计之外的个人加权直接影响战术台推荐。

## 能得到什么

- 好友当前是否存在可观战比赛
- 登录后从 Steam 好友资料中取得头像与昵称，并显示在铁栅囚室中
- 观战请求的结果和 `serverSteamId`
- 如果比赛进入 Valve SourceTV 热门列表：比赛 ID、时间、比分、经济领先等快照
- 如果配置 Steam Web API Key 且 Valve 为该服务器提供统计：在观战层显示 `GetRealtimeStats` 快照
- Valve 快照包含目标玩家时：显示英雄、等级、KDA、补反、个人净资产、当前装备与快照变化战报
- Valve 快照包含世界坐标时：在 7.40 详细地图上以游戏小地图英雄图标显示双方十名英雄、存活建筑及移动轨迹

桌面观战层约每 20 秒刷新一次。SourceTV 本身是延迟直播，因此这里的“实时”表示持续更新 Valve 当前提供的快照，不保证与玩家屏幕同秒。

普通路人局通常不在 SourceTV 热门列表中。这时服务会保留服务器 ID，并返回 `spectating_unlisted`；这不是程序故障，而是 Valve 当前的数据边界。

## 准备工作

### 直接使用 EXE

四个交付文件分别是：

- 正式安装版：`release/formal/Dota2-Dark-Reef-Formal-0.17.0-x64-Setup.exe`
- 正式便携版：`release/formal/Dota2-Dark-Reef-Formal-0.17.0-x64-Portable.exe`
- 演示安装版：`release/demo/Dota2-Dark-Reef-Demo-0.17.0-x64-Setup.exe`
- 演示便携版：`release/demo/Dota2-Dark-Reef-Demo-0.17.0-x64-Portable.exe`

长期使用正式功能推荐正式安装版；只想体验流程推荐演示便携版。

安装版会写入当前 Windows 用户的应用安装目录，创建开始菜单和桌面快捷方式，并提供标准卸载入口，适合长期使用。便携版不执行安装，双击单个 EXE 即可运行，适合临时体验或放在移动目录；运行时数据仍会保存在 Windows 当前用户的应用数据目录，因此“便携”不代表所有配置都跟随 EXE，也不代表卸载时会自动清理个人配置。

### 使用选人投影

1. 不需要 Steam 登录，进入首页第一个入口“海渊战术台”。
2. 在首页“深海军备”中把英雄拖入熟练度分组，并按需要记录个人克制关系。
3. 程序会自动读取并选中 `dota2.exe` 的可见主窗口；视觉训练开启后，整个显示器来源不能用于部署覆盖层。
4. 点击醒目的“覆盖到游戏画面”；顶部十格和英雄格会持续识别，推荐英雄在 Dota 选人布局上直接点亮。正式使用默认不会记录训练截图。
5. Ranked Roles 职责标记尚未确认时不显示个人推荐；确认后才按职责、阵容、克制、相性规则和私人熟练度排序。仍需在 Dota 中亲自完成选择。

### 私人方案与未来社区库

应用把资料分为三层：随版本发布的官方事实是只读的；私人方案可编辑并存入 Windows 当前用户的应用数据目录；从 JSON 导入的方案会成为新的私人副本。更新官方事实不会覆盖私人方案。

当前版本支持方案的新建、修改、删除、JSON 导入和导出，不连接社区服务器。远程更新和上传需要后续独立服务提供账号、限流、审核、举报、版本历史和内容签名；在这些安全边界具备之前，应用不会把方案自动传出电脑。

打开应用后填写：

1. Steam 登录名。
2. 目标好友的 17 位 SteamID64。
3. 首次登录所需的 Steam 密码；应用不会保存密码。
4. 如果提示需要验证，填入 Steam Guard 验证码并重新点击“开启监视”。
5. “发现战场时请求 Windows 桌面通知”默认开启；应用会发出通知请求，Windows 系统通知设置决定最终是否展示。

成功登录后，刷新令牌通过 Windows 系统加密保护后保存在当前用户的应用数据目录；加密服务不可用时不会保存令牌。以后通常可以不填密码直接登录。旧版明文会话文件会在成功迁移后删除。好友必须能被该账号通过 Steam 好友关系观战；好友隐私、比赛观战设置和 Valve 限制仍然有效。

当前桌面界面一次只监看填写的一个 SteamID64。登录库能够读取账号的完整好友列表及在线游戏状态，因此可以扩展为“全部好友监控室”；为避免对大量好友逐个发送 GC 观战请求，合适的实现是先筛出正在运行 Dota 2 的好友，再为这些人建立牢房列表。

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
pnpm run check:task
pnpm run check:full
pnpm run build:win
```

测试不需要真实 Steam 账号，也不会访问 Steam。

锁文件通过 pnpm override 将 `steam-user` 的传递依赖固定在已修复符号链接覆盖公告的 `adm-zip` 0.6.1，并将 `protobufjs` 固定在 7.6.6。依赖升级后必须重新执行审计和完整测试。

## 数据源依据

- dotakit 的 `spectateFriend`、SourceTV 与登录接口：https://github.com/beekamai/dotakit#readme
- 英雄与物品 ID、名称和官方图片路径：https://github.com/odota/dotaconstants
- 英雄两两职业比赛胜场与样本量：https://api.opendota.com/api/heroes/93/matchups
- 英雄职业比赛分阶段物品购买次数：https://api.opendota.com/api/heroes/93/itemPopularity
- OpenDota 数据平台、Valve WebAPI 与自动录像解析来源：https://github.com/odota/core
- Steam 登录及刷新令牌行为：https://github.com/DoctorMcKay/node-steam-user
- Valve Dota 2 观战 protobuf：https://github.com/SteamDatabase/GameTracking-Dota2/blob/master/Protobufs/dota_gcmessages_client_watch.proto
- Valve 实时玩家与建筑坐标：https://github.com/SteamTracking/Protobufs/blob/master/dota2/dota_gcmessages_common.proto
- Dota 世界地图使用 16384 单位导航网格：https://github.com/SteamTracking/GameTracking-Dota2/blob/master/game/dota/dota.fgd
- 详细地图来自 OpenDota Web 的 7.40 地图资源：https://github.com/odota/web
- 小地图英雄图标来自 Dota `pak01_dir.vpk` 的英雄图标表：https://github.com/bontscho/dota2-minimap-hero-sprites
- [Electron BrowserWindow 与渲染沙箱](https://www.electronjs.org/docs/latest/api/browser-window)
- [electron-builder Windows 安装版与便携版目标](https://www.electron.build/docs/win/)
- [Node.js 环境文件参数](https://nodejs.org/api/cli.html#--env-file-if-existsfile)
- [Tesseract.js 本地 OCR worker](https://github.com/naptha/tesseract.js)

本项目与 Valve Corporation 无关联。

## 许可证

项目自行编写的源代码采用 [MIT License](LICENSE)。Dota 2 名称、英雄肖像、地图和其他在 `assets/DOTA_ASSET_SOURCES.md` 中注明的第三方素材不在本项目 MIT 授权范围内，其权利归 Valve Corporation 等原权利方所有。
