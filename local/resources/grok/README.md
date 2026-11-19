# Embedded desktop renderer

The public renderer assets are from the locally installed **Grok Bot 1.1.0** release (`resources/app.asar`, `dist/renderer`). No account data, credentials, bootstrap identifiers or conversations are included.

The 696 imported assets are unmodified release bytes, pinned by `tests/grok-renderer-1.1.0.sha256`. The local entry HTML supplies the 牵牛星 welcome screen; `grok_bridge.js` starts the original chat renderer only after local Vega device authorization is available. Do not patch minified chunks or add CSS overrides to imitate another release: replace the complete renderer and update the integrity fixture together.

`grok_bridge.js` adapts the renderer's desktop/coordinator protocol to the local Vega API and WebView2 host. Display gates match the reference release; theme, language and bot tint are local preferences, not a copy of the original application's profile. WebView2 window controls are drawn by the bridge because Electron's Windows titlebar-overlay API is not available. Windows DPI/font rasterization can still differ between the two runtimes.

The Vega bridge uses the device-paired API for private chats, group chats, recent text history, sending and shared read marks. It uses the renderer's sidebar sections to keep groups below Bots and disables its built-in speech UI. It polls for persisted replies and uses the server's message IDs to replace provisional bubbles without resending. On restart, unconfirmed local sends move to a collapsed recovery list rather than reappearing in the conversation. The upgraded backend can check a receipt by ID even outside the recent history. No Grok service, account data or Vega credential is accessible to the release bundles. The loopback host restricts network requests to the local client.

Bot and group management, task confirmations and output downloads are available in the Vega web app. Grok accounts, connectors, calling, recording and attachments are not provided by this adapter.
