# 21. Merge Two Sorted Lists
#### Published 31.8.2021

<https://leetcode.com/problems/merge-two-sorted-lists/>

## Code
```python
class Solution:
    def mergeTwoLists(self, l1: Optional[ListNode], l2: Optional[ListNode]) -> Optional[ListNode]:
        if l1 is None and l2 is None:
            return None

        if l2 is None or (l1 is not None and l1.val < l2.val):
            head = l1
            l1 = l1.next
        else:
            head = l2
            l2 = l2.next

        last = head
        while l1 and l2:
            if l1.val < l2.val:
                last.next = l1
                l1 = l1.next
            else:
                last.next = l2
                l2 = l2.next
            last = last.next

        # append whole remaining list to the end
        last.next = l2 if l1 is None else l1
        return head
```
