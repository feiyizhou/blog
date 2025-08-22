![Docker](/docker/docker.png)

# Docker 核心技术：Union File System

大家好，我是费益洲。UnionFS 作为 Docker 的技术核心之一，实现了 Docker 镜像的分层轻量化构建、容器资源的隔离复用等目的。本文将从核心原理、主流技术实现、容器技术中的应用三个方面简单介绍 UnionFS。

## 核心原理

Linux 的联合文件系统（Union File System，简称 UnionFS）是一种将多个目录层（Layer）“透明地”叠加为单一视图的文件系统的技术。

UnionFS 叠加的过程其实是 UnionFS 将多个目录层（Layer）联合挂载到了同一个挂载点，并进行目录层内容的覆盖。用户最终看到的是一个合并后的文件系统，但实际上文件内容可能分布在不同的存储位置。当用户在最终合并完成后的文件系统写入内容时，系统是真正将内容写入了新的文件，但是这个过程并不会改变原来的文件，这是因为 UnionFS 还用到了另外一个重要的资源管理技术，写时复制。

### 分层存储

层（Layer）：层是 UnionFS 的基本组成单元，每一层都包含文件系统的一部分内容，多个层联合叠加后，共同组成一个完整的文件系统。层一般分为只读层和读写层：

只读层（Read-Only Layer）：

- 可能有多个只读层，每个只读层的内容都是固定不变的
- 每个只读层都包含一部分系统需要的库或者二进制文件等基础文件
- 相同的只读层只会在物理存储中存在一个，但是可以被多个容器共享
- 多个只读层之间有上下层关系，上层可以覆盖下层的同名文件夹和文件

读写层（Read-Write Layer）：

- 在容器技术中，读写层都是记录容器在运行过程中的内容修改
- 每个容器在运行时都会有独立的读写层，这种设计解决了容器运行时的文件内容隔离
- 在容器被删除时，该容器的读写层也会被删除

### 写时复制

写时复制机制（Copy-on-Write），即只有在需要写入（修改）时，才会进行复制操作，然后操作复制出来的副本。这种机制可以节省大量的存储空间和时间，而且不会修改原始文件。整体的工作流程如下所示：

1. 读操作流程：系统从上层到下层依次查找文件，找到文件后直接读取，无额外开销
2. 首次写入（修改）流程：

   ![Docker](/docker/core/cow.png)

3. 后续写入（修改）流程：无需再次复制，直接修改读写层中已经存在的副本

## 主流实现技术

UnionFS 的主流实现技术有： ​​AUFS​、​​OverlayFS、​​Device Mapper​​、Btrfs/ZFS 等。AUFS 是一个用户空间的联合文件系统实现，设计目标是提供最大的灵活性和功能完整性，AUFS 是早期 Docker 的默认存储驱动。Device Mapper 不是传统意义上的文件系统，而是 Linux 内核的一个框架，用于将物理块设备映射为虚拟块设备。Btrfs 和 ZFS 都是现代文件系统，原生支持快照和子卷功能。

Docker 目前默认使用 OverlayFS 作为默认的存储系统，Docker 从早期的 AUFS 转向 OverlayFS，是综合了内核兼容性、性能、资源利用率及社区生态等多方面因素的结果：

💻 1.内核兼容性

- AUFS 未被内核主线接纳
  AUFS 作为第三方文件系统，​​ 从未被集成到 Linux 内核主线 ​​，需用户手动为内核打补丁并重新编译，导致兼容性差。尤其在 RedHat/CentOS 等强调稳定性的发行版中无法直接使用

- 内核原生支持 OverlayFS
  自 Linux 内核版本 3.18 起，OverlayFS 直接集成到内核主线 ​​，无需额外补丁，到 4.0 版本以后，就支持了所有功能。

⚡ 2.性能

- OverlayFS​​ 的 CoW 操作是块级（Block-level）​​，复制单位是文件的数据块。AUFS​​ 的 CoW 操作是文件级（File-level）​​，复制单位是整个文件，对大文件操作延迟显著

📦 3.资源利用率

- OverlayFS（overlay2） 通过符号链接管理层间依赖，避免 inode 耗尽问题。AUFS 则依赖硬链接，易导致 inode 枯竭（尤其在频繁创建/销毁容器的场景）

- OverlayFS 支持跨容器共享页缓存：多个容器访问同一镜像文件时，内核仅缓存一份数据，降低内存占用。AUFS 无此优化，每个容器需独立缓存相同文件

📈 4.社区生态

- 自 Docker 版本 1.12 起，OverlayFS 成为默认存储驱动，官方持续优化其稳定性与功能

- Linux 内核社区放弃 AUFS 维护，新特性（如 ID 映射、安全增强）仅适配 OverlayFS

### OverlayFS

OverlayFS（Overlay File System）是 Linux 内核中的一种联合挂载文件系统，通过将多个目录（层）透明叠加为单一视图，实现高效的分层存储管理。OverlayFS 使用四个目录来实现分层联合：

- lower（只读层）

  - 可包含多个目录（如 Docker 镜像层）
  - 文件不可修改，多个容器可共享同一组 lower

- upper（读写层）

  - 存储用户修改后的内容（如容器运行时的文件内容变更）
  - 文件修改或删除时，通过写时复制（CoW）将数据从 lower 复制到 upper 再操作

- workdir（工作目录）

  - ​​ 内部临时目录，用于原子化操作（如文件复制），挂载后内容自动清空且用户不可见

- merged（合并目录）

  - 用户访问的最终目录，动态合并 lower 和 upper 内容

整体架构如下图所示：

![Docker](/docker/core/cow-layer.png)

#### 文件操作

🌳 **挂载文件**

1️⃣ **创建文件夹**

```bash
mkdir -p /tmp/overlay-demo/{lower1,lower2,upper,work,merged}

# 目录结构图如下
[root@master01 ~]# tree /tmp/overlay-demo/
/tmp/overlay-demo/
├── lower1
├── lower2
├── merged
├── upper
└── work

5 directories, 0 files
```

2️⃣ **创建一些初始文件**

```bash
echo "Config template: lower1" > /tmp/overlay-demo/lower1/config.conf
echo "Config template: lower2" > /tmp/overlay-demo/lower2/config.conf
echo "Env file content: lower1" > /tmp/overlay-demo/lower1/env
echo "Base file content: lower1" > /tmp/overlay-demo/lower1/base1.txt
echo "Base file content: lower2" > /tmp/overlay-demo/lower2/base2.txt
echo "Personal content" > /tmp/overlay-demo/upper/tom.txt
echo "Env file content: upper" > /tmp/overlay-demo/upper/env
```

**创建初始文件后目录结构如下**

```bash
[root@master01 ~]# tree /tmp/overlay-demo/
/tmp/overlay-demo/
├── lower1
│   ├── base1.txt
│   ├── config.conf
│   └── env
├── lower2
│   ├── base2.txt
│   └── config.conf
├── merged
├── upper
│   ├── env
│   └── tom.txt
└── work
    └── work

6 directories, 7 files
```

3️⃣ **挂载目录**

```bash
sudo mount -t overlay overlay \
-o lowerdir=/tmp/overlay-demo/lower1:/tmp/overlay-demo/lower2,\
upperdir=/tmp/overlay-demo/upper,\
workdir=/tmp/overlay-demo/work \
/tmp/overlay-demo/merged
```

挂载目录需要 root 权限。具体参数如下：

- `-t overlay`

  表示文件系统为 overlay

- `-o lowerdir=/tmp/overlay-demo/lower1:/tmp/overlay-demo/lower2,upperdir=/tmp/overlay-demo/upper,workdir=/tmp/overlay-demo/work`

  指定 lowerdir，支持多个 lower，使用`:`隔离，优先级从左往右依次降低；指定 upper；指定 work

- `/tmp/overlay-demo/merged`

  指定 merged，即最终的挂载点、用户看到的最终的、合并后的统一视图

**挂载后，目录结构如下**

```bash
[root@master01 ~]# tree /tmp/overlay-demo/
/tmp/overlay-demo/
├── lower1
│   ├── base1.txt
│   ├── config.conf
│   └── env
├── lower2
│   ├── base2.txt
│   └── config.conf
├── merged
│   ├── base1.txt
│   ├── base2.txt
│   ├── config.conf
│   ├── env
│   └── tom.txt
├── upper
│   ├── env
│   └── tom.txt
└── work
    └── work

6 directories, 12 files
```

**查看 merged 下的 config.conf、env 内容**

```bash
# config.conf
[root@master01 ~]# cat /tmp/overlay-demo/merged/config.conf
Config template: lower1
# env
[root@master01 ~]# cat /tmp/overlay-demo/merged/env
Env file content: upper
```

合并后的 config.conf 内容为`Config template: lower1`，证明了多个 lower 的优先级在挂载参数中是从左往右依次降低；合并后的 env 的内容为`Env file content: upper`，证明了 upper 的优先级高于 lower。整体的文件结构如下图所示

![Docker](/docker/core/cow-layer-merged.png)

✨ **新增文件**

```bash
echo "test" > /tmp/overlay-demo/merged/test
```

**新增文件后，整体目录结构如下**

```bash
[root@master01 ~]# tree /tmp/overlay-demo/
/tmp/overlay-demo/
├── lower1
│   ├── base1.txt
│   ├── config.conf
│   └── env
├── lower2
│   ├── base2.txt
│   └── config.conf
├── merged
│   ├── base1.txt
│   ├── base2.txt
│   ├── config.conf
│   ├── env
│   ├── test
│   └── tom.txt
├── upper
│   ├── env
│   ├── test
│   └── tom.txt
└── work
    └── work
```

从上面的目录结构可以看出，在 OverlayFS 中添加文件其实就是在 upper 中添加文件，然后合并覆盖后的结果。

**文件新增的过程如下所示**

![Docker](/docker/core/cow-layer-merged-new.png)

📑 **修改文件**

```bash
echo "Modified base content: merged" > /tmp/overlay-demo/merged/base1.txt
```

**修改文件后，整体目录结构如下**

```bash
[root@master01 ~]# tree /tmp/overlay-demo/
/tmp/overlay-demo/
├── lower1
│   ├── base1.txt
│   ├── config.conf
│   └── env
├── lower2
│   ├── base2.txt
│   └── config.conf
├── merged
│   ├── base1.txt
│   ├── base2.txt
│   ├── config.conf
│   ├── env
│   └── tom.txt
├── upper
│   ├── base1.txt
│   ├── env
│   └── tom.txt
└── work
    └── work

6 directories, 13 files
```

```bash
# lowerdir内容
[root@master01 ~]# cat /tmp/overlay-demo/lower1/base1.txt
Base file content: lower2

# upperdir内容
[root@master01 ~]# cat /tmp/overlay-demo/upper/base1.txt
Modified base content: merged

# merged内容
[root@master01 ~]# cat /tmp/overlay-demo/merged/base1.txt
Modified base content: merged
```

由上面的文件内容变化可以得出试验结果：

- 原始文件（/tmp/overlay-demo/lower1/base1.txt）保持不变
- 修改文件后 upper 层新增了一个 base1.txt 文件
- 用户看到的内容其实是来自 upper 层

**文件修改的过程如下所示**

![Docker](/docker/core/cow-layer-merged-modify.png)

OverlayFS 中，lower 的文件是不允许修改的，在 Cow 的技术机制下，对 base1.txt 进行修改时，文件系统发现 uppder 中不存在 base1.txt，就会从 lower 中复制一份副本到 upper 中，再进行修改。修改后的内容，在合并覆盖后，用户看到的就是对 base1.txt 修改后的内容。

> 从 lower copy 到 upper，叫做 copy_up

🧺 **删除文件**

在上一步的基础上，删除`/tmp/overlay-demo/merged/base1.txt`

```bash
rm -f /tmp/overlay-demo/merged/base1.txt
```

**删除后的文件目录结构如下**

```bash
[root@master01 ~]# tree /tmp/overlay-demo/
/tmp/overlay-demo/
├── lower1
│   ├── base1.txt
│   ├── config.conf
│   └── env
├── lower2
│   ├── base2.txt
│   └── config.conf
├── merged
│   ├── base2.txt
│   ├── config.conf
│   ├── env
│   └── tom.txt
├── upper
│   ├── base1.txt
│   ├── env
│   └── tom.txt
└── work
    └── work
        └── #7eb

6 directories, 13 files
```

**查看 upperdir 中的文件变化**

```bash
[root@master01 ~]# ls -al /tmp/overlay-demo/upper/
total 8
drwxr-xr-x 2 root root  100 Aug 22 14:30 .
drwxr-xr-x 7 root root  140 Aug 22 10:28 ..
c--------- 2 root root 0, 0 Aug 22 14:30 base1.txt
-rw-r--r-- 1 root root   24 Aug 22 11:36 env
-rw-r--r-- 1 root root   17 Aug 22 11:36 tom.txt
```

可以发现，lower 中的文件并不会被删除，而是会在 upper 中创建一个标记，表示这个文件已经被删除了。再次删除文件`c--------- 2 root root 0, 0 Aug 22 14:30 base1.txt`，发现 merged 中又可以看到 base1.txt 文件了

```bash
[root@master01 ~]# rm -f /tmp/overlay-demo/upper/base1.txt
[root@master01 ~]# tree /tmp/overlay-demo/
/tmp/overlay-demo/
├── lower1
│   ├── base1.txt
│   ├── config.conf
│   └── env
├── lower2
│   ├── base2.txt
│   └── config.conf
├── merged
│   ├── base1.txt
│   ├── base2.txt
│   ├── config.conf
│   ├── env
│   └── tom.txt
├── upper
│   ├── env
│   └── tom.txt
└── work
    └── work
        └── #7eb

6 directories, 13 files
```

由上面的文件内容变化可以得出试验结果：

- 原始文件（/tmp/overlay-demo/lower1/base1.txt）保持不变
- 删除文件后 upper 层会添加一个与文件同名的删除标记
- 删除标记后，merged 又能够看到该文件了

> OverlayFS 中，删除从 lower 层映射来的文件或文件夹时，会在 upper 层添加一个与文件或文件夹同名的 c 标识文件，这个文件叫 whiteout 文件。这个标识文件意味着该文件或文件夹已经被删除，而且合并覆盖过程中，当扫描到这个文件或文件夹后，会忽略此文件或文件夹。导致 merged 层中不会看到该文件或文件夹，从用户侧来说，即达到了删除的效果。

**文件删除的过程如下所示**

![Docker](/docker/core/cow-layer-merged-delete.png)

## Docker 文件存储
