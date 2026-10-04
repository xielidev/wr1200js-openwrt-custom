# YouHua WR1200JS 定制 OpenWrt

友华 **WR1200JS**（MediaTek MT7621AT，16MB NOR Flash，128MB RAM）路由器上运行的
自定义 OpenWrt 配置与固件叠加层（overlay）。

本仓库**不是**完整的 OpenWrt 源码树，只存放自定义部分：把这里的 `files/`、
`package/`、`.config` 覆盖到一份干净的 OpenWrt 源码树后即可编译出成品固件。

- 固件基线：OpenWrt 25.12.5（`r33051-f5dae5ece4`）
- 目标平台：`ramips/mt7621`，设备 `youhua_wr1200js`
- 包管理器：`apk`
- LuCI 默认中文，主题 bootstrap

## 目录结构

```
files/                         # 直接叠加到固件 rootfs 的文件（OpenWrt 的 files/ 机制）
  etc/uci-defaults/
    20-fstab-anon-mount        # 开启 U 盘匿名自动挂载（fstab anon_mount/auto_mount）
    96-luci-cache-bust         # 每次刷机后重打 apk 数据库时间戳，强制浏览器刷新 LuCI 静态资源
    99-br0-dumbap              # 把 br0 配成纯 AP（关 DHCP/NAT，板子做接入点）
  etc/init.d/socat             # socat 转发服务（支持端口段展开为多实例）
  etc/hotplug.d/mount/
    70-ksmbd-tune              # 校正 ksmbd 自动共享：/mnt/* 改为可读写，剔除 rom/overlay 等危险共享

package/
  luci-app-socat/              # socat 的 LuCI 界面（支持 40001-40003 端口段）
  luci-app-dynv6/              # dynv6.com 动态 DNS 的 LuCI 界面

.config                        # 完整编译配置
.config.seed                   # 精简的种子配置（目标设备 + 关键包）
```

## 功能说明

### 1. socat 端口转发（含端口段）
`package/luci-app-socat` + `files/etc/init.d/socat`。

- 页面可填单个端口（`8080`）或端口段（`40001-40003`）
- init 脚本把端口段**展开**为「每端口一个 socat 实例」（procd 管理，`respawn` 保活）
- 单个规则最多展开 64 个端口（`MAX_PORTS`），防止 `1-65535` 之类的误填把系统打死
- 支持 TCP/UDP、IPv6 监听、按接口动态解析监听地址（跟随上游前缀变化）
- 监听地址带 `reuseaddr,fork`：**每端口一个主进程，每连接 fork 一个子进程**

> 注意：socat 是用户态中继，**不参与内核/硬件流量卸载**（flow offload 只作用于转发路径），
> 高带宽场景（>200Mbps）建议改用 nftables DNAT。

### 2. U 盘网络共享（ksmbd）
`files/etc/uci-defaults/20-fstab-anon-mount` + `files/etc/hotplug.d/mount/70-ksmbd-tune`。

- 插入 U 盘后由 `blockd` 自动挂载到 `/mnt/<dev>`
- ksmbd 自带的 hotplug 会为每个块设备生成共享，本脚本再校正：
  - `/mnt/*`（真实存储）→ **可读写**（`read only = no`）、允许访客
  - 其它（`/rom`、`/rom/overlay` 等，含 `/etc/shadow`、dropbear 主机密钥）→ **删除共享**，避免匿名泄露

### 3. LuCI 静态资源缓存破坏
`files/etc/uci-defaults/96-luci-cache-bust`。

LuCI 给静态资源的 `?v=` 版本号取自 `/lib/apk/db/installed` 的 mtime，而可复现构建
会把这些 mtime 固定成 `SOURCE_DATE_EPOCH`，导致跨版本升级后浏览器仍复用旧缓存、
看不到 UI 改动。该脚本在首次启动时重打时间戳，使每次刷机后 `?v=` 都变化。

### 4. 纯 AP 模式
`files/etc/uci-defaults/99-br0-dumbap`：把 br0 配为接入点（关闭本机 DHCP/NAT）。

## 构建

```sh
# 1. 拉取干净的 OpenWrt 源码（对应版本）
git clone https://git.openwrt.org/openwrt/openwrt.git
cd openwrt && git checkout <与 r33051 对应的 tag/commit>

# 2. 叠加本仓库
cp -a /path/to/wr1200js-openwrt-custom/files      .
cp -a /path/to/wr1200js-openwrt-custom/package/*  package/
cp /path/to/wr1200js-openwrt-custom/.config       .config

# 3. 更新并编译
./scripts/feeds update -a && ./scripts/feeds install -a
make defconfig && make -j$(nproc)
```

产物在 `bin/targets/ramips/mt7621/`，其中 `*-squashfs-sysupgrade.bin` 用于刷机。

> 提示：修改 `files/` 后重新编译前，需先删除 `build_dir/.../root.squashfs` 与
> `bin/targets/.../*.bin`、`*.manifest`、`sha256sums*`，否则镜像不会重新生成
> （`files/` 不是 rootfs 目标的显式依赖）。

## 许可

本仓库中的 LuCI 应用按 Apache-2.0 授权；其余脚本按 OpenWrt 惯例。