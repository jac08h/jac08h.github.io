# 695. Max Area of Island
#### Published 28.8.2021

<https://leetcode.com/problems/max-area-of-island/>
## Overview
DFS. On every unvisited land node, search in 4 directions for continuation of that land.

## Code
```python
class Solution:
    def inBounds(self, x: int, y: int, array: List[List[int]]) -> bool:
        return 0 <= x < len(array) and 0 <= y < len(array[x])

    def maxAreaOfIsland(self, grid: List[List[int]]) -> int:
        visited = set()
        max_area = 0
        for x in range(len(grid)):
            for y in range(len(grid[0])):
                max_area = max(max_area, self.area(x, y, grid, visited))

        return max_area

    def area(self, x: int, y: int, grid: List[List[int]], visited: Set[Tuple[int, int]]):
        if not self.inBounds(x, y, grid) or (x, y) in visited or grid[x][y] == 0:
            return 0
        visited.add((x, y))
        island_area = 1
        neighbors = [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
        for new_x, new_y in neighbors:
            island_area += self.area(new_x, new_y, grid, visited)
        return island_area
```
