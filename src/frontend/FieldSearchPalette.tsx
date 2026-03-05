'use client'
import React, { useEffect, useRef, useState } from 'react'
import { FIELD_ATTR, EDIT_ATTR, BLOCK_ATTR } from '../constants.js'

interface SearchableField {
  fieldPath: string
  label: string
  editType: string | null
  element: HTMLElement
  blockType?: string
  blockIndex?: number
  preview: string
}

interface FieldSearchPaletteProps {
  onSelect: (field: SearchableField) => void
  onClose: () => void
}

export const FieldSearchPalette: React.FC<FieldSearchPaletteProps> = ({ onSelect, onClose }) => {
  const [query, setQuery] = useState('')
  const [fields, setFields] = useState<SearchableField[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Scan all tagged fields in DOM on mount
  useEffect(() => {
    const allEls = document.querySelectorAll(`[${FIELD_ATTR}]`)
    const scanned: SearchableField[] = []

    allEls.forEach((el) => {
      const fieldPath = el.getAttribute(FIELD_ATTR)
      if (!fieldPath) return

      const editType = el.getAttribute(EDIT_ATTR)
      const parts = fieldPath.split('.')
      const label = parts.length > 2 ? parts.slice(2).join('.') : parts[parts.length - 1]

      const blockEl = el.closest(`[${BLOCK_ATTR}]`)
      const blockType = blockEl?.getAttribute(BLOCK_ATTR) || undefined
      const blockFieldPath = blockEl?.getAttribute(FIELD_ATTR)
      const blockIndex = blockFieldPath ? parseInt(blockFieldPath.split('.')[1], 10) : undefined

      const preview = el.textContent?.trim().slice(0, 80) || ''

      scanned.push({
        fieldPath,
        label,
        editType,
        element: el as HTMLElement,
        blockType,
        blockIndex,
        preview,
      })
    })

    setFields(scanned)
    inputRef.current?.focus()
  }, [])

  const filtered = fields.filter((f) => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      f.label.toLowerCase().includes(q) ||
      f.fieldPath.toLowerCase().includes(q) ||
      f.preview.toLowerCase().includes(q) ||
      (f.blockType?.toLowerCase().includes(q) ?? false)
    )
  })

  // Keep selected index in scroll view
  useEffect(() => {
    const active = listRef.current?.children[selectedIndex] as HTMLElement | undefined
    active?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selectedIndex]) onSelect(filtered[selectedIndex])
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <div className="payload-ve__search-backdrop" onClick={onClose}>
      <div className="payload-ve__search" onClick={(e) => e.stopPropagation()}>
        <div className="payload-ve__search-header">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            autoFocus
            placeholder="Search fields..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            className="payload-ve__search-input"
          />
          <kbd className="payload-ve__search-kbd">ESC</kbd>
        </div>
        <div className="payload-ve__search-results" ref={listRef}>
          {filtered.length > 0 ? (
            filtered.map((f, i) => (
              <button
                key={`${f.fieldPath}-${i}`}
                className={`payload-ve__search-item ${i === selectedIndex ? 'payload-ve__search-item--active' : ''}`}
                onClick={() => onSelect(f)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <div className="payload-ve__search-item-top">
                  <span className="payload-ve__search-item-label">{f.label}</span>
                  <span className="payload-ve__search-item-meta">
                    {f.blockType && (
                      <span className="payload-ve__search-item-block">{f.blockType}</span>
                    )}
                    {f.editType && (
                      <span className="payload-ve__search-item-type">{f.editType}</span>
                    )}
                  </span>
                </div>
                {f.preview && (
                  <div className="payload-ve__search-item-preview">{f.preview}</div>
                )}
              </button>
            ))
          ) : (
            <div className="payload-ve__search-empty">No fields found</div>
          )}
        </div>
        <div className="payload-ve__search-footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
