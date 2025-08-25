![Docker](/daily-note/shields/shields.png)

# 用 Shields.io 定制 README 个性徽章

Github 项目中，可以看到很多 README 文档中都会有各式各样的`徽章`。我们可以借助这些`徽章`来显示某些状态。这些`徽章`，从原理上来说，都是我们给`渲染服务器`提供一些数据，然后`渲染服务器`会返回给我们一个 SVG 格式的图片，然后我们将图片嵌入 MD 文档中，即可渲染出来定制的`徽章`。

## 简介

Shields.io 就是一个主流的`渲染服务器`，可以在[官网](https://shields.io/)上查看官方文档。总的来说，定制`徽章`的主要工作就是拼接符合`渲染服务器`规则的 URL，拼接好 URL 后，我们只要将 URL 嵌入 MD 文档即可。接下来简单介绍符合 Shields.io 规则的 URL 拼接方法。

## 静态徽章

> 静态徽章即徽章内容是固定不变的

### 基本规则

shields.io 的 URL 的基本规则即：`base url` + `定制参数`:

- base url: https://img.shields.io/badge/
- 定制参数：定制参数根据徽章的颜色区间分为三部分，使用`-`间隔，分别为：
  - 左半部分标签：空格使用`_`代替，shields.io 会自动解析为空格
  - 右半部分标签：空格使用`_`代替，shields.io 会自动解析为空格
  - 右半部分颜色：支持十六进制（不带`#`）/颜色名称

整体结构如下所示：

```http
https://img.shields.io/badge/{左半部分}-{右半部分}-{右半部分颜色}
```

我们以左半部分为`feiyizhou`，右半部分为`个人博客`，颜色为`蓝色`为例:

```http
https://img.shields.io/badge/feiyizhou-个人博客-blue
```

在浏览器访问后即可看到下图：

![Docker](/daily-note/shields/feiyizhou-个人博客-blue.png)

⚠️ 颜色指定需要注意以下两个规则：

- 如果需要指定左半部分，那么整个徽章只能是作为一个整体进行渲染（不再存在右半部分）
- 左右两部分不能同时指定颜色，否则 shields 会解析异常

作为一个整体的徽章，整体规则如下所示：

```http
https://img.shields.io/badge/{标签}-{颜色}
```

我们以标签为`feiyizhou`，颜色为`黑色`为例:

```http
https://img.shields.io/badge/feiyizhou-black
```

在浏览器访问后即可看到下图：

![Docker](/daily-note/shields/feiyizhou-black.png)

### 增加 logo

增加 logo 的方式可以查看[官方文档](https://shields.io/docs/logos#custom-logos)，此处做简单介绍总结。在上一步基础规则下，增加两个参数，即可为`徽章`增加指定的 logo：

- logo：格式为 svg 的 logo 图片的名称
- logoColor：logo 图片的颜色，支持十六进制（不带`#`）/颜色名称

增加 logo 后的整体结构如下所示：

```http
https://img.shields.io/badge/{左半部分}-{右半部分}-{右半部分颜色}?logo={logo名称}&logoColor={logo颜色}
```

#### 基础 logo

shields.io 支持[SimpleIcons](https://simpleicons.org/)网站里的所有 logo，用户可以在网站内搜索自己想要的 logo。也可以在 github 项目[simple-icons](https://github.com/simple-icons/simple-icons)中，搜索想要的 logo。

我们以熟练使用 etcd 为例，定制一个左半部分为`Etcd`，右半部分为`熟练`颜色为`绿色`，logo 颜色为`白色`的`徽章`，URL 如下所示：

```http
https://img.shields.io/badge/Etcd-熟练-green?logo=etcd&logoColor=white
```

在浏览器访问后即可看到下图：

![Docker](/daily-note/shields/etcd-熟练-green.png)

#### 定制 logo

shields.io 除了支持 SimpleIcons 中的 logo，还支持通过 base64 格式的数据指定 logo，需要做的就是将 svg 转为 base64 格式的数据，带入 URL 中即可。

通过 base64 格式增加 log 的整体格式如下所示：

```http
https://img.shields.io/badge/{左半部分}-{右半部分}-{右半部分颜色}?logo=data:image/svg+xml;base64,{base64数据}
```

我们以熟练使用 SQLite 为例，定制一个左半部分为`SQLite`，右半部分为`熟悉`颜色为`黄色`的`徽章`，URL 如下所示：

```http
https://img.shields.io/badge/SQLite-熟悉-yellow?logo=data:image/svg+xml;base64,PHN2ZyByb2xlPSJpbWciIHZpZXdCb3g9IjAgMCAyNCAyNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48dGl0bGU+U1FMaXRlPC90aXRsZT48cGF0aCBkPSJNMjEuNjc4LjUyMWMtMS4wMzItLjkyLTIuMjgtLjU1LTMuNTEzLjU0NGE4LjcxIDguNzEgMCAwIDAtLjU0Ny41MzVjLTIuMTA5IDIuMjM3LTQuMDY2IDYuMzgtNC42NzQgOS41NDQuMjM3LjQ4LjQyMiAxLjA5My41NDQgMS41NjFhMTMuMDQ0IDEzLjA0NCAwIDAgMSAuMTY0LjcwM3MtLjAxOS0uMDcxLS4wOTYtLjI5NmwtLjA1LS4xNDZhMS42ODkgMS42ODkgMCAwIDAtLjAzMy0uMDhjLS4xMzgtLjMyLS41MTgtLjk5NS0uNjg2LTEuMjg5LS4xNDMuNDIzLS4yNy44MTgtLjM3NiAxLjE3Ni40ODQuODg0Ljc3OCAyLjQuNzc4IDIuNHMtLjAyNS0uMDk5LS4xNDctLjQ0MmMtLjEwNy0uMzAzLS42NDQtMS4yNDQtLjc3Mi0xLjQ2NC0uMjE3LjgwNC0uMzA0IDEuMzQ2LS4yMjYgMS40NzguMTUyLjI1Ni4yOTYuNjk4LjQyMiAxLjE4Ni4yODYgMS4xLjQ4NSAyLjQ0LjQ4NSAyLjQ0bC4wMTcuMjI0YTIyLjQxIDIyLjQxIDAgMCAwIC4wNTYgMi43NDhjLjA5NSAxLjE0Ni4yNzMgMi4xMy41IDIuNjU3bC4xNTUtLjA4NGMtLjMzNC0xLjAzOC0uNDctMi4zOTktLjQxLTMuOTY3LjA5LTIuMzk4LjY0Mi01LjI5IDEuNjYxLTguMzA0IDEuNzIzLTQuNTUgNC4xMTMtOC4yMDEgNi4zLTkuOTQ1LTEuOTkzIDEuOC00LjY5MiA3LjYzLTUuNSA5Ljc4OC0uOTA0IDIuNDE2LTEuNTQ1IDQuNjg0LTEuOTMxIDYuODU3LjY2Ni0yLjAzNyAyLjgyMS0yLjkxMiAyLjgyMS0yLjkxMnMxLjA1Ny0xLjMwNCAyLjI5Mi0zLjE2NmMtLjc0LjE2OS0xLjk1NS40NTgtMi4zNjIuNjI5LS42LjI1MS0uNzYyLjMzNy0uNzYyLjMzN3MxLjk0NS0xLjE4NCAzLjYxMy0xLjcyQzIxLjY5NSA3LjkgMjQuMTk1IDIuNzY3IDIxLjY3OC41MjFtLTE4LjU3My41NDNBMS44NDIgMS44NDIgMCAwIDAgMS4yNyAyLjl2MTYuNjA4YTEuODQgMS44NCAwIDAgMCAxLjgzNSAxLjgzNGg5LjQxOGEyMi45NTMgMjIuOTUzIDAgMCAxLS4wNTItMi43MDdjLS4wMDYtLjA2Mi0uMDExLS4xNDEtLjAxNi0uMmEyNy4wMSAyNy4wMSAwIDAgMC0uNDczLTIuMzc4Yy0uMTIxLS40Ny0uMjc1LS44OTgtLjM2OS0xLjA1Ny0uMTE2LS4xOTctLjA5OC0uMzEtLjA5Ny0uNDMyIDAtLjEyLjAxNS0uMjQ1LjAzNy0uMzg2YTkuOTggOS45OCAwIDAgMSAuMjM0LTEuMDQ1bC4yMTctLjAyOGMtLjAxNy0uMDM1LS4wMTQtLjA2NS0uMDMxLS4wOTdsLS4wNDEtLjM4MWEzMi44IDMyLjggMCAwIDEgLjM4Mi0xLjE5NGwuMi0uMDE5Yy0uMDA4LS4wMTYtLjAxLS4wMzgtLjAxOC0uMDUzbC0uMDQzLS4zMTZjLjYzLTMuMjggMi41ODctNy40NDMgNC44LTkuNzkxLjA2Ni0uMDY5LjEzMy0uMTI4LjE5OC0uMTk0WiIvPjwvc3ZnPg==
```

在浏览器访问后即可看到下图：

![Docker](/daily-note/shields/sqlite-熟悉-yellow.png)

⚠️ 需要注意的时，如果使用 base64 数据传递 logo，参数`logoColor`则会失效

## 动态徽章

> 动态徽章是相对于静态徽章的，即徽章内容是动态渲染的，所以内容也是可以发生变化的

shields.io 提供了多种动态徽章的使用方式，比较常用的有两种：一种是指定获取特定格式数据的 URL，并指定需要解析的参数以及徽章的各类参数，最后由 shields 动态渲染。另外一种就是一些指定平台的指定参数的动态渲染。

📚 关于动态徽章的使用[官方文档](https://shields.io/badges/dynamic-json-badge)已经做了很详细的说明，而且有详细的样例，同志们可以自行查阅观看。shields 还支持 TOML、XML、YAML 等格式的数据，下面简单的对解析 JSON 格式数据的动态徽章和特定平台的动态徽章做简单总结性介绍。

### Dynamic JSON Badge

> 通过指定的 URL 获取 JSON 数据，并解析出需要的数据并动态渲染数据。

整体结构体如下所示：

```http
https://img.shields.io/badge/dynamic/json
```

参数较多，这里只列举两个必填参数

- url：获取 json 数据的地址，eg：https://github.com/badges/shields/raw/master/package.json
- query：解析 json 数据的表达式，eg：$.name

指定部分参数后，整体 URL 如下所示：

```http
https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fgithub.com%2Fbadges%2Fshields%2Fraw%2Fmaster%2Fpackage.json&query=%24.homepage&style=flat&logo=appveyor&logoColor=white&label=homepage&labelColor=black&color=blue
```

在浏览器访问后即可看到下图：

![Docker](/daily-note/shields/shields-homepage.png)

💡 动态徽章里面比较特殊的就是 Endpoint Badge。这中动态徽章支持用户自己搭建徽章数据响应站点，shields 通过这个站点获取到数据后再进行动态渲染。需要注意的是，响应的数据需要遵从 shields 的参数要求。具体使用方式及参数要求同志们可以自行查阅[官方文档](https://shields.io/badges/endpoint-badge)

### Github followers

> 这个动态徽章就只是用来显示指定用户的 GitHub 的 follower 数量

整体结构如下所示：

```http
https://img.shields.io/github/followers/{Github用户名}
```

以我自己为例，URL 如下所示：

```http
https://img.shields.io/github/followers/feiyizhou
```

在浏览器访问后即可看到下图：

![Docker](/daily-note/shields/feiyizhou-followers.png)
