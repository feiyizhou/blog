![Docker](/docker/docker.png)

# Docker 核心技术：Linux Cgroups

大家好，我是费益洲。Linux Cgroups 作为 Docker 的技术核心之一，主要作用就是限制、控制和统计进程组的系统资源 ​​（如 CPU、内存、磁盘 I/O 等）。容器的本质其实就是 Linux 的一个进程，限制、控制和统计容器的系统资源，其实就是限制、控制和统计进程的系统资源，本文将从 Linux 内核源码的层面，谈谈如何通过 Cgroups 实现限制、控制和统计进程的系统资源。

本文中的的内核源码版本为`linux-5.10.1`，具体的源码可以自行下载查看，本文只列举关键代码。

🔗 内核源码官方地址：[www.kernel.org](https://www.kernel.org/)，linux-5.10.1 源码下载地址：[linux-5.10.1.tar.xz](https://www.kernel.org/pub/linux/kernel/v5.x/linux-5.10.1.tar.xz)

## 概念

Cgroups 的全称是 Control Groups，是 Linux 内核提供的一种机制，用于限制、控制和统计一组进程所使用的物理资源。它最早由 Google 工程师在 2006 年发起，最初称为"进程容器"(Process Containers)，后来在 2007 年更名为 Cgroups，并在 2008 年合并到 Linux 2.6.24 内核中，2016 年 Linux 4.5 内核引入第二代（cgroup v2）。

| 特性    | cgroup v1                | cgroup v2                   |
| ------- | ------------------------ | --------------------------- |
| 设计    | 多层级树，子系统独立管理 | 单一层级树，统一资源管理    |
| ​​ 内存 | memory 子系统独立        | 整合内存、swap、内核内存    |
| CPU     | cpu 与 cpuacct 分离      | 统一通过 cpu 控制权重和上限 |
| 启动    | 旧版内核                 | Linux 4.5+ 内核             |

与 Cgroups 相关的关键概念如下：

1. 层级结构（Hierarchy）

   - 树形组织，子级 cgroup 进程父级 cgroup 的限制（如`/sys/fs/cgroup/cpu/father/child`child 初始继承 father 的限制）
   - 子级 cgroup 可以通过`mkdir`命令在父级 cgroup 目录下创建

2. 子系统（Subsystem）

   - 每个子系统管理一类资源，具体可以通过`ls -al /sys/fs/cgroup/mygroup`查看，常用的子系统包括：
     |子系统|功能|
     |---|---|
     |blkio|限制块设备 I/O 带宽（如磁盘读写）|
     |cpu|控制 cpu 时间分配|
     |cpuacct|统计 CPU 使用情况|
     |devices|控制设备访问权限（如禁止容器访问磁盘）|
     |freezer|挂起或恢复进程|
     |memory|限制内存使用量，统计内存消耗|
     |net_cls|标记网络数据包，配合 tc 实现网络限速|
     |pids|限制进程数|

3. 任务（Task）

   - 进程或线程，可加入多个 cgroup（每个子系统层级仅属一个 cgroup）

4. 文件系统接口

   - 通过虚拟文件系统（挂载于 /sys/fs/cgroup）配置参数：

   ```bash
   # 限制内存为 1GB
   echo 1G > /sys/fs/cgroup/memory/mygroup/memory.limit_in_bytes
   # 将进程加入 cgroup
   echo 1234 > /sys/fs/cgroup/memory/mygroup/cgroup.procs
   ```

⚠️ 不要直接修改根目录（`/sys/fs/cgroup`）下的子系统配置

## Cgroups 的生命周期和回收策略

### Cgroups 的创建过程

进程结构体`task_struct`的定义在文件`linux-5.10.1/include/linux/sched.h`中，与 Cgroups 相关的关键数据结构如下所示：

```c
struct task_struct {
// ...（省略部分代码）

	/* Control Group info protected by css_set_lock: */
	struct css_set __rcu		*cgroups;
	/* cg_list protected by css_set_lock and tsk->alloc_lock: */
	struct list_head		cg_list;

// ...（省略部分代码）
}
```

- css_set:
  - 包含进程组共享的子系统状态数组（subsys[CGROUP_SUBSYS_COUNT]）
  - 通过 tasks 链表关联所有绑定至此的进程
- list_head: 链入 css_set 的 tasks 链表

接下来从进程创建的过程，来说明进程的创建过程中，创建 Cgroups 的过程。创建进程的系统调用函数有三个：fork()、vfork()、clone()。当调用 fork()、vfork()、clone()时，最终都会调用同一个函数 kernel_clone()，和 Cgroups 创建关联的关键函数调用是 copy_process()

```c
pid_t kernel_clone(struct kernel_clone_args *args)
{
	// ...（省略部分代码）

	// line 2456
	p = copy_process(NULL, trace, NUMA_NO_NODE, args);

	// ...（省略部分代码）
}
```

copy_process()函数和 Cgroups 创建关联的关键函数调用是有三个，cgroup_fork()、cgroup_can_fork()、cgroup_post_fork()：

```c
static __latent_entropy struct task_struct *copy_process(
					struct pid *pid,
					int trace,
					int node,
					struct kernel_clone_args *args)
{
    // ...（省略部分代码）

    // line 2028
    cgroup_fork(p);

    // ...（省略部分代码）

    // line 2191
    retval = cgroup_can_fork(p, args);
	if (retval)
		goto bad_fork_put_pidfd;

    // ...（省略部分代码）

    // line 2304
    cgroup_post_fork(p, args);

    // ...（省略部分代码）
}
```

这三个函数都定义在`linux-5.10.1/kernel/cgroup/cgroup.c`，具体的函数定义和主要逻辑如下所示：

1. cgroup_fork()

```c
void cgroup_fork(struct task_struct *child)
{
	RCU_INIT_POINTER(child->cgroups, &init_css_set);
	INIT_LIST_HEAD(&child->cg_list);
}
```

**主要功能**

- 初始化子进程的 cgroups 指针为 init_css_set（临时默认值）
- 初始化 child->cg_list 为空链表，表示尚未绑定具体 cgroup

2. cgroup_can_fork()

```c
int cgroup_can_fork(struct task_struct *child, struct kernel_clone_args *kargs)
{
	struct cgroup_subsys *ss;
	int i, j, ret;

	ret = cgroup_css_set_fork(kargs);
	if (ret)
		return ret;

	do_each_subsys_mask(ss, i, have_canfork_callback) {
		ret = ss->can_fork(child, kargs->cset);
		if (ret)
			goto out_revert;
	} while_each_subsys_mask();

	return 0;

out_revert:
	for_each_subsys(ss, j) {
		if (j >= i)
			break;
		if (ss->cancel_fork)
			ss->cancel_fork(child, kargs->cset);
	}

	cgroup_css_set_put_fork(kargs);

	return ret;
}
```

**主要功能**

- 遍历所有子系统，调用 ss->can_fork()回调函数（如 cpuset_can_fork()检查 CPU 和内存节点可用性）
- 由 ss 判断是否可以创建新进程，如果答案是否，整个 fork 会失败。

3. cgroup_post_fork()

```c
void cgroup_post_fork(struct task_struct *child,
		      struct kernel_clone_args *kargs)
	__releases(&cgroup_threadgroup_rwsem) __releases(&cgroup_mutex)
{
    // ...（省略部分代码）

    /* init tasks are special, only link regular threads */
	if (likely(child->pid)) {
		WARN_ON_ONCE(!list_empty(&child->cg_list));
		cset->nr_tasks++;
		css_set_move_task(child, NULL, cset, false);
	} else {
		put_css_set(cset);
		cset = NULL;
	}

    // ...（省略部分代码）
}
```

**主要功能**

1. 若子进程有效（pid != NULL）
   - 获取父进程的 css_set（task_css_set(current)）
   - 调用 css_set_move_task(child, NULL, cset, false)将子进程加入父进程的 css_set：
     - 增加 cset->nr_tasks 计数
     - 将 child->cg_list 链入 cset->tasks 链表，完成 cgroup 绑定
2. 调用各子系统的 ss->fork()回调（如 cpuset_fork()复制父进程的 CPU 亲和性和内存策略）
