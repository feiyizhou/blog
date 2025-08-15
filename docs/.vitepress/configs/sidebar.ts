import type { DefaultTheme } from "vitepress";

export const sidebar: DefaultTheme.Config["sidebar"] = {
  "/go/": [
    {
      text: "Go基础知识",
      collapsed: false,
      items: [
        { text: "类型", link: "/go/type" },
        { text: "并发", link: "/go/concurrency" },
      ],
    },
  ],
  "/docker/": [
    {
      text: "Docker核心技术",
      collapsed: false,
      items: [
        { text: "Linux Namespace", link: "/docker/core/namespace" },
        { text: "Linux Cgroups", link: "/docker/core/cgroups" },
        { text: "Union File System", link: "/docker/core/unionfs" },
      ],
    },
  ],
};
