import type { HeadConfig } from "vitepress";

export const head: HeadConfig[] = [
  ["meta", { name: "theme-color", content: "#3eaf7c" }],
  ["meta", { name: "apple-mobile-web-app-capable", content: "yes" }],
  ["meta", { name: "apple-mobile-web-app-status-bar-style", content: "black" }],
  ["meta", { name: "msapplication-TileColor", content: "#000000" }],
  ["meta", { name: "msapplication-TileImage", content: "/blog/favicon.ico" }],
  ["meta", { name: "baidu-site-verification", content: "codeva-Whjnr38WFE" }],
  ["link", { rel: "apple-touch-icon", href: "/favicon.ico" }],
  ["link", { rel: "mask-icon", href: "/blog/favicon.ico", color: "#3eaf7c" }],
  ["link", { rel: "manifest", href: "/blog/manifest.webmanifest" }],
];
