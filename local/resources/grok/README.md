# Embedded desktop renderer

The public renderer assets are from the locally installed **Grok Bot 1.1.0** release (`resources/app.asar`, `dist/renderer`). No account data, credentials, bootstrap identifiers or conversations are included.

All 696 files except the entry HTML are unmodified release bytes. `tests/grok-renderer-1.1.0.sha256` pins their hashes; the HTML differs only by the `grok_bridge.js` script loaded before the original entry point. Do not patch minified chunks or add CSS overrides to imitate another release: replace the complete renderer and update the integrity fixture together.

`grok_bridge.js` adapts the renderer's desktop/coordinator protocol to the local Vega API and WebView2 host. Display gates match the reference release; theme, language and bot tint are local preferences, not a copy of the original application's profile. WebView2 window controls are drawn by the bridge because Electron's Windows titlebar-overlay API is not available. Windows DPI/font rasterization can still differ between the two runtimes.

The Vega bridge uses the existing device-paired API for the Bot list, recent text history, sending and read marks. It polls for persisted replies; it never reconnects by resending a message. No Grok service, account data or Vega credential is accessible to the release bundles. The loopback host restricts network requests to the local client.

Bot creation, editing and reply cancellation are available in the Vega web app. For group chats, task confirmations and output downloads, use **经典面板** from the system tray. Grok accounts, connectors, calling, recording and attachments are not provided by this adapter.
