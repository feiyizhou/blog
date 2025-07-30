import type { DefaultTheme } from "vitepress";

export const sidebar: DefaultTheme.Config["sidebar"] = {
  "^/server/": [
    {
      text: "Go基础知识",
      collapsed: false,
      items: [
        { text: "数据类型", link: "/server/go/types" },
        { text: "类型转换", link: "/server/go/conversation" },
      ],
    },
  ],
};
