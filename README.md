# Dota 2 好友比赛监测器

这是一个无需启动 Dota 2 桌面客户端的本地后台服务。它使用专用 Steam 账号连接 Dota 2 Game Coordinator，尝试观战指定好友，并把当前状态输出为 JSON。

## 能得到什么

- 好友当前是否存在可观战比赛
- 观战请求的结果和 `serverSteamId`
- 如果比赛进入 Valve SourceTV 热门列表：比赛 ID、时间、比分、经济领先等快照
- 如果配置 Steam Web API Key 且 Valve 为该服务器提供统计：`GetRealtimeStats` 的完整 JSON

普通路人局通常不在 SourceTV 热门列表中。这时服务会保留服务器 ID，并返回 `spectating_unlisted`；这不是程序故障，而是 Valve 当前的数据边界。

## 准备工作

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

```powershell
pnpm start
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
```

测试不需要真实 Steam 账号，也不会访问 Steam。

锁文件通过 pnpm override 将 `steam-user` 的传递依赖固定在已修复安全公告的 `adm-zip` 0.6.0 和 `protobufjs` 7.6.6；升级依赖后应重新执行审计和测试。

## 数据源依据

- dotakit 的 `spectateFriend`、SourceTV 与登录接口：https://github.com/beekamai/dotakit#readme
- Steam 登录及刷新令牌行为：https://github.com/DoctorMcKay/node-steam-user
- Valve Dota 2 观战 protobuf：https://github.com/SteamDatabase/GameTracking-Dota2/blob/master/Protobufs/dota_gcmessages_client_watch.proto
- Node.js 环境文件参数：https://nodejs.org/api/cli.html#--env-file-if-existsfile

本项目与 Valve Corporation 无关联。
