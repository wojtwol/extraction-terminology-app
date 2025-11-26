'use client'

import { useState, useEffect } from 'react'
import FileUpload from '@/components/FileUpload'
import TerminologyTable from '@/components/TerminologyTable'
import ExportButtons from '@/components/ExportButtons'
import DocumentViewer from '@/components/DocumentViewer'
import SplitDocumentViewer from '@/components/SplitDocumentViewer'
import GlossaryManager from '@/components/GlossaryManager'
import SnapshotButton from '@/components/SnapshotButton'
import LanguageSwitch from '@/components/LanguageSwitch'
import DocumentManager from '@/components/DocumentManager'
import { Project, Glossary, GlossaryVersion, projectStorage, SourceDocument } from '@/utils/projectStorage'
import { normalizeTermForComparison, areTermVariants, getPreferredTermForm, convertToSingular, normalizeSourceDocumentName } from '@/utils/termNormalization'
import { useLanguage } from '@/contexts/LanguageContext'
import { ToastContainer, useToast } from '@/components/Toast'
import BaseFormModal from '@/components/BaseFormModal'

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
  sourceDocument?: string  // Nazwa dokumentu źródłowego z którego wyekstrahowano termin
  foundForm?: string  // Forma fleksyjna znaleziona w dokumencie (dla języków słowiańskich z lemmatyzacją)

  // Dla incremental extraction mode
  isNew?: boolean  // Oznaczenie nowo dodanego terminu podczas rozbudowy
  addedAt?: string  // Timestamp dodania terminu

  // Dla bilingual glossary mode (target language)
  targetTerm?: string
  targetFoundForm?: string  // Forma fleksyjna znaleziona w dokumencie (do zaznaczania w kontekście)
  targetContext?: string
  targetOccurrences?: number
  targetPositions?: number[]
  targetSource?: 'document' | 'ai' | 'manual' | 'missing'

  // Warianty terminu (np. plural/singular, and/or) - zgrupowane razem
  variants?: string[]
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

  // Wyciągnij kontekst z pierwszego wystąpienia (225-300 znaków, zwiększone o 50%, uwzględnij tekst przed i po)
  let context = ''
  if (positions.length > 0) {
    const firstPos = positions[0]
    const contextStart = Math.max(0, firstPos - 113) // ~113 znaków przed (zwiększone o 50% z 75)
    const contextEnd = Math.min(text.length, firstPos + term.length + 188) // ~188 znaków po (zwiększone o 50% z 125)
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
  const toast = useToast()

  // Stan dla modala formy podstawowej
  const [baseFormModal, setBaseFormModal] = useState<{
    isOpen: boolean
    foundForm: string
    pendingTermData: {
      positions: number[]
      context: string
      occurrences: number
    } | null
  }>({ isOpen: false, foundForm: '', pendingTermData: null })

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
  const [clearTrigger, setClearTrigger] = useState(0) // Trigger dla czyszczenia pól w komponentach FileUpload

  // Parametry ekstrakcji
  const [minTerms, setMinTerms] = useState(10)
  const [maxTerms, setMaxTerms] = useState(30)

  // Sortowanie terminów (przekazywane do TerminologyTable i ExportButtons)
  const [sortBy, setSortBy] = useState<'alphabetical' | 'occurrences' | 'position'>('alphabetical')
  const [minLength, setMinLength] = useState(3)
  const [minOccurrences, setMinOccurrences] = useState(1)
  const [generateDefinitions, setGenerateDefinitions] = useState(false)

  // Wybrany termin do podświetlenia w dokumencie
  const [selectedTerm, setSelectedTerm] = useState<Term | null>(null)

  // Sugestia dotycząca liczby terminów
  const [extractionSuggestion, setExtractionSuggestion] = useState<string | null>(null)

  // Dialogi dla glosariuszy dwujęzycznych
  const [showBilingualDialog, setShowBilingualDialog] = useState(false)
  const [bilingualDialogStep, setBilingualDialogStep] = useState<'language' | 'document' | 'columns' | 'processing'>('language')
  const [selectedTargetLanguage, setSelectedTargetLanguage] = useState('')
  const [selectedColumnView, setSelectedColumnView] = useState<'2' | '4'>('4')
  const [bilingualProgress, setBilingualProgress] = useState({ current: 0, total: 0, message: '' })
  const [bilingualInputMode, setBilingualInputMode] = useState<'file' | 'url' | 'text'>('file')

  // Notification state
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string, details?: string } | null>(null)

  // Project name modal state
  const [showProjectNameModal, setShowProjectNameModal] = useState(false)
  const [projectNameInput, setProjectNameInput] = useState('')
  const [projectType, setProjectType] = useState<'single' | 'multi'>('single')
  const [defaultProjectName, setDefaultProjectName] = useState('')

  // Merge project glossaries dialog state
  const [showMergeProjectDialog, setShowMergeProjectDialog] = useState(false)
  const [selectedGlossariesForMerge, setSelectedGlossariesForMerge] = useState<string[]>([])

  // Expand glossary dialog state
  const [showExpandGlossaryDialog, setShowExpandGlossaryDialog] = useState(false)
  const [expandGlossaryInput, setExpandGlossaryInput] = useState('')

  // Info dialog state (modal that requires OK click to close)
  const [infoDialog, setInfoDialog] = useState<{
    title: string
    message: string
    details?: string
    type: 'success' | 'error' | 'info'
  } | null>(null)

  // Skrót do terminów z aktualnej wersji
  const terms = currentVersion?.terms || []

  // Auto-hide notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [notification])

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
      setGlossaryMode(null)
      setTargetDocumentText('')
      setSelectedColumnView('4')
      return
    }

    const glossary = projectStorage.getCurrentGlossary(currentProject.id)
    setCurrentGlossary(glossary)

    if (glossary) {
      const version = projectStorage.getCurrentVersion(currentProject.id, glossary.id)
      setCurrentVersion(version)

      // Ustaw tryb glosariusza (dwujęzyczny lub jednojęzyczny)
      if (glossary.isBilingual) {
        setGlossaryMode('bilingual')
        setTargetDocumentText(glossary.targetDocumentText || '')
        setSelectedColumnView(glossary.columnView || '4')
      } else {
        setGlossaryMode('monolingual')
        setTargetDocumentText('')
        setSelectedColumnView('4')
      }
    } else {
      setCurrentVersion(null)
      setGlossaryMode(null)
      setTargetDocumentText('')
      setSelectedColumnView('4')
    }
  }

  // Obsługa utworzenia nowego projektu
  const handleCreateProject = () => {
    const name = projectNameInput.trim()
    if (!name) return

    if (projectType === 'single') {
      const newProject = projectStorage.save({
        name,
        fileName: '',
        documentText: '',
        detectedLanguage: ''
      }, language)
      setCurrentProject(newProject)
      setProjectName(newProject.name)
      refreshGlossary()

      // Pokaż notification sukcesu
      setNotification({
        type: 'success',
        message: language === 'pl' ? 'Projekt utworzony!' : 'Project created!',
        details: language === 'pl'
          ? `Nowy projekt "${name}" został utworzony. Załaduj dokument, aby rozpocząć.`
          : `New project "${name}" has been created. Load a document to get started.`
      })
    } else {
      const newProject = projectStorage.save({
        name,
        fileName: '',
        documentText: '',
        detectedLanguage: ''
      }, language)
      // Oznacz jako projekt wielodokumentowy
      projectStorage.update(newProject.id, { isMultiDocument: true, documents: [] })
      const updatedProject = projectStorage.getById(newProject.id)
      if (updatedProject) {
        setCurrentProject(updatedProject)
        setProjectName(updatedProject.name)
        refreshGlossary()

        // Pokaż notification sukcesu
        setNotification({
          type: 'success',
          message: language === 'pl' ? 'Projekt wielodokumentowy utworzony!' : 'Multi-document project created!',
          details: language === 'pl'
            ? `Projekt "${name}" został utworzony. Dodaj dokumenty, aby rozpocząć.`
            : `Project "${name}" has been created. Add documents to get started.`
        })
      }
    }

    // Zamknij modal
    setShowProjectNameModal(false)
    setProjectNameInput('')
  }

  // Generuj definicje dla wszystkich terminów (bulk)
  const handleBulkGenerateDefinitions = async (termsToProcess: Term[]) => {
    if (!apiKey || !documentText || !currentProject || !currentGlossary) return

    console.log(`🔄 Rozpoczynam generowanie definicji dla ${termsToProcess.length} terminów...`)
    setIsLoading(true)
    setProgress(0)

    try {
      const totalTerms = termsToProcess.length
      let processedCount = 0
      const updatedTerms = [...terms]

      for (const term of termsToProcess) {
        try {
          setProgress(Math.round((processedCount / totalTerms) * 100))

          const response = await fetch('/api/generate-definition', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              term: term.term,
              documentText: documentText,
              apiKey: apiKey,
              language: detectedLanguage || 'pl'
            }),
          })

          if (response.ok) {
            const data = await response.json()

            // Znajdź i zaktualizuj termin
            const termIndex = updatedTerms.findIndex(t => t.id === term.id)
            if (termIndex !== -1) {
              updatedTerms[termIndex] = {
                ...updatedTerms[termIndex],
                definition: data.definition,
                definitionSource: data.source
              }
            }

            console.log(`✅ Wygenerowano definicję dla: ${term.term}`)
          } else {
            console.error(`❌ Błąd generowania definicji dla: ${term.term}`)
          }

          processedCount++

          // Pauza aby nie przeciążać API
          if (processedCount < totalTerms) {
            await new Promise(resolve => setTimeout(resolve, 500))
          }

        } catch (error) {
          console.error(`❌ Błąd dla terminu ${term.term}:`, error)
          processedCount++
        }
      }

      // Zapisz zaktualizowane terminy
      projectStorage.addVersion(
        currentProject.id,
        currentGlossary.id,
        updatedTerms,
        language === 'pl'
          ? `Wygenerowano ${processedCount} definicji AI`
          : `Generated ${processedCount} AI definitions`,
        currentVersion?.extractionParams,
        false
      )

      const updatedProject = projectStorage.getById(currentProject.id)
      if (updatedProject) {
        setCurrentProject(updatedProject)
      }
      refreshGlossary()

      setProgress(100)
      console.log(`✅ Zakończono generowanie definicji: ${processedCount}/${totalTerms}`)

      alert(language === 'pl'
        ? `Wygenerowano definicje!\n\nPrzetworzono: ${processedCount}/${totalTerms} terminów`
        : `Definitions generated!\n\nProcessed: ${processedCount}/${totalTerms} terms`)

      setTimeout(() => setProgress(0), 1000)

    } catch (error) {
      console.error('❌ Błąd bulk generowania definicji:', error)
      alert(language === 'pl'
        ? 'Błąd podczas generowania definicji. Sprawdź konsolę.'
        : 'Error generating definitions. Check console.')
      setProgress(0)
    } finally {
      setIsLoading(false)
    }
  }

  // Rozbudowa glosariusza - otwórz dialog
  const handleExpandGlossary = () => {
    if (!documentText || !apiKey || !currentProject || !currentGlossary) {
      setNotification({
        type: 'error',
        message: language === 'pl' ? 'Nie można rozbudować glosariusza' : 'Cannot expand glossary',
        details: language === 'pl'
          ? 'Brak dokumentu lub projektu. Załaduj dokument i utwórz projekt przed rozbudową.'
          : 'No document or project. Load a document and create a project before expanding.'
      })
      return
    }

    // Ustaw domyślną wartość i otwórz dialog
    setExpandGlossaryInput(Math.max(maxTerms, terms.length + 20).toString())
    setShowExpandGlossaryDialog(true)
  }

  // Wykonaj rozbudowę glosariusza
  const doExpandGlossary = async () => {
    if (!currentProject || !currentGlossary) return

    const newMaxTerms = parseInt(expandGlossaryInput, 10)
    if (isNaN(newMaxTerms) || newMaxTerms <= terms.length) {
      setNotification({
        type: 'error',
        message: language === 'pl' ? 'Nieprawidłowa liczba terminów' : 'Invalid number of terms',
        details: language === 'pl'
          ? `Nowa maksymalna liczba terminów musi być większa niż obecna (${terms.length}).`
          : `New maximum number of terms must be greater than current (${terms.length}).`
      })
      return
    }

    setShowExpandGlossaryDialog(false)
    setIsLoading(true)
    setExtractionSuggestion(null)
    setProgress(0)

    try {
      console.log(`📤 Rozbudowa glosariusza: obecne ${terms.length} -> docelowe ${newMaxTerms} terminów`)

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
          text: documentText,
          apiKey,
          minTerms: terms.length + 5, // Minimum to co już mamy + 5
          maxTerms: newMaxTerms,
          minLength,
          minOccurrences,
          detectedLanguage,
          caseSensitive: false
        }),
      })

      clearInterval(progressInterval)
      setProgress(95)

      console.log(`📥 Status odpowiedzi: ${response.status}`)

      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text()
        console.error('❌ Odpowiedź nie jest JSON:', textResponse.substring(0, 500))
        throw new Error(`Serwer zwrócił błąd (status ${response.status}). Sprawdź logi Vercel lub konsolę.`)
      }

      const data = await response.json()

      if (!response.ok) {
        const errorMessage = data.error || 'Nieznany błąd podczas ekstrakcji'
        console.error('❌ Błąd API:', errorMessage)
        throw new Error(errorMessage)
      }

      if (!data.terms || data.terms.length === 0) {
        setNotification({
          type: 'error',
          message: language === 'pl' ? 'Nie znaleziono nowych terminów' : 'No new terms found',
          details: language === 'pl'
            ? 'Spróbuj zwiększyć maksymalną liczbę terminów lub zmienić parametry wyszukiwania.'
            : 'Try increasing the maximum number of terms or changing search parameters.'
        })
        setProgress(0)
        return
      }

      // Merge z istniejącymi terminami (deduplikacja)
      const existingTermsMap = new Map<string, Term>()
      terms.forEach(term => existingTermsMap.set(term.term, term))

      let addedCount = 0
      let skippedCount = 0

      data.terms.forEach((newTerm: Term) => {
        if (existingTermsMap.has(newTerm.term)) {
          skippedCount++
        } else {
          existingTermsMap.set(newTerm.term, {
            ...newTerm,
            isNew: true,
            addedAt: new Date().toISOString(),
            sourceDocument: newTerm.sourceDocument || fileName
          })
          addedCount++
        }
      })

      const expandedTerms = Array.from(existingTermsMap.values())

      // Zapisz jako nową wersję
      const description = language === 'pl'
        ? `Rozbudowa: +${addedCount} nowych terminów (${skippedCount} pominiętych duplikatów)`
        : `Expansion: +${addedCount} new terms (${skippedCount} duplicates skipped)`

      projectStorage.addVersion(
        currentProject.id,
        currentGlossary.id,
        expandedTerms,
        description,
        { minTerms, maxTerms: newMaxTerms, minLength, minOccurrences },
        false
      )

      const updatedProject = projectStorage.getById(currentProject.id)
      if (updatedProject) {
        setCurrentProject(updatedProject)
      }
      refreshGlossary()

      setProgress(100)
      console.log(`✅ Rozbudowano glosariusz: +${addedCount} terminów (łącznie: ${expandedTerms.length})`)

      setNotification({
        type: 'success',
        message: language === 'pl' ? 'Rozbudowano glosariusz!' : 'Glossary expanded!',
        details: language === 'pl'
          ? `Dodano: ${addedCount} nowych terminów | Pominięto: ${skippedCount} duplikatów | Łącznie: ${expandedTerms.length} terminów`
          : `Added: ${addedCount} new terms | Skipped: ${skippedCount} duplicates | Total: ${expandedTerms.length} terms`
      })

      setTimeout(() => setProgress(0), 1000)

    } catch (error) {
      console.error('❌ Błąd rozbudowy:', error)
      const errorMessage = error instanceof Error ? error.message : 'Nieznany błąd'
      alert(`❌ Błąd rozbudowy:\n\n${errorMessage}`)
      setProgress(0)
    } finally {
      setIsLoading(false)
    }
  }

  // Lista języków UE + dodatkowe
  const TARGET_LANGUAGES = [
    { code: 'bg', name: language === 'pl' ? 'Bułgarski' : 'Bulgarian' },
    { code: 'cs', name: language === 'pl' ? 'Czeski' : 'Czech' },
    { code: 'da', name: language === 'pl' ? 'Duński' : 'Danish' },
    { code: 'de', name: language === 'pl' ? 'Niemiecki' : 'German' },
    { code: 'el', name: language === 'pl' ? 'Grecki' : 'Greek' },
    { code: 'en', name: language === 'pl' ? 'Angielski' : 'English' },
    { code: 'es', name: language === 'pl' ? 'Hiszpański' : 'Spanish' },
    { code: 'et', name: language === 'pl' ? 'Estoński' : 'Estonian' },
    { code: 'fi', name: language === 'pl' ? 'Fiński' : 'Finnish' },
    { code: 'fr', name: language === 'pl' ? 'Francuski' : 'French' },
    { code: 'ga', name: language === 'pl' ? 'Irlandzki' : 'Irish' },
    { code: 'hr', name: language === 'pl' ? 'Chorwacki' : 'Croatian' },
    { code: 'hu', name: language === 'pl' ? 'Węgierski' : 'Hungarian' },
    { code: 'it', name: language === 'pl' ? 'Włoski' : 'Italian' },
    { code: 'lt', name: language === 'pl' ? 'Litewski' : 'Lithuanian' },
    { code: 'lv', name: language === 'pl' ? 'Łotewski' : 'Latvian' },
    { code: 'mt', name: language === 'pl' ? 'Maltański' : 'Maltese' },
    { code: 'nl', name: language === 'pl' ? 'Niderlandzki' : 'Dutch' },
    { code: 'pl', name: language === 'pl' ? 'Polski' : 'Polish' },
    { code: 'pt', name: language === 'pl' ? 'Portugalski' : 'Portuguese' },
    { code: 'ro', name: language === 'pl' ? 'Rumuński' : 'Romanian' },
    { code: 'sk', name: language === 'pl' ? 'Słowacki' : 'Slovak' },
    { code: 'sl', name: language === 'pl' ? 'Słoweński' : 'Slovenian' },
    { code: 'sv', name: language === 'pl' ? 'Szwedzki' : 'Swedish' },
    // Języki dodatkowe
    { code: 'tr', name: language === 'pl' ? 'Turecki' : 'Turkish' },
    { code: 'sr', name: language === 'pl' ? 'Serbski' : 'Serbian' },
    { code: 'sq', name: language === 'pl' ? 'Albański' : 'Albanian' },
    { code: 'uk', name: language === 'pl' ? 'Ukraiński' : 'Ukrainian' },
    { code: 'ru', name: language === 'pl' ? 'Rosyjski' : 'Russian' },
  ]

  // Tworzenie glosariusza dwujęzycznego na bazie jednojęzycznego
  const handleCreateBilingualGlossary = () => {
    if (!currentProject || !currentGlossary || !documentText) {
      return
    }

    // Otwórz dialog z pierwszym krokiem (wybór języka)
    setSelectedTargetLanguage('')
    setSelectedColumnView('4')
    setBilingualDialogStep('language')
    setBilingualInputMode('file')
    setShowBilingualDialog(true)
  }

  // Funkcja do ekstrakcji tekstu z różnych formatów plików
  const extractTextFromFile = async (file: File): Promise<string> => {
    const extension = file.name.split('.').pop()?.toLowerCase()

    switch (extension) {
      case 'txt':
      case 'html':
      case 'xml':
        return await file.text()

      case 'docx':
        const mammoth = (await import('mammoth')).default
        const arrayBuffer = await file.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer })
        return result.value

      case 'xlsx':
      case 'xls':
        const XLSX = (await import('xlsx'))
        const xlsxBuffer = await file.arrayBuffer()
        const workbook = XLSX.read(xlsxBuffer, { type: 'array' })
        let xlsxText = ''
        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName]
          xlsxText += XLSX.utils.sheet_to_txt(sheet) + '\n'
        })
        return xlsxText

      default:
        throw new Error(language === 'pl' ? `Nieobsługiwany format pliku: ${extension}` : `Unsupported file format: ${extension}`)
    }
  }

  // Obsługa załadowania dokumentu docelowego
  const handleBilingualDocumentLoad = async (file: File) => {
    try {
      setIsLoading(true)

      // Użyj funkcji extractTextFromFile dla wszystkich obsługiwanych formatów
      const targetDocText = await extractTextFromFile(file)

      if (!targetDocText || targetDocText.trim().length === 0) {
        alert(language === 'pl'
          ? 'Dokument docelowy jest pusty'
          : 'Target document is empty')
        setIsLoading(false)
        return
      }

      // Przejdź do procesu dopasowywania
      await processBilingualMatching(targetDocText)

    } catch (error) {
      console.error('❌ Błąd wczytywania dokumentu:', error)
      const errorMessage = error instanceof Error ? error.message : 'Nieznany błąd'
      alert(`❌ Błąd:\n\n${errorMessage}`)
      setIsLoading(false)
      setShowBilingualDialog(false)
    }
  }

  // Proces dopasowywania terminów dwujęzycznych
  const processBilingualMatching = async (targetDocText: string) => {
    if (!currentProject || !currentGlossary || !documentText || !apiKey) return

    let progressInterval: NodeJS.Timeout | null = null

    try {
      setBilingualDialogStep('processing')
      setBilingualProgress({ current: 0, total: terms.length, message: language === 'pl' ? 'Rozpoczynam dopasowywanie...' : 'Starting matching...' })

      console.log('🔄 Rozpoczynam dopasowywanie terminów...')
      setProgress(10)

      // Określ czy i jak podzielić na etapy
      let batches: Term[][] = []
      const BATCH_SIZE = 15

      if (terms.length > 30) {
        // Dla >30 terminów: dziel na batche po 15 terminów
        for (let i = 0; i < terms.length; i += BATCH_SIZE) {
          batches.push(terms.slice(i, i + BATCH_SIZE))
        }
        console.log(`📊 Podział na ${batches.length} etapów (po ${BATCH_SIZE} terminów): ${terms.length} terminów, dokument ${targetDocText.length} znaków`)
      } else if (terms.length > 15 && targetDocText.length > 100000) {
        // Dla 16-30 terminów i dużego dokumentu: dziel na 2 batche
        const midpoint = Math.ceil(terms.length / 2)
        batches = [terms.slice(0, midpoint), terms.slice(midpoint)]
        console.log(`📊 Podział na 2 etapy: ${terms.length} terminów, dokument ${targetDocText.length} znaków`)
      } else {
        // Standardowe przetwarzanie bez podziału
        batches = [terms]
        console.log(`📊 Standardowe przetwarzanie: ${terms.length} terminów, dokument ${targetDocText.length} znaków`)
      }

      let allMatchedTerms: Term[] = []
      let processedTerms = 0

      // Przetwarzaj każdy batch
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex]
        const batchNumber = batchIndex + 1
        const totalBatches = batches.length

        console.log(`   Etap ${batchNumber}/${totalBatches}: ${batch.length} terminów`)

        if (totalBatches > 1) {
          setBilingualProgress({
            current: processedTerms,
            total: terms.length,
            message: language === 'pl'
              ? `Etap ${batchNumber}/${totalBatches}: Przetwarzanie ${batch.length} terminów...`
              : `Stage ${batchNumber}/${totalBatches}: Processing ${batch.length} terms...`
          })
        }

        // Progress interval dla bieżącego batcha
        let currentTermIndex = processedTerms
        progressInterval = setInterval(() => {
          const localIndex = currentTermIndex - processedTerms
          if (localIndex < batch.length) {
            const currentTerm = batch[localIndex]?.term || ''
            setBilingualProgress({
              current: currentTermIndex + 1,
              total: terms.length,
              message: totalBatches > 1
                ? (language === 'pl' ? `Etap ${batchNumber}/${totalBatches}: "${currentTerm}"` : `Stage ${batchNumber}/${totalBatches}: "${currentTerm}"`)
                : (language === 'pl' ? `Dopasowywanie terminu: "${currentTerm}"` : `Matching term: "${currentTerm}"`)
            })
            currentTermIndex++
          }
        }, 500)

        const response = await fetch('/api/match-bilingual-terms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceTerms: batch,
            sourceText: documentText,
            targetText: targetDocText,
            sourceLanguage: detectedLanguage || 'unknown',
            targetLanguage: selectedTargetLanguage,
            apiKey: apiKey
          })
        })

        clearInterval(progressInterval)

        if (!response.ok) {
          // Obsługa błędów
          if (response.status === 504) {
            throw new Error(
              language === 'pl'
                ? `Timeout w etapie ${batchNumber}/${totalBatches}. Spróbuj z mniejszą liczbą terminów.`
                : `Timeout in stage ${batchNumber}/${totalBatches}. Try with fewer terms.`
            )
          }

          const contentType = response.headers.get('content-type')
          if (contentType && contentType.includes('application/json')) {
            const error = await response.json()
            console.error('❌ API Error response:', error)
            throw new Error(error.error || `Etap ${batchNumber} nieudany`)
          } else {
            const errorText = await response.text()
            console.error('❌ Non-JSON error response:', errorText.substring(0, 200))
            throw new Error(
              language === 'pl'
                ? `Błąd serwera w etapie ${batchNumber}/${totalBatches}: ${response.status}`
                : `Server error in stage ${batchNumber}/${totalBatches}: ${response.status}`
            )
          }
        }

        const result = await response.json()
        allMatchedTerms = [...allMatchedTerms, ...result.matchedTerms]
        processedTerms += batch.length

        console.log(`✅ Etap ${batchNumber}/${totalBatches} zakończony: ${result.matchedTerms.length} terminów`)
      }

      if (batches.length > 1) {
        console.log(`✅ Łącznie: ${allMatchedTerms.length} terminów z ${batches.length} etapów`)
      }

      setProgress(80)

      // Wyświetl statystyki
      console.log('📊 Matched terms received:', allMatchedTerms.length)
      console.log('📋 First 3 matched terms:', allMatchedTerms.slice(0, 3))
      console.log('🎯 Terms with targetTerm:', allMatchedTerms.filter((t: Term) => t.targetTerm).length)

      // Check for terms without target
      const missingTerms = allMatchedTerms.filter((t: Term) => !t.targetTerm)
      if (missingTerms.length > 0) {
        console.warn('⚠️ Terms without targetTerm:', missingTerms.length)
        console.warn('⚠️ Sample missing term:', missingTerms[0])
        console.warn('⚠️ Missing term targetSource values:', missingTerms.map((t: Term) => t.targetSource))
      }

      setProgress(90)

      // Utwórz nowy glosariusz dwujęzyczny
      const bilingualGlossaryName = `${currentGlossary.name} (${detectedLanguage || 'source'}-${selectedTargetLanguage})`

      const newGlossary: Glossary = {
        id: `glossary-${Date.now()}`,
        name: bilingualGlossaryName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currentVersionId: '',
        versions: [],
        isBilingual: true,
        sourceLanguage: detectedLanguage || 'unknown',
        targetLanguage: selectedTargetLanguage,
        sourceDocumentText: documentText,
        targetDocumentText: targetDocText,
        columnView: selectedColumnView
      }

      const initialVersion: GlossaryVersion = {
        id: `version-${Date.now()}-1`,
        versionNumber: 1,
        createdAt: new Date().toISOString(),
        description: language === 'pl'
          ? `Glosariusz dwujęzyczny utworzony z: ${currentGlossary.name}`
          : `Bilingual glossary created from: ${currentGlossary.name}`,
        terms: allMatchedTerms
      }

      newGlossary.versions = [initialVersion]
      newGlossary.currentVersionId = initialVersion.id

      // Dodaj nowy glosariusz do projektu
      const updatedProject = { ...currentProject }
      updatedProject.glossaries.push(newGlossary)
      updatedProject.currentGlossaryId = newGlossary.id
      updatedProject.updatedAt = new Date().toISOString()

      // Zapisz zaktualizowany projekt
      projectStorage.update(currentProject.id, {
        glossaries: updatedProject.glossaries,
        currentGlossaryId: newGlossary.id
      })

      // Pobierz zaktualizowany projekt z storage
      const refreshedProject = projectStorage.getById(currentProject.id)
      if (!refreshedProject) {
        throw new Error('Failed to refresh project')
      }

      setCurrentProject(refreshedProject)
      setCurrentGlossary(newGlossary)
      refreshGlossary()

      setProgress(100)
      setBilingualProgress({
        current: allMatchedTerms.length,
        total: terms.length,
        message: language === 'pl' ? 'Zakończono!' : 'Completed!'
      })

      console.log(`✅ Utworzono glosariusz dwujęzyczny: ${allMatchedTerms.length} terminów`)

      setTimeout(() => {
        setProgress(0)
        setShowBilingualDialog(false)
        setIsLoading(false)
      }, 2000)

    } catch (error) {
      console.error('❌ Błąd tworzenia glosariusza dwujęzycznego:', error)
      const errorMessage = error instanceof Error ? error.message : 'Nieznany błąd'

      // Zatrzymaj progress interval w przypadku błędu
      if (progressInterval) {
        clearInterval(progressInterval)
      }

      setBilingualProgress({
        current: 0,
        total: 0,
        message: `❌ ${errorMessage}`
      })
      setIsLoading(false)

      setTimeout(() => {
        setShowBilingualDialog(false)
      }, 3000)
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
        console.error('❌ Odpowiedź nie jest JSON:', textResponse.substring(0, 1000))

        // Sprawdź czy to błąd timeout lub limit rozmiaru
        if (textResponse.includes('FUNCTION_INVOCATION_TIMEOUT') || textResponse.includes('timed out')) {
          throw new Error(language === 'pl'
            ? 'Dokument jest zbyt długi - przekroczono limit czasu przetwarzania. Spróbuj z krótszym dokumentem lub podziel go na mniejsze części.'
            : 'Document is too long - processing timeout exceeded. Try with a shorter document or split it into smaller parts.')
        }

        throw new Error(`${language === 'pl' ? 'Błąd parsowania odpowiedzi' : 'Response parsing error'} (status ${response.status}). ${language === 'pl' ? 'Dokument może być zbyt długi.' : 'Document may be too long.'}`)
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

      // Dodaj sourceDocument do każdego terminu
      const termsWithSource = data.terms.map((term: Term) => ({
        ...term,
        sourceDocument: term.sourceDocument || loadedFileName
      }))

      projectStorage.addVersion(
        currentProject.id,
        currentGlossary.id,
        termsWithSource,
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
      console.log(`✅ Wyekstrahowano ${termsWithSource.length} terminów`)

      // Zapisz sugestię jeśli istnieje
      if (data.suggestion) {
        setExtractionSuggestion(data.suggestion)
        console.log(`💡 Sugestia: ${data.suggestion}`)
      } else {
        setExtractionSuggestion(null)
      }

      // Generuj definicje jeśli opcja została zaznaczona
      if (generateDefinitions && termsWithSource.length > 0) {
        setTimeout(() => {
          handleBulkGenerateDefinitions(termsWithSource)
        }, 500)
      } else {
        // Reset progress po 1 sekundzie
        setTimeout(() => setProgress(0), 1000)
      }

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

    // Sprawdź czy użytkownik zaakceptował nowe terminy
    const previousNewTermsCount = terms.filter(t => t.isNew).length
    const currentNewTermsCount = updatedTerms.filter(t => t.isNew).length
    const acceptedNewTerms = previousNewTermsCount > 0 && currentNewTermsCount === 0

    try {
      // Zapisz jako nową wersję (auto-save)
      const newVersion = projectStorage.addVersion(
        currentProject.id,
        currentGlossary.id,
        updatedTerms,
        'Auto-save (edycja)',
        undefined,
        false
      )

      if (!newVersion) {
        console.error('❌ Błąd zapisu wersji - addVersion zwróciło null')
        // Pokaż błąd użytkownikowi - prawdopodobnie localStorage jest pełny
        setInfoDialog({
          type: 'error',
          title: language === 'pl' ? 'Błąd zapisu' : 'Save Error',
          message: language === 'pl'
            ? 'Nie udało się zapisać zmian. Prawdopodobnie pamięć przeglądarki jest pełna.'
            : 'Failed to save changes. Browser storage is probably full.',
          details: language === 'pl'
            ? 'Spróbuj usunąć stare wersje glosariusza lub wyeksportować dane i utworzyć nowy projekt.'
            : 'Try deleting old glossary versions or export data and create a new project.'
        })
        return
      }

      // Odśwież projekt i glosariusz używając świeżych danych z storage
      const updatedProject = projectStorage.getById(currentProject.id)
      if (updatedProject) {
        setCurrentProject(updatedProject)

        // Odśwież glosariusz bezpośrednio z zaktualizowanego projektu
        const glossary = updatedProject.glossaries.find(g => g.id === currentGlossary.id)
        if (glossary) {
          setCurrentGlossary(glossary)
          const version = glossary.versions.find(v => v.id === glossary.currentVersionId)
          if (version) {
            setCurrentVersion(version)
          }
        }
      }
    } catch (error) {
      console.error('❌ Błąd podczas aktualizacji terminów:', error)
      // Wyświetl komunikat użytkownikowi
      setNotification({
        type: 'error',
        message: language === 'pl' ? 'Błąd zapisu' : 'Save error',
        details: language === 'pl'
          ? 'Nie udało się zapisać zmian. Spróbuj ponownie.'
          : 'Failed to save changes. Please try again.'
      })
      return
    }

    // Pokaż notification jeśli zaakceptowano nowe terminy
    if (acceptedNewTerms) {
      setNotification({
        type: 'success',
        message: language === 'pl' ? 'Zaakceptowano nowe terminy!' : 'New terms accepted!',
        details: language === 'pl'
          ? `Oznaczenie "NOWY" zostało usunięte z ${previousNewTermsCount} terminów`
          : `"NEW" marking removed from ${previousNewTermsCount} terms`
      })
    }
  }

  // Handler dla ręcznego dodawania terminów z dokumentu docelowego
  const handleAddManualTerm = (targetTerm: string) => {
    if (!currentProject || !currentGlossary || !currentGlossary.targetDocumentText) return

    const targetDoc = currentGlossary.targetDocumentText

    // Znajdź pozycje i kontekst w dokumencie docelowym
    const targetOccurrences = findTermOccurrences(targetDoc, targetTerm)

    // Sprawdź czy język docelowy wymaga lemmatyzacji (języki słowiańskie)
    const slavicLanguages = ['Polski', 'Czeski', 'Słowacki', 'Ukraiński', 'Rosyjski', 'Bułgarski', 'Chorwacki', 'Serbski', 'Słoweński', 'Polish', 'Czech', 'Slovak', 'Ukrainian', 'Russian', 'Bulgarian', 'Croatian', 'Serbian', 'Slovenian']
    const targetLanguage = currentGlossary.targetLanguage || ''
    const needsTargetLemmatization = slavicLanguages.some(lang =>
      targetLanguage.toLowerCase().includes(lang.toLowerCase())
    )

    // Sprawdź czy istnieje już termin bez targetTerm który możemy zaktualizować
    const existingTermIndex = terms.findIndex(t => !t.targetTerm)

    let updatedTerms: Term[]

    if (existingTermIndex !== -1) {
      // Aktualizuj istniejący termin bez targetTerm
      updatedTerms = terms.map((t, index) =>
        index === existingTermIndex
          ? {
              ...t,
              targetTerm: targetTerm,
              targetFoundForm: needsTargetLemmatization ? targetTerm : undefined,
              targetContext: targetOccurrences.context,
              targetOccurrences: targetOccurrences.occurrences,
              targetPositions: targetOccurrences.positions,
              targetSource: 'manual' as const
            }
          : t
      )
    } else {
      // Stwórz nowy termin z pustym source term
      const newTerm: Term = {
        id: `term-manual-${Date.now()}`,
        term: '', // Pusty source term - użytkownik może go później wypełnić
        context: '',
        occurrences: 0,
        positions: [],
        targetTerm: targetTerm,
        targetFoundForm: needsTargetLemmatization ? targetTerm : undefined,
        targetContext: targetOccurrences.context,
        targetOccurrences: targetOccurrences.occurrences,
        targetPositions: targetOccurrences.positions,
        targetSource: 'manual' as const
      }

      updatedTerms = [...terms, newTerm]
    }

    // Zapisz zaktualizowane terminy
    handleTermUpdate(updatedTerms)

    // Pokaż komunikat sukcesu
    console.log(`✅ Dodano termin ręcznie: "${targetTerm}"${needsTargetLemmatization ? ' [z targetFoundForm]' : ''}`)
  }

  // Handler dla importu terminów z plików JSON/XLSX
  const handleImportTerms = (importedTerms: Term[], source: string) => {
    if (!currentProject || !currentGlossary) {
      alert(language === 'pl'
        ? 'Brak projektu. Utwórz projekt przed importem.'
        : 'No project. Create a project before importing.')
      return
    }

    // Merge logic - zachowanie kontekstów z różnych dokumentów
    // Używamy normalizacji do łączenia terminów w liczbie pojedynczej/mnogiej
    const termsMap = new Map<string, Term>()
    const normalizedKeyMap = new Map<string, string>() // normalizedKey -> originalTermKey

    // Funkcja do znajdowania istniejącego terminu (z normalizacją)
    const findExistingTerm = (termName: string): Term | null => {
      // Sprawdź dokładne dopasowanie
      if (termsMap.has(termName)) {
        return termsMap.get(termName)!
      }
      // Sprawdź po normalizacji
      const normalizedKey = normalizeTermForComparison(termName)
      if (normalizedKeyMap.has(normalizedKey)) {
        const existingKey = normalizedKeyMap.get(normalizedKey)!
        return termsMap.get(existingKey) || null
      }
      return null
    }

    // Dodaj istniejące terminy
    terms.forEach(term => {
      const normalizedKey = normalizeTermForComparison(term.term)

      if (!termsMap.has(term.term)) {
        // Jeśli termin ma contexts[], użyj ich
        if (term.contexts && term.contexts.length > 0) {
          termsMap.set(term.term, { ...term })
        } else {
          // Konwertuj stary format (single context) do nowego (contexts[])
          const docName = normalizeSourceDocumentName(term.sourceDocument || fileName || 'Unknown')
          const termContext: TermContext = {
            documentId: term.sourceDocument || 'unknown',
            documentName: docName,
            context: term.context,
            positions: term.positions,
            occurrences: term.occurrences
          }
          termsMap.set(term.term, {
            ...term,
            contexts: [termContext]
          })
        }
        normalizedKeyMap.set(normalizedKey, term.term)
      }
    })

    let addedCount = 0
    let mergedCount = 0
    let variantsMergedCount = 0

    importedTerms.forEach(importedTerm => {
      // Użyj normalizacji do znalezienia istniejącego terminu
      const existingTerm = findExistingTerm(importedTerm.term)

      if (existingTerm) {
        // Sprawdź czy to wariant (singular/plural)
        const isVariant = existingTerm.term.toLowerCase() !== importedTerm.term.toLowerCase()
        if (isVariant) {
          // Dodaj do listy wariantów
          if (!existingTerm.variants) {
            existingTerm.variants = [existingTerm.term]
          }
          if (!existingTerm.variants.includes(importedTerm.term)) {
            existingTerm.variants.push(importedTerm.term)
          }

          // Preferuj formę pojedynczą jako główny termin
          const preferredForm = getPreferredTermForm(existingTerm.term, importedTerm.term)
          if (preferredForm !== existingTerm.term) {
            const oldTerm = existingTerm.term
            // Zamień główny termin na formę pojedynczą
            existingTerm.term = preferredForm
            console.log(`🔄 Połączono wariant: "${importedTerm.term}" z "${oldTerm}" → główny termin: "${preferredForm}" (singular)`)
          } else {
            console.log(`🔄 Połączono wariant: "${importedTerm.term}" z "${existingTerm.term}"`)
          }
          variantsMergedCount++
        }

        // Termin już istnieje - dodaj nowe konteksty
        if (importedTerm.contexts && importedTerm.contexts.length > 0) {
          // Importowany termin ma już tablicę contexts - dodaj wszystkie
          if (!existingTerm.contexts) {
            existingTerm.contexts = []
          }
          importedTerm.contexts.forEach(ctx => {
            // Sprawdź czy kontekst z tego dokumentu już istnieje
            const exists = existingTerm.contexts!.some(
              ec => ec.documentName === ctx.documentName
            )
            if (!exists) {
              existingTerm.contexts!.push(ctx)
              mergedCount++
            }
          })
        } else {
          // Stary format - pojedynczy kontekst
          const importDocName = normalizeSourceDocumentName(importedTerm.sourceDocument || source)
          const newContext: TermContext = {
            documentId: importedTerm.sourceDocument || 'unknown',
            documentName: importDocName,
            context: importedTerm.context,
            positions: importedTerm.positions,
            occurrences: importedTerm.occurrences
          }

          if (!existingTerm.contexts) {
            existingTerm.contexts = []
          }
          // Sprawdź czy kontekst z tego dokumentu już istnieje
          const exists = existingTerm.contexts.some(
            ec => ec.documentName === newContext.documentName
          )
          if (!exists) {
            existingTerm.contexts.push(newContext)
            mergedCount++
          }
        }

        // Zsumuj wystąpienia
        existingTerm.occurrences = (existingTerm.occurrences || 0) + (importedTerm.occurrences || 0)
      } else {
        // Nowy termin
        const normalizedKey = normalizeTermForComparison(importedTerm.term)

        if (importedTerm.contexts && importedTerm.contexts.length > 0) {
          // Termin ma już tablicę contexts - zachowaj ją
          termsMap.set(importedTerm.term, {
            ...importedTerm,
            contexts: [...importedTerm.contexts]
          })
        } else {
          // Stary format - utwórz contexts[] z pojedynczego kontekstu
          const newDocName = normalizeSourceDocumentName(importedTerm.sourceDocument || source)
          const termContext: TermContext = {
            documentId: importedTerm.sourceDocument || 'unknown',
            documentName: newDocName,
            context: importedTerm.context,
            positions: importedTerm.positions,
            occurrences: importedTerm.occurrences
          }

          termsMap.set(importedTerm.term, {
            ...importedTerm,
            contexts: [termContext]
          })
        }
        normalizedKeyMap.set(normalizedKey, importedTerm.term)
        addedCount++
      }
    })

    if (variantsMergedCount > 0) {
      console.log(`🔄 Połączono ${variantsMergedCount} wariantów terminów (singular/plural)`)
    }

    // Konwertuj mapę z powrotem na tablicę
    const mergedTerms = Array.from(termsMap.values())

    // Zapisz jako nową wersję
    const variantInfo = variantsMergedCount > 0
      ? (language === 'pl' ? `, ${variantsMergedCount} wariantów połączonych` : `, ${variantsMergedCount} variants merged`)
      : ''
    const description = language === 'pl'
      ? `Import z ${source}: +${addedCount} nowych terminów, ${mergedCount} kontekstów dodanych${variantInfo}`
      : `Import from ${source}: +${addedCount} new terms, ${mergedCount} contexts added${variantInfo}`

    projectStorage.addVersion(
      currentProject.id,
      currentGlossary.id,
      mergedTerms,
      description,
      currentVersion?.extractionParams,
      false
    )

    // Odśwież projekt
    const updatedProject = projectStorage.getById(currentProject.id)
    if (updatedProject) {
      setCurrentProject(updatedProject)
    }
    refreshGlossary()

    // Pokaż stylizowany dialog informacyjny
    const variantMessage = variantsMergedCount > 0
      ? (language === 'pl'
        ? `\nPołączono warianty: ${variantsMergedCount} (singular/plural)`
        : `\nMerged variants: ${variantsMergedCount} (singular/plural)`)
      : ''

    setInfoDialog({
      type: 'success',
      title: language === 'pl' ? 'Import zakończony!' : 'Import completed!',
      message: language === 'pl'
        ? `Dodano: ${addedCount} nowych terminów\nPołączono: ${mergedCount} kontekstów z różnych dokumentów${variantMessage}`
        : `Added: ${addedCount} new terms\nMerged: ${mergedCount} contexts from different documents${variantMessage}`,
      details: language === 'pl'
        ? `Łącznie terminów: ${mergedTerms.length}`
        : `Total terms: ${mergedTerms.length}`
    })

    console.log(`✅ ${description}`)
  }

  // Lokalne zapisanie glosariusza jako JSON
  const handleLocalSaveGlossary = () => {
    if (terms.length === 0) {
      alert(language === 'pl'
        ? 'Brak terminów do zapisania.'
        : 'No terms to save.')
      return
    }

    const jsonContent = JSON.stringify(terms, null, 2)
    const blob = new Blob([jsonContent], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${fileName || 'glosariusz'}_lokalny.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    console.log(`✅ Zapisano glosariusz lokalnie: ${terms.length} terminów`)
  }

  // Łączenie wielu glosariuszy (do 3 plików JSON lub XLSX)
  const handleMergeMultipleGlossaries = () => {
    if (!currentProject || !currentGlossary) {
      alert(language === 'pl'
        ? 'Brak projektu. Utwórz projekt przed łączeniem glosariuszy.'
        : 'No project. Create a project before merging glossaries.')
      return
    }

    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.xlsx,.xls'
    input.multiple = true
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || [])

      if (files.length === 0) return
      if (files.length > 3) {
        alert(language === 'pl'
          ? 'Możesz połączyć maksymalnie 3 glosariusze naraz.'
          : 'You can merge maximum 3 glossaries at once.')
        return
      }

      try {
        const allImportedTerms: Term[] = []

        for (const file of files) {
          const ext = file.name.toLowerCase()

          if (ext.endsWith('.json')) {
            const text = await file.text()
            const data = JSON.parse(text)

            if (Array.isArray(data)) {
              const parsedTerms: Term[] = data.filter((item: any) =>
                item && typeof item === 'object' && typeof item.term === 'string'
              ).map((item: any) => ({
                id: item.id || `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                term: item.term,
                context: item.context || '',
                occurrences: item.occurrences || 0,
                positions: Array.isArray(item.positions) ? item.positions : [],
                definition: item.definition || '',
                definitionSource: item.definitionSource || null,
                sourceDocument: item.sourceDocument || file.name
              }))

              allImportedTerms.push(...parsedTerms)
            }
          } else if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
            const XLSX = await import('xlsx-js-style')
            const data = await file.arrayBuffer()
            const workbook = XLSX.read(data, { type: 'array' })
            const firstSheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[firstSheetName]
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

            if (jsonData.length >= 2) {
              let headerRowIndex = -1
              let nrColIndex = -1
              let termColIndex = -1
              let occurrencesColIndex = -1
              let documentColIndex = -1
              let definitionColIndex = -1
              let sourceColIndex = -1
              let contextColIndex = -1

              // Debug: wyświetl pierwsze kilka wierszy
              console.log('🔍 XLSX Import Debug - Pierwsze 3 wiersze:')
              jsonData.slice(0, 3).forEach((row, idx) => {
                console.log(`  Wiersz ${idx}:`, row)
              })

              for (let i = 0; i < Math.min(jsonData.length, 15); i++) {
                const row = jsonData[i]

                // Potem szukaj kolumny Termin - musi być na początku lub jako całe słowo
                termColIndex = row.findIndex((cell: any) => {
                  if (typeof cell !== 'string') return false
                  const cellLower = cell.toLowerCase().trim()
                  // Dokładne dopasowanie lub na początku
                  return cellLower === 'termin' ||
                         cellLower === 'term' ||
                         cellLower.startsWith('termin ') ||
                         cellLower.startsWith('term ')
                })

                if (termColIndex !== -1) {
                  headerRowIndex = i

                  // Najpierw szukaj kolumny Nr (musi być PRZED kolumną Termin)
                  nrColIndex = row.findIndex((cell: any, idx: number) => {
                    if (idx >= termColIndex) return false // Nr musi być przed Terminem
                    if (typeof cell !== 'string') return false
                    const cellLower = cell.toLowerCase().trim()
                    return cellLower === 'nr' || cellLower === 'no.' || cellLower === 'no' || cellLower === 'nr.'
                  })

                  occurrencesColIndex = row.findIndex((cell: any) =>
                    typeof cell === 'string' && (cell.toLowerCase().includes('wystąpień') || cell.toLowerCase().includes('occurrence'))
                  )
                  documentColIndex = row.findIndex((cell: any) =>
                    typeof cell === 'string' && cell.toLowerCase().includes('dokument')
                  )
                  definitionColIndex = row.findIndex((cell: any) =>
                    typeof cell === 'string' && (cell.toLowerCase().includes('definicja') || cell.toLowerCase().includes('definition'))
                  )
                  sourceColIndex = row.findIndex((cell: any) =>
                    typeof cell === 'string' && cell.toLowerCase().includes('źródło')
                  )
                  contextColIndex = row.findIndex((cell: any) =>
                    typeof cell === 'string' && (cell.toLowerCase().includes('kontekst') || cell.toLowerCase().includes('context'))
                  )

                  console.log('✅ XLSX Import - Wykryte kolumny:')
                  console.log(`  headerRowIndex: ${headerRowIndex}`)
                  console.log(`  nrColIndex: ${nrColIndex}`)
                  console.log(`  termColIndex: ${termColIndex}`)
                  console.log(`  occurrencesColIndex: ${occurrencesColIndex}`)
                  console.log(`  documentColIndex: ${documentColIndex}`)
                  console.log(`  definitionColIndex: ${definitionColIndex}`)
                  console.log(`  contextColIndex: ${contextColIndex}`)
                  console.log(`  Nagłówek:`, row)

                  break
                }
              }

              if (headerRowIndex !== -1 && termColIndex !== -1) {
                let lastTerm: Term | null = null

                console.log(`📊 Parsowanie ${jsonData.length - headerRowIndex - 1} wierszy danych...`)

                for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
                  const row = jsonData[i]
                  const termValue = row[termColIndex]

                  // Debug pierwszych 3 wierszy danych
                  if (i <= headerRowIndex + 3) {
                    console.log(`  Wiersz ${i} (data ${i - headerRowIndex}):`, {
                      termValue,
                      occurrences: occurrencesColIndex !== -1 ? row[occurrencesColIndex] : 'brak',
                      document: documentColIndex !== -1 ? row[documentColIndex] : 'brak',
                      fullRow: row
                    })
                  }

                  // Jeśli komórka terminu jest pusta lub zawiera tylko whitespace, to jest to kolejny kontekst dla poprzedniego terminu
                  const isEmptyTermCell = !termValue || (typeof termValue === 'string' && termValue.trim() === '')

                  if (isEmptyTermCell && lastTerm) {
                    // To jest kolejny kontekst dla poprzedniego terminu (format multi-context)
                    const newContext: TermContext = {
                      documentId: documentColIndex !== -1 ? (row[documentColIndex] || file.name) : file.name,
                      documentName: documentColIndex !== -1 ? (row[documentColIndex] || file.name) : file.name,
                      context: contextColIndex !== -1 ? (row[contextColIndex] || '') : '',
                      positions: [],
                      occurrences: occurrencesColIndex !== -1 ? parseInt(row[occurrencesColIndex]) || 0 : 0
                    }

                    if (!lastTerm.contexts) {
                      lastTerm.contexts = []
                    }
                    lastTerm.contexts.push(newContext)
                  } else if (termValue && typeof termValue === 'string' && termValue.trim() !== '') {
                    // Nowy termin
                    const term: Term = {
                      id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                      term: termValue.trim(),
                      context: contextColIndex !== -1 ? (row[contextColIndex] || '') : '',
                      occurrences: occurrencesColIndex !== -1 ? parseInt(row[occurrencesColIndex]) || 0 : 0,
                      positions: [],
                      definition: definitionColIndex !== -1 ? (row[definitionColIndex] || '') : '',
                      definitionSource: null,
                      sourceDocument: documentColIndex !== -1 ? (row[documentColIndex] || file.name) : file.name
                    }

                    if (sourceColIndex !== -1 && row[sourceColIndex]) {
                      const source = row[sourceColIndex].toString().toLowerCase()
                      if (source.includes('dokument') || source.includes('document')) {
                        term.definitionSource = 'document'
                      } else if (source.includes('ai')) {
                        term.definitionSource = 'ai'
                      } else if (source.includes('edytowano') || source.includes('edited')) {
                        term.definitionSource = 'edited'
                      }
                    }

                    // Jeśli to termin z wieloma kontekstami, stwórz pierwszy kontekst
                    term.contexts = [{
                      documentId: term.sourceDocument || file.name,
                      documentName: term.sourceDocument || file.name,
                      context: term.context,
                      positions: term.positions,
                      occurrences: term.occurrences
                    }]

                    allImportedTerms.push(term)
                    lastTerm = term
                  }
                }

                console.log(`✅ Zaimportowano ${allImportedTerms.length} terminów z pliku XLSX`)
              } else {
                console.error('❌ Nie znaleziono nagłówka z kolumną "Termin"')
              }
            }
          }
        }

        // Merge z zachowaniem kontekstów z różnych dokumentów
        const termsMap = new Map<string, Term>()

        // Dodaj istniejące terminy
        terms.forEach(term => {
          if (!termsMap.has(term.term)) {
            // Jeśli termin ma contexts[], użyj ich
            if (term.contexts && term.contexts.length > 0) {
              termsMap.set(term.term, { ...term })
            } else {
              // Konwertuj stary format (single context) do nowego (contexts[])
              const termContext: TermContext = {
                documentId: term.sourceDocument || 'unknown',
                documentName: term.sourceDocument || fileName || 'Unknown',
                context: term.context,
                positions: term.positions,
                occurrences: term.occurrences
              }
              termsMap.set(term.term, {
                ...term,
                contexts: [termContext]
              })
            }
          }
        })

        let addedCount = 0
        let mergedCount = 0

        allImportedTerms.forEach(importedTerm => {
          const existingTerm = termsMap.get(importedTerm.term)

          if (existingTerm) {
            // Termin już istnieje - dodaj nowy kontekst
            const newContext: TermContext = {
              documentId: importedTerm.sourceDocument || 'unknown',
              documentName: importedTerm.sourceDocument || 'Unknown',
              context: importedTerm.context,
              positions: importedTerm.positions,
              occurrences: importedTerm.occurrences
            }

            if (!existingTerm.contexts) {
              existingTerm.contexts = []
            }
            existingTerm.contexts.push(newContext)
            mergedCount++
          } else {
            // Nowy termin - utwórz z contexts[]
            const termContext: TermContext = {
              documentId: importedTerm.sourceDocument || 'unknown',
              documentName: importedTerm.sourceDocument || 'Unknown',
              context: importedTerm.context,
              positions: importedTerm.positions,
              occurrences: importedTerm.occurrences
            }

            termsMap.set(importedTerm.term, {
              ...importedTerm,
              contexts: [termContext]
            })
            addedCount++
          }
        })

        const mergedTerms = Array.from(termsMap.values())

        // Zapisz jako nową wersję
        const description = language === 'pl'
          ? `Połączono ${files.length} glosariuszy: +${addedCount} nowych terminów, ${mergedCount} kontekstów dodanych`
          : `Merged ${files.length} glossaries: +${addedCount} new terms, ${mergedCount} contexts added`

        projectStorage.addVersion(
          currentProject.id,
          currentGlossary.id,
          mergedTerms,
          description,
          currentVersion?.extractionParams,
          false
        )

        const updatedProject = projectStorage.getById(currentProject.id)
        if (updatedProject) {
          setCurrentProject(updatedProject)
        }
        refreshGlossary()

        alert(language === 'pl'
          ? `Połączono ${files.length} glosariuszy!\n\nDodano: ${addedCount} nowych terminów\nPołączono: ${mergedCount} kontekstów z różnych dokumentów\n\nŁącznie terminów: ${mergedTerms.length}`
          : `Merged ${files.length} glossaries!\n\nAdded: ${addedCount} new terms\nMerged: ${mergedCount} contexts from different documents\n\nTotal terms: ${mergedTerms.length}`)

        console.log(`✅ ${description}`)
      } catch (error) {
        console.error('Błąd łączenia glosariuszy:', error)
        alert(language === 'pl'
          ? 'Błąd podczas łączenia glosariuszy. Sprawdź czy pliki są poprawne.'
          : 'Error merging glossaries. Check if the files are valid.')
      }
    }
    input.click()
  }

  // Łączenie glosariuszy z tego samego projektu
  const handleMergeProjectGlossaries = () => {
    if (!currentProject || !currentGlossary) {
      alert(language === 'pl'
        ? 'Brak projektu. Utwórz projekt przed łączeniem glosariuszy.'
        : 'No project. Create a project before merging glossaries.')
      return
    }

    // Sprawdź czy są inne glosariusze w projekcie
    const otherGlossaries = currentProject.glossaries.filter(g => g.id !== currentGlossary.id)
    if (otherGlossaries.length === 0) {
      alert(language === 'pl'
        ? 'Brak innych glosariuszy w projekcie do połączenia.'
        : 'No other glossaries in the project to merge.')
      return
    }

    // Pokaż dialog wyboru glosariuszy
    setShowMergeProjectDialog(true)
  }

  // Wykonaj łączenie wybranych glosariuszy z projektu
  const handleExecuteMergeProjectGlossaries = () => {
    if (!currentProject || !currentGlossary || selectedGlossariesForMerge.length === 0) {
      alert(language === 'pl'
        ? 'Wybierz co najmniej jeden glosariusz do połączenia.'
        : 'Select at least one glossary to merge.')
      return
    }

    try {
      // Zbierz terminy z wybranych glosariuszy
      const allImportedTerms: Term[] = []

      selectedGlossariesForMerge.forEach(glossaryId => {
        const glossary = currentProject.glossaries.find(g => g.id === glossaryId)
        if (!glossary) return

        // Pobierz terminy z aktualnej wersji tego glosariusza
        const version = glossary.versions.find(v => v.id === glossary.currentVersionId)
        if (!version) return

        // Dodaj terminy z tego glosariusza
        version.terms.forEach(term => {
          allImportedTerms.push({
            ...term,
            sourceDocument: term.sourceDocument || glossary.name
          })
        })
      })

      // Merge z zachowaniem kontekstów z różnych dokumentów
      const termsMap = new Map<string, Term>()

      // Dodaj istniejące terminy
      terms.forEach(term => {
        if (!termsMap.has(term.term)) {
          // Jeśli termin ma contexts[], użyj ich
          if (term.contexts && term.contexts.length > 0) {
            termsMap.set(term.term, { ...term })
          } else {
            // Konwertuj stary format (single context) do nowego (contexts[])
            const termContext: TermContext = {
              documentId: term.sourceDocument || 'unknown',
              documentName: term.sourceDocument || fileName || 'Unknown',
              context: term.context,
              positions: term.positions,
              occurrences: term.occurrences
            }
            termsMap.set(term.term, {
              ...term,
              contexts: [termContext]
            })
          }
        }
      })

      let addedCount = 0
      let mergedCount = 0

      allImportedTerms.forEach(importedTerm => {
        const existingTerm = termsMap.get(importedTerm.term)

        if (existingTerm) {
          // Termin już istnieje - dodaj nowy kontekst
          const newContext: TermContext = {
            documentId: importedTerm.sourceDocument || 'unknown',
            documentName: importedTerm.sourceDocument || 'Unknown',
            context: importedTerm.context,
            positions: importedTerm.positions,
            occurrences: importedTerm.occurrences
          }

          if (!existingTerm.contexts) {
            existingTerm.contexts = []
          }
          existingTerm.contexts.push(newContext)
          mergedCount++
        } else {
          // Nowy termin
          const termContext: TermContext = {
            documentId: importedTerm.sourceDocument || 'unknown',
            documentName: importedTerm.sourceDocument || 'Unknown',
            context: importedTerm.context,
            positions: importedTerm.positions,
            occurrences: importedTerm.occurrences
          }
          termsMap.set(importedTerm.term, {
            ...importedTerm,
            contexts: [termContext]
          })
          addedCount++
        }
      })

      const mergedTerms = Array.from(termsMap.values())

      // Zapisz jako nową wersję
      const glossaryNames = selectedGlossariesForMerge.map(id => {
        const g = currentProject.glossaries.find(gl => gl.id === id)
        return g?.name || id
      }).join(', ')

      const description = language === 'pl'
        ? `Połączono glosariusze z projektu (${glossaryNames}): +${addedCount} nowych terminów, ${mergedCount} kontekstów dodanych`
        : `Merged project glossaries (${glossaryNames}): +${addedCount} new terms, ${mergedCount} contexts added`

      projectStorage.addVersion(
        currentProject.id,
        currentGlossary.id,
        mergedTerms,
        description,
        currentVersion?.extractionParams,
        false
      )

      const updatedProject = projectStorage.getById(currentProject.id)
      if (updatedProject) {
        setCurrentProject(updatedProject)
      }
      refreshGlossary()

      // Zamknij dialog i wyczyść wybór
      setShowMergeProjectDialog(false)
      setSelectedGlossariesForMerge([])

      // Pokaż stylizowane powiadomienie sukcesu
      setNotification({
        type: 'success',
        message: language === 'pl' ? 'Połączono glosariusze z projektu!' : 'Merged project glossaries!',
        details: language === 'pl'
          ? `Dodano: ${addedCount} nowych terminów\nPołączono: ${mergedCount} kontekstów z różnych dokumentów\nŁącznie terminów: ${mergedTerms.length}`
          : `Added: ${addedCount} new terms\nMerged: ${mergedCount} contexts from different documents\nTotal terms: ${mergedTerms.length}`
      })

      console.log(`✅ ${description}`)
    } catch (error) {
      console.error('Błąd łączenia glosariuszy:', error)
      setNotification({
        type: 'error',
        message: language === 'pl' ? 'Błąd łączenia glosariuszy' : 'Error merging glossaries',
        details: language === 'pl'
          ? 'Wystąpił błąd podczas łączenia glosariuszy z projektu.'
          : 'An error occurred while merging project glossaries.'
      })
    }
  }

  // Aktualizacja nazwy dokumentu źródłowego dla wszystkich terminów z tym dokumentem
  const handleDocumentNameUpdate = (oldDocumentName: string, newDocumentName: string) => {
    if (!currentProject || !currentGlossary || !newDocumentName.trim()) return

    const updatedTerms = terms.map(term => {
      // Aktualizuj nazwę dokumentu w contexts
      if (term.contexts && term.contexts.length > 0) {
        const updatedContexts = term.contexts.map(ctx => {
          if (ctx.documentName === oldDocumentName) {
            return {
              ...ctx,
              documentName: newDocumentName
            }
          }
          return ctx
        })

        return {
          ...term,
          contexts: updatedContexts,
          // Aktualizuj też sourceDocument jeśli pasuje
          sourceDocument: term.sourceDocument === oldDocumentName ? newDocumentName : term.sourceDocument
        }
      } else {
        // Stary format - aktualizuj sourceDocument
        if (term.sourceDocument === oldDocumentName) {
          return {
            ...term,
            sourceDocument: newDocumentName
          }
        }
      }

      return term
    })

    // Zapisz jako nową wersję
    projectStorage.addVersion(
      currentProject.id,
      currentGlossary.id,
      updatedTerms,
      language === 'pl'
        ? `Zmieniono nazwę dokumentu: "${oldDocumentName}" → "${newDocumentName}"`
        : `Document name changed: "${oldDocumentName}" → "${newDocumentName}"`,
      undefined,
      false
    )

    // Odśwież projekt i glosariusz
    const updatedProject = projectStorage.getById(currentProject.id)
    if (updatedProject) {
      setCurrentProject(updatedProject)
    }
    refreshGlossary()

    console.log(`✅ Zmieniono nazwę dokumentu: "${oldDocumentName}" → "${newDocumentName}"`)
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

    // Sprawdź czy termin już istnieje w glosariuszu (porównuj zarówno term jak i foundForm)
    const existingTerm = terms.find(t =>
      t.term.toLowerCase() === trimmedTerm.toLowerCase() ||
      (t.foundForm && t.foundForm.toLowerCase() === trimmedTerm.toLowerCase())
    )
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

    // Sprawdź czy język wymaga lemmatyzacji (języki słowiańskie)
    const slavicLanguages = ['Polski', 'Czeski', 'Słowacki', 'Ukraiński', 'Rosyjski', 'Bułgarski', 'Chorwacki', 'Serbski', 'Słoweński', 'Polish', 'Czech', 'Slovak', 'Ukrainian', 'Russian', 'Bulgarian', 'Croatian', 'Serbian', 'Slovenian']
    const needsLemmatization = slavicLanguages.some(lang =>
      detectedLanguage.toLowerCase().includes(lang.toLowerCase())
    )

    // Dla języków słowiańskich - otwórz modal do podania formy podstawowej
    if (needsLemmatization) {
      setBaseFormModal({
        isOpen: true,
        foundForm: trimmedTerm,
        pendingTermData: { positions, context, occurrences }
      })
      return
    }

    // Dla innych języków - dodaj termin bezpośrednio
    addTermToGlossary(trimmedTerm, undefined, positions, context, occurrences)
  }

  // Funkcja pomocnicza do dodawania terminu
  const addTermToGlossary = (
    baseTerm: string,
    foundForm: string | undefined,
    positions: number[],
    context: string,
    occurrences: number
  ) => {
    const newTerm: Term = {
      id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      term: baseTerm,
      foundForm: foundForm,
      context,
      occurrences,
      positions,
      definition: '',
      definitionSource: null
    }

    const updatedTerms = [...terms, newTerm]
    handleTermUpdate(updatedTerms)

    console.log(`✅ Dodano ręcznie termin: "${baseTerm}"${foundForm ? ` (foundForm: "${foundForm}")` : ''} (${occurrences} wystąpień)`)
    toast.success(
      language === 'pl' ? 'Termin dodany' : 'Term added',
      language === 'pl'
        ? `„${baseTerm}"${foundForm && foundForm !== baseTerm ? `\n(forma w dokumencie: „${foundForm}")` : ''}\n\nZnaleziono ${occurrences} wystąpień.`
        : `"${baseTerm}"${foundForm && foundForm !== baseTerm ? `\n(form in document: "${foundForm}")` : ''}\n\nFound ${occurrences} occurrences.`,
      5000
    )
  }

  // Handler dla potwierdzenia formy podstawowej z modala
  const handleBaseFormConfirm = (baseTerm: string) => {
    if (baseFormModal.pendingTermData) {
      const { positions, context, occurrences } = baseFormModal.pendingTermData
      addTermToGlossary(baseTerm, baseFormModal.foundForm, positions, context, occurrences)
    }
    setBaseFormModal({ isOpen: false, foundForm: '', pendingTermData: null })
  }

  // Handler dla anulowania modala
  const handleBaseFormCancel = () => {
    setBaseFormModal({ isOpen: false, foundForm: '', pendingTermData: null })
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
    const promptText = language === 'pl' ? 'Nazwa projektu:' : 'Project name:'
    const defaultName = fileName || (language === 'pl' ? 'Nowy glosariusz' : 'New glossary')
    const name = prompt(promptText, defaultName)
    if (!name) return

    const project = projectStorage.save({
      name,
      fileName,
      documentText,
      detectedLanguage
    }, language)

    setCurrentProject(project)
    setProjectName(name)
    refreshGlossary()
    alert(language === 'pl' ? 'Projekt został zapisany!' : 'Project saved!')
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
            targetFoundForm: result.targetFoundForm || result.targetTerm,  // Forma fleksyjna do zaznaczania
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
          targetFoundForm: undefined,
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
            <div className="mb-6 space-y-3 max-w-md">
              <button
                onClick={() => {
                  // Generuj domyślną nazwę z numerem porządkowym
                  const today = new Date().toLocaleDateString(language === 'pl' ? 'pl-PL' : 'en-GB')
                  const baseNamePrefix = language === 'pl' ? `Glosariusz ${today}` : `Glossary ${today}`

                  // Znajdź wszystkie projekty z dzisiejszą datą
                  const todayProjects = allProjects.filter(p =>
                    p.name.startsWith(baseNamePrefix)
                  )

                  // Oblicz numer porządkowy (ilość projektów z dzisiejszą datą + 1)
                  const nextNumber = todayProjects.length + 1
                  const defaultName = `${baseNamePrefix}_${nextNumber}`

                  // Pokaż modal do wprowadzenia nazwy
                  setProjectType('single')
                  setDefaultProjectName(defaultName)
                  setProjectNameInput(defaultName)
                  setShowProjectNameModal(true)
                }}
                className="w-full px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-lg"
              >
                {language === 'pl' ? '+ Nowy projekt (1 dokument)' : '+ New Project (Single Document)'}
              </button>

              <button
                onClick={() => {
                  // Generuj domyślną nazwę z numerem porządkowym
                  const today = new Date().toLocaleDateString(language === 'pl' ? 'pl-PL' : 'en-GB')
                  const baseNamePrefix = language === 'pl' ? `Glosariusz wielodokumentowy ${today}` : `Multi-doc Glossary ${today}`

                  // Znajdź wszystkie projekty z dzisiejszą datą
                  const todayProjects = allProjects.filter(p =>
                    p.name.startsWith(baseNamePrefix)
                  )

                  // Oblicz numer porządkowy
                  const nextNumber = todayProjects.length + 1
                  const defaultName = `${baseNamePrefix}_${nextNumber}`

                  // Pokaż modal do wprowadzenia nazwy
                  setProjectType('multi')
                  setDefaultProjectName(defaultName)
                  setProjectNameInput(defaultName)
                  setShowProjectNameModal(true)
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
                              {language === 'pl' ? 'Zmieniono:' : 'Modified:'} {new Date(project.updatedAt).toLocaleString(language === 'pl' ? 'pl-PL' : 'en-GB')}
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
              <p className="text-left text-gray-500 mt-8">
                {language === 'pl'
                  ? 'Brak zapisanych projektów. Utwórz pierwszy projekt, aby rozpocząć!'
                  : 'No saved projects. Create your first project to get started!'}
              </p>
            )}
          </div>
        </div>

        {/* Project Name Modal */}
        {showProjectNameModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg shadow-2xl border-2 border-blue-400 p-8 max-w-md w-full">
              <div className="flex items-start gap-4 mb-6">
                <span className="text-4xl flex-shrink-0">
                  {projectType === 'single' ? '📝' : '📚'}
                </span>
                <div className="flex-1">
                  <h3 className="font-bold text-xl text-blue-900 mb-2">
                    {projectType === 'single'
                      ? (language === 'pl' ? 'Nazwa nowego projektu (pojedynczy dokument):' : 'New project name (single document):')
                      : (language === 'pl' ? 'Nazwa nowego projektu wielodokumentowego:' : 'New multi-document project name:')}
                  </h3>
                  <input
                    type="text"
                    value={projectNameInput}
                    onChange={(e) => setProjectNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateProject()
                      if (e.key === 'Escape') {
                        setShowProjectNameModal(false)
                        setProjectNameInput('')
                      }
                    }}
                    className="w-full px-4 py-3 rounded-lg border-2 border-blue-300 focus:border-blue-500 focus:outline-none text-gray-800 bg-white"
                    placeholder={defaultProjectName}
                    autoFocus
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowProjectNameModal(false)
                    setProjectNameInput('')
                  }}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
                >
                  {language === 'pl' ? 'Anuluj' : 'Cancel'}
                </button>
                <button
                  onClick={handleCreateProject}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                >
                  {language === 'pl' ? 'Utwórz' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
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
            <FileUpload
              onExtract={handleFileLoaded}
              isLoading={isLoading}
              savedApiKey={apiKey}
              clearTrigger={clearTrigger}
            />

            {/* Akcje i Eksport pod FileUpload - zawsze widoczne */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg shadow-lg p-4">
                  <h3 className="text-lg font-semibold mb-3 text-gray-800">
                    {language === 'pl' ? 'Akcje' : 'Actions'}
                  </h3>

                  <select
                    onChange={(e) => {
                      const value = e.target.value
                      if (value === 'snapshot') {
                        // Trigger snapshot creation
                        const snapshotBtn = document.querySelector('[data-snapshot-button]') as HTMLButtonElement
                        if (snapshotBtn) snapshotBtn.click()
                      } else if (value === 'add-term') {
                        promptManualAddTerm()
                      } else if (value === 'save-project') {
                        handleSaveProject()
                      } else if (value === 'local-save') {
                        handleLocalSaveGlossary()
                      } else if (value === 'merge-glossaries') {
                        handleMergeMultipleGlossaries()
                      } else if (value === 'merge-project-glossaries') {
                        handleMergeProjectGlossaries()
                      } else if (value === 'expand-auto') {
                        handleExpandGlossary()
                      } else if (value === 'create-bilingual') {
                        handleCreateBilingualGlossary()
                      } else if (value === 'approve-base') {
                        const confirmMsg = language === 'pl'
                          ? 'Zatwierdzić glosariusz bazowy i przejść do wyszukiwania ekwiwalentów?'
                          : 'Approve base glossary and proceed to finding equivalents?'
                        if (confirm(confirmMsg)) {
                          setBilingualStage(2)
                          console.log('✅ Glosariusz bazowy zatwierdzony, przejście do Stage 2')
                        }
                      } else if (value === 'find-equivalents') {
                        handleFindAllEquivalents()
                      } else if (value === 'back-stage1') {
                        const confirmMsg = language === 'pl'
                          ? 'Wrócić do edycji glosariusza bazowego?'
                          : 'Return to editing base glossary?'
                        if (confirm(confirmMsg)) {
                          setBilingualStage(1)
                        }
                      }
                      // Reset select
                      e.target.value = ''
                    }}
                    className="w-full px-4 py-2.5 bg-white border-2 border-purple-500 text-gray-700 rounded-lg hover:border-purple-600 focus:border-purple-600 focus:ring-2 focus:ring-purple-200 transition-all font-medium text-sm cursor-pointer"
                  >
                    <option value="">{language === 'pl' ? 'Wybierz akcję...' : 'Select action...'}</option>

                    {currentProject && currentGlossary && (
                      <option value="snapshot">📸 {language === 'pl' ? 'Utwórz snapshot' : 'Create snapshot'}</option>
                    )}

                    {documentText && (
                      <option value="add-term">➕ {language === 'pl' ? 'Dodaj termin ręcznie' : 'Add term manually'}</option>
                    )}

                    <option value="save-project" disabled={terms.length === 0}>
                      💾 {currentProject ? (language === 'pl' ? 'Zapisz zmiany' : 'Save changes') : (language === 'pl' ? 'Zapisz jako projekt' : 'Save as project')}
                    </option>

                    <option value="local-save" disabled={terms.length === 0}>
                      💾 {language === 'pl' ? 'Zapisz lokalnie (JSON)' : 'Save locally (JSON)'}
                    </option>

                    <option value="merge-glossaries">
                      🔗 {language === 'pl' ? 'Połącz glosariusze (pliki)' : 'Merge glossaries (files)'}
                    </option>

                    <option
                      value="merge-project-glossaries"
                      disabled={!currentProject || currentProject.glossaries.length <= 1}
                    >
                      🔗 {language === 'pl' ? 'Połącz glosariusze (projekt)' : 'Merge glossaries (project)'}
                    </option>

                    <option value="expand-auto" disabled={!documentText || isLoading || currentGlossary?.isBilingual}>
                      🔍 {language === 'pl' ? 'Rozbuduj (automatycznie)' : 'Expand (automatic)'}
                    </option>

                    {/* Opcja tworzenia glosariusza dwujęzycznego - widoczna zawsze, aktywna gdy są terminy */}
                    {currentGlossary && !currentGlossary.isBilingual && (
                      <option value="create-bilingual" disabled={terms.length === 0}>
                        🌐 {language === 'pl' ? 'Stwórz glosariusz dwujęzyczny' : 'Create bilingual glossary'}
                      </option>
                    )}

                    {glossaryMode === 'bilingual' && bilingualStage === 1 && (
                      <option value="approve-base" disabled={terms.length === 0}>
                        ✓ Zatwierdź glosariusz bazowy
                      </option>
                    )}

                    {glossaryMode === 'bilingual' && bilingualStage === 2 && (
                      <>
                        <option value="find-equivalents" disabled={isLoading || terms.length === 0}>
                          🔍 Znajdź wszystkie ekwiwalenty
                        </option>
                        <option value="back-stage1">
                          ← Powrót do Etapu 1
                        </option>
                      </>
                    )}
                  </select>

                  {/* Hidden SnapshotButton for functionality */}
                  {currentProject && currentGlossary && (
                    <div className="hidden">
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

                  {/* Bilingual info - Stage 1 */}
                  {glossaryMode === 'bilingual' && bilingualStage === 1 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-500 italic">
                        {language === 'pl'
                          ? 'Glosariusz dwujęzyczny - Etap 1: Po zatwierdzeniu będziesz mógł wyszukiwać ekwiwalenty'
                          : 'Bilingual Glossary - Stage 1: After approval you can find equivalents'}
                      </p>
                    </div>
                  )}

                  {/* Bilingual info - Stage 2 */}
                  {glossaryMode === 'bilingual' && bilingualStage === 2 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-500 italic">
                        {language === 'pl'
                          ? 'Glosariusz dwujęzyczny - Etap 2: Wyszukiwanie ekwiwalentów'
                          : 'Bilingual Glossary - Stage 2: Finding equivalents'}
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-lg shadow-lg p-4">
                  <h3 className="text-lg font-semibold mb-3 text-gray-800">
                    {language === 'pl' ? 'Import / Eksport' : 'Import / Export'}
                  </h3>
                  <ExportButtons
                    terms={terms}
                    fileName={fileName}
                    documentText={documentText}
                    onImportTerms={handleImportTerms}
                    glossaryMode={glossaryMode}
                    selectedColumnView={selectedColumnView}
                    targetDocumentText={targetDocumentText}
                    sortBy={sortBy}
                  />
                </div>
              </div>

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

                  {/* Opcja generowania definicji */}
                  <div className="mt-3 pt-3 border-t border-blue-300">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={generateDefinitions}
                        onChange={(e) => setGenerateDefinitions(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 font-medium">
                        {language === 'pl'
                          ? 'Generuj definicje AI dla wszystkich terminów'
                          : 'Generate AI definitions for all terms'}
                      </span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1 ml-6">
                      {language === 'pl'
                        ? 'Automatycznie wygeneruje definicje dla wszystkich wyekstrahowanych terminów (wymaga więcej czasu)'
                        : 'Automatically generates definitions for all extracted terms (requires more time)'}
                    </p>
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
                  if (updated) {
                    setCurrentProject(updated)
                    // Przywróć documentText i fileName z projektu
                    if (updated.documentText) {
                      setDocumentText(updated.documentText)
                      setFileName(updated.fileName)
                      setDetectedLanguage(updated.detectedLanguage)
                    }
                  }
                  refreshGlossary()
                }}
                onRefresh={() => {
                  const updated = projectStorage.getById(currentProject.id)
                  if (updated) setCurrentProject(updated)
                  setRefreshKey(prev => prev + 1)
                }}
                onClearDocument={() => {
                  // Wyczyść załadowany dokument - nowy glosariusz startuje od zera
                  setLoadedText('')
                  setLoadedFileName('')
                  setDocumentText('')
                  setFileName('')
                  setDetectedLanguage('')
                  setClearTrigger(prev => prev + 1) // Wyczyść pola URL w FileUpload/BilingualFileUpload
                  console.log('🧹 Wyczyszczono dokument dla nowego glosariusza')
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
              onDocumentNameUpdate={handleDocumentNameUpdate}
              documentText={documentText}
              apiKey={apiKey}
              onTermSelect={setSelectedTerm}
              selectedTermId={selectedTerm?.id}
              fileName={fileName}
              isBilingual={currentGlossary?.isBilingual || false}
              sourceLanguage={currentGlossary?.sourceLanguage}
              targetLanguage={currentGlossary?.targetLanguage}
              columnView={currentGlossary?.columnView || '4'}
              targetDocumentText={currentGlossary?.targetDocumentText}
              documents={currentProject?.documents}
              sortBy={sortBy}
              onSortChange={setSortBy}
            />

            {/* Document viewer */}
            {documentText && !currentGlossary?.isBilingual && (
              <DocumentViewer
                documentText={documentText}
                selectedTerm={selectedTerm}
                fileName={fileName}
                terms={terms}
                onAddTermFromSelection={handleManualAddTerm}
              />
            )}

            {/* Split document viewer for bilingual glossaries */}
            {documentText && currentGlossary?.isBilingual && currentGlossary.targetDocumentText && (
              <SplitDocumentViewer
                sourceDocumentText={currentGlossary.sourceDocumentText || documentText}
                targetDocumentText={currentGlossary.targetDocumentText}
                terms={terms}
                selectedTerm={selectedTerm}
                sourceLanguage={currentGlossary.sourceLanguage}
                targetLanguage={currentGlossary.targetLanguage}
                onAddManualTerm={handleAddManualTerm}
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

      {/* Modal dla tworzenia glosariusza dwujęzycznego */}
      {showBilingualDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-t-xl">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                🌐 {language === 'pl' ? 'Tworzenie glosariusza dwujęzycznego' : 'Creating Bilingual Glossary'}
              </h2>
              <p className="text-blue-100 mt-2">
                {bilingualDialogStep === 'language' && (language === 'pl' ? 'Krok 1: Wybierz język docelowy' : 'Step 1: Select target language')}
                {bilingualDialogStep === 'document' && (language === 'pl' ? 'Krok 2: Załaduj dokument w języku docelowym' : 'Step 2: Load target language document')}
                {bilingualDialogStep === 'columns' && (language === 'pl' ? 'Krok 3: Wybierz widok glosariusza' : 'Step 3: Choose glossary view')}
                {bilingualDialogStep === 'processing' && (language === 'pl' ? 'Dopasowywanie terminów...' : 'Matching terms...')}
              </p>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Krok 1: Wybór języka */}
              {bilingualDialogStep === 'language' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800 flex items-start gap-2">
                      <span className="text-xl">ℹ️</span>
                      <span>
                        {language === 'pl'
                          ? 'Wybierz język, w którym znajduje się dokument docelowy. System automatycznie dopasuje terminy na podstawie kontekstu i pozycji w dokumencie.'
                          : 'Select the language of your target document. The system will automatically match terms based on context and position in the document.'}
                      </span>
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {language === 'pl' ? 'Język docelowy:' : 'Target language:'}
                    </label>
                    <select
                      value={selectedTargetLanguage}
                      onChange={(e) => setSelectedTargetLanguage(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-lg"
                    >
                      <option value="">
                        {language === 'pl' ? '-- Wybierz język --' : '-- Select language --'}
                      </option>
                      {TARGET_LANGUAGES.map(lang => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name} ({lang.code.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setShowBilingualDialog(false)}
                      className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                    >
                      ❌ {language === 'pl' ? 'Anuluj' : 'Cancel'}
                    </button>
                    <button
                      onClick={() => setBilingualDialogStep('document')}
                      disabled={!selectedTargetLanguage}
                      className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      ➡️ {language === 'pl' ? 'Dalej' : 'Next'}
                    </button>
                  </div>
                </div>
              )}

              {/* Krok 2: Załadowanie dokumentu */}
              {bilingualDialogStep === 'document' && (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-800 flex items-start gap-2">
                      <span className="text-xl">✅</span>
                      <span>
                        {language === 'pl'
                          ? `Wybrany język: ${TARGET_LANGUAGES.find(l => l.code === selectedTargetLanguage)?.name || selectedTargetLanguage}`
                          : `Selected language: ${TARGET_LANGUAGES.find(l => l.code === selectedTargetLanguage)?.name || selectedTargetLanguage}`}
                      </span>
                    </p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800 flex items-start gap-2">
                      <span className="text-xl">📄</span>
                      <span>
                        {language === 'pl'
                          ? 'Załaduj dokument w języku docelowym. Obsługiwane formaty: TXT, HTML, DOCX, XLSX, XLS, XML. Powinien to być ten sam dokument co źródłowy, ale w innym języku.'
                          : 'Load a document in the target language. Supported formats: TXT, HTML, DOCX, XLSX, XLS, XML. It should be the same document as the source, but in a different language.'}
                      </span>
                    </p>
                  </div>

                  {/* Przyciski wyboru metody wprowadzania */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setBilingualInputMode('file')}
                      className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                        bilingualInputMode === 'file'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      📁 {language === 'pl' ? 'Plik' : 'File'}
                    </button>
                    <button
                      onClick={() => setBilingualInputMode('url')}
                      className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                        bilingualInputMode === 'url'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      🔗 {language === 'pl' ? 'URL' : 'URL'}
                    </button>
                    <button
                      onClick={() => setBilingualInputMode('text')}
                      className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                        bilingualInputMode === 'text'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      📝 {language === 'pl' ? 'Tekst' : 'Text'}
                    </button>
                  </div>

                  {/* Tryb: Plik */}
                  {bilingualInputMode === 'file' && (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <input
                        type="file"
                        accept=".txt,.html,.docx,.xlsx,.xls,.xml"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            setBilingualDialogStep('columns')
                            ;(window as any).__bilingualTargetFile = file
                          }
                        }}
                        className="hidden"
                        id="bilingual-file-input"
                      />
                      <label
                        htmlFor="bilingual-file-input"
                        className="cursor-pointer inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-lg"
                      >
                        📁 {language === 'pl' ? 'Wybierz plik' : 'Choose file'}
                      </label>
                      <p className="text-gray-500 text-sm mt-3">
                        {language === 'pl' ? 'lub przeciągnij plik tutaj' : 'or drag file here'}
                      </p>
                    </div>
                  )}

                  {/* Tryb: URL */}
                  {bilingualInputMode === 'url' && (
                    <div className="space-y-3">
                      <input
                        type="url"
                        placeholder={language === 'pl' ? 'https://example.com/document.html' : 'https://example.com/document.html'}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        id="bilingual-url-input"
                      />
                      <button
                        onClick={async () => {
                          const input = document.getElementById('bilingual-url-input') as HTMLInputElement
                          const url = input?.value.trim()
                          if (!url) {
                            alert(language === 'pl' ? 'Proszę podać URL' : 'Please provide URL')
                            return
                          }

                          try {
                            const response = await fetch('/api/fetch-url', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ url })
                            })

                            const data = await response.json()
                            if (!response.ok) {
                              throw new Error(data.error || 'Error fetching document')
                            }

                            ;(window as any).__bilingualTargetText = data.text
                            ;(window as any).__bilingualTargetFileName = new URL(url).pathname.split('/').pop() || 'document.html'
                            setBilingualDialogStep('columns')
                          } catch (error: any) {
                            alert((language === 'pl' ? 'Błąd pobierania: ' : 'Fetch error: ') + error.message)
                          }
                        }}
                        className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-lg"
                      >
                        🔗 {language === 'pl' ? 'Pobierz dokument' : 'Fetch document'}
                      </button>
                    </div>
                  )}

                  {/* Tryb: Tekst */}
                  {bilingualInputMode === 'text' && (
                    <div className="space-y-3">
                      <textarea
                        placeholder={language === 'pl' ? 'Wklej tekst w języku docelowym tutaj...' : 'Paste target language text here...'}
                        className="w-full h-64 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y font-mono text-sm"
                        id="bilingual-text-input"
                      />
                      <button
                        onClick={() => {
                          const textarea = document.getElementById('bilingual-text-input') as HTMLTextAreaElement
                          const text = textarea?.value.trim()
                          if (!text || text.length < 50) {
                            alert(language === 'pl' ? 'Tekst jest zbyt krótki (minimum 50 znaków)' : 'Text is too short (minimum 50 characters)')
                            return
                          }

                          ;(window as any).__bilingualTargetText = text
                          ;(window as any).__bilingualTargetFileName = language === 'pl' ? 'Wklejony tekst' : 'Pasted text'
                          setBilingualDialogStep('columns')
                        }}
                        className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-lg"
                      >
                        ✅ {language === 'pl' ? 'Użyj tego tekstu' : 'Use this text'}
                      </button>
                    </div>
                  )}

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setBilingualDialogStep('language')}
                      className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                    >
                      ⬅️ {language === 'pl' ? 'Wstecz' : 'Back'}
                    </button>
                    <button
                      onClick={() => setShowBilingualDialog(false)}
                      className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                    >
                      ❌ {language === 'pl' ? 'Anuluj' : 'Cancel'}
                    </button>
                  </div>
                </div>
              )}

              {/* Krok 3: Wybór widoku kolumn */}
              {bilingualDialogStep === 'columns' && (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-800 flex items-start gap-2">
                      <span className="text-xl">✅</span>
                      <span>
                        {language === 'pl'
                          ? 'Dokument załadowany pomyślnie!'
                          : 'Document loaded successfully!'}
                      </span>
                    </p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800 flex items-start gap-2">
                      <span className="text-xl">👁️</span>
                      <span>
                        {language === 'pl'
                          ? 'Wybierz jak chcesz wyświetlać glosariusz dwujęzyczny:'
                          : 'Choose how you want to display the bilingual glossary:'}
                      </span>
                    </p>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {language === 'pl' ? 'Widok glosariusza:' : 'Glossary view:'}
                    </label>

                    <div
                      onClick={() => setSelectedColumnView('2')}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        selectedColumnView === '2'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          checked={selectedColumnView === '2'}
                          onChange={() => setSelectedColumnView('2')}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">
                            📊 2 {language === 'pl' ? 'kolumny' : 'columns'}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {language === 'pl'
                              ? 'Tylko terminy: Termin źródłowy | Termin docelowy'
                              : 'Terms only: Source term | Target term'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div
                      onClick={() => setSelectedColumnView('4')}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        selectedColumnView === '4'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          checked={selectedColumnView === '4'}
                          onChange={() => setSelectedColumnView('4')}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">
                            📋 4 {language === 'pl' ? 'kolumny' : 'columns'}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {language === 'pl'
                              ? 'Terminy + konteksty: Termin źródłowy | Kontekst źródłowy | Termin docelowy | Kontekst docelowy'
                              : 'Terms + contexts: Source term | Source context | Target term | Target context'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => {
                        setBilingualDialogStep('document')
                        ;(window as any).__bilingualTargetFile = null
                        ;(window as any).__bilingualTargetText = null
                        setBilingualInputMode('file')
                      }}
                      className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                    >
                      ⬅️ {language === 'pl' ? 'Wstecz' : 'Back'}
                    </button>
                    <button
                      onClick={async () => {
                        const text = (window as any).__bilingualTargetText
                        const file = (window as any).__bilingualTargetFile

                        if (bilingualInputMode === 'file' && file) {
                          // File mode: extract text from file
                          await handleBilingualDocumentLoad(file)
                        } else if ((bilingualInputMode === 'url' || bilingualInputMode === 'text') && text) {
                          // URL/Text mode: use text directly
                          if (!text || text.trim().length === 0) {
                            setNotification({
                              type: 'error',
                              message: language === 'pl' ? 'Błąd' : 'Error',
                              details: language === 'pl' ? 'Dokument docelowy jest pusty' : 'Target document is empty'
                            })
                            return
                          }
                          await processBilingualMatching(text)
                        } else {
                          setNotification({
                            type: 'error',
                            message: language === 'pl' ? 'Błąd' : 'Error',
                            details: language === 'pl' ? 'Nie załadowano dokumentu docelowego' : 'Target document not loaded'
                          })
                        }
                      }}
                      className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                      🚀 {language === 'pl' ? 'Rozpocznij dopasowywanie' : 'Start matching'}
                    </button>
                  </div>
                </div>
              )}

              {/* Krok 4: Przetwarzanie */}
              {bilingualDialogStep === 'processing' && (
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="animate-spin text-3xl">⚙️</div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg text-gray-800">
                          {language === 'pl' ? 'Dopasowywanie terminów...' : 'Matching terms...'}
                        </h3>
                        {bilingualProgress.total > 0 && (
                          <>
                            <p className="text-sm text-gray-600 mt-1">
                              {language === 'pl' ? 'Postęp' : 'Progress'}: <span className="font-semibold text-blue-600">{bilingualProgress.current} / {bilingualProgress.total}</span> {language === 'pl' ? 'terminów' : 'terms'}
                              {' '}({Math.round((bilingualProgress.current / bilingualProgress.total) * 100)}%)
                            </p>
                            {bilingualProgress.current > 0 && bilingualProgress.current < bilingualProgress.total && (
                              <p className="text-xs text-purple-700 mt-2 font-medium italic">
                                📝 {bilingualProgress.message}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    {bilingualProgress.total > 0 && (
                      <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-purple-600 h-4 rounded-full transition-all duration-300 flex items-center justify-end pr-2"
                          style={{
                            width: `${(bilingualProgress.current / bilingualProgress.total) * 100}%`
                          }}
                        >
                          <span className="text-xs text-white font-bold">
                            {Math.round((bilingualProgress.current / bilingualProgress.total) * 100)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800 flex items-start gap-2">
                      <span className="text-xl">⏳</span>
                      <span>
                        {language === 'pl'
                          ? 'Proszę czekać... Proces może potrwać kilka minut w zależności od liczby terminów.'
                          : 'Please wait... The process may take a few minutes depending on the number of terms.'}
                      </span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-8 right-8 z-50 animate-slide-in">
          <div className={`rounded-lg shadow-2xl border-2 p-6 max-w-md ${
            notification.type === 'success'
              ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-500'
              : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-500'
          }`}>
            <div className="flex items-start gap-4">
              <span className="text-3xl flex-shrink-0">
                {notification.type === 'success' ? '✅' : '❌'}
              </span>
              <div className="flex-1">
                <h3 className={`font-bold text-lg mb-2 ${
                  notification.type === 'success' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {notification.message}
                </h3>
                {notification.details && (
                  <p className={`text-sm ${
                    notification.type === 'success' ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {notification.details}
                  </p>
                )}
              </div>
              <button
                onClick={() => setNotification(null)}
                className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-bold hover:scale-110 transition-transform ${
                  notification.type === 'success'
                    ? 'bg-green-200 text-green-800 hover:bg-green-300'
                    : 'bg-red-200 text-red-800 hover:bg-red-300'
                }`}
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog łączenia glosariuszy z projektu */}
      {showMergeProjectDialog && currentProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-t-xl">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                🔗 {language === 'pl' ? 'Połącz glosariusze z projektu' : 'Merge Project Glossaries'}
              </h2>
              <p className="text-sm mt-2 text-blue-100">
                {language === 'pl'
                  ? 'Wybierz glosariusze, które chcesz połączyć z aktualnym glosariuszem'
                  : 'Select glossaries to merge with the current glossary'}
              </p>
            </div>

            <div className="p-6">
              <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>{language === 'pl' ? 'Aktualny glosariusz:' : 'Current glossary:'}</strong> {currentGlossary?.name}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  {language === 'pl'
                    ? 'Wybrane glosariusze zostaną połączone z tym glosariuszem'
                    : 'Selected glossaries will be merged into this glossary'}
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-gray-800 mb-3">
                  {language === 'pl' ? 'Dostępne glosariusze:' : 'Available glossaries:'}
                </h3>
                {currentProject.glossaries
                  .filter(g => g.id !== currentGlossary?.id)
                  .map(glossary => {
                    const version = glossary.versions.find(v => v.id === glossary.currentVersionId)
                    const termCount = version?.terms.length || 0
                    const isSelected = selectedGlossariesForMerge.includes(glossary.id)

                    return (
                      <label
                        key={glossary.id}
                        className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedGlossariesForMerge([...selectedGlossariesForMerge, glossary.id])
                            } else {
                              setSelectedGlossariesForMerge(
                                selectedGlossariesForMerge.filter(id => id !== glossary.id)
                              )
                            }
                          }}
                          className="w-5 h-5"
                        />
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800">{glossary.name}</p>
                          <p className="text-sm text-gray-600">
                            {termCount} {termCount === 1 ? (language === 'pl' ? 'termin' : 'term') : (language === 'pl' ? 'terminów' : 'terms')}
                          </p>
                        </div>
                      </label>
                    )
                  })}
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    setShowMergeProjectDialog(false)
                    setSelectedGlossariesForMerge([])
                  }}
                  className="flex-1 px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
                >
                  {language === 'pl' ? 'Anuluj' : 'Cancel'}
                </button>
                <button
                  onClick={handleExecuteMergeProjectGlossaries}
                  disabled={selectedGlossariesForMerge.length === 0}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all font-medium shadow-lg"
                >
                  {language === 'pl' ? 'Połącz' : 'Merge'} ({selectedGlossariesForMerge.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dialog rozbudowy glosariusza */}
      {showExpandGlossaryDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-purple-500 to-indigo-600">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                📈 {language === 'pl' ? 'Rozbudowa glosariusza' : 'Expand Glossary'}
              </h2>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                {language === 'pl'
                  ? `Aktualnie: ${terms.length} terminów`
                  : `Current: ${terms.length} terms`}
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {language === 'pl'
                  ? 'Podaj nową maksymalną liczbę terminów (większą niż obecna):'
                  : 'Enter new maximum number of terms (greater than current):'}
              </label>
              <input
                type="number"
                value={expandGlossaryInput}
                onChange={(e) => setExpandGlossaryInput(e.target.value)}
                min={terms.length + 1}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-lg"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    doExpandGlossary()
                  } else if (e.key === 'Escape') {
                    setShowExpandGlossaryDialog(false)
                  }
                }}
              />
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setShowExpandGlossaryDialog(false)}
                className="flex-1 px-6 py-3 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                {language === 'pl' ? 'Anuluj' : 'Cancel'}
              </button>
              <button
                onClick={doExpandGlossary}
                className="flex-1 px-6 py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog informacyjny (wymaga kliknięcia OK) */}
      {infoDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* Header z gradientem zależnym od typu */}
            <div className={`p-6 ${
              infoDialog.type === 'success'
                ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                : infoDialog.type === 'error'
                ? 'bg-gradient-to-r from-red-500 to-rose-600'
                : 'bg-gradient-to-r from-blue-500 to-indigo-600'
            }`}>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {infoDialog.type === 'success' && '✅'}
                {infoDialog.type === 'error' && '❌'}
                {infoDialog.type === 'info' && 'ℹ️'}
                {infoDialog.title}
              </h2>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="text-gray-700 whitespace-pre-line mb-4">
                {infoDialog.message}
              </div>
              {infoDialog.details && (
                <div className={`text-sm p-3 rounded-lg ${
                  infoDialog.type === 'success'
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : infoDialog.type === 'error'
                    ? 'bg-red-50 text-red-800 border border-red-200'
                    : 'bg-blue-50 text-blue-800 border border-blue-200'
                }`}>
                  {infoDialog.details}
                </div>
              )}
            </div>

            {/* Footer z przyciskiem OK */}
            <div className="px-6 pb-6">
              <button
                onClick={() => setInfoDialog(null)}
                className={`w-full px-6 py-3 rounded-lg font-semibold text-white transition-all shadow-lg hover:shadow-xl ${
                  infoDialog.type === 'success'
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                    : infoDialog.type === 'error'
                    ? 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700'
                    : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
                }`}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      <ToastContainer toasts={toast.toasts} onClose={toast.closeToast} />

      {/* Modal dla formy podstawowej (języki słowiańskie) */}
      <BaseFormModal
        isOpen={baseFormModal.isOpen}
        foundForm={baseFormModal.foundForm}
        language={language}
        onConfirm={handleBaseFormConfirm}
        onCancel={handleBaseFormCancel}
      />
    </main>
  )
}
