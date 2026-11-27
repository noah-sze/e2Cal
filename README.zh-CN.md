# e2Cal.

[English](README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md)

> 极简、本地优先的个人饮食、力量训练与体态追踪 PWA 应用——采用纯黑白高对比工程师美学、零官方后端与完整数据主权。

[![Website](https://img.shields.io/badge/website-e2cal.pages.dev-black?style=flat-square&labelColor=white)](https://e2cal.pages.dev/)
![Version](https://img.shields.io/badge/version-1.0.0-black?style=flat-square&labelColor=white)
![Platform](https://img.shields.io/badge/platform-PWA%20%7C%20Web-black?style=flat-square&labelColor=white)
![License](https://img.shields.io/badge/license-AGPL--3.0-black?style=flat-square&labelColor=white)

## 核心特性

- **纯粹单色工程美学**：严格遵循纯黑白高对比设计、扁平细边框界定层级、零阴影干扰，全站内置本地自托管 Geist、Inter 与 JetBrains Mono 字体搭配 `tabular-nums` 等宽防抖排版。
- **本地优先与离线完备**：所有饮食、训练与体态记录通过 IndexedDB（Dexie.js）直接存储于本机设备，无官方服务器与强制账号系统，安装 PWA 后 100% 离线可用。
- **精密饮食与营养追踪**：强制锚定每 `100 g` 纯可食部基准，支持净重／毛重折算、复合食谱、外食情境估算，并内置六大权威食材数据库（USDA、CFCT、TFDA、MEXT、AFCD、CoFID 共 18,635 条离线检索）。
- **力量训练与肌群恢复**：采用 Brzycki 公式计算预估 1RM（`e1RM`）与总训练容量，结合男女双版前后视角 17 肌群解剖热力图与 48h／72h 生理恢复窗口模型。
- **体态指标与热力学推算**：以 EWMA 指数加权移动平均（`α = 0.15`）平滑每日体重波动，实时推算每日热力学能量差额、BMI、FFMI、去脂体重（LBM）、脂肪总重、倒三角比与腰臀比。
- **开放数据导出（BYO-AI）**：一键将当日或全量数据导出为 Markdown／纯文本、无损 JSON 或高分辨率单色 PNG 数据快照卡，交由外部 AI 或教练分析。
- **Dropbox 同步与 ZIP 备份**：浏览器直连用户自有 Dropbox 进行 OAuth PKCE 增量双向同步（LWW 合并），并支持开放可读的完整 ZIP 备份与还原。
- **多语系与多单位切换**：完整支持繁体中文（`zh-TW`）、简体中文（`zh-CN`）与英文（`en`），底层严格采用公制 SI 存储，视图层无损换算 `kg/lbs`、`g/oz`、`ml/fl oz`、`cm/in`、`kcal/kJ`。

## 技术栈

- **核心框架**：React 19 / TypeScript / Vite
- **界面与样式**：Tailwind CSS v4 / Base UI / Radix UI / Lucide Icons
- **状态管理**：Zustand
- **本地数据库**：IndexedDB（Dexie.js）
- **同步与备份**：Dropbox API（OAuth PKCE）/ JSZip
- **PWA 离线**：vite-plugin-pwa（Workbox Service Worker 与离线预缓存）
- **多语系**：react-i18next
- **测试与检查**：Vitest / Oxlint

## 安装与使用

### 在线直接体验

直接在浏览器打开或安装为 PWA 应用：
👉 **[https://e2cal.pages.dev](https://e2cal.pages.dev/)**

### 环境要求

请确认系统已安装 Node.js（>= 20.0.0）与 npm。

### 本地开发

```bash
git clone https://github.com/noah-sze/e2Cal.git
cd e2Cal
npm install
npm run dev
```

### 检查与构建

```bash
npm run check:all
```

或仅构建生产版本：

```bash
npm run build
```

### PWA 与自建部署

将构建生成的 `dist/` 目录部署至任何支持 HTTPS 的静态托管平台（如 Cloudflare Pages、Vercel、Netlify 或 GitHub Pages），亦可使用项目内附的 `Dockerfile` 与 `deploy/` Nginx / Caddy 配置一键自建。

## 项目架构

e2Cal 采用职责分离的分层架构，明确区分界面呈现、状态管理、领域服务与本地持久化：

- `src/components/`：原子 UI 基础组件、精密弹窗、解剖热力图与领域复合组件。
- `src/pages/`：主要页面视图（总览、饮食、训练、体态、设置与产品导览页）。
- `src/hooks/`：响应式 Dexie 数据库查询与业务操作封装 Hooks。
- `src/services/`：IndexedDB Schema 与迁移脚本、Dropbox 增量同步引擎、ZIP 备份还原、权威食材检索与多格式 AI 导出。
- `src/store/`：由 Zustand 驱动的轻量全局客户端状态。
- `src/utils/`：无副作用、具高单元测试覆盖率的纯数学计算函数、单位换算与多语系检索工具。
- `src/i18n/`：多语系配置与字典文件（`en`、`zh-TW`、`zh-CN`）。

## 开源协议

本项目采用 GNU Affero General Public License v3（AGPLv3）协议开源。详见 [LICENSE](LICENSE) 文件。
