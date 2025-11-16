'use client'

import { useState, useEffect, useRef } from 'react'
import { Term } from '@/app/page'
import { useLanguage } from '@/contexts/LanguageContext'

interface DocumentSplitViewProps {
  sourceDocument: string
  targetDocument: string
  sourceLanguage: string
  targetLanguage: string
  terms: Term[]
  selectedTerm: Term | null
  onQuickAddTarget: (termId: string, targetTerm: string) => void
  onTermSelect: (term: Term) => void
}

export default function DocumentSplitView({
  sourceDocument,
  targetDocument,
  sourceLanguage,
  targetLanguage,
  terms,
  selectedTerm,
  onQuickAddTarget,
  onTermSelect
}: DocumentSplitViewProps) {
  const { language } = useLanguage()
  const [selectedText, setSelectedText] = useState('')
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null)
  const targetDocRef = useRef<HTMLDivElement>(null)

  const translations = {
    pl: {
      sourceDoc: 'Dokument źródłowy',
      targetDoc: 'Dokument docelowy',
      quickAdd: 'Dodaj jako ekwiwalent',
      noTermSelected: 'Zaznacz termin w tabeli, aby zobaczyć podświetlenia',
      selectText: 'Zaznacz tekst w dokumencie docelowym, aby dodać ekwiwalent'
    },
    en: {
      sourceDoc: 'Source Document',
      targetDoc: 'Target Document',
      quickAdd: 'Add as equivalent',
      noTermSelected: 'Select a term in the table to see highlights',
      selectText: 'Select text in target document to add equivalent'
    }
  }

  const t = translations[language as 'pl' | 'en']

  // Handle text selection in target document
  const handleTextSelection = () => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      setSelectedText('')
      setSelectionPosition(null)
      return
    }

    const text = selection.toString().trim()
    if (text.length === 0) {
      setSelectedText('')
      setSelectionPosition(null)
      return
    }

    // Check if selection is within target document
    const targetElement = targetDocRef.current
    if (!targetElement || !targetElement.contains(selection.anchorNode)) {
      setSelectedText('')
      setSelectionPosition(null)
      return
    }

    setSelectedText(text)

    // Get selection position for tooltip
    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    setSelectionPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    })
  }

  useEffect(() => {
    document.addEventListener('mouseup', handleTextSelection)
    document.addEventListener('selectionchange', handleTextSelection)

    return () => {
      document.removeEventListener('mouseup', handleTextSelection)
      document.removeEventListener('selectionchange', handleTextSelection)
    }
  }, [])

  const handleQuickAdd = () => {
    if (!selectedTerm || !selectedText) return

    onQuickAddTarget(selectedTerm.id, selectedText)
    setSelectedText('')
    setSelectionPosition(null)
    window.getSelection()?.removeAllRanges()
  }

  // Render source document with highlighted terms
  const renderSourceDocument = () => {
    if (!sourceDocument) return null

    const segments: JSX.Element[] = []
    let lastIndex = 0

    // Collect all source term positions
    const allPositions: Array<{ position: number; length: number; term: Term }> = []
    terms.forEach(term => {
      if (term.positions && term.positions.length > 0) {
        term.positions.forEach(pos => {
          allPositions.push({
            position: pos,
            length: term.term.length,
            term
          })
        })
      }
    })

    // Sort by position
    allPositions.sort((a, b) => a.position - b.position)

    // Render with highlights
    allPositions.forEach((item, idx) => {
      const { position, length, term } = item

      if (position > lastIndex) {
        segments.push(
          <span key={`text-${idx}`}>
            {sourceDocument.substring(lastIndex, position)}
          </span>
        )
      }

      const isSelected = selectedTerm?.id === term.id
      segments.push(
        <span
          key={`highlight-${idx}`}
          onClick={() => onTermSelect(term)}
          className={`cursor-pointer rounded px-0.5 transition-all ${
            isSelected
              ? 'bg-blue-300 font-bold border-2 border-blue-600'
              : 'bg-blue-100 hover:bg-blue-200'
          }`}
          title={`${term.term} (${term.occurrences}x)`}
        >
          {sourceDocument.substring(position, position + length)}
        </span>
      )

      lastIndex = position + length
    })

    if (lastIndex < sourceDocument.length) {
      segments.push(
        <span key="text-end">
          {sourceDocument.substring(lastIndex)}
        </span>
      )
    }

    return <div className="whitespace-pre-wrap text-sm leading-relaxed">{segments}</div>
  }

  // Render target document with highlighted target terms
  const renderTargetDocument = () => {
    if (!targetDocument) return null

    const segments: JSX.Element[] = []
    let lastIndex = 0

    // Collect all target term positions
    const allPositions: Array<{ position: number; length: number; term: Term }> = []
    terms.forEach(term => {
      if (term.targetTerm && term.targetPositions && term.targetPositions.length > 0) {
        term.targetPositions.forEach(pos => {
          allPositions.push({
            position: pos,
            length: term.targetTerm!.length,
            term
          })
        })
      }
    })

    // Sort by position
    allPositions.sort((a, b) => a.position - b.position)

    // Render with highlights
    allPositions.forEach((item, idx) => {
      const { position, length, term } = item

      if (position > lastIndex) {
        segments.push(
          <span key={`text-${idx}`}>
            {targetDocument.substring(lastIndex, position)}
          </span>
        )
      }

      const isSelected = selectedTerm?.id === term.id
      segments.push(
        <span
          key={`highlight-${idx}`}
          onClick={() => onTermSelect(term)}
          className={`cursor-pointer rounded px-0.5 transition-all ${
            isSelected
              ? 'bg-purple-300 font-bold border-2 border-purple-600'
              : 'bg-purple-100 hover:bg-purple-200'
          }`}
          title={`${term.targetTerm} (${term.targetOccurrences}x)`}
        >
          {targetDocument.substring(position, position + length)}
        </span>
      )

      lastIndex = position + length
    })

    if (lastIndex < targetDocument.length) {
      segments.push(
        <span key="text-end">
          {targetDocument.substring(lastIndex)}
        </span>
      )
    }

    return <div className="whitespace-pre-wrap text-sm leading-relaxed">{segments}</div>
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          {language === 'pl' ? 'Widok dokumentów' : 'Documents View'}
        </h2>
        <p className="text-sm text-gray-600">
          {selectedTerm ? (
            <>
              {language === 'pl' ? 'Zaznaczony termin:' : 'Selected term:'}{' '}
              <span className="font-semibold text-blue-600">{selectedTerm.term}</span>
              {selectedTerm.targetTerm && (
                <>
                  {' → '}
                  <span className="font-semibold text-purple-600">{selectedTerm.targetTerm}</span>
                </>
              )}
            </>
          ) : (
            t.noTermSelected
          )}
        </p>
      </div>

      {/* Legend */}
      <div className="mb-4 flex gap-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-block bg-blue-100 px-2 py-1 rounded">
            {language === 'pl' ? 'Niebieski' : 'Blue'}
          </span>
          <span className="text-gray-600">
            = {language === 'pl' ? 'terminy źródłowe' : 'source terms'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block bg-purple-100 px-2 py-1 rounded">
            {language === 'pl' ? 'Fioletowy' : 'Purple'}
          </span>
          <span className="text-gray-600">
            = {language === 'pl' ? 'terminy docelowe' : 'target terms'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block bg-blue-300 border-2 border-blue-600 px-2 py-1 rounded font-bold">
            {language === 'pl' ? 'Pogrubiony' : 'Bold'}
          </span>
          <span className="text-gray-600">
            = {language === 'pl' ? 'zaznaczony' : 'selected'}
          </span>
        </div>
      </div>

      {/* Hint */}
      {selectedTerm && !selectedTerm.targetTerm && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            💡 {t.selectText}
          </p>
        </div>
      )}

      {/* Split view */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Source Document */}
        <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50/30">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-blue-200">
            <h3 className="font-semibold text-blue-800 flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-blue-500"></span>
              {t.sourceDoc}
            </h3>
            <span className="text-xs text-blue-600 font-medium">{sourceLanguage}</span>
          </div>
          <div className="max-h-[600px] overflow-y-auto bg-white rounded p-3 border border-blue-100">
            {renderSourceDocument()}
          </div>
        </div>

        {/* Target Document */}
        <div className="border-2 border-purple-200 rounded-lg p-4 bg-purple-50/30">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-purple-200">
            <h3 className="font-semibold text-purple-800 flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-purple-500"></span>
              {t.targetDoc}
            </h3>
            <span className="text-xs text-purple-600 font-medium">{targetLanguage}</span>
          </div>
          <div
            ref={targetDocRef}
            className="max-h-[600px] overflow-y-auto bg-white rounded p-3 border border-purple-100 select-text"
          >
            {renderTargetDocument()}
          </div>
        </div>
      </div>

      {/* Quick Add Tooltip */}
      {selectedText && selectedTerm && selectionPosition && (
        <div
          className="fixed z-50 transform -translate-x-1/2 -translate-y-full"
          style={{
            left: `${selectionPosition.x}px`,
            top: `${selectionPosition.y}px`
          }}
        >
          <div className="bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 whitespace-nowrap">
            <span className="text-sm">"{selectedText}"</span>
            <button
              onClick={handleQuickAdd}
              className="bg-white text-purple-600 px-3 py-1 rounded font-semibold hover:bg-purple-50 transition-colors text-sm"
            >
              ✓ {t.quickAdd}
            </button>
          </div>
          <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-purple-600 mx-auto"></div>
        </div>
      )}
    </div>
  )
}
