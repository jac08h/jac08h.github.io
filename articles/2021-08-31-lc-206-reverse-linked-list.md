# 206. Reverse Linked List
#### Published 31.8.2021

<https://leetcode.com/problems/reverse-linked-list/>

## Overview
Change `next` of every node to point to previous one. Remember previous nodes to do it. Save original `next` of node to variable so we know where to continue after `next` is changed.

## Code
#### a) Iterative 
```python
class Solution:
    def reverseList(self, head: Optional[ListNode]) -> Optional[ListNode]:
        if head is None:
            return None
        prev = None
        while head.next is not None:
            new = head.next
            head.next = prev
            prev = head
            head = new
        head.next = prev
        return head
```

#### b) Recursive
```python
class Solution:
    def reverseList(self, head: Optional[ListNode]) -> Optional[ListNode]:
        return self.reverseListRec(head, None)

    def reverseListRec(self, head: Optional[ListNode], prev: Optional[ListNode]) -> Optional[ListNode]:
        if head is None:
            return prev
        new = head.next
        head.next = prev
        return self.reverseListRec(new, head)
```
