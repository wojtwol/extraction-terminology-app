'use client'

import { useState, useEffect, useRef } from 'react'

interface BaseFormModalProps {
  isOpen: boolean
  foundForm: string
  language: string
  onConfirm: (baseForm: string) => void
  onCancel: () => void
}

export default function BaseFormModal({
  isOpen,
  foundForm,
  language,
  onConfirm,
  onCancel
}: BaseFormModalProps) {
  const [baseForm, setBaseForm] = useState(foundForm)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setBaseForm(foundForm)
      // Focus input po otwarciu
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, foundForm])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (baseForm.trim()) {
      onConfirm(baseForm.trim())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel()
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4">
          <h3 className="text-xl font-bold text-white">
            {language === 'pl' ? 'Podaj formę podstawową' : 'Enter base form'}
          </h3>
          <p className="text-blue-100 text-sm mt-1">
            {language === 'pl'
              ? 'Mianownik dla rzeczowników, bezokolicznik dla czasowników'
              : 'Nominative for nouns, infinitive for verbs'}
          </p>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Found form display */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-500 mb-1">
              {language === 'pl' ? 'Znaleziono w dokumencie:' : 'Found in document:'}
            </label>
            <div className="bg-gray-100 rounded-lg px-4 py-3 text-gray-700 font-medium border border-gray-200">
              "{foundForm}"
            </div>
          </div>

          {/* Base form input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {language === 'pl' ? 'Forma podstawowa:' : 'Base form:'}
            </label>
            <input
              ref={inputRef}
              type="text"
              value={baseForm}
              onChange={(e) => setBaseForm(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-gray-800 font-medium"
              placeholder={language === 'pl' ? 'Wpisz formę podstawową...' : 'Enter base form...'}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
            >
              {language === 'pl' ? 'Anuluj' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={!baseForm.trim()}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {language === 'pl' ? 'Dodaj termin' : 'Add term'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
