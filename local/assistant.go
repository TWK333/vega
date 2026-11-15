package main

// 原版 Grok renderer 由本进程内嵌发给 WebView2；只替换 Electron 数据通道。
// 设备凭据只在 Go 进程里使用，页面通过本站点的 /api/local-agent/chat/* 读取数据。
// 地址带 configToken：本机别的程序不知道令牌就打不开，接口也只认这个令牌。

import (
	"bytes"
	"context"
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"encoding/json"
	"io"
	"io/fs"
	"net/http"
	"net/url"
	"strings"
	"time"
)

//go:embed all:grok_ui
var assistantAssets embed.FS

// assistantMount 把面板页面和它的几个接口挂到本地服务器上。
func (a *Agent) assistantMount(mux *http.ServeMux) {
	base := a.assistantPath()
	assets, err := fs.Sub(assistantAssets, "grok_ui")
	if err != nil {
		panic(err)
	}
	files := http.StripPrefix(base, http.FileServer(http.FS(assets)))
	mux.HandleFunc(base, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "no-store")
		path := strings.TrimPrefix(r.URL.Path, base)
		if strings.HasPrefix(path, "api/") {
			if r.Method != http.MethodPost {
				http.Error(w, "POST required", http.StatusMethodNotAllowed)
				return
			}
			if origin := r.Header.Get("Origin"); origin != "" && origin != "http://"+localAddress {
				http.Error(w, "cross-origin request denied", http.StatusForbidden)
				return
			}
			switch strings.TrimPrefix(path, "api/") {
			case "host":
				a.mu.Lock()
				account := a.pinnedOrigin
				if len(a.config.Servers) > 0 {
					account += ":" + a.config.Servers[len(a.config.Servers)-1].UserID
				}
				a.mu.Unlock()
				hash := sha256.Sum256([]byte(account))
				_, _, paired := a.assistantCredential()
				assistantReply(w, http.StatusOK, map[string]any{"version": clientVersion, "account": hex.EncodeToString(hash[:]), "paired": paired, "configURL": "/config/" + a.configToken})
			case "external":
				var input struct {
					URL string `json:"url"`
				}
				err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192)).Decode(&input)
				target, parseErr := url.Parse(input.URL)
				if err != nil || parseErr != nil || target.Host == "" || (target.Scheme != "http" && target.Scheme != "https") || target.User != nil {
					http.Error(w, "invalid external URL", http.StatusBadRequest)
					return
				}
				openBrowser(target.String())
				assistantReply(w, http.StatusOK, map[string]any{"ok": true})
			case "threads", "messages", "send", "read", "control", "file", "create":
				a.assistantProxy(w, r, strings.TrimPrefix(path, "api/"))
			default:
				http.NotFound(w, r)
			}
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.Error(w, "GET required", http.StatusMethodNotAllowed)
			return
		}
		files.ServeHTTP(w, r)
	})
}

// assistantPath 面板页面与接口在本地服务器上的路径前缀。
func (a *Agent) assistantPath() string {
	return "/assistant/" + a.configToken + "/"
}

// assistantBase 面板页面地址（本地环回 + 令牌）。
func (a *Agent) assistantBase() string {
	return "http://" + localAddress + a.assistantPath()
}

// assistantProxy 用设备凭据把请求转给站点。原生客户端的请求不带 Origin、不带查询串，
// 所以参数全部走 body，站点那边也只收 POST。
func (a *Agent) assistantProxy(w http.ResponseWriter, r *http.Request, op string) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST required", http.StatusMethodNotAllowed)
		return
	}
	// 页面只从本机这个地址加载，其它来源一律拒绝。
	if origin := r.Header.Get("Origin"); origin != "" && origin != "http://"+localAddress {
		http.Error(w, "cross-origin request denied", http.StatusForbidden)
		return
	}
	requestLimit := int64(1 << 20)
	if op == "send" {
		requestLimit = 90 << 20 // Same attachment envelope as the website; upstream validates file sizes.
	}
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, requestLimit))
	if err != nil {
		http.Error(w, "unreadable body", http.StatusBadRequest)
		return
	}
	origin, token, ok := a.assistantCredential()
	if !ok {
		assistantReply(w, http.StatusConflict, map[string]any{"error": "还没有配对站点，请先在托盘打开配置页完成配对"})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, origin+"/api/local-agent/chat/"+op, bytes.NewReader(body))
	if err != nil {
		assistantReply(w, http.StatusBadGateway, map[string]any{"error": err.Error()})
		return
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	response, err := (&http.Client{Timeout: 30 * time.Second}).Do(req)
	if err != nil {
		assistantReply(w, http.StatusBadGateway, map[string]any{"error": "连不上站点：" + err.Error()})
		return
	}
	defer response.Body.Close()
	limit := int64(8 << 20)
	if op == "file" || op == "messages" {
		limit = 48 << 20 // 25MiB binary plus base64, or a page of full step outputs
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, limit+1))
	if err != nil || int64(len(data)) > limit {
		assistantReply(w, http.StatusBadGateway, map[string]any{"error": "站点返回的内容无法完整读取"})
		return
	}
	if response.StatusCode == http.StatusNotFound || response.StatusCode == http.StatusUnauthorized {
		// 老版本服务端没有这几个接口（还得要网站 cookie）：给页面一句能看懂的话。
		assistantReply(w, http.StatusConflict, map[string]any{"error": "服务端还没有更新到支持客户端聊天的版本（缺少 /api/local-agent/chat）"})
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(response.StatusCode)
	if len(data) == 0 {
		_, _ = w.Write([]byte("{}"))
		return
	}
	_, _ = w.Write(data)
}

// assistantCredential 当前站点 + 它的设备凭据（DPAPI 解出来的原始 token）。
func (a *Agent) assistantCredential() (string, string, bool) {
	a.mu.Lock()
	servers := append([]ServerCredential{}, a.config.Servers...)
	pinned := a.pinnedOrigin
	a.mu.Unlock()
	// 同一站点可以配多个账号，配对时新的追加在末尾：面板跟最近配对的账号走，
	// 否则会一直用最早那个（往往早已不用的空账号，左栏永远「还没有牛马」）。
	for _, liked := range []bool{true, false} {
		for i := len(servers) - 1; i >= 0; i-- {
			saved := servers[i]
			if liked != (saved.Origin == pinned) || !validOrigin(saved.Origin) {
				continue
			}
			if token, err := unprotectToken(saved.Token); err == nil && token != "" {
				return saved.Origin, token, true
			}
		}
	}
	return "", "", false
}

// assistantReply 出错时也回 JSON，页面直接把 error 显示在聊天区。
func assistantReply(w http.ResponseWriter, status int, value any) {
	data, _ := json.Marshal(value)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_, _ = w.Write(data)
}
