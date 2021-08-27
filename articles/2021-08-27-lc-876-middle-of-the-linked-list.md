# 876. Middle of the Linked List
#### Published 27.8.2021

<https://leetcode.com/problems/middle-of-the-linked-list/>

## Overview
Obvious solution: first determine the length, then return middle.
How to it in one pass? 
Notice that middle element of a linked list changes every second time the end moves.

```
[1]
1 [2]
1 [2] 3
1 2 [3] 4
1 2 [3] 4 5
1 2 3 [4] 5 6
1 2 3 [4] 5 6 7
```
I used a bool to change the middle on every second step in my solution. **(a)**

However, this observation can be expressed much more elegantly: Have two pointers, one *'slow'* and one *'fast'*. For every step of *'slow'*, *'fast'* makes two.
This way, *'slow'* always points to the middle of an array. **(b)**

## Code
a)
```python
class Solution:
    def middleNode(self, head: Optional[ListNode]) -> Optional[ListNode]:
        if head is None:
            return None
        middle = head
        current = head
        change_middle = False
        while current is not None:
            if change_middle:
                middle = middle.next
            change_middle = not change_middle
            current = current.next
        return middle
```

b) 
```python
class Solution:
    def middleNode(self, head: Optional[ListNode]) -> Optional[ListNode]:
        slow = fast = head
        while fast is not None and fast.next is not None:
            slow = slow.next
            fast = fast.next.next
        return slow
```

## Notes
After arriving at correct solution, take a few moments to think if the core idea or observation cannot be conveyed in more simple and expressive terms. 

Don't get caught in the specific wording you used to discover it.
