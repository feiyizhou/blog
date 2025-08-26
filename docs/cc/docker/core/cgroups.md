![Docker](/docker/docker.png)

# Docker 核心技术：Linux Cgroups

大家好，我是费益洲。Linux Cgroups 作为 Docker 的技术核心之一，主要作用就是限制、控制和统计进程组的系统资源 ​​（如 CPU、内存、磁盘 I/O 等）。容器的本质其实就是 Linux 的一个进程，限制、控制和统计容器的系统资源，其实就是限制、控制和统计进程的系统资源，本文将从 Linux 内核源码的层面，谈谈如何通过 Cgroups 实现限制系统资源。

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

   - 树形组织，子级 cgroup 进程继承父级 cgroup 的限制（如`/sys/fs/cgroup/memory/father/child`child 初始继承 father 的限制）

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

   - 子级文件系统接口可以通过`mkdir`命令在父级文件系统接口目录下创建，并会自动创建并继承父级文件系统接口的配置

   ```bash
   [root@master01 ~]# cd /sys/fs/cgroup/memory
   [root@master01 memory]# mkdir mygroup
   [root@master01 memory]# ls mygroup/
   cgroup.clone_children           memory.kmem.tcp.failcnt             memory.numa_stat
   cgroup.event_control            memory.kmem.tcp.limit_in_bytes      memory.oom_control
   cgroup.kill                     memory.kmem.tcp.max_usage_in_bytes  memory.pressure_level
   cgroup.procs                    memory.kmem.tcp.usage_in_bytes      memory.qos_level
   memory.events                   memory.kmem.usage_in_bytes          memory.reclaim
   memory.events.local             memory.ksm                          memory.soft_limit_in_bytes
   memory.failcnt                  memory.limit_in_bytes               memory.stat
   memory.flag_stat                memory.low                          memory.swapfile
   memory.force_empty              memory.max_usage_in_bytes           memory.swap.max
   memory.force_swapin             memory.memfs_files_info             memory.swappiness
   memory.high                     memory.memsw.failcnt                memory.usage_in_bytes
   memory.high_async_ratio         memory.memsw.limit_in_bytes         memory.use_hierarchy
   memory.kmem.failcnt             memory.memsw.max_usage_in_bytes     memory.wb_blkio_ino
   memory.kmem.limit_in_bytes      memory.memsw.usage_in_bytes         notify_on_release
   memory.kmem.max_usage_in_bytes  memory.min                          tasks
   memory.kmem.slabinfo            memory.move_charge_at_immigrate
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

通过 fork() → cgroup_fork()（设默认值） → cgroup_can_fork() → cgroup_post_fork()（继承父进程 css_set） → 进程正式加入父进程的 cgroup 组。

💡 内核在启动时会通过 cgroup_init_early() 和 cgroup_init() 构建全局 cgroup 框架，后续的进程都默认加入全局的 cgroup 组。

### Cgroups 限制资源的实现

#### CPU 资源限制

限制进程的 CPU 使用率的根本原理是限制进程在 CPU 中占用的时间配额的占比。CPU 限制主要通过 ​​CFS（Completely Fair Scheduler）调度器实现，相关参数为：

- cpu.cfs_period_us：定义资源分配的周期长度（单位：微秒），​​ 默认 100000μs

- cpu.cfs_quota_us：定义在周期内允许进程组使用的最大 CPU 时间（单位：微秒），默认 -1，当为 -1 时，表示不限制 CPU 的使用率

两者的比值决定 CPU 使用率上限：

> 使用率上限 = cpu.cfs_quota_us / cpu.cfs_period_us

例如：

- quota=50000 period=100000 → 上限 50%（单核）
- quota=200000 period=100000 → 上限 200%（双核）

#### Memory 资源限制

memory 子系统通过内核级的内存资源跟踪与强制干预机制实现对进程组内存使用的精确限制，主要参数为：

- memory.limit_in_bytes：硬性内存限制

  单位：字节，支持 K/M/G 后缀，如果设置为 -1，则表示解除 memory 限制

  功能：

  - 设置 cgroup 中所有进程可使用的物理内存上限
  - 当进程尝试分配超过此限制的内存时，内核会拒绝分配并可能触发 OOM Killer 终止进程

- memory.soft_limit_in_bytes：软性内存限制

  单位：字节，支持 K/M/G 后缀，如果设置为 -1，则表示解除 memory 限制

  功能：

  - 设置内存使用的警戒线
  - 不强制阻止超限，但在系统全局内存紧张时，内核优先回收超限 cgroup 的内存（如 PageCache），使其用量向软限制值靠拢

  ⚠️ 软限制值必须小于硬限制值 memory.limit_in_bytes ，否则无效

此处只列举 memory.limit_in_bytes、memory.soft_limit_in_bytes 两个参数，其余参数同志们自行探索。

### Cgroups 回收

cgroup 的回收也是由引用计数（refcount）​​ 来判断和执行的，具体的回收流程此处不再研究，感兴趣的通知可以自行查阅源码。回收的标准和原则就是：**引用计数归零**（即无任何进程关联、无子 cgroup、无文件描述符引用）。

💡 示例 ​​：删除一个 cgroup 需先移除所有进程（echo $$ > /sys/fs/cgroup/cgroup.procs），再删除子 cgroup，最后 `rmdir` 其目录。若未清空进程直接删除，内核因引用计数 >0 而拒绝操作

## Go 通过 Cgroups 限制进程的资源

在之前测试了 Namespace 的 Go 代码的基础上，做出修改，使用工具 stress 对进程进行压力测试，来验证 Cgroups 的有效性，Go 代码如下：

```go
package main

import (
	"fmt"
	"os"
	"os/exec"
	"path"
	"strconv"
	"strings"
	"syscall"
)

const cgroupMemoryPath = "/sys/fs/cgroup/memory"

func main() {

	if strings.EqualFold(os.Args[0], "/proc/self/exe") {
		fmt.Printf("current pid: %d\n", syscall.Getpid())
		cmd := exec.Command("sh", "-c", `stress --vm-bytes 2048m --vm-keep -m 1 --vm-hang 1`)
		cmd.SysProcAttr = &syscall.SysProcAttr{}
		cmd.Stdin = os.Stdin
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			fmt.Printf("Internal Error: %s\n", err.Error())
			os.Exit(1)
		}
	}

	cmd := exec.Command("/proc/self/exe")
	cmd.SysProcAttr = &syscall.SysProcAttr{
		Cloneflags: syscall.CLONE_NEWUTS | syscall.CLONE_NEWIPC | syscall.CLONE_NEWPID |
			syscall.CLONE_NEWNS | syscall.CLONE_NEWUSER | syscall.CLONE_NEWNET,
	}
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Start(); err != nil {
		fmt.Printf("Error: %s\n", err.Error())
		os.Exit(1)
	} else {
		fmt.Printf("process id: %d\n", cmd.Process.Pid)
		// create child memory subsystem
		os.Mkdir(path.Join(cgroupMemoryPath, "mygroup"), 0755)
		// add process pid to child memory subsystem
		os.WriteFile(path.Join(cgroupMemoryPath, "mygroup", "tasks"), []byte(strconv.Itoa(cmd.Process.Pid)), 0644)
		// limit memory usage
		os.WriteFile(path.Join(cgroupMemoryPath, "mygroup", "memory.limit_in_bytes"), []byte("1024m"), 0644)
	}
	cmd.Process.Wait()
}
```

💡 宿主机需要提前安装好 stress

在宿主机运行代码后，输出如下：

```bash
[root@master01 test]# go run main.go
process id: 623769
current pid: 1
stress: info: [7] dispatching hogs: 0 cpu, 0 io, 1 vm, 0 hdd
stress: FAIL: [7] (415) <-- worker 8 got signal 9
stress: WARN: [7] (417) now reaping child worker processes
stress: FAIL: [7] (421) kill error: No such process
stress: FAIL: [7] (451) failed run completed in 0s
Internal Error: exit status 1
```

现在对 Go 代码和报错进行分析：

- 代码的主要功能是创建一个隔离了系统资源的新进程（通过`/proc/self/exe`重新执行自身），并在新的 Namespace 中运行工具 stress。同时还创建了一个名为`mygroup`的 cgroup ，将新进程加入其中，还限制了`mygroup`的内存使用上限为`1024MB`。而 stress 工具的参数是`--vm-bytes 2048m`，即尝试为该进程分配`2048MB`的内存。
- 报错信息中，stress 工具在运行过程中被终止，并显示`signal 9`。继续分析后面的报错信息，表明了 stress 工具是在尝试尝试分配内存后被强制 kill。

根据以上信息，我们可以推导出以下原因：

1. cgroup 内存限制生效：我们在 cgroup 中设置了内存限制为 1024MB（memory.limit_in_bytes=1024m）。而 stress 命令试图分配 2048MB 内存（--vm-bytes 2048m），这显然超过了 1024MB 的限制
2. OOM Killer 触发：当进程使用的内存超过 cgroup 设置的限制时，内核的 OOM Killer 会被触发，并发送 SIGKILL 信号（信号 9）终止该进程。这正是错误信息中提到的 signal 9 的来源

接下来，通过以下两种方案来进行反向验证：

- 将 cgroup 的内存限制调整为 2048MB 以上，使其能够容纳 stress 命令的内存需求
- 将 stress 命令的内存分配参数（--vm-bytes）调整到 1024MB 以内，使其在限制范围内运行

我们使用第二种方案进行验证，将 stress 的内存分配修改为 512MB，执行代码，输出如下：

```bash
[root@master01 test]# go run main.go
process id: 676092
current pid: 1
stress: info: [7] dispatching hogs: 0 cpu, 0 io, 1 vm, 0 hdd
```

此时未报错，在新的宿主机命令终端中查看进程 676092 的实际内存占用，`top -p 676092`：

```bash
top - 11:45:48 up 19:58,  2 users,  load average: 0.22, 0.53, 0.57
Tasks:   1 total,   0 running,   1 sleeping,   0 stopped,   0 zombie
%Cpu(s):  2.3 us,  0.8 sy,  0.0 ni, 96.6 id,  0.0 wa,  0.3 hi,  0.1 si,  0.0 st
MiB Mem :  23525.9 total,   8590.1 free,   6495.6 used,   9348.4 buff/cache
MiB Swap:      0.0 total,      0.0 free,      0.0 used.  17030.4 avail Mem

    PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND
 676092 root      20   0  527756 524460    276 S   0.3   2.2   0:00.34 stress
```

从上面的输出可以看出，此时进程的内存占用是 512 / 23525.9 ≈ 0.0218，四舍五入转换成百分比即为 2.2%。而且此时程序并未报错，则再次验证了 Cgroup 的有效性。

🔖 **cgroup.procs 和 tasks**

通过查看目录`/sys/fs/cgroup/memory/mygroup`可以看到：

```bash
[root@master01 ~]# ls /sys/fs/cgroup/memory/mygroup
cgroup.clone_children           memory.kmem.tcp.failcnt             memory.numa_stat
cgroup.event_control            memory.kmem.tcp.limit_in_bytes      memory.oom_control
cgroup.kill                     memory.kmem.tcp.max_usage_in_bytes  memory.pressure_level
cgroup.procs                    memory.kmem.tcp.usage_in_bytes      memory.qos_level
memory.events                   memory.kmem.usage_in_bytes          memory.reclaim
memory.events.local             memory.ksm                          memory.soft_limit_in_bytes
memory.failcnt                  memory.limit_in_bytes               memory.stat
memory.flag_stat                memory.low                          memory.swapfile
memory.force_empty              memory.max_usage_in_bytes           memory.swap.max
memory.force_swapin             memory.memfs_files_info             memory.swappiness
memory.high                     memory.memsw.failcnt                memory.usage_in_bytes
memory.high_async_ratio         memory.memsw.limit_in_bytes         memory.use_hierarchy
memory.kmem.failcnt             memory.memsw.max_usage_in_bytes     memory.wb_blkio_ino
memory.kmem.limit_in_bytes      memory.memsw.usage_in_bytes         notify_on_release
memory.kmem.max_usage_in_bytes  memory.min                          tasks
memory.kmem.slabinfo            memory.move_charge_at_immigrate
```

里面包含了两个关键文件 `cgroup.procs` 和 `tasks`。在 Linux cgroups 机制中，cgroup.procs 和 tasks 文件均用于管理控制组（cgroup）中的进程，但两者在操作对象、功能和设计定位上存在显著区别。以下是详细对比：

| 特性           | cgroup.procs                            | tasks                                       |
| -------------- | --------------------------------------- | ------------------------------------------- |
| 操作对象       | 线程组 ID（TGID）                       | 线程 ID（TID）                              |
| 功能范围       | 管理整个进程组（包含所有线程）          | 管理单个线程                                |
| 写入效果       | 写入 TGID 会将进程的所有线程加入 cgroup | 写入 TID 仅加入单个线程，不涉及同组其他线程 |
| cgroup v2 环境 | 唯一支持的进程管理接口                  | 已移除                                      |
