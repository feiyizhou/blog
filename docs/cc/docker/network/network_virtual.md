![Docker](/docker/docker.png)

# Docker 网络详解：（一）Linux 网络虚拟化

大家好，我是费益洲。Docker 网络建立在 Linux 网络虚拟化技术之上，它利用了一系列 Linux 内核特性来为容器提供网络隔离和通信能力。本文将主要介绍 Docker 网络用到的一些 Linux 网络虚拟化技术。

## Network Namespace

> 💡 本文不再介绍 Network Namespace 的创建、初始化和回收机制等内容，感兴趣的同志可以移步往期文章【[Docker 核心技术：Linux Namespace](https://feiyizhou.github.io/blog/cc/docker/core/namespace)】查看

Network Namespace 是 Linux 网络虚拟化技术的基石。每个 Network Namespace 都拥有独立的网络设备、IP 地址、路由表、防火墙规则等。Docker 为每个容器（除使用 host 模式的容器外）分配一个独立的网络命名空间，从而实现容器间的网络隔离。由于每个容器的网络都是隔离的，这就使得在同一个主机上，可以同时运行多个监听相同端口的容器。

![Docker](/docker/network/network.png)

和其他 Namespace 一样，Network Namespace 可以通过系统调用来创建。但是和其他 Namespace 不同的地方是，Network Namespace 的增删改查功能都已经集成到了 Linux 的 ip 工具的 netns 子命令中。为了试验方便，后续将使用 ip 工具来创建和配置 Network Namespace。

默认情况下，当一个 Namespace 没有任何进程（或引用）在使用它时，会被内核回收和销毁。ip 工具并不是通过创建一个进程去维持 Network Namespace 的生命周期，而是通过文件挂载点来实现 Network Namespace 的持久化：

- 创建绑定点：在执行`ip netns add`命令时，会在`/var/run/netns`目录下创建一个与命名空间同名的空文件
- 绑定挂载：在调用系统函数创建了 Network Namespace 后，ip 命令会通过 `​​mount --bind`​​ 系统调用，将内核中代表新创建的 Network Namespace 的那个特殊对象绑定挂载到在`/var/run/netns`目录下创建的那个空文件上。这使得这个原本普通的文件 `/var/run/netns/[nsname] `变成了一个特殊的挂载点。读取这个文件就相当于访问了内核中对应的 Network Namespace 对象
- 维持引用：这个绑定挂载操作会使得内核即使在没有进程运行于该 Namespace 时，也因为挂载点的存在而保持对该 Namespace 的引用 ​​，从而防止其被自动回收

```bash
[root@master01 ~]# ip netns add test
```

通过上述命令，我们就可以创建一个名为`test`的 Network Namespace。接下来，我们可以使用`ip netns exec`命令进入该命名空间，做一些网路查询和配置工作。

```bash
[root@master01 ~]# ip netns exec test ip a
1: lo: <LOOPBACK> mtu 65536 qdisc noop state DOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
```

通过上述信息可以得到，目前该 Network Namespace 中只有一块默认的未启用的本地回环设备 lo。

继续查看该 Network Namespace 下 iptables 的规则配置，由于是一个初始化的 Network Namespace，所以没有任何规则。

```bash
[root@master01 ~]# ip netns exec test iptables -L -n
Chain INPUT (policy ACCEPT)
target     prot opt source               destination

Chain FORWARD (policy ACCEPT)
target     prot opt source               destination

Chain OUTPUT (policy ACCEPT)
target     prot opt source               destination
```

此时新建的 Network Namespace 中，本地回环设备的状态还是 DOWN，当我们访问本地回环地址时，网路也是不通的。

```bash
[root@master01 ~]# ip netns exec test ping 127.0.0.1
ping: connect: Network is unreachable
```

此时如果我们通过 ip 工具把本地回环设备状态设置为 UP，再次访问本地回环地址，就会发现网络已经是通的。

```bash
[root@master01 ~]# ip netns exec test ip link set dev lo up
[root@master01 ~]# ip netns exec test ip a
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
    inet6 ::1/128 scope host
       valid_lft forever preferred_lft forever
[root@master01 ~]# ip netns exec test ping 127.0.0.1
PING 127.0.0.1 (127.0.0.1) 56(84) bytes of data.
64 bytes from 127.0.0.1: icmp_seq=1 ttl=64 time=0.013 ms
64 bytes from 127.0.0.1: icmp_seq=2 ttl=64 time=0.025 ms
64 bytes from 127.0.0.1: icmp_seq=3 ttl=64 time=0.030 ms
```

📑 ip 工具对于 Network Namespace 的查看命令`ip netns list`和删除命令`ip netns delete`此处不做详细解释，感兴趣的同志可以自行试验使用。

## veth pair

由于 Network Namespace 隔离了网络环境，所以同一个宿主机之前的 Network Namespace 并不能直接通信，如果想和宿主机、其他 Network Namespace 这些“外部”环境通信，就需要在 Network Namespace 中配置上虚拟网卡（veth），使得该 Network Namespace 具备访问“外部”环境的物理前提。

veth 是虚拟以太网卡（Virtual Ethernet）的缩写，而且 veth 设备总是成对出现的，因此又被称为 veth pair。

veth pair 一端发送的数据会在另外一端接收，根据这一特性，veth pair 可以作为跨 Network Namespace 之前的通信管道，即分别将 veth pair 的两端防止在不同的 Network Namespace 中，来实现两个 Network Namespace 相互之间的通信。

![Docker](/docker/network/veth-pair.png)

下面，我们通过命令行工具演示这个过程。

**创建 veth pair**

```bash
[root@master01 ~]# ip link add veth0 type veth peer name veth1
```

创建的 veth pair 在宿主机上表现为两块网卡，可以通过命令行查看

```bash
[root@master01 ~]# ip link
...
873: veth1@veth0: <BROADCAST,MULTICAST,M-DOWN> mtu 1500 qdisc noop state DOWN mode DEFAULT group default qlen 1000
 link/ether 32:23:51:85:df:1b brd ff:ff:ff:ff:ff:ff
874: veth0@veth1: <BROADCAST,MULTICAST,M-DOWN> mtu 1500 qdisc noop state DOWN mode DEFAULT group default qlen 1000
 link/ether 8e:ac:3e:d7:79:38 brd ff:ff:ff:ff:ff:ff
```

**创建两个 Network Namespace**

```bash
[root@master01 ~]# ip netns add A
[root@master01 ~]# ip netns add B
[root@master01 ~]# ip netns list
B
A
```

**将 veth pair 两端分别放入 Network Namespace**

```bash
[root@master01 ~]# ip link set veth0 netns A
[root@master01 ~]# ip link set veth1 netns B
```

此时就可以在两个 Network Namespace 中分别看到分配到的虚拟网卡

```bash
[root@master01 ~]# ip netns exec A ip link
1: lo: <LOOPBACK> mtu 65536 qdisc noop state DOWN mode DEFAULT group default qlen 1000
 link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
876: veth0@if875: <BROADCAST,MULTICAST> mtu 1500 qdisc noop state DOWN mode DEFAULT group default qlen 1000
 link/ether c6:43:84:2b:cc:1a brd ff:ff:ff:ff:ff:ff link-netns B
[root@master01 ~]# ip netns exec B ip link
1: lo: <LOOPBACK> mtu 65536 qdisc noop state DOWN mode DEFAULT group default qlen 1000
 link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
875: veth1@if876: <BROADCAST,MULTICAST> mtu 1500 qdisc noop state DOWN mode DEFAULT group default qlen 1000
 link/ether 06:a8:11:ea:5b:ff brd ff:ff:ff:ff:ff:ff link-netns A
```

> 🔍 上述信息中，需要关注以下几点：
>
> - **veth0@if875**​​: 这里的 if875 是一个索引号 ​​，明确告诉你 Network Namespace A 中的 veth0 这个“网线头”，其另一端对应着系统中索引号为 875 的网络接口
> - **​​link/netns B**​​: 这个字段至关重要。它明确告知，索引号 875 的这个接口，目前正位于 ​​Network Namespace B​​ 中
> - **​​veth1@if876**​​: 同样，if876 指明 Network Namespace B 中的 veth1 的另一端是索引号为 876 的接口
> - **link/netns A​**​: 指明索引号为 876 的接口位于 ​​Network Namespace A​​ 中

**启用 veth pair 并配置 IP**

```bash
[root@master01 ~]# ip netns exec A ip addr add 192.168.1.1/24 dev veth0
[root@master01 ~]# ip netns exec A ip link set veth0 up
[root@master01 ~]# ip netns exec A ip link set lo up
[root@master01 ~]# ip netns exec B ip addr add 192.168.1.2/24 dev veth1
[root@master01 ~]# ip netns exec B ip link set veth1 up
[root@master01 ~]# ip netns exec B ip link set lo up
```

此时再次查看这两个 Network Namespace 中的网络设备，会发现虚拟网卡已经是就绪状态。

```bash
[root@master01 ~]# ip netns exec A ip link
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN mode DEFAULT group default qlen 1000
 link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
876: veth0@if875: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP mode DEFAULT group default qlen 1000
 link/ether c6:43:84:2b:cc:1a brd ff:ff:ff:ff:ff:ff link-netns B
[root@master01 ~]# ip netns exec B ip link
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN mode DEFAULT group default qlen 1000
 link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
875: veth1@if876: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP mode DEFAULT group default qlen 1000
 link/ether 06:a8:11:ea:5b:ff brd ff:ff:ff:ff:ff:ff link-netns A
```

**互相访问，验证网络联通性**

```bash
[root@master01 ~]# ip netns exec A ping 192.168.1.2
PING 192.168.1.2 (192.168.1.2) 56(84) bytes of data.
64 bytes from 192.168.1.2: icmp_seq=1 ttl=64 time=0.030 ms
64 bytes from 192.168.1.2: icmp_seq=2 ttl=64 time=0.024 ms
...

[root@master01 ~]# ip netns exec B ping 192.168.1.1
PING 192.168.1.1 (192.168.1.1) 56(84) bytes of data.
64 bytes from 192.168.1.1: icmp_seq=1 ttl=64 time=0.021 ms
64 bytes from 192.168.1.1: icmp_seq=2 ttl=64 time=0.034 ms
...
```

## Linux Bridge

两个不同的 Network Namespace 可以借助 veth pair 实现网络互通，但是当需要让很多不同的 Network Namespace 相互连接，只用 veth pair 就会让网络拓扑关系异常复杂。为了解决这个问题，就需要引入 Linux Bridge。

Linux Bridge 是 Linux 内核提供的一种虚拟网络设备，它工作在数据链路层（OSI 模型第二层），其功能类似于一台物理的网络交换机，能够将多个物理或虚拟的网络接口“链接”起来，使他们仿佛连接在同一个虚拟的局域网（LAN）段中，实现二层通信。

🔍 Linux Bridge 的核心在于其维护了一张 MAC 地址表，依靠转发、过滤和泛洪机制来高效地交换数据。
