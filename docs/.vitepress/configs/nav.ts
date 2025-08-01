import { text } from "stream/consumers";
import type { DefaultTheme } from "vitepress";

export const nav: DefaultTheme.Config["nav"] = [
  { text: "首页", link: "/index" },
  // { text: "导航", link: "/nav", activeMatch: "^/nav" },
  {
    text: "Go",
    items: [
      { text: "类型", link: "/go/type" },
      { text: "并发", link: "/go/concurrency" },
    ],
    activeMatch: "^/go/",
  },
  {
    text: "Docker",
    items: [
      {
        text: "Usage",
        items: [
          { text: "镜像", link: "/docker/usage/image" },
          { text: "容器", link: "/docker/usage/container" },
          { text: "docker-compose", link: "/docker/usage/docker-compose" },
        ],
      },
      {
        text: "核心原理",
        items: [
          { text: "namespace", link: "/docker/core/namespace" },
          { text: "cgroups", link: "/docker/core/cgroups" },
          { text: "rootfs", link: "/docker/core/rootfs" },
        ],
      },
      { text: "Dockerfile", link: "/docker/dockerf" },
    ],
    activeMatch: "^/docker/",
  },
  { text: "k8s", items: [], activeMatch: "^/k8s/" },
  {
    text: "库",
    items: [
      { text: "gin", link: "/lib/gin" },
      { text: "gorm", link: "/lib/gorm" },
    ],
    activeMatch: "^/lib/",
  },
  { text: "Shell", link: "/shell/awk", activeMatch: "^/shell/" },
  {
    text: "源码阅读",
    items: [],
    activeMatch: "^/sc/",
  },
  {
    text: "AI",
    items: [],
    activeMatch: "^/ai/",
  },
  {
    text: "日常笔记",
    items: [],
    activeMatch: "^/daily-note/",
  },
  { text: "About Me", link: "/feiyizhou" },
];
