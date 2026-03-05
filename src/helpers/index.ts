import { FIELD_ATTR, EDIT_ATTR, BLOCK_ATTR, OPTIONS_ATTR, COLLECTION_ATTR, SORTABLE_PATH_ATTR, SORTABLE_INDEX_ATTR } from '../constants.js'
import type { EditableFieldType } from '../types.js'

/**
 * Creates a field path helper scoped to a specific block.
 * Use in block components to generate full field paths for data attributes.
 *
 * @example
 * ```tsx
 * const fp = fieldPath('layout', 0)
 * // fp('heading') → 'layout.0.heading'
 * // fp('links.0.link.url') → 'layout.0.links.0.link.url'
 *
 * <h1 {...fieldAttrs(fp('heading'), 'text')}>
 *   {heading}
 * </h1>
 * ```
 */
export const fieldPath = (blocksFieldName: string, blockIndex: number) => {
  const prefix = `${blocksFieldName}.${blockIndex}`
  return (subPath: string) => `${prefix}.${subPath}`
}

/**
 * Generates data attributes for an editable field element.
 *
 * @example
 * ```tsx
 * <h1 {...fieldAttrs('layout.0.heading', 'text')}>
 *   {heading}
 * </h1>
 *
 * <img {...fieldAttrs('layout.0.avatar', 'upload', { collection: 'media' })} />
 *
 * <button {...fieldAttrs('layout.0.style', 'select', {
 *   options: [{ label: 'Default', value: 'default' }, { label: 'Outline', value: 'outline' }]
 * })}>
 *   {label}
 * </button>
 * ```
 */
export const fieldAttrs = (
  path: string,
  editType?: EditableFieldType,
  extra?: {
    options?: Array<{ label: string; value: string }>
    collection?: string
    value?: string
  },
): Record<string, string> => {
  const attrs: Record<string, string> = {
    [FIELD_ATTR]: path,
  }

  if (editType) {
    attrs[EDIT_ATTR] = editType
  }

  if (extra?.options) {
    attrs[OPTIONS_ATTR] = JSON.stringify(extra.options)
  }

  if (extra?.collection) {
    attrs[COLLECTION_ATTR] = extra.collection
  }

  if (extra?.value) {
    attrs['data-payload-value'] = extra.value
  }

  return attrs
}

/**
 * Generates data attributes for a block wrapper element.
 *
 * @example
 * ```tsx
 * <section {...blockAttrs('layout', 0, 'portfolioHero')}>
 *   {/* block content *\/}
 * </section>
 * ```
 */
export const blockAttrs = (
  blocksFieldName: string,
  blockIndex: number,
  blockType: string,
): Record<string, string> => ({
  [BLOCK_ATTR]: blockType,
  [FIELD_ATTR]: `${blocksFieldName}.${blockIndex}`,
})

/**
 * Generates data attributes for a sortable array item.
 * Used for items within a block that can be reordered (e.g., stats, services).
 *
 * @example
 * ```tsx
 * {stats.map((stat, i) => (
 *   <div key={i} {...sortableAttrs('layout.0.stats', i)}>
 *     {stat.label}: {stat.value}
 *   </div>
 * ))}
 * ```
 */
export const sortableAttrs = (
  arrayPath: string,
  itemIndex: number,
): Record<string, string> => ({
  [SORTABLE_PATH_ATTR]: arrayPath,
  [SORTABLE_INDEX_ATTR]: String(itemIndex),
})
