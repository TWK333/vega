package main

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// 任务工作区清单：只列业务文件，依赖/构建产物/凭据不参与交接。
// 与服务端 shared/workspace-sync.mjs 的排除规则保持一致。
// 超限文件放进 skipped（单个过大或总量放不下），其余文件照常返回；整次交接仍由服务端拒绝带 skipped 的清单。
const (
	maxSyncFiles    = 2000
	maxSyncFileSize = 4 << 20
	maxSyncBytes    = 16 << 20
)

var skippedDirs = map[string]bool{
	".git": true, "node_modules": true, ".venv": true, "venv": true, "dist": true, "build": true,
	"out": true, "target": true, "bin": true, ".next": true, ".nuxt": true, ".cache": true,
	"__pycache__": true, ".gradle": true, ".pytest_cache": true, ".ssh": true, ".aws": true,
}

var skippedSuffixes = []string{".pem", ".key", ".pfx", ".p12", ".keystore"}

var skippedNames = map[string]bool{".npmrc": true, ".netrc": true, "id_rsa": true}

func skipSyncPath(name, rel string) bool {
	if skippedDirs[name] || skippedNames[name] {
		return true
	}
	if strings.HasPrefix(name, ".env") {
		return true
	}
	lower := strings.ToLower(rel)
	for _, suffix := range skippedSuffixes {
		if strings.HasSuffix(lower, suffix) {
			return true
		}
	}
	return false
}

// shortcut: another local process can race these checks; use handle-relative writes on hostile shared machines.
func writeWorkspace(root, relative string, data []byte, expected string) (string, error) {
	path := filepath.Clean(relative)
	if root == "" || relative == "" || path == "." || path == ".." || filepath.IsAbs(path) || filepath.VolumeName(path) != "" || strings.HasPrefix(path, ".."+string(filepath.Separator)) || strings.ContainsRune(path, 0) {
		return "", errors.New("交接文件必须位于工作区内")
	}
	for _, part := range strings.Split(filepath.ToSlash(relative), "/") {
		if part == ".." {
			return "", errors.New("交接文件必须位于工作区内")
		}
	}
	root, err := filepath.Abs(root)
	if err != nil {
		return "", err
	}
	root, err = filepath.EvalSymlinks(root)
	if err != nil {
		return "", err
	}
	if info, err := os.Stat(root); err != nil || !info.IsDir() {
		return "", errors.New("本机工作区不存在")
	}
	parent := root
	if dir := filepath.Dir(path); dir != "." {
		for _, part := range strings.Split(dir, string(filepath.Separator)) {
			parent = filepath.Join(parent, part)
			info, err := os.Lstat(parent)
			if os.IsNotExist(err) {
				if err = os.Mkdir(parent, 0755); err != nil && !os.IsExist(err) {
					return "", err
				}
				info, err = os.Lstat(parent)
			}
			if err != nil || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
				return "", errors.New("交接路径含链接或不是目录")
			}
		}
	}
	target := filepath.Join(parent, filepath.Base(path))
	info, err := os.Lstat(target)
	if expected == "" {
		if err == nil {
			return "", errors.New("目标文件已存在，交接未覆盖")
		}
		if !os.IsNotExist(err) {
			return "", err
		}
	} else {
		if err != nil || !info.Mode().IsRegular() || info.Size() > maxSyncFileSize {
			return "", errors.New("目标文件已变化，交接未覆盖")
		}
		current, err := os.ReadFile(target)
		if err != nil || fmt.Sprintf("%x", sha256.Sum256(current)) != expected {
			return "", errors.New("目标文件已变化，交接未覆盖")
		}
	}
	if err := writeAtomic(target, data); err != nil {
		return "", err
	}
	return target, nil
}

type workspaceCandidate struct {
	rel   string
	size  int64
	mtime int64
}

// listWorkspace 返回相对 root 的文件清单（路径统一用 /，含内容摘要），供服务端做增量检查点。
func listWorkspace(root string) map[string]any {
	abs, err := filepath.Abs(root)
	if err != nil {
		return failure(err.Error())
	}
	st, err := os.Stat(abs)
	if err != nil || !st.IsDir() {
		return failure("cwd must be an existing directory on this machine")
	}
	candidates := make([]workspaceCandidate, 0, 128)
	skipped := make([]map[string]any, 0)
	err = filepath.WalkDir(abs, func(path string, entry fs.DirEntry, walk error) error {
		if walk != nil {
			return nil // 无权限的条目跳过，不让整次清单失败
		}
		rel, relErr := filepath.Rel(abs, path)
		if relErr != nil {
			return nil
		}
		rel = filepath.ToSlash(rel)
		if rel == "." {
			return nil
		}
		if entry.IsDir() {
			if skipSyncPath(entry.Name(), rel) {
				return fs.SkipDir
			}
			return nil
		}
		if !entry.Type().IsRegular() || skipSyncPath(entry.Name(), rel) {
			return nil
		}
		info, infoErr := entry.Info()
		if infoErr != nil {
			return nil
		}
		if info.Size() > maxSyncFileSize {
			skipped = append(skipped, map[string]any{"path": rel, "size": info.Size(), "reason": "文件过大"})
			return nil
		}
		candidates = append(candidates, workspaceCandidate{rel: rel, size: info.Size(), mtime: info.ModTime().UnixMilli()})
		return nil
	})
	if err != nil {
		return failure(err.Error())
	}
	sort.Slice(candidates, func(i, j int) bool { return candidates[i].rel < candidates[j].rel })
	files := make([]map[string]any, 0, len(candidates))
	var total int64
	for _, candidate := range candidates {
		if len(files) >= maxSyncFiles || total+candidate.size > maxSyncBytes {
			skipped = append(skipped, map[string]any{"path": candidate.rel, "size": candidate.size, "reason": "超出交接总量上限"})
			continue
		}
		data, readErr := os.ReadFile(filepath.Join(abs, filepath.FromSlash(candidate.rel)))
		if readErr != nil {
			skipped = append(skipped, map[string]any{"path": candidate.rel, "size": candidate.size, "reason": "无法读取"})
			continue
		}
		if int64(len(data)) > maxSyncFileSize {
			skipped = append(skipped, map[string]any{"path": candidate.rel, "size": len(data), "reason": "文件过大"})
			continue
		}
		if len(files) >= maxSyncFiles || total+int64(len(data)) > maxSyncBytes {
			skipped = append(skipped, map[string]any{"path": candidate.rel, "size": len(data), "reason": "超出交接总量上限"})
			continue
		}
		sum := sha256.Sum256(data)
		total += int64(len(data))
		files = append(files, map[string]any{"path": candidate.rel, "size": len(data), "mtime": candidate.mtime, "hash": hex.EncodeToString(sum[:])})
	}
	sort.Slice(skipped, func(i, j int) bool { return skipped[i]["path"].(string) < skipped[j]["path"].(string) })
	truncated := false
	if len(skipped) > maxSyncFiles {
		truncated = true
		skipped = skipped[:maxSyncFiles]
	}
	return map[string]any{"root": abs, "files": files, "bytes": total, "skipped": skipped, "truncated": truncated}
}
