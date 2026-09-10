# 通过家庭局域网使用浏览器 MCP

[English](2026-09-10-browser-mcp-lan.md) | [简体中文](2026-09-10-browser-mcp-lan.zh-CN.md)

## 问题与范围

HomeCode 目前包含三个 MCP 连接。本次添加 Playwright 和 `--slim` 模式的
Chrome DevTools，让家庭 Wi-Fi 中的另一台 Mac 可以使用本机服务器上的浏览器。
加入简短的工具选择说明，并发布 HomeCode 2.1.10 Apple Silicon DMG。
保留无关的工作区修改和现有 MCP。

## 服务器设计

现有的已认证 HTTPS 网关提供 `/playwright/mcp` 和 `/chrome-devtools/mcp`。
每个 MCP 会话独立拥有一个隔离、无头的浏览器 MCP 子进程，通过 stdio 连接。
网关使用现有 bearer 凭据和 Caddy 证书，通过 Streamable HTTP 转发工具发现及
调用。不新增对外开放的浏览器或调试端口。

会话 ID 限定于对应路由。DELETE、空闲过期和网关关闭时均关闭相应子进程及
浏览器。沿用 30 分钟空闲期限和 32 个会话上限。将固定版本的浏览器 MCP
依赖打包到服务器部署目录，避免运行时依赖源代码磁盘。网关版本升级至 1.1.0。

Chrome slim 返回服务器本地截图路径。网关额外将该 PNG 作为 MCP 图片内容返回，
且只接受对应会话临时目录中的规范截图路径。临时路径保持足够短，以适配 Chrome
在 macOS 上使用的 Unix 套接字。

## 客户端与指令

桌面默认设置新增两个 HTTPS 声明，使用 `LOCAL_QWEN_API_KEY`。v4 安装标记为
现有 v1/v2/v3 配置仅补充缺失的新连接，保留自定义定义，并防止在用户之后删除
连接时重新添加。全新安装获得五个 MCP 和现有公共局域网 CA。

Qwen 桌面系统提示和 Codex Harness 指令简要规定：UI 交互和 E2E 流程使用
Playwright；快速导航、页面 JavaScript 和截图使用 Chrome DevTools slim。
说明仅适用于可用工具，并明确浏览器、文件路径和 localhost 均位于服务器。
客户端托管的开发站点需要可访问的局域网 URL。HomeChat 继续与计算机工具隔离。
不引入项目或浏览器配置同步。

## 涉及文件

服务器修改位于 `home-ai-platform/mcp/homecode-gateway`。客户端修改涉及桌面
默认设置及测试、现有 Qwen 和 Codex 提示位置及测试、桌面文档、运行时冒烟
测试清单，以及全部 HomeCode 版本元数据。底层 Qwen 和第三方组件保留各自的
版本编号。

## 验证与验收

实现前运行全局 CLI 清单，确认新增路由尚不存在。测试全新安装、升级、自定义
定义、删除和重复启动。验证两个 Harness 引擎的提示覆盖，并保持 HomeChat
隔离。执行网关生命周期和认证测试，包括跨路由会话拒绝和独立浏览器会话。

部署后使用实际 HTTPS 主机名、CA 验证和现有凭据发现工具，并通过两个浏览器
操作本地测试页面。确认 Chrome DevTools 仅提供 slim 工具集。执行构建、类型
检查、打包和针对性测试，审查本任务差异，再构建 DMG。验证完整应用签名、
磁盘镜像完整性、包内启动、全新配置清单和无凭据泄漏。服务器端局域网路由测试
不代表已在第二台实体 Mac 上运行。

## 未决问题

无。DMG 沿用现有临时签名流程；Apple 公证不属于本次本地分发任务范围。
