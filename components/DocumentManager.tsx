'use client'

import { useState } from 'react'
import { SourceDocument, projectStorage } from '@/utils/projectStorage'
import { useLanguage } from '@/contexts/LanguageContext'

interface DocumentManagerProps {
  projectId: string
  documents: SourceDocument[]
  onRefresh: () => void
}

export default function DocumentManager({ projectId, documents, onRefresh }: DocumentManagerProps) {
  const { language } = useLanguage()
  const [isExpanded, setIsExpanded] = useState(false)

  const handleDeleteDocument = (docId: string) => {
    const doc = documents.find(d => d.id === docId)
    const confirmMessage = language === 'pl'
      ? `Czy na pewno chcesz usunąć dokument "${doc?.fileName}"?`
      : `Are you sure you want to delete document "${doc?.fileName}"?`

    if (confirm(confirmMessage)) {
      projectStorage.deleteDocument(projectId, docId)
      onRefresh()
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-800">
          {language === 'pl' ? 'Dokumenty źródłowe' : 'Source Documents'}
        </h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          {isExpanded ? '▼' : '▶'} {documents.length} {language === 'pl' ? 'dok.' : 'docs'}
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-2 mt-3">
          {documents.length === 0 ? (
            <p className="text-sm text-gray-500 italic">
              {language === 'pl' ? 'Brak dokumentów' : 'No documents'}
            </p>
          ) : (
            documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-start justify-between p-2 bg-gray-50 rounded border border-gray-200"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{doc.fileName}</p>
                  <p className="text-xs text-gray-600">
                    {doc.language} • {doc.text.length.toLocaleString()} {language === 'pl' ? 'znaków' : 'chars'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {language === 'pl' ? 'Dodano:' : 'Added:'} {new Date(doc.addedAt).toLocaleString(language === 'pl' ? 'pl-PL' : 'en-US')}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteDocument(doc.id)}
                  className="ml-2 text-red-600 hover:text-red-800 text-xs"
                  title={language === 'pl' ? 'Usuń dokument' : 'Delete document'}
                >
                  🗑️
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
