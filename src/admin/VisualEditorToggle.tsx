'use client'
import React, { useCallback, useEffect, useState } from 'react'
import { MESSAGE_TYPE, RESPONSE_TYPE, IFRAME_READY_DELAY } from '../constants.js'
import type { VisualEditorMessage, VisualEditorResponse } from '../types.js'

const STORAGE_KEY = 'payload-ve-enabled'

/**
 * Toggle button for the Visual Editor overlay.
 * Injected via plugin into collection edit view header (beforeDocumentControls).
 * Sends SET_MODE to the Live Preview iframe to enable/disable the overlay.
 */
const VisualEditorToggle: React.FC = () => {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === 'undefined') return true
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === null ? true : stored === 'true'
  })

  const getIframe = useCallback((): HTMLIFrameElement | null => {
    return document.querySelector('iframe.live-preview-iframe') as HTMLIFrameElement | null
  }, [])

  const sendMode = useCallback(
    (isEnabled: boolean) => {
      const iframe = getIframe()
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage(
          { type: RESPONSE_TYPE, action: 'SET_MODE', enabled: isEnabled } satisfies VisualEditorResponse,
          '*',
        )
      }
    },
    [getIframe],
  )

  const handleToggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      sendMode(next)
      return next
    })
  }, [sendMode])

  // Send initial state on mount - retry to catch iframe at different load stages
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    const isEnabled = stored === null ? true : stored === 'true'
    // Try immediately + retries (iframe might not be ready yet on first mount)
    sendMode(isEnabled)
    const t1 = setTimeout(() => sendMode(isEnabled), 500)
    const t2 = setTimeout(() => sendMode(isEnabled), 1500)
    // Note: retries needed because iframe loads asynchronously
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [sendMode])

  // When iframe sends EDITOR_READY, respond with current enabled state
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== MESSAGE_TYPE) return
      const message = event.data as VisualEditorMessage
      if (message.action === 'EDITOR_READY') {
        const stored = localStorage.getItem(STORAGE_KEY)
        const isEnabled = stored === null ? true : stored === 'true'
        // Small delay to ensure iframe listener is ready
        setTimeout(() => sendMode(isEnabled), IFRAME_READY_DELAY)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [sendMode])

  return (
    <button
      type="button"
      onClick={handleToggle}
      title={enabled ? 'Disable Visual Editor' : 'Enable Visual Editor'}
      aria-label={enabled ? 'Disable Visual Editor' : 'Enable Visual Editor'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        border: 'none',
        borderRadius: 4,
        background: enabled ? 'var(--theme-elevation-150, rgba(255,255,255,0.08))' : 'transparent',
        color: enabled ? 'var(--theme-success-500, #22c55e)' : 'var(--theme-elevation-400, rgba(255,255,255,0.3))',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        padding: 0,
        marginRight: 4,
      }}
    >
      {enabled ? (
        // Eye open icon
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ) : (
        // Eye closed icon
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
          <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
          <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
          <path d="m2 2 20 20" />
        </svg>
      )}
    </button>
  )
}

export { VisualEditorToggle }
export default VisualEditorToggle
