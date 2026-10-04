#
# Copyright (C) 2026 LuCI community
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=Dynv6 - dynamic IPv6 DNS updater
LUCI_DEPENDS:=+luci-base +uclient-fetch +jsonfilter +ca-bundle

PKG_VERSION:=1.0
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=OpenWrt LuCI community

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature