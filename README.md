# payload-visual-editor

Visual Editor plugin for **Payload CMS 3.x** - adds inline editing, block management, drag & drop, and contextual field editors directly in Live Preview.

![Payload 3.x](https://img.shields.io/badge/Payload-3.x-blue)
![React 19](https://img.shields.io/badge/React-19-blue)
![License MIT](https://img.shields.io/badge/License-MIT-green)

## What it does

When you open Live Preview in Payload admin, this plugin turns it into a visual editor:

- **Hover highlights** - hover over any tagged element to see which field it maps to
- **Click to focus** - click any field to scroll to it in the admin sidebar
- **Double-click to edit** - inline text editing directly on the page (safely handles complex elements like styled buttons)
- **Block toolbar** - move up/down, duplicate, delete blocks via floating toolbar
- **Add blocks** - insert new blocks between existing ones
- **Context popovers** - click on selects, images, checkboxes to edit them in-place
- **Drag & drop** - reorder blocks by dragging
- **Array item reordering** - move items within arrays with index indicator (e.g., "2/5")
- **Toggle on/off** - toggle button in admin header to enable/disable the inspector (persisted via localStorage)
- **Field search palette** - `Ctrl+K` / `Cmd+K` to search and jump to any field on the page
- **Block navigator** - press `N` to open a minimap of all blocks for quick navigation
- **Tab navigation** - `Tab` / `Shift+Tab` to cycle through editable fields
- **Value preview** - hover over select/upload fields to see their current value
- **Keyboard shortcuts overlay** - press `?` to see all available shortcuts
- **Keyboard shortcuts** - Ctrl+D (duplicate), Ctrl+Arrow (move), Delete (remove), Escape (deselect)
- **Responsive preview** - toggle between Mobile (375px), Tablet (768px), and Desktop directly in the overlay
- **Toast notifications** - visual feedback after block operations (move, duplicate, delete, add)
- **Breadcrumb labels** - hover shows full field path (e.g. `layout[2] > stats.0.value`)
- **Undo / Redo** - `Ctrl+Z` / `Ctrl+Shift+Z` support

## Installation

```bash
# From npm (when published)
npm install payload-visual-editor

# Or local install (copy the folder and link it)
npm install ../payload-visual-editor
```

## Setup

### 1. Add the plugin to Payload config

```ts
// payload.config.ts
import { buildConfig } from 'payload'
import { visualEditorPlugin } from 'payload-visual-editor'

export default buildConfig({
  // ... your config
  plugins: [
    visualEditorPlugin({
      collections: {
        pages: { blocksField: 'layout' },
        // Add more collections as needed:
        // posts: { blocksField: 'content' },
      },
      // Optional: define block types for the "Add Block" picker
      blockTypes: [
        { slug: 'hero', label: 'Hero' },
        { slug: 'cta', label: 'Call to Action' },
        { slug: 'content', label: 'Content' },
        // ... your block types
      ],
    }),
  ],
})
```

The plugin automatically:
- Injects `VisualEditorProvider` into admin (handles field focus & text updates)
- Injects `VisualEditorFormBridge` into your blocks field (handles block operations via `useForm()`)
- Injects `VisualEditorToggle` into the document header (toggle button next to Publish)

### 2. Add the Overlay to your frontend

In your Next.js layout (or wherever your Live Preview renders):

```tsx
// app/(frontend)/layout.tsx
import { VisualEditorOverlay } from 'payload-visual-editor/client'

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        {children}
        <VisualEditorOverlay />
      </body>
    </html>
  )
}
```

The overlay only activates when the page is inside an iframe (Live Preview). On the regular frontend it renders nothing.

### 3. Tag your block components with data attributes

**This is the key step.** The overlay works by reading HTML `data-` attributes on your rendered elements. Without them, it doesn't know which element maps to which Payload field.

See the [Data Attributes](#data-attributes---how-and-why) section below for a full explanation.

## Data Attributes - How and Why

### Why do I need data attributes?

Payload's Live Preview shows your actual Next.js frontend inside an iframe. The visual editor overlay lives in that iframe and needs to know:

1. **Which HTML element corresponds to which Payload field** - so it can highlight and focus the right admin field when you click
2. **What type of editing to offer** - text inline editing, image upload popover, select dropdown, etc.
3. **Which element is a block** - so it can show the block toolbar (move/duplicate/delete)

Since there's no automatic way to connect your React components to Payload's data model at runtime, you tell the overlay by adding `data-` attributes to your HTML elements. Think of it as "annotating" your frontend so the overlay knows what's what.

### How it works (the flow)

```
Your React component renders:
  <h1 data-payload-field="layout.0.heading" data-payload-edit="text">
    Hello World
  </h1>

The overlay sees this and knows:
  - This element maps to the "heading" field of the first block in "layout"
  - It supports inline text editing (double-click to edit)
  - Clicking it should focus "layout.0.heading" in the admin sidebar
```

### Available data attributes

| Attribute | Example | Purpose |
|---|---|---|
| `data-payload-field` | `"layout.0.heading"` | Maps element to a Payload field path |
| `data-payload-edit` | `"text"` | Editing type: `text`, `textarea`, `select`, `upload`, `checkbox`, `none` |
| `data-payload-block` | `"hero"` | Marks element as a block (enables block toolbar) |
| `data-payload-options` | `'[{"label":"A","value":"a"}]'` | Options for `select` type (JSON) |
| `data-payload-collection` | `"media"` | Collection name for `upload` type |
| `data-payload-value` | `"default"` | Current value (for selects) |
| `data-payload-sortable-path` | `"layout.0.stats"` | Array path for reorderable items |
| `data-payload-sortable-index` | `"0"` | Item index within sortable array |

### Field path format

Field paths follow Payload's dot notation: `{blocksField}.{blockIndex}.{fieldName}`

For nested fields: `layout.0.links.0.link.url`

### Editing types explained

| Type | Behavior | When to use |
|---|---|---|
| `text` | Double-click for inline editing, single-click focuses admin field | Short text: headings, labels, button text |
| `textarea` | Same as text but allows Enter for newlines | Long text: descriptions, paragraphs |
| `select` | Click opens dropdown popover with options | Enums: style variants, layout options, icon pickers |
| `upload` | Click opens file picker / drop zone | Images, media files |
| `checkbox` | Click opens toggle popover | Boolean fields: visibility flags, toggles |
| `link` | (Reserved for future) | Link fields with URL + label |
| `none` | Hover highlight only, no editing | Display-only fields, computed values |

### Helper functions

The plugin exports helper functions so you don't have to write raw attributes:

```tsx
import { fieldPath, fieldAttrs, blockAttrs, sortableAttrs } from 'payload-visual-editor'
```

#### `fieldPath(blocksFieldName, blockIndex)`

Creates a scoped path builder for a block:

```tsx
const fp = fieldPath('layout', 0)
fp('heading')         // → 'layout.0.heading'
fp('links.0.link.url') // → 'layout.0.links.0.link.url'
```

#### `fieldAttrs(path, editType?, extra?)`

Generates data attributes for an editable field:

```tsx
// Text field
<h1 {...fieldAttrs(fp('heading'), 'text')}>{heading}</h1>

// Select field with options
<button {...fieldAttrs(fp('style'), 'select', {
  options: [
    { label: 'Default', value: 'default' },
    { label: 'Outline', value: 'outline' },
  ]
})}>
  {label}
</button>

// Upload field
<img {...fieldAttrs(fp('avatar'), 'upload', { collection: 'media' })} />

// Checkbox
<div {...fieldAttrs(fp('showBadge'), 'checkbox')}>{badge}</div>
```

#### `blockAttrs(blocksFieldName, blockIndex, blockType)`

Generates attributes for a block wrapper:

```tsx
<section {...blockAttrs('layout', blockIndex, 'hero')}>
  {/* block content */}
</section>
```

#### `sortableAttrs(arrayPath, itemIndex)`

Generates attributes for reorderable array items:

```tsx
{stats.map((stat, i) => (
  <div key={i} {...sortableAttrs(fp('stats'), i)}>
    {stat.value} {stat.label}
  </div>
))}
```

## Full Example - A Hero Block

Here's a complete block component with all data attributes:

```tsx
// blocks/Hero/Component.tsx
import { fieldPath, fieldAttrs, blockAttrs } from 'payload-visual-editor'

interface HeroProps {
  heading: string
  description: string
  style: 'default' | 'centered' | 'split'
  image?: { url: string; alt: string }
  blockIndex: number
}

export const HeroBlock: React.FC<HeroProps> = ({
  heading,
  description,
  style,
  image,
  blockIndex,
}) => {
  const fp = fieldPath('layout', blockIndex)

  return (
    <section {...blockAttrs('layout', blockIndex, 'hero')}>
      {/* Inline editable heading */}
      <h1 {...fieldAttrs(fp('heading'), 'text')}>
        {heading}
      </h1>

      {/* Inline editable description */}
      <p {...fieldAttrs(fp('description'), 'textarea')}>
        {description}
      </p>

      {/* Select field with popover */}
      <div {...fieldAttrs(fp('style'), 'select', {
        options: [
          { label: 'Default', value: 'default' },
          { label: 'Centered', value: 'centered' },
          { label: 'Split', value: 'split' },
        ],
        value: style,
      })}>
        Style: {style}
      </div>

      {/* Image with upload popover */}
      {image && (
        <img
          src={image.url}
          alt={image.alt}
          {...fieldAttrs(fp('image'), 'upload', { collection: 'media' })}
        />
      )}
    </section>
  )
}
```

## RenderBlocks Pattern

If you use a `RenderBlocks` component to render your blocks array, pass `blockIndex` to each block:

```tsx
// components/RenderBlocks.tsx
import { HeroBlock } from '@/blocks/Hero/Component'
import { CTABlock } from '@/blocks/CTA/Component'

const blockComponents: Record<string, React.FC<any>> = {
  hero: HeroBlock,
  cta: CTABlock,
  // ...
}

export const RenderBlocks: React.FC<{ blocks: any[] }> = ({ blocks }) => {
  return (
    <>
      {blocks.map((block, index) => {
        const BlockComponent = blockComponents[block.blockType]
        if (!BlockComponent) return null
        return <BlockComponent key={block.id || index} {...block} blockIndex={index} />
      })}
    </>
  )
}
```

## Plugin Config Options

```ts
interface VisualEditorPluginConfig {
  /** Collections with blocks fields to enable visual editing on */
  collections: {
    [collectionSlug: string]: {
      /** Name of the blocks field (default: 'layout') */
      blocksField?: string
    }
  }

  /** Block types for the "Add Block" picker */
  blockTypes?: Array<{
    slug: string
    label: string
    imageURL?: string  // optional preview image
  }>

  /** Disable the plugin without removing it */
  disabled?: boolean
}
```

## Keyboard Shortcuts

### Navigation

| Shortcut | Action |
|---|---|
| `Tab` | Jump to next editable field |
| `Shift + Tab` | Jump to previous editable field |
| `Ctrl/Cmd + K` | Open field search palette |
| `N` | Toggle block navigator minimap |
| `Escape` | Close overlay / deselect block |

### Editing

| Shortcut | Action |
|---|---|
| `Double-click` | Inline edit text field |
| `Click` | Focus field in admin sidebar |
| `Enter` | Confirm inline edit |

### Block Management

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + D` | Duplicate selected block |
| `Ctrl/Cmd + Up` | Move block up |
| `Ctrl/Cmd + Down` | Move block down |
| `Delete / Backspace` | Delete selected block |

### Meta

| Shortcut | Action |
|---|---|
| `?` | Show keyboard shortcuts overlay |

## Client Exports

All frontend components are available from `payload-visual-editor/client`:

```tsx
import { VisualEditorOverlay, FieldSearchPalette } from 'payload-visual-editor/client'
```

- `VisualEditorOverlay` - the main overlay (add to your frontend layout)
- `FieldSearchPalette` - standalone search palette component (included in overlay, but also exported for custom use)

## How It Works Under the Hood

The plugin has two sides that communicate via `postMessage`:

```
┌─────────────────────────────────────┐
│     PAYLOAD ADMIN (parent window)   │
│                                     │
│  VisualEditorProvider               │
│  → Handles FOCUS_FIELD, UPDATE_FIELD│
│  → Scrolls to fields, sets values   │
│                                     │
│  VisualEditorFormBridge             │
│  → Lives inside form context        │
│  → Has useForm() access             │
│  → Handles block CRUD operations    │
│  → Handles image uploads            │
│                                     │
│         ↕ postMessage ↕             │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  IFRAME (Live Preview)      │    │
│  │                             │    │
│  │  VisualEditorOverlay        │    │
│  │  → Reads data-* attributes  │    │
│  │  → Shows hover highlights   │    │
│  │  → Block toolbar            │    │
│  │  → Context popovers         │    │
│  │  → Drag & drop              │    │
│  │  → Inline text editing      │    │
│  │  → Field search (Ctrl+K)    │    │
│  │  → Block navigator (N)      │    │
│  │  → Tab field navigation     │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

## Requirements

- Payload CMS 3.x
- React 19+
- Next.js (for Live Preview iframe support)
- Live Preview enabled on your collection

## License

MIT
