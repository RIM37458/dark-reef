const packageJson = require("../package.json");

const VARIANTS = Object.freeze({
  formal: Object.freeze({
    appId: "com.codex.dota-friend-watcher",
    productName: "暗黑之礁",
    artifactLabel: "Formal",
  }),
  demo: Object.freeze({
    appId: "com.codex.dota-friend-watcher.demo",
    productName: "暗黑之礁演示回廊",
    artifactLabel: "Demo",
  }),
});

function createVariantBuild(id) {
  const variant = VARIANTS[id];
  if (!variant) throw new RangeError("Unknown build variant");
  const base = packageJson.build;
  const artifactPrefix = `Dota2-Dark-Reef-${variant.artifactLabel}`;
  return {
    ...base,
    appId: variant.appId,
    productName: variant.productName,
    extraMetadata: { appVariant: id, productName: variant.productName },
    directories: { ...base.directories, output: `release/${id}` },
    nsis: {
      ...base.nsis,
      artifactName: `${artifactPrefix}-\${version}-\${arch}-Setup.\${ext}`,
      shortcutName: variant.productName,
      uninstallDisplayName: `${variant.productName} \${version}`,
    },
    portable: {
      ...base.portable,
      artifactName: `${artifactPrefix}-\${version}-\${arch}-Portable.\${ext}`,
    },
  };
}

module.exports = { createVariantBuild };
