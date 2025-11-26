'use client'

import { useState, useEffect, useRef } from 'react'
import { Term } from '@/app/page'
import { useLanguage } from '@/contexts/LanguageContext'

interface SplitDocumentViewerProps {
  sourceDocumentText: string
  targetDocumentText: string
  terms: Term[]
  selectedTerm: Term | null
  sourceLanguage?: string
  targetLanguage?: string
  onAddManualTerm?: (targetTerm: string) => void
}

export default function SplitDocumentViewer({
  sourceDocumentText,
  targetDocumentText,
  terms,
  selectedTerm,
  sourceLanguage,
  targetLanguage,
  onAddManualTerm
}: SplitDocumentViewerProps) {
  const { language } = useLanguage()
  const [sourceHtml, setSourceHtml] = useState('')
  const [targetHtml, setTargetHtml] = useState('')
  const [syncScroll, setSyncScroll] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [showAddButton, setShowAddButton] = useState(false)
  const sourceRef = useRef<HTMLDivElement>(null)
  const targetRef = useRef<HTMLDivElement>(null)
  const isScrollingRef = useRef(false)

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

      return html
    }

    // Przygotuj HTML dla dokumentu docelowego
    const prepareTargetHtml = () => {
      let html = targetDocumentText

      // Zaznacz wszystkie terminy docelowe na czerwono
      // Używaj targetFoundForm (forma fleksyjna z dokumentu) zamiast targetTerm (lemma)
      terms.forEach(term => {
        // Użyj targetFoundForm jeśli dostępne, inaczej targetTerm
        const termToHighlight = term.targetFoundForm || term.targetTerm
        if (!termToHighlight) return

        const regex = new RegExp(`(${escapeRegex(termToHighlight)})`, 'gi')
        html = html.replace(regex, (match) => {
          const isSelected = selectedTerm?.id === term.id
          return `<mark class="${isSelected ? 'bg-red-600 text-white font-bold' : 'bg-red-200 text-red-900'}">${match}</mark>`
        })
      })

      return html
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

  // Synchronized scrolling handler
  const handleScroll = (source: 'source' | 'target') => (e: React.UIEvent<HTMLDivElement>) => {
    if (!syncScroll || isScrollingRef.current) return

    const scrollingDiv = e.currentTarget
    const targetDiv = source === 'source' ? targetRef.current : sourceRef.current

    if (!targetDiv) return

    isScrollingRef.current = true

    // Calculate scroll percentage
    const scrollPercentage = scrollingDiv.scrollTop / (scrollingDiv.scrollHeight - scrollingDiv.clientHeight)

    // Apply to target div
    targetDiv.scrollTop = scrollPercentage * (targetDiv.scrollHeight - targetDiv.clientHeight)

    // Reset flag after a short delay
    setTimeout(() => {
      isScrollingRef.current = false
    }, 50)
  }

  // Handle text selection in target document
  const handleTextSelection = () => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) {
      setShowAddButton(false)
      return
    }

    const text = selection.toString().trim()

    // Sprawdź czy zaznaczenie jest w dokumencie docelowym
    const isInTargetDoc = targetRef.current?.contains(selection.anchorNode || null) &&
                          targetRef.current?.contains(selection.focusNode || null)

    if (!isInTargetDoc) {
      setShowAddButton(false)
      return
    }

    // Walidacja zaznaczonego tekstu:
    // 1. Nie może być pusty
    // 2. Nie może być dłuższy niż 200 znaków (typowy termin to max kilkadziesiąt znaków)
    // 3. Nie może zawierać więcej niż 3 nowych linii (zapobiega zaznaczaniu całych akapitów)
    const newLineCount = (text.match(/\n/g) || []).length

    if (text && text.length > 0 && text.length <= 200 && newLineCount <= 3) {
      setSelectedText(text)
      setShowAddButton(true)
    } else {
      setShowAddButton(false)
      if (text.length > 200) {
        console.warn('⚠️ Zaznaczony tekst jest zbyt długi (max 200 znaków)')
      }
      if (newLineCount > 3) {
        console.warn('⚠️ Zaznaczony tekst zawiera zbyt wiele nowych linii (max 3)')
      }
    }
  }

  // Add manual term
  const handleAddTerm = () => {
    if (selectedText && onAddManualTerm) {
      onAddManualTerm(selectedText)
      setSelectedText('')
      setShowAddButton(false)
      window.getSelection()?.removeAllRanges()
    }
  }

  // Listen for text selection
  useEffect(() => {
    document.addEventListener('selectionchange', handleTextSelection)
    return () => {
      document.removeEventListener('selectionchange', handleTextSelection)
    }
  }, [])

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold text-gray-800">
          {language === 'pl' ? 'Podgląd dokumentów' : 'Document Preview'}
        </h2>

        {/* Synchronized scrolling checkbox */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={syncScroll}
            onChange={(e) => setSyncScroll(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">
            {language === 'pl' ? 'Synchroniczne przewijanie' : 'Synchronized scrolling'}
          </span>
        </label>
      </div>

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
            ref={sourceRef}
            className="p-4 bg-gray-50 overflow-y-auto max-h-[600px] text-sm leading-relaxed whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: sourceHtml }}
            onScroll={handleScroll('source')}
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
            ref={targetRef}
            className="p-4 bg-gray-50 overflow-y-auto max-h-[600px] text-sm leading-relaxed whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: targetHtml }}
            onScroll={handleScroll('target')}
          />
        </div>
      </div>

      {/* Floating add button */}
      {showAddButton && selectedText && onAddManualTerm && (
        <div className="fixed bottom-8 right-8 z-50 flex items-center gap-3 bg-white rounded-lg shadow-2xl border-2 border-green-500 p-4">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gray-700 mb-1">
              {language === 'pl' ? 'Zaznaczony tekst:' : 'Selected text:'}
            </span>
            <span className="text-sm text-gray-600 max-w-xs truncate">"{selectedText}"</span>
          </div>
          <button
            onClick={handleAddTerm}
            className="bg-green-500 hover:bg-green-600 text-white rounded-full w-12 h-12 flex items-center justify-center text-2xl font-bold shadow-lg transition-all hover:scale-110"
            title={language === 'pl' ? 'Dodaj termin do glosariusza' : 'Add term to glossary'}
          >
            +
          </button>
        </div>
      )}

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
