'use client'

import { useState, useEffect } from 'react'
import { Term } from '@/app/page'
import { useLanguage } from '@/contexts/LanguageContext'

interface SplitDocumentViewerProps {
  sourceDocumentText: string
  targetDocumentText: string
  terms: Term[]
  selectedTerm: Term | null
  sourceLanguage?: string
  targetLanguage?: string
}

export default function SplitDocumentViewer({
  sourceDocumentText,
  targetDocumentText,
  terms,
  selectedTerm,
  sourceLanguage,
  targetLanguage
}: SplitDocumentViewerProps) {
  const { language } = useLanguage()
  const [sourceHtml, setSourceHtml] = useState('')
  const [targetHtml, setTargetHtml] = useState('')

  useEffect(() => {
    // Przygotuj HTML dla dokumentu źródłowego
    const prepareSourceHtml = () => {
      let html = sourceDocumentText

      // Zaznacz wszystkie terminy źródłowe na czerwono
      terms.forEach(term => {
        if (!term.term) return

        const regex = new RegExp(`(${escapeRegex(term.term)})`, 'gi')
        html = html.replace(regex, (match) => {
          const isSelected = selectedTerm?.id === term.id
          return `<mark class="${isSelected ? 'bg-red-600 text-white font-bold' : 'bg-red-200 text-red-900'}">${match}</mark>`
        })
      })

      return html.replace(/\n/g, '<br>')
    }

    // Przygotuj HTML dla dokumentu docelowego
    const prepareTargetHtml = () => {
      let html = targetDocumentText

      // Zaznacz wszystkie terminy docelowe na czerwono
      terms.forEach(term => {
        if (!term.targetTerm) return

        const regex = new RegExp(`(${escapeRegex(term.targetTerm)})`, 'gi')
        html = html.replace(regex, (match) => {
          const isSelected = selectedTerm?.id === term.id
          return `<mark class="${isSelected ? 'bg-red-600 text-white font-bold' : 'bg-red-200 text-red-900'}">${match}</mark>`
        })
      })

      return html.replace(/\n/g, '<br>')
    }

    setSourceHtml(prepareSourceHtml())
    setTargetHtml(prepareTargetHtml())
  }, [sourceDocumentText, targetDocumentText, terms, selectedTerm])

  // Escape special regex characters
  const escapeRegex = (str: string) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  // Scroll to selected term
  useEffect(() => {
    if (selectedTerm) {
      // Scroll to the term in both documents
      const marks = document.querySelectorAll('mark.bg-red-600')
      if (marks.length > 0) {
        marks[0].scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [selectedTerm])

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">
        {language === 'pl' ? 'Podgląd dokumentów' : 'Document Preview'}
      </h2>

      <div className="grid grid-cols-2 gap-6">
        {/* Source Document */}
        <div className="border-2 border-blue-300 rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-3">
            <h3 className="font-semibold flex items-center gap-2">
              <span>📄</span>
              <span>
                {language === 'pl' ? 'Dokument źródłowy' : 'Source Document'}
                {sourceLanguage && <span className="ml-2 text-sm opacity-90">({sourceLanguage.toUpperCase()})</span>}
              </span>
            </h3>
          </div>
          <div
            className="p-4 bg-gray-50 overflow-y-auto max-h-[600px] text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: sourceHtml }}
          />
        </div>

        {/* Target Document */}
        <div className="border-2 border-purple-300 rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-4 py-3">
            <h3 className="font-semibold flex items-center gap-2">
              <span>📄</span>
              <span>
                {language === 'pl' ? 'Dokument docelowy' : 'Target Document'}
                {targetLanguage && <span className="ml-2 text-sm opacity-90">({targetLanguage.toUpperCase()})</span>}
              </span>
            </h3>
          </div>
          <div
            className="p-4 bg-gray-50 overflow-y-auto max-h-[600px] text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: targetHtml }}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <span className="inline-block w-4 h-4 bg-red-200 border border-red-300"></span>
          <span>{language === 'pl' ? 'Terminy w glosariuszu' : 'Terms in glossary'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-4 h-4 bg-red-600"></span>
          <span>{language === 'pl' ? 'Aktualnie wybrany termin' : 'Currently selected term'}</span>
        </div>
      </div>
    </div>
  )
}
