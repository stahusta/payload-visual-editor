import React, { useEffect, useRef, useState } from 'react'
import { BLOCK_LABEL_MAP, DEBOUNCE_DELAY, DELETE_CONFIRM_TIMEOUT, VIEWPORT_PADDING } from '../constants.js'
import { sendToParent } from '../helpers/index.js'
import type { BlockTypeInfo } from '../types.js'

interface BlockToolbarProps {
  blockIndex: number
  blockType: string
  blockLabel: string
  rect: DOMRect
  totalBlocks: number
  onRequestAdd: (insertIndex: number) => void
  onAction?: () => void
}

export const BlockToolbar: React.FC<BlockToolbarProps> = ({
  blockIndex,
  blockType,
  rect,
  totalBlocks,
  onRequestAdd,
  onAction,
}) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const busyRef = useRef(false)
  const label = BLOCK_LABEL_MAP[blockType] || blockType

  // Guard against rapid-fire clicks
  const guarded = (fn: () => void) => {
    if (busyRef.current) return
    busyRef.current = true
    fn()
    setTimeout(() => { busyRef.current = false }, DEBOUNCE_DELAY)
  }

  const handleMoveUp = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (blockIndex > 0) guarded(() => {
      sendToParent({ action: 'MOVE_BLOCK', blockIndex, moveDirection: 'up' })
      onAction?.()
    })
  }

  const handleMoveDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (blockIndex < totalBlocks - 1) guarded(() => {
      sendToParent({ action: 'MOVE_BLOCK', blockIndex, moveDirection: 'down' })
      onAction?.()
    })
  }

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation()
    guarded(() => {
      sendToParent({ action: 'DUPLICATE_BLOCK', blockIndex })
      onAction?.()
    })
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (showConfirmDelete) {
      sendToParent({ action: 'DELETE_BLOCK', blockIndex })
      setShowConfirmDelete(false)
      onAction?.()
    } else {
      setShowConfirmDelete(true)
      setTimeout(() => setShowConfirmDelete(false), DELETE_CONFIRM_TIMEOUT)
    }
  }

  const handleAddBelow = (e: React.MouseEvent) => {
    e.stopPropagation()
    onRequestAdd(blockIndex + 1)
  }

  return (
    <>
      {/* Main toolbar */}
      <div
        className="payload-ve__block-toolbar"
        style={{
          position: 'fixed',
          top: rect.top,
          left: rect.left,
          width: rect.width,
          zIndex: 99998,
          pointerEvents: 'auto',
        }}
      >
        <div className="payload-ve__block-toolbar-inner">
          <span className="payload-ve__block-toolbar-label">{label}</span>

          <div className="payload-ve__block-toolbar-actions">
            <button
              className="payload-ve__block-btn"
              onClick={handleMoveUp}
              disabled={blockIndex === 0}
              title="Move Up"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
            </button>

            <button
              className="payload-ve__block-btn"
              onClick={handleMoveDown}
              disabled={blockIndex >= totalBlocks - 1}
              title="Move Down"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </button>

            <div className="payload-ve__block-separator" />

            <button
              className="payload-ve__block-btn"
              onClick={handleDuplicate}
              title="Duplicate"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            </button>

            <button
              className={`payload-ve__block-btn payload-ve__block-btn--danger ${showConfirmDelete ? 'payload-ve__block-btn--confirm' : ''}`}
              onClick={handleDelete}
              title={showConfirmDelete ? 'Click again to confirm' : 'Delete'}
            >
              {showConfirmDelete ? (
                <span style={{ fontSize: '10px', fontWeight: 600 }}>Sure?</span>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Add block button below */}
      <div
        className="payload-ve__add-block-zone"
        style={{
          position: 'fixed',
          top: rect.bottom + 6,
          left: rect.left + rect.width / 2 - 16,
          zIndex: 99997,
          pointerEvents: 'auto',
        }}
      >
        <button
          className="payload-ve__add-block-btn"
          onClick={handleAddBelow}
          title="Add block below"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
        </button>
      </div>
    </>
  )
}

// Block Type Picker component
interface BlockPickerProps {
  insertIndex: number
  blockTypes: BlockTypeInfo[]
  position: { top: number; left: number }
  onSelect: (blockType: string) => void
  onClose: () => void
}

export const BlockPicker: React.FC<BlockPickerProps> = ({
  blockTypes,
  position,
  onSelect,
  onClose,
}) => {
  const pickerRef = useRef<HTMLDivElement>(null)
  const [clampedPos, setClampedPos] = useState(position)

  // Lock page scroll while picker is open
  useEffect(() => {
    const scrollY = window.scrollY
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
      window.scrollTo(0, scrollY)
    }
  }, [])

  // Clamp picker position to viewport after mount
  useEffect(() => {
    const el = pickerRef.current
    if (!el) return
    requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight
      const vw = window.innerWidth
      let top = position.top
      let left = position.left
      if (top + rect.height > vh - VIEWPORT_PADDING) {
        top = Math.max(VIEWPORT_PADDING, vh - rect.height - VIEWPORT_PADDING)
      }
      if (left + rect.width > vw - VIEWPORT_PADDING) {
        left = Math.max(VIEWPORT_PADDING, vw - rect.width - VIEWPORT_PADDING)
      }
      if (top !== position.top || left !== position.left) {
        setClampedPos({ top, left })
      }
    })
  }, [position])

  return (
    <>
      {/* Backdrop */}
      <div
        className="payload-ve__picker-backdrop"
        onClick={onClose}
      />
      {/* Picker */}
      <div
        ref={pickerRef}
        className="payload-ve__picker"
        style={{
          position: 'fixed',
          top: clampedPos.top,
          left: clampedPos.left,
          zIndex: 100001,
          maxHeight: 'calc(100vh - 16px)',
          overflowY: 'auto',
        }}
      >
        <div className="payload-ve__picker-header">Add Block</div>
        <div className="payload-ve__picker-list">
          {blockTypes.map((bt) => (
            <div key={bt.slug}>
              <button
                className="payload-ve__picker-item"
                onClick={() => onSelect(bt.slug)}
              >
                {bt.label}
              </button>
              {bt.templates && bt.templates.length > 0 && bt.templates.map((tpl) => (
                <button
                  key={`${bt.slug}-${tpl.name}`}
                  className="payload-ve__picker-item"
                  style={{ paddingLeft: 24, fontSize: 12, opacity: 0.7 }}
                  onClick={() => onSelect(bt.slug)}
                  title={tpl.description}
                >
                  &rsaquo; {tpl.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
