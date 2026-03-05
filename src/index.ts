import type { Config } from 'payload'
import type { VisualEditorPluginConfig } from './types.js'

export type { VisualEditorPluginConfig, BlockTypeInfo, EditableFieldType } from './types.js'
export { FIELD_ATTR, EDIT_ATTR, BLOCK_ATTR, OPTIONS_ATTR, COLLECTION_ATTR, SORTABLE_PATH_ATTR, SORTABLE_INDEX_ATTR } from './constants.js'
export { fieldPath, fieldAttrs, blockAttrs, sortableAttrs } from './helpers/index.js'

/**
 * Payload Visual Editor Plugin
 *
 * Adds visual editing capabilities to Payload's Live Preview:
 * - Inline text editing (double-click to edit)
 * - Block toolbar (move, duplicate, delete blocks)
 * - Context popovers for select, upload, checkbox fields
 * - Array item reordering within blocks
 * - Keyboard shortcuts
 *
 * @example
 * ```ts
 * import { visualEditorPlugin } from 'payload-visual-editor'
 *
 * export default buildConfig({
 *   plugins: [
 *     visualEditorPlugin({
 *       collections: {
 *         pages: { blocksField: 'layout' },
 *       },
 *     }),
 *   ],
 * })
 * ```
 */
export const visualEditorPlugin =
  (pluginConfig: VisualEditorPluginConfig) =>
  (config: Config): Config => {
    if (pluginConfig.disabled) return config

    // 1. Add VisualEditorProvider as an admin provider
    if (!config.admin) config.admin = {}
    if (!config.admin.components) config.admin.components = {}
    if (!config.admin.components.providers) config.admin.components.providers = []

    config.admin.components.providers.push('payload-visual-editor/client#VisualEditorProvider')

    // 2. For each configured collection, add FormBridge as afterInput on the blocks field
    if (config.collections) {
      config.collections = config.collections.map((collection) => {
        const collectionConfig = pluginConfig.collections[collection.slug as keyof typeof pluginConfig.collections]
        if (!collectionConfig) return collection

        const blocksFieldName = collectionConfig.blocksField || 'layout'

        // Add toggle button to edit view header (beforeDocumentControls)
        const existingBeforeControls = collection.admin?.components?.edit?.beforeDocumentControls
        const beforeDocumentControls = [
          ...(Array.isArray(existingBeforeControls)
            ? existingBeforeControls
            : existingBeforeControls
              ? [existingBeforeControls]
              : []),
          'payload-visual-editor/client#VisualEditorToggle',
        ]

        return {
          ...collection,
          admin: {
            ...collection.admin,
            components: {
              ...collection.admin?.components,
              edit: {
                ...collection.admin?.components?.edit,
                beforeDocumentControls,
              },
            },
          },
          fields: collection.fields.map((field) => {
            if ('name' in field && field.name === blocksFieldName && field.type === 'blocks') {
              return {
                ...field,
                admin: {
                  ...field.admin,
                  components: {
                    ...field.admin?.components,
                    afterInput: [
                      ...(Array.isArray(field.admin?.components?.afterInput)
                        ? field.admin.components.afterInput
                        : field.admin?.components?.afterInput
                          ? [field.admin.components.afterInput]
                          : []),
                      {
                        path: 'payload-visual-editor/client#VisualEditorFormBridge',
                        clientProps: {
                          blocksFieldPath: blocksFieldName,
                          blockTypes: pluginConfig.blockTypes || [],
                        },
                      },
                    ],
                  },
                },
              }
            }
            return field
          }),
        }
      })
    }

    return config
  }
