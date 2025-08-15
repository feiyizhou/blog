![Docker](/docker/docker.png)

# Docker 核心技术：Linux Namespace

大家好，我是费益洲。Linux Namespace 作为 Docker 的技术核心之一，主要作用就是对容器的资源进行隔离。容器的本质其实就是 Linux 的一个进程，容器的系统资源隔离其实就是进程的系统资源隔离，本文将从 Linux 内核源码的层面，谈谈进程是如何通过 Namespace 实现系统资源隔离的。

本文中的的内核源码版本为`linux-5.10.1`，具体的源码可以自行下载查看，本文只列举关键代码。

🔗 内核源码官方地址：[www.kernel.org](https://www.kernel.org/)，linux-5.10.1 源码下载地址：[linux-5.10.1.tar.xz](https://www.kernel.org/pub/linux/kernel/v5.x/linux-5.10.1.tar.xz)

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

🏷️ Mount Namespace 作为第一个实现的 Namespace，当时的开发人员没有想过后续会有多个 Namespace 出现，所以标识直接定义为 CLONE_NEWNS

## Namespace 生命周期和回收策略

Namespace 是随着进程创建而创建的，不存在脱离进程单独存在的 Namespace。而在 Linux 内核源码中，各类 Namespace 也是作为属性存在于进程结构体中。

### Namespace 的创建过程

进程结构体`task_struct`的定义在文件`linux-5.10.1/include/linux/sched.h`中，如下所示：

```c
struct task_struct {
// ...（省略部分代码）

	/* Namespaces: */
	struct nsproxy			*nsproxy;

// ...（省略部分代码）
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

接下来从进程创建的过程，来说明进程的创建过程中，创建 Namespace 的过程。创建进程的系统调用函数有三个：fork、vfork、clone

具体的函数定义在文件`linux-5.10.1/kernel/fork.c`中，如下所示：

```c
#ifdef __ARCH_WANT_SYS_FORK
SYSCALL_DEFINE0(fork)
{
#ifdef CONFIG_MMU
	struct kernel_clone_args args = {
		.exit_signal = SIGCHLD,
	};

	return kernel_clone(&args);
#else
	/* can not support in nommu mode */
	return -EINVAL;
#endif
}
#endif

#ifdef __ARCH_WANT_SYS_VFORK
SYSCALL_DEFINE0(vfork)
{
	struct kernel_clone_args args = {
		.flags		= CLONE_VFORK | CLONE_VM,
		.exit_signal	= SIGCHLD,
	};

	return kernel_clone(&args);
}
#endif

#ifdef __ARCH_WANT_SYS_CLONE
#ifdef CONFIG_CLONE_BACKWARDS
SYSCALL_DEFINE5(clone, unsigned long, clone_flags, unsigned long, newsp,
		 int __user *, parent_tidptr,
		 unsigned long, tls,
		 int __user *, child_tidptr)
#elif defined(CONFIG_CLONE_BACKWARDS2)
SYSCALL_DEFINE5(clone, unsigned long, newsp, unsigned long, clone_flags,
		 int __user *, parent_tidptr,
		 int __user *, child_tidptr,
		 unsigned long, tls)
#elif defined(CONFIG_CLONE_BACKWARDS3)
SYSCALL_DEFINE6(clone, unsigned long, clone_flags, unsigned long, newsp,
		int, stack_size,
		int __user *, parent_tidptr,
		int __user *, child_tidptr,
		unsigned long, tls)
#else
SYSCALL_DEFINE5(clone, unsigned long, clone_flags, unsigned long, newsp,
		 int __user *, parent_tidptr,
		 int __user *, child_tidptr,
		 unsigned long, tls)
#endif
{
	struct kernel_clone_args args = {
		.flags		= (lower_32_bits(clone_flags) & ~CSIGNAL),
		.pidfd		= parent_tidptr,
		.child_tid	= child_tidptr,
		.parent_tid	= parent_tidptr,
		.exit_signal	= (lower_32_bits(clone_flags) & CSIGNAL),
		.stack		= newsp,
		.tls		= tls,
	};

	return kernel_clone(&args);
}
#endif
```

当调用 fork()、vfork()、clone()时，最终都会调用同一个函数 kernel_clone()，和 Namespace 创建关联的关键函数调用是 copy_process()

```c
pid_t kernel_clone(struct kernel_clone_args *args)
{
	...（省略部分代码）

	// line 2456
	p = copy_process(NULL, trace, NUMA_NO_NODE, args);

	...（省略部分代码）
}
```

copy_process()函数和 Namespace 创建关联的关键函数调用是 copy_namespaces()

```c
static __latent_entropy struct task_struct *copy_process(
					struct pid *pid,
					int trace,
					int node,
					struct kernel_clone_args *args)
{
	// ...（省略部分代码）

	// line 2098
	retval = copy_namespaces(clone_flags, p);

	// ...（省略部分代码）
}
```

在文件`linux-5.10.1/kernel/nsproxy.c`定义的函数 copy_namespaces()中，会根据标识为进程创建新的 Namespace 并进行赋值

```c
int copy_namespaces(unsigned long flags, struct task_struct *tsk)
{
	struct nsproxy *old_ns = tsk->nsproxy;
	struct user_namespace *user_ns = task_cred_xxx(tsk, user_ns);
	struct nsproxy *new_ns;
	int ret;

	if (likely(!(flags & (CLONE_NEWNS | CLONE_NEWUTS | CLONE_NEWIPC |
			      CLONE_NEWPID | CLONE_NEWNET |
			      CLONE_NEWCGROUP | CLONE_NEWTIME)))) {
		if (likely(old_ns->time_ns_for_children == old_ns->time_ns)) {
			get_nsproxy(old_ns);
			return 0;
		}
	} else if (!ns_capable(user_ns, CAP_SYS_ADMIN))
		return -EPERM;

	if ((flags & (CLONE_NEWIPC | CLONE_SYSVSEM)) ==
		(CLONE_NEWIPC | CLONE_SYSVSEM))
		return -EINVAL;

	// 为进程创建Namespace的关键函数
	new_ns = create_new_namespaces(flags, tsk, user_ns, tsk->fs);
	if (IS_ERR(new_ns))
		return  PTR_ERR(new_ns);

	ret = timens_on_fork(new_ns, tsk);
	if (ret) {
		free_nsproxy(new_ns);
		return ret;
	}

	// 将新创建的Namespace赋值给进程
	tsk->nsproxy = new_ns;
	return 0;
}
```

函数 create_new_namespaces()，会根据标识判断是否为进程创建该类型的 Namespace，但是该类型的 Namespace 的初始状态是从当前进程复制而来。

```c
static struct nsproxy *create_new_namespaces(unsigned long flags,
					     struct task_struct *tsk,
					     struct user_namespace *user_ns,
					     struct fs_struct *new_fs)
{
	struct nsproxy *new_nsp;
	int err;

	new_nsp = create_nsproxy();
	if (!new_nsp)
		return ERR_PTR(-ENOMEM);

	new_nsp->mnt_ns =
		copy_mnt_ns(flags, tsk->nsproxy->mnt_ns, user_ns, new_fs);
	if (IS_ERR(new_nsp->mnt_ns)) {
		err = PTR_ERR(new_nsp->mnt_ns);
		goto out_ns;
	}
	// ...（省略部分代码）
	return new_nsp;

// ...（省略部分代码）
}
```

以 Mount Namespace 创建过程为例，详细代码在`linux-5.10.1/fs/namespace.c`，关键代码如下所示：

```c
struct mnt_namespace *copy_mnt_ns(unsigned long flags, struct mnt_namespace *ns,
		struct user_namespace *user_ns, struct fs_struct *new_fs)
{
	struct mnt_namespace *new_ns;
	struct vfsmount *rootmnt = NULL, *pwdmnt = NULL;
	struct mount *p, *q;
	struct mount *old;
	struct mount *new;
	int copy_flags;

	BUG_ON(!ns);

	// 关键代码1
	if (likely(!(flags & CLONE_NEWNS))) {
		get_mnt_ns(ns);
		return ns;
	}

	// ...（省略部分代码）

	// 关键代码2
	new_ns = alloc_mnt_ns(user_ns, false);

	// ...（省略部分代码）
	return new_ns;
}
```

💡 **关键代码解析：**

- 关键代码 1 中，会对标识进行判断，如果不存在创建 Mount Namespace 的标识，则直接返回当前进程的 Mount Namespace，则新创建的进程和当前进程共用同一个 Mount Namespace，即不进行 Mount Namespace 隔离。

- 关键代码 2 中，会创建一个新的 Mount Namespace，并对该 Mount Namespace 进行赋值，需要注意的是，赋值是一个 copy 过程，会将当前进程的 Mount Namespace 的对象的值作为初始值进行赋值，具体表现就是，新创建的带有 CLONE_NEWNS 标识的进程，其文件挂载点内容与原进程一致，但是在新进程挂载不同的文件后，两个进程的文件挂载点内容将会出现差别，但互不影响，原进程的文件挂载点内容仍保持不变。

由上述内核代码可以看出，Linux 在创建进程的过程中，就会为进程根据标识创建各类 Namespace，即完成了 Namespace 和进程的绑定，而每个进程只能访问自己所在 Namespace 中的系统资源，这整个逻辑完成了每个进程在系统资源层面的隔离。

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

> 🏷️ 一个 Namespace 当且仅当没有任何进程（或引用）在使用它时，才会被内核回收和销毁。​​

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

## UTS Namespace

UTS Namespace 主要用来隔离 nodename 和 domainname 两个系统标识。在每个 UTS Namespace 中，都允许每个 Namespace 拥有自己的 hostname。即多个 UTS Namespace 中，允许 hostname 不一致。

通过 Go 代码实现一个 UTS Namespace，代码如下所示：

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
		Cloneflags: syscall.CLONE_NEWUTS,
	}
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		log.Fatal(err)
	}
}
```

运行代码，并查看当前代码的进程信息：

```shell
[root@master01 test]# go run main.go
sh-5.1# echo $$
57995
```

在宿主机中查看 UTS Namespace，验证下父子进程是否在同一个 UTS Namespace 中：

```shell
[root@master01 test]# readlink /proc/$$/ns/uts
uts:[4026531838]
[root@master01 test]# readlink /proc/57995/ns/uts
uts:[4026533178]
```

由上面的两个不同的 inode number 可以看出，父子进程分别处于两个不同的 UTS Namespace 中，下面通过修改子进程的 hostname，查看宿主机的 hostname 是否变化来验证 UTS Namespace 的有效性。

下查看子进程 hostname，再修改子进程 hostname：

```shell
# 查看原hostname
sh-5.1# hostname
master01
# 修改子进程hostname
sh-5.1# hostname -b uts-test
# 查看修改后的子进程hostname
sh-5.1# hostname
uts-test
```

而在宿主机运行 hostname，查看宿主机 hostname：

```shell
[root@master01 test]# hostname
master01
```

可以看出，宿主机的 hostname 并没有受子进程的修改而有变化，由此证明了 UTS Namespace 的有效性。

## IPC Namespace

IPC Namespace 主要作用是为进程间通信（IPC）资源提供独立的运行环境，确保不同容器或进程组之间的通信资源互不干扰。

在上一版本的代码中增加创建 IPC Namespace 的标识，代码如下所示：

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
		Cloneflags: syscall.CLONE_NEWUTS | syscall.CLONE_NEWIPC,
	}
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		log.Fatal(err)
	}
}
```

运行代码，并查看当前代码的进程信息：

```shell
[root@master01 test]# go run main.go
sh-5.1# echo $$
69200
```

在宿主机中查看 IPC Namespace，验证下父子进程是否在同一个 IPC Namespace 中：

```shell
[root@master01 test]# readlink /proc/$$/ns/ipc
ipc:[4026531839]
[root@master01 test]# readlink /proc/69200/ns/ipc
ipc:[4026533179]
```

下面我们通过消息队列（Message Queues）来验证 IPC Namespace 的有效性。通过在宿主机上创建一个 Message Queues，子进程中不存在该 Message Queues 来验证 IPC Namespace 的有效性。

在宿主机创建 Message Queues：

```shell
# 查看现有的 ipc Message Queues
[root@master01 test]# ipcs -q

------ Message Queues --------
key        msqid      owner      perms      used-bytes   messages

# 创建一个新的 Message Queues
[root@master01 test]# ipcmk -Q
Message queue id: 0
# 再查看现有的 ipc Message Queues
[root@master01 test]# ipcs -q

------ Message Queues --------
key        msqid      owner      perms      used-bytes   messages
0x66d84650 0          root       644        0            0
```

从这里可以看到，宿主机现在已经存在了一个 Message Queue 了。此时，再去查看子进程中的 Message Queues：

```shell
sh-5.1# ipcs -q

------ Message Queues --------
key        msqid      owner      perms      used-bytes   messages

```

此时子进程中并没有宿主机中新创建的 Message Queue，说明子进程和宿主机的 IPC 已经被隔离了，互不影响，这就证明了 IPC Namespace 的有效性。

## PID Namespace

PID Namespace（进程标识符命名空间）主要用于隔离进程的 ID 空间 ​​，实现 Namespace 中进程的独立管理与资源隔离。进程独立管理，意味着在不同的 PID Namespace 中，初始进程编号都会是 1。

在上一版本的代码中增加创建 PID Namespace 的标识，代码如下所示：

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
		Cloneflags: syscall.CLONE_NEWUTS | syscall.CLONE_NEWIPC | syscall.CLONE_NEWPID,
	}
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		log.Fatal(err)
	}
}
```

运行代码，并查看当前代码的进程信息：

```shell
[root@master01 test]# go run main.go
sh-5.1# echo $$
1
```

可以看出，此时子进程中的进程编号变为了 1。需要注意的是，此时不同使用 ps 命令查看进程标号，是因为 ps 命令会使用/proc 的内容，而 proc 是和 Mount Namespace 相关联的，此时未创建新的 Mount Namespace，所以此时使用 ps 看到的还是宿主机的进程内容。

💡 此时子进程中的初始进程编号为 1，其实是宿主机进程编号映射出来的。可以在宿主机中通过`cat /proc/<pid>/status`查看子进程的编号映射关系：

```shell
# 查看子进程 sh 的进程编号
[root@master01 test]# ps -ef  | grep main.go | grep -v grep
root       78439   54883  0 11:17 pts/1    00:00:00 go run main.go
[root@master01 test]# pstree -p 78439
go(78439)─┬─main(78530)─┬─sh(78536)

# 查看子进程状态信息
cat /proc/78536/status
Name:   sh
Umask:  0022
State:  S (sleeping)
Tgid:   78536
Ngid:   0
Pid:    78536
PPid:   78530
TracerPid:      0
Uid:    0       0       0       0
Gid:    0       0       0       0
FDSize: 256
Groups: 0
NStgid: 78536   1
NSpid:  78536   1
NSpgid: 78536   1
NSsid:  54883   0
# ...（省略部分输出）
```

`NSpid:  78536   1`，宿主机 PID：78536，第一层子空间 PID：1。此时就会有一个疑问，Linux 如何标记 PID 是哪一层空间的？这一特性其实在 PID Namespace 的结构体中就已经有体现了，PID Namespace 的结构体定义在文件`linux-5.10.1/include/linux/pid_namespace.h`，具体定义如下所示：

```c
struct pid_namespace {
	struct kref kref;
	struct idr idr;
	struct rcu_head rcu;
	unsigned int pid_allocated;
	struct task_struct *child_reaper;
	struct kmem_cache *pid_cachep;
	unsigned int level;
	struct pid_namespace *parent;
#ifdef CONFIG_BSD_PROCESS_ACCT
	struct fs_pin *bacct;
#endif
	struct user_namespace *user_ns;
	struct ucounts *ucounts;
	int reboot;	/* group exit code if this pidns was rebooted */
	struct ns_common ns;
} __randomize_layout;
```

🏷️ 关键字段`unsigned int level;`，具体的进程空间分层逻辑此处不再展开，有兴趣的同志可以自行查看源码逻辑。需要注意的是，`level`并不是可以无限制增加的，即 PID Namespace 的层级结构并不是可以无限制嵌套的。在内核源码中，限制了`MAX_PID_NS_LEVEL`为 32，且在 PID Namespace 的创建源码中也做了逻辑判断：

`linux-5.10.1/include/linux/pid_namespace.h`定义了`MAX_PID_NS_LEVEL`:

```c
// line 16
/* MAX_PID_NS_LEVEL is needed for limiting size of 'struct pid' */
#define MAX_PID_NS_LEVEL 32
```

`linux-5.10.1/kernel/pid_namespace.c`中创建 PID Namespace 的代码做了逻辑判断:

```c
static struct pid_namespace *create_pid_namespace(struct user_namespace *user_ns,
	struct pid_namespace *parent_pid_ns)
{
	// ...（省略部分代码）

	// line 83
	if (level > MAX_PID_NS_LEVEL)
		goto out;

	// ...（省略部分代码）
}
```

🏷️ 关键字段`struct pid_namespace *parent;`则表明了当前 PID Namespace 所关联的父级 PID Namespace 的信息。

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
		Cloneflags: syscall.CLONE_NEWUTS | syscall.CLONE_NEWIPC | syscall.CLONE_NEWPID |
			syscall.CLONE_NEWNS,
	}
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		log.Fatal(err)
	}
}
```

运行代码，并查看当前代码的进程信息：

```shell
# 查看进程编号
[root@master01 ~]# ps -ef | grep main.go | grep -v grep
root      196556  190857  0 16:50 pts/2    00:00:00 go run main.go

# 查看进程的层级关系
[root@master01 ~]# pstree -p 190857
bash(190857)───go(196556)─┬─main(196646)─┬─sh(196652)
```

验证下父子进程是否不在同一个 Mount Namespace 中，验证代码如下：

```shell
[root@master01 ~]# readlink /proc/196646/ns/mnt
mnt:[4026531840]
[root@master01 ~]# readlink /proc/196652/ns/mnt
mnt:[4026532560]
```

通过 inode number 可以看出，他们不在同一个 Mount Namespace 中。下面我们通过重新挂载 `proc` 来验证 Mount Namespace 的有效性。

📑 （`proc` 文件系统，简称 `procfs`）是 Linux 内核中一种独特的 ​​ 虚拟文件系统 ​​，它不占用磁盘空间，而是由内核动态生成，提供与内核及进程信息的交互接口。我们可以通过在子进程中重新挂载 `proc`，验证子进程与宿主机的 `/proc` 中内容是否一致的方式，来验证 Mount Namespace 的有效性。

先查看子进程中 `/proc` 下的内容：

```shell
[root@master01 test]# go run main.go
sh-5.1# ls /proc/
1      141     168   194   2465   37161  40     45570  66          buddyinfo      locks
10     142     169   195   249    37182  40045  45579  67          bus            mdstat
1024   143     17    196   25     37232  40061  45945  700         cgroups        meminfo
1028   144     170   197   26     37258  41     46     74309       cmdline        misc
1030   145     171   198   27     37277  41889  47     74317       config.gz      modules
1031   146     172   199   2780   37338  41891  48511  74325       consoles       mounts
1033   147     173   2     2800   37400  41892  488    74417       cpuinfo        mpt
1034   148     174   20    2826   37455  42     49     7545        crypto         mtrr
1036   149     175   200   2836   37525  42433  490    7546        devices        net
1063   15      176   2006  29     37577  42519  492    78403       dirty          pagetypeinfo
1075   150     177   201   291    37602  42523  494    8           diskstats      partitions
1085   150864  178   202   293    37656  42524  495    84          dma            sched_debug
1088   150866  179   203   2932   37686  42885  498    9           driver         schedstat
1090   151     180   2078  2952   37738  42903  499    90765       dynamic_debug  scsi
1093   16      181   21    2966   37771  42918  510    944         execdomains    self
1096   161373  182   2128  297    37807  42961  511    959         fb             slabinfo
10988  1629    183   2149  2993   37844  43102  532    960         filesystems    softirqs
11     164     184   2169  3      37888  43110  533    961         fs             stat
1138   164028  185   2193  30     37937  43889  54883  962         interrupts     swaps
1139   165     186   22    300    37958  43897  58     963         iomem          sys
1152   165753  187   2214  31     37971  43898  58610  964         ioports        sysrq-trigger
1154   165860  188   2223  317    37998  44     58627  965         irq            sysvipc
12     165894  189   2252  318    38011  44263  59     966         kallsyms       thread-self
12738  166     1893  2273  32     38033  44274  6      967         kcore          timer_list
13     166630  1899  2292  34     38046  44315  60     968         keys           tty
135    166777  19    2313  35     38067  44332  62     98304       key-users      uptime
136    166809  190   2342  36     38091  44338  63     98306       kmsg           version
137    166813  191   2364  36054  38119  44344  64     988         kpagecgroup    vmallocinfo
138    166902  1916  24    36066  38215  44771  64463  989         kpagecount     vmstat
139    166908  192   2405  36111  3855   44821  65     999         kpageflags     zoneinfo
14     166979  193   2426  36123  39     44954  65653  acpi        livepatch
140    167     1937  2445  37     4      45     659    bootconfig  loadavg
```

通过对比发现，此时`/proc`下的内容还是宿主机的内容。是因为创建进程的时候，Mount Namespace 的初始值默认是从当前进程拷贝的，所以和宿主机`/proc`的内容一致。我们将`/proc`挂载到子进程的 Mount Namespace 中：

```shell
sh-5.1# mount -t proc proc /proc
sh-5.1# ls /proc/
1           cpuinfo        filesystems  kmsg         modules       self           tty
4           crypto         fs           kpagecgroup  mounts        slabinfo       uptime
acpi        devices        interrupts   kpagecount   mpt           softirqs       version
bootconfig  dirty          iomem        kpageflags   mtrr          stat           vmallocinfo
buddyinfo   diskstats      ioports      livepatch    net           swaps          vmstat
bus         dma            irq          loadavg      pagetypeinfo  sys            zoneinfo
cgroups     driver         kallsyms     locks        partitions    sysrq-trigger
cmdline     dynamic_debug  kcore        mdstat       sched_debug   sysvipc
config.gz   execdomains    keys         meminfo      schedstat     thread-self
consoles    fb             key-users    misc         scsi          timer_list
```

从上面的输出可以看出，重新挂载`proc`后，`/proc`里面的内容发生了变化。下面再通过`ps`名称查看系统进程：

```shell
sh-5.1# ps -aux
USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root           1  0.0  0.0  23088  4208 pts/1    S    14:35   0:00 sh
root          11  0.0  0.0  26420  5008 pts/1    R+   14:41   0:00 ps -aux
```

从上面的输出可以看出，在当前子进程中，`sh`进程是`pid`为 1 的初始进程。这就再次证明，当前子进程的 Mount Namespace 和宿主机的 Mount Namespace 是完全隔离的，在子进程中的 mount 操作，并没有影响到宿主机。

## User Namespace

User Namespace 是 Linux 内核中用于隔离用户权限的核心机制，它通过分割用户/组 ID（uid/gid）和权限能力（capability），实现容器内外的安全隔离。

UID/GID 映射 ​​ 允许容器内进程使用独立的用户身份体系，与宿主机或其他容器隔离。例如容器内以 root（uid 0）运行的进程，在宿主机上实际映射为非特权用户（如 uid 1000）。其中映射规则通过 `/proc/<pid>/uid_map` 和 `/proc/<pid>/gid_map` 文件配置，定义容器内 ID 与宿主机 ID 的对应关系。若未映射，则默认使用 65534（nobody）。

User Namespace 是作为 PID Namespace 的一个结构体属性出现的（可以查看本文中展示的 PID Namespace 结构体），这种设计很好理解：即每个进程都需要指定 User Namespace，具体的 User Namespace 定义在`linux-5.10.1/include/linux/user_namespace.h`，详细字段如下所示：

```c
struct user_namespace {
	struct uid_gid_map	uid_map;
	struct uid_gid_map	gid_map;
	struct uid_gid_map	projid_map;
	atomic_t		count;
	struct user_namespace	*parent;
	int			level;
	kuid_t			owner;
	kgid_t			group;
	struct ns_common	ns;
	unsigned long		flags;

#ifdef CONFIG_KEYS
	/* List of joinable keyrings in this namespace.  Modification access of
	 * these pointers is controlled by keyring_sem.  Once
	 * user_keyring_register is set, it won't be changed, so it can be
	 * accessed directly with READ_ONCE().
	 */
	struct list_head	keyring_name_list;
	struct key		*user_keyring_register;
	struct rw_semaphore	keyring_sem;
#endif

	/* Register of per-UID persistent keyrings for this namespace */
#ifdef CONFIG_PERSISTENT_KEYRINGS
	struct key		*persistent_keyring_register;
#endif
	struct work_struct	work;
#ifdef CONFIG_SYSCTL
	struct ctl_table_set	set;
	struct ctl_table_header *sysctls;
#endif
	struct ucounts		*ucounts;
	int ucount_max[UCOUNT_COUNTS];
} __randomize_layout;
```

同 PID Namespace 一样，User Namespace 也支持层级嵌套：

🏷️ 关键字段`int level;`, 同 PID Namespace 的`level`字段一直，PID Namespace 也不支持无限嵌套，其最多也只支持嵌套 32 层。在创建 User Namespace 的内核源码中做了逻辑判断：

`linux-5.10.1/kernel/user_namespace.c`中创建 User Namespace 时做了限制：

```c
int create_user_ns(struct cred *new)
{
	// ...（省略部分代码）

	// line 78
	if (parent_ns->level > 32)
		goto fail;

	// ...（省略部分代码）
}
```

在 User Namespace 的嵌套结构形成的父子关系下，权限判断依照一下规则：

1. 父级 User Namespace 可以管理子 User Namespace，反之则不可。
2. 同级或子级 Namespace：禁止操作。
3. 父级 Namespace 且为 owner：拥有全部权限。
4. ​​ 其他 Namespace 的依赖 ​​ 创建其他类型 Namespace（如 PID、Mount）时，需在当前 User Namespace 拥有 CAP_SYS_ADMIN 能力。而创建 User Namespace 本身无需特权。

我们在之前版本的 Go 代码中添加创建 User Namespace 的标识，通过查看子进程中的 UID、GID 来验证 User Namespace 的有效性，代码如下所示：

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
		Cloneflags: syscall.CLONE_NEWUTS | syscall.CLONE_NEWIPC | syscall.CLONE_NEWPID |
			syscall.CLONE_NEWNS | syscall.CLONE_NEWUSER,
	}
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		log.Fatal(err)
	}
}
```

以 root 权限运行代码，并查看 UID、GID，如下所示：

```shell
[root@master01 test]# go run main.go
sh-5.1$ id
uid=65534(nobody) gid=65534(nobody) groups=65534(nobody)
```

可以看到，子进程内的 uid 和 gid 不是 root 用户，因此证明 User Namespace 的有效性。

## Network Namespace

Network Namespace（网络命名空间）是 Linux 内核提供的一种网络资源隔离机制，它通过分割网络协议栈资源，实现多个独立网络环境的共存。

网络资源隔离通过一下三种方式实现：

1. 独立网络设备 ​​：每个 Network Namespace 拥有专属的虚拟或物理网络接口（如 veth、eth0），不同命名空间的设备互不可见。
2. ​​ 独立 IP 和路由表 ​​：可配置独立的 IP 地址、子网、路由规则，避免地址冲突或路由干扰。
3. 隔离防火墙与端口 ​​：支持独立的 iptables/nftables 规则和端口分配，实现定制化的安全策略。

我们在之前版本的 Go 代码中添加创建 Network Namespace 的标识，通过查看子进程中的网络设备和宿主机是否一致来验证 Network Namespace 的有效性，代码如下所示：

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
		Cloneflags: syscall.CLONE_NEWUTS | syscall.CLONE_NEWIPC | syscall.CLONE_NEWPID |
			syscall.CLONE_NEWNS | syscall.CLONE_NEWUSER | syscall.CLONE_NEWNET,
	}
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		log.Fatal(err)
	}
}
```

运行代码后，在子进程中查看网络设备，如下所示：

```shell
[root@master01 test]# go run main.go
sh-5.1$ ifconfig
sh-5.1$
```

从上面的输出可以看出，子进程中没有任何的网络设备，这就说明子进程的网络设备和宿主机是完全隔离的，证明了 Network Namespace 的有效性。
