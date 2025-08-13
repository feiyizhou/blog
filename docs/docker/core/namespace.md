# Docker 核心技术：Namespace

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

### Namespace 的创建

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

运行代码，并查看当前代码的进程信息：

```shell
# 查看进程编号
[root@master01 ~]# ps -ef |grep main.go | grep -v grep
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

通过 inode number 可以看出，他们不在同一个 Mount Namespace 中。由于 Mount Namespace 对文件系统挂载点做了隔离，下面通过挂载不同的文件来进行验证。
