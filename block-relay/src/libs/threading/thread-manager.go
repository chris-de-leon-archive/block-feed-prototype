package threading

import (
	"sync"
)

type ThreadManager struct {
	wg sync.WaitGroup
}

func Manager() *ThreadManager {
	return &ThreadManager{}
}

func (this *ThreadManager) Spawn(fn func()) {
	this.wg.Add(1)
	go func() {
		defer this.wg.Done()
		fn()
	}()
}

func (this *ThreadManager) Wait() {
	this.wg.Wait()
}
