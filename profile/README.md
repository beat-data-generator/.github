## Hi there 👋
[Beat Data Generator](https://github.com/BUGJI/beat_data_generator) 是一个专用于音乐踩点的工具，旨在提供 更便利、更简单、更强大 的踩点功能

同时可以让这份工程流转成各种你想要的格式，让你更便捷的去兼容各平台的工作

# 插件系统
此项目拥有插件系统，最初的设计仅是为了支持多种格式的导出，但是目前发现插件系统的潜力远不于此！
- 可以创建ws连接或者执行命令 与别的软件联动更改
- 可以从其他来源导入工程，快速进入编辑
- 可以监听播放状态，可以接入第三方播放器

# 插件一览

| 插件 | 说明 |
| --- | --- |
| [ADOFAI 导出](https://github.com/beat-data-generator/bdg_plugin_adofai) | 把踩点工程导出为 A Dance of Fire and Ice（`.adofai`）关卡，支持双押、BPM 变速轨道与暂停补偿 |
| [Phira 谱面转换器](https://github.com/beat-data-generator/bdg_plugin_phira) | 把工程中的踩点（Tap）转换成 Phira/RPE 谱面，可选合并成单判定线模式，并连同音频打包为 `.pez` |
| [舞萌 Simai 导出](https://github.com/beat-data-generator/bdg_plugin_simai) | 把所有标记点按最小分拍网格导出为舞萌（Simai）谱面，并写入 BPM 变化标记 |
| [osu!mania 导出](https://github.com/beat-data-generator/bdg_plugin_osu) | 把踩点导出为 osu!mania 谱面（`.osu`），可选键数并把每条轨道映射到列，同一时刻的多轨踩点自动成为多押 |
| [时间戳导入](https://github.com/beat-data-generator/bdg_plugin_import) | 从文本时间戳或 MIDI 文件导入踩点 |
| [DG-LAB 联动](https://github.com/beat-data-generator/bdg_plugin_dglab_v4) | 通过 DG-LAB 4 WebSocket Relay 连接设备，在播放到节拍点时联动输出强度/脉冲 |

以上插件都可以在应用内的**插件市场**一键安装 / 更新（设置 → 插件 → 插件市场）。

# 提醒
这个项目：
- 并不完全为音游而设计，也不是为了去替代某些编辑器而设计，此项目设计仅完成其他项目中最繁琐的部分
- 插件几乎允许你做任何事情，我们拥有 [插件模板](https://github.com/beat-data-generator/bdg_plugin_template) 内部包含各个方法的说明

# 关于
本项目由一群志同道合的人一起打磨
