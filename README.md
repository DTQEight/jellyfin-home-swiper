# Jellyfin Home Swiper

给 **Jellyfin Web 12.x（React + MUI 全新前端）** 首页加一个全屏轮播横幅。

[upstream]: https://github.com/sohag1192/Emby-Home-Swiper-UI

## 效果

- 首页顶部全屏背景轮播，展示最近添加的 10 部电影 / 剧集
- 有 Logo 的条目直接显示透明 Logo，没有则回退为标题
- 年份 · 分级 · 评分 · 时长、三行简介、`播放` / `详情` 按钮
- 8 秒自动切换，鼠标悬停暂停
- 左右箭头（悬停显现）+ 圆点指示器（可点击跳转）
- 手机端自适应（高度、字号、简介隐藏）

## 兼容性

| Jellyfin Web | 状态 |
| --- | --- |
| **12.4** | ✅ 本仓库实测通过 |
| 12.0 – 12.3 | ⚠️ 未实测，理论上通用（同代 React 前端） |
| 10.8 – 11.x | ❌ 不适用，请用上游 [Emby-Home-Swiper-UI][upstream] 的 `Jellyfin/` 版本 |

## 与上游的区别

上游脚本依赖 10.x 时代的 jQuery + Web Components 前端（`.mainAnimatedPages`、`.section0` 等选择器），
在 12.x 的 React 前端里会**静默失效**：不报错，但横幅不会出现。

本版本是针对 12.x 重写的**零依赖原生 JS**：

- 不需要 jQuery、md5
- 取数走 `window.ApiClient.getItems()`，REST 仅作兜底
- 插入点改用 12.4 仍然保留的 `.homeSectionsContainer`（React 端渲染类名未变）
- 不再用 `clientWidth` 等尺寸启发式判断宿主（首页滚动由 `document.body` 承担，`#reactRoot` 自身尺寸为 0，尺寸判定会误判）

## 安装

### 0. 前提

Jellyfin 容器里的 `/jellyfin/jellyfin-web` 需要能被改写。两种做法：

**A. 挂载（推荐，升级容器不丢）**

```yaml
services:
  jellyfin:
    volumes:
      - ./web:/jellyfin/jellyfin-web
```

先把容器内的 web 目录复制到宿主机：

```bash
docker cp jellyfin:/jellyfin/jellyfin-web ./web
sudo chown -R $(id -u):$(id -g) ./web
docker compose up -d
```

**B. 直接改容器内文件**（`docker cp` 进容器，重建容器后失效）

### 1. 复制脚本

```bash
mkdir -p <web目录>/jellyfin-crx
cp jellyfin-crx/main.js <web目录>/jellyfin-crx/
```

### 2. 注入引用

编辑 `<web目录>/index.html`，在 `</head>` 前加一行：

```html
<script src="jellyfin-crx/main.js?v=1"></script>
```

> `v=1` 是缓存串，改脚本后记得改数字，否则浏览器会用旧缓存。

### 3. 强刷

浏览器打开 Jellyfin，按 `Ctrl + Shift + R`（Mac 为 `Cmd + Shift + R`）。

无需重启 Jellyfin 容器：`index.html` 与脚本都是静态文件，改完即生效。
如果用了 Service Worker 或反向代理缓存，可能需要清一次缓存。

## 配置

没有配置文件，直接改 `main.js` 里的常量：

| 位置 | 默认值 | 说明 |
| --- | --- | --- |
| `Limit` | `10` | 轮播条目数量 |
| `setInterval(..., 8000)` | `8000` | 自动切换间隔（毫秒） |
| `maxWidth=1920` | `1920` | 背景图请求宽度，越大越清晰也越吃带宽 |
| `IncludeItemTypes` | `Movie,Series` | 参与轮播的媒体类型 |

## 排错

脚本会在页面里留一个隐藏节点 `#jf-swiper-debug`，控制台执行：

```js
document.getElementById('jf-swiper-debug').textContent
```

正常输出类似：

```
placed items=10 slides=10 parent=div.tabContent(4978/4978) | host=sections @18:31:53
```

| 输出 | 含义 |
| --- | --- |
| `no ApiClient` / `waiting ApiClient` | 还没登录，或脚本比前端先加载，等待中 |
| `REST error: HTTP 401` | 取 token 失败，检查是否已登录 |
| `fetched total=0` | 库里没有带背景图的条目（`BackdropImageTags` 为空） |
| `no host` | 首页结构没渲染出来，确认当前在 `#/home` 且 Jellyfin 版本是 12.x |
| `host=sections` + `slides=10` | 正常 |

## 原理

1. 轮询等待 `window.ApiClient` 可用（登录后才有），拿当前用户 ID。
2. `getItems(userId, { Recursive, IncludeItemTypes, SortBy: DateCreated, Limit: 10, EnableImageTypes: 'Backdrop,Logo' })` 取最近添加的条目，过滤掉没有背景图的。
3. 拼图片地址：`/Items/{id}/Images/Backdrop?tag=...&maxWidth=1920`、`/Items/{id}/Images/Logo?tag=...`。
4. 构建 DOM，插到 `.homeSectionsContainer` **前面**（父容器是 `div.tabContent`），这样横幅在全屏宽度下自适应，且不会打乱 React 的子节点顺序。
5. 每 1.5 秒检查一次：横幅是否还在、位置是否正确，被 React 重渲染清掉就重新插回去。
6. 切换 `#/` 以外的路由时隐藏，回到首页再显示。

## 卸载

删除 `index.html` 里那一行 `<script src="jellyfin-crx/main.js...">`，再删掉 `jellyfin-crx` 目录即可。

## 致谢

思路与视觉参考 [sohag1192/Emby-Home-Swiper-UI][upstream]（Emby / Jellyfin 10.x 版本）。
本仓库仅包含针对 Jellyfin 12.x React 前端重写的脚本。
