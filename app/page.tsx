'use client'

import { useState, useEffect } from 'react'
import FileUpload from '@/components/FileUpload'
import BilingualFileUpload from '@/components/BilingualFileUpload'
import ModeSelector from '@/components/ModeSelector'
import TerminologyTable from '@/components/TerminologyTable'
import ExportButtons from '@/components/ExportButtons'
import DocumentViewer from '@/components/DocumentViewer'
import DocumentSplitView from '@/components/DocumentSplitView'
import GlossaryManager from '@/components/GlossaryManager'
import SnapshotButton from '@/components/SnapshotButton'
import LanguageSwitch from '@/components/LanguageSwitch'
import DocumentManager from '@/components/DocumentManager'
import { Project, Glossary, GlossaryVersion, projectStorage, SourceDocument } from '@/utils/projectStorage'
import { useLanguage } from '@/contexts/LanguageContext'

// Kontekst terminu w pojedynczym dokumencie
export interface TermContext {
  documentId: string
  documentName: string
  context: string
  positions: number[]
  occurrences: number
}

export interface Term {
  id: string
  term: string

  // Dla kompatybilności wstecznej (single-document mode)
  context: string
  occurrences: number
  positions: number[]

  // Dla multi-document mode
  contexts?: TermContext[]

  definition?: string
  definitionSource?: 'document' | 'ai' | 'edited' | null

  // Dla bilingual glossary mode (target language)
  targetTerm?: string
  targetContext?: string
  targetOccurrences?: number
  targetPositions?: number[]
  targetSource?: 'document' | 'ai' | 'manual' | 'missing'
}

// Funkcja pomocnicza do znajdowania wszystkich wystąpień terminu w tekście (case sensitive)
function findTermOccurrences(text: string, term: string): { positions: number[], context: string, occurrences: number } {
  const positions: number[] = []

  // Case sensitive search - szukamy dokładnego dopasowania
  let startIndex = 0
  while (startIndex < text.length) {
    const index = text.indexOf(term, startIndex)
    if (index === -1) break

    positions.push(index)
    startIndex = index + term.length
  }

  // Wyciągnij kontekst z pierwszego wystąpienia (150-200 znaków, uwzględnij tekst przed i po)
  let context = ''
  if (positions.length > 0) {
    const firstPos = positions[0]
    const contextStart = Math.max(0, firstPos - 75) // ~75 znaków przed
    const contextEnd = Math.min(text.length, firstPos + term.length + 125) // ~125 znaków po
    context = text.substring(contextStart, contextEnd).trim()

    // Dodaj wielokropek jeśli kontekst został obcięty
    if (contextStart > 0) context = '...' + context
    if (contextEnd < text.length) context = context + '...'
  }

  return {
    positions,
    context,
    occurrences: positions.length
  }
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

  // Bilingual mode state
  const [glossaryMode, setGlossaryMode] = useState<'monolingual' | 'bilingual' | null>(null)
  const [bilingualStage, setBilingualStage] = useState<1 | 2>(1)
  const [sourceDocumentText, setSourceDocumentText] = useState('')
  const [targetDocumentText, setTargetDocumentText] = useState('')
  const [sourceLanguage, setSourceLanguage] = useState('')
  const [targetLanguage, setTargetLanguage] = useState('')
  const [sourceFileName, setSourceFileName] = useState('')
  const [targetFileName, setTargetFileName] = useState('')

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
    setApiKey(key)

    // Wykryj język przez API (franc-min - obsługuje wszystkie języki UE)
    const language = await detectLanguageAPI(text)

    // Jeśli projekt jest wielodokumentowy, dodaj dokument do listy
    if (currentProject?.isMultiDocument) {
      const doc = projectStorage.addDocument(currentProject.id, filename, text, language)
      if (doc) {
        console.log(`📄 Dodano dokument: ${filename}, ${text.length} znaków, język: ${language}`)
        alert(
          (language === 'pl' ? 'pl' : 'en') === 'pl'
            ? `Dokument "${filename}" został dodany.\n\nDokumenty: ${(currentProject.documents?.length || 0) + 1}\nJęzyk: ${language}`
            : `Document "${filename}" has been added.\n\nDocuments: ${(currentProject.documents?.length || 0) + 1}\nLanguage: ${language}`
        )
        const updatedProject = projectStorage.getById(currentProject.id)
        if (updatedProject) {
          setCurrentProject(updatedProject)
        }
      }
    } else {
      // Tryb pojedynczego dokumentu
      setLoadedText(text)
      setLoadedFileName(filename)
      setDetectedLanguage(language)
      console.log(`📄 Załadowano: ${filename}, ${text.length} znaków, język: ${language}`)
    }
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

  // Obsługa ręcznego dodawania terminu
  const handleManualAddTerm = (termText: string) => {
    if (!termText || !documentText || !currentProject || !currentGlossary) {
      alert(language === 'pl'
        ? 'Brak dokumentu źródłowego. Załaduj dokument przed dodaniem terminu.'
        : 'No source document. Load a document before adding a term.')
      return
    }

    const trimmedTerm = termText.trim()

    if (trimmedTerm.length < 2) {
      alert(language === 'pl'
        ? 'Termin musi mieć co najmniej 2 znaki.'
        : 'Term must be at least 2 characters long.')
      return
    }

    // Sprawdź czy termin już istnieje w glosariuszu
    const existingTerm = terms.find(t => t.term.toLowerCase() === trimmedTerm.toLowerCase())
    if (existingTerm) {
      alert(language === 'pl'
        ? `Termin "${trimmedTerm}" już istnieje w glosariuszu.`
        : `Term "${trimmedTerm}" already exists in the glossary.`)
      return
    }

    // Znajdź wszystkie wystąpienia terminu w dokumencie
    const { positions, context, occurrences } = findTermOccurrences(documentText, trimmedTerm)

    if (occurrences === 0) {
      alert(language === 'pl'
        ? `Nie znaleziono terminu "${trimmedTerm}" w dokumencie źródłowym.`
        : `Term "${trimmedTerm}" not found in source document.`)
      return
    }

    // Utwórz nowy termin
    const newTerm: Term = {
      id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      term: trimmedTerm,
      context,
      occurrences,
      positions,
      definition: '',
      definitionSource: null
    }

    // Dodaj do listy terminów
    const updatedTerms = [...terms, newTerm]
    handleTermUpdate(updatedTerms)

    console.log(`✅ Dodano ręcznie termin: "${trimmedTerm}" (${occurrences} wystąpień)`)
    alert(language === 'pl'
      ? `Termin "${trimmedTerm}" został dodany do glosariusza.\n\nZnaleziono ${occurrences} wystąpień w dokumencie.`
      : `Term "${trimmedTerm}" has been added to the glossary.\n\nFound ${occurrences} occurrences in the document.`)
  }

  // Prompt użytkownika do ręcznego dodania terminu
  const promptManualAddTerm = () => {
    const termText = prompt(
      language === 'pl'
        ? 'Wprowadź termin do dodania do glosariusza:'
        : 'Enter term to add to glossary:',
      ''
    )

    if (termText) {
      handleManualAddTerm(termText)
    }
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
    setGlossaryMode(null)
    setBilingualStage(1)
    setSourceDocumentText('')
    setTargetDocumentText('')
    setSourceLanguage('')
    setTargetLanguage('')
    setSourceFileName('')
    setTargetFileName('')
  }

  // Handler dla bilingual extraction
  const handleBilingualExtract = async (
    sourceText: string,
    targetText: string,
    sourceLang: string,
    targetLang: string,
    sourceFile: string,
    targetFile: string
  ) => {
    // Zapisz oba dokumenty w state
    setSourceDocumentText(sourceText)
    setTargetDocumentText(targetText)
    setSourceLanguage(sourceLang)
    setTargetLanguage(targetLang)
    setSourceFileName(sourceFile)
    setTargetFileName(targetFile)

    // Załaduj source document do main state (dla Stage 1 - bazowy glosariusz)
    setLoadedText(sourceText)
    setLoadedFileName(sourceFile)
    setDetectedLanguage(sourceLang)

    console.log(`📄 Załadowano dokumenty bilingual:`)
    console.log(`   Source: ${sourceFile} (${sourceLang}), ${sourceText.length} znaków`)
    console.log(`   Target: ${targetFile} (${targetLang}), ${targetText.length} znaków`)
  }

  // Handler dla znajdowania ekwiwalentów (Stage 2)
  const handleFindAllEquivalents = async () => {
    if (!currentProject || !currentVersion || !apiKey) {
      alert(language === 'pl' ? 'Brak projektu lub klucza API' : 'No project or API key')
      return
    }

    if (!sourceDocumentText || !targetDocumentText) {
      alert(language === 'pl'
        ? 'Brak dokumentów źródłowych. Załaduj oba dokumenty ponownie.'
        : 'Source documents missing. Please reload both documents.')
      return
    }

    setIsLoading(true)
    setProgress(10)

    try {
      console.log(`🔍 Rozpoczynam wyszukiwanie ekwiwalentów dla ${terms.length} terminów...`)

      // Przygotuj dane source terms
      const sourceTerms = terms.map(term => ({
        term: term.term,
        context: term.context || '',
        position: term.positions?.[0] || 0,
        occurrences: term.occurrences
      }))

      setProgress(20)

      const response = await fetch('/api/find-equivalents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey,
          sourceTerms,
          sourceDocument: sourceDocumentText,
          targetDocument: targetDocumentText,
          sourceLanguage,
          targetLanguage,
          mode: 'batch'
        }),
      })

      setProgress(90)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to find equivalents')
      }

      const data = await response.json()

      console.log(`✅ Znaleziono ${data.stats.found}/${data.stats.total} ekwiwalentów`)

      // Aktualizuj terminy z ekwiwalentami
      const updatedTerms = terms.map((term, index) => {
        const result = data.results[index]

        if (result && result.targetTerm) {
          return {
            ...term,
            targetTerm: result.targetTerm,
            targetContext: result.targetContext,
            targetOccurrences: result.targetOccurrences,
            targetPositions: result.targetPositions,
            targetSource: result.targetSource
          }
        }

        // Jeśli nie znaleziono, oznacz jako missing
        return {
          ...term,
          targetTerm: undefined,
          targetContext: undefined,
          targetOccurrences: 0,
          targetPositions: [],
          targetSource: 'missing' as const
        }
      })

      // Zapisz zaktualizowane terminy jako nową wersję
      if (currentGlossary) {
        const description = language === 'pl'
          ? `Znaleziono ekwiwalenty: ${data.stats.found}/${data.stats.total}`
          : `Found equivalents: ${data.stats.found}/${data.stats.total}`

        projectStorage.addVersion(
          currentProject.id,
          currentGlossary.id,
          updatedTerms,
          description,
          currentVersion?.extractionParams,
          false  // Nie jest to snapshot
        )

        const updated = projectStorage.getById(currentProject.id)
        if (updated) {
          setCurrentProject(updated)
          refreshGlossary()
        }
      }

      setProgress(100)

      alert(language === 'pl'
        ? `Znaleziono ${data.stats.found} z ${data.stats.total} ekwiwalentów.\n\nBrak ekwiwalentów: ${data.stats.missing}`
        : `Found ${data.stats.found} out of ${data.stats.total} equivalents.\n\nMissing: ${data.stats.missing}`)

    } catch (error: any) {
      console.error('❌ Błąd wyszukiwania ekwiwalentów:', error)
      alert(language === 'pl'
        ? `Błąd: ${error.message}`
        : `Error: ${error.message}`)
    } finally {
      setIsLoading(false)
      setProgress(0)
    }
  }

  // Handler dla Quick Add - dodawanie target term przez zaznaczenie tekstu
  const handleQuickAddTarget = (termId: string, targetTerm: string) => {
    if (!currentProject || !currentGlossary) return

    const updatedTerms = terms.map(t =>
      t.id === termId
        ? {
            ...t,
            targetTerm,
            targetSource: 'manual' as const,
            targetContext: undefined,
            targetOccurrences: 0,
            targetPositions: []
          }
        : t
    )

    // Zapisz jako nową wersję
    if (currentVersion) {
      const description = language === 'pl'
        ? `Dodano ręcznie: "${targetTerm}" dla "${terms.find(t => t.id === termId)?.term}"`
        : `Manually added: "${targetTerm}" for "${terms.find(t => t.id === termId)?.term}"`

      projectStorage.addVersion(
        currentProject.id,
        currentGlossary.id,
        updatedTerms,
        description,
        currentVersion.extractionParams,
        false
      )

      const updated = projectStorage.getById(currentProject.id)
      if (updated) {
        setCurrentProject(updated)
        refreshGlossary()
      }
    }

    console.log(`✅ Quick Add: "${targetTerm}" jako target dla terminu ID ${termId}`)
  }

  // Ekran wyboru projektu - pokazuj jeśli nie ma wybranego projektu
  if (!currentProject) {
    const allProjects = projectStorage.getAll().sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )

    // Najpierw pokaż ModeSelector jeśli tryb nie został wybrany
    if (glossaryMode === null) {
      return (
        <>
          <LanguageSwitch />
          <ModeSelector
            onSelectMode={(mode) => {
              setGlossaryMode(mode)
              if (mode === 'bilingual') {
                setBilingualStage(1)
              }
            }}
          />
        </>
      )
    }

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
              <p className="text-sm text-gray-500 mt-2">
                {language === 'pl' ? 'Tryb:' : 'Mode:'} {glossaryMode === 'monolingual' ? (language === 'pl' ? 'Jednojęzyczny' : 'Monolingual') : (language === 'pl' ? 'Dwujęzyczny' : 'Bilingual')}
              </p>
            </div>
            <div className="ml-4 flex flex-col gap-2">
              <LanguageSwitch />
              <button
                onClick={() => {
                  setGlossaryMode(null)
                  setBilingualStage(1)
                }}
                className="text-sm px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                {language === 'pl' ? 'Zmień tryb' : 'Change mode'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-xl p-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">
              {language === 'pl' ? 'Wybierz projekt lub utwórz nowy' : 'Select project or create new'}
            </h2>

            {/* Przycisk nowego projektu */}
            <div className="mb-6 space-y-3">
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

                  const name = prompt(language === 'pl' ? 'Nazwa nowego projektu (pojedynczy dokument):' : 'New project name (single document):', defaultName)
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
                className="w-full px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-lg"
              >
                {language === 'pl' ? '+ Nowy projekt (1 dokument)' : '+ New Project (Single Document)'}
              </button>

              <button
                onClick={() => {
                  // Generuj domyślną nazwę z numerem porządkowym
                  const today = new Date().toLocaleDateString(language === 'pl' ? 'pl-PL' : 'en-US')
                  const baseNamePrefix = language === 'pl' ? `Glosariusz wielodokumentowy ${today}` : `Multi-doc Glossary ${today}`

                  // Znajdź wszystkie projekty z dzisiejszą datą
                  const todayProjects = allProjects.filter(p =>
                    p.name.startsWith(baseNamePrefix)
                  )

                  // Oblicz numer porządkowy
                  const nextNumber = todayProjects.length + 1
                  const defaultName = `${baseNamePrefix}_${nextNumber}`

                  const name = prompt(language === 'pl' ? 'Nazwa nowego projektu wielodokumentowego:' : 'New multi-document project name:', defaultName)
                  if (name) {
                    const newProject = projectStorage.save({
                      name,
                      fileName: '',
                      documentText: '',
                      detectedLanguage: ''
                    })
                    // Oznacz jako projekt wielodokumentowy
                    projectStorage.update(newProject.id, { isMultiDocument: true, documents: [] })
                    const updatedProject = projectStorage.getById(newProject.id)
                    if (updatedProject) {
                      setCurrentProject(updatedProject)
                      setProjectName(updatedProject.name)
                      refreshGlossary()
                    }
                  }
                }}
                className="w-full px-6 py-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold text-lg"
              >
                {language === 'pl' ? '+ Nowy projekt (wiele dokumentów)' : '+ New Project (Multiple Documents)'}
              </button>
            </div>

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
            {glossaryMode === 'bilingual' && (
              <div className="mt-2 flex items-center gap-2">
                <span className="px-3 py-1 bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 text-xs font-semibold rounded-full">
                  {language === 'pl' ? 'Tryb dwujęzyczny' : 'Bilingual Mode'}
                </span>
                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                  bilingualStage === 1
                    ? 'bg-green-100 text-green-800'
                    : 'bg-purple-100 text-purple-800'
                }`}>
                  {bilingualStage === 1
                    ? (language === 'pl' ? 'Etap 1: Glosariusz bazowy' : 'Stage 1: Base Glossary')
                    : (language === 'pl' ? 'Etap 2: Wyszukiwanie ekwiwalentów' : 'Stage 2: Finding Equivalents')}
                </span>
                <span className="text-xs text-gray-600">
                  {sourceLanguage} → {targetLanguage}
                </span>
              </div>
            )}
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
            {glossaryMode === 'bilingual' ? (
              <BilingualFileUpload
                onExtract={handleBilingualExtract}
                isLoading={isLoading}
                savedApiKey={apiKey}
              />
            ) : (
              <FileUpload
                onExtract={handleFileLoaded}
                isLoading={isLoading}
                savedApiKey={apiKey}
              />
            )}

            {/* Akcje i Eksport pod FileUpload */}
            {terms.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                  {/* Manual Add Term Button */}
                  {documentText && (
                    <button
                      onClick={promptManualAddTerm}
                      className="w-[180px] mb-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center gap-2"
                      title={language === 'pl' ? 'Dodaj termin ręcznie' : 'Add term manually'}
                    >
                      <span>➕</span>
                      <span>{language === 'pl' ? 'Dodaj termin' : 'Add Term'}</span>
                    </button>
                  )}

                  <button
                    onClick={handleSaveProject}
                    disabled={terms.length === 0}
                    className="w-[180px] px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:bg-gray-400 flex items-center gap-2"
                  >
                    {language === 'pl'
                      ? (currentProject ? 'Zapisz zmiany' : 'Zapisz jako projekt')
                      : (currentProject ? 'Save changes' : 'Save as project')}
                  </button>

                  {/* Bilingual Workflow Buttons - Stage 1 */}
                  {glossaryMode === 'bilingual' && bilingualStage === 1 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-xs text-gray-600 mb-3">
                        {language === 'pl' ? 'Glosariusz dwujęzyczny - Etap 1' : 'Bilingual Glossary - Stage 1'}
                      </p>
                      <button
                        onClick={() => {
                          const confirmMsg = language === 'pl'
                            ? 'Zatwierdzić glosariusz bazowy i przejść do wyszukiwania ekwiwalentów?'
                            : 'Approve base glossary and proceed to finding equivalents?'
                          if (confirm(confirmMsg)) {
                            setBilingualStage(2)
                            console.log('✅ Glosariusz bazowy zatwierdzony, przejście do Stage 2')
                          }
                        }}
                        disabled={terms.length === 0}
                        className="w-full mb-2 px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all font-semibold disabled:from-gray-400 disabled:to-gray-400 shadow-md"
                      >
                        ✓ {language === 'pl' ? 'Zatwierdź glosariusz bazowy' : 'Approve Base Glossary'}
                      </button>
                      <p className="text-xs text-gray-500 italic">
                        {language === 'pl'
                          ? 'Po zatwierdzeniu będziesz mógł wyszukiwać ekwiwalenty w dokumencie docelowym'
                          : 'After approval you can find equivalents in target document'}
                      </p>
                    </div>
                  )}

                  {/* Bilingual Workflow Buttons - Stage 2 */}
                  {glossaryMode === 'bilingual' && bilingualStage === 2 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-xs text-gray-600 mb-3">
                        {language === 'pl' ? 'Glosariusz dwujęzyczny - Etap 2' : 'Bilingual Glossary - Stage 2'}
                      </p>
                      <button
                        onClick={handleFindAllEquivalents}
                        disabled={isLoading || terms.length === 0}
                        className="w-full mb-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-semibold disabled:from-gray-400 disabled:to-gray-400 shadow-md"
                      >
                        {isLoading ? (
                          <>⏳ {language === 'pl' ? 'Wyszukiwanie...' : 'Finding...'}</>
                        ) : (
                          <>🔍 {language === 'pl' ? 'Znajdź wszystkie ekwiwalenty' : 'Find All Equivalents'}</>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          const confirmMsg = language === 'pl'
                            ? 'Wrócić do edycji glosariusza bazowego?'
                            : 'Return to editing base glossary?'
                          if (confirm(confirmMsg)) {
                            setBilingualStage(1)
                          }
                        }}
                        className="w-full px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                      >
                        ← {language === 'pl' ? 'Powrót do Etapu 1' : 'Back to Stage 1'}
                      </button>
                    </div>
                  )}
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
              </div>
            )}

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
            {/* Zarządzanie dokumentami (tylko dla projektów wielodokumentowych) */}
            {currentProject && currentProject.isMultiDocument && currentProject.documents && (
              <DocumentManager
                projectId={currentProject.id}
                documents={currentProject.documents}
                onRefresh={() => {
                  const updated = projectStorage.getById(currentProject.id)
                  if (updated) setCurrentProject(updated)
                  setRefreshKey(prev => prev + 1)
                }}
              />
            )}

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
              glossaryMode={glossaryMode}
              bilingualStage={bilingualStage}
              sourceDocument={sourceDocumentText}
              targetDocument={targetDocumentText}
              sourceLanguage={sourceLanguage}
              targetLanguage={targetLanguage}
            />

            {/* Document viewers - bilingual vs monolingual */}
            {glossaryMode === 'bilingual' && bilingualStage === 2 && sourceDocumentText && targetDocumentText ? (
              <DocumentSplitView
                sourceDocument={sourceDocumentText}
                targetDocument={targetDocumentText}
                sourceLanguage={sourceLanguage}
                targetLanguage={targetLanguage}
                terms={terms}
                selectedTerm={selectedTerm}
                onQuickAddTarget={handleQuickAddTarget}
                onTermSelect={setSelectedTerm}
              />
            ) : documentText ? (
              <DocumentViewer
                documentText={documentText}
                selectedTerm={selectedTerm}
                fileName={fileName}
                terms={terms}
                onAddTermFromSelection={handleManualAddTerm}
              />
            ) : null}
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
