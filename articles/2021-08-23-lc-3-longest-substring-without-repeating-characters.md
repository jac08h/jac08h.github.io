# 3. Longest Substring Without Repeating Characters
#### Published: 23.8.2021

<https://leetcode.com/problems/longest-substring-without-repeating-characters/>

## My solution overview
Naive solution: starting from each index, iterate over the rest of the string, keeping seen chars in a set. If already seen char is found, note the length.

Complexity: O(n^2)

After a hint, I found out that a **'Sliding Window'** technique makes it possible to solve this problem in O(n) time.
It works by always keeping two indexes in the string, and moving them accordingly.
In this problem:

* Initialize *first* and *last* index to 0
* Initialize an empty set that will contain characters in this window.
* Until encountering the last character:
	* If character wasn't seen, add it to the set and move the 'last' index. Update max_length if appropriate.
	* If the character 'ch' was seen, move the 'start' index until we find the first occurrence of the 'ch'. Remove chars from set as they fall out of the window.
		* Remove the first occurrence as well
			

## Code
```python
class Solution:
    def lengthOfLongestSubstring(self, s: str) -> int:
        first = last = max_length = 0
        seen = set()
        while last < len(s):
            ch = s[last]
            if ch not in seen:
                seen.add(ch)
                last += 1
                max_length = max(max_length, last - first)
            else:
                while s[first] != ch:
                    seen.remove(s[first])
                    first += 1
                seen.remove(s[first])
                first += 1

        return max_length
```

## Takeaways
I didn't know about the sliding window technique. I like it, it's intuitive and straight-forward.
