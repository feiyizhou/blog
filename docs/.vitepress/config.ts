import { defineConfig } from "vitepress";
import MarkdownPreview from "vite-plugin-markdown-preview";

import { head, nav, sidebar } from "./configs";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  lang: "zh-CN",

  title: "Feiyizhou's Blog",

  description:
    "费益洲的学习探索之路，包括Golang、k8s、Docker学习总结、库使用技巧及示例、源码阅读笔记、脚本使用示例等",

  head,

  lastUpdated: true,

  cleanUrls: true,

  ignoreDeadLinks: "localhostLinks",

  base: "/blog/",

  markdown: {
    lineNumbers: true,
    image: {
      lazyLoading: true,
    },
  },

  themeConfig: {
    i18nRouting: false,

    logo: "/logo.png",

    nav,

    sidebar,

    search: { provider: "local" },

    socialLinks: [{ icon: "github", link: "https://github.com/feiyizhou" }],

    outline: {
      level: "deep",
      label: "目录",
    },

    footer: {
      message: "如有转载或 CV 的请标注本站原文地址",
      copyright: "Copyright © 2025-present Feiyizhou",
    },

    lastUpdated: {
      text: "最后更新于",
      formatOptions: {
        dateStyle: "short",
        timeStyle: "medium",
      },
    },

    docFooter: {
      prev: "上一篇",
      next: "下一篇",
    },

    returnToTopLabel: "回到顶部",

    sidebarMenuLabel: "菜单",

    darkModeSwitchLabel: "主题",

    lightModeSwitchTitle: "切换到浅色模式",

    darkModeSwitchTitle: "切换到深色模式",

    visitor: {
      badgeId: "feiyizhou.blog",
    },

    comment: {
      repo: "feiyizhou/blog",
      repoId: "R_kgDOPSZ_vQ",
      category: "Announcements",
      categoryId: "DIC_kwDOPSZ_vc4CtnBj",
    },
  },

  sitemap: {
    hostname: "https://feiyizhou.github.io/blog/",
  },

  vite: {
    plugins: [MarkdownPreview()],
    css: {
      preprocessorOptions: {
        scss: {
          api: "modern-compiler",
        },
      },
    },
  },
});
