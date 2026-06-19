const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// CSS support for NativeWind v4
// withNativeWind is used when lightningcss native binary is available.
// On Windows, if the binary is missing, Metro falls back to Babel-only transform.
try {
  const { withNativeWind } = require("nativewind/metro");
  module.exports = withNativeWind(config, { input: "./global.css" });
} catch (e) {
  console.warn("[metro] NativeWind metro transform unavailable, using Babel fallback:", e.message);
  module.exports = config;
}