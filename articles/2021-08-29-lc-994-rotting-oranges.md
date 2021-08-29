# 994. Rotting Oranges
#### Published 29.8.2021

<https://leetcode.com/problems/rotting-oranges/>

## Overview
BFS by layers, remembering the layer count.

## Code
```python
FRESH = 1
ROTTEN = 2
DIRS = [(1, 0), (-1, 0), (0, 1), (0, -1)]

class Solution:
    def inBounds(self, x: int, y: int, array: List[List[int]]) -> bool:
        return 0 <= x < len(array) and 0 <= y < len(array[x])

    def orangesRotting(self, grid: List[List[int]]) -> int:
        rotten = deque([])
        fresh_count = 0
        for x in range(len(grid)):
            for y in range(len(grid[0])):
                if grid[x][y] == ROTTEN:
                    rotten.append((x, y))
                elif grid[x][y] == FRESH:
                    fresh_count += 1

        elapsed = 0
        while len(rotten) > 0 and fresh_count > 0:
            elapsed += 1
            for _ in range(len(rotten)):  # one layer
                x, y = rotten.popleft()
                for delta_x, delta_y in DIRS:
                    new_x, new_y = x + delta_x, y + delta_y
                    if self.inBounds(new_x, new_y, grid) and grid[new_x][new_y] == FRESH:
                        fresh_count -= 1
                        grid[new_x][new_y] = ROTTEN
                        rotten.append((new_x, new_y))

        if fresh_count > 0:
            return -1
        return elapsed
```

## Notes
Initially I used slightly more cumbersome version with two deques: In each layer saving new ones to second queue. After layer is over, current layer points to new and new is emptied.

But the solution is more elegant way of the same idea.
