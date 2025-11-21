'use client'

import { useState, useEffect } from 'react'
import { Term, TermContext } from '@/app/page'
import { useLanguage } from '@/contexts/LanguageContext'
import { SourceDocument, getColorClasses } from '@/utils/projectStorage'

interface TerminologyTableProps {
  terms: Term[]
  onUpdate: (terms: Term[]) => void
  documentText: string
  apiKey: string
  onTermSelect?: (term: Term) => void
  selectedTermId?: string | null
  fileName?: string
  // Props dla glosariuszy dwujęzycznych
  isBilingual?: boolean
  sourceLanguage?: string
  targetLanguage?: string
  columnView?: '2' | '4'
  targetDocumentText?: string
  // Props dla multi-document mode
  documents?: SourceDocument[]
}

export default function TerminologyTable({
  terms,
  onUpdate,
  documentText,
  apiKey,
  onTermSelect,
  selectedTermId,
  fileName,
  isBilingual = false,
  sourceLanguage,
  targetLanguage,
  columnView = '4',
  targetDocumentText,
  documents
}: TerminologyTableProps) {
  const { t, language } = useLanguage()
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'alphabetical' | 'occurrences' | 'position'>('alphabetical')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [loadingDefinitions, setLoadingDefinitions] = useState<Set<string>>(new Set())
  const [modalTerm, setModalTerm] = useState<Term | null>(null)
  const [currentOccurrence, setCurrentOccurrence] = useState(0)
  const [languageDialogTerm, setLanguageDialogTerm] = useState<{id: string, term: string} | null>(null)
  const [editingDefinition, setEditingDefinition] = useState<{id: string, value: string} | null>(null)
  const [editingTargetTerm, setEditingTargetTerm] = useState<{id: string, value: string} | null>(null)
  const [editingSourceTerm, setEditingSourceTerm] = useState<{id: string, value: string} | null>(null)

  // Funkcja pomocnicza do znalezienia dokumentu dla terminu
  const getDocumentForTerm = (term: Term): SourceDocument | null => {
    if (!documents || documents.length === 0) return null
    if (!term.sourceDocument) return null

    // Znajdź dokument po nazwie pliku
    return documents.find(doc => doc.fileName === term.sourceDocument) || null
  }

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
    if (sortBy === 'occurrences') {
      return b.occurrences - a.occurrences
    }
    // sortBy === 'position' - sortuj według pierwszej pozycji w dokumencie
    const aPos = a.positions && a.positions.length > 0 ? a.positions[0] : Infinity
    const bPos = b.positions && b.positions.length > 0 ? b.positions[0] : Infinity
    return aPos - bPos
  })

  // Rozwiń terminy z wieloma kontekstami na osobne wiersze
  interface TermRow {
    term: Term
    contextIndex: number // Indeks kontekstu (0 = pierwszy wiersz pokazuje term)
    termContext: TermContext | null // Kontekst dla tego wiersza
  }

  const expandedRows: TermRow[] = []
  sortedTerms.forEach(term => {
    if (term.contexts && term.contexts.length > 0) {
      // Termin ma wiele kontekstów - utwórz wiersz dla każdego
      term.contexts.forEach((ctx, idx) => {
        expandedRows.push({
          term,
          contextIndex: idx,
          termContext: ctx
        })
      })
    } else {
      // Stary format lub brak contexts - jeden wiersz
      expandedRows.push({
        term,
        contextIndex: 0,
        termContext: null
      })
    }
  })

  // Check if any term has a definition
  const hasDefinitions = terms.some(t => t.definition)

  // Funkcja do wyróżnienia terminu w kontekście
  const highlightTermInContext = (context: string, termText: string) => {
    if (!context || !termText) return context

    const parts: JSX.Element[] = []
    const lowerContext = context.toLowerCase()
    const lowerTerm = termText.toLowerCase()

    let lastIndex = 0
    let searchIndex = 0

    while ((searchIndex = lowerContext.indexOf(lowerTerm, lastIndex)) !== -1) {
      // Dodaj tekst przed terminem
      if (searchIndex > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {context.substring(lastIndex, searchIndex)}
          </span>
        )
      }

      // Dodaj wyróżniony termin
      parts.push(
        <span key={`term-${searchIndex}`} className="text-red-600 font-semibold">
          {context.substring(searchIndex, searchIndex + termText.length)}
        </span>
      )

      lastIndex = searchIndex + termText.length
    }

    // Dodaj pozostały tekst po ostatnim wystąpieniu
    if (lastIndex < context.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {context.substring(lastIndex)}
        </span>
      )
    }

    return parts.length > 0 ? <>{parts}</> : context
  }

  const handleDelete = (id: string) => {
    const confirmMessage = language === 'pl'
      ? 'Czy na pewno chcesz usunąć ten termin?'
      : 'Are you sure you want to delete this term?'
    if (confirm(confirmMessage)) {
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

  const handleGenerateDefinitionClick = (termId: string, termText: string) => {
    setLanguageDialogTerm({ id: termId, term: termText })
  }

  const handleGenerateDefinition = async (language: string) => {
    if (!languageDialogTerm) return

    const { id: termId, term: termText } = languageDialogTerm
    setLanguageDialogTerm(null)
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
          apiKey: apiKey,
          language: language
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

  const handleManualDefinition = (termId: string) => {
    const term = terms.find(t => t.id === termId)
    if (!term) return
    setEditingDefinition({ id: termId, value: term.definition || '' })
  }

  const handleSaveDefinition = () => {
    if (!editingDefinition) return

    const term = terms.find(t => t.id === editingDefinition.id)
    const wasEdited = term && term.definition && term.definition.length > 0

    onUpdate(
      terms.map(t =>
        t.id === editingDefinition.id
          ? {
              ...t,
              definition: editingDefinition.value,
              definitionSource: wasEdited ? ('edited' as const) : ('document' as const)
            }
          : t
      )
    )
    setEditingDefinition(null)
  }

  const handleSaveTargetTerm = () => {
    if (!editingTargetTerm) return

    onUpdate(
      terms.map(t =>
        t.id === editingTargetTerm.id
          ? {
              ...t,
              targetTerm: editingTargetTerm.value,
              targetSource: 'manual' as const
            }
          : t
      )
    )
    setEditingTargetTerm(null)
  }

  const handleSaveSourceTerm = () => {
    if (!editingSourceTerm) return

    onUpdate(
      terms.map(t =>
        t.id === editingSourceTerm.id
          ? {
              ...t,
              term: editingSourceTerm.value
            }
          : t
      )
    )
    setEditingSourceTerm(null)
  }

  // Sprawdź czy są nowe terminy
  const hasNewTerms = terms.some(t => t.isNew)
  const newTermsCount = terms.filter(t => t.isNew).length

  // Funkcja do usunięcia flagi "isNew" ze wszystkich terminów
  const handleClearNewFlags = () => {
    const updatedTerms = terms.map(t => ({
      ...t,
      isNew: false
    }))
    onUpdate(updatedTerms)

    // Pokaż feedback użytkownikowi
    console.log(`✅ ${language === 'pl' ? 'Zaakceptowano' : 'Accepted'} ${newTermsCount} ${language === 'pl' ? 'nowych terminów' : 'new terms'}`)
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold text-gray-800">
          {t.extractedTerms} ({terms.length})
          {hasNewTerms && (
            <span className="ml-3 text-sm font-normal text-green-700 bg-green-100 px-3 py-1 rounded-full">
              ✨ {newTermsCount} {language === 'pl' ? 'nowych' : 'new'}
            </span>
          )}
        </h2>
        {hasNewTerms && (
          <button
            onClick={handleClearNewFlags}
            className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
            title={language === 'pl' ? 'Usuń oznaczenia "NOWY" ze wszystkich terminów' : 'Remove "NEW" markings from all terms'}
          >
            <span>✓</span>
            <span>{language === 'pl' ? 'Zaakceptuj nowe' : 'Accept new'}</span>
          </button>
        )}
      </div>

      <div className="mb-4 space-y-3">
        <input
          type="text"
          placeholder={language === 'pl' ? 'Szukaj terminów...' : 'Search terms...'}
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
            {language === 'pl' ? 'Alfabetycznie' : 'In alphabetic order'}
          </button>
          <button
            onClick={() => setSortBy('occurrences')}
            className={`px-4 py-2 rounded-lg ${
              sortBy === 'occurrences'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {language === 'pl' ? 'Według wystąpień' : 'By number of occurrences'}
          </button>
          <button
            onClick={() => setSortBy('position')}
            className={`px-4 py-2 rounded-lg ${
              sortBy === 'position'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {language === 'pl' ? 'Według kolejności' : 'In order of appearance'}
          </button>
        </div>
      </div>

      {/* Tabela dla glosariuszy DWUJĘZYCZNYCH */}
      {isBilingual ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse table-fixed">
            <thead>
              <tr className="bg-gradient-to-r from-blue-100 to-purple-100 border-b-2 border-gray-300">
                <th className="px-2 py-3 text-left text-sm font-semibold text-gray-700" style={{width: '40px'}}>
                  {t.number}
                </th>
                <th className="px-3 py-3 text-left text-sm font-semibold text-blue-800" style={{width: columnView === '2' ? '35%' : '22%'}}>
                  {language === 'pl' ? 'Termin źródłowy' : 'Source Term'} ({sourceLanguage?.toUpperCase()})
                </th>
                {columnView === '4' && (
                  <th className="px-3 py-3 text-left text-sm font-semibold text-blue-700" style={{width: '23%'}}>
                    {language === 'pl' ? 'Kontekst źródłowy' : 'Source Context'}
                  </th>
                )}
                <th className="px-3 py-3 text-left text-sm font-semibold text-purple-800" style={{width: columnView === '2' ? '35%' : '22%'}}>
                  {language === 'pl' ? 'Termin docelowy' : 'Target Term'} ({targetLanguage?.toUpperCase()})
                </th>
                {columnView === '4' && (
                  <th className="px-3 py-3 text-left text-sm font-semibold text-purple-700" style={{width: '23%'}}>
                    {language === 'pl' ? 'Kontekst docelowy' : 'Target Context'}
                  </th>
                )}
                <th className="px-2 py-3 text-center text-sm font-semibold text-gray-700" style={{width: '100px'}}>
                  {t.actions}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTerms.map((term, index) => (
                <tr
                  key={term.id}
                  className={`group border-b border-gray-200 hover:bg-gray-50 transition-colors ${
                    selectedTermId === term.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                  }`}
                >
                  <td className="px-2 py-3 text-sm text-gray-600">{index + 1}</td>

                  {/* Termin źródłowy */}
                  <td className="px-3 py-3">
                    {editingSourceTerm?.id === term.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editingSourceTerm.value}
                          onChange={(e) => setEditingSourceTerm({ id: term.id, value: e.target.value })}
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                          autoFocus
                        />
                        <button
                          onClick={handleSaveSourceTerm}
                          className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setEditingSourceTerm(null)}
                          className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span
                          onClick={() => onTermSelect?.(term)}
                          className={`font-semibold cursor-pointer hover:text-blue-600 transition-colors ${
                            selectedTermId === term.id ? 'text-blue-600' : 'text-gray-800'
                          }`}
                          title={language === 'pl' ? 'Kliknij, aby wyświetlić w dokumencie' : 'Click to view in document'}
                        >
                          {term.term}
                        </span>
                        <button
                          onClick={() => setEditingSourceTerm({ id: term.id, value: term.term })}
                          className="text-xs text-blue-600 hover:text-blue-800 underline opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {t.edit}
                        </button>
                      </div>
                    )}
                  </td>

                  {/* Kontekst źródłowy (tylko dla widoku 4-kolumnowego) */}
                  {columnView === '4' && (
                    <td className="px-3 py-3 text-sm text-gray-600">
                      <div className="line-clamp-2" title={term.context}>
                        {highlightTermInContext(term.context, term.term)}
                      </div>
                    </td>
                  )}

                  {/* Termin docelowy */}
                  <td className="px-3 py-3">
                    {editingTargetTerm?.id === term.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editingTargetTerm.value}
                          onChange={(e) => setEditingTargetTerm({ id: term.id, value: e.target.value })}
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                          autoFocus
                        />
                        <button
                          onClick={handleSaveTargetTerm}
                          className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setEditingTargetTerm(null)}
                          className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                        >
                          ✕
                        </button>
                      </div>
                    ) : term.targetTerm ? (
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-purple-800">
                          {term.targetTerm}
                        </span>
                        <button
                          onClick={() => setEditingTargetTerm({ id: term.id, value: term.targetTerm || '' })}
                          className="text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          {t.edit}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingTargetTerm({ id: term.id, value: '' })}
                        className="px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700"
                      >
                        {language === 'pl' ? '+ Dodaj' : '+ Add'}
                      </button>
                    )}
                  </td>

                  {/* Kontekst docelowy (tylko dla widoku 4-kolumnowego) */}
                  {columnView === '4' && (
                    <td className="px-3 py-3 text-sm text-gray-600">
                      {term.targetContext ? (
                        <div className="line-clamp-2" title={term.targetContext}>
                          {term.targetTerm ? highlightTermInContext(term.targetContext, term.targetTerm) : term.targetContext}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">
                          {language === 'pl' ? 'Brak' : 'N/A'}
                        </span>
                      )}
                    </td>
                  )}

                  {/* Akcje */}
                  <td className="px-2 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleDelete(term.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors text-sm"
                        title={t.delete}
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
      ) : (
        /* Tabela dla glosariuszy JEDNOJĘZYCZNYCH */
        <div className="overflow-x-auto">
          <table className="w-full border-collapse table-fixed">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-300">
                <th className="px-2 py-3 text-left text-sm font-semibold text-gray-700" style={{width: '40px'}}>{t.number}</th>
                <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700" style={{width: '200px'}}>{t.term}</th>
                <th className="px-2 py-3 text-left text-sm font-semibold text-gray-700" style={{width: '90px'}}>{t.occurrences}</th>
                <th className="px-2 py-3 text-left text-sm font-semibold text-gray-700" style={{width: '140px'}}>
                  {language === 'pl' ? 'Dokument źródłowy' : 'Source Document'}
                </th>
                <th className="px-2 py-3 text-left text-sm font-semibold text-gray-700" style={{width: hasDefinitions ? '9%' : '14%'}}>{t.definition}</th>
                <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700" style={{width: hasDefinitions ? '35%' : '32%'}}>{t.context}</th>
                <th className="px-2 py-3 text-center text-sm font-semibold text-gray-700" style={{width: '120px'}}>{t.actions}</th>
              </tr>
            </thead>
          <tbody>
            {expandedRows.map((row, index) => {
              const term = row.term
              const isFirstContext = row.contextIndex === 0
              const ctx = row.termContext

              // Dla wiersza z kontekstem używamy danych z ctx, inaczej z term
              const displayOccurrences = ctx ? ctx.occurrences : term.occurrences
              const displayContext = ctx ? ctx.context : term.context
              const displayDocumentName = ctx ? ctx.documentName : (term.sourceDocument || fileName || '-')

              return (
              <tr
                key={`${term.id}-${row.contextIndex}`}
                className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${
                  selectedTermId === term.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                } ${
                  term.isNew && isFirstContext ? 'bg-green-50 border-l-4 border-l-green-500' : ''
                } ${
                  !isFirstContext ? 'bg-gray-50' : '' // Lekko szare tło dla kolejnych wierszy tego samego terminu
                }`}
              >
                <td className="px-2 py-3 text-sm text-gray-600">{isFirstContext ? index + 1 : ''}</td>

                {/* Termin - tylko w pierwszym wierszu */}
                <td className={`px-3 py-3 ${term.term.split(' ').length >= 4 ? 'max-w-xs' : ''}`}>
                  {isFirstContext ? (
                      editingId === term.id ? (
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
                        <div className="flex items-center gap-2">
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
                          {term.isNew && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800 border border-green-300 animate-pulse">
                              ✨ {language === 'pl' ? 'NOWY' : 'NEW'}
                            </span>
                          )}
                        </div>
                      )
                  ) : null}
                    </td>

                    {/* Wystąpienia */}
                    <td className="px-2 py-3 text-sm text-gray-600 text-center">
                      <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                        {displayOccurrences}
                      </span>
                    </td>

                    {/* Dokument źródłowy */}
                    <td className="px-2 py-3 text-sm text-gray-600">
                      {(() => {
                        // Znajdź dokument dla kontekstu lub terminu
                        const doc = documents?.find(d => d.fileName === displayDocumentName)

                        if (doc && doc.color) {
                          const colorClasses = getColorClasses(doc.color)
                          return (
                            <div
                              className={`inline-block px-2 py-1 rounded text-xs font-medium truncate max-w-full ${colorClasses.bgClass} ${colorClasses.textClass} border ${colorClasses.borderClass}`}
                              title={displayDocumentName}
                            >
                              {displayDocumentName}
                            </div>
                          )
                        }

                        return (
                          <div className="text-xs text-gray-500 truncate" title={displayDocumentName}>
                            {displayDocumentName}
                          </div>
                        )
                      })()}
                    </td>

                    {/* Definicja */}
                    <td className="px-2 py-3 text-sm break-words">
                      {editingDefinition?.id === term.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editingDefinition.value}
                            onChange={(e) => setEditingDefinition({ id: term.id, value: e.target.value })}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded h-20 resize-none"
                            placeholder={language === 'pl' ? 'Wprowadź definicję...' : 'Enter definition...'}
                            autoFocus
                          />
                          <div className="flex gap-1">
                            <button
                              onClick={handleSaveDefinition}
                              className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                            >
                              ✓ {t.save}
                            </button>
                            <button
                              onClick={() => setEditingDefinition(null)}
                              className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                            >
                              ✕ {t.cancel}
                            </button>
                          </div>
                        </div>
                      ) : term.definition ? (
                        <div className="group relative">
                          <p className="text-gray-700 break-words">{term.definition}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs inline-block px-2 py-1 rounded ${
                              term.definitionSource === 'document'
                                ? 'bg-green-100 text-green-800'
                                : term.definitionSource === 'edited'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}>
                              {term.definitionSource === 'document'
                                ? t.fromDocument
                                : term.definitionSource === 'edited'
                                ? (language === 'pl' ? 'Edytowano' : 'Edited')
                                : t.generatedAI}
                            </span>
                            <button
                              onClick={() => handleManualDefinition(term.id)}
                              className="text-xs text-blue-600 hover:text-blue-800 underline"
                            >
                              {t.edit}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1 items-start">
                          <button
                            onClick={() => handleGenerateDefinitionClick(term.id, term.term)}
                            disabled={loadingDefinitions.has(term.id)}
                            className="w-[60%] px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 disabled:bg-gray-400 whitespace-nowrap"
                          >
                            {loadingDefinitions.has(term.id) ? t.generating : t.generateAI}
                          </button>
                          <button
                            onClick={() => handleManualDefinition(term.id)}
                            className="w-[60%] px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 whitespace-nowrap"
                          >
                            {t.addManually}
                          </button>
                        </div>
                      )}
                    </td>

                {/* Kontekst */}
                <td className="px-3 py-3 text-sm text-gray-600 break-words">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      {highlightTermInContext(displayContext, term.term)}
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

                {/* Akcje - tylko w pierwszym wierszu */}
                <td className="px-2 py-3 text-center">
                  {isFirstContext ? (
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
                  ) : null}
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      )}

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

      {/* Dialog wyboru języka dla definicji */}
      {languageDialogTerm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">{t.selectLanguageTitle}</h3>
            <p className="text-sm text-gray-600 mb-4">
              {t.selectLanguageDescription} <strong>{languageDialogTerm.term}</strong>
            </p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => handleGenerateDefinition('pl')}
                className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                🇵🇱 Polski
              </button>
              <button
                onClick={() => handleGenerateDefinition('en')}
                className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                🇬🇧 English
              </button>
              <button
                onClick={() => handleGenerateDefinition('de')}
                className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                🇩🇪 Deutsch
              </button>
              <button
                onClick={() => handleGenerateDefinition('fr')}
                className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                🇫🇷 Français
              </button>
              <button
                onClick={() => handleGenerateDefinition('es')}
                className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                🇪🇸 Español
              </button>
              <button
                onClick={() => handleGenerateDefinition('it')}
                className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                🇮🇹 Italiano
              </button>
            </div>
            <button
              onClick={() => setLanguageDialogTerm(null)}
              className="w-full px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
