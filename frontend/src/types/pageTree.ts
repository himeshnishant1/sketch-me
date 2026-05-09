export type Viewport = 'mobile' | 'tablet' | 'desktop'

/** Semantic hints for AI / tooling — does not change layout by itself */
export type NodeMetaRole =
  | 'navbar-left'
  | 'navbar-center'
  | 'navbar-right'
  | 'hero-heading'
  | string

export interface NodeMeta {
  createdAt?: string
  updatedAt?: string
  authorId?: string
  /** Layout intent for editors / AI (e.g. navbar zone, hero title) */
  role?: NodeMetaRole
  /** Heading semantic level when using Heading + children composition */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6
  /** Preferred link target for Button primitives (overrides legacy props.href when set) */
  href?: string
  /** Preferred media URL for Image primitives */
  src?: string
  alt?: string
}

/** CSS properties as a typed object (subset + index signature for flexibility) */
export type StyleMap = {
  display?: string
  flexDirection?: string
  alignItems?: string
  justifyContent?: string
  gap?: string
  flex?: string | number
  flexWrap?: string
  gridTemplateColumns?: string
  padding?: string
  margin?: string
  width?: string
  maxWidth?: string
  minHeight?: string
  backgroundColor?: string
  color?: string
  fontSize?: string
  fontFamily?: string
  fontWeight?: string
  textAlign?: string
  borderRadius?: string
  border?: string
  boxShadow?: string
  objectFit?: string
  [key: string]: string | number | undefined
}

export interface ResponsiveStyles {
  mobile?: Partial<StyleMap>
  tablet?: Partial<StyleMap>
  desktop?: Partial<StyleMap>
}

export interface PageNode {
  id: string
  type: string
  props: Record<string, unknown>
  styles: StyleMap
  responsive?: ResponsiveStyles
  children: PageNode[]
  locked?: boolean
  hidden?: boolean
  meta?: NodeMeta
}
