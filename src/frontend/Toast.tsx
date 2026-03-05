import React, { useEffect, useState } from 'react'

export interface ToastItem {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

let toastId = 0
export const createToastId = () => ++toastId

export const Toast: React.FC<{ toasts: ToastItem[] }> = ({ toasts }) => {
  if (toasts.length === 0) return null

  return (
    <div className="payload-ve__toast-container">
      {toasts.map((toast) => (
        <ToastEntry key={toast.id} toast={toast} />
      ))}
    </div>
  )
}

const ToastEntry: React.FC<{ toast: ToastItem }> = ({ toast }) => {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  return (
    <div
      className={`payload-ve__toast payload-ve__toast--${toast.type} ${visible ? 'payload-ve__toast--visible' : ''}`}
    >
      <span className="payload-ve__toast-icon">
        {toast.type === 'success' ? '\u2713' : toast.type === 'error' ? '\u2717' : '\u2139'}
      </span>
      {toast.message}
    </div>
  )
}
