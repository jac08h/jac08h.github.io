# 617. Merge Two Binary Trees
#### Published 28.8.2021

<https://leetcode.com/problems/merge-two-binary-trees/>

## Overview
Three cases of number of existing nodes:
* 0 -> None (base case)
* 1 -> That node
* 2 -> New node
	* Value: sum of both values
	* Children: merged left child of 'A' with left child of 'B', respectively for right

## Code
```python
class Solution:
    def mergeTrees(self, root1: Optional[TreeNode], root2: Optional[TreeNode]) -> Optional[TreeNode]:
        if root1 is None and root2 is None:
            return None

        single_root_node = None
        if root1 is None:
            single_root_node = root2
        elif root2 is None:
            single_root_node = root1

        if single_root_node is not None:
            return TreeNode(single_root_node.val, single_root_node.left, single_root_node.right)
        else:
            return TreeNode(root1.val + root2.val,
                            self.mergeTrees(root1.left, root2.left),
                            self.mergeTrees(root1.right, root2.right))
```
