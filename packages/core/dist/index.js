// packages/core/src/index.ts
function base64UrlEncode(input) {
  if (typeof btoa === "function") {
    return btoa(input).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  }
  return Buffer.from(input, "utf8").toString("base64").replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
function base64UrlDecodeToString(input) {
  const padded = input.replaceAll("-", "+").replaceAll("_", "/");
  const padding = "=".repeat((4 - padded.length % 4) % 4);
  if (typeof atob === "function") return atob(padded + padding);
  return Buffer.from(padded + padding, "base64").toString("utf8");
}
export {
  base64UrlDecodeToString,
  base64UrlEncode
};
//# sourceMappingURL=index.js.map
