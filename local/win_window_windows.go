//go:build windows

package main

import (
	"golang.org/x/sys/windows"
)

var winUser32 = windows.NewLazySystemDLL("user32.dll")
var winKernel32 = windows.NewLazySystemDLL("kernel32.dll")
var procClientRect = winUser32.NewProc("GetClientRect")
var procWinDPI = winUser32.NewProc("GetDpiForSystem")

type winWindowClass struct {
	Size, Style                        uint32
	Procedure                          uintptr
	ClsExtra, WndExtra                 int32
	Instance, Icon, Cursor, Background windows.Handle
	MenuName, ClassName                *uint16
	IconSmall                          windows.Handle
}

type winMessage struct {
	Hwnd           windows.Handle
	Message        uint32
	WParam, LParam uintptr
	Time           uint32
	Point          appuseWinPoint
	Private        uint32
}

func winUTF16(text string) *uint16 {
	value, err := windows.UTF16PtrFromString(text)
	if err != nil {
		value, _ = windows.UTF16PtrFromString("")
	}
	return value
}
func winDPI() uint32 {
	if dpi, _, _ := procWinDPI.Call(); dpi >= 96 {
		return uint32(dpi)
	}
	return 96
}
func winScale(value int32, dpi uint32) int32 { return value * int32(dpi) / 96 }
