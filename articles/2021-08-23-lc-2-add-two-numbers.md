# 2. Add Two Numbers
#### Published: 23.8.2021
<https://leetcode.com/problems/add-two-numbers/>

## My solution overview
Iterate over digits of two numbers while at least one digit exists, or there is carry-over.
Add the values and the possible carry and store them in result node.
In the end, discard possible trailing zero.

Note: carry can't be more than one, since all numbers are only single digit. Max.: 9 + 9, with carry 1 = 19 -> 9, carry 1. That's why I saved it as bool, not an integer.

## Code
```python
class Solution:
    def addTwoNumbers(self, l1: Optional[ListNode], l2: Optional[ListNode]) -> Optional[ListNode]:
        current = ListNode()
        start = current
        parent = None
        carry_flag = False
        a_node = l1
        b_node = l2
        while a_node is not None or b_node is not None or carry_flag:
            a_value = 0 if a_node is None else a_node.val
            b_value = 0 if b_node is None else b_node.val

            result = a_value + b_value
            if carry_flag:
                result += 1

            current.val = result % 10
            carry_flag = result >= 10

            new = ListNode()
            current.next = new
            parent = current
            current = new

            a_node = None if a_node is None else a_node.next
            b_node = None if b_node is None else b_node.next

        # discard last node if is set to zero and isn't the only number in result
        if current.val == 0 and parent is not None:
            parent.next = None

        return start
```

## Takeaways
In the while loop, I forgot to check for the carry, resulting in an error in examples such as 8 + 7 -> 5, jumping out of the while loop as both numbers ran out of digits, even though there was the carry.
