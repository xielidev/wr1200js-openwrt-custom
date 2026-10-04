# YouHua WR1200JS — Custom OpenWrt

**English** | [中文](#中文)

Custom OpenWrt overlay and packages for the **YouHua WR1200JS** router
(MediaTek MT7621AT, 16 MB NOR flash, 128 MB RAM).

This repository is **not** a full OpenWrt source tree — it only holds the
custom parts. Copy `files/`, `package/` and `.config` onto a clean OpenWrt
tree and build.

- Base firmware: OpenWrt 25.12.5 (`r33051-f5dae5ece4`)
- Target: `ramips/mt7621`, device `youhua_wr1200js`
- Package manager: `apk`
- LuCI defaults to Chinese, bootstrap theme

## Layout

```
files/                         # files overlaid onto the firmware rootfs (OpenWrt files/ mechanism)
  etc/uci-defaults/
    20-fstab-anon-mount        # enable anonymous USB auto-mount (fstab anon_mount/auto_mount)
    96-luci-cache-bust         # re-stamp the apk DB on first boot to bust LuCI static-resource cache
    99-br0-dumbap              # configure br0 as a dumb AP (no local DHCP/NAT)
  etc/init.d/socat             # socat forwarding service (expands port ranges into instances)
  etc/hotplug.d/mount/
    70-ksmbd-tune              # fix ksmbd auto-shares: /mnt/* read/write, drop risky rom/overlay shares

package/
  luci-app-socat/              # LuCI front-end for socat (single port or range)
  luci-app-dynv6/              # LuCI front-end for dynv6.com dynamic DNS

.config                        # full build configuration
.config.seed                   # minimal seed config (target device + key packages)
```

## Features

### 1. socat port forwarding (with port ranges)
`package/luci-app-socat` + `files/etc/init.d/socat`.

- The UI accepts a single port (`8080`) or a range (`40001-40003`).
- The init script **expands** a range into one socat instance per port
  (managed by procd, kept alive with `respawn`).
- A single rule spans at most 64 ports (`MAX_PORTS`) so a typo such as
  `1-65535` cannot spawn tens of thousands of processes.
- Supports TCP/UDP, IPv6 listeners and per-interface bind addresses that are
  resolved on every start (so they follow upstream prefix changes).
- Listen address uses `reuseaddr,fork`: **one master process per port, a
  forked child per accepted connection**.

> Note: socat is a userspace relay and is **not** covered by kernel/hardware
> flow offloading (flow offload only applies to forwarded traffic). For high
> bandwidth (> 200 Mbps) prefer nftables DNAT.

### 2. USB network share (ksmbd)
`files/etc/uci-defaults/20-fstab-anon-mount` + `files/etc/hotplug.d/mount/70-ksmbd-tune`.

- A plugged-in USB disk is auto-mounted by `blockd` under `/mnt/<dev>`.
- ksmbd's own hotplug creates a share per block device; this script then tunes it:
  - `/mnt/*` (real storage) → **read/write** (`read only = no`), guest allowed
  - anything else (`/rom`, `/rom/overlay`, ... which contain `/etc/shadow` and
    the dropbear host keys) → **share removed**, so nothing leaks anonymously

### 3. LuCI static-resource cache busting
`files/etc/uci-defaults/96-luci-cache-bust`.

LuCI derives the `?v=` version appended to static resources from the mtime of
`/lib/apk/db/installed`. Reproducible builds pin those mtimes to
`SOURCE_DATE_EPOCH`, so the version never changes across builds and browsers
keep serving a stale JavaScript cache, hiding UI changes. The script re-stamps
the mtime on first boot so that every flash yields a new `?v=`.

### 4. Dumb AP mode
`files/etc/uci-defaults/99-br0-dumbap`: configure br0 as an access point with
local DHCP/NAT disabled.

## Build

```sh
# 1. Get a clean OpenWrt tree at the exact release tag (r33051 == v25.12.5)
#    Use the release branch `-b openwrt-25.12` instead to track patch updates.
git clone -b v25.12.5 --depth 1 https://git.openwrt.org/openwrt/openwrt.git
cd openwrt

# 2. Overlay this repository
cp -a /path/to/wr1200js-openwrt-custom/files      .
cp -a /path/to/wr1200js-openwrt-custom/package/*  package/
cp /path/to/wr1200js-openwrt-custom/.config       .config

# 3. Update feeds and build
./scripts/feeds update -a && ./scripts/feeds install -a
make defconfig && make -j$(nproc)
```

Output lands in `bin/targets/ramips/mt7621/`; `*-squashfs-sysupgrade.bin` is
the image to flash.

> Tip: after editing `files/`, delete `build_dir/.../root.squashfs` plus
> `bin/targets/.../*.bin`, `*.manifest` and `sha256sums*` before rebuilding —
> `files/` is not an explicit dependency of the rootfs target, so the image
> would otherwise not be regenerated.

### Cloud build (GitHub Actions)

`.github/workflows/build.yml` builds the firmware on GitHub runners. Trigger it
manually from the **Actions** tab (or push a `v*` tag). Artifacts:

- every run attaches the sysupgrade image as the `wr1200js-firmware` artifact;
- a `v*` tag push additionally creates a GitHub Release and uploads the images
  to it.

The build enables OpenWrt `ccache` (via `CONFIG_CCACHE=y`) and caches
`openwrt/.ccache` between runs, so rebuilds are much faster. The runner has only
2 cores, so the first from-scratch build is slow (up to the 6h job limit).

## License

The LuCI applications here are Apache-2.0; the remaining scripts follow
OpenWrt conventions.

---

# YouHua WR1200JS 定制 OpenWrt

[English](#youhua-wr1200js--custom-openwrt) | **中文**

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
# 1. 拉取干净的 OpenWrt 源码，指定发布标签（r33051 对应 v25.12.5）
#    如需跟随补丁更新，可改用发布分支 `-b openwrt-25.12`
git clone -b v25.12.5 --depth 1 https://git.openwrt.org/openwrt/openwrt.git
cd openwrt

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

### 云端自动编译（GitHub Actions）

`.github/workflows/build.yml` 在 GitHub 运行器上编译固件：在 **Actions** 页手动
触发（或推送 `v*` 标签）。产物：

- 每次运行都会把 `sysupgrade` 镜像作为 `wr1200js-firmware` 工件附加；
- 推送 `v*` 标签时额外创建一个 GitHub Release，并把镜像上传其中。

构建会启用 OpenWrt `ccache`（`CONFIG_CCACHE=y`）并在多次运行间缓存
`openwrt/.ccache`，因此重复编译会快很多。运行器只有 2 核，首次从零编译较慢
（可能逼近 6 小时的任务上限）。

## 许可

本仓库中的 LuCI 应用按 Apache-2.0 授权；其余脚本按 OpenWrt 惯例。