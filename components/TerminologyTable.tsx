'use client'

import { useState, useEffect } from 'react'
import { Term } from '@/app/page'

interface TerminologyTableProps {
  terms: Term[]
  onUpdate: (terms: Term[]) => void
  documentText: string
  apiKey: string
  onTermSelect?: (term: Term) => void
  selectedTermId?: string | null
}

export default function TerminologyTable({ terms, onUpdate, documentText, apiKey, onTermSelect, selectedTermId }: TerminologyTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'alphabetical' | 'occurrences'>('alphabetical')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [loadingDefinitions, setLoadingDefinitions] = useState<Set<string>>(new Set())
  const [modalTerm, setModalTerm] = useState<Term | null>(null)
  const [currentOccurrence, setCurrentOccurrence] = useState(0)

  // Automatyczny scroll do pierwszego wystąpienia po otwarciu modalu
  useEffect(() => {
    if (modalTerm && modalTerm.positions.length > 0) {
      setTimeout(() => {
        const element = document.getElementById('occurrence-0')
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }, [modalTerm])

  const filteredTerms = terms.filter(term =>
    term.term.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const sortedTerms = [...filteredTerms].sort((a, b) => {
    if (sortBy === 'alphabetical') {
      return a.term.localeCompare(b.term, 'pl')
    }
    return b.occurrences - a.occurrences
  })

  const handleDelete = (id: string) => {
    if (confirm('Czy na pewno chcesz usunąć ten termin?')) {
      onUpdate(terms.filter(t => t.id !== id))
    }
  }

  const handleEdit = (term: Term) => {
    setEditingId(term.id)
    setEditValue(term.term)
  }

  const handleSaveEdit = (id: string) => {
    onUpdate(
      terms.map(t =>
        t.id === id ? { ...t, term: editValue } : t
      )
    )
    setEditingId(null)
    setEditValue('')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditValue('')
  }

  const handleOpenModal = (term: Term) => {
    setModalTerm(term)
    setCurrentOccurrence(0)
  }

  const handleCloseModal = () => {
    setModalTerm(null)
    setCurrentOccurrence(0)
  }

  const navigateNext = () => {
    if (modalTerm && currentOccurrence < modalTerm.positions.length - 1) {
      setCurrentOccurrence(prev => prev + 1)
      // Scroll to occurrence
      setTimeout(() => {
        const element = document.getElementById(`occurrence-${currentOccurrence + 1}`)
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }

  const navigatePrevious = () => {
    if (currentOccurrence > 0) {
      setCurrentOccurrence(prev => prev - 1)
      // Scroll to occurrence
      setTimeout(() => {
        const element = document.getElementById(`occurrence-${currentOccurrence - 1}`)
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }

  const renderModalContent = () => {
    if (!modalTerm) return null

    const termLength = modalTerm.term.length
    const segments: JSX.Element[] = []
    let lastIndex = 0

    const sortedPositions = [...modalTerm.positions].sort((a, b) => a - b)

    sortedPositions.forEach((position, idx) => {
      if (position > lastIndex) {
        segments.push(
          <span key={`text-${idx}`}>
            {documentText.substring(lastIndex, position)}
          </span>
        )
      }

      const isActive = idx === currentOccurrence
      segments.push(
        <span
          key={`highlight-${idx}`}
          id={`occurrence-${idx}`}
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

    if (lastIndex < documentText.length) {
      segments.push(
        <span key="text-end">
          {documentText.substring(lastIndex)}
        </span>
      )
    }

    return <p className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">{segments}</p>
  }

  const handleGenerateDefinition = async (termId: string, termText: string) => {
    setLoadingDefinitions(prev => new Set(prev).add(termId))

    try {
      const response = await fetch('/api/generate-definition', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          term: termText,
          documentText: documentText,
          apiKey: apiKey
        }),
      })

      if (!response.ok) {
        throw new Error('Błąd podczas generowania definicji')
      }

      const data = await response.json()

      onUpdate(
        terms.map(t =>
          t.id === termId
            ? {
                ...t,
                definition: data.definition,
                definitionSource: data.source
              }
            : t
        )
      )
    } catch (error) {
      console.error('Błąd generowania definicji:', error)
      alert('Nie udało się wygenerować definicji')
    } finally {
      setLoadingDefinitions(prev => {
        const newSet = new Set(prev)
        newSet.delete(termId)
        return newSet
      })
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">
        Wyekstrahowane terminy ({terms.length})
      </h2>

      <div className="mb-4 space-y-3">
        <input
          type="text"
          placeholder="Szukaj terminów..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        <div className="flex gap-2">
          <button
            onClick={() => setSortBy('alphabetical')}
            className={`px-4 py-2 rounded-lg ${
              sortBy === 'alphabetical'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Alfabetycznie
          </button>
          <button
            onClick={() => setSortBy('occurrences')}
            className={`px-4 py-2 rounded-lg ${
              sortBy === 'occurrences'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Według wystąpień
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-300">
              <th className="px-2 py-3 text-left text-sm font-semibold text-gray-700 w-8">#</th>
              <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">Termin</th>
              <th className="px-2 py-3 text-left text-sm font-semibold text-gray-700 w-20">Wystąpienia</th>
              <th className="px-2 py-3 text-left text-sm font-semibold text-gray-700">Definicja</th>
              <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">Kontekst</th>
              <th className="px-2 py-3 text-center text-sm font-semibold text-gray-700 w-24">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {sortedTerms.map((term, index) => (
              <tr
                key={term.id}
                className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${
                  selectedTermId === term.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                }`}
              >
                <td className="px-2 py-3 text-sm text-gray-600">{index + 1}</td>

                {/* Termin */}
                <td className={`px-3 py-3 ${term.term.split(' ').length >= 4 ? 'max-w-xs' : ''}`}>
                  {editingId === term.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveEdit(term.id)}
                        className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                      >
                        ✓
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <span
                      onClick={() => onTermSelect?.(term)}
                      className={`font-semibold cursor-pointer hover:text-blue-600 transition-colors ${
                        term.term.split(' ').length >= 4 ? 'break-words' : ''
                      } ${selectedTermId === term.id ? 'text-blue-600' : 'text-gray-800'
                      }`}
                      title="Kliknij, aby wyświetlić w dokumencie"
                      style={term.term.split(' ').length >= 4 ? { wordBreak: 'break-word', overflowWrap: 'break-word' } : {}}
                    >
                      {term.term}
                    </span>
                  )}
                </td>

                {/* Wystąpienia */}
                <td className="px-2 py-3 text-sm text-gray-600 text-center">
                  <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                    {term.occurrences}
                  </span>
                </td>

                {/* Definicja */}
                <td className="px-2 py-3 text-sm">
                  {term.definition ? (
                    <div>
                      <p className="text-gray-700">{term.definition}</p>
                      <span className={`text-xs mt-1 inline-block px-2 py-1 rounded ${
                        term.definitionSource === 'document'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {term.definitionSource === 'document' ? 'Z dokumentu' : 'Wygenerowane AI'}
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleGenerateDefinition(term.id, term.term)}
                      disabled={loadingDefinitions.has(term.id)}
                      className="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 disabled:bg-gray-400"
                    >
                      {loadingDefinitions.has(term.id) ? 'Generowanie...' : 'Generuj definicję'}
                    </button>
                  )}
                </td>

                {/* Kontekst */}
                <td className="px-3 py-3 text-sm text-gray-600 max-w-xs">
                  <div className="flex items-center gap-2">
                    <div className="truncate flex-1" title={term.context}>
                      {term.context}
                    </div>
                    <button
                      onClick={() => handleOpenModal(term)}
                      className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 whitespace-nowrap"
                      title="Pokaż w dokumencie"
                    >
                      🔍 Pokaż
                    </button>
                  </div>
                </td>

                {/* Akcje */}
                <td className="px-2 py-3 text-center">
                  <div className="flex justify-center gap-1">
                    <button
                      onClick={() => handleEdit(term)}
                      className="p-1 text-gray-600 hover:text-blue-600"
                      title="Edytuj"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => handleDelete(term.id)}
                      className="p-1 text-gray-600 hover:text-red-600"
                      title="Usuń"
                    >
                      🗑
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal do przeglądania terminu w dokumencie */}
      {modalTerm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-semibold text-gray-800">
                  Termin w dokumencie: {modalTerm.term}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Wystąpienie {currentOccurrence + 1} z {modalTerm.positions.length}
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                title="Zamknij"
              >
                ×
              </button>
            </div>

            {/* Nawigacja */}
            <div className="flex items-center justify-center gap-4 p-4 border-b border-gray-200 bg-gray-50">
              <button
                onClick={navigatePrevious}
                disabled={currentOccurrence === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
              >
                ← Poprzednie
              </button>
              <span className="text-sm text-gray-700 font-medium">
                {currentOccurrence + 1} / {modalTerm.positions.length}
              </span>
              <button
                onClick={navigateNext}
                disabled={currentOccurrence >= modalTerm.positions.length - 1}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
              >
                Następne →
              </button>
            </div>

            {/* Treść dokumentu */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                {renderModalContent()}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-2">
                    <span className="inline-block bg-yellow-100 px-2 py-1 rounded">Żółty</span>
                    = wystąpienia terminu
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="inline-block bg-yellow-300 border-2 border-yellow-600 px-2 py-1 rounded font-bold">Pogrubiony</span>
                    = aktualne wystąpienie
                  </span>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Zamknij
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
