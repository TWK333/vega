//go:build windows

package main

import (
	"encoding/json"
	"fmt"
	"os"
	"syscall"
	"unsafe"

	"github.com/jchv/go-webview2/pkg/edge"
	"golang.org/x/sys/windows"
)

const (
	clientWindowClass = "VegaClientWindow"
	panelShowMsg      = 0x8001
)

var panelBrowser *edge.Chromium
var panelHandle windows.Handle

func panelHostWndProc(hwnd windows.Handle, message uint32, wparam uintptr, lparam uintptr) uintptr {
	switch message {
	case 0x0005:
		if panelBrowser != nil {
			panelBrowser.Resize()
			panelCaptionPlace()
			panelPublishWindowState()
		}
	case 0x002b: // WM_DRAWITEM for the native caption overlay.
		if lparam != 0 && panelCaptionDraw(lparam) {
			return 1
		}
	case 0x0111:
		if wparam>>16 == 0 && wparam >= 100 && wparam <= 102 {
			panelHostMessage(`{"action":"` + []string{"minimize", "maximize", "close"}[wparam-100] + `"}`)
			return 0
		}
	case 0x0084: // WM_NCHITTEST: NCCALCSIZE removes the frame, so retain its resize targets.
		if zoomed, _, _ := winUser32.NewProc("IsZoomed").Call(uintptr(hwnd)); zoomed == 0 {
			var rect appuseWinRect
			procPanelRect.Call(uintptr(hwnd), uintptr(unsafe.Pointer(&rect)))
			x, y := int32(int16(lparam&0xffff)), int32(int16((lparam>>16)&0xffff))
			if hit := panelResizeHit(rect, x, y, winScale(6, panelDPI())); hit != 0 {
				return hit
			}
		}
	case 0x02e0: // WM_DPICHANGED: honor the destination monitor's suggested physical bounds.
		if lparam != 0 {
			rect := *(**appuseWinRect)(unsafe.Pointer(&lparam))
			procPanelPlace.Call(uintptr(hwnd), 0, uintptr(rect.Left), uintptr(rect.Top), uintptr(rect.Right-rect.Left), uintptr(rect.Bottom-rect.Top), 0x0004|0x0010)
			panelCaptionFont()
			panelCaptionPlace()
		}
		return 0
	case 0x0003:
		if panelBrowser != nil {
			_ = panelBrowser.NotifyParentWindowPositionChanged()
		}
	case 0x0014:
		return 1
	case 0x0083: // The original renderer supplies its own title bar, not a second Windows caption.
		if wparam != 0 {
			return 0
		}
	case 0x0232:
		savePanelGeometry(clientWindowDataDir(), hwnd)
	case 0x0024:
		if lparam != 0 {
			// lparam is the MINMAXINFO pointer supplied by Windows, not a Go allocation.
			info := *(**struct{ Reserved, MaxSize, MaxPosition, MinTrackSize, MaxTrackSize appuseWinPoint })(unsafe.Pointer(&lparam))
			info.MinTrackSize = appuseWinPoint{X: winScale(clientWindowMinWidth, panelDPI()), Y: winScale(clientWindowMinHeight, panelDPI())}
		}
		return 0
	case panelShowMsg:
		procPanelShow.Call(uintptr(hwnd), 9)
		procPanelForefront.Call(uintptr(hwnd))
		if panelBrowser != nil {
			panelBrowser.Focus()
		}
		return 0
	case 0x0010:
		savePanelGeometry(clientWindowDataDir(), hwnd)
		winUser32.NewProc("DestroyWindow").Call(uintptr(hwnd))
		return 0
	case 0x0002:
		if panelCaption.font != 0 {
			panelGDI.NewProc("DeleteObject").Call(panelCaption.font)
			panelCaption.font = 0
		}
		procPanelQuit.Call(0)
		return 0
	}
	result, _, _ := winUser32.NewProc("DefWindowProcW").Call(uintptr(hwnd), uintptr(message), wparam, lparam)
	return result
}

func panelDPI() uint32 {
	if dpi, _, _ := winUser32.NewProc("GetDpiForWindow").Call(uintptr(panelHandle)); dpi >= 96 {
		return uint32(dpi)
	}
	return winDPI()
}

func panelResizeHit(rect appuseWinRect, x, y, edge int32) uintptr {
	left, right, top, bottom := x < rect.Left+edge, x >= rect.Right-edge, y < rect.Top+edge, y >= rect.Bottom-edge
	switch {
	case top && left:
		return 13
	case top && right:
		return 14
	case bottom && left:
		return 16
	case bottom && right:
		return 17
	case left:
		return 10
	case right:
		return 11
	case top:
		return 12
	case bottom:
		return 15
	default:
		return 0
	}
}

func panelPublishWindowState() {
	if panelBrowser == nil {
		return
	}
	maximized, _, _ := winUser32.NewProc("IsZoomed").Call(uintptr(panelHandle))
	panelBrowser.Eval(fmt.Sprintf("window.__vegaWindowChanged?.({isFullscreen:false,isMaximized:%t})", maximized != 0))
}

func panelHostMessage(text string) {
	var input struct {
		Action string          `json:"action"`
		Colors json.RawMessage `json:"colors"`
		Edge   uintptr         `json:"edge"`
	}
	if json.Unmarshal([]byte(text), &input) != nil {
		return
	}
	switch input.Action {
	case "caption":
		panelCaptionColors(input.Colors)
	case "close":
		procPanelPost.Call(uintptr(panelHandle), 0x0010, 0, 0)
	case "minimize":
		procPanelShow.Call(uintptr(panelHandle), 6)
	case "maximize":
		maximized, _, _ := winUser32.NewProc("IsZoomed").Call(uintptr(panelHandle))
		command := uintptr(3)
		if maximized != 0 {
			command = 9
		}
		procPanelShow.Call(uintptr(panelHandle), command)
	case "focus":
		procPanelForefront.Call(uintptr(panelHandle))
	case "drag", "resize":
		hit := uintptr(2)
		if input.Action == "resize" {
			if input.Edge < 10 || input.Edge > 17 {
				return
			}
			hit = input.Edge
		}
		point := appuseWinPoint{}
		winUser32.NewProc("GetCursorPos").Call(uintptr(unsafe.Pointer(&point)))
		position := uintptr(uint16(point.X)) | uintptr(uint16(point.Y))<<16
		winUser32.NewProc("ReleaseCapture").Call()
		procPanelPost.Call(uintptr(panelHandle), 0x00A1, hit, position)
	}
}

func panelHostStart(url string) bool {
	instance, _, _ := winKernel32.NewProc("GetModuleHandleW").Call(0)
	procedure := syscall.NewCallback(panelHostWndProc)
	class := winWindowClass{Procedure: procedure, Instance: windows.Handle(instance), ClassName: winUTF16(clientWindowClass)}
	class.Size = uint32(unsafe.Sizeof(class))
	if atom, _, _ := winUser32.NewProc("RegisterClassExW").Call(uintptr(unsafe.Pointer(&class))); atom == 0 {
		return false
	}
	// Keep the first composition off screen, then show a normal taskbar window once embedded.
	park := int32(-20000)
	hwnd, _, _ := winUser32.NewProc("CreateWindowExW").Call(0x00040000, uintptr(unsafe.Pointer(winUTF16(clientWindowClass))), uintptr(unsafe.Pointer(winUTF16(clientWindowTitle))), 0x00CF0000|0x02000000|0x10000000, uintptr(uint32(park)), uintptr(uint32(park)), uintptr(winScale(clientWindowWidth, winDPI())), uintptr(winScale(clientWindowHeight, winDPI())), 0, 0, instance, 0)
	if hwnd == 0 {
		return false
	}
	panelHandle = windows.Handle(hwnd)
	_ = os.Setenv("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", "--disable-features=CalculateNativeWinOcclusion --disable-backgrounding-occluded-windows")
	browser := edge.NewChromium()
	browser.DataPath = clientWindowDataDir() + `\webview`
	browser.MessageCallback = panelHostMessage
	browser.NavigationCompletedCallback = func(_ *edge.ICoreWebView2, _ *edge.ICoreWebView2NavigationCompletedEventArgs) {
		panelPublishWindowState()
	}
	if !browser.Embed(hwnd) {
		winUser32.NewProc("DestroyWindow").Call(hwnd)
		return false
	}
	panelBrowser = browser
	panelCaptionInit(panelHandle)
	browser.Resize()
	browser.Navigate(url)
	clientWindowPlace(panelHandle)
	var message winMessage
	for {
		result, _, _ := winUser32.NewProc("GetMessageW").Call(uintptr(unsafe.Pointer(&message)), 0, 0, 0)
		if int32(result) <= 0 {
			return true
		}
		winUser32.NewProc("TranslateMessage").Call(uintptr(unsafe.Pointer(&message)))
		winUser32.NewProc("DispatchMessageW").Call(uintptr(unsafe.Pointer(&message)))
	}
}
