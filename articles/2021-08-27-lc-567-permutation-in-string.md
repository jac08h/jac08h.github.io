# 567. Permutation in String
#### Published 27.8.2021

<https://leetcode.com/problems/permutation-in-string/>

## Overview
Observation: String `A` is permutation of string `B` if `A` contains every character exactly number of times as it occurs in `B`.

---

Create character count of `s1`.
Use two pointers to mark sliding window of the current string. 

Iterate over `s2`. If char fits to the permutation, move the window to right, and subtract 1 from that character's count. If no more character is missing, return True.

If char doesn't fit, reset the whole window, moving `first` behind the wrong char. Restore character count along the way.
> Note here that the 'wrong' char might be found at sooner index as `last`. 
> This occurs when a) character occurs in the permutation but
> b) it has already been filled.
>
> What happens then is we remove its first occurence (and all elements before it), and include its new occurence.
>
> Example: a[bcd]cxyz  -> abc[dc]xyz

## Code
```python
class Solution:
    def checkInclusion(self, s1: str, s2: str) -> bool:
        char_count = {}
        for right in s1:
            char_count[right] = char_count.get(right, 0) + 1

        missing_chars = len(s1)
        left = right = 0
        while right < len(s2):
            right_ch = s2[right]
            if right_ch in char_count and char_count[right_ch] > 0:
                char_count[right_ch] -= 1
                missing_chars -= 1
                if missing_chars == 0:
                    return True
            else:
                while s2[left] != right_ch:
                    char_count[s2[left]] += 1
                    missing_chars += 1
                    left += 1
                left += 1
            right += 1

        return False
```
