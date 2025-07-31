import type { DefaultTheme } from "vitepress";

export const nav: DefaultTheme.Config["nav"] = [
  { text: "首页", link: "/index" },
  { text: "导航", link: "/nav", activeMatch: "^/nav" },
  {
    text: "后端物语",
    items: [
      { text: "Go", link: "/server/go/des" },
      { text: "库", link: "/server/lib/des" },
      { text: "Shell", link: "/server/shell/awk" },
    ],
    activeMatch: "^/server/",
  },
  {
    text: "云计算",
    items: [
      { text: "Docker", link: "/cc/docker/des" },
      { text: "k8s", link: "/cc/k8s/des" },
      { text: "CRI", link: "/cc/cri/des" },
      { text: "CNI", link: "/cc/cni/des" },
      { text: "CSI", link: "/cc/csi/des" },
    ],
    activeMatch: "^/cc/",
  },
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
  { text: "About Me", link: "/feiyizhou" },
];
