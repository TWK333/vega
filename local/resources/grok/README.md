# Embedded desktop renderer

The public renderer assets are from the locally installed **Grok Bot 1.1.0** release (`resources/app.asar`, `dist/renderer`). No account data, credentials, bootstrap identifiers or conversations are included.

All 696 files except the entry HTML are unmodified release bytes. `tests/grok-renderer-1.1.0.sha256` pins their hashes; the HTML differs only by the `grok_bridge.js` script loaded before the original entry point. Do not patch minified chunks or add CSS overrides to imitate another release: replace the complete renderer and update the integrity fixture together.

`grok_bridge.js` adapts the renderer's desktop/coordinator protocol to the local Vega API and WebView2 host. Display gates match the reference release; theme, language and bot tint are local preferences, not a copy of the original application's profile. WebView2 window controls are drawn by the bridge because Electron's Windows titlebar-overlay API is not available. Windows DPI/font rasterization can still differ between the two runtimes.

Vega's device-paired API provides Bot creation, profile edits, chat history/pagination, read marks, text sending, live replies and cancellation. Creation and sending carry stable client nonces so retries cannot duplicate a Bot or message. Live-stream reconnects restore history only; they never replay a write. Credentials stay in the Go process, and the server enforces the same owner/viewer permissions as the Vega website.

Grok accounts, connectors, calling, recording, attachments, branch/task-thread sends and destructive Bot operations are not implemented here. Unsupported writes fail explicitly instead of reporting success. Upgrade the Vega server together with the native client for the new API operations.
