'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'

interface RichTextToolbarProps {
  rect: DOMRect
  onClose: () => void
}

export const RichTextToolbar: React.FC<RichTextToolbarProps> = ({ rect, onClose }) => {
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set())
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const savedRangeRef = useRef<Range | null>(null)

  const updateActiveFormats = useCallback(() => {
    const formats = new Set<string>()
    if (document.queryCommandState('bold')) formats.add('bold')
    if (document.queryCommandState('italic')) formats.add('italic')
    if (document.queryCommandState('underline')) formats.add('underline')
    setActiveFormats(formats)
  }, [])

  useEffect(() => {
    document.addEventListener('selectionchange', updateActiveFormats)
    return () => document.removeEventListener('selectionchange', updateActiveFormats)
  }, [updateActiveFormats])

  const execCmd = (cmd: string) => {
    document.execCommand(cmd, false)
    updateActiveFormats()
  }

  const handleLinkClick = () => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    // Check if cursor is on an existing link
    const anchor = selection.anchorNode?.parentElement?.closest('a')
    if (anchor) {
      document.execCommand('unlink', false)
      return
    }

    // Save selection before link input steals focus
    savedRangeRef.current = selection.getRangeAt(0).cloneRange()
    setShowLinkInput(true)
    setLinkUrl('https://')
  }

  const applyLink = () => {
    // Restore saved selection
    if (savedRangeRef.current) {
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(savedRangeRef.current)
      savedRangeRef.current = null
    }

    if (linkUrl.trim()) {
      document.execCommand('createLink', false, linkUrl.trim())
    }
    setShowLinkInput(false)
    setLinkUrl('')
  }

  const handleLinkKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      applyLink()
    }
    if (e.key === 'Escape') {
      // Restore selection without applying
      if (savedRangeRef.current) {
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(savedRangeRef.current)
        savedRangeRef.current = null
      }
      setShowLinkInput(false)
      setLinkUrl('')
    }
  }

  // Position above the element, clamped to viewport
  const toolbarTop = Math.max(4, rect.top - 44)
  const toolbarLeft = Math.max(8, rect.left)

  return (
    <div
      className="payload-ve__rt-toolbar"
      style={{
        position: 'fixed',
        top: toolbarTop,
        left: toolbarLeft,
        zIndex: 100005,
      }}
    >
      <div
        className="payload-ve__rt-toolbar-inner"
        onMouseDown={(e) => e.preventDefault()}
      >
        <button
          className={`payload-ve__rt-btn ${activeFormats.has('bold') ? 'payload-ve__rt-btn--active' : ''}`}
          onMouseDown={(e) => { e.preventDefault(); execCmd('bold') }}
          title="Bold"
        >
          <strong>B</strong>
        </button>

        <button
          className={`payload-ve__rt-btn payload-ve__rt-btn--italic ${activeFormats.has('italic') ? 'payload-ve__rt-btn--active' : ''}`}
          onMouseDown={(e) => { e.preventDefault(); execCmd('italic') }}
          title="Italic"
        >
          I
        </button>

        <button
          className={`payload-ve__rt-btn ${activeFormats.has('underline') ? 'payload-ve__rt-btn--active' : ''}`}
          onMouseDown={(e) => { e.preventDefault(); execCmd('underline') }}
          title="Underline"
        >
          <span style={{ textDecoration: 'underline' }}>U</span>
        </button>

        <div className="payload-ve__block-separator" />

        <button
          className="payload-ve__rt-btn"
          onMouseDown={(e) => { e.preventDefault(); handleLinkClick() }}
          title="Link"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        </button>

        <div className="payload-ve__block-separator" />

        <button
          className="payload-ve__rt-btn payload-ve__rt-btn--done"
          onMouseDown={(e) => { e.preventDefault(); onClose() }}
          title="Done (Escape)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
      </div>

      {/* Link URL input */}
      {showLinkInput && (
        <div className="payload-ve__rt-link-input">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={handleLinkKeyDown}
            placeholder="https://..."
            autoFocus
          />
          <button onClick={applyLink}>
            Apply
          </button>
        </div>
      )}
    </div>
  )
}
