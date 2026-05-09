import type { BlockDefinition } from '../types/registry'

const byType = new Map<string, BlockDefinition>()

export const componentRegistry = {
  register(def: BlockDefinition) {
    byType.set(def.type, def)
  },
  get(type: string) {
    return byType.get(type)
  },
  list(): BlockDefinition[] {
    return [...byType.values()]
  },
  canNest(parentType: string, childType: string): boolean {
    if (childType === 'Page') return false
    const parent = byType.get(parentType)
    return !!parent?.acceptsChildren
  },
}
