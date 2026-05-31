# 移除 HyperOS 音乐触感白名单
一个简单的 Zygisk Next 模块，尝试使用户可自定义 HyperOS 3 高通机型的 Audio to Haptic 白名单

# 使用方法
- 安装 [Zygisk Next](https://github.com/Dr-TSNG/ZygiskNext)
- 安装本模块并重启
- 在 `/data/adb/hyperos_music_haptic_whitelist.txt` 中配置白名单包名，修改实时生效
- 大功告成

# WebUI 使用
- 使用 KernelSU / KernelSU Next 管理器安装本模块后，可以在模块详情页打开 WebUI
- WebUI 会读取当前 `/data/adb/hyperos_music_haptic_whitelist.txt`，支持查看、筛选、添加、移除、批量粘贴、去重排序白名单包名
- 点击保存时会先自动备份当前配置到 `/data/adb/remove_hyperos_haptic_whitelist/backup/`，再写回白名单文件
- 写回后模块会沿用现有热更新机制实时生效，一般不需要重启
- 如果不使用 KernelSU WebUI，也可以继续直接编辑 `/data/adb/hyperos_music_haptic_whitelist.txt`

# 支持机型
- Xiaomi 15 Pro
- Xiaomi 17 Pro Max

# 致谢
- [wxxsfxyzm](https://github.com/wxxsfxyzm) 测试/提出想法
- [5ec1cff](https://github.com/5ec1cff) 提供帮助
