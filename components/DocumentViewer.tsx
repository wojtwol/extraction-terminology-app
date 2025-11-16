'use client'

import { useState, useEffect, useRef } from 'react'
import { Term } from '@/app/page'

interface DocumentViewerProps {
  documentText: string
  selectedTerm: Term | null
  fileName: string
}

export default function DocumentViewer({ documentText, selectedTerm, fileName }: DocumentViewerProps) {
  const [currentOccurrence, setCurrentOccurrence] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const highlightRefs = useRef<(HTMLSpanElement | null)[]>([])

  // Reset current occurrence when selected term changes
  useEffect(() => {
    setCurrentOccurrence(0)
    highlightRefs.current = []
  }, [selectedTerm])

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
    if (!selectedTerm || selectedTerm.positions.length === 0) {
      return <p className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">{documentText}</p>
    }

    const termLength = selectedTerm.term.length
    const segments: JSX.Element[] = []
    let lastIndex = 0
    let refIndex = 0

    // Sort positions to process them in order
    const sortedPositions = [...selectedTerm.positions].sort((a, b) => a - b)

    sortedPositions.forEach((position, idx) => {
      // Add text before this occurrence
      if (position > lastIndex) {
        segments.push(
          <span key={`text-${idx}`}>
            {documentText.substring(lastIndex, position)}
          </span>
        )
      }

      // Add highlighted occurrence
      const isActive = idx === currentOccurrence
      segments.push(
        <span
          key={`highlight-${idx}`}
          ref={(el) => {
            highlightRefs.current[refIndex] = el
            refIndex++
          }}
          className={`${
            isActive
              ? 'bg-yellow-300 font-bold border-2 border-yellow-600'
              : 'bg-yellow-100'
          } px-0.5 rounded transition-all duration-200`}
        >
          {documentText.substring(position, position + termLength)}
        </span>
      )

      lastIndex = position + termLength
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
    <div className="bg-white rounded-lg shadow-lg p-6">
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

      {!selectedTerm && (
        <p className="text-sm text-gray-500 mb-4 italic">
          Kliknij na termin w tabeli, aby podświetlić jego wystąpienia w dokumencie
        </p>
      )}

      <div
        ref={containerRef}
        className="border border-gray-300 rounded-lg p-4 bg-gray-50 max-h-[600px] overflow-y-auto"
      >
        {renderHighlightedText()}
      </div>

      <div className="mt-3 text-xs text-gray-500">
        <span className="inline-block bg-yellow-100 px-2 py-0.5 rounded mr-2">Żółty</span>
        = wystąpienia terminu
        <span className="inline-block bg-yellow-300 border-2 border-yellow-600 px-2 py-0.5 rounded mx-2">Żółty pogrubiony</span>
        = aktualne wystąpienie
      </div>
    </div>
  )
}
