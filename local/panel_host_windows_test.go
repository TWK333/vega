//go:build windows

package main

import (
	"runtime"
	"testing"

	"golang.org/x/sys/windows"
)

func TestPanelCaptionFollowsPage(t *testing.T) {
	const flags = 0x00CF0000 | 0x02000000 | 0x10000000 // WS_OVERLAPPEDWINDOW | WS_CLIPCHILDREN | WS_VISIBLE
	chat := "http://" + localAddress + "/assistant/fixture/" + assistantGrokPath
	settings := "http://" + localAddress + "/config/fixture?account=1"
	style := panelFrameStyle(flags, chat)
	if style != flags&^panelWSCaption {
		t.Fatalf("chat style %#x must remove only WS_CAPTION", style)
	}
	if restored := panelFrameStyle(style, settings); restored != flags {
		t.Fatalf("settings style %#x must restore the native caption", restored)
	}
}

func TestPanelNativeCaptionBeforeShow(t *testing.T) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	previous := panelCurrentURL
	defer func() { panelCurrentURL = previous }()
	chat := "http://" + localAddress + "/assistant/fixture/" + assistantGrokPath
	panelCurrentURL = chat
	hwnd, err := panelCreateWindow(chipWindowClass{ClassName: butterflyUTF16("STATIC")}, 0, 0, 640, 480)
	if hwnd == 0 {
		t.Fatal(err)
	}
	defer procChipDestroy.Call(hwnd)
	const controls = 0x000F0000 // WS_THICKFRAME | WS_SYSMENU | WS_MINIMIZEBOX | WS_MAXIMIZEBOX
	const visible = 0x10000000
	check := func(page string, want uintptr) {
		t.Helper()
		style, _, _ := procPanelStyle.Call(hwnd, ^uintptr(15)) // GWL_STYLE
		if got := style & (panelWSCaption | controls | visible); got != want {
			t.Fatalf("%s: window style %#x; want %#x (caption, controls and visibility)", page, got, want)
		}
	}
	check("new chat", controls)
	panelCurrentURL = "http://" + localAddress + "/config/fixture"
	butterflyPanelChrome(windows.Handle(hwnd))
	check("settings", panelWSCaption|controls)
	panelCurrentURL = chat
	butterflyPanelChrome(windows.Handle(hwnd))
	check("back to chat", controls)
}

func TestPanelResizeEdges(t *testing.T) {
	// Physical pixels on a secondary monitor to the left, at 150% scaling.
	frame := appuseWinRect{Left: -800, Top: 10, Right: -200, Bottom: 610}
	margin := butterflyScale(panelResizeMargin, 144)
	for _, edge := range []struct {
		x, y int32
		hit  uintptr
	}{
		{-792, 300, 10}, {-209, 300, 11}, {-500, 18, 12},
		{-792, 18, 13}, {-209, 18, 14}, {-500, 601, 15},
		{-792, 601, 16}, {-209, 601, 17}, {-791, 19, 1},
	} {
		if got := panelResizeHit(frame, edge.x, edge.y, margin); got != edge.hit {
			t.Errorf("(%d,%d) hit %d, want %d", edge.x, edge.y, got, edge.hit)
		}
	}
}
