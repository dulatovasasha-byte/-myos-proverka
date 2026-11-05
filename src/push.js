// Web Push: подпись VAPID (RFC 8292) и шифрование содержимого aes128gcm (RFC 8291).
// Содержимое — в формате Declarative Web Push (iPadOS 18.4+), чтобы уведомление
// показывалось системой без JavaScript и само открывало нужный раздел.

const enc = new TextEncoder();

export const b64url = (buf) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const fromB64url = (s) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

const concat = (...parts) => {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

async function hkdf(salt, ikm, info, bits) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bits));
}

// Шифрует payload (строку) для подписки по RFC 8291.
export async function encryptPayload(subscription, payloadText) {
  const uaPublic = fromB64url(subscription.keys.p256dh);
  const authSecret = fromB64url(subscription.keys.auth);

  const asPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", asPair.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asPair.privateKey, 256));

  const keyInfo = concat(enc.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, shared, keyInfo, 256);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 128);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 96);

  const plaintext = concat(enc.encode(payloadText), new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, plaintext));

  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ciphertext);
}

export async function getVapid(env) {
  const stored = await env.KV.get("vapid", "json");
  if (stored) return stored;
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const vapid = {
    privateJwk: await crypto.subtle.exportKey("jwk", pair.privateKey),
    publicKey: b64url(await crypto.subtle.exportKey("raw", pair.publicKey)),
  };
  await env.KV.put("vapid", JSON.stringify(vapid));
  return vapid;
}

export async function vapidHeader(env, endpoint, subject) {
  const vapid = await getVapid(env);
  const key = await crypto.subtle.importKey("jwk", vapid.privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url(
    enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }))
  );
  const unsigned = `${header}.${claims}`;
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(unsigned));
  return `vapid t=${unsigned}.${b64url(sig)}, k=${vapid.publicKey}`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Отправка с повторами: 429 и 5xx — до 3 попыток; 404/410 — подписка устарела.
export async function deliver(env, subscription, message, origin) {
  const payload = JSON.stringify({
    web_push: 8030,
    notification: {
      title: "MY OS",
      body: message.body,
      lang: "ru",
      dir: "ltr",
      navigate: origin + (message.path || "/"),
      silent: false,
    },
  });
  const body = await encryptPayload(subscription, payload);
  const attempts = [];
  for (let i = 0; i < 3; i++) {
    let status = 0;
    try {
      const res = await fetch(subscription.endpoint, {
        method: "POST",
        headers: {
          TTL: "86400",
          Urgency: "normal",
          "Content-Encoding": "aes128gcm",
          "Content-Type": "application/octet-stream",
          Authorization: await vapidHeader(env, subscription.endpoint, origin),
        },
        body,
      });
      status = res.status;
    } catch (e) {
      status = -1;
    }
    attempts.push(status);
    if (status >= 200 && status < 300) return { ok: true, attempts };
    if (status === 404 || status === 410) return { ok: false, expired: true, attempts };
    if (!(status === 429 || status >= 500 || status === -1)) return { ok: false, attempts };
    await sleep(i === 0 ? 1000 : 3000);
  }
  return { ok: false, attempts };
}
