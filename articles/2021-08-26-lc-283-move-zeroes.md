# 283. Move Zeroes
#### Published 26.8.2021
<https://leetcode.com/problems/move-zeroes/>

## Overview
Divide array to *finished* and *not finished* parts by an index `first_not_finished`.
In finished part, store all non-zero as they are encountered.

Iterate over array.
If a number is non-zero, write it on `first_not_finished`, and move that index.
On zero, do nothing.

After the iteration is completed, fill the whole *not finished* part with zeroes. 
> Because upon every zero encounter, the size of *finished* part stays the same even though there's new element. Consequently, size of *not finished* increases by one for every 0.

## Code
```python
class Solution:
    def moveZeroes(self, nums: List[int]) -> None:
        """
        Do not return anything, modify nums in-place instead.
        """
        first_not_finished = 0
        for i in range(len(nums)):
            if nums[i] != 0:
                nums[first_not_finished] = nums[i]
                first_not_finished += 1

        for i in range(first_not_finished, len(nums)):
            nums[i] = 0
```

## Notes
In my first solution, along with an index to *not finished* part I kept an additional counter of zeroes, and used that to determine how many of them to write to end. This piece of information was redundant.
