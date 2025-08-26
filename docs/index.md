---
layout: home
layoutClass: "m-home-layout"

hero:
  name: "Feiyizhou's Blog"
  text: "费益州个人成长之路"
  tagline: 日拱一卒无有尽，功不唐捐终入海
  image:
    src: /logo.png
    alt: 费益州个人成长之路
  actions:
    - text: 前端物语
      link: /fe/es6/
    - text: 前端导航
      link: /nav
      theme: alt
    - text: 日常笔记
      link: /daily-notes/
    - text: mmPlayer
      link: https://netease-music.fe-mm.com
      theme: alt

features:
  - icon: 📚
    title: Golang
    details: 整理常用知识点<small><br />面试八股文/使用技巧等，如有异议按你的理解为主，不接受反驳</small>
    link: /go/base/type
    linkText: Golang
  - icon: 📦
    title: Docker
    details: 学习与Docker相关的技术<br /><small>核心技术/实现原理/使用技巧等</small>
    link: /cc/docker/core/namespace
    linkText: Docker
  - icon: 🚢
    title: Kubernetes
    details: 学习与kubernetes相关的技术<br /><small>核心技术/实现原理/使用技巧等</small>
    link: /cc/k8s/resource/pod
    linkText: Kubernetes
  - icon: 📑
    title: 源码阅读
    details: 记录学习过程中，对源码的理解<br /><small>知其然，知其所以然</small>
    link: /sc/runc
    linkText: 源码阅读
  - icon: 🤖
    title: AI
    details: 分享一些AI相关的技术和想法<br /><small>i am a robot 🤖</small>
    link: /ai/agent
    linkText: AI
  - icon: 🎉
    title: 日拱一卒无有尽，功不唐捐终入海
    details: '<small class="bottom-small">一个想躺平的小开发</small>'
    link: /feiyizhou
---

<script setup>
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
2. 直接访问 [GitHub 友链申请页面](https://github.com/feiyizhou/blog/issues/3) 提交您的申请

**本站信息**：

- 网站名称: **费益洲博客**
- 网站描述: **费益洲的学习探索之路，包括 Golang、k8s、Docker 学习总结、库使用技巧及示例、源码阅读笔记、脚本使用示例等**
- 网站地址：**<https://feiyizhou.github.io/blog>**
- 网站图标：**<https://feiyizhou.github.io/blog/logo.png>**

```json
{
  "title": "费益洲博客",
  "desc": "费益洲的学习探索之路，包括Golang、k8s、Docker学习总结、库使用技巧及示例、源码阅读笔记、脚本使用示例等",
  "link": "https://feiyizhou.github.io/blog",
  "icon": "https://feiyizhou.github.io/blog/logo.png"
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
