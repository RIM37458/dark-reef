const VARIANTS = Object.freeze({
  formal: Object.freeze({
    id: "formal",
    appId: "com.codex.dota-friend-watcher",
    productName: "暗黑之礁",
    title: "暗黑之礁",
    userDataDirectory: "dota-friend-watcher",
    allowsMonitoring: true,
    allowsAssistant: true,
    allowsDemo: false,
  }),
  demo: Object.freeze({
    id: "demo",
    appId: "com.codex.dota-friend-watcher.demo",
    productName: "暗黑之礁演示回廊",
    title: "暗黑之礁 · 演示回廊",
    userDataDirectory: "dota-friend-watcher-demo",
    allowsMonitoring: false,
    allowsAssistant: false,
    allowsDemo: true,
  }),
});

export function resolveAppVariant(value = "formal") {
  const variant = VARIANTS[value];
  if (!variant) throw new RangeError("未知应用版本");
  return variant;
}
