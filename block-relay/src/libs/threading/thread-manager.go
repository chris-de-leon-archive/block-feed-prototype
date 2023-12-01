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

func (threadManager *ThreadManager) Spawn(fn func()) {
	threadManager.wg.Add(1)
	go func() {
		defer threadManager.wg.Done()
		fn()
	}()
}

func (threadManager *ThreadManager) Wait() {
	threadManager.wg.Wait()
}
