# 704. Binary Search
#### Published: 24.8.2021

<https://leetcode.com/problems/binary-search/>

## Overview
Basic [Binary search](https://en.wikipedia.org/wiki/Binary_search_algorithm). 

## Code
```python
class Solution:
    def search(self, nums: List[int], target: int) -> int:
        low = 0
        high = len(nums) - 1
        while low <= high:
            mid = (low + high) // 2
            value = nums[mid]
            if value == target:
                return mid
            elif value < target:
                low = mid + 1
            else:
                high = mid - 1
        return -1
```

## Notes
I used to get confused about whether increment/decrement the low/high pointer when assigning it to mid. A simple guide is to be clear about whether the range is inclusive or exclusive. In this case, it's inclusive. Therefore, `low` is the first possible index that can contain the `target`, and `high` is the last. 

If we find out that `mid` isn't the target, we don't include it in this inclusive range. It's necessary to move the pointer one step behind the `mid`.
