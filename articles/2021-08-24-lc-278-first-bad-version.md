# 278. First Bad Version
#### Published: 24.8.2021

<https://leetcode.com/problems/first-bad-version/>

## Overview
A variant of [binary search](/articles/2021-08-24-lc-704-binary-search).
I modified the algorithm to look for either pair of
* **...,GOOD,\*BAD\*,…**
* **(start),\*BAD\*,…**

where index of value between \*\* is the result.

## Code
```python
class Solution:
    def firstBadVersion(self, n):
        low = 1
        high = n
        while low <= high:
            mid = (low + high) // 2
            if isBadVersion(mid):
                if mid == 1 or not isBadVersion(mid - 1):
                    return mid
                high = mid - 1
            else:
                low = mid + 1
        return -1
```

## Notes
Simpler solution: In an umodified BS, after jumping out of while loop, `low` is the first bad version and `high` is the last good version. Returning `low` in the end is correct.
