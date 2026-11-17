import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import https from "node:https";
import dns from "node:dns/promises";
import { syncBuiltinESMExports } from "node:module";
import { Readable, Writable } from "node:stream";
import { postTrigger } from "../server/core/triggers";

test("webhook transport pins DNS, sends JSON once, rejects redirects and reports WeCom errors", async () => {
  const originalHttp = http.request, originalHttps = https.request, originalLookup = dns.lookup;
  let addresses = [{ address: "8.8.8.8", family: 4 }], status = 200, response = "{}";
  const calls: { url: string; method: string; headers: any; body: string; pinned: any }[] = [];
  try {
    dns.lookup = (async () => addresses) as any;
    const mockRequest = ((url: URL, options: any, callback: any) => {
      let pinned: any;
      options.lookup(url.hostname, { all: true }, (error: Error | null, result: any) => { assert.equal(error, null); pinned = result; });
      const call = { url: url.href, method: options.method, headers: options.headers, body: "", pinned };
      calls.push(call);
      const outgoing = new Writable({ write(chunk, _encoding, done) { call.body += chunk.toString(); done(); } });
      outgoing.on("finish", () => {
        const incoming = Readable.from([Buffer.from(response)]) as any;
        incoming.statusCode = status;
        callback(incoming);
      });
      return outgoing;
    }) as any;
    http.request = mockRequest;
    https.request = mockRequest;
    syncBuiltinESMExports();

    await postTrigger("https://api.example.com/hook?key=private", { Authorization: "Bearer abc" }, '{"text":"hello"}');
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { url: "https://api.example.com/hook?key=private", method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer abc" }, body: '{"text":"hello"}', pinned: [{ address: "8.8.8.8", family: 4 }] });
    status = 302;
    await assert.rejects(postTrigger("http://api.example.com/hook", {}, "{}"), /HTTP 302/);
    assert.equal(calls.length, 2, "a redirect must not be followed");
    status = 200; response = '{"errcode":40014,"errmsg":"private detail"}';
    await assert.rejects(postTrigger("https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=secret", {}, "{}"), (error: Error) => {
      assert.equal(error.message, "企业微信机器人返回错误码 40014");
      return true;
    });
    assert.equal(calls.length, 3);
    addresses = [{ address: "8.8.8.8", family: 4 }, { address: "127.0.0.1", family: 4 }];
    await assert.rejects(postTrigger("https://api.example.com/hook", {}, "{}"), /内网|本机/);
    assert.equal(calls.length, 3, "mixed DNS answers must be rejected before connecting");
  } finally {
    http.request = originalHttp;
    https.request = originalHttps;
    dns.lookup = originalLookup;
    syncBuiltinESMExports();
  }
});
