'use client'

import { useState } from 'react'
import { Glossary, GlossaryVersion, projectStorage } from '@/utils/projectStorage'
import { useLanguage } from '@/contexts/LanguageContext'

interface GlossaryManagerProps {
  projectId: string
  glossaries: Glossary[]
  currentGlossaryId: string | null
  onGlossaryChange: (glossaryId: string) => void
  onRefresh: () => void
  onClearDocument?: () => void  // Wywołane po utworzeniu nowego glosariusza
}

export default function GlossaryManager({
  projectId,
  glossaries,
  currentGlossaryId,
  onGlossaryChange,
  onRefresh,
  onClearDocument
}: GlossaryManagerProps) {
  const { t, language } = useLanguage()
  const [showNewGlossaryDialog, setShowNewGlossaryDialog] = useState(false)
  const [newGlossaryName, setNewGlossaryName] = useState('')
  const [showVersions, setShowVersions] = useState(false)
  const [editingGlossaryId, setEditingGlossaryId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const currentGlossary = glossaries.find(g => g.id === currentGlossaryId)
  const currentVersion = currentGlossary?.versions.find(v => v.id === currentGlossary.currentVersionId)

  const handleCreateGlossary = () => {
    if (!newGlossaryName.trim()) {
      alert(t.enterGlossaryName)
      return
    }

    const result = projectStorage.addGlossary(projectId, newGlossaryName.trim())
    if (result) {
      setNewGlossaryName('')
      setShowNewGlossaryDialog(false)

      // Wyczyść załadowany dokument - nowy glosariusz startuje od zera
      if (onClearDocument) {
        onClearDocument()
      }

      onRefresh()
    }
  }

  const handleDeleteGlossary = (glossaryId: string) => {
    const glossary = glossaries.find(g => g.id === glossaryId)
    if (!glossary) return

    const confirmMessage = `${t.deleteGlossaryConfirm} "${glossary.name}"? ${language === 'pl' ? 'Ta operacja jest nieodwracalna.' : 'This operation is irreversible.'}`
    if (!confirm(confirmMessage)) {
      return
    }

    if (projectStorage.deleteGlossary(projectId, glossaryId)) {
      onRefresh()
    }
  }

  const handleRenameGlossary = (glossaryId: string) => {
    if (!editingName.trim()) {
      setEditingGlossaryId(null)
      return
    }

    if (projectStorage.renameGlossary(projectId, glossaryId, editingName.trim())) {
      setEditingGlossaryId(null)
      setEditingName('')
      onRefresh()
    }
  }

  const handleRestoreVersion = (versionId: string) => {
    if (!currentGlossaryId) return

    if (!confirm(t.restoreVersionConfirm)) {
      return
    }

    if (projectStorage.restoreVersion(projectId, currentGlossaryId, versionId)) {
      onRefresh()
      alert(t.versionRestored)
    }
  }

  const handleDeleteVersion = (versionId: string) => {
    if (!currentGlossaryId) return

    if (!confirm(t.deleteVersionConfirm)) {
      return
    }

    if (projectStorage.deleteVersion(projectId, currentGlossaryId, versionId)) {
      onRefresh()
    } else {
      alert(t.cannotDeleteVersion)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString(language === 'pl' ? 'pl-PL' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800">{t.glossaries}</h3>
        <button
          onClick={() => setShowNewGlossaryDialog(true)}
          className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
        >
          {t.newGlossary}
        </button>
      </div>

      {/* Lista glosariuszy */}
      <div className="space-y-2 mb-4">
        {glossaries.length === 0 ? (
          <p className="text-sm text-gray-500 italic">{t.noGlossaries}</p>
        ) : (
          glossaries.map(glossary => (
            <div
              key={glossary.id}
              className={`border rounded-lg p-3 cursor-pointer transition-all ${
                currentGlossaryId === glossary.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => onGlossaryChange(glossary.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  {editingGlossaryId === glossary.id ? (
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRenameGlossary(glossary.id)
                          if (e.key === 'Escape') setEditingGlossaryId(null)
                        }}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                        autoFocus
                      />
                      <button
                        onClick={() => handleRenameGlossary(glossary.id)}
                        className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setEditingGlossaryId(null)}
                        className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="font-semibold text-gray-800 flex items-center gap-2">
                        {glossary.name}
                        {currentGlossaryId === glossary.id && (
                          <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">{t.active}</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {glossary.versions.length} {glossary.versions.length === 1 ? t.version : t.versions} •
                        {currentGlossary?.id === glossary.id && currentVersion && (
                          <> {currentVersion.terms.length} {t.terms}</>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <div className="flex gap-1 ml-2" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => {
                      setEditingGlossaryId(glossary.id)
                      setEditingName(glossary.name)
                    }}
                    className="px-2 py-1 text-gray-600 hover:text-blue-600 text-xs"
                    title={t.rename}
                  >
                    ✎
                  </button>
                  {glossaries.length > 1 && (
                    <button
                      onClick={() => handleDeleteGlossary(glossary.id)}
                      className="px-2 py-1 text-gray-600 hover:text-red-600 text-xs"
                      title={t.delete}
                    >
                      🗑
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Wersje aktywnego glosariusza */}
      {currentGlossary && (
        <div className="border-t pt-3">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setShowVersions(!showVersions)}
              className="text-sm font-semibold text-gray-700 hover:text-gray-900 flex items-center gap-1"
            >
              {showVersions ? '▼' : '▶'} Historia wersji ({currentGlossary.versions.length})
            </button>
          </div>

          {showVersions && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {currentGlossary.versions
                .slice()
                .reverse()
                .map(version => (
                  <div
                    key={version.id}
                    className={`text-xs border rounded p-2 ${
                      version.id === currentGlossary.currentVersionId
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-800 flex items-center gap-2">
                          v{version.versionNumber}
                          {version.isSnapshot && (
                            <span className="text-xs bg-yellow-500 text-white px-1.5 py-0.5 rounded">
                              Snapshot
                            </span>
                          )}
                          {version.id === currentGlossary.currentVersionId && (
                            <span className="text-xs bg-green-600 text-white px-1.5 py-0.5 rounded">
                              Aktualna
                            </span>
                          )}
                        </div>
                        <div className="text-gray-600 mt-1">{version.description}</div>
                        {version.changesSummary && (
                          <div className="text-gray-500 mt-1 italic">{version.changesSummary}</div>
                        )}
                        <div className="text-gray-500 mt-1">
                          {formatDate(version.createdAt)} • {version.terms.length} terminów
                        </div>
                        {version.extractionParams && (
                          <div className="text-gray-500 mt-1">
                            Parametry: {version.extractionParams.minTerms}-{version.extractionParams.maxTerms} terminów
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 ml-2">
                        {version.id !== currentGlossary.currentVersionId && (
                          <>
                            <button
                              onClick={() => handleRestoreVersion(version.id)}
                              className="px-2 py-1 text-blue-600 hover:text-blue-800 text-xs"
                              title="Przywróć tę wersję"
                            >
                              ↺ Przywróć
                            </button>
                            {currentGlossary.versions.length > 1 && (
                              <button
                                onClick={() => handleDeleteVersion(version.id)}
                                className="px-2 py-1 text-red-600 hover:text-red-800 text-xs"
                                title="Usuń wersję"
                              >
                                Usuń
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Dialog nowego glosariusza */}
      {showNewGlossaryDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Utwórz nowy glosariusz</h3>
            <input
              type="text"
              value={newGlossaryName}
              onChange={e => setNewGlossaryName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateGlossary()
                if (e.key === 'Escape') setShowNewGlossaryDialog(false)
              }}
              placeholder="Nazwa glosariusza..."
              className="w-full px-3 py-2 border border-gray-300 rounded mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowNewGlossaryDialog(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Anuluj
              </button>
              <button
                onClick={handleCreateGlossary}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Utwórz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
