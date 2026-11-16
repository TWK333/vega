package main

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestDeviceClientFixture(t *testing.T) {
	if os.Getenv("VEGA_DEVICE_E2E_HELPER") != "1" {
		t.Skip("only used as a subprocess by the native client integration fixture")
	}
	openDeviceAuthorization = func(string) {}
	main()
}

func TestDeviceAuthorizationUsesClientProofAndSavesOnlyAfterApproval(t *testing.T) {
	clientID := strings.Repeat("c", 32)
	requestID, _ := deviceSecret()
	var challenge, verifier, credential string
	approved := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Origin") != "" || r.Method != http.MethodPost {
			t.Errorf("unexpected native request: %s %q", r.Method, r.Header.Get("Origin"))
		}
		var body map[string]string
		_ = json.NewDecoder(r.Body).Decode(&body)
		switch r.URL.Path {
		case "/api/local-agent/device/start":
			challenge = body["challenge"]
			if body["clientId"] != clientID || challenge == "" {
				t.Errorf("invalid start: %v", body)
			}
			_ = json.NewEncoder(w).Encode(map[string]string{"requestId": requestID})
		case "/api/local-agent/device/token":
			verifier, credential = body["verifier"], body["deviceToken"]
			hash := sha256.Sum256([]byte(verifier))
			if body["requestId"] != requestID || body["clientId"] != clientID || base64.RawURLEncoding.EncodeToString(hash[:]) != challenge || credential == verifier {
				t.Error("invalid device proof")
			}
			if !approved {
				t.Error("credential requested before browser confirmation")
			}
			_ = json.NewEncoder(w).Encode(map[string]string{"status": "authorized", "userId": "alice", "clientId": clientID})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()
	path := filepath.Join(t.TempDir(), "config.json")
	a := &Agent{configPath: path, pinnedOrigin: server.URL, config: Config{ClientID: clientID, TrustedOrigins: []string{server.URL}}}
	var opened string
	saved, token, err := a.requestDeviceAuthorization(context.Background(), func(address string) {
		opened = address
		parsed, parseErr := url.Parse(address)
		if parseErr != nil || parsed.Query().Get("client_authorization") != requestID || !strings.HasPrefix(address, server.URL+"/") {
			t.Errorf("wrong browser address: %q %v", address, parseErr)
		}
		if _, statErr := os.Stat(path); !os.IsNotExist(statErr) {
			t.Error("credentials were saved before approval")
		}
		approved = true
	})
	if err != nil || opened == "" || saved.UserID != "alice" || token != credential {
		t.Fatalf("authorization failed: %v user=%q", err, saved.UserID)
	}
	plain, err := unprotectToken(saved.Token)
	if err != nil || plain != credential {
		t.Fatal("device credential was not saved correctly")
	}
	data, err := os.ReadFile(path)
	if err != nil || strings.Contains(string(data), verifier) || strings.Contains(string(data), requestID) {
		t.Fatal("the temporary authorization proof leaked into the configuration")
	}
}

func TestDeviceAuthorizationRejectsDenialAndRedirect(t *testing.T) {
	for _, redirect := range []bool{false, true} {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if redirect {
				w.Header().Set("Location", "https://evil.example/")
				w.WriteHeader(http.StatusFound)
				return
			}
			if r.URL.Path == "/api/local-agent/device/start" {
				id, _ := deviceSecret()
				_ = json.NewEncoder(w).Encode(map[string]string{"requestId": id})
			} else {
				_ = json.NewEncoder(w).Encode(map[string]string{"status": "denied"})
			}
		}))
		path := filepath.Join(t.TempDir(), "config.json")
		a := &Agent{configPath: path, pinnedOrigin: server.URL, config: Config{ClientID: strings.Repeat("c", 32)}}
		opened := false
		_, _, err := a.requestDeviceAuthorization(context.Background(), func(string) { opened = true })
		server.Close()
		if err == nil || opened == redirect {
			t.Fatalf("redirect=%v opened=%v error=%v", redirect, opened, err)
		}
		if _, err = os.Stat(path); !os.IsNotExist(err) {
			t.Fatal("a denial or redirect must not save credentials")
		}
	}
}
