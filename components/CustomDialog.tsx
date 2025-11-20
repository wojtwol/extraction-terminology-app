'use client'

import { useState, useEffect } from 'react'

interface CustomDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm?: (value?: string) => void
  title: string
  message?: string
  type?: 'alert' | 'confirm' | 'prompt' | 'warning'
  inputPlaceholder?: string
  inputDefaultValue?: string
  confirmText?: string
  cancelText?: string
  icon?: 'warning' | 'info' | 'success' | 'error' | 'question'
}

export default function CustomDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'alert',
  inputPlaceholder = '',
  inputDefaultValue = '',
  confirmText = 'OK',
  cancelText = 'Anuluj',
  icon
}: CustomDialogProps) {
  const [inputValue, setInputValue] = useState(inputDefaultValue)

  useEffect(() => {
    setInputValue(inputDefaultValue)
  }, [inputDefaultValue, isOpen])

  if (!isOpen) return null

  const handleConfirm = () => {
    if (type === 'prompt') {
      onConfirm?.(inputValue)
    } else {
      onConfirm?.()
    }
    onClose()
  }

  const handleCancel = () => {
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'alert') {
      handleConfirm()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  const getIconComponent = () => {
    const iconType = icon || (type === 'warning' ? 'warning' : type === 'confirm' ? 'question' : 'info')

    switch (iconType) {
      case 'warning':
      case 'error':
        return (
          <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-red-100">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        )
      case 'success':
        return (
          <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-green-100">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )
      case 'question':
        return (
          <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-blue-100">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )
      case 'info':
      default:
        return (
          <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-blue-100">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleCancel}
      ></div>

      {/* Dialog */}
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="relative bg-white rounded-lg shadow-2xl max-w-md w-full p-6 transform transition-all">
          {/* Header with Icon */}
          <div className="flex items-start gap-4 mb-4">
            {getIconComponent()}

            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {title}
              </h3>
              {message && (
                <p className="text-sm text-gray-600 leading-relaxed">
                  {message}
                </p>
              )}
            </div>
          </div>

          {/* Input field for prompt type */}
          {type === 'prompt' && (
            <div className="mt-4">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={inputPlaceholder}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 mt-6 justify-end">
            {type !== 'alert' && (
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                {cancelText}
              </button>
            )}
            <button
              onClick={handleConfirm}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${
                type === 'warning' || type === 'alert' && icon === 'warning'
                  ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                  : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
              }`}
              autoFocus={type === 'alert'}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
