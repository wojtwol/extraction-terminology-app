'use client'

import { useState } from 'react'
import { Term } from '@/app/page'

interface TerminologyListProps {
  terms: Term[]
  onUpdate: (terms: Term[]) => void
  documentText: string
}

export default function TerminologyList({ terms, onUpdate, documentText }: TerminologyListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'alphabetical' | 'occurrences'>('alphabetical')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

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

  const moveUp = (index: number) => {
    if (index === 0) return
    const newTerms = [...sortedTerms]
    ;[newTerms[index - 1], newTerms[index]] = [newTerms[index], newTerms[index - 1]]
    onUpdate(newTerms)
  }

  const moveDown = (index: number) => {
    if (index === sortedTerms.length - 1) return
    const newTerms = [...sortedTerms]
    ;[newTerms[index], newTerms[index + 1]] = [newTerms[index + 1], newTerms[index]]
    onUpdate(newTerms)
  }

  const getContext = (term: Term): string => {
    const firstPos = term.positions[0]
    const start = Math.max(0, firstPos - 100)
    const end = Math.min(documentText.length, firstPos + term.term.length + 100)
    return '...' + documentText.slice(start, end) + '...'
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

      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {sortedTerms.map((term, index) => (
          <div
            key={term.id}
            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                {editingId === term.id ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="flex-1 px-3 py-1 border border-gray-300 rounded"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveEdit(term.id)}
                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Zapisz
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                    >
                      Anuluj
                    </button>
                  </div>
                ) : (
                  <h3 className="text-lg font-semibold text-gray-800">
                    {term.term}
                  </h3>
                )}
                <p className="text-sm text-gray-600 mt-1">
                  Wystąpienia: {term.occurrences}
                </p>
              </div>

              <div className="flex gap-1 ml-4">
                <button
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                  className="p-1 text-gray-600 hover:text-blue-600 disabled:opacity-30"
                  title="Przesuń w górę"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveDown(index)}
                  disabled={index === sortedTerms.length - 1}
                  className="p-1 text-gray-600 hover:text-blue-600 disabled:opacity-30"
                  title="Przesuń w dół"
                >
                  ↓
                </button>
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
                  ✕
                </button>
              </div>
            </div>

            <div className="mt-2 p-3 bg-gray-50 rounded text-sm text-gray-700">
              <strong>Kontekst:</strong> {getContext(term)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
