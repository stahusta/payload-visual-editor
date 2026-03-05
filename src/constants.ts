// Data attribute names on DOM elements
export const FIELD_ATTR = 'data-payload-field'
export const EDIT_ATTR = 'data-payload-edit'
export const BLOCK_ATTR = 'data-payload-block'
export const OPTIONS_ATTR = 'data-payload-options'
export const COLLECTION_ATTR = 'data-payload-collection'
export const SORTABLE_PATH_ATTR = 'data-payload-sortable-path'
export const SORTABLE_INDEX_ATTR = 'data-payload-sortable-index'

// PostMessage type identifiers
export const MESSAGE_TYPE = 'payload-visual-editor'
export const RESPONSE_TYPE = 'payload-visual-editor-response'

// Timing constants (ms)
export const DEBOUNCE_DELAY = 400
export const DELETE_CONFIRM_TIMEOUT = 3000
export const STORAGE_POLL_INTERVAL = 500
export const EDIT_FLASH_DURATION = 800
export const FIELD_HIGHLIGHT_DURATION = 1500
export const IFRAME_READY_DELAY = 100
export const LEXICAL_RETRY_DELAY = 400

// UI constants (px)
export const POPOVER_WIDTH = 240
export const VIEWPORT_PADDING = 8
export const PREVIEW_MAX_LENGTH = 80

// Human-readable block labels (shared by toolbar, navigator, overlay)
export const BLOCK_LABEL_MAP: Record<string, string> = {}
