# 557. Reverse Words in a String III
#### Published: 26.8.2021

<https://leetcode.com/problems/reverse-words-in-a-string-iii/>

## Overview
Remember beginning of the current word. On space, insert reversed word to array by walking the index back to the word start. Add space and move the word start beyond that space.

After iterating over the string, append reverse version of the last word. Don't add space.

## Code
```python
class Solution:
    def reverseWords(self, s: str) -> str:
        word_start = 0
        output = []
        for i in range(len(s)):
            if s[i] == " ":
                for word_backward_i in range(i - 1, word_start - 1, -1):
                    output.append(s[word_backward_i])
                word_start = i + 1
                output.append(" ")

        for word_backward_i in range(len(s) - 1, word_start - 1, -1):
            output.append(s[word_backward_i])

        return "".join(output)
```
