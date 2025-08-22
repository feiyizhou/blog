import type { DefaultTheme } from "vitepress";

export const nav: DefaultTheme.Config["nav"] = [
  { text: "首页", link: "/index" },
  // { text: "导航", link: "/nav", activeMatch: "^/nav" },
  {
    text: "Golang",
    items: [
      { text: "Go基础知识", link: "/go/base/type" },
      { text: "Go常用库及框架", link: "/go/lib/gin" },
    ],
    activeMatch: "^/go/",
  },
  {
    text: "Docker",
    items: [
      { text: "Docker核心技术", link: "/docker/core/namespace" },
      { text: "Dockerfile", link: "/docker/dockerf" },
    ],
    activeMatch: "^/docker/",
  },
  {
    text: "k8s",
    items: [
      { text: "部署", link: "/k8s/deploy/cluster" },
      { text: "工作负载", link: "/k8s/resource/pod" },
      { text: "operator", link: "/k8s/operator/crd" },
      { text: "helm", link: "/k8s/helm/cmd" },
    ],
    activeMatch: "^/k8s/",
  },
  // {
  //   text: "源码阅读",
  //   items: [
  //     { text: "runc", link: "/sc/runc" },
  //     { text: "k8s", link: "/sc/k8s" },
  //   ],
  //   activeMatch: "^/sc/",
  // },
  {
    text: "AI",
    items: [{ text: "agent", link: "/ai/agent" }],
    activeMatch: "^/ai/",
  },
  {
    text: "日常笔记",
    items: [{ text: "个性小牌子", link: "/daily-note/shields" }],
    activeMatch: "^/daily-note/",
  },
  { text: "About Me", link: "/feiyizhou" },
];
