import type { DefaultTheme } from "vitepress";

export const nav: DefaultTheme.Config["nav"] = [
  { text: "首页", link: "/index" },
  // { text: "导航", link: "/nav", activeMatch: "^/nav" },
  {
    text: "📚Golang",
    items: [
      { text: "Go基础知识", link: "/go/base/type" },
      { text: "Go常用库及框架", link: "/go/lib/gin" },
    ],
    activeMatch: "^/go/",
  },
  {
    text: "☁️云计算",
    items: [
      {
        text: "Docker",
        items: [
          { text: "Docker核心技术", link: "/cc/docker/core/namespace" },
          { text: "Dockerfile", link: "/cc/docker/dockerf" },
        ],
      },
      {
        text: "Kubernetes",
        items: [
          { text: "工作负载", link: "/cc/k8s/resource/pod" },
          { text: "operator", link: "/cc/k8s/operator/crd" },
        ],
      },
      {
        text: "helm",
        link: "/cc/helm/cmd",
      },
    ],
    activeMatch: "^/cc/",
  },
  {
    text: "📑源码阅读",
    items: [],
    activeMatch: "^/sc/",
  },
  {
    text: "🤖AI",
    items: [{ text: "agent", link: "/ai/agent" }],
    activeMatch: "^/ai/",
  },
  {
    text: "📖日常笔记",
    items: [{ text: "个性徽章", link: "/daily-note/shields" }],
    activeMatch: "^/daily-note/",
  },
  { text: "🙋‍♂️About Me", link: "/feiyizhou" },
];
