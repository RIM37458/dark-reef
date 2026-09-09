const FOUND_PHASES = new Set(["spectating_unlisted", "detailed_stats"]);

export function shouldNotifyGameFound(previous, next) {
  return !FOUND_PHASES.has(previous?.phase) && FOUND_PHASES.has(next?.phase);
}

export function createDesktopNotifier({ NotificationImpl, onClick = () => {} }) {
  return (status) => {
    if (!NotificationImpl?.isSupported()) return false;

    const server = /^\d{1,20}$/.test(String(status?.serverSteamId ?? ""))
      ? `（服务器 ${status.serverSteamId}）`
      : "";
    const notification = new NotificationImpl({
      title: "Dota 2 好友已开局",
      body: `已发现可观战比赛${server}。`,
    });
    notification.on("click", onClick);
    notification.show();
    return true;
  };
}
