import { defineConfig } from "vitepress";

import { head, nav, sidebar } from "./configs";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  lang: "zh-CN",

  title: "Blog",

  description: "Feiyizhou's Blog",

  head,

  lastUpdated: true,

  cleanUrls: true,

  base: "/blog/",

  markdown: {
    lineNumbers: true,
    image: {
      lazyLoading: true,
    },
  },

  themeConfig: {
    i18nRouting: false,

    logo: "",

    nav,

    sidebar,

    search: { provider: "local" },

    socialLinks: [
      { icon: "github", link: "https://github.com/vuejs/vitepress" },
    ],

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
  },
});
