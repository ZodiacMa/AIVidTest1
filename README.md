# 通义万相视频换人本地测试台

本仓库提供一个单页 HTML 工具，用于在本地浏览器直接体验和调试阿里云百炼通义万相（模型 `wan2.2-animate-mix`）的视频换人 API。工具同时内置 Supabase 上传能力，便于在需要时将本地素材上传到线上存储并获取公开访问地址。

## 功能亮点

- ✅ 单页应用：所有 HTML、CSS、JavaScript 代码均在 `index.html` 中，下载后即可离线保存使用。
- ✅ 双重预检：支持对百炼 Token / 代理连通性以及 Supabase 凭证进行接口检测。
- ✅ 文件上传：本地素材可直接上传至 Supabase 指定存储桶，并自动生成公开链接。
- ✅ 全链路调试日志：完整记录所有外部接口的请求、响应、警告和错误，方便快速定位问题。
- ✅ 异步轮询：自动根据用户配置的频率轮询任务状态，直至成功、失败或达到最大次数。
- ✅ 结果预览：任务成功后自动展示返回的视频资源链接，支持内嵌播放器预览。

## 使用指南

1. 打开 `index.html`，在浏览器中访问。
2. 在“服务配置”区域依次填写百炼 API Token（建议使用新加坡区域 Token）和**百炼代理地址**，点击“检测百炼服务可用性”。
3. 如需上传本地素材，在“Supabase”区域填写 URL、API Key、存储桶名称和可选目录，可先点击“检测 Supabase 凭证”。
4. 在“视频换人任务配置”区域填写目标视频、参考人脸及可选音频的地址，或直接上传本地文件。
5. 设置任务描述、轮询间隔与最大轮询次数，点击“发起视频换人任务”。
6. 等待任务状态更新，成功后在“结果预览”区域查看生成视频。

> **安全提示**：Token 和 Key 仅在浏览器内存中使用，不会发送到其他服务端。请妥善保管个人凭证，避免在不可信环境中运行。

## 调试与日志

- 页面底部的“调试日志”会记录所有关键步骤，包括请求地址、参数、响应内容和异常信息。
- 浏览器控制台（F12）同样会输出同步日志，便于进一步排查。

## 常见问题与排查记录

### 百炼 API 返回 403 或浏览器报跨域

- 直接在浏览器中访问 `https://dashscope-intl.aliyuncs.com/api/v1/tasks` 会遇到两类问题：
  1. **浏览器跨域拦截（CORS）**：接口未配置允许任意来源访问，因此浏览器会直接报 `TypeError: Failed to fetch`。页面现在会捕获该错误并提示“请通过本地/服务端代理转发请求”。建议在本地搭建反向代理（如使用 Node/Express、Nginx 或阿里云函数计算）后再调用百炼 API。
  2. **服务端返回 403 Forbidden**：即便请求成功送达，也可能因 Token 权限不足或模型未开通而收到 403。日志中会完整记录响应体，便于核对账号是否已开通 `wan2.2-animate-mix` 及 `wan-std/wan-pro` 服务模式。
- 建议排查顺序：先通过命令行（如 `curl`）在同一网络环境验证 Token 是否可用，再确认浏览器调用是否被跨域策略阻止。如需长期使用，推荐将百炼调用收敛到可信后端服务。

#### 本地代理示例（Node.js Express）

1. 新建 `proxy.js`，写入以下内容（Node.js >= 16）：

   ```js
   const express = require('express');
   const { createProxyMiddleware } = require('http-proxy-middleware');

   const app = express();

   app.use(
     '/dashscope',
     createProxyMiddleware({
       target: 'https://dashscope-intl.aliyuncs.com',
       changeOrigin: true,
       pathRewrite: { '^/dashscope': '' },
       logLevel: 'debug',
     })
   );

   app.listen(8787, () => {
     console.log('DashScope proxy listening on http://localhost:8787/dashscope');
   });
   ```

2. 安装依赖并启动：

   ```bash
   npm install express http-proxy-middleware
   node proxy.js
   ```

3. 在页面的“百炼代理地址”中填写 `http://localhost:8787/dashscope`，其余逻辑保持不变。

   > 也可以使用 Nginx、云函数或 API 网关等方式进行代理，只需确保浏览器能够访问到该代理域名即可。

### Supabase 健康检查 URL 异常

- 反馈中的 URL 形如 `https://vrlzrypzoqreadqhttps//...`，原因是手动字符串拼接导致协议重复。
- 页面新增 `normalizeBaseUrl` 方法，统一使用 `URL` 对象拼装接口地址，避免重复协议或多余斜杠。
- 健康检查现在兼容 404（因未指定数据表），并增加 URL 格式校验提示，防止误填导致的 `ERR_NAME_NOT_RESOLVED`。

### Supabase 上传返回 `row-level security` 报错

- Supabase 对 Storage/数据库默认开启行级安全（Row Level Security）。当使用 `anon` 公钥上传文件时，如果未显式放行 `INSERT/SELECT`，接口会返回 `{"error":"Unauthorized","message":"new row violates row-level security policy"}`。
- 页面在上传及健康检查阶段都会识别该报错，并给出“请在 Storage -> Policies 中放权或改用 Service Role Key”的中文提示。
- 处理建议：登录 Supabase 控制台，进入目标存储桶，打开 `Policies`，为 `anon` 角色添加允许 `INSERT` / `SELECT` 的策略；若不方便修改策略，可在本地开发阶段改用 `service_role` Key，并确保在前端使用时妥善保护。

## 已知限制

- 具体的通义万相 API 字段可能会随官方文档更新，如返回值结构发生变化，请根据日志内容及时调整代码。
- 若跨域策略发生变化（如浏览器被阻止访问目标域名），可能需要通过本地代理进行转发。

## 版本记录

- v1.3.0（2024-09-13）
  - 新增百炼代理地址配置项，强制通过本地或服务端代理调用以绕过浏览器 CORS 限制。
  - 请求流程在代理校验失败时提供即时提示，并将代理地址记录到调试日志，方便排查。
  - 文档补充 Node.js 代理部署示例，方便快速搭建调试环境。
- v1.2.0（2024-09-12）
  - 新增百炼调用跨域（CORS）错误识别与提示，明确需要通过代理或后端调用。
  - Supabase 上传针对 `row-level security` 报错提供中文引导，辅助排查权限策略。
  - 健康检查在遇到授权失败时区分 RLS 与一般权限问题，便于精准定位。
- v1.1.0（2024-09-11）
  - 优化输入控件视觉可读性，修复浅色背景下文字不可见的问题。
  - 新增 Supabase URL 规整逻辑与错误提示，解决健康检查因 URL 拼接出错导致的 DNS 解析失败。
  - 强化百炼接口错误处理，对 403 Forbidden 给出具体排查建议。
- v1.0.0（2024-09-10）
  - 首次提交：完成单页测试台、Supabase 上传与任务轮询等核心功能。

## 许可证

本项目仅用于内部测试与集成验证，不建议直接用于生产环境。请在遵守相关服务条款的前提下使用。
