import type { ComponentType, ReactNode } from 'react'
import type { PageNode, StyleMap } from './pageTree'

export type PropSchemaField =
  | {
      key: string
      type: 'text'
      label: string
      placeholder?: string
    }
  | {
      key: string
      type: 'textarea'
      label: string
      placeholder?: string
    }
  | {
      key: string
      type: 'select'
      label: string
      options: string[]
    }
  | {
      key: string
      type: 'number'
      label: string
      min?: number
      max?: number
    }

export interface BlockRenderProps {
  node: PageNode
  children?: ReactNode
}

export interface BlockDefinition {
  type: string
  label: string
  category: string
  icon?: string
  component: ComponentType<BlockRenderProps>
  schema: PropSchemaField[]
  defaultProps: Record<string, unknown>
  defaultStyles: StyleMap
  /** When true, canvas shows a drop zone inside this node */
  acceptsChildren: boolean
}
