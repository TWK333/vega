import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { compileStyle } from "vue/compiler-sfc";
import { avatarBubble, BOT_AVATAR_COLORS } from "../shared/employee-avatars";

test("quotes sit on one line above the bubble, and chat drafts grow to a scrollable cap", { skip: process.env.VEGA_TEST_CHROME !== "1", timeout: 30000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "vega-chat-quote-"));
  try {
    const [component, global] = await Promise.all([readFile("web/src/ChatMessage.vue", "utf8"), readFile("web/src/style.css", "utf8")]);
    assert.match(component, /class="chat-quote"[^\n]+<\/button>\r?\n\s*<div class="chat-bubble"/);
    const source = component.match(/<style scoped>([\s\S]*?)<\/style>/)![1];
    const style = compileStyle({ source, filename: "ChatMessage.vue", id: "data-v-quote", scoped: true });
    assert.deepEqual(style.errors, []);
    const colors = BOT_AVATAR_COLORS.map(({ id }) => avatarBubble(`bot:round:${id}`).fill);
    const file = join(dir, "quote.html");
    await writeFile(file, `<!doctype html><meta charset="utf-8"><style>${global}\n${style.code}</style>
      <div id="fixture" style="background:var(--surface)"></div><pre id="result"></pre><script>
        const fixture = document.querySelector('#fixture'), results = [];
        const colors = ${JSON.stringify(colors)};
        const quoteText = '需要核对发布环境与灰度配置，确认后再继续。'.repeat(20) + 'https://example.test/' + 'long-url-'.repeat(40);
        const answer = '后端合并到 dev 分支里，我写错了';
        const longAnswer = '请根据这次发布清单核对灰度范围与回滚方案，确认每个步骤都已经完成。'.repeat(8);
        const rgb = (base, overlay) => {
          const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
          const ctx = canvas.getContext('2d'); ctx.fillStyle = base; ctx.fillRect(0, 0, 1, 1);
          ctx.fillStyle = overlay; ctx.fillRect(0, 0, 1, 1);
          return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
        };
        const luminance = rgb => rgb.map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((n, v, i) => n + v * [.2126, .7152, .0722][i], 0);
        for (const width of [140, 320, 390, 800]) for (const kind of ['tiny', 'short', 'long', 'assistant', 'tinyquote']) {
          fixture.style.width = width + 'px';
          const mine = kind !== 'assistant';
          fixture.innerHTML = '<article data-v-quote class="chat-message ' + (mine ? 'user' : 'assistant') + '">' +
            (mine ? '' : '<span data-v-quote class="chat-avatar"></span>') +
            '<div data-v-quote class="chat-content">' +
            '<button data-v-quote type="button" class="chat-quote"><strong data-v-quote>情报开发</strong><span data-v-quote></span></button>' +
            '<div data-v-quote class="chat-bubble' + (mine ? ' tinted' : '') + '"><div data-v-quote class="message-text"></div></div></div></article>';
          const bubble = fixture.querySelector('.chat-bubble'), quote = fixture.querySelector('.chat-quote'), span = quote.querySelector('span');
          span.textContent = kind === 'tinyquote' ? '已完成' : quoteText;
          fixture.querySelector('.message-text').textContent = kind === 'tiny' || kind === 'tinyquote' ? '好' : kind === 'long' ? longAnswer : answer;
          if (mine) { bubble.style.background = colors[0]; bubble.style.color = '#fff'; }
          const box = bubble.getBoundingClientRect(), preview = quote.getBoundingClientRect(), text = span.getBoundingClientRect(), row = fixture.getBoundingClientRect();
          quote.remove();
          const plain = bubble.getBoundingClientRect();
          results.push({ width, kind, textHeight: text.height,
            above: preview.bottom <= box.top,
            aligned: Math.abs((mine ? preview.right : preview.left) - (mine ? box.right : box.left)) < 1,
            sameBubble: Math.abs(plain.width - box.width) < 1 && Math.abs(plain.height - box.height) < 1,
            contained: preview.left >= row.left - 1 && preview.right <= row.right + 1 && text.left >= preview.left && text.right <= preview.right });
        }
        fixture.style.width = '320px';
        fixture.innerHTML = '<div class="composer"><textarea class="chat-draft" rows="1"></textarea></div>';
        const draft = fixture.querySelector('textarea');
        const empty = draft.getBoundingClientRect().height;
        draft.value = '一段需要换行的消息，'.repeat(5);
        const wrapped = draft.getBoundingClientRect().height;
        draft.value = '输入很多行。\\n'.repeat(80);
        const long = draft.getBoundingClientRect().height, scrollable = draft.scrollHeight > draft.clientHeight;
        draft.value = '';
        results.push({ empty, wrapped, long, scrollable, reset: draft.getBoundingClientRect().height, cap: Math.min(200, innerHeight * .3) });
        for (const color of colors) {
          fixture.innerHTML = '<article data-v-quote class="chat-message user"><div data-v-quote class="chat-content"><button data-v-quote class="chat-quote"><strong data-v-quote>引用</strong><span data-v-quote>引用内容</span></button><div data-v-quote class="chat-bubble tinted"><div class="message-text">回复</div></div></div></article>';
          const bubble = fixture.querySelector('.chat-bubble'), quote = fixture.querySelector('.chat-quote');
          bubble.style.background = color; bubble.style.color = '#fff';
          const bg = getComputedStyle(fixture).backgroundColor, style = getComputedStyle(quote);
          const quoteBg = rgb(bg, style.backgroundColor), ink = rgb('rgb(' + quoteBg.join(',') + ')', style.color);
          const a = luminance(ink), b = luminance(quoteBg);
          results.push({ color, contrast: (Math.max(a,b) + .05) / (Math.min(a,b) + .05) });
        }
        document.querySelector('#result').textContent = JSON.stringify(results);
      </script>`);
    const output = execFileSync(process.env.VEGA_CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--no-first-run", "--no-default-browser-check", "--no-sandbox", "--disable-gpu", "--user-data-dir=" + join(dir, "profile"), "--dump-dom", pathToFileURL(file).href], { encoding: "utf8", timeout: 20000, windowsHide: true });
    const results = JSON.parse(output.match(/<pre id="result">([\s\S]*?)<\/pre>/)![1]);
    for (const row of results.filter((item: any) => item.width)) {
      assert(row.contained && row.above && row.aligned && row.sameBubble, JSON.stringify(row));
      assert(row.textHeight <= 19, "preview must stay on one line: " + JSON.stringify(row));
    }
    const draft = results.find((item: any) => item.scrollable);
    assert(draft && draft.wrapped > draft.empty && draft.long > draft.wrapped && draft.long <= draft.cap + 1 && draft.reset === draft.empty, JSON.stringify(results));
    for (const row of results.filter((item: any) => item.color)) assert(row.contrast >= 4.5, "quoted text needs readable contrast: " + JSON.stringify(row));
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
