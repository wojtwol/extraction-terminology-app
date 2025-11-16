'use client'

import { useState, useEffect, useRef } from 'react'
import { Term } from '@/app/page'

interface DocumentViewerProps {
  documentText: string
  selectedTerm: Term | null
  fileName: string
  terms: Term[]
  onAddTermFromSelection?: (termText: string) => void
}

export default function DocumentViewer({ documentText, selectedTerm, fileName, terms, onAddTermFromSelection }: DocumentViewerProps) {
  const [currentOccurrence, setCurrentOccurrence] = useState(0)
  const [selectedText, setSelectedText] = useState('')
  const [showAddButton, setShowAddButton] = useState(false)
  const [buttonPosition, setButtonPosition] = useState({ top: 0, left: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const highlightRefs = useRef<(HTMLSpanElement | null)[]>([])

  // Reset current occurrence when selected term changes
  useEffect(() => {
    setCurrentOccurrence(0)
    highlightRefs.current = []
  }, [selectedTerm])

  // Obsługa zaznaczania tekstu
  useEffect(() => {
    const handleTextSelection = () => {
      const selection = window.getSelection()
      const text = selection?.toString().trim() || ''

      if (text && text.length >= 2 && containerRef.current?.contains(selection?.anchorNode || null)) {
        setSelectedText(text)

        // Pobierz pozycję zaznaczenia
        const range = selection?.getRangeAt(0)
        if (range) {
          const rect = range.getBoundingClientRect()
          setButtonPosition({
            top: rect.bottom + window.scrollY + 5,
            left: rect.left + window.scrollX
          })
        }

        setShowAddButton(true)
      } else {
        setShowAddButton(false)
      }
    }

    document.addEventListener('mouseup', handleTextSelection)
    document.addEventListener('keyup', handleTextSelection)

    return () => {
      document.removeEventListener('mouseup', handleTextSelection)
      document.removeEventListener('keyup', handleTextSelection)
    }
  }, [])

  // Dodaj zaznaczony tekst do glosariusza
  const handleAddSelectedTerm = () => {
    if (selectedText && onAddTermFromSelection) {
      onAddTermFromSelection(selectedText)
      setShowAddButton(false)
      setSelectedText('')
      window.getSelection()?.removeAllRanges()
    }
  }

  // Scroll to current occurrence
  useEffect(() => {
    if (selectedTerm && highlightRefs.current[currentOccurrence]) {
      highlightRefs.current[currentOccurrence]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
    }
  }, [currentOccurrence, selectedTerm])

  const navigateNext = () => {
    if (selectedTerm && currentOccurrence < selectedTerm.positions.length - 1) {
      setCurrentOccurrence(prev => prev + 1)
    }
  }

  const navigatePrevious = () => {
    if (selectedTerm && currentOccurrence > 0) {
      setCurrentOccurrence(prev => prev - 1)
    }
  }

  const renderHighlightedText = () => {
    if (!terms || terms.length === 0) {
      return <p className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">{documentText}</p>
    }

    // Create a list of all term occurrences with their metadata
    type Occurrence = {
      position: number
      length: number
      termId: string
      termText: string
      isSelected: boolean
      selectedOccurrenceIndex?: number
    }

    const allOccurrences: Occurrence[] = []

    terms.forEach(term => {
      term.positions.forEach((position, occIdx) => {
        allOccurrences.push({
          position,
          length: term.term.length,
          termId: term.id,
          termText: term.term,
          isSelected: selectedTerm?.id === term.id,
          selectedOccurrenceIndex: selectedTerm?.id === term.id ? occIdx : undefined
        })
      })
    })

    // Sort by position
    allOccurrences.sort((a, b) => a.position - b.position)

    const segments: JSX.Element[] = []
    let lastIndex = 0
    let refIndex = 0

    allOccurrences.forEach((occ, idx) => {
      // Skip overlapping occurrences
      if (occ.position < lastIndex) {
        return
      }

      // Add text before this occurrence
      if (occ.position > lastIndex) {
        segments.push(
          <span key={`text-${idx}`}>
            {documentText.substring(lastIndex, occ.position)}
          </span>
        )
      }

      // Determine highlight color
      const isActiveOccurrence = occ.isSelected && occ.selectedOccurrenceIndex === currentOccurrence
      const isSelectedTerm = occ.isSelected

      segments.push(
        <span
          key={`highlight-${idx}`}
          ref={isSelectedTerm ? (el) => {
            if (el) highlightRefs.current[refIndex++] = el
          } : undefined}
          className={`${
            isActiveOccurrence
              ? 'bg-yellow-300 font-bold border-2 border-yellow-600'
              : isSelectedTerm
              ? 'bg-yellow-100'
              : 'text-red-600 font-semibold'
          } px-0.5 rounded transition-all duration-200`}
          title={occ.termText}
        >
          {documentText.substring(occ.position, occ.position + occ.length)}
        </span>
      )

      lastIndex = occ.position + occ.length
    })

    // Add remaining text
    if (lastIndex < documentText.length) {
      segments.push(
        <span key="text-end">
          {documentText.substring(lastIndex)}
        </span>
      )
    }

    return <p className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">{segments}</p>
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 relative">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-800">Dokument źródłowy</h3>
          <p className="text-sm text-gray-600">{fileName}</p>
        </div>

        {selectedTerm && (
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-700">
              <span className="font-semibold">
                Wybrany termin: {selectedTerm.term}
              </span>
              <br />
              <span className="text-xs text-gray-500">
                Wystąpienie {currentOccurrence + 1} z {selectedTerm.positions.length}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={navigatePrevious}
                disabled={currentOccurrence === 0}
                className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
                title="Poprzednie wystąpienie"
              >
                ← Poprzedni
              </button>
              <button
                onClick={navigateNext}
                disabled={!selectedTerm || currentOccurrence >= selectedTerm.positions.length - 1}
                className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
                title="Następne wystąpienie"
              >
                Następny →
              </button>
            </div>
          </div>
        )}
      </div>

      {!selectedTerm && terms.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-sm text-gray-500 italic">
            Wszystkie terminy z glosariusza są podświetlone na czerwono. Kliknij na termin w tabeli, aby podświetlić jego wystąpienia na żółto.
          </p>
          {onAddTermFromSelection && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex-1">
                <p className="text-sm text-blue-800 font-semibold">
                  💡 Szybkie dodawanie terminów
                </p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Zaznacz dowolny fragment tekstu w dokumencie poniżej, a następnie kliknij przycisk:
                </p>
              </div>
              <button
                onClick={() => {
                  if (selectedText) {
                    handleAddSelectedTerm()
                  } else {
                    alert('Najpierw zaznacz fragment tekstu w dokumencie poniżej.')
                  }
                }}
                disabled={!selectedText}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
                title={selectedText ? `Dodaj zaznaczony tekst: "${selectedText.substring(0, 30)}${selectedText.length > 30 ? '...' : ''}"` : 'Zaznacz tekst w dokumencie'}
              >
                <span>➕</span>
                <span>
                  {selectedText
                    ? `Dodaj "${selectedText.length > 20 ? selectedText.substring(0, 20) + '...' : selectedText}"`
                    : 'Dodaj zaznaczony tekst'}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      <div
        ref={containerRef}
        className="border border-gray-300 rounded-lg p-4 bg-gray-50 max-h-[600px] overflow-y-auto"
      >
        {renderHighlightedText()}
      </div>

      <div className="mt-3 text-xs text-gray-500 flex items-center gap-4">
        <div className="flex items-center gap-1">
          <span className="inline-block text-red-600 font-semibold px-2 py-0.5 rounded border border-red-300">Czerwony</span>
          <span>= wszystkie terminy z glosariusza</span>
        </div>
        {selectedTerm && (
          <>
            <div className="flex items-center gap-1">
              <span className="inline-block bg-yellow-100 px-2 py-0.5 rounded">Żółty</span>
              <span>= wystąpienia wybranego terminu</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block bg-yellow-300 border-2 border-yellow-600 px-2 py-0.5 rounded">Żółty pogrubiony</span>
              <span>= aktualne wystąpienie</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
