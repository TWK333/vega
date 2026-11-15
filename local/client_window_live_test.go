//go:build windows

package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"runtime"
	"testing"

	"golang.org/x/sys/windows"
)

// Opt-in manual native smoke test: close the isolated fixture window to finish.
func TestClientWindowLive(t *testing.T) {
	if os.Getenv("VEGA_TEST_NATIVE_WINDOW") != "1" {
		t.Skip("native window inspection is opt-in")
	}
	t.Setenv("APPDATA", t.TempDir())
	a := &Agent{configToken: "native-fixture"}
	mux := http.NewServeMux()
	a.assistantMount(mux)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case a.assistantPath() + "api/host":
			assistantReply(w, 200, map[string]any{"paired": true, "account": "native-fixture", "version": "test"})
		case a.assistantPath() + "api/threads":
			assistantReply(w, 200, map[string]any{"employees": []map[string]any{{"thread": "employee:fixture", "name": "Native fixture", "mine": true}}, "groups": []any{}})
		case a.assistantPath() + "api/messages":
			assistantReply(w, 200, map[string]any{"messages": []map[string]any{{"seq": 1, "role": "assistant", "text": "Original Grok renderer in the Go WebView2 host.", "at": 1794290000000}}, "lastSeq": 1})
		case a.assistantPath() + "api/read":
			assistantReply(w, 200, map[string]any{"ok": true})
		default:
			mux.ServeHTTP(w, r)
		}
	}))
	defer server.Close()
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	ole := windows.NewLazySystemDLL("ole32.dll")
	hr, _, _ := ole.NewProc("CoInitializeEx").Call(0, 2)
	if int32(hr) < 0 {
		t.Fatalf("COM initialization failed: %x", hr)
	}
	defer ole.NewProc("CoUninitialize").Call()
	if !panelHostStart(server.URL + a.assistantPath()) {
		t.Fatal("native WebView2 host did not start")
	}
}
