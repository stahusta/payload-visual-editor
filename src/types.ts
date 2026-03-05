import type { CollectionSlug } from 'payload'

// --- Plugin Config ---
export interface VisualEditorPluginConfig {
  /** Collections that have blocks fields to enable visual editing on */
  collections: Partial<
    Record<
      CollectionSlug,
      {
        /** Name of the blocks field (default: 'layout') */
        blocksField?: string
      }
    >
  >
  /** Known block types for the block picker (shown when adding new blocks) */
  blockTypes?: BlockTypeInfo[]
  /** Disable the plugin without uninstalling */
  disabled?: boolean
}

// --- Block Types ---
export interface BlockTypeInfo {
  slug: string
  label: string
  imageURL?: string
  templates?: BlockTemplate[]
}

export interface BlockTemplate {
  name: string
  description?: string
  data?: Record<string, unknown>
}

// --- Data Attribute Types ---
export type EditableFieldType = 'text' | 'textarea' | 'richText' | 'select' | 'upload' | 'link' | 'checkbox' | 'none'

// --- Frontend -> Admin Messages ---
export interface VisualEditorMessage {
  type: 'payload-visual-editor'
  action:
    | 'FOCUS_FIELD'
    | 'UPDATE_FIELD'
    | 'EDITOR_READY'
    | 'MOVE_BLOCK'
    | 'DELETE_BLOCK'
    | 'DUPLICATE_BLOCK'
    | 'ADD_BLOCK'
    | 'GET_BLOCK_TYPES'
    | 'REPLACE_IMAGE'
    | 'UPDATE_SELECT'
    | 'TOGGLE_CHECKBOX'
    | 'MOVE_ARRAY_ITEM'
    | 'UPDATE_RICHTEXT'
    | 'RESIZE_PREVIEW'
    | 'UNDO'
    | 'REDO'
  fieldPath?: string
  blockType?: string
  blockIndex?: number
  value?: string
  fieldType?: EditableFieldType
  moveDirection?: 'up' | 'down'
  insertIndex?: number
  file?: string
  fileName?: string
  fileType?: string
  arrayPath?: string
  moveFromIndex?: number
  moveToIndex?: number
  htmlValue?: string
  previewWidth?: number
  templateData?: Record<string, unknown>
}

// --- Admin -> Frontend Responses ---
export interface VisualEditorResponse {
  type: 'payload-visual-editor-response'
  action:
    | 'FIELD_FOCUSED'
    | 'FIELD_UPDATED'
    | 'SET_MODE'
    | 'BLOCK_MOVED'
    | 'BLOCK_DELETED'
    | 'BLOCK_DUPLICATED'
    | 'BLOCK_ADDED'
    | 'BLOCK_TYPES'
    | 'IMAGE_REPLACED'
    | 'SELECT_UPDATED'
    | 'CHECKBOX_TOGGLED'
    | 'ARRAY_ITEM_MOVED'
    | 'RICHTEXT_UPDATED'
    | 'PREVIEW_RESIZED'
  fieldPath?: string
  success?: boolean
  enabled?: boolean
  blockTypes?: BlockTypeInfo[]
}
