'use client'

// Admin components (injected by plugin into Payload admin)
export { VisualEditorProvider } from '../admin/VisualEditorProvider.js'
export { VisualEditorFormBridge } from '../admin/VisualEditorFormBridge.js'
export { VisualEditorToggle } from '../admin/VisualEditorToggle.js'

// Frontend components (used in Next.js app pages / layouts)
export { VisualEditorOverlay } from '../frontend/VisualEditorOverlay.js'
export { BlockToolbar, BlockPicker } from '../frontend/BlockToolbar.js'
export { ContextPopover } from '../frontend/ContextPopover.js'
export { RichTextToolbar } from '../frontend/RichTextToolbar.js'
export { FieldSearchPalette } from '../frontend/FieldSearchPalette.js'

// Re-export types & constants for convenience
export type { BlockTypeInfo, EditableFieldType, VisualEditorMessage, VisualEditorResponse } from '../types.js'
export {
  FIELD_ATTR,
  EDIT_ATTR,
  BLOCK_ATTR,
  OPTIONS_ATTR,
  COLLECTION_ATTR,
  SORTABLE_PATH_ATTR,
  SORTABLE_INDEX_ATTR,
  BLOCK_LABEL_MAP,
} from '../constants.js'
