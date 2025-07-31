---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Feiyizhou"
  text: "Feiyizhou"
  tagline: My great project tagline
  actions:
    - theme: brand
      text: Markdown Examples
      link: /markdown-examples
    - theme: alt
      text: API Examples
      link: /api-examples

features:
  - title: Feature A 123
    icon: 📖
    details: Lorem ipsum dolor sit amet, consectetur adipiscing elit
  - title: Feature B
    details: Lorem ipsum dolor sit amet, consectetur adipiscing elit
  - title: Feature C
    details: Lorem ipsum dolor sit amet, consectetur adipiscing elit
---

<!-- <script setup>
import MFriends from './home/MFriends.vue'
</script>

<ClientOnly>
  <MFriends/>
</ClientOnly>

::: details 申请友链

**友链要求**:

- 网站应保持清洁，避免过多广告内容
- 网站需要有良好的稳定性和可靠性

**申请方式**:

1. 在本页面留言
2. 直接访问 [GitHub 友链申请页面](https://github.com/maomao1996/mm-notes/issues/95) 提交您的申请

**本站信息**：

- 网站名称: **茂茂物语**
- 网站描述: **茂茂的成长之路，包含前端常用知识、源码阅读笔记、各种奇淫技巧、日常提效工具等**
- 网站地址：**<https://notes.fe-mm.com>**
- 网站图标：**<https://notes.fe-mm.com/logo.png>**

```json
{
  "title": "茂茂物语",
  "desc": "茂茂的成长之路，包含前端常用知识、源码阅读笔记、各种奇淫技巧、日常提效工具等",
  "link": "https://notes.fe-mm.com",
  "icon": "https://notes.fe-mm.com/logo.png"
}
```

::: -->

<style>
.m-home-layout .image-src:hover {
  transform: translate(-50%, -50%) rotate(666turn);
  transition: transform 59s 1s cubic-bezier(0.3, 0, 0.8, 1);
}

.m-home-layout .details small {
  opacity: 0.8;
}

.m-home-layout .item:last-child .details {
  display: flex;
  justify-content: flex-end;
  align-items: end;
}
</style>
