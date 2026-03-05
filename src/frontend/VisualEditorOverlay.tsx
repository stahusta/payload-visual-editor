'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { FIELD_ATTR, EDIT_ATTR, BLOCK_ATTR, OPTIONS_ATTR, MESSAGE_TYPE, RESPONSE_TYPE, SORTABLE_PATH_ATTR, SORTABLE_INDEX_ATTR, BLOCK_LABEL_MAP } from '../constants.js'
import type { BlockTypeInfo, VisualEditorMessage, VisualEditorResponse } from '../types.js'
import { BlockToolbar, BlockPicker } from './BlockToolbar.js'
import { ContextPopover } from './ContextPopover.js'
import { FieldSearchPalette } from './FieldSearchPalette.js'
import { RichTextToolbar } from './RichTextToolbar.js'
import './styles.css'

interface HoveredField {
  element: HTMLElement
  rect: DOMRect
  fieldPath: string
  editType: string | null
  label: string
}

interface HoveredBlock {
  element: HTMLElement
  rect: DOMRect
  blockType: string
  blockIndex: number
}

interface HoveredArrayItem {
  element: HTMLElement
  rect: DOMRect
  arrayPath: string  // e.g. 'layout.0.stats'
  itemIndex: number
  totalItems: number
}

export const VisualEditorOverlay: React.FC = () => {
  // Field hover state
  const [hoveredField, setHoveredField] = useState<HoveredField | null>(null)
  // Block hover state
  const [hoveredBlock, setHoveredBlock] = useState<HoveredBlock | null>(null)
  // SELECTED block (persists on click, stays until click elsewhere)
  const [selectedBlock, setSelectedBlock] = useState<HoveredBlock | null>(null)
  // Array item hover state (for sortable items within blocks)
  const [hoveredArrayItem, setHoveredArrayItem] = useState<HoveredArrayItem | null>(null)
  // Inline text editing
  const [activeEdit, setActiveEdit] = useState<string | null>(null)
  // Inline richText editing (with toolbar)
  const [activeRichText, setActiveRichText] = useState<{
    fieldPath: string
    element: HTMLElement
    rect: DOMRect
  } | null>(null)
  // Context popover
  const [popover, setPopover] = useState<{
    fieldPath: string
    editType: string
    rect: DOMRect
    currentValue?: string
    options?: Array<{ label: string; value: string }>
  } | null>(null)
  // Block picker
  const [blockPicker, setBlockPicker] = useState<{
    insertIndex: number
    position: { top: number; left: number }
    blockTypes: BlockTypeInfo[]
  } | null>(null)
  // Total blocks count
  const [totalBlocks, setTotalBlocks] = useState(0)
  // Field search palette (Ctrl+K)
  const [showSearch, setShowSearch] = useState(false)
  // Keyboard shortcuts overlay
  const [showShortcuts, setShowShortcuts] = useState(false)
  // Block navigator minimap
  const [showNavigator, setShowNavigator] = useState(false)
  const [blockList, setBlockList] = useState<Array<{ type: string; index: number; element: HTMLElement; label: string }>>([])
  // DnD state
  const [dragState, setDragState] = useState<{
    dragging: boolean
    fromIndex: number
    overIndex: number | null
  } | null>(null)

  const [isEnabled, setIsEnabled] = useState(true)
  const [isInIframe, setIsInIframe] = useState(false)

  // Detect iframe + read localStorage after mount (avoids hydration mismatch)
  useEffect(() => {
    setIsInIframe(window.parent !== window)
    const stored = localStorage.getItem('payload-ve-enabled')
    if (stored !== null) setIsEnabled(stored === 'true')
  }, [])

  // Count blocks + validate stale references on DOM changes
  const selectedBlockRef = useRef(selectedBlock)
  selectedBlockRef.current = selectedBlock
  const hoveredBlockRef = useRef(hoveredBlock)
  hoveredBlockRef.current = hoveredBlock

  useEffect(() => {
    const onDomChange = () => {
      const blocks = document.querySelectorAll(`[${BLOCK_ATTR}]`)
      setTotalBlocks(blocks.length)

      // Build block list for navigator
      const list: Array<{ type: string; index: number; element: HTMLElement; label: string }> = []
      blocks.forEach((block) => {
        const type = block.getAttribute(BLOCK_ATTR)!
        const fieldPath = block.getAttribute(FIELD_ATTR)
        const index = fieldPath ? parseInt(fieldPath.split('.')[1], 10) : list.length
        list.push({ type, index, element: block as HTMLElement, label: BLOCK_LABEL_MAP[type] || type })
      })
      setBlockList(list)

      // If selectedBlock element is no longer in DOM, clear it
      if (selectedBlockRef.current && !document.contains(selectedBlockRef.current.element)) {
        setSelectedBlock(null)
      }
      // Same for hoveredBlock
      if (hoveredBlockRef.current && !document.contains(hoveredBlockRef.current.element)) {
        setHoveredBlock(null)
      }
    }
    onDomChange()
    let raf: number | null = null
    const observer = new MutationObserver(() => {
      if (raf) return
      raf = requestAnimationFrame(() => { onDomChange(); raf = null })
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => { observer.disconnect(); if (raf) cancelAnimationFrame(raf) }
  }, [])

  // Poll localStorage for toggle state (same-origin iframe shares localStorage)
  useEffect(() => {
    const interval = setInterval(() => {
      const stored = localStorage.getItem('payload-ve-enabled')
      const shouldBeEnabled = stored === null ? true : stored === 'true'
      setIsEnabled(shouldBeEnabled)
    }, 500)
    return () => clearInterval(interval)
  }, [])

  // Send ready signal
  useEffect(() => {
    if (!isInIframe) return
    window.parent.postMessage(
      { type: MESSAGE_TYPE, action: 'EDITOR_READY' } satisfies VisualEditorMessage,
      '*',
    )
  }, [isInIframe])

  // Listen for responses from admin
  useEffect(() => {
    if (!isInIframe) return
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== RESPONSE_TYPE) return
      const response = event.data as VisualEditorResponse

      switch (response.action) {
        case 'SET_MODE':
          setIsEnabled(response.enabled ?? true)
          break
        case 'BLOCK_TYPES':
          if (response.blockTypes) {
            setBlockPicker((prev) =>
              prev ? { ...prev, blockTypes: response.blockTypes! } : null,
            )
          }
          break
        case 'BLOCK_MOVED':
        case 'BLOCK_DELETED':
        case 'BLOCK_DUPLICATED':
        case 'BLOCK_ADDED':
        case 'ARRAY_ITEM_MOVED':
          // Clear all states after operations - the DOM will change
          setHoveredBlock(null)
          setSelectedBlock(null)
          setHoveredField(null)
          setHoveredArrayItem(null)
          setBlockPicker(null)
          break
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [isInIframe])

  // Save richText edits and send HTML to admin
  const saveRichText = useCallback(() => {
    if (!activeRichText) return
    const { element, fieldPath } = activeRichText
    const html = element.innerHTML

    element.contentEditable = 'false'
    element.classList.remove('payload-ve--editing')

    window.parent.postMessage(
      {
        type: MESSAGE_TYPE,
        action: 'UPDATE_RICHTEXT',
        fieldPath,
        htmlValue: html,
      } satisfies VisualEditorMessage,
      '*',
    )

    setActiveRichText(null)
    setActiveEdit(null)
  }, [activeRichText])

  const blockHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const arrayItemHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  // --- MOUSE MOVE: field + block + array item hover ---
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isEnabled || activeEdit || activeRichText || popover || blockPicker) return

      const target = e.target as HTMLElement

      // Check if mouse is over block toolbar → keep block hover alive
      const overBlockToolbar = target.closest('.payload-ve__block-toolbar-inner, .payload-ve__add-block-btn')
      if (overBlockToolbar) {
        if (blockHideTimer.current) {
          clearTimeout(blockHideTimer.current)
          blockHideTimer.current = null
        }
        return
      }

      // Check if mouse is over array toolbar → keep array item hover alive
      const overArrayToolbar = target.closest('.payload-ve__array-toolbar')
      if (overArrayToolbar) {
        if (arrayItemHideTimer.current) {
          clearTimeout(arrayItemHideTimer.current)
          arrayItemHideTimer.current = null
        }
        return
      }

      // Array item hover (sortable items within blocks) - with delayed hide
      const sortableTarget = target.closest(`[${SORTABLE_PATH_ATTR}]`) as HTMLElement | null
      if (sortableTarget) {
        if (arrayItemHideTimer.current) {
          clearTimeout(arrayItemHideTimer.current)
          arrayItemHideTimer.current = null
        }
        const arrayPath = sortableTarget.getAttribute(SORTABLE_PATH_ATTR)!
        const itemIndex = parseInt(sortableTarget.getAttribute(SORTABLE_INDEX_ATTR) || '-1', 10)
        if (itemIndex >= 0) {
          const siblings = sortableTarget.parentElement?.querySelectorAll(`[${SORTABLE_PATH_ATTR}="${arrayPath}"]`)
          const totalItems = siblings?.length ?? 0
          const rect = sortableTarget.getBoundingClientRect()
          setHoveredArrayItem({ element: sortableTarget, rect, arrayPath, itemIndex, totalItems })
        }
      } else {
        // Delay hiding to allow moving to array toolbar
        if (!arrayItemHideTimer.current) {
          arrayItemHideTimer.current = setTimeout(() => {
            setHoveredArrayItem(null)
            arrayItemHideTimer.current = null
          }, 300)
        }
      }

      // Field hover
      const fieldTarget = target.closest(`[${FIELD_ATTR}]`) as HTMLElement | null
      if (fieldTarget && fieldTarget.getAttribute(FIELD_ATTR)) {
        const fieldPath = fieldTarget.getAttribute(FIELD_ATTR)!
        const editType = fieldTarget.getAttribute(EDIT_ATTR)
        const rect = fieldTarget.getBoundingClientRect()
        const parts = fieldPath.split('.')
        const label = parts.length > 2 ? parts.slice(2).join('.') : parts[parts.length - 1]
        setHoveredField({ element: fieldTarget, rect, fieldPath, editType, label })
      } else {
        setHoveredField(null)
      }

      // Block hover - with delayed hide
      const blockTarget = target.closest(`[${BLOCK_ATTR}]`) as HTMLElement | null
      if (blockTarget) {
        if (blockHideTimer.current) {
          clearTimeout(blockHideTimer.current)
          blockHideTimer.current = null
        }
        const blockType = blockTarget.getAttribute(BLOCK_ATTR)!
        const blockFieldPath = blockTarget.getAttribute(FIELD_ATTR)
        const blockIndex = blockFieldPath ? parseInt(blockFieldPath.split('.')[1], 10) : -1
        const rect = blockTarget.getBoundingClientRect()
        setHoveredBlock({ element: blockTarget, rect, blockType, blockIndex })
      } else {
        if (!blockHideTimer.current) {
          blockHideTimer.current = setTimeout(() => {
            setHoveredBlock(null)
            blockHideTimer.current = null
          }, 300)
        }
      }
    },
    [isEnabled, activeEdit, activeRichText, popover, blockPicker],
  )

  // --- CLICK: navigate to field, open context popover, or select block ---
  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (!isEnabled || !isInIframe) return

      // If richText editing is active, check if click is outside editing area + toolbar
      if (activeRichText) {
        const isOnToolbar = (e.target as HTMLElement).closest('.payload-ve__rt-toolbar')
        const isOnEditingArea = activeRichText.element.contains(e.target as HTMLElement)
        if (isOnToolbar) return // Let toolbar handle it
        if (isOnEditingArea) return // Allow contentEditable behavior
        // Click outside → save and exit
        saveRichText()
        return
      }

      // Check if clicking on overlay UI elements - ignore
      const onOverlayUI = (e.target as HTMLElement).closest('.payload-ve__block-toolbar-inner, .payload-ve__add-block-btn, .payload-ve__array-toolbar')
      if (onOverlayUI) return

      const target = (e.target as HTMLElement).closest(`[${FIELD_ATTR}]`) as HTMLElement | null

      // If click is NOT on a field → handle block selection/deselection
      if (!target) {
        const blockTarget = (e.target as HTMLElement).closest(`[${BLOCK_ATTR}]`) as HTMLElement | null
        if (blockTarget) {
          // Click on a block → select it
          const blockType = blockTarget.getAttribute(BLOCK_ATTR)!
          const blockFieldPath = blockTarget.getAttribute(FIELD_ATTR)
          const blockIndex = blockFieldPath ? parseInt(blockFieldPath.split('.')[1], 10) : -1
          const rect = blockTarget.getBoundingClientRect()
          setSelectedBlock({ element: blockTarget, rect, blockType, blockIndex })
        } else {
          // Click outside any block → deselect
          setSelectedBlock(null)
        }
        return
      }

      const editType = target.getAttribute(EDIT_ATTR)
      const fieldPath = target.getAttribute(FIELD_ATTR)!

      // Select the parent block on any field click
      const blockWrapper = target.closest(`[${BLOCK_ATTR}]`) as HTMLElement | null
      if (blockWrapper) {
        const blockType = blockWrapper.getAttribute(BLOCK_ATTR)!
        const blockFieldPath = blockWrapper.getAttribute(FIELD_ATTR)
        const blockIndex = blockFieldPath ? parseInt(blockFieldPath.split('.')[1], 10) : -1
        const rect = blockWrapper.getBoundingClientRect()
        setSelectedBlock({ element: blockWrapper, rect, blockType, blockIndex })
      }

      // For select/upload/checkbox → open context popover
      if (editType === 'select' || editType === 'upload' || editType === 'checkbox') {
        e.preventDefault()
        e.stopPropagation()

        const rect = target.getBoundingClientRect()
        let options: Array<{ label: string; value: string }> | undefined

        if (editType === 'select') {
          const optionsAttr = target.getAttribute(OPTIONS_ATTR)
          if (optionsAttr) {
            try {
              options = JSON.parse(optionsAttr)
            } catch { /* ignore */ }
          }
        }

        const currentValue = target.getAttribute('data-payload-value') || target.textContent?.trim()

        setPopover({ fieldPath, editType, rect, currentValue, options })
        setHoveredField(null)
        return
      }

      // For richText → enable inline editing with floating toolbar
      if (editType === 'richText') {
        // Set contentEditable BEFORE the event reaches the target (capture phase)
        // so the browser treats this as a click on an editable element.
        // Don't stopPropagation - let the click flow to place the cursor naturally.
        target.contentEditable = 'true'
        target.focus()
        target.classList.add('payload-ve--editing')

        const rect = target.getBoundingClientRect()

        setActiveRichText({ fieldPath, element: target, rect })
        setActiveEdit(fieldPath)
        setHoveredField(null)
        setHoveredBlock(null)

        // Also focus the field in admin
        const blockType = blockWrapper?.getAttribute(BLOCK_ATTR) ?? undefined
        const blockFieldPath2 = blockWrapper?.getAttribute(FIELD_ATTR)
        const blockIndex = blockFieldPath2 ? parseInt(blockFieldPath2.split('.')[1], 10) : undefined

        window.parent.postMessage(
          {
            type: MESSAGE_TYPE,
            action: 'FOCUS_FIELD',
            fieldPath,
            blockType,
            blockIndex,
          } satisfies VisualEditorMessage,
          '*',
        )
        return
      }

      // For text/textarea/link → focus the field in admin (single click)
      e.preventDefault()
      e.stopPropagation()

      // Visual flash feedback on the clicked element
      target.classList.add('payload-ve--editing')
      setTimeout(() => target.classList.remove('payload-ve--editing'), 800)

      const blockType = blockWrapper?.getAttribute(BLOCK_ATTR) ?? undefined
      const blockFieldPath2 = blockWrapper?.getAttribute(FIELD_ATTR)
      const blockIndex = blockFieldPath2 ? parseInt(blockFieldPath2.split('.')[1], 10) : undefined

      window.parent.postMessage(
        {
          type: MESSAGE_TYPE,
          action: 'FOCUS_FIELD',
          fieldPath,
          blockType,
          blockIndex,
        } satisfies VisualEditorMessage,
        '*',
      )
    },
    [isEnabled, isInIframe, activeRichText, saveRichText],
  )

  // --- DOUBLE CLICK: inline text editing ---
  const handleDoubleClick = useCallback(
    (e: MouseEvent) => {
      if (!isEnabled || !isInIframe) return

      const target = (e.target as HTMLElement).closest(`[${FIELD_ATTR}]`) as HTMLElement | null
      if (!target) return

      const editType = target.getAttribute(EDIT_ATTR)
      if (editType !== 'text' && editType !== 'textarea') return

      e.preventDefault()
      e.stopPropagation()

      const fieldPath = target.getAttribute(FIELD_ATTR)!
      setActiveEdit(fieldPath)
      setHoveredField(null)
      setHoveredBlock(null)

      // Find the deepest element that directly contains text.
      // This prevents destroying complex child elements (e.g. styled buttons/links)
      // when the user selects all and types replacement text.
      let editableTarget = target
      if (target.children.length > 0) {
        const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, null)
        const textNode = walker.nextNode()
        if (textNode?.parentElement && target.contains(textNode.parentElement) && textNode.parentElement !== target) {
          editableTarget = textNode.parentElement
        }
      }

      editableTarget.contentEditable = 'true'
      editableTarget.focus()
      target.classList.add('payload-ve--editing')

      const range = document.createRange()
      range.selectNodeContents(editableTarget)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)

      const handleBlur = () => {
        editableTarget.contentEditable = 'false'
        target.classList.remove('payload-ve--editing')
        setActiveEdit(null)

        window.parent.postMessage(
          {
            type: MESSAGE_TYPE,
            action: 'UPDATE_FIELD',
            fieldPath,
            value: editableTarget.innerText,
            fieldType: editType as 'text' | 'textarea',
          } satisfies VisualEditorMessage,
          '*',
        )

        editableTarget.removeEventListener('blur', handleBlur)
        editableTarget.removeEventListener('keydown', handleKeydown)
      }

      const handleKeydown = (ke: KeyboardEvent) => {
        if (ke.key === 'Escape') editableTarget.blur()
        if (ke.key === 'Enter' && editType === 'text') {
          ke.preventDefault()
          editableTarget.blur()
        }
      }

      editableTarget.addEventListener('blur', handleBlur)
      editableTarget.addEventListener('keydown', handleKeydown)
    },
    [isEnabled, isInIframe],
  )

  // --- DRAG & DROP ---
  const handleDragStart = useCallback(
    (e: DragEvent) => {
      if (!isEnabled) return

      const blockEl = (e.target as HTMLElement).closest(`[${BLOCK_ATTR}]`) as HTMLElement | null
      if (!blockEl || blockEl.getAttribute('draggable') !== 'true') return

      const fieldPath = blockEl.getAttribute(FIELD_ATTR)
      const blockIndex = fieldPath ? parseInt(fieldPath.split('.')[1], 10) : -1
      if (blockIndex < 0) return

      e.dataTransfer?.setData('text/plain', String(blockIndex))
      setDragState({ dragging: true, fromIndex: blockIndex, overIndex: null })
      blockEl.classList.add('payload-ve--dragging')
    },
    [isEnabled],
  )

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      if (!dragState?.dragging) return
      e.preventDefault()

      const blockEl = (e.target as HTMLElement).closest(`[${BLOCK_ATTR}]`) as HTMLElement | null
      if (!blockEl) return

      const fieldPath = blockEl.getAttribute(FIELD_ATTR)
      const overIndex = fieldPath ? parseInt(fieldPath.split('.')[1], 10) : -1

      if (overIndex >= 0 && overIndex !== dragState.fromIndex) {
        setDragState((prev) => prev ? { ...prev, overIndex } : null)

        // Add visual indicator
        document.querySelectorAll('.payload-ve--drop-target').forEach((el) =>
          el.classList.remove('payload-ve--drop-target'),
        )
        blockEl.classList.add('payload-ve--drop-target')
      }
    },
    [dragState],
  )

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      if (!dragState?.dragging || dragState.overIndex === null) return

      const { fromIndex, overIndex } = dragState

      // Clean up classes
      document.querySelectorAll('.payload-ve--dragging, .payload-ve--drop-target').forEach((el) => {
        el.classList.remove('payload-ve--dragging', 'payload-ve--drop-target')
      })

      // Send move command
      if (fromIndex !== overIndex) {
        const direction = overIndex > fromIndex ? 'down' : 'up'
        // Move one step at a time to match Payload's moveFieldRow behavior
        const steps = Math.abs(overIndex - fromIndex)
        for (let i = 0; i < steps; i++) {
          window.parent.postMessage(
            {
              type: MESSAGE_TYPE,
              action: 'MOVE_BLOCK',
              blockIndex: direction === 'down' ? fromIndex + i : fromIndex - i,
              moveDirection: direction,
            } satisfies VisualEditorMessage,
            '*',
          )
        }
      }

      setDragState(null)
    },
    [dragState],
  )

  const handleDragEnd = useCallback(() => {
    document.querySelectorAll('.payload-ve--dragging, .payload-ve--drop-target').forEach((el) => {
      el.classList.remove('payload-ve--dragging', 'payload-ve--drop-target')
    })
    setDragState(null)
  }, [])

  // --- KEYBOARD SHORTCUTS ---
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isEnabled || !isInIframe || activeEdit) return

      // Ctrl+K: open field search palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(true)
        return
      }

      // N: toggle block navigator
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        const activeEl = document.activeElement
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).contentEditable === 'true')) return
        setShowNavigator((prev) => !prev)
        return
      }

      // ?: show keyboard shortcuts overlay
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        const activeEl = document.activeElement
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).contentEditable === 'true')) return
        e.preventDefault()
        setShowShortcuts((prev) => !prev)
        return
      }

      // Escape: close richText editing, popover/picker/search/shortcuts, deselect block
      if (e.key === 'Escape') {
        if (activeRichText) {
          saveRichText()
          return
        }
        if (showShortcuts) {
          setShowShortcuts(false)
        } else if (showSearch) {
          setShowSearch(false)
        } else if (popover || blockPicker) {
          setPopover(null)
          setBlockPicker(null)
        } else {
          setSelectedBlock(null)
        }
        return
      }

      // Tab / Shift+Tab: navigate between editable fields
      if (e.key === 'Tab') {
        const allFields = Array.from(document.querySelectorAll(`[${FIELD_ATTR}][${EDIT_ATTR}]`)) as HTMLElement[]
        if (allFields.length === 0) return

        e.preventDefault()
        const currentIdx = hoveredField ? allFields.indexOf(hoveredField.element) : -1
        let nextIdx: number

        if (e.shiftKey) {
          nextIdx = currentIdx <= 0 ? allFields.length - 1 : currentIdx - 1
        } else {
          nextIdx = currentIdx >= allFields.length - 1 ? 0 : currentIdx + 1
        }

        const nextEl = allFields[nextIdx]
        nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
        const fieldPath = nextEl.getAttribute(FIELD_ATTR)!
        const editType = nextEl.getAttribute(EDIT_ATTR)
        const rect = nextEl.getBoundingClientRect()
        const parts = fieldPath.split('.')
        const label = parts.length > 2 ? parts.slice(2).join('.') : parts[parts.length - 1]
        setHoveredField({ element: nextEl, rect, fieldPath, editType, label })

        // Also select parent block
        const blockEl = nextEl.closest(`[${BLOCK_ATTR}]`) as HTMLElement | null
        if (blockEl) {
          const blockType = blockEl.getAttribute(BLOCK_ATTR)!
          const blockFieldPath = blockEl.getAttribute(FIELD_ATTR)
          const blockIndex = blockFieldPath ? parseInt(blockFieldPath.split('.')[1], 10) : -1
          setSelectedBlock({ element: blockEl, rect: blockEl.getBoundingClientRect(), blockType, blockIndex })
        }
        return
      }

      // Use selectedBlock first, fallback to hoveredBlock
      const targetBlock = selectedBlock || hoveredBlock
      if (!targetBlock) return

      const isMod = e.metaKey || e.ctrlKey

      // Ctrl+D: duplicate block
      if (isMod && e.key === 'd') {
        e.preventDefault()
        window.parent.postMessage(
          {
            type: MESSAGE_TYPE,
            action: 'DUPLICATE_BLOCK',
            blockIndex: targetBlock.blockIndex,
          } satisfies VisualEditorMessage,
          '*',
        )
      }

      // Ctrl+Up/Down: move block
      if (isMod && e.key === 'ArrowUp') {
        e.preventDefault()
        window.parent.postMessage(
          {
            type: MESSAGE_TYPE,
            action: 'MOVE_BLOCK',
            blockIndex: targetBlock.blockIndex,
            moveDirection: 'up',
          } satisfies VisualEditorMessage,
          '*',
        )
      }

      if (isMod && e.key === 'ArrowDown') {
        e.preventDefault()
        window.parent.postMessage(
          {
            type: MESSAGE_TYPE,
            action: 'MOVE_BLOCK',
            blockIndex: targetBlock.blockIndex,
            moveDirection: 'down',
          } satisfies VisualEditorMessage,
          '*',
        )
      }

      // Delete/Backspace: delete block (with no active input)
      if ((e.key === 'Delete' || e.key === 'Backspace') && !activeEdit) {
        const activeEl = document.activeElement
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).contentEditable === 'true')) {
          return
        }
        e.preventDefault()
        window.parent.postMessage(
          {
            type: MESSAGE_TYPE,
            action: 'DELETE_BLOCK',
            blockIndex: targetBlock.blockIndex,
          } satisfies VisualEditorMessage,
          '*',
        )
      }
    },
    [isEnabled, isInIframe, activeEdit, activeRichText, saveRichText, hoveredBlock, hoveredField, selectedBlock, popover, blockPicker, showSearch, showShortcuts],
  )

  // --- Add Block: request block types then show picker ---
  const handleRequestAdd = useCallback(
    (insertIndex: number) => {
      // Request available block types from admin
      window.parent.postMessage(
        { type: MESSAGE_TYPE, action: 'GET_BLOCK_TYPES' } satisfies VisualEditorMessage,
        '*',
      )

      const targetBlock = selectedBlock || hoveredBlock
      const targetRect = targetBlock?.rect
      setBlockPicker({
        insertIndex,
        position: {
          top: targetRect ? targetRect.bottom + 8 : 200,
          left: targetRect ? targetRect.left + targetRect.width / 2 - 100 : 200,
        },
        blockTypes: [],
      })
    },
    [hoveredBlock, selectedBlock],
  )

  const handleBlockPickerSelect = useCallback(
    (blockType: string) => {
      if (!blockPicker) return
      window.parent.postMessage(
        {
          type: MESSAGE_TYPE,
          action: 'ADD_BLOCK',
          blockType,
          insertIndex: blockPicker.insertIndex,
        } satisfies VisualEditorMessage,
        '*',
      )
      setBlockPicker(null)
    },
    [blockPicker],
  )

  // Update positions on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (hoveredField) {
        const rect = hoveredField.element.getBoundingClientRect()
        setHoveredField((prev) => (prev ? { ...prev, rect } : null))
      }
      if (hoveredBlock) {
        const rect = hoveredBlock.element.getBoundingClientRect()
        setHoveredBlock((prev) => (prev ? { ...prev, rect } : null))
      }
      if (selectedBlock) {
        const rect = selectedBlock.element.getBoundingClientRect()
        setSelectedBlock((prev) => (prev ? { ...prev, rect } : null))
      }
      if (hoveredArrayItem) {
        const rect = hoveredArrayItem.element.getBoundingClientRect()
        setHoveredArrayItem((prev) => (prev ? { ...prev, rect } : null))
      }
      if (activeRichText) {
        const rect = activeRichText.element.getBoundingClientRect()
        setActiveRichText((prev) => (prev ? { ...prev, rect } : null))
      }
    }
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [hoveredField, hoveredBlock, selectedBlock, hoveredArrayItem, activeRichText])

  // Make blocks draggable + add body class for CSS scoping
  useEffect(() => {
    if (!isInIframe) return
    const blocks = document.querySelectorAll(`[${BLOCK_ATTR}]`)
    if (isEnabled) {
      document.body.classList.add('payload-ve-active')
      blocks.forEach((block) => {
        ;(block as HTMLElement).draggable = true
      })
    } else {
      document.body.classList.remove('payload-ve-active')
      blocks.forEach((block) => {
        ;(block as HTMLElement).draggable = false
      })
    }
    return () => {
      document.body.classList.remove('payload-ve-active')
    }
  })

  // Attach event listeners
  useEffect(() => {
    if (!isInIframe) return
    document.addEventListener('mousemove', handleMouseMove, true)
    document.addEventListener('click', handleClick, true)
    document.addEventListener('dblclick', handleDoubleClick, true)
    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('dragstart', handleDragStart, true)
    document.addEventListener('dragover', handleDragOver, true)
    document.addEventListener('drop', handleDrop, true)
    document.addEventListener('dragend', handleDragEnd, true)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true)
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('dblclick', handleDoubleClick, true)
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('dragstart', handleDragStart, true)
      document.removeEventListener('dragover', handleDragOver, true)
      document.removeEventListener('drop', handleDrop, true)
      document.removeEventListener('dragend', handleDragEnd, true)
    }
  }, [isInIframe, handleMouseMove, handleClick, handleDoubleClick, handleKeyDown, handleDragStart, handleDragOver, handleDrop, handleDragEnd])

  // Clear all states immediately (called by toolbar after block operations)
  const clearAllStates = useCallback(() => {
    setHoveredBlock(null)
    setSelectedBlock(null)
    setHoveredField(null)
    setHoveredArrayItem(null)
    setBlockPicker(null)
  }, [])

  // Helper: send array item move + clear states immediately
  const handleArrayItemMove = useCallback(
    (arrayPath: string, fromIndex: number, direction: 'up' | 'down') => {
      const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1
      window.parent.postMessage(
        {
          type: MESSAGE_TYPE,
          action: 'MOVE_ARRAY_ITEM',
          arrayPath,
          moveFromIndex: fromIndex,
          moveToIndex: toIndex,
        } satisfies VisualEditorMessage,
        '*',
      )
      // Clear immediately - DOM will change
      setHoveredArrayItem(null)
    },
    [],
  )

  if (!isInIframe || !isEnabled) return null

  // Determine which block to show toolbar for (selected takes priority)
  const toolbarBlock = selectedBlock || hoveredBlock
  const showToolbar = toolbarBlock && !activeEdit && !popover && !blockPicker

  return (
    <>
      {/* Selected block outline */}
      {selectedBlock && !activeEdit && (
        <div
          className="payload-ve__selected-outline"
          style={{
            position: 'fixed',
            top: selectedBlock.rect.top,
            left: selectedBlock.rect.left,
            width: selectedBlock.rect.width,
            height: selectedBlock.rect.height,
            pointerEvents: 'none',
            zIndex: 99996,
          }}
        />
      )}

      {/* Block toolbar - shows for selected or hovered block */}
      {showToolbar && (
        <BlockToolbar
          blockIndex={toolbarBlock.blockIndex}
          blockType={toolbarBlock.blockType}
          blockLabel={toolbarBlock.blockType}
          rect={toolbarBlock.rect}
          totalBlocks={totalBlocks}
          onRequestAdd={handleRequestAdd}
          onAction={clearAllStates}
        />
      )}

      {/* Array item toolbar - shows on hover over sortable items */}
      {hoveredArrayItem && !activeEdit && !popover && (
        <div
          className="payload-ve__array-toolbar"
          style={{
            position: 'fixed',
            top: hoveredArrayItem.rect.top + hoveredArrayItem.rect.height / 2 - 16,
            left: hoveredArrayItem.rect.left - 36,
            zIndex: 99999,
            pointerEvents: 'auto',
          }}
        >
          <button
            className="payload-ve__array-btn"
            disabled={hoveredArrayItem.itemIndex === 0}
            title="Move left"
            aria-label={`Move item ${hoveredArrayItem.itemIndex + 1} left`}
            onClick={(e) => {
              e.stopPropagation()
              handleArrayItemMove(hoveredArrayItem.arrayPath, hoveredArrayItem.itemIndex, 'up')
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <span className="payload-ve__array-index">{hoveredArrayItem.itemIndex + 1}/{hoveredArrayItem.totalItems}</span>
          <button
            className="payload-ve__array-btn"
            disabled={hoveredArrayItem.itemIndex >= hoveredArrayItem.totalItems - 1}
            title="Move right"
            aria-label={`Move item ${hoveredArrayItem.itemIndex + 1} right`}
            onClick={(e) => {
              e.stopPropagation()
              handleArrayItemMove(hoveredArrayItem.arrayPath, hoveredArrayItem.itemIndex, 'down')
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
      )}

      {/* Array item highlight */}
      {hoveredArrayItem && !activeEdit && (
        <div
          className="payload-ve__array-highlight"
          style={{
            position: 'fixed',
            top: hoveredArrayItem.rect.top - 1,
            left: hoveredArrayItem.rect.left - 1,
            width: hoveredArrayItem.rect.width + 2,
            height: hoveredArrayItem.rect.height + 2,
            pointerEvents: 'none',
            zIndex: 99995,
          }}
        />
      )}

      {/* Field highlight - shows on field hover */}
      {hoveredField && !activeEdit && !popover && (
        <div
          style={{
            position: 'fixed',
            top: hoveredField.rect.top - 2,
            left: hoveredField.rect.left - 2,
            width: hoveredField.rect.width + 4,
            height: hoveredField.rect.height + 4,
            pointerEvents: 'none',
            zIndex: 99999,
          }}
        >
          <div className="payload-ve__highlight" />
          <div className="payload-ve__label">
            {hoveredField.label}
            {hoveredField.editType && hoveredField.editType !== 'none' && (
              <span className="payload-ve__label-hint">
                {hoveredField.editType === 'text' || hoveredField.editType === 'textarea'
                  ? 'dblclick to edit · tab next'
                  : hoveredField.editType === 'richText'
                    ? 'click to edit'
                    : hoveredField.editType === 'link'
                      ? 'click to edit in admin'
                      : 'click to change'}
              </span>
            )}
          </div>
          {/* Value preview tooltip */}
          {hoveredField.editType && (hoveredField.editType === 'select' || hoveredField.editType === 'upload') && (
            <div className="payload-ve__value-preview">
              {hoveredField.element.getAttribute('data-payload-value') || hoveredField.element.textContent?.trim().slice(0, 50) || '(empty)'}
            </div>
          )}
        </div>
      )}

      {/* RichText inline editing toolbar */}
      {activeRichText && (
        <RichTextToolbar
          rect={activeRichText.rect}
          onClose={saveRichText}
        />
      )}

      {/* Context popover */}
      {popover && (
        <ContextPopover
          fieldPath={popover.fieldPath}
          editType={popover.editType}
          rect={popover.rect}
          currentValue={popover.currentValue}
          options={popover.options}
          onClose={() => setPopover(null)}
        />
      )}

      {/* Block picker */}
      {blockPicker && blockPicker.blockTypes.length > 0 && (
        <BlockPicker
          insertIndex={blockPicker.insertIndex}
          blockTypes={blockPicker.blockTypes}
          position={blockPicker.position}
          onSelect={handleBlockPickerSelect}
          onClose={() => setBlockPicker(null)}
        />
      )}

      {/* Field search palette (Ctrl+K) */}
      {showSearch && (
        <FieldSearchPalette
          onClose={() => setShowSearch(false)}
          onSelect={(field) => {
            setShowSearch(false)
            // Scroll to the field element
            field.element.scrollIntoView({ behavior: 'smooth', block: 'center' })
            // Briefly highlight it
            field.element.classList.add('payload-ve--editing')
            setTimeout(() => field.element.classList.remove('payload-ve--editing'), 1500)
            // Focus in admin
            window.parent.postMessage(
              {
                type: MESSAGE_TYPE,
                action: 'FOCUS_FIELD',
                fieldPath: field.fieldPath,
                blockType: field.blockType,
                blockIndex: field.blockIndex,
              } satisfies VisualEditorMessage,
              '*',
            )
          }}
        />
      )}

      {/* Keyboard shortcuts overlay */}
      {showShortcuts && (
        <div className="payload-ve__shortcuts-backdrop" onClick={() => setShowShortcuts(false)}>
          <div className="payload-ve__shortcuts" onClick={(e) => e.stopPropagation()}>
            <div className="payload-ve__shortcuts-title">Keyboard Shortcuts</div>
            <div className="payload-ve__shortcuts-grid">
              <div className="payload-ve__shortcuts-group">
                <div className="payload-ve__shortcuts-group-title">Navigation</div>
                <div className="payload-ve__shortcut-row"><kbd>Tab</kbd><span>Next field</span></div>
                <div className="payload-ve__shortcut-row"><kbd>Shift + Tab</kbd><span>Previous field</span></div>
                <div className="payload-ve__shortcut-row"><kbd>Cmd/Ctrl + K</kbd><span>Search fields</span></div>
                <div className="payload-ve__shortcut-row"><kbd>N</kbd><span>Block navigator</span></div>
                <div className="payload-ve__shortcut-row"><kbd>Escape</kbd><span>Close / Deselect</span></div>
              </div>
              <div className="payload-ve__shortcuts-group">
                <div className="payload-ve__shortcuts-group-title">Editing</div>
                <div className="payload-ve__shortcut-row"><kbd>Double click</kbd><span>Inline edit text</span></div>
                <div className="payload-ve__shortcut-row"><kbd>Click</kbd><span>Focus field in admin</span></div>
                <div className="payload-ve__shortcut-row"><kbd>Enter</kbd><span>Confirm edit</span></div>
              </div>
              <div className="payload-ve__shortcuts-group">
                <div className="payload-ve__shortcuts-group-title">Blocks</div>
                <div className="payload-ve__shortcut-row"><kbd>Cmd/Ctrl + D</kbd><span>Duplicate block</span></div>
                <div className="payload-ve__shortcut-row"><kbd>Cmd/Ctrl + ↑</kbd><span>Move block up</span></div>
                <div className="payload-ve__shortcut-row"><kbd>Cmd/Ctrl + ↓</kbd><span>Move block down</span></div>
                <div className="payload-ve__shortcut-row"><kbd>Delete</kbd><span>Delete block</span></div>
              </div>
            </div>
            <div className="payload-ve__shortcuts-footer">Press <kbd>?</kbd> to toggle</div>
          </div>
        </div>
      )}

      {/* Block navigator minimap */}
      {showNavigator && (
        <div className="payload-ve__navigator">
          <div className="payload-ve__navigator-header">
            <span className="payload-ve__navigator-title">Blocks</span>
            <button className="payload-ve__navigator-close" onClick={() => setShowNavigator(false)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
          <div className="payload-ve__navigator-list">
            {blockList.map((block, i) => {
              const isActive = selectedBlock?.blockIndex === block.index
              return (
                <button
                  key={`${block.type}-${i}`}
                  className={`payload-ve__navigator-item ${isActive ? 'payload-ve__navigator-item--active' : ''}`}
                  onClick={() => {
                    block.element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    const rect = block.element.getBoundingClientRect()
                    setSelectedBlock({ element: block.element, rect, blockType: block.type, blockIndex: block.index })
                  }}
                >
                  <span className="payload-ve__navigator-index">{i + 1}</span>
                  <span className="payload-ve__navigator-label">{block.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* First-time hint badge */}
      {!showNavigator && !showShortcuts && !showSearch && !popover && !blockPicker && !activeEdit && (
        <div className="payload-ve__hint-badge" title="Press ? for shortcuts, N for navigator">
          <kbd>?</kbd> shortcuts <kbd>N</kbd> navigator
        </div>
      )}
    </>
  )
}
