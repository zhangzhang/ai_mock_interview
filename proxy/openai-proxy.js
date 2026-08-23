// openai-proxy.js — a minimal Cloudflare Worker that lets the static Onsite page
// call the OpenAI API from the browser.
//
// WHY THIS EXISTS
// OpenAI's API sends no `Access-Control-Allow-Origin` header, so a browser blocks any
// direct fetch to api.openai.com (CORS). This worker sits in between: the page calls
// YOUR worker, the worker forwards the request to OpenAI (passing your `Authorization`
// header through untouched) and adds the CORS header so the browser accepts the reply.
//
// It does NOT store, log, or inspect your API key — it only relays the request.
//
// DEPLOY (free, dashboard)
//   1. Cloudflare account → Workers & Pages → Create → Worker.
//   2. Replace the worker code with this file → Deploy.
//   3. (Recommended) set ALLOWED_ORIGINS below to your page's origin(s) and redeploy.
//   4. Copy the worker URL (https://<name>.<you>.workers.dev) into the app's
//      "Proxy URL" field in Settings.
//
// DEPLOY (Wrangler CLI)
//   npx wrangler deploy        # from this proxy/ folder (uses wrangler.toml)

const OPENAI = "https://api.openai.com";

// Lock the proxy to the page(s) allowed to use it. "*" allows any origin (simplest,
// but anyone who learns the URL can relay through it — they still need their own key).
// Prefer listing your real origins, e.g.:
//   ["https://zhangzhang.github.io", "http://localhost:8731"]
const ALLOWED_ORIGINS = ["*"];

function corsOrigin(origin){
  if(ALLOWED_ORIGINS.includes("*")) return "*";
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}
function corsHeaders(origin){
  return {
    "Access-Control-Allow-Origin": corsOrigin(origin),
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

export default {
  async fetch(request){
    const origin = request.headers.get("Origin") || "";

    // CORS preflight.
    if(request.method === "OPTIONS"){
      return new Response(null, { status:204, headers:corsHeaders(origin) });
    }

    const url = new URL(request.url);
    // Only relay OpenAI API paths; ignore everything else.
    if(!url.pathname.startsWith("/v1/")){
      return new Response("Onsite OpenAI proxy — POST to /v1/*.", {
        status: url.pathname === "/" ? 200 : 404, headers: corsHeaders(origin)
      });
    }

    // Clone the incoming request onto the OpenAI URL: preserves method, headers
    // (including Authorization) and body (JSON or multipart audio) as-is.
    const upstream = new Request(OPENAI + url.pathname + url.search, request);

    let resp;
    try{
      resp = await fetch(upstream);
    }catch(e){
      return new Response(JSON.stringify({error:{message:"Proxy upstream error: "+e}}), {
        status:502, headers:{ "Content-Type":"application/json", ...corsHeaders(origin) }
      });
    }

    // Relay OpenAI's response, adding the CORS header the browser requires.
    const headers = new Headers(resp.headers);
    const ch = corsHeaders(origin);
    for(const k in ch) headers.set(k, ch[k]);
    return new Response(resp.body, { status:resp.status, statusText:resp.statusText, headers });
  }
};
