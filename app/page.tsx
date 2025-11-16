'use client'

import { useState, useEffect } from 'react'
import FileUpload from '@/components/FileUpload'
import TerminologyTable from '@/components/TerminologyTable'
import ExportButtons from '@/components/ExportButtons'
import ProjectManager from '@/components/ProjectManager'
import { Project, projectStorage } from '@/utils/projectStorage'

export interface Term {
  id: string
  term: string
  context: string
  occurrences: number
  positions: number[]
  definition?: string
  definitionSource?: 'document' | 'ai' | null
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

  // Projekty
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [projectName, setProjectName] = useState('')

  // Parametry ekstrakcji
  const [minTerms, setMinTerms] = useState(10)
  const [maxTerms, setMaxTerms] = useState(30)
  const [minLength, setMinLength] = useState(3)
  const [minOccurrences, setMinOccurrences] = useState(1)

  // Wczytaj zapisany klucz API przy starcie
  useEffect(() => {
    const savedApiKey = localStorage.getItem('anthropic_api_key')
    if (savedApiKey) {
      setApiKey(savedApiKey)
      console.log('🔑 Wczytano zapisany klucz API')
    }
  }, [])

  // Zapisz klucz API przy zmianie
  useEffect(() => {
    if (apiKey && apiKey.startsWith('sk-ant-')) {
      localStorage.setItem('anthropic_api_key', apiKey)
      console.log('💾 Zapisano klucz API')
    }
  }, [apiKey])

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
          minTerms,
          maxTerms,
          minLength,
          minOccurrences,
          detectedLanguage, // Przekazuj wykryty język dokumentu
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

  // Automatyczne zapisywanie projektu
  useEffect(() => {
    if (currentProject && terms.length > 0) {
      projectStorage.update(currentProject.id, {
        terms,
        name: projectName || currentProject.name,
        documentText,
        fileName,
        detectedLanguage
      })
    }
  }, [terms, projectName])

  // Zapisz jako nowy projekt
  const handleSaveProject = () => {
    const name = prompt('Nazwa projektu:', fileName || 'Nowy glosariusz')
    if (!name) return

    const project = projectStorage.save({
      name,
      fileName,
      documentText,
      detectedLanguage,
      terms
    })

    setCurrentProject(project)
    setProjectName(name)
    alert('Projekt został zapisany!')
  }

  // Wczytaj projekt
  const handleLoadProject = (project: Project) => {
    setCurrentProject(project)
    setProjectName(project.name)
    setFileName(project.fileName)
    setDocumentText(project.documentText)
    setDetectedLanguage(project.detectedLanguage)
    setTerms(project.terms)
    setLoadedText('')
    setLoadedFileName('')
  }

  // Nowy projekt
  const handleNewProject = () => {
    setCurrentProject(null)
    setProjectName('')
    setTerms([])
    setDocumentText('')
    setFileName('')
    setDetectedLanguage('')
    setLoadedText('')
    setLoadedFileName('')
  }

  return (
    <main className="min-h-screen p-6 bg-gradient-to-b from-gray-100 to-white">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-1">
            IURIDICO EJ GTEXTT
          </h1>
          <p className="text-gray-600 text-sm font-medium">
            Glossary and Terminology Extraction Tool
          </p>
        </div>

        {/* Top Section - Upload & Projects (left) + Export (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Left side - Upload & Projects */}
          <div className="lg:col-span-2 space-y-4">
            <FileUpload
              onExtract={handleFileLoaded}
              isLoading={isLoading}
              savedApiKey={apiKey}
            />

            {/* Panel podglądu */}
            {loadedText && !isLoading && terms.length === 0 && (
              <div className="bg-white rounded-lg shadow-lg p-4">
                <h3 className="text-lg font-semibold mb-3 text-gray-800">
                  Podgląd dokumentu
                </h3>

                <div className="grid grid-cols-3 gap-3 mb-3 text-sm">
                  <div>
                    <span className="text-gray-600">Plik:</span>
                    <p className="font-medium text-gray-800 truncate">{loadedFileName}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Rozmiar:</span>
                    <p className="font-medium text-gray-800">{loadedText.length.toLocaleString()} znaków</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Język:</span>
                    <p className="font-medium text-blue-600">{detectedLanguage}</p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded p-3 mb-3 max-h-24 overflow-y-auto">
                  <p className="text-xs text-gray-700 font-mono whitespace-pre-wrap">
                    {loadedText.substring(0, 200)}{loadedText.length > 200 && '...'}
                  </p>
                </div>

                {/* Parametry ekstrakcji */}
                <div className="bg-blue-50 rounded-lg p-3 mb-3 border border-blue-200">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">Parametry ekstrakcji</h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-700 mb-1">
                        Min. liczba terminów
                      </label>
                      <input
                        type="number"
                        value={minTerms}
                        onChange={(e) => setMinTerms(Math.max(1, parseInt(e.target.value) || 1))}
                        min="1"
                        max="500"
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-700 mb-1">
                        Maks. liczba terminów
                      </label>
                      <input
                        type="number"
                        value={maxTerms}
                        onChange={(e) => setMaxTerms(parseInt(e.target.value) || 0)}
                        min="1"
                        max="500"
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-700 mb-1">
                        Min. długość terminu (znaki)
                      </label>
                      <input
                        type="number"
                        value={minLength}
                        onChange={(e) => setMinLength(Math.max(1, parseInt(e.target.value) || 3))}
                        min="1"
                        max="20"
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-700 mb-1">
                        Min. liczba wystąpień
                      </label>
                      <input
                        type="number"
                        value={minOccurrences}
                        onChange={(e) => setMinOccurrences(Math.max(1, parseInt(e.target.value) || 1))}
                        min="1"
                        max="10"
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {maxTerms < minTerms && (
                    <p className="text-xs text-red-600 font-semibold mt-2">
                      ⚠️ Maksymalna liczba terminów nie może być mniejsza niż minimalna!
                    </p>
                  )}

                  <p className="text-xs text-gray-600 mt-2">
                    Aplikacja będzie dążyć do maksymalnej liczby terminów spełniających kryteria.
                  </p>
                </div>

                <button
                  onClick={handleStartExtraction}
                  disabled={maxTerms < minTerms}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Utwórz glosariusz
                </button>
              </div>
            )}

            <ProjectManager
              currentProject={currentProject}
              onLoadProject={handleLoadProject}
              onNewProject={handleNewProject}
            />
          </div>

          {/* Right side - Export (compact) */}
          <div className="space-y-4">
            {terms.length > 0 && (
              <>
                <div className="bg-white rounded-lg shadow-lg p-4">
                  <h3 className="text-lg font-semibold mb-3 text-gray-800">
                    Akcje
                  </h3>
                  <button
                    onClick={handleSaveProject}
                    disabled={terms.length === 0}
                    className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:bg-gray-400 mb-2"
                  >
                    {currentProject ? 'Zapisz zmiany' : 'Zapisz jako projekt'}
                  </button>
                </div>

                <div className="bg-white rounded-lg shadow-lg p-4">
                  <h3 className="text-lg font-semibold mb-3 text-gray-800">
                    Eksport
                  </h3>
                  <div className="space-y-2">
                    <ExportButtons
                      terms={terms}
                      fileName={fileName}
                      documentText={documentText}
                    />
                  </div>
                </div>
              </>
            )}

            {isLoading && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="text-center mb-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-3"></div>
                  <p className="text-sm text-gray-600">Ekstrakcja w toku...</p>
                </div>
                <div className="w-full">
                  <div className="flex justify-between mb-1 text-xs">
                    <span className="text-gray-600">Postęp:</span>
                    <span className="font-semibold text-blue-600">{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Section - Glossary Table (full width) */}
        {terms.length > 0 && !isLoading && (
          <div className="w-full">
            <TerminologyTable
              terms={terms}
              onUpdate={handleTermUpdate}
              documentText={documentText}
              apiKey={apiKey}
            />
          </div>
        )}

        {!isLoading && terms.length === 0 && !loadedText && (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <p className="text-gray-500 text-lg">
              Załaduj dokument lub wklej tekst, aby rozpocząć
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
