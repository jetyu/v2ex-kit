<div align="center">
  <img src="https://raw.githubusercontent.com/jetyu/v2ex-kit/main/assets/v2ex-kit.png" width="144" alt="V2EX Kit Logo">
  <h1>V2EX Kit</h1>
  <p>改善 V2EX 阅读与回复体验，提供主题切换、帖子预览、用户标签、自动签到和图片上传的油猴脚本</p>

  <p>
    <a href="https://greasyfork.org/zh-CN/scripts/397787-v2ex-kit"><strong>在 Greasy Fork 安装</strong></a>
    · <a href="https://raw.githubusercontent.com/jetyu/v2ex-kit/main/dist/v2ex-kit.user.js">直接安装</a>
    · <a href="https://github.com/jetyu/v2ex-kit/issues">问题反馈</a>
  </p>
</div>

V2EX Kit 是运行在 V2EX 页面内的用户脚本。主题美化、内容预览、分页回复、用户标签和自动签到等常用能力整合到一个可配置的脚本中。

## 功能概览

| 模块         | 能力                                                                |
| ------------ | ------------------------------------------------------------------- |
| 界面与主题   | 多套可切换主题；简体中文、英语和日语界面；桌面端与移动端布局适配    |
| 主题阅读     | 列表页主题预览、大图查看、长回复折叠、Base64 自动解码和页面快捷操作 |
| 回复浏览     | 后续页面预加载、跨页连续阅读、引用关系解析和高感谢回复提取          |
| 用户管理     | 悬浮资料卡、近期活动、自定义标签、关注与屏蔽                        |
| 回复工具     | 浮动回复框、表情选择、Imgur 图片上传及上传记录                      |
| 自动化与数据 | 每日自动签到、设置与标签导入导出、V2EX 记事本备份                   |

所有功能均可在设置面板中按需启用。账号相关功能（签到、关注、屏蔽和回复等）需要先登录 V2EX。

## 安装

### 1. 安装用户脚本管理器

推荐使用 [Tampermonkey](https://www.tampermonkey.net/)，也可使用兼容 UserScript API 的脚本管理器。

### 2. 安装 V2EX Kit

打开 [Greasy Fork 脚本页](https://greasyfork.org/zh-CN/scripts/397787-v2ex-kit)，点击“安装此脚本”，随后在脚本管理器中确认安装。也可以从仓库[直接安装最新构建](https://raw.githubusercontent.com/jetyu/v2ex-kit/main/dist/v2ex-kit.user.js)。

### 3. 打开 V2EX

刷新任意 V2EX 页面。安装成功后，页面顶部和用户脚本管理器菜单中会出现 **V2EX Kit 设置**入口。

> [!IMPORTANT]
> V2EX Polish、V2EX.REP 等脚本与本项目存在功能重叠。建议停用重叠脚本，避免多个脚本同时修改 DOM、样式或回复行为。

## 配置与数据

脚本设置、用户标签和图片上传记录默认通过用户脚本管理器保存在本地，不依赖项目自建服务器。

- 设置和用户标签支持 JSON 导入与导出。
- 登录后可将备份手动写入 V2EX 记事本，便于跨设备恢复。
- 图片上传会把用户选取的文件发送到 Imgur 公共图床。
- Imgur 图片代理默认关闭；启用后，图片地址会发送到用户配置的代理服务。

## 浏览器与脚本管理器

构建目标为 Chrome 130+ 与 Firefox 150+。其他 Chromium / Firefox 衍生浏览器通常也可运行，但不在持续测试范围内。

脚本使用 `GM_*` 存储、菜单、样式与跨域请求 API；若使用 Tampermonkey 之外的管理器，请确认这些 API 可用。

## 本地开发

项目需要 Node.js 和 npm，受支持的 Node.js 版本以 [package.json](package.json) 中的 `engines` 字段为准。

```sh
npm ci --ignore-scripts
npm run check
```

| 命令                   | 用途                             |
| ---------------------- | -------------------------------- |
| `npm run build`        | 将源码和样式打包为用户脚本       |
| `npm test`             | 重新构建并运行 Node.js 测试套件  |
| `npm run format:check` | 检查 Prettier 格式               |
| `npm run check`        | 依次执行格式检查、构建和完整测试 |

### 项目结构

```text
.
├─ assets/                 # README 与脚本使用的品牌资源
├─ dist/                   # 可安装的构建产物
├─ scripts/build.mjs       # esbuild / Sass 构建入口
├─ src/                    # 功能模块、主题和样式源码
└─ tests/                  # Node.js 测试套件与页面 fixtures
```

构建会生成：

- `dist/v2ex-kit.user.js`：完整可安装脚本；
- `dist/v2ex-kit.meta.js`：供脚本管理器检查更新的元数据。

## 设计与依赖

功能按模块组织在 `src/` 中，由 `src/main.js` 统一初始化。构建阶段使用 esbuild 打包 JavaScript，并通过 Sass 与 esbuild 处理、压缩样式；运行时依赖 `@floating-ui/dom` 完成浮层定位。

项目吸收并改造了以下开源项目的部分能力：

- [V2EX Polish](https://github.com/coolpace/V2EX_Polish)：主题、预览、用户卡片、标签、表情与长回复折叠；
- [V2EX.REP](https://github.com/v2hot/v2ex.rep)：热门回复侧栏与图片上传入口。

## 开源许可证

V2EX Kit 基于 [MIT License](LICENSE) 发布。
