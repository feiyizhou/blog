import { defineConfig } from "vitepress";

import { nav } from "./configs/nav";
import { sidebar } from "./configs/siderbar";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  lang: "zh-CN",

  title: "Blog",

  description: "Feiyizhou's Blog",

  lastUpdated: true,

  cleanUrls: true,

  base: "/blog/",

  /* markdown 配置 */
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

    outline: {
      level: "deep",
      label: "目录",
    },

    footer: {
      message: "如有转载或 CV 的请标注本站原文地址",
      copyright: "Copyright © 2019-present maomao",
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
