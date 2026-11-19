//go:build windows

package main

// Windows 对话窗启动在独立进程，WebView2 初始化失败不会带走托盘和正在跑的任务。

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
	"time"
	"unsafe"

	"github.com/jchv/go-webview2/webviewloader"
	"golang.org/x/sys/windows"
)

const (
	butterflyPanelTitle = "牵牛星"
	// 现在是普通窗口，不是气泡：默认给够面积放得下对话和设置，用户拖过就按上次的大小打开。
	butterflyPanelWidth        = 1080
	butterflyPanelHeight       = 780
	butterflyPanelMinWidth     = 560
	butterflyPanelMinHeight    = 420
	butterflyPanelMargin       = 8
	butterflyPanelGeometryFile = "panel-window.json"
)

var (
	panelUser32 = windows.NewLazySystemDLL("user32.dll")

	procPanelStyle      = panelUser32.NewProc("GetWindowLongPtrW")
	procPanelSetStyle   = panelUser32.NewProc("SetWindowLongPtrW")
	procPanelPlace      = panelUser32.NewProc("SetWindowPos")
	procPanelShow       = panelUser32.NewProc("ShowWindow")
	procPanelForefront  = panelUser32.NewProc("SetForegroundWindow")
	procPanelCursor     = panelUser32.NewProc("GetCursorPos")
	procPanelMonitor    = panelUser32.NewProc("MonitorFromPoint")
	procPanelInfo       = panelUser32.NewProc("GetMonitorInfoW")
	procPanelFind       = panelUser32.NewProc("FindWindowW")
	procPanelFindChild  = panelUser32.NewProc("FindWindowExW")
	procPanelPost       = panelUser32.NewProc("PostMessageW")
	procPanelForeground = panelUser32.NewProc("GetForegroundWindow")
	procPanelAncestor   = panelUser32.NewProc("GetAncestor")
	procPanelDpi        = panelUser32.NewProc("GetDpiForWindow")
	procPanelAttach     = panelUser32.NewProc("AttachThreadInput")
	procPanelFocus      = panelUser32.NewProc("SetFocus")
	procPanelThread     = windows.NewLazySystemDLL("kernel32.dll").NewProc("GetCurrentThreadId")
	procPanelOwner      = panelUser32.NewProc("GetWindowThreadProcessId")
	procPanelQuit       = panelUser32.NewProc("PostQuitMessage")
	procPanelRect       = panelUser32.NewProc("GetWindowRect")
)

// A single owned child serves both the main window and its connection settings.
var butterflyPanelSpawn struct {
	sync.Mutex
	process *os.Process
	done    chan struct{}
	closing bool
}

// butterflyPanelOpen launches the app or restores its existing window.
func butterflyPanelOpen(url string) bool {
	if url == "" {
		return false
	}
	butterflyPanelSpawn.Lock()
	defer butterflyPanelSpawn.Unlock()
	if butterflyPanelSpawn.closing {
		return true
	}
	if hwnd := panelWindow(); hwnd != 0 {
		_, _, _ = procPanelPost.Call(hwnd, panelShowMsg, 0, 0)
		return true
	}
	if butterflyPanelSpawn.process == nil {
		return butterflyPanelLaunch(url)
	}
	// During WebView2 startup the requested URL is already in panel-target.txt.
	return true
}

// butterflyPanelLaunch 起面板进程（调用方持有 butterflyPanelSpawn 锁）。
func butterflyPanelLaunch(url string) bool {
	if version, err := webviewloader.GetInstalledVersion(); err != nil || version == "" {
		return false
	}
	executable, err := os.Executable()
	if err != nil {
		return false
	}
	command := exec.Command(executable, "--butterfly-panel", url)
	// 千万别加 HideWindow：它给子进程塞 STARTF_USESHOWWINDOW+SW_HIDE，系统的第一次
	// ShowWindow（WebView2 库建窗时那次）会被替换成隐藏，合成器就建在隐藏窗口上，
	// 之后再显示也只有黑/白底，页面永远不上屏。GUI 子系统本来就没有黑窗要藏。
	command.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x00000008} // DETACHED_PROCESS
	if err := command.Start(); err != nil {
		return false
	}
	done := make(chan struct{})
	butterflyPanelSpawn.process, butterflyPanelSpawn.done = command.Process, done
	go func() {
		_ = command.Wait()
		butterflyPanelSpawn.Lock()
		butterflyPanelSpawn.process, butterflyPanelSpawn.done = nil, nil
		butterflyPanelSpawn.Unlock()
		close(done)
	}()
	return true
}

func panelWindow() uintptr {
	hwnd, _, _ := procPanelFind.Call(uintptr(unsafe.Pointer(butterflyUTF16(butterflyPanelClass))), 0)
	return hwnd
}

// Closing the window hides it; exiting from the tray ends the owned child too.
func butterflyPanelClose() {
	butterflyPanelSpawn.Lock()
	butterflyPanelSpawn.closing = true
	process, done := butterflyPanelSpawn.process, butterflyPanelSpawn.done
	hwnd := panelWindow()
	butterflyPanelSpawn.Unlock()
	if process == nil {
		return
	}
	if hwnd != 0 {
		_, _, _ = procPanelPost.Call(hwnd, panelShutdownMsg, 0, 0)
		select {
		case <-done:
			return
		case <-time.After(time.Second):
		}
	}
	_ = process.Kill()
}

func butterflyPanelPark() {
	if hwnd := panelWindow(); hwnd != 0 {
		_, _, _ = procPanelPost.Call(hwnd, 0x0010, 0, 0) // WM_CLOSE hides the window.
	}
}

// panelLog 面板是独立进程，出问题时只能写主进程的 client.log（同站点数据目录）。
func panelLog(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "vega-local: 蝴蝶面板 "+format+"\n", args...)
	executable, err := os.Executable()
	if err != nil {
		return
	}
	pin, err := readInstancePin(filepath.Dir(executable))
	if err != nil {
		return
	}
	dir, err := siteDataDir(pin.Origin)
	if err != nil {
		return
	}
	file, err := os.OpenFile(filepath.Join(dir, "client.log"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		return
	}
	defer file.Close()
	fmt.Fprintf(file, "%s 蝴蝶面板 %s\n", time.Now().Format("2006-01-02 15:04:05"), fmt.Sprintf(format, args...))
}

// butterflyPanelDataDir 与主进程用同一个站点数据目录（读自己旁边的 instance.json），WebView2 配置也放这里。
func butterflyPanelDataDir() string {
	if executable, err := os.Executable(); err == nil {
		if pin, err := readInstancePin(filepath.Dir(executable)); err == nil {
			if dir, err := siteDataDir(pin.Origin); err == nil {
				return dir
			}
		}
	}
	if base, err := os.UserConfigDir(); err == nil {
		return filepath.Join(base, "vega-local")
	}
	return os.TempDir()
}

// butterflyPanelRun 在独立进程里跑面板：占住线程初始化 COM，再把窗口和 WebView2 交给宿主。
func butterflyPanelRun(url string) bool {
	version, versionErr := webviewloader.GetInstalledVersion()
	if versionErr != nil || version == "" {
		panelLog("WebView2 运行时不可用（%v），改开系统浏览器", versionErr)
		return false // 没装 WebView2 运行时：交给系统浏览器，别让 COM 在这里崩掉
	}
	// 已经初始化过（同线程或库自己的 init）会返回 S_FALSE，也算成功。
	runtime.LockOSThread()
	if hr, _, _ := procButterflyCoInit.Call(0, 2); int32(hr) < 0 { // COINIT_APARTMENTTHREADED
		panelLog("CoInitializeEx 失败 hr=0x%x", uint32(hr))
		return false
	}
	defer func() { _, _, _ = procButterflyCoUninit.Call() }()
	return panelHostStart(url) // 阻塞到窗口销毁
}

// panelTarget 面板这次要显示的页面：主进程在打开前把地址写到这里（同一个数据目录）。
func panelTarget() string {
	data, err := os.ReadFile(filepath.Join(butterflyPanelDataDir(), "panel-target.txt"))
	if err != nil {
		return ""
	}
	target := strings.TrimSpace(string(data))
	// 只认本机客户端自己的页面。
	if !strings.HasPrefix(target, "http://"+localAddress+"/") {
		return ""
	}
	return target
}

// panelNavigate 需要时把面板翻到另一个页面（对话 ↔ 设置）。
func panelNavigate(hwnd windows.Handle) {
	target := panelTarget()
	if target == "" || target == panelCurrentURL {
		return
	}
	if browser := panelHostBrowser(); browser != nil {
		panelCurrentURL = target
		butterflyPanelChrome(hwnd)
		browser.Navigate(target)
	}
}

// Settings uses the native caption; chat uses its own. Keep the resize and minimize/maximize styles.
func butterflyPanelChrome(hwnd windows.Handle) {
	const gwlStyle = ^uintptr(15) // GWL_STYLE (-16)
	style, _, _ := procPanelStyle.Call(uintptr(hwnd), gwlStyle)
	if next := panelFrameStyle(style, panelCurrentURL); next != style {
		_, _, _ = procPanelSetStyle.Call(uintptr(hwnd), gwlStyle, next)
	}
	_, _, _ = procPanelPlace.Call(uintptr(hwnd), 0, 0, 0, 0, 0, 0x0020|0x0002|0x0001|0x0004|0x0010) // FRAMECHANGED|NOMOVE|NOSIZE|NOZORDER|NOACTIVATE
}

// panelGeometry 用户拖过的窗口位置与大小：下次还按它打开（仍然收口在工作区内）。
type panelGeometry struct {
	X, Y, Width, Height int32
}

func panelGeometryPath(dir string) string { return filepath.Join(dir, butterflyPanelGeometryFile) }

func loadPanelGeometry(dir string) (panelGeometry, bool) {
	data, err := os.ReadFile(panelGeometryPath(dir))
	if err != nil {
		return panelGeometry{}, false
	}
	var geometry panelGeometry
	if json.Unmarshal(data, &geometry) != nil || geometry.Width < butterflyPanelMinWidth || geometry.Height < butterflyPanelMinHeight {
		return panelGeometry{}, false
	}
	return geometry, true
}

// savePanelGeometry 窗口挪完就记下来；写不了就算了，下次用默认位置。
func savePanelGeometry(dir string, hwnd windows.Handle) {
	rect := appuseWinRect{}
	if ok, _, _ := procPanelRect.Call(uintptr(hwnd), uintptr(unsafe.Pointer(&rect))); ok == 0 {
		return
	}
	data, err := json.Marshal(panelGeometry{rect.Left, rect.Top, rect.Right - rect.Left, rect.Bottom - rect.Top})
	if err != nil {
		return
	}
	_ = os.WriteFile(panelGeometryPath(dir), data, 0o600)
}

// butterflyPanelFrame 面板落点：用户拖过就把记住的大小位置当默认（仍收口在工作区内），
// 否则按默认尺寸居中放在工作区里——它是窗口，不再贴着任务栏弹。
func butterflyPanelFrame(anchor, work appuseWinRect, saved *panelGeometry, dpi uint32) (x, y, width, height int32) {
	margin := butterflyScale(butterflyPanelMargin, dpi)
	width, height = butterflyScale(butterflyPanelWidth, dpi), butterflyScale(butterflyPanelHeight, dpi)
	if saved != nil {
		width, height = saved.Width, saved.Height
	}
	if limit := work.Right - work.Left - 2*margin; limit > 0 && width > limit {
		width = limit
	}
	if limit := work.Bottom - work.Top - 2*margin; limit > 0 && height > limit {
		height = limit
	}
	x = work.Left + (work.Right-work.Left-width)/2
	y = work.Top + (work.Bottom-work.Top-height)/2
	// 记住的位置还在工作区里就用它（换显示器/分辨率变小了就回到居中）。
	if saved != nil && saved.X >= work.Left && saved.Y >= work.Top && saved.X+saved.Width <= work.Right && saved.Y+saved.Height <= work.Bottom {
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
	return x, y, width, height
}

// Place the new window once; restoring it from the tray leaves its size and monitor alone.
func panelInitialFrame() (x, y, width, height int32) {
	anchor, work, dpi := butterflyAnchorWork()
	saved, ok := loadPanelGeometry(butterflyPanelDataDir())
	if ok {
		return butterflyPanelFrame(anchor, work, &saved, dpi)
	}
	return butterflyPanelFrame(anchor, work, nil, dpi)
}

// panelClaimForeground 借当前前台的输入状态把面板拿到前台（新进程自己抢会被系统拒）。
func panelClaimForeground(hwnd windows.Handle) {
	fg, _, _ := procPanelForeground.Call()
	self, _, _ := procPanelThread.Call()
	target := uintptr(0)
	if fg != 0 {
		target, _, _ = procPanelOwner.Call(fg, 0)
	}
	attached := false
	if target != 0 && target != self {
		if ok, _, _ := procPanelAttach.Call(self, target, 1); ok != 0 {
			attached = true
		}
	}
	_, _, _ = procPanelForefront.Call(uintptr(hwnd))
	_, _, _ = procPanelFocus.Call(uintptr(hwnd))
	if browser := panelHostBrowser(); browser != nil {
		browser.Focus()
	}
	if attached {
		_, _, _ = procPanelAttach.Call(self, target, 0)
	}
}
