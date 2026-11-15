package main

import (
	"strings"
	"testing"
)

// 原生操作提示不会被后来成功的回执冲掉。
func TestClientNoticeKeepsReviewUntilCleared(t *testing.T) {
	clientNoticeQuiet = true
	defer func() { clientClear(); clientNoticeQuiet = false }()

	clientNotify("running", "正在用鼠标键盘操作这台电脑")
	if notice := clientSnapshot(); notice == nil || notice.Kind != "running" {
		t.Fatalf("running notice missing: %+v", notice)
	}
	clientClearIfKind("needs_review")
	if clientSnapshot() == nil {
		t.Fatal("running notice cleared by an unrelated kind")
	}
	appuseAnnounce(map[string]any{"status": "needs_review", "reason": "输入可能已发出"})
	notice := clientSnapshot()
	if notice == nil || notice.Kind != "needs_review" || !strings.Contains(notice.Text, "可能已经部分执行") || !strings.Contains(notice.Text, "输入可能已发出") {
		t.Fatalf("needs_review notice wrong: %+v", notice)
	}
	appuseAnnounce(map[string]any{"status": "executed"})
	if notice := clientSnapshot(); notice == nil || notice.Kind != "needs_review" {
		t.Fatalf("review notice lost: %+v", notice)
	}
	clientClear()
	if clientSnapshot() != nil {
		t.Fatal("notice survived clear")
	}
}

func TestAppuseLongReasonIsShortened(t *testing.T) {
	long := strings.Repeat("点", 400)
	if short := appuseShort(long); len([]rune(short)) != 121 || !strings.HasSuffix(short, "…") {
		t.Fatalf("unexpected shortening: %d runes", len([]rune(short)))
	}
	if short := appuseShort("ok"); short != "ok" {
		t.Fatalf("short text changed: %q", short)
	}
}
