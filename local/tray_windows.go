//go:build windows && !linux

// Windows tray: connection status, settings and Quit.
package main

import (
	_ "embed"
	"os"
	"sync"

	"github.com/getlantern/systray"
)

//go:embed icon.ico
var iconData []byte

//go:embed icon-connected.ico
var iconConnectedData []byte

func systrayRun(configure, onQuit func()) {
	systray.Run(func() {
		systray.SetTitle("牵牛星")
		mClient := systray.AddMenuItem("打开 Vega", "打开客户端对话窗口")
		mConfigure := systray.AddMenuItem("设置", "管理站点授权、浏览器和补充内容")
		mQuit := systray.AddMenuItem("退出", "Stop local agent")
		trayState.Lock()
		trayState.ready = true
		applyTrayAppearance(trayState.connected)
		trayState.Unlock()
		go func() {
			for {
				select {
				case <-mClient.ClickedCh:
					if clientOpen != nil {
						clientOpen()
					}
				case <-mConfigure.ClickedCh:
					configure()
				case <-mQuit.ClickedCh:
					onQuit()
					return
				}
			}
		}()
	}, func() { os.Exit(0) })
}

var trayState struct {
	sync.Mutex
	ready     bool
	connected bool
	site      string
	// 操作电脑提示独立于聊天窗口。
	notice     string
	noticeText string
}

// setSiteLabel 让托盘标题带上站点，多个站点的客户端一眼能分。
func setSiteLabel(site string) {
	trayState.Lock()
	defer trayState.Unlock()
	trayState.site = site
	if trayState.ready {
		applyTrayAppearance(trayState.connected)
	}
}

func connectionTooltip(connected bool) string {
	base := "牵牛星"
	if trayState.site != "" {
		base += " · " + trayState.site
	}
	if connected {
		return base + " · 已连接"
	}
	return base + " · 未连接"
}

// trayTooltip 把操作提示叠在连接状态上。
func trayTooltip(connected bool, notice, text string) string {
	switch notice {
	case "needs_review":
		return "牵牛星 · 需要你核对：" + truncateRunes(text, 80)
	case "running":
		return "牵牛星 · 正在操作这台电脑"
	}
	return connectionTooltip(connected)
}

func applyTrayAppearance(connected bool) {
	if connected {
		systray.SetIcon(iconConnectedData)
	} else {
		systray.SetIcon(iconData)
	}
	systray.SetTooltip(trayTooltip(connected, trayState.notice, trayState.noticeText))
}

func clientTrayNotice(notice *clientNotice) {
	trayState.Lock()
	defer trayState.Unlock()
	trayState.notice, trayState.noticeText = "", ""
	if notice != nil {
		trayState.notice, trayState.noticeText = notice.Kind, notice.Text
	}
	if trayState.ready {
		applyTrayAppearance(trayState.connected)
	}
}

func truncateRunes(text string, limit int) string {
	runes := []rune(text)
	if len(runes) <= limit {
		return text
	}
	return string(runes[:limit]) + "…"
}

func setState(connected bool) {
	trayState.Lock()
	defer trayState.Unlock()
	trayState.connected = connected
	if trayState.ready {
		applyTrayAppearance(connected)
	}
}
