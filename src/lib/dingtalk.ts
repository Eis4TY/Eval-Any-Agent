import crypto from "node:crypto";

export function getAppUrl(path: string) {
  const baseUrl = process.env.APP_BASE_URL?.trim();
  if (!baseUrl) return null;

  try {
    const base = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
    if (base.protocol !== "http:" && base.protocol !== "https:") return null;
    return new URL(path.replace(/^\//, ""), base).toString();
  } catch {
    return null;
  }
}

export async function notifyDingTalkMarkdown(title: string, text: string) {
  const webhook = process.env.DINGTALK_WEBHOOK;
  if (!webhook) return;
  const secret = process.env.DINGTALK_SECRET;
  const url = new URL(webhook);
  if (secret) {
    const timestamp = Date.now().toString();
    const stringToSign = `${timestamp}\n${secret}`;
    url.searchParams.set("timestamp", timestamp);
    url.searchParams.set("sign", crypto.createHmac("sha256", secret).update(stringToSign).digest("base64"));
  }
  await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ msgtype: "markdown", markdown: { title, text } }) });
}
