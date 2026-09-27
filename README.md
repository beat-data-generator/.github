# Beat Data Generator — 组织级配置与工具

本仓库集中放置 Beat Data Generator 插件组织共用的 GitHub Actions 与脚本。

## 插件发布工作流（reusable）

`.github/workflows/release-plugin.yml` 负责：校验 `manifest.json` → 打包
`plugin.zip` → 创建/更新 GitHub Release → 输出 SHA-256。

插件仓库只需在 `.github/workflows/release.yml` 里调用：

```yaml
name: Release

on:
  push:
    tags: ["v*"]

jobs:
  release:
    uses: beat-data-generator/.github/.github/workflows/release-plugin.yml@main
    permissions:
      contents: write
```

打 tag（如 `v1.2.3`）时触发，tag 必须等于 `manifest.json` 的 `version`
（可加 `v` 前缀）。发布后 [registry](https://github.com/beat-data-generator/registry)
的定时任务会读取 Release 资产的 SHA-256 并写入插件市场索引。

### 打包规则

- 发布包根目录必须包含 `manifest.json`。
- 默认排除 `.github/`、`.gitignore`、`.gitattributes`、`.pluginignore`、
  `.editorconfig`、`node_modules/`。
- 如需排除更多文件，在插件仓库根放 `.pluginignore`（gitignore 风格，每行一个：
  支持 `#` 注释、`dir/`、`*`、`**`、`?`）。
- 若 `.pluginignore` 排除了 `manifest.json`，打包会直接失败。

### 输入 / 输出

| 输入 | 默认值 | 说明 |
| --- | --- | --- |
| `asset-name` | `plugin.zip` | Release 资产名，也是 registry 查找的名称 |
| `tag-prefix` | `v` | tag 前缀，需与版本号拼成完整 tag |
| `node-version` | `20` | 打包用 Node 版本 |

| 输出 | 说明 |
| --- | --- |
| `version` | `manifest.json` 里的版本 |
| `sha256` | 产物 SHA-256 |

## 目录

```
.github/workflows/release-plugin.yml   # 可复用发布工作流
scripts/package-plugin.mjs             # 打包脚本（被工作流下载执行）
```
