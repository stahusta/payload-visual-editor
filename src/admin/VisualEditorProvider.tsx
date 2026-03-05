'use client'
import React, { useCallback, useEffect, useRef } from 'react'
import { MESSAGE_TYPE, RESPONSE_TYPE } from '../constants.js'
import type { VisualEditorMessage, VisualEditorResponse } from '../types.js'

/**
 * Admin-side provider that handles postMessages from the Visual Editor overlay
 * in the Live Preview iframe. Injected via plugin into admin.components.providers.
 */
export const VisualEditorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const lastHighlightRef = useRef<HTMLElement | null>(null)

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

  const focusAdminField = useCallback(
    (fieldPath: string, blockIndex?: number) => {
      if (lastHighlightRef.current) {
        lastHighlightRef.current.style.outline = ''
        lastHighlightRef.current.style.outlineOffset = ''
        lastHighlightRef.current = null
      }

      if (blockIndex !== undefined) {
        const blockRows = document.querySelectorAll('[id^="layout-row-"]')
        const targetRow = blockRows[blockIndex] as HTMLElement | undefined
        if (targetRow) {
          const collapsible = targetRow.querySelector('[data-collapsed="true"]') as HTMLElement
          if (collapsible) {
            const toggle = targetRow.querySelector('button[type="button"]') as HTMLElement
            toggle?.click()
          }
        }
      }

      const fieldId = `field-${fieldPath.replace(/\./g, '__')}`

      setTimeout(() => {
        let fieldElement = document.getElementById(fieldId)

        if (!fieldElement) {
          const input = document.querySelector(
            `[name="${fieldPath}"], [name="${fieldPath.replace(/\./g, '__')}"]`,
          ) as HTMLElement | null
          fieldElement = input?.closest('.field-type') as HTMLElement | null
        }

        // Fallback: try aria-label or data attributes (Lexical/richText)
        if (!fieldElement) {
          fieldElement = document.querySelector(
            `[id*="${fieldPath.split('.').pop()}"][class*="field-type"], ` +
            `[data-field-path="${fieldPath}"]`,
          ) as HTMLElement | null
        }

        if (fieldElement) {
          fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
          fieldElement.style.outline = '2px solid #3b82f6'
          fieldElement.style.outlineOffset = '4px'
          lastHighlightRef.current = fieldElement

          // Focus: try input/textarea first, then Lexical contentEditable
          const input = fieldElement.querySelector('input, textarea, [contenteditable="true"]') as HTMLElement
          input?.focus()

          setTimeout(() => {
            if (lastHighlightRef.current === fieldElement) {
              fieldElement!.style.outline = ''
              fieldElement!.style.outlineOffset = ''
              lastHighlightRef.current = null
            }
          }, 3000)

          sendToIframe({ type: RESPONSE_TYPE, action: 'FIELD_FOCUSED', fieldPath, success: true })
        } else {
          sendToIframe({ type: RESPONSE_TYPE, action: 'FIELD_FOCUSED', fieldPath, success: false })
        }
      }, 350)
    },
    [sendToIframe],
  )

  const updateFieldValue = useCallback(
    (fieldPath: string, value: string) => {
      const input = document.querySelector(
        `input[name="${fieldPath}"], textarea[name="${fieldPath}"]`,
      ) as HTMLInputElement | HTMLTextAreaElement | null

      if (input) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
        const nativeTextareaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
        const setter = input.tagName === 'TEXTAREA' ? nativeTextareaSetter : nativeInputValueSetter
        setter?.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
        sendToIframe({ type: RESPONSE_TYPE, action: 'FIELD_UPDATED', fieldPath, success: true })
      } else {
        sendToIframe({ type: RESPONSE_TYPE, action: 'FIELD_UPDATED', fieldPath, success: false })
      }
    },
    [sendToIframe],
  )

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== MESSAGE_TYPE) return
      const message = event.data as VisualEditorMessage

      switch (message.action) {
        case 'FOCUS_FIELD':
          if (message.fieldPath) focusAdminField(message.fieldPath, message.blockIndex)
          break
        case 'UPDATE_FIELD':
          if (message.fieldPath && message.value !== undefined) updateFieldValue(message.fieldPath, message.value)
          break
        case 'EDITOR_READY':
          break

        case 'RESIZE_PREVIEW':
          {
            const iframe = getIframe()
            if (iframe) {
              const width = message.previewWidth
              const parent = iframe.parentElement
              if (width && width > 0) {
                if (parent) {
                  parent.style.display = 'flex'
                  parent.style.justifyContent = 'center'
                  parent.style.alignItems = 'flex-start'
                }
                iframe.style.maxWidth = `${width}px`
                iframe.style.width = '100%'
                iframe.style.transition = 'max-width 0.3s ease'
              } else {
                if (parent) {
                  parent.style.display = ''
                  parent.style.justifyContent = ''
                  parent.style.alignItems = ''
                }
                iframe.style.maxWidth = ''
                iframe.style.width = ''
                iframe.style.transition = ''
              }
              sendToIframe({ type: RESPONSE_TYPE, action: 'PREVIEW_RESIZED', success: true })
            }
          }
          break

        case 'UNDO':
          {
            const target = document.activeElement || document.body
            target.dispatchEvent(new KeyboardEvent('keydown', {
              key: 'z',
              code: 'KeyZ',
              ctrlKey: true,
              metaKey: true,
              bubbles: true,
              cancelable: true,
            }))
          }
          break

        case 'REDO':
          {
            const target = document.activeElement || document.body
            target.dispatchEvent(new KeyboardEvent('keydown', {
              key: 'z',
              code: 'KeyZ',
              ctrlKey: true,
              shiftKey: true,
              metaKey: true,
              bubbles: true,
              cancelable: true,
            }))
          }
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [focusAdminField, updateFieldValue, getIframe, sendToIframe])

  return <>{children}</>
}

export default VisualEditorProvider
