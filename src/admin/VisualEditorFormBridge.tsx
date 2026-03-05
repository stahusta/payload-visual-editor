'use client'
import { useCallback, useEffect } from 'react'
import { useForm } from '@payloadcms/ui'
import { MESSAGE_TYPE, RESPONSE_TYPE } from '../constants.js'
import type { VisualEditorMessage, VisualEditorResponse } from '../types.js'

/**
 * Hidden component rendered as afterInput on the layout blocks field.
 * Lives INSIDE the form context → has access to useForm() for block operations.
 * Listens for postMessages from the Live Preview iframe and performs
 * block move/add/delete/duplicate/select/checkbox operations.
 */
const VisualEditorFormBridge: React.FC = () => {
  const {
    addFieldRow,
    moveFieldRow,
    removeFieldRow,
    dispatchFields,
    setModified,
  } = useForm()

  const getIframe = useCallback((): HTMLIFrameElement | null => {
    return document.querySelector('iframe.live-preview-iframe') as HTMLIFrameElement | null
  }, [])

  const sendToIframe = useCallback(
    (message: VisualEditorResponse) => {
      const iframe = getIframe()
      iframe?.contentWindow?.postMessage(message, '*')
    },
    [getIframe],
  )

  // Move block up or down
  const moveBlock = useCallback(
    (blockIndex: number, direction: 'up' | 'down') => {
      const targetIndex = direction === 'up' ? blockIndex - 1 : blockIndex + 1
      if (targetIndex < 0) {
        sendToIframe({ type: RESPONSE_TYPE, action: 'BLOCK_MOVED', success: false })
        return
      }

      moveFieldRow({ moveFromIndex: blockIndex, moveToIndex: targetIndex, path: 'layout' })
      setModified(true)
      sendToIframe({ type: RESPONSE_TYPE, action: 'BLOCK_MOVED', success: true })
    },
    [moveFieldRow, setModified, sendToIframe],
  )

  // Delete block
  const deleteBlock = useCallback(
    (blockIndex: number) => {
      removeFieldRow({ path: 'layout', rowIndex: blockIndex })
      setModified(true)
      sendToIframe({ type: RESPONSE_TYPE, action: 'BLOCK_DELETED', success: true })
    },
    [removeFieldRow, setModified, sendToIframe],
  )

  // Duplicate block
  const duplicateBlock = useCallback(
    (blockIndex: number) => {
      dispatchFields({ type: 'DUPLICATE_ROW', path: 'layout', rowIndex: blockIndex })
      setModified(true)
      sendToIframe({ type: RESPONSE_TYPE, action: 'BLOCK_DUPLICATED', success: true })
    },
    [dispatchFields, setModified, sendToIframe],
  )

  // Add new block
  const addBlock = useCallback(
    (blockType: string, insertIndex: number) => {
      addFieldRow({
        blockType,
        path: 'layout',
        rowIndex: insertIndex,
        schemaPath: 'layout',
      })
      setModified(true)
      sendToIframe({ type: RESPONSE_TYPE, action: 'BLOCK_ADDED', success: true })
    },
    [addFieldRow, setModified, sendToIframe],
  )

  // Get available block types from DOM (block picker buttons)
  const getBlockTypes = useCallback(() => {
    // Read block types from the blocks field drawer buttons in admin
    // Payload renders block type options with slugs as data attributes
    const blockTypes: Array<{ slug: string; label: string }> = []

    // Look for the blocks field config. We parse the available blocks
    // from the rendered block picker UI in admin
    const blockButtons = document.querySelectorAll(
      '[class*="blocks-field"] [class*="baseBlockFields"] button, ' +
      '[class*="block-selection"] button, ' +
      '.blocks-drawer__blocks button'
    )

    if (blockButtons.length > 0) {
      blockButtons.forEach((btn) => {
        const slug = btn.getAttribute('data-block-slug') || btn.textContent?.trim() || ''
        const label = btn.textContent?.trim() || slug
        if (slug) blockTypes.push({ slug, label })
      })
    }

    sendToIframe({
      type: RESPONSE_TYPE,
      action: 'BLOCK_TYPES',
      success: true,
      blockTypes,
    })
  }, [sendToIframe])

  // Update a select field value
  const updateSelectField = useCallback(
    (fieldPath: string, value: string) => {
      try {
        dispatchFields({
          type: 'UPDATE',
          path: fieldPath,
          value,
        })
        setModified(true)
        sendToIframe({ type: RESPONSE_TYPE, action: 'SELECT_UPDATED', fieldPath, success: true })
      } catch {
        sendToIframe({ type: RESPONSE_TYPE, action: 'SELECT_UPDATED', fieldPath, success: false })
      }
    },
    [dispatchFields, setModified, sendToIframe],
  )

  // Toggle checkbox field
  const toggleCheckbox = useCallback(
    (fieldPath: string) => {
      const checkbox = document.querySelector(
        `input[type="checkbox"][name="${fieldPath}"], button[id="field-${fieldPath.replace(/\./g, '__')}"]`,
      ) as HTMLElement | null

      if (checkbox) {
        checkbox.click()
        sendToIframe({ type: RESPONSE_TYPE, action: 'CHECKBOX_TOGGLED', fieldPath, success: true })
      } else {
        sendToIframe({ type: RESPONSE_TYPE, action: 'CHECKBOX_TOGGLED', fieldPath, success: false })
      }
    },
    [sendToIframe],
  )

  // Upload image and replace field
  const replaceImage = useCallback(
    async (fieldPath: string, fileBase64: string, fileName: string, fileType: string) => {
      try {
        // Decode base64 to blob
        const byteChars = atob(fileBase64)
        const byteNumbers = new Array(byteChars.length)
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { type: fileType })

        // Upload to Payload media collection
        const formData = new FormData()
        formData.append('file', blob, fileName)

        const collection = 'media'
        const res = await fetch(`/api/${collection}`, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        })

        if (!res.ok) throw new Error(`Upload failed: ${res.status}`)

        const data = await res.json()
        const mediaId = data.doc?.id

        if (mediaId) {
          // Update the form field with the new media ID
          const fieldId = `field-${fieldPath.replace(/\./g, '__')}`
          // Payload upload fields use a relationship-style picker
          // We need to programmatically set the value
          const input = document.querySelector(
            `input[name="${fieldPath}"]`,
          ) as HTMLInputElement | null

          if (input) {
            const nativeSetter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype,
              'value',
            )?.set
            nativeSetter?.call(input, String(mediaId))
            input.dispatchEvent(new Event('input', { bubbles: true }))
            input.dispatchEvent(new Event('change', { bubbles: true }))
          }

          setModified(true)
          sendToIframe({
            type: RESPONSE_TYPE,
            action: 'IMAGE_REPLACED',
            fieldPath,
            success: true,
          })
        }
      } catch (err) {
        sendToIframe({
          type: RESPONSE_TYPE,
          action: 'IMAGE_REPLACED',
          fieldPath,
          success: false,
        })
      }
    },
    [setModified, sendToIframe],
  )

  // Move array item (e.g. stat within stats block)
  const moveArrayItem = useCallback(
    (arrayPath: string, fromIndex: number, toIndex: number) => {
      if (toIndex < 0) {
        sendToIframe({ type: RESPONSE_TYPE, action: 'ARRAY_ITEM_MOVED', success: false })
        return
      }
      moveFieldRow({ moveFromIndex: fromIndex, moveToIndex: toIndex, path: arrayPath })
      setModified(true)
      sendToIframe({ type: RESPONSE_TYPE, action: 'ARRAY_ITEM_MOVED', success: true })
    },
    [moveFieldRow, setModified, sendToIframe],
  )

  // Update richText field by pasting HTML into Lexical editor
  const updateRichText = useCallback(
    (fieldPath: string, html: string) => {
      const fieldId = `field-${fieldPath.replace(/\./g, '__')}`
      const fieldWrapper = document.getElementById(fieldId)

      let editorEl: HTMLElement | null = null
      if (fieldWrapper) {
        editorEl = fieldWrapper.querySelector('[contenteditable="true"]')
      }
      if (!editorEl && fieldWrapper) {
        editorEl = fieldWrapper.querySelector('[data-lexical-editor]')
      }
      if (!editorEl) {
        const lastPart = fieldPath.split('.').pop()
        const allEditors = document.querySelectorAll('[contenteditable="true"][data-lexical-editor="true"]')
        for (const el of allEditors) {
          const wrapper = el.closest(`[id*="${lastPart}"]`)
          if (wrapper) {
            editorEl = el as HTMLElement
            break
          }
        }
      }

      if (!editorEl) {
        sendToIframe({ type: RESPONSE_TYPE, action: 'RICHTEXT_UPDATED', fieldPath, success: false })
        return
      }

      editorEl.focus()
      const selection = window.getSelection()
      if (selection) {
        const range = document.createRange()
        range.selectNodeContents(editorEl)
        selection.removeAllRanges()
        selection.addRange(range)
      }

      const temp = document.createElement('div')
      temp.innerHTML = html
      const plainText = temp.textContent || ''

      const dt = new DataTransfer()
      dt.setData('text/html', html)
      dt.setData('text/plain', plainText)

      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dt,
      })

      editorEl.dispatchEvent(pasteEvent)
      setModified(true)

      sendToIframe({ type: RESPONSE_TYPE, action: 'RICHTEXT_UPDATED', fieldPath, success: true })
    },
    [setModified, sendToIframe],
  )

  // Listen for messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== MESSAGE_TYPE) return

      const message = event.data as VisualEditorMessage

      switch (message.action) {
        case 'MOVE_BLOCK':
          if (message.blockIndex !== undefined && message.moveDirection) {
            moveBlock(message.blockIndex, message.moveDirection)
          }
          break

        case 'DELETE_BLOCK':
          if (message.blockIndex !== undefined) {
            deleteBlock(message.blockIndex)
          }
          break

        case 'DUPLICATE_BLOCK':
          if (message.blockIndex !== undefined) {
            duplicateBlock(message.blockIndex)
          }
          break

        case 'ADD_BLOCK':
          if (message.blockType && message.insertIndex !== undefined) {
            addBlock(message.blockType, message.insertIndex)
          }
          break

        case 'GET_BLOCK_TYPES':
          getBlockTypes()
          break

        case 'REPLACE_IMAGE':
          if (message.fieldPath && message.file && message.fileName && message.fileType) {
            replaceImage(message.fieldPath, message.file, message.fileName, message.fileType)
          }
          break

        case 'UPDATE_SELECT':
          if (message.fieldPath && message.value !== undefined) {
            updateSelectField(message.fieldPath, message.value)
          }
          break

        case 'TOGGLE_CHECKBOX':
          if (message.fieldPath) {
            toggleCheckbox(message.fieldPath)
          }
          break

        case 'MOVE_ARRAY_ITEM':
          if (message.arrayPath && message.moveFromIndex !== undefined && message.moveToIndex !== undefined) {
            moveArrayItem(message.arrayPath, message.moveFromIndex, message.moveToIndex)
          }
          break

        case 'UPDATE_RICHTEXT':
          if (message.fieldPath && message.htmlValue) {
            updateRichText(message.fieldPath, message.htmlValue)
          }
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [moveBlock, deleteBlock, duplicateBlock, addBlock, getBlockTypes, replaceImage, updateSelectField, toggleCheckbox, moveArrayItem, updateRichText])

  // Render nothing - this is a bridge component
  return null
}

export default VisualEditorFormBridge
