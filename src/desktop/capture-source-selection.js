const SOURCE_ID = /^(?:window|screen):\d+:\d+$/;
const MANUAL_STATES = Object.freeze({
  "not-running": "未发现 dota2.exe；可先启动游戏，或手动选择显示器。",
  "no-visible-window": "dota2.exe 正在运行，但没有可见主窗口；请使用无边框窗口模式。",
  "source-unavailable": "已发现 Dota 2 窗口，但它暂时无法作为画面读取；可手动选择显示器。",
});

export function presentCaptureSources(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.sources) || value.sources.length > 512) {
    throw new TypeError("画面来源响应无效");
  }
  const sources = Object.freeze(value.sources.map((source) => {
    if (!source || typeof source !== "object" || !SOURCE_ID.test(source.id)) throw new TypeError("画面编号无效");
    if (typeof source.name !== "string" || !source.name || source.name.length > 160) throw new TypeError("画面名称无效");
    return Object.freeze({ id: source.id, name: source.name });
  }));
  const status = value.binding?.status;
  if (status === "bound") {
    if (!sources.some(({ id }) => id === value.binding.sourceId)) throw new RangeError("自动绑定的 Dota 2 画面不在来源列表中");
    return Object.freeze({
      sources,
      selectedId: value.binding.sourceId,
      message: "已自动锁定 dota2.exe 的可见窗口。",
      tone: "success",
    });
  }
  const message = MANUAL_STATES[status];
  if (!message) throw new TypeError("Dota 2 自动绑定状态无效");
  return Object.freeze({ sources, selectedId: "", message, tone: "warning" });
}
