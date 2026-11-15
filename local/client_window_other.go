//go:build !windows

package main

func clientWindowOpen(string) bool { return false }
func clientWindowRun(string) bool  { return false }
func clientWindowClose()           {}
