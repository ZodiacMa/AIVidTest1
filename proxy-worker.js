export default {
  /**
   * Cloudflare Worker 代理：转发浏览器请求到阿里云百炼 DashScope 国际站
   * - 支持 OPTIONS 预检，补充 CORS 响应头
   * - 默认使用国际站域名，可通过环境变量 DASH_SCOPE_BASE 自定义
   */
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
      'Access-Control-Allow-Credentials': 'false',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const incomingUrl = new URL(request.url);
    const upstreamBase = env.DASH_SCOPE_BASE || 'https://dashscope-intl.aliyuncs.com';
    const upstreamUrl = new URL(incomingUrl.pathname.replace(/^\/dashscope/, ''), upstreamBase);
    upstreamUrl.search = incomingUrl.search;

    const init = {
      method: request.method,
      headers: new Headers(request.headers),
      body: ['GET', 'HEAD'].includes(request.method.toUpperCase()) ? undefined : request.body,
    };

    const response = await fetch(upstreamUrl.toString(), init);
    const proxyHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => proxyHeaders.set(key, value));

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: proxyHeaders,
    });
  },
};
