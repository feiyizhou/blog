import type { DefaultTheme } from "vitepress";

export const nav: DefaultTheme.Config["nav"] = [
  { text: "首页", link: "/index" },
  // { text: "导航", link: "/nav", activeMatch: "^/nav" },
  {
    text: "Golang",
    items: [
      {
        text: "Go基础知识",
        items: [
          { text: "类型", link: "/go/type" },
          { text: "并发", link: "/go/concurrency" },
        ],
      },
    ],
    activeMatch: "^/go/",
  },
  {
    text: "Docker",
    items: [
      {
        text: "Docker核心技术",
        items: [
          { text: "namespace", link: "/docker/core/namespace" },
          { text: "cgroups", link: "/docker/core/cgroups" },
          { text: "unionfs", link: "/docker/core/unionfs" },
        ],
      },
      { text: "Dockerfile", link: "/docker/dockerf" },
    ],
    activeMatch: "^/docker/",
  },
  {
    text: "k8s",
    items: [
      {
        text: "部署",
        items: [
          { text: "集群", link: "/k8s/deploy/cluster" },
          { text: "StorageClass", link: "/k8s/deploy/storageclass" },
          { text: "Purelb", link: "/k8s/deploy/purelb" },
        ],
      },
      {
        text: "资源",
        items: [
          { text: "pod", link: "/k8s/resource/pod" },
          { text: "deployment", link: "/k8s/resource/deployment" },
          { text: "daemonset", link: "/k8s/resource/daemonset" },
          { text: "job", link: "/k8s/resource/job" },
          { text: "statefulset", link: "/k8s/resource/statefulset" },
        ],
      },
      {
        text: "operator",
        items: [
          { text: "crd", link: "/k8s/operator/crd" },
          { text: "kube-builder", link: "/k8s/operator/kube-builder" },
        ],
      },
      {
        text: "helm",
        items: [
          { text: "命令行", link: "/k8s/helm/cmd" },
          { text: "模板编写技巧", link: "/k8s/helm/template" },
        ],
      },
    ],
    activeMatch: "^/k8s/",
  },
  {
    text: "库",
    items: [
      { text: "gin", link: "/lib/gin" },
      { text: "gorm", link: "/lib/gorm" },
    ],
    activeMatch: "^/lib/",
  },
  {
    text: "源码阅读",
    items: [
      { text: "runc", link: "/sc/runc" },
      { text: "k8s", link: "/sc/k8s" },
    ],
    activeMatch: "^/sc/",
  },
  {
    text: "AI",
    items: [{ text: "agent", link: "/ai/agent" }],
    activeMatch: "^/ai/",
  },
  // {
  //   text: "日常笔记",
  //   items: [{ text: "vitepress", link: "/daily-note/vitepress" }],
  //   activeMatch: "^/daily-note/",
  // },
  { text: "About Me", link: "/feiyizhou" },
];
