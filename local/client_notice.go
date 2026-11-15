package main

import (
	"sync"
	"time"
)

// Keep safety notices independently of the removed taskbar butterfly.
type clientNotice struct {
	Kind string
	Text string
	At   time.Time
}

var clientNoticeState struct {
	sync.Mutex
	notice *clientNotice
}
var clientNoticeQuiet bool
var clientOpen func()

func clientSnapshot() *clientNotice {
	clientNoticeState.Lock()
	defer clientNoticeState.Unlock()
	return clientNoticeState.notice
}

func clientNotify(kind, text string) {
	clientNoticeState.Lock()
	previous := clientNoticeState.notice
	notice := &clientNotice{kind, text, time.Now()}
	clientNoticeState.notice = notice
	clientNoticeState.Unlock()
	if clientNoticeQuiet {
		return
	}
	clientTrayNotice(notice)
	if kind == "needs_review" && (previous == nil || previous.Kind != kind || previous.Text != text) {
		go alertUser(text)
	}
}

func clientClear() {
	clientNoticeState.Lock()
	clientNoticeState.notice = nil
	clientNoticeState.Unlock()
	if !clientNoticeQuiet {
		clientTrayNotice(nil)
	}
}

func clientClearIfKind(kind string) {
	if notice := clientSnapshot(); notice != nil && notice.Kind == kind {
		clientClear()
	}
}

func clientTaskStatus(kind, text string) {
	if notice := clientSnapshot(); notice != nil && (notice.Kind == "running" || notice.Kind == "needs_review") {
		return
	}
	clientNotify(kind, text)
}

func (a *Agent) assistantURL() string { return a.assistantBase() }
