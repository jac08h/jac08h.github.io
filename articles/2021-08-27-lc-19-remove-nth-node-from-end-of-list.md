# 19. Remove Nth Node From End of List
#### Published: 27.8.2021

<https://leetcode.com/problems/remove-nth-node-from-end-of-list/>

## Overview
Two pointers. One will point to the `end` (so far discovered), other to the element `to_remove`, if the `end` was actual end.
To initialize these pointers, fix `to_remove` to start, and step `end` until distance between them is `n`.

Afterwards, move them simultaneously until the `end` is an actual end. Then remove `to_remove`.

```
1 2 3 4 5 6 7
[[1]] 2 3 4 5 6  - find the correct distance
[1] [2] 3 4 5 6
[1] 2 [3] 4 5 6 
1 [2] 3 [4] 5 6  - move both pointers ends until right points to end
1 2 [3] 4 [5] 6 
1 2 3 [4] 5 [6]
```

You can imagine this process like creating a chain between these two elements. The left end is initially fixed to first element, while we place the right end to an element in appropriate distance. After we've found it, we can only move both chain ends by same step, keeping the distance intact. After right end is on last element, left end of the chain points to the one that has to be removed.

> Implementation notes: to be able to remove the element in the end, it's necessary to remember its parent - previous element.


## Code
```python
class Solution:
    def removeNthFromEnd(self, head: Optional[ListNode], n: int) -> Optional[ListNode]:
        if head is None:
            return None
        to_remove = end = head
        distance = 0
        while distance < n - 1:
            end = end.next
            distance += 1

        parent = None
        while end.next is not None:
            to_remove = to_remove.next
            end = end.next
            if parent is None:
                parent = head
            else:
                parent = parent.next

        if parent is None:  # removing first
            return to_remove.next
        parent.next = to_remove.next
        return head
```

> Idea: For parent, use 'dummy' head, point it to start, then move it. Avoids 'parent is None' check.
