import type { DefaultTheme } from "vitepress";

export const sidebar: DefaultTheme.Config["sidebar"] = {
  "/go/": [
    {
      text: "Go基础知识",
      items: [
        { text: "类型", link: "/go/base/type" },
        { text: "并发", link: "/go/base/concurrency" },
      ],
    },
    {
      text: "Go常用库及框架",
      items: [
        { text: "gin", link: "/go/lib/gin" },
        { text: "cobra", link: "/go/lib/cobra" },
      ],
    },
  ],
  "/cc/": [
    {
      text: "Docker",
      items: [
        {
          text: "Docker核心技术",
          collapsed: false,
          items: [
            { text: "Linux Namespace", link: "/cc/docker/core/namespace" },
            { text: "Linux Cgroups", link: "/cc/docker/core/cgroups" },
            { text: "Union File System", link: "/cc/docker/core/unionfs" },
          ],
        },
        { text: "Dockerfile", collapsed: false, link: "/cc/docker/dockerf" },
      ],
    },
    {
      text: "Kubernetes",
      items: [
        {
          text: "工作负载",
          collapsed: false,
          items: [
            { text: "pod", link: "/cc/k8s/resource/pod" },
            { text: "deployment", link: "/cc/k8s/resource/deployment" },
            { text: "daemonset", link: "/cc/k8s/resource/daemonset" },
            { text: "job", link: "/cc/k8s/resource/job" },
            { text: "statefulset", link: "/cc/k8s/resource/statefulset" },
          ],
        },
        {
          text: "operator",
          collapsed: false,
          items: [{ text: "crd", link: "/cc/k8s/operator/crd" }],
        },
      ],
    },
    {
      text: "helm",
      items: [
        { text: "命令行", link: "/cc/helm/cmd" },
        { text: "模板编写技巧", link: "/cc/helm/template" },
      ],
    },
  ],
  "/daily-note/": [{ text: "个性徽章", link: "/daily-note/shields" }],
};
