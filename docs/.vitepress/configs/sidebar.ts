import type { DefaultTheme } from "vitepress";

export const sidebar: DefaultTheme.Config["sidebar"] = {
  "/go/": [
    {
      text: "Go基础知识",
      collapsed: false,
      items: [
        { text: "类型", link: "/go/base/type" },
        { text: "并发", link: "/go/base/concurrency" },
      ],
    },
    {
      text: "Go常用库及框架",
      collapsed: false,
      items: [
        { text: "gin", link: "/go/lib/gin" },
        { text: "cobra", link: "/go/lib/cobra" },
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
    { text: "Dockerfile", collapsed: false, link: "/docker/dockerf" },
  ],
  "/k8s/": [
    {
      text: "部署",
      items: [
        { text: "k8s集群", link: "/k8s/deploy/cluster" },
        { text: "StorageClass", link: "/k8s/deploy/storageclass" },
        { text: "Purelb", link: "/k8s/deploy/purelb" },
      ],
    },
    {
      text: "工作负载",
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
      items: [{ text: "crd", link: "/k8s/operator/crd" }],
    },
    {
      text: "helm",
      items: [
        { text: "命令行", link: "/k8s/helm/cmd" },
        { text: "模板编写技巧", link: "/k8s/helm/template" },
      ],
    },
  ],
};
