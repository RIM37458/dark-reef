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
      title: "侵蚀雾霭：目标已显形",
      body: `斯拉达已为囚徒点灯，战场进入监视${server}。`,
    });
    notification.on("click", onClick);
    notification.show();
    return true;
  };
}

export function createConfiguredDesktopNotifier({ enabled, NotificationImpl, onClick }) {
  return enabled
    ? createDesktopNotifier({ NotificationImpl, onClick })
    : () => false;
}
