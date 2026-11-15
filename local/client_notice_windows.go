//go:build windows

package main

import (
	"golang.org/x/sys/windows"
	"unsafe"
)

// Native confirmation remains available even when the chat window is closed or WebView2 is missing.
func clientConfirm(answer chan<- string) bool {
	if clientNoticeQuiet {
		return false
	}
	proc := windows.NewLazySystemDLL("user32.dll").NewProc("MessageBoxTimeoutW")
	if proc.Find() != nil {
		return false
	}
	go func() {
		text, _ := windows.UTF16PtrFromString(appuseConfirmText + "\n\n选择「否」表示我在用。")
		title, _ := windows.UTF16PtrFromString("Vega · 要操作这台电脑了")
		result, _, _ := proc.Call(0, uintptr(unsafe.Pointer(text)), uintptr(unsafe.Pointer(title)), 0x00000004|0x00000030|0x00010000, 0, uintptr(appuseConfirmTimeout.Milliseconds()))
		choice := "reject"
		if result == 6 || result == 32000 { // IDYES or the documented MessageBoxTimeout result.
			choice = "allow"
		}
		select {
		case answer <- choice:
		default:
		}
	}()
	return true
}
