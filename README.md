# 通义万相视频换人本地测试台

本仓库提供一个单页 HTML 工具，用于在本地浏览器直接体验和调试阿里云百炼通义万相（模型 `wan2.2-animate-mix`）的视频换人 API。工具同时内置 Supabase 上传能力，便于在需要时将本地素材上传到线上存储并获取公开访问地址。

## 功能亮点

- ✅ 单页应用：所有 HTML、CSS、JavaScript 代码均在 `index.html` 中，下载后即可离线保存使用。
- ✅ 默认参数预填：已将百炼 Token、代理地址、Supabase URL/Key、存储桶等配置硬编码到页面，开箱即用。
- ✅ 双重预检：页面加载后自动检测百炼代理与 Supabase 连通性，也支持手动复检。
- ✅ 文件上传：本地素材可直接上传至 Supabase 指定存储桶，并自动生成公开链接。
- ✅ 全链路调试日志：完整记录所有外部接口的请求、响应、警告和错误，方便快速定位问题。
- ✅ 异步轮询：自动根据用户配置的频率轮询任务状态，直至成功、失败或达到最大次数。
- ✅ 结果预览：任务成功后自动展示返回的视频资源链接，支持内嵌播放器预览。

## 使用指南

1. 打开 `index.html`，在浏览器中访问，页面会自动填充默认配置并立即检测 Supabase 与百炼代理可用性。
2. 若需更换凭证，可直接覆盖相应输入框；默认配置已内置文档中提供的 Token / Key / 代理地址。
3. 在“视频换人任务配置”区域，上传目标视频与参考人脸（或填写已有 URL），可选上传音频替换背景音乐。
4. 检查任务参数（模型版本、服务模式、轮询设置等），点击“发起视频换人任务”。
5. 页面将先上传素材（如需）、再调用百炼异步任务接口，并按设定频率轮询状态。
6. 任务成功后自动展示下载链接和内嵌播放器，同时记录完整请求与响应，方便追踪问题。

> **安全提示**：Token 和 Key 仅在浏览器内存中使用，不会发送到其他服务端。请妥善保管个人凭证，避免在不可信环境中运行。

## 调试与日志

- 页面底部的“调试日志”会记录所有关键步骤，包括请求地址、参数、响应内容和异常信息。
- 浏览器控制台（F12）同样会输出同步日志，便于进一步排查。

## CORS 研究与代理部署指南

### 跨域策略结论

- 根据阿里云 API 网关跨域说明（https://help.aliyun.com/zh/api-gateway/traditional-api-gateway/user-guide/cross-origin-resource-sharing），若服务端未返回 `Access-Control-Allow-Origin`、`Access-Control-Allow-Methods` 等响应头，浏览器会在预检阶段拦截请求。百炼公共域名（`dashscope-intl.aliyuncs.com` 等）未开放任意来源跨域，因此直接在浏览器调用必然报 `Failed to fetch`。
- 浏览器日志中若出现 `TypeError: Failed to fetch` 且网络层无请求记录，即可判定为 CORS 预检失败。页面脚本会识别该错误并提示“请改用代理”。
- 解决方案：在可控环境部署转发服务，由代理向百炼 API 发起请求，并在代理响应中补齐跨域相关响应头，再将结果返回给浏览器。

### 是否必须通过后端调用？

- 在浏览器端直接访问百炼公开域名会被 CORS 阻止，因此**前端场景必须通过后端或代理服务**转发请求。
- 若将调用逻辑放在可信后端（如 Cloudflare Worker、Vercel Edge Function、企业 API 网关等），即可绕过浏览器同源限制，并集中管理 Token、访问日志与重试策略。
- README 中提供的 `proxy-worker.js` 与 Node/Express 示例均已按官方文档要求补齐跨域响应头，可直接部署使用。

### 免费代理托管方案

1. **Cloudflare Workers**（永久免费额度）
   1. 在 Cloudflare 控制台选择 “Workers & Pages” → “Create application” → “Create Worker”。
   2. 将仓库根目录的 [`proxy-worker.js`](proxy-worker.js) 内容粘贴至在线编辑器。
   3. 如需自定义上游域名，可在 Settings → Variables 中新增 `DASH_SCOPE_BASE`，默认无需修改。
   4. 点击 “Deploy” 后，可获得 `https://<子域>.workers.dev/dashscope` 形式的代理地址。
   5. 页面代码默认写死 `https://dashscope-proxy-vrlzrypzoq.workers.dev`，请在 Worker 命名时与之保持一致，或在页面中替换为实际子域。

2. **Vercel Edge Functions**（每月免费额度）
   1. 在 Vercel 新建项目，目录结构中创建 `api/dashscope.ts`，写入：

      ```ts
      export const config = { runtime: 'edge' };

      export default async function handler(request: Request) {
        const url = new URL(request.url);
        const target = 'https://dashscope-intl.aliyuncs.com' + url.pathname.replace(/^\/api\/dashscope/, '') + url.search;
        const init: RequestInit = {
          method: request.method,
          headers: request.headers,
          body: request.body,
        };
        const resp = await fetch(target, init);
        const headers = new Headers(resp.headers);
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Access-Control-Allow-Headers', '*');
        headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        if (request.method === 'OPTIONS') {
          return new Response(null, { status: 204, headers });
        }
        return new Response(resp.body, { status: resp.status, headers });
      }
      ```

   2. 执行 `vercel deploy` 或使用 Web UI 部署，得到形如 `https://<项目>.vercel.app/api/dashscope` 的地址。
   3. 在页面中填写该地址后，再次点击“检测百炼服务可用性”确保代理可达。

3. **本地/自建网关**
   - 若项目需要内网访问，可在 Nginx、Express、函数计算或公司统一 API 网关中部署转发逻辑，核心是：
     - 请求路径按需重写并转发到 `https://dashscope-intl.aliyuncs.com`。
     - 响应头补充 `Access-Control-Allow-Origin`（可设置为 `*` 或指定页面域名）及常见自定义头部。
     - OPTIONS 预检请求直接返回 204 或 200，并带上相同的跨域响应头。

完成代理部署后，推荐在浏览器外使用 `curl -H "Authorization: Bearer <Token>" <代理地址>/api/v1/tasks?limit=1` 验证代理可用，再回到页面执行检测。README 底部“常见问题”章节继续保留 Node/Express 示例，方便快速落地。

## 自测与验证流程

为满足领域开发与测试驱动结合的要求，可按以下顺序完成回归验证：

1. **自动健康检查**：刷新页面，确认日志面板出现“自动检测”日志，状态卡片呈现成功或明确错误提示。
2. **Supabase 上传链路**：点击“检测 Supabase 凭证”，随后上传小体积图片文件，确认日志中记录 200/201 状态与公开 URL。
3. **百炼任务链路**：在代理可用的前提下，提交一次示例任务，确认响应包含 `task_id`，轮询日志持续输出直至成功或失败。
4. **异常采集**：断开网络或故意填错 Key，检查日志能否完整呈现错误详情，确保后续排障依据充分。
5. **文档同步**：若流程有调整，需同步更新 README、页面内展开说明及注释，保持资料一致性。

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

- v1.5.0（2024-09-15）
  - 内置默认凭证并在页面初始化时自动检测百炼与 Supabase 服务。
  - 新增 `proxy-worker.js` Cloudflare Worker 代理脚本，扩展免费托管部署步骤。
  - 文档补充自测流程与默认配置说明，确保资料与代码同步。
- v1.4.0（2024-09-14）
  - 新增 CORS 研究与代理部署指南，提供 Cloudflare Workers 与 Vercel Edge Functions 免费托管示例。
  - 页面内补充跨域/代理展开说明，检测到官方域名时立即给出禁止提示。
  - Supabase 行级安全排查步骤沉淀为展开卡片，指引权限策略调整。
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
