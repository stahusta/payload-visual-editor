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

// Human-readable block labels (shared by toolbar, navigator, overlay)
export const BLOCK_LABEL_MAP: Record<string, string> = {
  portfolioHero: 'Portfolio Hero',
  services: 'Services',
  projectGrid: 'Project Grid',
  stats: 'Stats',
  testimonials: 'Testimonials',
  pageHeader: 'Page Header',
  caseStudyList: 'Case Study List',
  contactInfo: 'Contact Info',
  cta: 'Call to Action',
  content: 'Content',
  mediaBlock: 'Media',
  archive: 'Archive',
  formBlock: 'Form',
}
