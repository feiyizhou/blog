# Docker 核心技术：Namespace

## 概念

Namespace 本质是 Linux 系统内核的一种功能，其主要作用是对进程的系统资源进行全局范围的分装隔离，这些资源包括 User ID、PID（Process ID）、Network 等，这种隔离使得不同 Namespace 下的进程拥有独立的全局系统资源，改变一个 Namespace 中的系统资源只会影响当前 Namespace 中的进程，对其他 Namespace 中的进程没有影响。需要注意的是不同的命名空间是随着内核版本不断加入内核的，具体的 Namespace 的信息如下所示。

| 类型              | 系统调用参数    | 隔离资源                         | 内核版本 |
| ----------------- | --------------- | -------------------------------- | -------- |
| Mount Namespace   | CLONE_NEWNS     | 文件系统挂载点                   | 2.4.19   |
| UTS Namespace     | CLONE_NEWUTS    | 主机名（hostname）和域名         | 2.6.19   |
| IPC Namespace     | CLONE_NEWIPC    | 信号量、消息队列等进程间通信资源 | 2.6.19   |
| PID Namespace     | CLONE_NEWPID    | 进程 ID（各空间独立进程树）      | 2.6.24   |
| Network Namespace | CLONE_NEWNET    | 网络设备、IP、端口、路由表       | 2.6.29   |
| User Namespace    | CLONE_NEWUSER   | 用户/组 ID 映射                  | 3.8      |
| Cgroup Namespace  | CLONE_NEWCGROUP | Cgroup 文件系统                  | 4.6      |
| Time Namespace    | CLONE_NEWTIME   | 时间                             | 5.6      |

## Namespace 生命周期和回收策略

Namespace 是随着进程创建而创建的，不存在脱离进程单独存在的 Namespace。而在 Linux 内核源码中，各类 Namespace 也是作为属性存在于进程结构体中。以下的代码都是以`linux-5.10.1`版本的内核源码为例。

内核源码官方地址：[www.kernel.org](https://www.kernel.org/)

linux-5.10.1 源码下载地址：[linux-5.10.1.tar.xz](https://www.kernel.org/pub/linux/kernel/v5.x/linux-5.10.1.tar.xz)

### 创建进程

### Namespace 的创建

进程结构体`task_struct`的定义在文件`linux-5.10.1/include/linux/sched.h`中，如下所示：

```c
struct task_struct {
// ...(省略)

	/* Namespaces: */
	struct nsproxy			*nsproxy;

// ...(省略)
}
```

具体的`nsproxy`的定义在文件`linux-5.10.1/include/linux/nsproxy.h`中，如下所示：

```c
struct nsproxy {
	atomic_t count;
	struct uts_namespace *uts_ns;
	struct ipc_namespace *ipc_ns;
	struct mnt_namespace *mnt_ns;
	struct pid_namespace *pid_ns_for_children;
	struct net 	     *net_ns;
	struct time_namespace *time_ns;
	struct time_namespace *time_ns_for_children;
	struct cgroup_namespace *cgroup_ns;
};
```

和 Namespace 生命周期相关的系统调用函数有三个：clone、unshare、setns

`clone`

功能：在创建新进程的同时，为其分配新的 Namespace，实现资源视图的隔离

```c
// int (*child_func)(void *)：子进程执行的函数入口
// void *child_stack：子进程栈空间地址
// int flags：控制隔离类型的标志位
// void *arg：传递给子进程的参数
int clone(int (*child_func)(void *), void *child_stack, int flags, void *arg);
```

`unshare`

功能 ​：使调用进程脱离当前 Namespace 并创建指定的新 Namespace，​​ 无需创建新进程

```c
// int flags（同 clone() 的标志位）
int unshare(int flags);
```

`setns`

功能 ​：将当前进程附加到目标进程所在的 Namespace

```c
// int fd：目标 Namespace 的文件描述符（通过 /proc/<pid>/ns/<类型> 获取）
// int nstype：指定 Namespace 的类型
int setns(int fd, int nstype);
```

### Namespace 的数量限制

Namespace 并不是可以无限制创建的。Linux 中对不同类型的 Namespace 都设置了数量上限，具体的限制可以在`/proc/sys/user`中查看，如下所示：

```shell
[root@master01 ~]# ls -al /proc/sys/user/
total 0
dr-xr-xr-x 1 root root 0 Aug 11 17:02 .
dr-xr-xr-x 1 root root 0 Jul  3 14:11 ..
-rw-r--r-- 1 root root 0 Aug 11 17:02 max_cgroup_namespaces
-rw-r--r-- 1 root root 0 Aug 11 17:02 max_inotify_instances
-rw-r--r-- 1 root root 0 Aug 11 17:02 max_inotify_watches
-rw-r--r-- 1 root root 0 Aug 11 17:02 max_ipc_namespaces
-rw-r--r-- 1 root root 0 Aug 11 17:02 max_mnt_namespaces
-rw-r--r-- 1 root root 0 Aug 11 17:02 max_net_namespaces
-rw-r--r-- 1 root root 0 Aug 11 17:02 max_pid_namespaces
-rw-r--r-- 1 root root 0 Aug 11 17:02 max_time_namespaces
-rw-r--r-- 1 root root 0 Aug 11 17:02 max_user_namespaces
-rw-r--r-- 1 root root 0 Aug 11 17:02 max_uts_namespaces
[root@master01 ~]# cat /proc/sys/user/max_pid_namespaces
93984
```

如上所示，当前系统中的 PID Namespace 最多可以创建`93984`个。

### Namespace 的回收机制

Namespace 的回收遵循以下核心原则：

> ​​ 一个 Namespace 当且仅当没有任何进程（或引用）在使用它时，才会被内核回收和销毁。​​

在具体实现中，Linux 内核是通过`引用计数法`来判断一个 Namespace 是否还有进程在使用它。每个 Namespace 结构体在内核中都维护有一个引用计数，表示有多少个实体（通常是进程）正在使用它，或者有多少打开的文件描述符指向它（比如通过 `/proc/[pid]/ns/pid` 打开的 `fd`）。

即使 Namespace 内无进程，满足以下任一条件即可避免回收：

1. 打开 `/proc/[pid]/ns/<type>` 文件（如 ns/pid）并保持其 FD 未关闭
2. 将 `/proc/[pid]/ns/<type>` 文件通过 `mount --bind` 挂载到其他路径
3. 存在嵌套的子 Namespace（如父 PID Namespace 被子 PID Namespace 引用）
4. 特定资源关联
   - IPC Namespace​​：被消息队列（`mqueue`）文件系统挂载引用
   - PID Namespace​​：被 `/proc` 文件系统挂载引用

## 查看 Namespace

Namespace 是面对进程的，所以系统中的每个进行都会有一个`/proc/[pid]/ns`这样一个目录，里面包含了进行所属的 Namespace 信息。

查看当前 bash 进程所属的 Namespace：

```shell
[root@master01 ~]# ls -al /proc/$$/ns
total 0
dr-x--x--x 2 root root 0 Aug 11 16:27 .
dr-xr-xr-x 9 root root 0 Aug  8 11:24 ..
lrwxrwxrwx 1 root root 0 Aug 11 16:27 cgroup -> 'cgroup:[4026531835]'
lrwxrwxrwx 1 root root 0 Aug 11 16:27 ipc -> 'ipc:[4026531839]'
lrwxrwxrwx 1 root root 0 Aug 11 16:27 mnt -> 'mnt:[4026531840]'
lrwxrwxrwx 1 root root 0 Aug 11 16:27 net -> 'net:[4026531992]'
lrwxrwxrwx 1 root root 0 Aug 11 16:27 pid -> 'pid:[4026531836]'
lrwxrwxrwx 1 root root 0 Aug 11 16:27 pid_for_children -> 'pid:[4026531836]'
lrwxrwxrwx 1 root root 0 Aug 11 16:27 time -> 'time:[4026531834]'
lrwxrwxrwx 1 root root 0 Aug 11 16:27 time_for_children -> 'time:[4026531834]'
lrwxrwxrwx 1 root root 0 Aug 11 16:27 user -> 'user:[4026531837]'
lrwxrwxrwx 1 root root 0 Aug 11 16:27 uts -> 'uts:[4026531838]'
```

需要注意的是，如果多个进程的某个类型的 Namespace 的`inode number`一致，则说明这些进程同处同一个该类型的 Namespace 中，即可共享该类型下的系统资源。以`net -> 'net:[4026531992]'`为例，其中`net`是 Namespace 的类型，`4026531992`是`inode number`。如果两个业务进程的 Network Namespace 的 `inode number`相同，说明他们同处同一个 Network Namespace，这两个业务进程可以直接通过 localhost 进行业务访问。

## Mount Namespace

Mount Namespace 用来隔离各个进程的文件挂载点，在不同的 Mount Namespace 中，看到的文件挂载点是不一样的。同样在不同的 Mount Namespace 中进行`mount()`和`unmount()`，也只会影响当前进程的文件挂载点，不会影响其他不同 Mount Namespace 中的进程的文件挂载点。

通过 Go 代码实现一个 Mount Namespace，代码如下所示：

```go
package main

import (
	"log"
	"os"
	"os/exec"
	"syscall"
)

func main() {
	cmd := exec.Command("sh")
	cmd.SysProcAttr = &syscall.SysProcAttr{
		Cloneflags: syscall.CLONE_NEWNS,
	}
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		log.Fatal(err)
	}
}
```
