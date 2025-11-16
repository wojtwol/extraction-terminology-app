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

// Funkcja do wykrywania języka
function detectLanguage(text: string): string {
  const sample = text.slice(0, 1000).toLowerCase()

  // Polskie znaki i słowa
  const polishChars = /[ąćęłńóśźż]/
  const polishWords = /\b(i|w|z|na|do|od|dla|że|się|nie|jest|są|oraz|przez)\b/g

  // Angielskie słowa
  const englishWords = /\b(the|and|or|in|on|at|to|for|of|with|is|are|be|have|has)\b/g

  // Niemieckie
  const germanWords = /\b(der|die|das|und|oder|mit|von|in|zu|für|ist|sind)\b/g

  // Francuskie
  const frenchWords = /\b(le|la|les|de|du|et|ou|dans|pour|avec|est|sont)\b/g

  if (polishChars.test(sample)) return 'Polski'

  const polishCount = (sample.match(polishWords) || []).length
  const englishCount = (sample.match(englishWords) || []).length
  const germanCount = (sample.match(germanWords) || []).length
  const frenchCount = (sample.match(frenchWords) || []).length

  const max = Math.max(polishCount, englishCount, germanCount, frenchCount)

  if (max === 0) return 'Nieznany'
  if (max === polishCount) return 'Polski'
  if (max === englishCount) return 'Angielski'
  if (max === germanCount) return 'Niemiecki'
  if (max === frenchCount) return 'Francuski'

  return 'Nieznany'
}

export default function Home() {
  const [terms, setTerms] = useState<Term[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [documentText, setDocumentText] = useState('')
  const [fileName, setFileName] = useState('')
  const [detectedLanguage, setDetectedLanguage] = useState('')
  const [apiKey, setApiKey] = useState('')

  // Nowy state - załadowany tekst przed ekstrakcją
  const [loadedText, setLoadedText] = useState('')
  const [loadedFileName, setLoadedFileName] = useState('')

  // Obsługa załadowania pliku/tekstu (bez ekstrakcji)
  const handleFileLoaded = (text: string, filename: string, key: string) => {
    setLoadedText(text)
    setLoadedFileName(filename)
    setApiKey(key)

    // Wykryj język
    const language = detectLanguage(text)
    setDetectedLanguage(language)

    console.log(`📄 Załadowano: ${filename}, ${text.length} znaków, język: ${language}`)
  }

  // Rozpocznij ekstrakcję (po kliknięciu przycisku)
  const handleStartExtraction = async () => {
    if (!loadedText || !apiKey) return

    setIsLoading(true)
    setDocumentText(loadedText)
    setFileName(loadedFileName)
    setTerms([]) // Wyczyść poprzednie wyniki
    setProgress(0)

    try {
      console.log(`📤 Wysyłam do API: ${loadedText.length} znaków`)

      // Symulowany progress bar
      setProgress(10)

      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev
          return prev + 5
        })
      }, 500)

      const response = await fetch('/api/extract-terminology', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: loadedText,
          apiKey,
          minTerms: 10,
          maxTerms: 100,
          minLength: 3,
          caseSensitive: false
        }),
      })

      clearInterval(progressInterval)
      setProgress(95)

      console.log(`📥 Status odpowiedzi: ${response.status}`)

      // Sprawdź czy odpowiedź to JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text()
        console.error('❌ Odpowiedź nie jest JSON:', textResponse.substring(0, 500))
        throw new Error(`Serwer zwrócił błąd (status ${response.status}). Sprawdź logi Vercel lub konsolę.`)
      }

      const data = await response.json()

      if (!response.ok) {
        // Wyświetl szczegółowy błąd z API
        const errorMessage = data.error || 'Nieznany błąd podczas ekstrakcji'
        console.error('❌ Błąd API:', errorMessage)
        throw new Error(errorMessage)
      }

      if (!data.terms || data.terms.length === 0) {
        alert('Nie znaleziono terminów w dokumencie. Spróbuj z innym dokumentem.')
        setProgress(0)
        return
      }

      setTerms(data.terms)
      setProgress(100)
      console.log(`✅ Wyekstrahowano ${data.terms.length} terminów`)

      // Reset progress po 1 sekundzie
      setTimeout(() => setProgress(0), 1000)

    } catch (error) {
      console.error('❌ Błąd ekstrakcji:', error)

      const errorMessage = error instanceof Error ? error.message : 'Nieznany błąd'

      // Wyświetl przyjazny komunikat błędu
      alert(`❌ Błąd ekstrakcji:\n\n${errorMessage}\n\nSprawdź:\n• Czy klucz API jest poprawny\n• Czy masz aktywną subskrypcję Anthropic\n• Czy dokument zawiera tekst\n• Konsolę przeglądarki (F12) dla szczegółów`)
      setProgress(0)
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
            <FileUpload onExtract={handleFileLoaded} isLoading={isLoading} />

            {/* Panel podglądu załadowanego dokumentu */}
            {loadedText && !isLoading && terms.length === 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-semibold mb-4 text-gray-800">
                  2. Podgląd dokumentu
                </h2>

                <div className="space-y-3 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Plik:</span>
                    <span className="font-medium text-gray-800">{loadedFileName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Rozmiar:</span>
                    <span className="font-medium text-gray-800">
                      {loadedText.length.toLocaleString()} znaków
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Wykryty język:</span>
                    <span className="font-medium text-blue-600">{detectedLanguage}</span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 mb-4 max-h-32 overflow-y-auto">
                  <p className="text-sm text-gray-700 font-mono whitespace-pre-wrap">
                    {loadedText.substring(0, 300)}
                    {loadedText.length > 300 && '...'}
                  </p>
                </div>

                <button
                  onClick={handleStartExtraction}
                  className="w-full px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-lg shadow-md hover:shadow-lg"
                >
                  Utwórz glosariusz
                </button>
              </div>
            )}

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
              <div className="bg-white rounded-lg shadow-lg p-8">
                <div className="text-center mb-6">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600 font-medium">Ekstrakcja terminologii w toku...</p>
                  <p className="text-sm text-gray-500 mt-2">To może potrwać chwilę dla dużych dokumentów</p>
                </div>

                {/* Progress bar */}
                <div className="w-full">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-600">Postęp:</span>
                    <span className="text-sm font-semibold text-blue-600">{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
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
                  {loadedText ? 'Kliknij "Utwórz glosariusz" aby rozpocząć' : 'Załaduj dokument, aby wyekstrahować terminologię'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
