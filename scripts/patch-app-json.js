// Usage: node scripts/patch-app-json.js com.yourname.listify
// Merges app identifiers and camera/photo permission texts into your existing app.json.
const fs = require("fs");
const id = process.argv[2];
if (!id || !/^[a-z][a-z0-9]*(\.[a-z][a-z0-9_]*)+$/i.test(id)) {
  console.error("Usage: node scripts/patch-app-json.js com.yourname.listify");
  process.exit(1);
}
const json = JSON.parse(fs.readFileSync("app.json", "utf8"));
const e = json.expo ?? (json.expo = {});
e.name = "Listify";
e.scheme = "listify";
e.version = e.version || "1.0.0";
e.ios = { ...(e.ios || {}), bundleIdentifier: id, supportsTablet: false };
e.android = { ...(e.android || {}), package: id };
const plugins = (e.plugins || []).filter((p) => (Array.isArray(p) ? p[0] : p) !== "expo-image-picker");
plugins.push(["expo-image-picker", {
  photosPermission: "Listify uses your photos so you can create listings from pictures of items you sell.",
  cameraPermission: "Listify uses the camera so you can photograph items you want to list.",
}]);
e.plugins = plugins;
fs.writeFileSync("app.json", JSON.stringify(json, null, 2) + "\n");
console.log("app.json updated with identifier", id);
