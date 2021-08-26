# 167. Two Sum II - Input array is sorted
#### Published 26.8.2021

<https://leetcode.com/problems/two-sum-ii-input-array-is-sorted>

## Overview
Sorted variant of [1. Two Sum](/articles/2021-08-22-lc-1-two-sums).
* Two pointers:
	* a) proceeds to numbers of **increasing** size, starts at the beginning of an array
	* b) proceeds to numbers of **decreasing** size, starts at the and of an array


Determine which step to take based on the difference between sum and the target.

## Code
```python
class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        small = 0
        big = len(nums) - 1
        while small < big:
            result = nums[small] + nums[big]
            if result == target:
                return [small + 1, big + 1]
            elif result < target:
                small += 1
            else:
                big -= 1
        return []
```
