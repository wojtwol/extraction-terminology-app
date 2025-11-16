'use client'

import { useState, useEffect } from 'react'
import FileUpload from '@/components/FileUpload'
import TerminologyTable from '@/components/TerminologyTable'
import ExportButtons from '@/components/ExportButtons'
import DocumentViewer from '@/components/DocumentViewer'
import GlossaryManager from '@/components/GlossaryManager'
import SnapshotButton from '@/components/SnapshotButton'
import LanguageSwitch from '@/components/LanguageSwitch'
import { Project, Glossary, GlossaryVersion, projectStorage } from '@/utils/projectStorage'
import { useLanguage } from '@/contexts/LanguageContext'

export interface Term {
  id: string
  term: string
  context: string
  occurrences: number
  positions: number[]
  definition?: string
  definitionSource?: 'document' | 'ai' | 'edited' | null
}

// Funkcja do wykrywania języka (wywołuje API z franc-min)
async function detectLanguageAPI(text: string): Promise<string> {
  try {
    console.log('🔍 Wykrywanie języka przez API...')

    const response = await fetch('/api/detect-language', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text })
    })

    if (!response.ok) {
      console.error('❌ Błąd API wykrywania języka')
      return 'Nieznany'
    }

    const data = await response.json()
    console.log(`✅ Wykryto język: ${data.language} (${data.languageCode})`)
    console.log(`   Pewność: ${data.confidence}`)
    console.log(`   Metoda: ${data.method}`)

    return data.language
  } catch (error) {
    console.error('❌ Błąd podczas wykrywania języka:', error)
    return 'Nieznany'
  }
}

export default function Home() {
  const { t, language } = useLanguage()
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [documentText, setDocumentText] = useState('')
  const [fileName, setFileName] = useState('')
  const [detectedLanguage, setDetectedLanguage] = useState('')
  const [apiKey, setApiKey] = useState('')

  // Nowy state - załadowany tekst przed ekstrakcją
  const [loadedText, setLoadedText] = useState('')
  const [loadedFileName, setLoadedFileName] = useState('')

  // Projekty i glosariusze
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [projectName, setProjectName] = useState('')
  const [currentGlossary, setCurrentGlossary] = useState<Glossary | null>(null)
  const [currentVersion, setCurrentVersion] = useState<GlossaryVersion | null>(null)
  const [refreshKey, setRefreshKey] = useState(0) // Wymuszenie odświeżenia

  // Parametry ekstrakcji
  const [minTerms, setMinTerms] = useState(10)
  const [maxTerms, setMaxTerms] = useState(30)
  const [minLength, setMinLength] = useState(3)
  const [minOccurrences, setMinOccurrences] = useState(1)

  // Wybrany termin do podświetlenia w dokumencie
  const [selectedTerm, setSelectedTerm] = useState<Term | null>(null)

  // Sugestia dotycząca liczby terminów
  const [extractionSuggestion, setExtractionSuggestion] = useState<string | null>(null)

  // Skrót do terminów z aktualnej wersji
  const terms = currentVersion?.terms || []

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
  const handleFileLoaded = async (text: string, filename: string, key: string) => {
    setLoadedText(text)
    setLoadedFileName(filename)
    setApiKey(key)

    // Wykryj język przez API (franc-min - obsługuje wszystkie języki UE)
    const language = await detectLanguageAPI(text)
    setDetectedLanguage(language)

    console.log(`📄 Załadowano: ${filename}, ${text.length} znaków, język: ${language}`)
  }

  // Odśwież aktualny glosariusz i wersję
  const refreshGlossary = () => {
    if (!currentProject || !currentProject.currentGlossaryId) {
      setCurrentGlossary(null)
      setCurrentVersion(null)
      return
    }

    const glossary = projectStorage.getCurrentGlossary(currentProject.id)
    setCurrentGlossary(glossary)

    if (glossary) {
      const version = projectStorage.getCurrentVersion(currentProject.id, glossary.id)
      setCurrentVersion(version)
    } else {
      setCurrentVersion(null)
    }
  }

  // Rozpocznij ekstrakcję (po kliknięciu przycisku)
  const handleStartExtraction = async () => {
    if (!loadedText || !apiKey || !currentProject || !currentGlossary) return

    setIsLoading(true)
    setDocumentText(loadedText)
    setFileName(loadedFileName)
    setExtractionSuggestion(null) // Wyczyść poprzednią sugestię
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

      // Zapisz wyniki jako nową wersję glosariusza
      const extractionParams = { minTerms, maxTerms, minLength, minOccurrences }
      const description = `Ekstrakcja: ${minTerms}-${maxTerms} terminów`

      projectStorage.addVersion(
        currentProject.id,
        currentGlossary.id,
        data.terms,
        description,
        extractionParams,
        false // nie jest snapshotem
      )

      // Odśwież projekt
      const updatedProject = projectStorage.getById(currentProject.id)
      if (updatedProject) {
        setCurrentProject(updatedProject)
      }
      refreshGlossary()

      setProgress(100)
      console.log(`✅ Wyekstrahowano ${data.terms.length} terminów`)

      // Zapisz sugestię jeśli istnieje
      if (data.suggestion) {
        setExtractionSuggestion(data.suggestion)
        console.log(`💡 Sugestia: ${data.suggestion}`)
      } else {
        setExtractionSuggestion(null)
      }

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
    if (!currentProject || !currentGlossary) return

    // Zapisz jako nową wersję (auto-save)
    projectStorage.addVersion(
      currentProject.id,
      currentGlossary.id,
      updatedTerms,
      'Auto-save (edycja)',
      undefined,
      false
    )

    // Odśwież projekt i glosariusz
    const updatedProject = projectStorage.getById(currentProject.id)
    if (updatedProject) {
      setCurrentProject(updatedProject)
    }
    refreshGlossary()
  }

  // Odśwież glosariusz gdy projekt się zmieni
  useEffect(() => {
    refreshGlossary()
  }, [currentProject, refreshKey])

  // Automatyczne zapisywanie metadanych projektu
  useEffect(() => {
    if (currentProject && documentText) {
      projectStorage.update(currentProject.id, {
        name: projectName || currentProject.name,
        documentText,
        fileName,
        detectedLanguage
      })
    }
  }, [projectName, documentText, fileName, detectedLanguage])

  // Zapisz jako nowy projekt
  const handleSaveProject = () => {
    const name = prompt('Nazwa projektu:', fileName || 'Nowy glosariusz')
    if (!name) return

    const project = projectStorage.save({
      name,
      fileName,
      documentText,
      detectedLanguage
    })

    setCurrentProject(project)
    setProjectName(name)
    refreshGlossary()
    alert('Projekt został zapisany!')
  }

  // Wczytaj projekt
  const handleLoadProject = (project: Project) => {
    setCurrentProject(project)
    setProjectName(project.name)
    setFileName(project.fileName)
    setDocumentText(project.documentText)
    setDetectedLanguage(project.detectedLanguage)
    setLoadedText('')
    setLoadedFileName('')
    refreshGlossary()
  }

  // Nowy projekt
  const handleNewProject = () => {
    setCurrentProject(null)
    setCurrentGlossary(null)
    setCurrentVersion(null)
    setProjectName('')
    setDocumentText('')
    setFileName('')
    setDetectedLanguage('')
    setLoadedText('')
    setLoadedFileName('')
  }

  // Ekran wyboru projektu - pokazuj jeśli nie ma wybranego projektu
  if (!currentProject) {
    const allProjects = projectStorage.getAll().sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )

    return (
      <main className="min-h-screen p-6 bg-gradient-to-b from-gray-100 to-white">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex-1 text-center">
              <h1 className="text-4xl font-bold text-gray-800 mb-2">
                {t.title}
              </h1>
              <p className="text-gray-600 text-lg">
                {t.subtitle}
              </p>
            </div>
            <div className="ml-4">
              <LanguageSwitch />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-xl p-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">
              {language === 'pl' ? 'Wybierz projekt lub utwórz nowy' : 'Select project or create new'}
            </h2>

            {/* Przycisk nowego projektu */}
            <button
              onClick={() => {
                // Generuj domyślną nazwę z numerem porządkowym
                const today = new Date().toLocaleDateString(language === 'pl' ? 'pl-PL' : 'en-US')
                const baseNamePrefix = language === 'pl' ? `Glosariusz ${today}` : `Glossary ${today}`

                // Znajdź wszystkie projekty z dzisiejszą datą
                const todayProjects = allProjects.filter(p =>
                  p.name.startsWith(baseNamePrefix)
                )

                // Oblicz numer porządkowy (ilość projektów z dzisiejszą datą + 1)
                const nextNumber = todayProjects.length + 1
                const defaultName = `${baseNamePrefix}_${nextNumber}`

                const name = prompt(language === 'pl' ? 'Nazwa nowego projektu:' : 'New project name:', defaultName)
                if (name) {
                  const newProject = projectStorage.save({
                    name,
                    fileName: '',
                    documentText: '',
                    detectedLanguage: ''
                  })
                  setCurrentProject(newProject)
                  setProjectName(newProject.name)
                  refreshGlossary()
                }
              }}
              className="w-full px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-lg mb-6"
            >
              {language === 'pl' ? '+ Utwórz nowy projekt' : '+ Create New Project'}
            </button>

            {/* Lista istniejących projektów */}
            {allProjects.length > 0 && (
              <>
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-700 mb-4">
                    {language === 'pl' ? `Lub wczytaj istniejący projekt (${allProjects.length})` : `Or load existing project (${allProjects.length})`}
                  </h3>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {allProjects.map((project) => (
                      <div
                        key={project.id}
                        className="p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
                        onClick={() => handleLoadProject(project)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-800">{project.name}</p>
                            <p className="text-sm text-gray-600 mt-1">
                              {project.glossaries.length} {language === 'pl'
                                ? (project.glossaries.length === 1 ? 'glosariusz' : 'glosariuszy')
                                : (project.glossaries.length === 1 ? 'glossary' : 'glossaries')
                              } • {project.detectedLanguage || (language === 'pl' ? 'Brak dokumentu' : 'No document')}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {language === 'pl' ? 'Zmieniono:' : 'Modified:'} {new Date(project.updatedAt).toLocaleString(language === 'pl' ? 'pl-PL' : 'en-US')}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const confirmMessage = language === 'pl'
                                ? `Czy na pewno chcesz usunąć projekt "${project.name}"?`
                                : `Are you sure you want to delete project "${project.name}"?`
                              if (confirm(confirmMessage)) {
                                projectStorage.delete(project.id)
                                window.location.reload()
                              }
                            }}
                            className="ml-4 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                          >
                            🗑 {language === 'pl' ? 'Usuń' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {allProjects.length === 0 && (
              <p className="text-center text-gray-500 mt-8">
                {language === 'pl'
                  ? 'Brak zapisanych projektów. Utwórz pierwszy projekt, aby rozpocząć!'
                  : 'No saved projects. Create your first project to get started!'}
              </p>
            )}
          </div>
        </div>
      </main>
    )
  }

  // Główny interfejs aplikacji - pokazuj gdy projekt jest wybrany
  return (
    <main className="min-h-screen p-6 bg-gradient-to-b from-gray-100 to-white">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-800 mb-1">
              {t.title}
            </h1>
            <p className="text-gray-600 text-sm font-medium">
              {t.subtitle}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-700">
                {language === 'pl' ? 'Projekt:' : 'Project:'} {currentProject.name}
              </p>
              <button
                onClick={handleNewProject}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                {language === 'pl' ? 'Zmień projekt' : 'Change project'}
              </button>
            </div>
            <LanguageSwitch />
          </div>
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
                  {language === 'pl' ? 'Podgląd dokumentu' : 'Document Preview'}
                </h3>

                <div className="grid grid-cols-3 gap-3 mb-3 text-sm">
                  <div>
                    <span className="text-gray-600">{language === 'pl' ? 'Plik:' : 'File:'}</span>
                    <p className="font-medium text-gray-800 truncate">{loadedFileName}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">{language === 'pl' ? 'Rozmiar:' : 'Size:'}</span>
                    <p className="font-medium text-gray-800">{loadedText.length.toLocaleString()} {language === 'pl' ? 'znaków' : 'characters'}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">{language === 'pl' ? 'Język:' : 'Language:'}</span>
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
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">
                    {language === 'pl' ? 'Parametry ekstrakcji' : 'Extraction Parameters'}
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-700 mb-1">
                        {language === 'pl' ? 'Min. liczba terminów' : 'Min. terms count'}
                      </label>
                      <input
                        type="number"
                        value={minTerms === 0 ? '' : minTerms}
                        onChange={(e) => {
                          if (e.target.value === '') {
                            setMinTerms(0)
                          } else {
                            const num = parseInt(e.target.value, 10)
                            setMinTerms(isNaN(num) ? 0 : Math.max(1, num))
                          }
                        }}
                        min="1"
                        max="500"
                        placeholder="10"
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-700 mb-1">
                        {language === 'pl' ? 'Maks. liczba terminów' : 'Max. terms count'}
                      </label>
                      <input
                        type="number"
                        value={maxTerms === 0 ? '' : maxTerms}
                        onChange={(e) => {
                          if (e.target.value === '') {
                            setMaxTerms(0)
                          } else {
                            const num = parseInt(e.target.value, 10)
                            setMaxTerms(isNaN(num) ? 0 : num)
                          }
                        }}
                        min="1"
                        max="500"
                        placeholder="30"
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-700 mb-1">
                        {language === 'pl' ? 'Min. długość terminu (znaki)' : 'Min. term length (chars)'}
                      </label>
                      <input
                        type="number"
                        value={minLength}
                        onChange={(e) => {
                          const num = parseInt(e.target.value, 10)
                          setMinLength(isNaN(num) ? 3 : Math.max(1, num))
                        }}
                        min="1"
                        max="20"
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-700 mb-1">
                        {language === 'pl' ? 'Min. liczba wystąpień' : 'Min. occurrences'}
                      </label>
                      <input
                        type="number"
                        value={minOccurrences}
                        onChange={(e) => {
                          const num = parseInt(e.target.value, 10)
                          setMinOccurrences(isNaN(num) ? 1 : Math.max(1, num))
                        }}
                        min="1"
                        max="10"
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {(minTerms === 0 || maxTerms === 0) && (
                    <p className="text-xs text-red-600 font-semibold mt-2">
                      ⚠️ {language === 'pl'
                        ? 'Minimalna i maksymalna liczba terminów muszą być większe od zera!'
                        : 'Minimum and maximum number of terms must be greater than zero!'}
                    </p>
                  )}
                  {maxTerms > 0 && minTerms > 0 && maxTerms < minTerms && (
                    <p className="text-xs text-red-600 font-semibold mt-2">
                      ⚠️ {language === 'pl'
                        ? 'Maksymalna liczba terminów nie może być mniejsza niż minimalna!'
                        : 'Maximum number of terms cannot be less than minimum!'}
                    </p>
                  )}

                  <p className="text-xs text-gray-600 mt-2">
                    {language === 'pl'
                      ? 'Aplikacja będzie dążyć do maksymalnej liczby terminów spełniających kryteria.'
                      : 'The application will aim for the maximum number of terms meeting the criteria.'}
                  </p>
                </div>

                <button
                  onClick={handleStartExtraction}
                  disabled={minTerms === 0 || maxTerms === 0 || maxTerms < minTerms}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {language === 'pl' ? 'Utwórz glosariusz' : 'Create Glossary'}
                </button>
              </div>
            )}
          </div>

          {/* Right side - Glossary Manager & Export */}
          <div className="space-y-4">
            {/* Zarządzanie glosariuszami */}
            {currentProject && (
              <GlossaryManager
                projectId={currentProject.id}
                glossaries={currentProject.glossaries}
                currentGlossaryId={currentProject.currentGlossaryId}
                onGlossaryChange={(glossaryId) => {
                  projectStorage.setCurrentGlossary(currentProject.id, glossaryId)
                  const updated = projectStorage.getById(currentProject.id)
                  if (updated) setCurrentProject(updated)
                  refreshGlossary()
                }}
                onRefresh={() => {
                  const updated = projectStorage.getById(currentProject.id)
                  if (updated) setCurrentProject(updated)
                  setRefreshKey(prev => prev + 1)
                }}
              />
            )}

            {terms.length > 0 && (
              <>
                <div className="bg-white rounded-lg shadow-lg p-4">
                  <h3 className="text-lg font-semibold mb-3 text-gray-800">
                    {language === 'pl' ? 'Akcje' : 'Actions'}
                  </h3>

                  {/* Snapshot Button */}
                  {currentProject && currentGlossary && (
                    <div className="mb-2">
                      <SnapshotButton
                        projectId={currentProject.id}
                        glossaryId={currentGlossary.id}
                        onSnapshotCreated={() => {
                          const updated = projectStorage.getById(currentProject.id)
                          if (updated) setCurrentProject(updated)
                          refreshGlossary()
                        }}
                      />
                    </div>
                  )}

                  <button
                    onClick={handleSaveProject}
                    disabled={terms.length === 0}
                    className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:bg-gray-400"
                  >
                    {language === 'pl'
                      ? (currentProject ? 'Zapisz zmiany' : 'Zapisz jako projekt')
                      : (currentProject ? 'Save changes' : 'Save as project')}
                  </button>
                </div>

                <div className="bg-white rounded-lg shadow-lg p-4">
                  <h3 className="text-lg font-semibold mb-3 text-gray-800">
                    {language === 'pl' ? 'Eksport' : 'Export'}
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
                  <p className="text-sm text-gray-600">
                    {language === 'pl' ? 'Ekstrakcja w toku...' : 'Extraction in progress...'}
                  </p>
                </div>
                <div className="w-full">
                  <div className="flex justify-between mb-1 text-xs">
                    <span className="text-gray-600">{language === 'pl' ? 'Postęp:' : 'Progress:'}</span>
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
          <div className="w-full space-y-4">
            {/* Sugestia dotycząca liczby terminów */}
            {extractionSuggestion && (
              <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 shadow-md">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3 flex-1">
                    <h3 className="text-sm font-semibold text-blue-800 mb-1">
                      💡 {language === 'pl' ? 'Sugestia - Kompleksowy glosariusz' : 'Suggestion - Comprehensive Glossary'}
                    </h3>
                    <p className="text-sm text-blue-700">
                      {extractionSuggestion}
                    </p>
                  </div>
                  <button
                    onClick={() => setExtractionSuggestion(null)}
                    className="ml-3 flex-shrink-0 text-blue-400 hover:text-blue-600 transition-colors"
                    title={language === 'pl' ? 'Zamknij sugestię' : 'Close suggestion'}
                  >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            <TerminologyTable
              terms={terms}
              onUpdate={handleTermUpdate}
              documentText={documentText}
              apiKey={apiKey}
              onTermSelect={setSelectedTerm}
              selectedTermId={selectedTerm?.id}
            />

            {documentText && (
              <DocumentViewer
                documentText={documentText}
                selectedTerm={selectedTerm}
                fileName={fileName}
                terms={terms}
              />
            )}
          </div>
        )}

        {!isLoading && terms.length === 0 && !loadedText && (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <p className="text-gray-500 text-lg">
              {language === 'pl'
                ? 'Załaduj dokument lub wklej tekst, aby rozpocząć'
                : 'Load a document or paste text to get started'}
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
