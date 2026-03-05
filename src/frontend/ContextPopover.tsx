import React, { useCallback, useEffect, useRef, useState } from 'react'
import { MESSAGE_TYPE, OPTIONS_ATTR, COLLECTION_ATTR } from '../constants.js'
import type { VisualEditorMessage } from '../types.js'

interface PopoverOption {
  label: string
  value: string
}

interface ContextPopoverProps {
  fieldPath: string
  editType: string
  rect: DOMRect
  currentValue?: string
  options?: PopoverOption[]
  onClose: () => void
}

export const ContextPopover: React.FC<ContextPopoverProps> = ({
  fieldPath,
  editType,
  rect,
  currentValue,
  options,
  onClose,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedValue, setSelectedValue] = useState(currentValue || '')

  // Lock page scroll while popover is open
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

  const send = (msg: Omit<VisualEditorMessage, 'type'>) => {
    window.parent.postMessage({ type: MESSAGE_TYPE, ...msg }, '*')
  }

  // Calculate popover position (below element, centered, clamped to viewport)
  const popoverWidth = 240
  const popoverTop = rect.bottom + 8
  const popoverLeft = Math.min(
    Math.max(8, rect.left + rect.width / 2 - popoverWidth / 2),
    (typeof window !== 'undefined' ? window.innerWidth : 1024) - popoverWidth - 8,
  )

  // --- SELECT ---
  const handleSelectChange = (value: string) => {
    setSelectedValue(value)
    send({ action: 'UPDATE_SELECT', fieldPath, value })
    onClose()
  }

  // --- UPLOAD ---
  const handleFileSelect = useCallback(
    async (file: File) => {
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1]
        send({
          action: 'REPLACE_IMAGE',
          fieldPath,
          file: base64,
          fileName: file.name,
          fileType: file.type,
        })
        onClose()
      }
      reader.readAsDataURL(file)
    },
    [fieldPath, onClose],
  )

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file && file.type.startsWith('image/')) {
        handleFileSelect(file)
      }
    },
    [handleFileSelect],
  )

  // --- CHECKBOX ---
  const handleToggle = () => {
    send({ action: 'TOGGLE_CHECKBOX', fieldPath })
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div className="payload-ve__popover-backdrop" onClick={onClose} />

      {/* Popover */}
      <div
        className="payload-ve__popover"
        style={{
          position: 'fixed',
          top: popoverTop,
          left: popoverLeft,
          zIndex: 100002,
        }}
      >
        {/* SELECT type */}
        {editType === 'select' && options && (
          <div className="payload-ve__popover-content">
            <div className="payload-ve__popover-title">
              {fieldPath.split('.').pop()}
            </div>
            <div className="payload-ve__popover-options">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  className={`payload-ve__popover-option ${selectedValue === opt.value ? 'payload-ve__popover-option--active' : ''}`}
                  onClick={() => handleSelectChange(opt.value)}
                >
                  <span className="payload-ve__popover-radio">
                    {selectedValue === opt.value ? '●' : '○'}
                  </span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* UPLOAD type */}
        {editType === 'upload' && (
          <div className="payload-ve__popover-content">
            <div className="payload-ve__popover-title">Change Image</div>
            <div
              className="payload-ve__popover-dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
            >
              <button
                className="payload-ve__popover-upload-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose File
              </button>
              <span className="payload-ve__popover-drop-text">or drop image here</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileSelect(file)
                }}
              />
            </div>
          </div>
        )}

        {/* CHECKBOX type */}
        {editType === 'checkbox' && (
          <div className="payload-ve__popover-content">
            <div className="payload-ve__popover-title">
              {fieldPath.split('.').pop()}
            </div>
            <button
              className="payload-ve__popover-toggle"
              onClick={handleToggle}
            >
              Toggle {currentValue === 'true' ? 'Off' : 'On'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
