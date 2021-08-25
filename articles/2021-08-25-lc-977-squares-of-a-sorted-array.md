# 977. Squares of a Sorted Array
#### Published 25.8.2021

<https://leetcode.com/problems/squares-of-a-sorted-array/>

## Overview
Initialize two pointers: last negative number (smallest), first non-negative number. 
Then, always choose the number with smaller absolute value, similarly to `merge` in **Merge Sort**.

Compare absolute values of both numbers. Add the square of the smaller to result. Move the pointer behind the used number. Repeat until all numbers are squared.

## Code
```python
class Solution:
    def checkBounds(self, array: List[Any], index: int):
        return index >= 0 and index < len(array)

    def sortedSquares(self, nums: List[int]) -> List[int]:
        positive_index = len(nums)
        for i in range(len(nums)):
            if nums[i] > 0:
                positive_index = i
                break
        negative_index = positive_index - 1

        sorted_squares = []
        while len(sorted_squares) < len(nums):
            # more pythonic: try/except IndexError block
            if self.checkBounds(nums, negative_index) and self.checkBounds(nums, positive_index):
                move_positive = abs(nums[negative_index]) > nums[positive_index]
            else:
                move_positive = self.checkBounds(nums, positive_index)

            if move_positive:
                n = nums[positive_index]
                positive_index += 1
            else:
                n = nums[negative_index]
                negative_index -= 1
            sorted_squares.append(n * n)

        return sorted_squares
```

## Notes
`n*n` is significantly faster than `n**2`.

To find the initial indexes, binary search could be employed, making the search *O(log n)*. However, overall complexity would stay *O(n)* because it's necessary to pick and square every number.
