package main

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"
)

func TestWorkspaceSyncWriteProtectsChangedFiles(t *testing.T) {
	root := t.TempDir()
	write := func(path, content, expected string) map[string]any {
		return fileOperation(fileReq{Op: "sync_write", Cwd: root, Path: path, Content: base64.StdEncoding.EncodeToString([]byte(content)), ExpectedHash: expected})
	}
	if result := write("nested/note.txt", "first", ""); result["error"] != nil {
		t.Fatal(result)
	}
	if result := write("nested/note.txt", "overwrite", ""); result["error"] == nil {
		t.Fatal("an existing file must not be treated as absent")
	}
	if result := write("nested/note.txt", "overwrite", fmt.Sprintf("%x", sha256.Sum256([]byte("wrong")))); result["error"] == nil {
		t.Fatal("a changed file must not be overwritten")
	}
	if result := write("nested/note.txt", "updated", fmt.Sprintf("%x", sha256.Sum256([]byte("first")))); result["error"] != nil {
		t.Fatal(result)
	}
	data, err := os.ReadFile(filepath.Join(root, "nested", "note.txt"))
	if err != nil || string(data) != "updated" {
		t.Fatalf("unexpected content %q: %v", data, err)
	}
	for _, path := range []string{"../outside.txt", "nested/../outside.txt", filepath.Join(root, "absolute.txt")} {
		if result := write(path, "outside", ""); result["error"] == nil {
			t.Fatalf("outside path accepted: %q", path)
		}
	}
}

func TestWorkspaceSyncWriteRejectsSymlinkParents(t *testing.T) {
	root, outside := t.TempDir(), t.TempDir()
	link := filepath.Join(root, "link")
	if err := os.Symlink(outside, link); err != nil {
		if runtime.GOOS != "windows" {
			t.Skipf("cannot create a directory symlink: %v", err)
		}
		if output, junctionErr := exec.Command("cmd", "/c", "mklink", "/J", link, outside).CombinedOutput(); junctionErr != nil {
			t.Skipf("cannot create a directory junction: %v (%s)", junctionErr, output)
		}
	}
	result := fileOperation(fileReq{Op: "sync_write", Cwd: root, Path: "link/escape.txt", Content: base64.StdEncoding.EncodeToString([]byte("outside"))})
	if result["error"] == nil {
		t.Fatal("sync must not follow a symlink parent")
	}
	if _, err := os.Stat(filepath.Join(outside, "escape.txt")); !os.IsNotExist(err) {
		t.Fatalf("sync wrote outside the workspace: %v", err)
	}
}

func TestListWorkspaceKeepsSmallFilesWhenOneIsOversized(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "ok.txt"), []byte("hi"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(root, "node_modules"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "node_modules", "dep.js"), []byte("nope"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, ".env"), []byte("secret"), 0o644); err != nil {
		t.Fatal(err)
	}
	big := make([]byte, maxSyncFileSize+1)
	if err := os.WriteFile(filepath.Join(root, "big.bin"), big, 0o644); err != nil {
		t.Fatal(err)
	}
	result := listWorkspace(root)
	if result["error"] != nil {
		t.Fatal(result["error"])
	}
	files := result["files"].([]map[string]any)
	if len(files) != 1 || files[0]["path"] != "ok.txt" {
		t.Fatalf("files: %#v", files)
	}
	sum := sha256.Sum256([]byte("hi"))
	if files[0]["hash"] != hex.EncodeToString(sum[:]) {
		t.Fatalf("hash: %v", files[0]["hash"])
	}
	skipped := result["skipped"].([]map[string]any)
	if len(skipped) != 1 || skipped[0]["path"] != "big.bin" || skipped[0]["reason"] != "文件过大" {
		t.Fatalf("skipped: %#v", skipped)
	}
}

func TestListWorkspaceSkipsFilesPastTheTotalBudget(t *testing.T) {
	root := t.TempDir()
	payload := make([]byte, maxSyncFileSize)
	for i := 0; i < 4; i++ {
		if err := os.WriteFile(filepath.Join(root, fmt.Sprintf("f%d.bin", i)), payload, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(filepath.Join(root, "z-extra.txt"), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	result := listWorkspace(root)
	if result["error"] != nil {
		t.Fatal(result["error"])
	}
	files := result["files"].([]map[string]any)
	if len(files) != 4 {
		t.Fatalf("included %d files: %#v", len(files), files)
	}
	skipped := result["skipped"].([]map[string]any)
	if len(skipped) != 1 || skipped[0]["path"] != "z-extra.txt" {
		t.Fatalf("skipped: %#v", skipped)
	}
}
