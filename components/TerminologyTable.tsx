'use client'

import { useState } from 'react'
import { Term } from '@/app/page'

interface TerminologyTableProps {
  terms: Term[]
  onUpdate: (terms: Term[]) => void
  documentText: string
  apiKey: string
}

export default function TerminologyTable({ terms, onUpdate, documentText, apiKey }: TerminologyTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'alphabetical' | 'occurrences'>('alphabetical')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [loadingDefinitions, setLoadingDefinitions] = useState<Set<string>>(new Set())

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
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-8">#</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Termin</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-24">Wystąpienia</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Definicja</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Kontekst</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 w-32">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {sortedTerms.map((term, index) => (
              <tr key={term.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-600">{index + 1}</td>

                {/* Termin */}
                <td className="px-4 py-3">
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
                    <span className="font-semibold text-gray-800">{term.term}</span>
                  )}
                </td>

                {/* Wystąpienia */}
                <td className="px-4 py-3 text-sm text-gray-600 text-center">
                  <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                    {term.occurrences}
                  </span>
                </td>

                {/* Definicja */}
                <td className="px-4 py-3 text-sm">
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
                <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                  <div className="truncate" title={term.context}>
                    {term.context}
                  </div>
                </td>

                {/* Akcje */}
                <td className="px-4 py-3 text-center">
                  <div className="flex justify-center gap-1">
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
                      🗑
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
