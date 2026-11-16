package main

// 首次连接像设备授权：客户端持有校验密钥，浏览器只到绑定站点确认，不请求本机。

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"runtime"
	"strings"
	"time"
)

func deviceSecret() (string, error) {
	data := make([]byte, 32)
	if _, err := rand.Read(data); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(data), nil
}

// devicePost 不跟随重定向：校验密钥和设备凭据只发往安装包固定的站点。
func devicePost(ctx context.Context, origin, path string, payload any, out any) (int, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return 0, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, origin+path, bytes.NewReader(body))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 10 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	response, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return response.StatusCode, fmt.Errorf("站点返回 HTTP %d", response.StatusCode)
	}
	if err = json.NewDecoder(io.LimitReader(response.Body, 4096)).Decode(out); err != nil {
		return response.StatusCode, fmt.Errorf("站点授权响应无效")
	}
	return response.StatusCode, nil
}

func deviceWait(ctx context.Context, delay time.Duration) bool {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}

// requestDeviceAuthorization 只在用户确认后保存设备凭据；同一请求的网络重试复用原凭据。
func (a *Agent) requestDeviceAuthorization(ctx context.Context, open func(string)) (ServerCredential, string, error) {
	verifier, err := deviceSecret()
	if err != nil {
		return ServerCredential{}, "", err
	}
	token, err := deviceSecret()
	if err != nil {
		return ServerCredential{}, "", err
	}
	challenge := sha256.Sum256([]byte(verifier))
	a.mu.Lock()
	clientID := a.config.ClientID
	a.mu.Unlock()
	if decoded, err := hex.DecodeString(clientID); err != nil || len(decoded) != 16 {
		return ServerCredential{}, "", fmt.Errorf("本机设备 ID 无效")
	}
	name, _ := os.Hostname()
	name = strings.TrimSpace(strings.Map(func(r rune) rune {
		if r < 32 {
			return -1
		}
		return r
	}, name))
	if name == "" || len([]rune(name)) > 60 {
		name = "牵牛星 " + runtime.GOOS
	}
	start := map[string]string{"clientId": clientID, "challenge": base64.RawURLEncoding.EncodeToString(challenge[:]), "name": name, "platform": runtime.GOOS}
	var request struct {
		RequestID string `json:"requestId"`
	}
	delay := time.Second
	for {
		status, err := devicePost(ctx, a.pinnedOrigin, "/api/local-agent/device/start", start, &request)
		if err == nil {
			break
		}
		if status >= 300 && status < 500 || status == http.StatusOK {
			return ServerCredential{}, "", fmt.Errorf("无法发起授权（HTTP %d），请检查服务端版本", status)
		}
		a.noteSite(a.pinnedOrigin, "暂时连不上站点，客户端将自动重试")
		if !deviceWait(ctx, delay) {
			return ServerCredential{}, "", ctx.Err()
		}
		if delay < 30*time.Second {
			delay *= 2
			if delay > 30*time.Second {
				delay = 30 * time.Second
			}
		}
	}
	decoded, err := base64.RawURLEncoding.DecodeString(request.RequestID)
	if err != nil || len(decoded) != 32 || len(request.RequestID) != 43 {
		return ServerCredential{}, "", fmt.Errorf("站点返回了无效的授权请求")
	}
	address := a.pinnedOrigin + "/?client_authorization=" + url.QueryEscape(request.RequestID)
	a.noteSite(a.pinnedOrigin, "请核对设备尾号 "+clientID[len(clientID)-6:]+"，并在站点确认设备授权："+address)
	fmt.Fprintln(os.Stderr, "vega-local: 请在浏览器打开 "+address)
	open(address)
	claim := map[string]string{"requestId": request.RequestID, "clientId": clientID, "verifier": verifier, "deviceToken": token}
	for ctx.Err() == nil {
		var result struct {
			Status   string `json:"status"`
			UserID   string `json:"userId"`
			ClientID string `json:"clientId"`
		}
		status, err := devicePost(ctx, a.pinnedOrigin, "/api/local-agent/device/token", claim, &result)
		if err != nil {
			if status >= 300 && status < 500 || status == http.StatusOK {
				return ServerCredential{}, "", fmt.Errorf("授权请求失效或未获准（HTTP %d），请重新启动客户端", status)
			}
		} else {
			switch result.Status {
			case "authorized":
				if result.UserID == "" || result.ClientID != clientID {
					return ServerCredential{}, "", fmt.Errorf("站点返回了不匹配的账号或设备")
				}
				saved, err := a.saveCredential(a.pinnedOrigin, loginProof{UserID: result.UserID, DeviceToken: token})
				return saved, token, err
			case "denied":
				return ServerCredential{}, "", fmt.Errorf("用户拒绝了设备授权")
			case "pending":
			default:
				return ServerCredential{}, "", fmt.Errorf("站点返回了无效的授权状态")
			}
		}
		if !deviceWait(ctx, 3*time.Second) {
			return ServerCredential{}, "", ctx.Err()
		}
	}
	return ServerCredential{}, "", ctx.Err()
}

var openDeviceAuthorization = openBrowser

func (a *Agent) authorizeDevice(ctx context.Context) {
	saved, token, err := a.requestDeviceAuthorization(ctx, openDeviceAuthorization)
	if err != nil {
		if ctx.Err() == nil {
			a.noteSite(a.pinnedOrigin, err.Error())
		}
		return
	}
	if a.startConnection(saved, token) == nil {
		a.noteSite(a.pinnedOrigin, "设备授权已保存，但无法启动连接")
		return
	}
	a.noteSite(a.pinnedOrigin, "设备已授权，正在直接连接站点")
}
