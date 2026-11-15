//go:build windows

package main

// Electron's Windows renderer reserves this native overlay instead of drawing caption buttons in DOM.
import (
	"encoding/json"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

var panelCaption struct {
	buttons                [3]windows.Handle
	font                   uintptr
	background, foreground uint32
	hover                  windows.Handle
}
var panelGDI = windows.NewLazySystemDLL("gdi32.dll")
var panelComctl = windows.NewLazySystemDLL("comctl32.dll")
var panelCaptionSubclass uintptr

func panelCaptionInit(hwnd windows.Handle) {
	panelCaptionSubclass = syscall.NewCallback(panelCaptionProc)
	panelCaption.background, panelCaption.foreground = 0xffffff, 0x202020
	panelCaptionFont()
	for i, title := range []string{"Minimize", "Maximize", "Close"} {
		button, _, _ := winUser32.NewProc("CreateWindowExW").Call(0, uintptr(unsafe.Pointer(winUTF16("BUTTON"))), uintptr(unsafe.Pointer(winUTF16(title))), 0x5000000b, 0, 0, 0, 0, uintptr(hwnd), uintptr(100+i), 0, 0) // CHILD|VISIBLE|BS_OWNERDRAW
		panelCaption.buttons[i] = windows.Handle(button)
		panelComctl.NewProc("SetWindowSubclass").Call(button, panelCaptionSubclass, 1, 0)
	}
	panelCaptionPlace()
}

func panelCaptionFont() {
	if panelCaption.font != 0 {
		panelGDI.NewProc("DeleteObject").Call(panelCaption.font)
	}
	font, _, _ := panelGDI.NewProc("CreateFontW").Call(uintptr(winScale(-10, panelDPI())), 0, 0, 0, 400, 0, 0, 0, 1, 0, 0, 5, 0, uintptr(unsafe.Pointer(winUTF16("Segoe MDL2 Assets"))))
	panelCaption.font = font
}

func panelCaptionPlace() {
	var rect appuseWinRect
	procClientRect.Call(uintptr(panelHandle), uintptr(unsafe.Pointer(&rect)))
	dpi := panelDPI()
	width, height := winScale(46, dpi), winScale(51, dpi)
	for i, button := range panelCaption.buttons {
		procPanelPlace.Call(uintptr(button), 0, uintptr(rect.Right-int32(3-i)*width), 0, uintptr(width), uintptr(height), 0x0040) // above WebView2, not a second title bar
	}
}

func panelCaptionProc(hwnd windows.Handle, message uint32, wparam, lparam, id, data uintptr) uintptr {
	switch message {
	case 0x0200: // WM_MOUSEMOVE
		if panelCaption.hover != hwnd {
			panelCaption.hover = hwnd
			track := struct {
				Size, Flags uint32
				Hwnd        windows.Handle
				Time        uint32
			}{Flags: 2, Hwnd: hwnd}
			track.Size = uint32(unsafe.Sizeof(track))
			winUser32.NewProc("TrackMouseEvent").Call(uintptr(unsafe.Pointer(&track)))
			winUser32.NewProc("InvalidateRect").Call(uintptr(hwnd), 0, 0)
		}
	case 0x02a3: // WM_MOUSELEAVE
		if panelCaption.hover == hwnd {
			panelCaption.hover = 0
		}
		winUser32.NewProc("InvalidateRect").Call(uintptr(hwnd), 0, 0)
	case 0x0082:
		panelComctl.NewProc("RemoveWindowSubclass").Call(uintptr(hwnd), panelCaptionSubclass, id)
	}
	result, _, _ := panelComctl.NewProc("DefSubclassProc").Call(uintptr(hwnd), uintptr(message), wparam, lparam)
	return result
}

func panelCaptionDraw(lparam uintptr) bool {
	item := *(**struct {
		Type, ID, ItemID, Action, State uint32
		Hwnd, DC                        windows.Handle
		Rect                            appuseWinRect
		Data                            uintptr
	})(unsafe.Pointer(&lparam))
	if item.Type != 4 || item.ID < 100 || item.ID > 102 {
		return false
	}
	background, foreground := panelCaption.background, panelCaption.foreground
	if panelCaption.hover == item.Hwnd || item.State&1 != 0 {
		if item.ID == 102 {
			background, foreground = 0x2311e8, 0xffffff
		} else {
			// Windows caption hover is a translucent ink fill over the title-bar tone.
			background = ((background & 0xfefefe) >> 1) + ((foreground & 0xfefefe) >> 1)
			background = ((background & 0xfcfcfc) >> 2) + (((panelCaption.background & 0xfcfcfc) >> 2) * 3)
		}
	}
	brush, _, _ := panelGDI.NewProc("CreateSolidBrush").Call(uintptr(background))
	winUser32.NewProc("FillRect").Call(uintptr(item.DC), uintptr(unsafe.Pointer(&item.Rect)), brush)
	panelGDI.NewProc("DeleteObject").Call(brush)
	old, _, _ := panelGDI.NewProc("SelectObject").Call(uintptr(item.DC), panelCaption.font)
	panelGDI.NewProc("SetBkMode").Call(uintptr(item.DC), 1)
	panelGDI.NewProc("SetTextColor").Call(uintptr(item.DC), uintptr(foreground))
	glyph := []string{"\ue921", "\ue922", "\ue8bb"}[item.ID-100]
	if item.ID == 101 {
		if zoomed, _, _ := winUser32.NewProc("IsZoomed").Call(uintptr(panelHandle)); zoomed != 0 {
			glyph = "\ue923"
		}
	}
	winUser32.NewProc("DrawTextW").Call(uintptr(item.DC), uintptr(unsafe.Pointer(winUTF16(glyph))), 1, uintptr(unsafe.Pointer(&item.Rect)), 0x25) // CENTER|VCENTER|SINGLELINE
	panelGDI.NewProc("SelectObject").Call(uintptr(item.DC), old)
	return true
}

func panelCaptionColors(text json.RawMessage) {
	var colors struct{ Background, Foreground [3]uint8 }
	if json.Unmarshal(text, &colors) != nil {
		return
	}
	panelCaption.background = uint32(colors.Background[0]) | uint32(colors.Background[1])<<8 | uint32(colors.Background[2])<<16
	panelCaption.foreground = uint32(colors.Foreground[0]) | uint32(colors.Foreground[1])<<8 | uint32(colors.Foreground[2])<<16
	for _, button := range panelCaption.buttons {
		winUser32.NewProc("InvalidateRect").Call(uintptr(button), 0, 0)
	}
}
