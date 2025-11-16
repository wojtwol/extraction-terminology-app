'use client'

import { useState } from 'react'
import FileUpload from '@/components/FileUpload'
import TerminologyList from '@/components/TerminologyList'
import ExportButtons from '@/components/ExportButtons'

export interface Term {
  id: string
  term: string
  context: string
  occurrences: number
  positions: number[]
}

export default function Home() {
  const [terms, setTerms] = useState<Term[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [documentText, setDocumentText] = useState('')
  const [fileName, setFileName] = useState('')

  const handleExtraction = async (text: string, filename: string, apiKey: string) => {
    setIsLoading(true)
    setDocumentText(text)
    setFileName(filename)
    setTerms([]) // Wyczyść poprzednie wyniki

    try {
      const response = await fetch('/api/extract-terminology', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          apiKey,
          minTerms: 10,
          maxTerms: 100,
          minLength: 3,
          caseSensitive: false
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Wyświetl szczegółowy błąd z API
        const errorMessage = data.error || 'Nieznany błąd podczas ekstrakcji'
        throw new Error(errorMessage)
      }

      if (!data.terms || data.terms.length === 0) {
        alert('Nie znaleziono terminów w dokumencie. Spróbuj z innym dokumentem.')
        return
      }

      setTerms(data.terms)
      console.log(`✅ Wyekstrahowano ${data.terms.length} terminów`)

    } catch (error) {
      console.error('❌ Błąd ekstrakcji:', error)

      const errorMessage = error instanceof Error ? error.message : 'Nieznany błąd'

      // Wyświetl przyjazny komunikat błędu
      alert(`❌ Błąd ekstrakcji:\n\n${errorMessage}\n\nSprawdź:\n• Czy klucz API jest poprawny\n• Czy masz aktywną subskrypcję Anthropic\n• Czy dokument zawiera tekst\n• Konsolę przeglądarki (F12) dla szczegółów`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleTermUpdate = (updatedTerms: Term[]) => {
    setTerms(updatedTerms)
  }

  return (
    <main className="min-h-screen p-8 bg-gradient-to-b from-gray-100 to-white">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">
          Ekstraktor Terminologii
        </h1>
        <p className="text-gray-600 mb-8">
          Twórz glosariusze z dokumentów prawnych i urzędowych
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <FileUpload onExtract={handleExtraction} isLoading={isLoading} />

            {terms.length > 0 && (
              <ExportButtons
                terms={terms}
                fileName={fileName}
                documentText={documentText}
              />
            )}
          </div>

          <div>
            {isLoading ? (
              <div className="bg-white rounded-lg shadow-lg p-8 text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Ekstrakcja terminologii w toku...</p>
                <p className="text-sm text-gray-500 mt-2">To może potrwać chwilę dla dużych dokumentów</p>
              </div>
            ) : terms.length > 0 ? (
              <TerminologyList
                terms={terms}
                onUpdate={handleTermUpdate}
                documentText={documentText}
              />
            ) : (
              <div className="bg-white rounded-lg shadow-lg p-8 text-center">
                <p className="text-gray-500">
                  Załaduj dokument, aby wyekstrahować terminologię
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
