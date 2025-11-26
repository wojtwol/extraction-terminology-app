export type Language = 'pl' | 'en'

export interface Translations {
  // Main page
  title: string
  subtitle: string
  apiKeyLabel: string
  apiKeyPlaceholder: string
  uploadDocument: string
  uploadingDocument: string
  extracting: string

  // Extraction parameters
  extractionParams: string
  minTerms: string
  maxTerms: string
  extractTerms: string
  reExtract: string

  // Results
  extractedTerms: string
  noTermsYet: string

  // Table headers
  number: string
  term: string
  occurrences: string
  definition: string
  context: string
  actions: string

  // Definition actions
  generateAI: string
  addManually: string
  edit: string
  generating: string
  save: string
  cancel: string

  // Language dialog
  selectLanguageTitle: string
  selectLanguageDescription: string

  // Definition sources
  fromDocument: string
  generatedAI: string

  // Export
  exportFormats: string
  exportNote: string

  // Glossaries
  glossaries: string
  newGlossary: string
  noGlossaries: string
  active: string
  version: string
  versions: string
  terms: string
  rename: string
  delete: string
  versionHistory: string
  current: string
  snapshot: string
  restore: string
  createNewGlossary: string
  glossaryName: string
  deleteGlossaryConfirm: string
  restoreVersionConfirm: string
  deleteVersionConfirm: string
  cannotDeleteVersion: string

  // Snapshot
  createSnapshot: string
  snapshotTitle: string
  snapshotDescription: string
  snapshotPlaceholder: string
  snapshotCreated: string
  snapshotFailed: string
  snapshotTip: string

  // Dates
  createdAt: string
  sourceFile: string
  termsCount: string

  // Messages
  enterGlossaryName: string
  enterSnapshotDescription: string
  versionRestored: string

  // Extraction params labels
  extractionParamsTitle: string
  extractionParamsDescription: string

  // FileUpload
  loadDocument: string
  apiKeyRequired: string
  apiKeyHint: string
  getApiKey: string
  limitsInfo: string
  uploadFile: string
  pasteText: string
  enterUrl: string
  dragDropFile: string
  supportedFormats: string
  analyzeText: string
  analyzing: string
  pastedTextLabel: string
  maxCharacters: string
  minCharacters: string
  limitExceeded: string
  largeDocumentWarning: string
  urlPlaceholder: string
  fetchDocument: string
  fetching: string
}

export const translations: Record<Language, Translations> = {
  pl: {
    // Main page
    title: 'IURIDICO EJ GTEXTT',
    subtitle: 'Glossary and Terminology Extraction Tool',
    apiKeyLabel: 'Klucz API Anthropic',
    apiKeyPlaceholder: 'Wprowadź klucz API...',
    uploadDocument: '📄 Wybierz dokument (.txt, .pdf, .docx)',
    uploadingDocument: '⏳ Wczytywanie dokumentu...',
    extracting: '🔄 Ekstrakcja terminów...',

    // Extraction parameters
    extractionParams: 'Parametry ekstrakcji',
    minTerms: 'Min. terminów',
    maxTerms: 'Max. terminów',
    extractTerms: '🔍 Ekstraktuj terminy',
    reExtract: '🔄 Ekstraktuj ponownie',

    // Results
    extractedTerms: 'Wyekstraktowane terminy',
    noTermsYet: 'Brak wyekstraktowanych terminów. Wybierz dokument i rozpocznij ekstrakcję.',

    // Table headers
    number: '#',
    term: 'Termin',
    occurrences: 'Liczba wystąpień',
    definition: 'Definicja',
    context: 'Kontekst',
    actions: 'Akcje',

    // Definition actions
    generateAI: '🤖 Generuj AI',
    addManually: '✎ Dodaj ręcznie',
    edit: 'Edytuj',
    generating: 'Generowanie...',
    save: 'Zapisz',
    cancel: 'Anuluj',

    // Language dialog
    selectLanguageTitle: 'W jakim języku wygenerować definicję?',
    selectLanguageDescription: 'Termin:',

    // Definition sources
    fromDocument: 'Z dokumentu',
    generatedAI: 'Wygenerowane AI',

    // Export
    exportFormats: 'Eksportuj do formatów',
    exportNote: 'zawierają definicje',

    // Glossaries
    glossaries: 'Glosariusze',
    newGlossary: '+ Nowy glosariusz',
    noGlossaries: 'Brak glosariuszy',
    active: 'Aktywny',
    version: 'wersja',
    versions: 'wersji',
    terms: 'terminów',
    rename: 'Zmień nazwę',
    delete: 'Usuń glosariusz',
    versionHistory: 'Historia wersji',
    current: 'Aktualna',
    snapshot: 'Snapshot',
    restore: 'Przywróć',
    createNewGlossary: 'Utwórz nowy glosariusz',
    glossaryName: 'Nazwa glosariusza...',
    deleteGlossaryConfirm: 'Czy na pewno chcesz usunąć glosariusz',
    restoreVersionConfirm: 'Czy na pewno chcesz przywrócić tę wersję? Aktualna praca zostanie zapisana jako nowa wersja.',
    deleteVersionConfirm: 'Czy na pewno chcesz usunąć tę wersję? Ta operacja jest nieodwracalna.',
    cannotDeleteVersion: 'Nie można usunąć tej wersji (może to być aktywna wersja lub jedyna wersja)',

    // Snapshot
    createSnapshot: '📸 Utwórz snapshot',
    snapshotTitle: 'Utwórz snapshot',
    snapshotDescription: 'Snapshot to punkt kontrolny, który pozwala zapisać aktualny stan glosariusza. Możesz do niego wrócić w dowolnym momencie.',
    snapshotPlaceholder: 'Opisz co zawiera ten snapshot (np. \'Przed zmianą parametrów ekstrakcji\', \'Wersja finalna do przeglądu\')...',
    snapshotCreated: 'Snapshot został utworzony',
    snapshotFailed: 'Nie udało się utworzyć snapshota',
    snapshotTip: 'Tip: Ctrl+Enter aby szybko utworzyć',

    // Dates
    createdAt: 'Data utworzenia',
    sourceFile: 'Dokument źródłowy',
    termsCount: 'Liczba terminów',

    // Messages
    enterGlossaryName: 'Podaj nazwę glosariusza',
    enterSnapshotDescription: 'Podaj opis snapshota',
    versionRestored: 'Wersja została przywrócona',

    // Extraction params labels
    extractionParamsTitle: 'Parametry ekstrakcji',
    extractionParamsDescription: 'Ustaw zakres liczby terminów do wyekstraktowania',

    // FileUpload
    loadDocument: 'Załaduj dokument',
    apiKeyRequired: 'Klucz API Anthropic (wymagany)',
    apiKeyHint: 'Pobierz klucz z',
    getApiKey: 'Pobierz klucz API',
    limitsInfo: 'Maksymalnie 1,500,000 znaków (~500 stron).',
    uploadFile: 'Załaduj plik',
    pasteText: 'Wklej tekst',
    enterUrl: 'Podaj URL',
    dragDropFile: 'Przeciągnij i upuść plik tutaj lub kliknij, aby wybrać',
    supportedFormats: 'Obsługiwane formaty: TXT, HTML, DOCX, XLSX, XLS, XML',
    analyzeText: 'Analizuj tekst',
    analyzing: 'Przetwarzanie...',
    pastedTextLabel: 'znaków',
    maxCharacters: 'Maksymalnie 1,500,000 znaków (ok. 500 stron)',
    minCharacters: 'minimum 50 znaków',
    limitExceeded: 'przekroczono limit!',
    largeDocumentWarning: 'duży dokument - może trwać dłużej',
    urlPlaceholder: 'https://example.com/document.html',
    fetchDocument: 'Pobierz dokument',
    fetching: 'Pobieranie...'
  },
  en: {
    // Main page
    title: 'IURIDICO EJ GTEXTT',
    subtitle: 'Glossary and Terminology Extraction Tool',
    apiKeyLabel: 'Anthropic API Key',
    apiKeyPlaceholder: 'Enter API key...',
    uploadDocument: '📄 Select document (.txt, .pdf, .docx)',
    uploadingDocument: '⏳ Loading document...',
    extracting: '🔄 Extracting terms...',

    // Extraction parameters
    extractionParams: 'Extraction Parameters',
    minTerms: 'Min. terms',
    maxTerms: 'Max. terms',
    extractTerms: '🔍 Extract Terms',
    reExtract: '🔄 Re-extract',

    // Results
    extractedTerms: 'Extracted Terms',
    noTermsYet: 'No extracted terms yet. Select a document and start extraction.',

    // Table headers
    number: '#',
    term: 'Term',
    occurrences: 'Occurrences',
    definition: 'Definition',
    context: 'Context',
    actions: 'Actions',

    // Definition actions
    generateAI: '🤖 Generate AI',
    addManually: '✎ Add Manually',
    edit: 'Edit',
    generating: 'Generating...',
    save: 'Save',
    cancel: 'Cancel',

    // Language dialog
    selectLanguageTitle: 'In which language to generate the definition?',
    selectLanguageDescription: 'Term:',

    // Definition sources
    fromDocument: 'From document',
    generatedAI: 'Generated by AI',

    // Export
    exportFormats: 'Export to formats',
    exportNote: 'include definitions',

    // Glossaries
    glossaries: 'Glossaries',
    newGlossary: '+ New Glossary',
    noGlossaries: 'No glossaries',
    active: 'Active',
    version: 'version',
    versions: 'versions',
    terms: 'terms',
    rename: 'Rename',
    delete: 'Delete glossary',
    versionHistory: 'Version History',
    current: 'Current',
    snapshot: 'Snapshot',
    restore: 'Restore',
    createNewGlossary: 'Create New Glossary',
    glossaryName: 'Glossary name...',
    deleteGlossaryConfirm: 'Are you sure you want to delete the glossary',
    restoreVersionConfirm: 'Are you sure you want to restore this version? The current work will be saved as a new version.',
    deleteVersionConfirm: 'Are you sure you want to delete this version? This operation is irreversible.',
    cannotDeleteVersion: 'Cannot delete this version (it may be the active version or the only version)',

    // Snapshot
    createSnapshot: '📸 Create Snapshot',
    snapshotTitle: 'Create Snapshot',
    snapshotDescription: 'A snapshot is a checkpoint that allows you to save the current state of the glossary. You can return to it at any time.',
    snapshotPlaceholder: 'Describe what this snapshot contains (e.g., \'Before changing extraction parameters\', \'Final version for review\')...',
    snapshotCreated: 'Snapshot has been created',
    snapshotFailed: 'Failed to create snapshot',
    snapshotTip: 'Tip: Ctrl+Enter to create quickly',

    // Dates
    createdAt: 'Created at',
    sourceFile: 'Source file',
    termsCount: 'Number of terms',

    // Messages
    enterGlossaryName: 'Enter glossary name',
    enterSnapshotDescription: 'Enter snapshot description',
    versionRestored: 'Version has been restored',

    // Extraction params labels
    extractionParamsTitle: 'Extraction Parameters',
    extractionParamsDescription: 'Set the range of terms to extract',

    // FileUpload
    loadDocument: 'Upload Source Document',
    apiKeyRequired: 'Anthropic API Key (required)',
    apiKeyHint: 'Get your key from',
    getApiKey: 'Get API Key',
    limitsInfo: 'Maximum 1,500,000 characters (~500 pages).',
    uploadFile: 'Upload File',
    pasteText: 'Paste Text',
    enterUrl: 'Enter URL',
    dragDropFile: 'Drag and drop file here or click to select',
    supportedFormats: 'Supported formats: TXT, HTML, DOCX, XLSX, XLS, XML',
    analyzeText: 'Analyze Text',
    analyzing: 'Processing...',
    pastedTextLabel: 'characters',
    maxCharacters: 'Maximum 1,500,000 characters (~500 pages)',
    minCharacters: 'minimum 50 characters',
    limitExceeded: 'limit exceeded!',
    largeDocumentWarning: 'large document - may take longer',
    urlPlaceholder: 'https://example.com/document.html',
    fetchDocument: 'Fetch Document',
    fetching: 'Fetching...'
  }
}
