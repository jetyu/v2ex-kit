# V2EX Kit

V2EX Kit 是一个面向 V2EX 的浏览器用户脚本，用于改善主题浏览、回复阅读和用户管理体验。脚本在 V2EX 页面内运行，无需部署独立服务。

[安装脚本](https://raw.githubusercontent.com/jetyu/v2ex-kit/main/dist/v2ex-kit.user.js) · [正式版本](https://github.com/jetyu/v2ex-kit/releases/latest) · [问题反馈](https://github.com/jetyu/v2ex-kit/issues)

## 功能特性

- **界面与主题**：提供多套可切换主题，并支持简体中文、英语和日语界面。
- **主题阅读**：支持列表页主题预览、大图查看和长回复自动折叠。
- **回复浏览**：预加载后续回复页，连续展示多页内容，并提取高感谢数回复。
- **用户管理**：通过悬浮卡片查看用户资料和近期活动，支持自定义标签、关注与屏蔽。
- **回复工具**：提供浮动回复框、表情选择和 Imgur 图片上传，并保留上传记录。
- **辅助功能**：支持每日自动签到、页面快捷操作以及设置和用户标签的备份恢复。

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或其他兼容的用户脚本管理器。
2. 打开 [V2EX Kit 安装文件](https://raw.githubusercontent.com/jetyu/v2ex-kit/main/dist/v2ex-kit.user.js)，并在脚本管理器中确认安装。
3. 刷新 V2EX 页面。

建议停用 V2EX Polish、V2EX.REP 等功能重叠的脚本，避免多个脚本同时修改页面。

## 配置

安装后，通过 V2EX Kit 设置面板管理主题、语言和功能开关。自动签到、关注、屏蔽和回复等账号相关功能仅在登录 V2EX 后可用。

## 数据与隐私

设置、用户标签和图片上传记录默认保存在用户脚本管理器本地。设置与标签可以通过 JSON 文件导入导出，也可手动备份至 V2EX 记事本。详细规则见 [备份与恢复](docs/backup.md)。

图片上传功能会将所选文件发送至 Imgur 公共图床。Imgur 图片代理默认关闭，启用后会将 Imgur 图片地址发送给配置的代理服务。

## 开发

开发环境需要 Node.js 和 npm。受支持的 Node.js 版本见 [package.json](package.json)。

```sh
npm ci --ignore-scripts
npm run check
```

- `npm run build`：构建用户脚本。
- `npm test`：构建并运行测试。
- `npm run check`：执行格式检查、构建和完整测试。

构建产物位于 `dist/v2ex-kit.user.js` 和 `dist/v2ex-kit.meta.js`。

## 致谢

- [V2EX Polish](https://github.com/coolpace/V2EX_Polish)：主题、预览、用户卡片、标签、表情和长回复折叠。
- [V2EX.REP](https://github.com/v2hot/v2ex.rep)：热门回复侧栏和图片上传入口。

第三方代码的版权与许可信息见 [第三方声明](THIRD-PARTY-NOTICES.md)。

## 许可证

本项目采用 [MIT 许可证](LICENSE)。
