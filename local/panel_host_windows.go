//go:build windows

package main

// 面板自己的 Win32 窗口保留系统任务栏和缩放；对话页的标题栏由 WebView2 绘制。

import (
	"fmt"
	"runtime"
	"strings"
	"sync"
	"syscall"
	"unsafe"

	"github.com/jchv/go-webview2/pkg/edge"
	"golang.org/x/sys/windows"
)

const (
	butterflyPanelClass = "VegaDesktopWindow"
	panelShowMsg        = 0x8000 + 1 // WM_APP + 1
	panelShutdownMsg    = 0x8000 + 2 // WM_APP + 2
	panelResizeMargin   = 6
	panelWSCaption      = 0x00C00000 // WS_CAPTION
)

var (
	procPanelLoadIcon       = panelUser32.NewProc("LoadIconW")
	procPanelZoomed         = panelUser32.NewProc("IsZoomed")
	procPanelIconic         = panelUser32.NewProc("IsIconic")
	procPanelVisible        = panelUser32.NewProc("IsWindowVisible")
	procPanelWindowMonitor  = panelUser32.NewProc("MonitorFromWindow")
	procPanelReleaseCapture = panelUser32.NewProc("ReleaseCapture")
	procPanelDwmAttribute   = windows.NewLazySystemDLL("dwmapi.dll").NewProc("DwmSetWindowAttribute")
)

func panelUsesGrok(url string) bool {
	return strings.HasPrefix(url, "http://"+localAddress+"/assistant/") && strings.HasSuffix(url, "/"+assistantGrokPath)
}

func panelFrameStyle(style uintptr, url string) uintptr {
	// NCCALCSIZE reserves the resize edges, but Windows can still draw a WS_CAPTION on top.
	if panelUsesGrok(url) {
		return style &^ panelWSCaption
	}
	return style | panelWSCaption
}

// panelWindowMessage only accepts commands for this window, never arbitrary native calls.
func panelWindowMessage(text string) {
	hwnd := panelHostWindow()
	// The settings page's own back link can navigate without a tray message.
	if text == "vega-window:chat-ready" {
		if token, ok := strings.CutPrefix(panelCurrentURL, "http://"+localAddress+"/config/"); ok {
			token, _, _ = strings.Cut(token, "?")
			panelCurrentURL = "http://" + localAddress + "/assistant/" + token + "/" + assistantGrokPath
			butterflyPanelChrome(hwnd)
		}
		return
	}
	if !panelUsesGrok(panelCurrentURL) {
		return
	}
	switch text {
	case "vega-window:minimize":
		_, _, _ = procPanelShow.Call(uintptr(hwnd), 6) // SW_MINIMIZE
	case "vega-window:toggle-maximize":
		command := uintptr(3) // SW_MAXIMIZE
		if zoomed, _, _ := procPanelZoomed.Call(uintptr(hwnd)); zoomed != 0 {
			command = 9 // SW_RESTORE
		}
		_, _, _ = procPanelShow.Call(uintptr(hwnd), command)
	case "vega-window:close":
		_, _, _ = procPanelPost.Call(uintptr(hwnd), 0x0010, 0, 0) // WM_CLOSE
	case "vega-window:drag":
		_, _, _ = procPanelReleaseCapture.Call()
		_, _, _ = procPanelPost.Call(uintptr(hwnd), 0x0112, 0xF012, 0) // WM_SYSCOMMAND, SC_MOVE | HTCAPTION
	case "vega-window:theme-dark", "vega-window:theme-light":
		dark := int32(0)
		color := edge.COREWEBVIEW2_COLOR{A: 255, R: 255, G: 255, B: 255}
		if text == "vega-window:theme-dark" {
			dark = 1
			color = edge.COREWEBVIEW2_COLOR{A: 255, R: 24, G: 24, B: 24}
		}
		_, _, _ = procPanelDwmAttribute.Call(uintptr(hwnd), 20, uintptr(unsafe.Pointer(&dark)), 4)
		if browser := panelHostBrowser(); browser != nil {
			if controller := browser.GetController().GetICoreWebView2Controller2(); controller != nil {
				_ = controller.PutDefaultBackgroundColor(color)
			}
		}
	}
}

var panelHost struct {
	sync.Mutex
	hwnd    windows.Handle
	browser *edge.Chromium
	pending bool // A tray request arrived while WebView2 was starting.
}

// panelCurrentURL WebView2 当前加载的页面（翻页前比对，避免每次点开都重载）。
var panelCurrentURL string

// panelMinMaxInfo 是 MINMAXINFO 的布局：五个 POINT，只有 MinTrackSize 用得上。
type panelMinMaxInfo struct {
	Reserved, MaxSize, MaxPosition, MinTrackSize, MaxTrackSize appuseWinPoint
}

func panelHostWindow() windows.Handle {
	panelHost.Lock()
	defer panelHost.Unlock()
	return panelHost.hwnd
}

func panelHostBrowser() *edge.Chromium {
	panelHost.Lock()
	defer panelHost.Unlock()
	return panelHost.browser
}

func panelDPI(hwnd windows.Handle) uint32 {
	if dpi, _, _ := procPanelDpi.Call(uintptr(hwnd)); dpi != 0 {
		return uint32(dpi)
	}
	return butterflyDPI()
}

func panelResizeHit(rect appuseWinRect, x, y, margin int32) uintptr {
	left, right := x < rect.Left+margin, x >= rect.Right-margin
	switch {
	case y < rect.Top+margin:
		if left {
			return 13
		} // HTTOPLEFT
		if right {
			return 14
		} // HTTOPRIGHT
		return 12 // HTTOP
	case y >= rect.Bottom-margin:
		if left {
			return 16
		} // HTBOTTOMLEFT
		if right {
			return 17
		} // HTBOTTOMRIGHT
		return 15 // HTBOTTOM
	case left:
		return 10 // HTLEFT
	case right:
		return 11 // HTRIGHT
	default:
		return 1 // HTCLIENT
	}
}

// Keep WebView2's last usable bounds while the native window is minimized or hidden.
func panelSyncWebView(hwnd windows.Handle, browser *edge.Chromium, minimized bool) error {
	shown, _, _ := procPanelVisible.Call(uintptr(hwnd))
	iconic, _, _ := procPanelIconic.Call(uintptr(hwnd))
	var rect appuseWinRect
	ok, _, _ := procChipClientRect.Call(uintptr(hwnd), uintptr(unsafe.Pointer(&rect)))
	visible := !minimized && iconic == 0 && shown != 0 && ok != 0 && rect.Right > rect.Left && rect.Bottom > rect.Top
	var err error
	if visible {
		browser.Resize()
		_ = browser.NotifyParentWindowPositionChanged()
		err = browser.Show()
	} else {
		err = browser.Hide()
	}
	if panelUsesGrok(panelCurrentURL) {
		zoomed, _, _ := procPanelZoomed.Call(uintptr(hwnd))
		dpi := panelDPI(hwnd)
		browser.Eval(fmt.Sprintf("window.vegaPanelDpiScale=%g;window.dispatchEvent(new CustomEvent('vega-window-state',{detail:{isMaximized:%t,visible:%t}}))", float64(dpi)/96, zoomed != 0, visible))
	}
	return err
}

func panelHostWndProc(hwnd windows.Handle, message uint32, wparam, lparam uintptr) uintptr {
	switch message {
	case 0x0083: // WM_NCCALCSIZE
		if panelUsesGrok(panelCurrentURL) && lparam != 0 {
			if zoomed, _, _ := procPanelZoomed.Call(uintptr(hwnd)); zoomed == 0 {
				// Leave actual non-client edges outside WebView2's child, as in a native resizable frame.
				rect := *(**appuseWinRect)(unsafe.Pointer(&lparam)) // both forms start with a RECT
				margin := butterflyScale(panelResizeMargin, panelDPI(hwnd))
				rect.Left, rect.Top, rect.Right, rect.Bottom = rect.Left+margin, rect.Top+margin, rect.Right-margin, rect.Bottom-margin
			}
			return 0
		}
	case 0x0084: // WM_NCHITTEST
		if panelUsesGrok(panelCurrentURL) {
			var rect appuseWinRect
			zoomed, _, _ := procPanelZoomed.Call(uintptr(hwnd))
			if ok, _, _ := procPanelRect.Call(uintptr(hwnd), uintptr(unsafe.Pointer(&rect))); ok != 0 && zoomed == 0 {
				x, y := int32(int16(lparam)), int32(int16(lparam>>16))
				return panelResizeHit(rect, x, y, butterflyScale(panelResizeMargin, panelDPI(hwnd)))
			}
			return 1 // HTCLIENT
		}
	case 0x0003: // WM_MOVE
		if browser := panelHostBrowser(); browser != nil {
			_ = browser.NotifyParentWindowPositionChanged()
		}
	case 0x02E0: // WM_DPICHANGED
		if lparam != 0 {
			r := *(**appuseWinRect)(unsafe.Pointer(&lparam))
			_, _, _ = procPanelPlace.Call(uintptr(hwnd), 0, uintptr(r.Left), uintptr(r.Top), uintptr(r.Right-r.Left), uintptr(r.Bottom-r.Top), 0x0004|0x0010)
		}
		return 0
	case 0x0005: // WM_SIZE (including restore from the taskbar)
		if browser := panelHostBrowser(); browser != nil {
			_ = panelSyncWebView(hwnd, browser, wparam == 1) // SIZE_MINIMIZED
		}
		return 0
	case 0x0014: // WM_ERASEBKGND：别用系统背景刷，省得闪白
		return 1
	case 0x0232: // WM_EXITSIZEMOVE：用户拖完/缩放完，把大小位置记下来
		if zoomed, _, _ := procPanelZoomed.Call(uintptr(hwnd)); zoomed == 0 {
			savePanelGeometry(butterflyPanelDataDir(), hwnd)
		}
		return 0
	case 0x0024: // WM_GETMINMAXINFO
		if lparam != 0 {
			info := *(**panelMinMaxInfo)(unsafe.Pointer(&lparam))
			dpi := panelDPI(hwnd)
			info.MinTrackSize = appuseWinPoint{X: butterflyScale(butterflyPanelMinWidth, dpi), Y: butterflyScale(butterflyPanelMinHeight, dpi)}
			monitor, _, _ := procPanelWindowMonitor.Call(uintptr(hwnd), 2)
			area := struct {
				Size          uint32
				Monitor, Work appuseWinRect
				Flags         uint32
			}{}
			area.Size = uint32(unsafe.Sizeof(area))
			if panelUsesGrok(panelCurrentURL) {
				if ok, _, _ := procPanelInfo.Call(monitor, uintptr(unsafe.Pointer(&area))); ok != 0 {
					info.MaxPosition = appuseWinPoint{X: area.Work.Left - area.Monitor.Left, Y: area.Work.Top - area.Monitor.Top}
					info.MaxSize = appuseWinPoint{X: area.Work.Right - area.Work.Left, Y: area.Work.Bottom - area.Work.Top}
				}
			}
		}
		return 0
	case panelShowMsg:
		browser := panelHostBrowser()
		if browser == nil {
			panelHost.Lock()
			panelHost.pending = true
			panelHost.Unlock()
			return 0
		}
		panelNavigate(hwnd)
		command := uintptr(5) // SW_SHOW (keep current geometry and maximized state)
		if minimized, _, _ := procPanelIconic.Call(uintptr(hwnd)); minimized != 0 {
			command = 9 // SW_RESTORE
		}
		_, _, _ = procPanelShow.Call(uintptr(hwnd), command)
		_ = panelSyncWebView(hwnd, browser, false)
		panelClaimForeground(hwnd)
		return 0
	case 0x0010: // WM_CLOSE: keep the client and its chat alive in the tray.
		_, _, _ = procPanelShow.Call(uintptr(hwnd), 0) // SW_HIDE
		if browser := panelHostBrowser(); browser != nil {
			_ = panelSyncWebView(hwnd, browser, false)
		}
		return 0
	case panelShutdownMsg:
		_, _, _ = procChipDestroy.Call(uintptr(hwnd))
		return 0
	case 0x0002: // WM_DESTROY
		_, _, _ = procPanelQuit.Call(0)
		return 0
	}
	result, _, _ := procChipDefProc.Call(uintptr(hwnd), uintptr(message), wparam, lparam)
	return result
}

func panelCreateWindow(class chipWindowClass, x, y, width, height int32) (uintptr, error) {
	const (
		wsOverlapped = 0x00CF0000 // WS_OVERLAPPEDWINDOW
		wsClip       = 0x02000000 // WS_CLIPCHILDREN
		exApp        = 0x00040000 // WS_EX_APPWINDOW, a normal taskbar button
	)
	hwnd, _, last := procChipCreate.Call(
		exApp,
		uintptr(unsafe.Pointer(class.ClassName)),
		uintptr(unsafe.Pointer(butterflyUTF16(butterflyPanelTitle))),
		wsOverlapped|wsClip,
		uintptr(uint32(x)), uintptr(uint32(y)),
		uintptr(width), uintptr(height),
		0, 0, uintptr(class.Instance), 0)
	if hwnd != 0 {
		// CreateWindowEx adds WS_CAPTION to an overlapped window; remove it for chat before showing it.
		butterflyPanelChrome(windows.Handle(hwnd))
	}
	return hwnd, last
}

// panelHostStart 建窗 + 嵌 WebView2 + 载入页面，然后进入消息循环（阻塞到窗口销毁）。
func panelHostStart(url string) bool {
	runtime.LockOSThread()
	instance, _, _ := procButterflyModule.Call(0)
	procedure := syscall.NewCallback(panelHostWndProc)
	icon, _, _ := procPanelLoadIcon.Call(instance, 101) // vega-local.rc
	if icon == 0 {
		icon, _, _ = procPanelLoadIcon.Call(0, 32512) // IDI_APPLICATION
	}
	class := chipWindowClass{
		Procedure: procedure,
		Instance:  windows.Handle(instance),
		ClassName: butterflyUTF16(butterflyPanelClass),
		Icon:      windows.Handle(icon),
		IconSmall: windows.Handle(icon),
	}
	class.Size = uint32(unsafe.Sizeof(class))
	if atom, _, last := procChipRegister.Call(uintptr(unsafe.Pointer(&class))); atom == 0 {
		panelLog("注册面板窗口类失败：%v", last)
		return false
	}
	x, y, width, height := panelInitialFrame()
	panelCurrentURL = url
	hwnd, last := panelCreateWindow(class, x, y, width, height)
	if hwnd == 0 {
		panelLog("建面板窗口失败：%v", last)
		return false
	}
	panelHost.Lock()
	panelHost.hwnd = windows.Handle(hwnd)
	panelHost.Unlock()
	_, _, _ = procPanelShow.Call(hwnd, 5) // SW_SHOW: the parent must be visible before WebView2 embeds
	dpi := panelDPI(windows.Handle(hwnd))
	chromium := edge.NewChromium()
	chromium.DataPath = butterflyPanelDataDir() + `\webview`
	chromium.MessageCallback = panelWindowMessage
	if !chromium.Embed(hwnd) {
		panelLog("WebView2 初始化失败")
		_, _, _ = procChipDestroy.Call(hwnd)
		return false
	}
	panelHost.Lock()
	panelHost.browser = chromium
	panelHost.Unlock()
	// 普通面板用不透明底色；提示气泡的透明合成设置不能沿用到这里。
	if c := chromium.GetController(); c != nil {
		if c2 := c.GetICoreWebView2Controller2(); c2 != nil {
			_ = c2.PutDefaultBackgroundColor(edge.COREWEBVIEW2_COLOR{A: 255, R: 255, G: 255, B: 255})
		}
	}
	chromium.Init(fmt.Sprintf("window.vegaPanelDpiScale=%g", float64(dpi)/96))
	if err := panelSyncWebView(windows.Handle(hwnd), chromium, false); err != nil {
		panelLog("显示 WebView2 失败：%v", err)
		_, _, _ = procChipDestroy.Call(hwnd)
		return false
	}
	chromium.Navigate(url)
	panelHost.Lock()
	pending := panelHost.pending
	panelHost.pending = false
	panelHost.Unlock()
	if pending {
		panelNavigate(windows.Handle(hwnd))
	}
	panelClaimForeground(windows.Handle(hwnd))
	var message chipMsg
	for {
		result, _, _ := procChipGetMsg.Call(uintptr(unsafe.Pointer(&message)), 0, 0, 0)
		if int32(result) <= 0 {
			return true
		}
		_, _, _ = procChipTranslate.Call(uintptr(unsafe.Pointer(&message)))
		_, _, _ = procChipDispatch.Call(uintptr(unsafe.Pointer(&message)))
	}
}
