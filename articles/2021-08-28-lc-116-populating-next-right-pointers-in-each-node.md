# 116. Populating Next Right Pointers in Each Node
#### Published 28.8.2021

<https://leetcode.com/problems/populating-next-right-pointers-in-each-node/>

## Overview
As we traverse the tree:
* connect left child with right child
* connect right child with left child of next node of current (if exists)
* recursively do the same on both children

Invariants:
* if there exists `next` for a node, it's connected by the time `next` becomes argument of `connect`

## Code
```python
class Solution:
    def connect(self, root: Optional['Node']) -> Optional['Node']:
        if root is None or root.left is None:
            return root

        root.left.next = root.right
        if root.next is not None:
            root.right.next = root.next.left
        root.left = self.connect(root.left)
        root.right = self.connect(root.right)
        return root
```

## Notes
The intuition was that since we don't know parents of the nodes, it has to be solved 'along the way', as we go down the tree.

Drawing was helpful.
