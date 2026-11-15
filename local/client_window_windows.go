//go:build windows

package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"syscall"
	"unsafe"

	"github.com/jchv/go-webview2/webviewloader"
	"golang.org/x/sys/windows"
)

const (
	clientWindowTitle        = "Vega"
	clientWindowWidth        = 1080
	clientWindowHeight       = 780
	clientWindowMinWidth     = 560
	clientWindowMinHeight    = 420
	clientWindowMargin       = 8
	clientWindowGeometryFile = "client-window.json"
)

var (
	procPanelPlace     = winUser32.NewProc("SetWindowPos")
	procPanelShow      = winUser32.NewProc("ShowWindow")
	procPanelForefront = winUser32.NewProc("SetForegroundWindow")
	procPanelPost      = winUser32.NewProc("PostMessageW")
	procPanelRect      = winUser32.NewProc("GetWindowRect")
	procPanelQuit      = winUser32.NewProc("PostQuitMessage")
	procPanelFind      = winUser32.NewProc("FindWindowW")
)
var clientWindowSpawn struct {
	sync.Mutex
	opened bool
}

func clientWindowOpen(url string) bool {
	if !strings.HasPrefix(url, "http://"+localAddress+"/assistant/") {
		return false
	}
	clientWindowSpawn.Lock()
	defer clientWindowSpawn.Unlock()
	if hwnd := panelWindow(); hwnd != 0 {
		procPanelPost.Call(hwnd, panelShowMsg, 0, 0)
		return true
	}
	if clientWindowSpawn.opened {
		return true
	}
	version, err := webviewloader.GetInstalledVersion()
	if err != nil || version == "" {
		return false
	}
	executable, err := os.Executable()
	if err != nil {
		return false
	}
	command := exec.Command(executable, "--client-window", url)
	command.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x00000008}
	if err = command.Start(); err != nil {
		return false
	}
	clientWindowSpawn.opened = true
	go func() {
		_ = command.Wait()
		clientWindowSpawn.Lock()
		clientWindowSpawn.opened = false
		clientWindowSpawn.Unlock()
	}()
	return true
}
func panelWindow() uintptr {
	hwnd, _, _ := procPanelFind.Call(uintptr(unsafe.Pointer(winUTF16(clientWindowClass))), 0)
	return hwnd
}
func clientWindowClose() {
	if hwnd := panelWindow(); hwnd != 0 {
		procPanelPost.Call(hwnd, 0x0010, 0, 0)
	}
}
func panelLog(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "vega-local: client window "+format+"\n", args...)
}
func clientWindowDataDir() string {
	if executable, err := os.Executable(); err == nil {
		if pin, err := readInstancePin(filepath.Dir(executable)); err == nil {
			if dir, err := siteDataDir(pin.Origin); err == nil {
				return dir
			}
		}
	}
	if dir, err := os.UserConfigDir(); err == nil {
		return filepath.Join(dir, "vega-local")
	}
	return os.TempDir()
}
func clientWindowRun(url string) bool {
	if !strings.HasPrefix(url, "http://"+localAddress+"/assistant/") {
		return false
	}
	version, err := webviewloader.GetInstalledVersion()
	if err != nil || version == "" {
		return false
	}
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	ole := windows.NewLazySystemDLL("ole32.dll")
	hr, _, _ := ole.NewProc("CoInitializeEx").Call(0, 2)
	if int32(hr) < 0 {
		return false
	}
	defer ole.NewProc("CoUninitialize").Call()
	return panelHostStart(url)
}

type panelGeometry struct{ X, Y, Width, Height int32 }

func panelGeometryPath(dir string) string { return filepath.Join(dir, clientWindowGeometryFile) }
func loadPanelGeometry(dir string) (panelGeometry, bool) {
	data, err := os.ReadFile(panelGeometryPath(dir))
	if err != nil {
		return panelGeometry{}, false
	}
	var geometry panelGeometry
	if json.Unmarshal(data, &geometry) != nil || geometry.Width < clientWindowMinWidth || geometry.Height < clientWindowMinHeight {
		return panelGeometry{}, false
	}
	return geometry, true
}
func savePanelGeometry(dir string, hwnd windows.Handle) {
	r := appuseWinRect{}
	if ok, _, _ := procPanelRect.Call(uintptr(hwnd), uintptr(unsafe.Pointer(&r))); ok == 0 {
		return
	}
	data, err := json.Marshal(panelGeometry{r.Left, r.Top, r.Right - r.Left, r.Bottom - r.Top})
	if err == nil {
		_ = os.MkdirAll(dir, 0700)
		_ = os.WriteFile(panelGeometryPath(dir), data, 0600)
	}
}
func clientWindowFrame(work appuseWinRect, saved *panelGeometry, dpi uint32) (x, y, width, height int32) {
	margin := winScale(clientWindowMargin, dpi)
	width, height = winScale(clientWindowWidth, dpi), winScale(clientWindowHeight, dpi)
	if saved != nil {
		width, height = saved.Width, saved.Height
	}
	if limit := work.Right - work.Left - 2*margin; limit > 0 && width > limit {
		width = limit
	}
	if limit := work.Bottom - work.Top - 2*margin; limit > 0 && height > limit {
		height = limit
	}
	x, y = work.Left+(work.Right-work.Left-width)/2, work.Top+(work.Bottom-work.Top-height)/2
	if saved != nil && saved.X >= work.Left && saved.Y >= work.Top && int64(saved.X)+int64(saved.Width) <= int64(work.Right) && int64(saved.Y)+int64(saved.Height) <= int64(work.Bottom) {
		x, y = saved.X, saved.Y
	}
	if x < work.Left+margin {
		x = work.Left + margin
	}
	if y < work.Top+margin {
		y = work.Top + margin
	}
	if x+width > work.Right-margin {
		x = work.Right - margin - width
	}
	if y+height > work.Bottom-margin {
		y = work.Bottom - margin - height
	}
	return
}
func clientWindowPlace(hwnd windows.Handle) {
	point := appuseWinPoint{}
	winUser32.NewProc("GetCursorPos").Call(uintptr(unsafe.Pointer(&point)))
	packed := uintptr(uint32(point.X)) | uintptr(uint32(point.Y))<<32
	monitor, _, _ := winUser32.NewProc("MonitorFromPoint").Call(packed, 2)
	info := struct {
		Size          uint32
		Monitor, Work appuseWinRect
		Flags         uint32
	}{}
	info.Size = uint32(unsafe.Sizeof(info))
	if ok, _, _ := winUser32.NewProc("GetMonitorInfoW").Call(monitor, uintptr(unsafe.Pointer(&info))); ok == 0 {
		winUser32.NewProc("SystemParametersInfoW").Call(0x0030, 0, uintptr(unsafe.Pointer(&info.Work)), 0)
	}
	saved, hasSaved := loadPanelGeometry(clientWindowDataDir())
	var geometry *panelGeometry
	if hasSaved {
		geometry = &saved
	}
	x, y, width, height := clientWindowFrame(info.Work, geometry, winDPI())
	procPanelPlace.Call(uintptr(hwnd), 0, uintptr(x), uintptr(y), uintptr(width), uintptr(height), 0x0040|0x0020|0x0004)
	procPanelForefront.Call(uintptr(hwnd))
}
