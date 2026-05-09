import type { PageNode } from '../types/pageTree'

export function findWithParent(
  root: PageNode,
  id: string,
): { target: PageNode; parent: PageNode; index: number } | null {
  for (let i = 0; i < root.children.length; i++) {
    const child = root.children[i]
    if (child.id === id) return { target: child, parent: root, index: i }
    const deeper = findWithParent(child, id)
    if (deeper) return deeper
  }
  return null
}

export function cloneTree(node: PageNode): PageNode {
  return structuredClone(node)
}

/** Returns true if candidateId is root or a descendant of ancestorId */
export function isSelfOrDescendant(
  root: PageNode,
  ancestorId: string,
  candidateId: string,
): boolean {
  if (ancestorId === candidateId) return true
  const stack: PageNode[] = [root]
  while (stack.length) {
    const n = stack.pop()!
    if (n.id !== ancestorId) {
      stack.push(...n.children)
      continue
    }
    const collect = (node: PageNode): boolean => {
      if (node.id === candidateId) return true
      return node.children.some(collect)
    }
    return collect(n)
  }
  return false
}

export function removeNode(root: PageNode, nodeId: string): PageNode | null {
  const hit = findWithParent(root, nodeId)
  if (!hit) return null
  hit.parent.children.splice(hit.index, 1)
  return hit.target
}

export function insertChild(
  root: PageNode,
  parentId: string,
  index: number,
  child: PageNode,
): boolean {
  const parent =
    parentId === root.id ? root : findWithParent(root, parentId)?.target
  if (!parent) return false
  const safeIndex = Math.max(0, Math.min(index, parent.children.length))
  parent.children.splice(safeIndex, 0, child)
  return true
}

export function moveNode(
  root: PageNode,
  nodeId: string,
  newParentId: string,
  index: number,
): boolean {
  if (isSelfOrDescendant(root, nodeId, newParentId)) return false
  const removed = removeNode(root, nodeId)
  if (!removed) return false
  return insertChild(root, newParentId, index, removed)
}
