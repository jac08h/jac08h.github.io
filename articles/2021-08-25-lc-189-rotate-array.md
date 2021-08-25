# 189. Rotate Array
#### Published 25.8.2021

<https://leetcode.com/problems/rotate-array/>

## Overview
I struggled with this problem. I made little paper squares with the numbers on them to be able to move the array with my hands.

<img src="/static/paper_array.jpg" width="400" height="225">

* Solutions:
	* 1.
		* Create new empty array. Populate it with the shifted contents of original array. Then, copy the contents of rotated array to the original.
			* `rotated[step, step+1, ...] = original[0, 1, ...]`, and wrap around
			* *O(n)* in space
	* 2.
		* Call `shift_by_one(nums)` recursively until `k` is zero.
		* Taking into account stack of recursive calls, *O(k)* in space.
	* 3.
		* > Hint: One line of thought is based on reversing the array (or parts of it) to obtain the desired result.
		* Notice that size of `k` divides the array in two, with the second part of size `k`, first part of size `n-k`. 
		* These parts exchange places.
		* We can reverse the whole array to get the parts to appropriate place, although the parts themselves are in wrong - reverse - order.
		* After reversing both parts individually, we get the desired result.
		* *O(1)* space, *O(n)* runtime complexity.
		* [Sketch](/static/rotate_array_sketch.png) of the process.

## Code
```python
class Solution():
    def reverse(self, start: int, end: int, array: List[int]) -> None:
        while start <= end:
            array[start], array[end] = array[end], array[start]
            start += 1
            end -= 1

    def rotate_(self, nums: List[int], k: int) -> None:
        if len(nums) == 0:
            return
        k = k % len(nums)
        self.reverse(0, len(nums) - 1, nums)
        self.reverse(0, k - 1, nums)
        self.reverse(k, len(nums) - 1, nums)
```
