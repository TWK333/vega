//go:build windows

package main

// Shared UI Automation helpers for named control inspection.

import (
	"errors"
	"fmt"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

const (
	uiaBudget       = 2500 * time.Millisecond
	uiaCoInitMTA    = 0x0
	uiaCLSCTXInProc = 0x1
)

// UIA 控件类型（UIAutomationClient.h 的 UIA_*ControlTypeId）。
const (
	uiaButtonType      = 50000
	uiaListItemType    = 50007
	uiaListType        = 50008
	uiaMenuItemType    = 50011
	uiaTabType         = 50018
	uiaTabItemType     = 50019
	uiaToolBarType     = 50021
	uiaCustomType      = 50025
	uiaGroupType       = 50026
	uiaSplitButtonType = 50031
	uiaWindowType      = 50032
	uiaPaneType        = 50033
)

type uiaGUID struct {
	Data1 uint32
	Data2 uint16
	Data3 uint16
	Data4 [8]byte
}

var (
	uiaOle32 = windows.NewLazySystemDLL("ole32.dll")

	procUIACoCreate = uiaOle32.NewProc("CoCreateInstance")
	procUIACoInit   = uiaOle32.NewProc("CoInitializeEx")
	procUIACoUninit = uiaOle32.NewProc("CoUninitialize")

	// CLSID_CUIAutomation / CLSID_CUIAutomation8，IID_IUIAutomation。
	clsUIAutomation  = uiaGUID{0xFF48DBA4, 0x60EF, 0x4201, [8]byte{0xAA, 0x87, 0x54, 0x10, 0x3E, 0xEF, 0x59, 0x4E}}
	clsUIAutomation8 = uiaGUID{0xE22AD333, 0xB25F, 0x460C, [8]byte{0x83, 0xD0, 0x05, 0x81, 0x10, 0x73, 0x95, 0xC9}}
	iidIUIAutomation = uiaGUID{0x30CBE57D, 0xD9D0, 0x452A, [8]byte{0xAB, 0x13, 0x7A, 0xC5, 0xAC, 0x48, 0x25, 0xEE}}

	// 槽位：IUnknown 占 0..2，之后按 UIAutomationClient.h 的声明顺序
	// （用 windows crate 的生成代码核过，cfg 成对的只算一个槽）。
	slotUIAElementFromHandle = 6  // IUIAutomation::ElementFromHandle
	slotUIAControlViewWalker = 14 // IUIAutomation::get_ControlViewWalker（前面还有 CreateTreeWalker）
	slotUIAFirstChild        = 4  // IUIAutomationTreeWalker::GetFirstChildElement
	slotUIANextSibling       = 6  // IUIAutomationTreeWalker::GetNextSiblingElement
	slotUIACurrentProcessID  = 20 // IUIAutomationElement::get_CurrentProcessId
	slotUIACurrentType       = 21 // IUIAutomationElement::get_CurrentControlType
	slotUIACurrentFocusable  = 27 // IUIAutomationElement::get_CurrentIsKeyboardFocusable
	slotUIACurrentOffscreen  = 38 // IUIAutomationElement::get_CurrentIsOffscreen
	slotUIACurrentRect       = 43 // IUIAutomationElement::get_CurrentBoundingRectangle
)

func uiaFailed(result uintptr) error {
	if int32(result) < 0 {
		return fmt.Errorf("hr=0x%x", uint32(result))
	}
	return nil
}

func uiaCreate() (unsafe.Pointer, error) {
	for _, class := range []*uiaGUID{&clsUIAutomation8, &clsUIAutomation} {
		var automation unsafe.Pointer
		result, _, _ := procUIACoCreate.Call(
			uintptr(unsafe.Pointer(class)), 0, uiaCLSCTXInProc,
			uintptr(unsafe.Pointer(&iidIUIAutomation)), uintptr(unsafe.Pointer(&automation)))
		if int32(result) >= 0 && automation != nil {
			return automation, nil
		}
	}
	return nil, errors.New("CoCreateInstance(CUIAutomation) 失败")
}

func uiaInt(element unsafe.Pointer, slot int) (int32, error) {
	var value int32
	if err := uiaFailed(comCall(element, slot, uintptr(unsafe.Pointer(&value)))); err != nil {
		return 0, err
	}
	return value, nil
}

func uiaBool(element unsafe.Pointer, slot int) (bool, error) {
	value, err := uiaInt(element, slot)
	return value != 0, err
}

func uiaRect(element unsafe.Pointer) (appuseWinRect, error) {
	rect := appuseWinRect{}
	err := uiaFailed(comCall(element, slotUIACurrentRect, uintptr(unsafe.Pointer(&rect))))
	return rect, err
}

// uiaRelative 取第一个子元素 / 下一个兄弟；返回 nil 表示到头了。
func uiaRelative(walker, element unsafe.Pointer, first bool) (unsafe.Pointer, error) {
	slot := slotUIANextSibling
	if first {
		slot = slotUIAFirstChild
	}
	var child unsafe.Pointer
	err := uiaFailed(comCall(walker, slot, uintptr(element), uintptr(unsafe.Pointer(&child))))
	return child, err
}
