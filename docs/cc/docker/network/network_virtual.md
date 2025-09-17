![Docker](/docker/docker.png)

# Docker 网络详解：（一）Linux 网络虚拟化

大家好，我是费益洲。Docker 网络建立在 Linux 网络虚拟化技术之上，它利用了一系列 Linux 内核特性来为容器提供网络隔离和通信能力。本文将主要介绍 Docker 网络用到的一些 Linux 网络虚拟化技术。

## Network Namespace

> 💡 本文不再介绍 Network Namespace 的创建、初始化和回收机制等内容，感兴趣的同志可以移步往期文章【[Docker 核心技术：Linux Namespace](https://feiyizhou.github.io/blog/cc/docker/core/namespace)】查看

Network Namespace 是 Linux 网络虚拟化技术的基石。每个 Network Namespace 都拥有独立的网络设备、IP 地址、路由表、防火墙规则等。Docker 为每个容器（除使用 host 模式的容器外）分配一个独立的网络命名空间，从而实现容器间的网络隔离。由于每个容器的网络都是隔离的，这就使得在同一个主机上，可以同时运行多个监听相同端口的容器。

![Docker](/docker/network/network.png)

和其他 Namespace 一样，Network Namespace 可以通过系统调用来创建。但是和其他 Namespace 不同的地方是，Network Namespace 的增删改查功能都已经集成到了 Linux 的 ip 工具的 netns 子命令中。为了试验方便，后续将使用 ip 工具来创建和配置 Network Namespace。

**创建 Network Namespace**

默认情况下，当一个 Namespace 没有任何进程（或引用）在使用它时，会被内核回收和销毁。ip 工具并不是通过创建一个进程去维持 Network Namespace 的生命周期，而是通过文件挂载点来实现 Network Namespace 的持久化：

- 创建绑定点：在执行`ip netns add`命令时，会在`/var/run/netns`目录下创建一个与命名空间同名的空文件
- 绑定挂载：在调用系统函数创建了 Network Namespace 后，ip 命令会通过 `​​mount --bind`​​ 系统调用，将内核中代表新创建的网络命名空间的那个特殊对象绑定挂载到在`/var/run/netns`目录下创建的那个空文件上。这使得这个原本普通的文件 `/var/run/netns/[nsname] `变成了一个特殊的挂载点。读取这个文件就相当于访问了内核中对应的 Network Namespace 对象
- 维持引用：这个绑定挂载操作会使得内核即使在没有进程运行于该 Namespace 时，也因为挂载点的存在而保持对该 Namespace 的引用 ​​，从而防止其被自动回收

```bash
[root@master01 ~]# ip netns add test
```

通过上述命令，我们就可以创建一个名为`test`的 Network Namespace。
