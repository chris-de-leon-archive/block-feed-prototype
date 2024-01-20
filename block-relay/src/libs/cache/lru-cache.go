package cache

import (
	"container/list"
	"time"
)

type Node[K any, V any] struct {
	Key       K
	Value     V
	ExpiresAt time.Time
}

type LRUCache[K comparable, V any] struct {
	Cache    map[K]*list.Element
	List     *list.List
	Capacity uint64
}

func NewLRUCache[K comparable, V any](capacity uint64) *LRUCache[K, V] {
	return &LRUCache[K, V]{
		Capacity: capacity,
		Cache:    make(map[K]*list.Element),
		List:     list.New(),
	}
}

func (c *LRUCache[K, V]) Put(key K, value V, ttl time.Duration) {
	// If the key already exists in the cache:
	//  1. overwrite the existing value in the cache
	//  2. move it to the front of the list (front = most recently used)
	if node, ok := c.Cache[key]; ok {
		node.Value.(*Node[K, V]).Value = value
		node.Value.(*Node[K, V]).ExpiresAt = time.Now().Add(ttl)
		c.List.MoveToFront(node)
		return
	}

	// If the key does not exist in the cache:
	//  1. create a new node
	//  2. add the node to the cache
	//  3. move the node to the front of the list
	c.Cache[key] = c.List.PushFront(&Node[K, V]{
		Key:   key,
		Value: value,
	})

	// If the cache/list is now over capacity:
	//  1. get the least recently used node (i.e. the last item in the list)
	//  2. delete the node from the cache
	//  3. remove the last item in the list
	if uint64(len(c.Cache)) > c.Capacity {
		tail := c.List.Back()
		delete(c.Cache, tail.Value.(*Node[K, V]).Key)
		c.List.Remove(tail)
	}
}

func (c *LRUCache[K, V]) Get(key K) *V {
	// If the key exists:
	//  1. check if it is expired - if it is remove the corresponding node from the cache and list
	//  2. if it is not expired, move the node to the front of the list and return the value
	if node, ok := c.Cache[key]; ok {
		if time.Now().After(node.Value.(*Node[K, V]).ExpiresAt) {
			delete(c.Cache, key)
			c.List.Remove(node)
			return nil
		}
		c.List.MoveToFront(node)
		return &node.Value.(*Node[K, V]).Value
	}

	// If the key does not exist, return nil
	return nil
}
