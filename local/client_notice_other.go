//go:build !windows

package main

func clientTrayNotice(*clientNotice)   {}
func clientConfirm(chan<- string) bool { return false }
