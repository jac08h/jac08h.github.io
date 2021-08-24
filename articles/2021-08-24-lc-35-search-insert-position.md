# 35. Search Insert Position
#### Published: 24.8.2021

<https://leetcode.com/problems/search-insert-position/>

## Overview
Binary search variant. When a classic BS finishes without finding the target value, pointers look like:
* `high` = **last smaller** value than `target`
	* -1 if there is no smaller value
* `low` = **first bigger** value than `target`
	* `high` + 1
	* n + 1 if there is no bigger value
		* *n = index of last element*

Instead of returning `NOT_FOUND`, return `low`.

## Code
```python
class Solution:
    def searchInsert(self, nums: List[int], target: int) -> int:
        low = 0
        high = len(nums) - 1
        while low <= high:
            mid = (low + high) // 2
            if nums[mid] == target:
                return mid
            elif nums[mid] < target:
                low = mid + 1
            else:
                high = mid - 1
        return low
```
