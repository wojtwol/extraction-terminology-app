'use client'

import { useEffect, useState } from 'react'

export interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message?: string
  duration?: number
}

interface ToastProps {
  toast: ToastMessage
  onClose: (id: string) => void
}

const Toast = ({ toast, onClose }: ToastProps) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  useEffect(() => {
    // Animacja wejścia
    const showTimer = setTimeout(() => setIsVisible(true), 10)

    // Auto-zamknięcie
    const duration = toast.duration || 4000
    const hideTimer = setTimeout(() => {
      setIsLeaving(true)
      setTimeout(() => onClose(toast.id), 300)
    }, duration)

    return () => {
      clearTimeout(showTimer)
      clearTimeout(hideTimer)
    }
  }, [toast, onClose])

  const handleClose = () => {
    setIsLeaving(true)
    setTimeout(() => onClose(toast.id), 300)
  }

  const icons = {
    success: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    error: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    warning: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    info: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }

  const colors = {
    success: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white',
    error: 'bg-gradient-to-r from-red-500 to-rose-500 text-white',
    warning: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white',
    info: 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
  }

  return (
    <div
      className={`
        transform transition-all duration-300 ease-out
        ${isVisible && !isLeaving ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        ${colors[toast.type]}
        rounded-xl shadow-2xl p-4 min-w-[320px] max-w-md
        backdrop-blur-sm border border-white/20
      `}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {icons[toast.type]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-base">{toast.title}</p>
          {toast.message && (
            <p className="mt-1 text-sm opacity-90 whitespace-pre-line">{toast.message}</p>
          )}
        </div>
        <button
          onClick={handleClose}
          className="flex-shrink-0 p-1 hover:bg-white/20 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

interface ToastContainerProps {
  toasts: ToastMessage[]
  onClose: (id: string) => void
}

export const ToastContainer = ({ toasts, onClose }: ToastContainerProps) => {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3">
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  )
}

// Hook do zarządzania toastami
export const useToast = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const showToast = (type: ToastMessage['type'], title: string, message?: string, duration?: number) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    setToasts(prev => [...prev, { id, type, title, message, duration }])
  }

  const closeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return {
    toasts,
    showToast,
    closeToast,
    success: (title: string, message?: string, duration?: number) => showToast('success', title, message, duration),
    error: (title: string, message?: string, duration?: number) => showToast('error', title, message, duration),
    warning: (title: string, message?: string, duration?: number) => showToast('warning', title, message, duration),
    info: (title: string, message?: string, duration?: number) => showToast('info', title, message, duration)
  }
}

export default Toast
