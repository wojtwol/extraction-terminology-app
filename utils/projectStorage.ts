import { Term } from '@/app/page'

// Dokument źródłowy
export interface SourceDocument {
  id: string
  fileName: string
  text: string
  language: string
  addedAt: string
}

// Wersja glosariusza z parametrami ekstrakcji
export interface GlossaryVersion {
  id: string
  versionNumber: number
  createdAt: string
  description: string
  terms: Term[]
  extractionParams?: {
    minTerms: number
    maxTerms: number
    minLength: number
    minOccurrences: number
  }
  isSnapshot?: boolean // Czy to snapshot ręcznie utworzony
  changesSummary?: string // Podsumowanie zmian (auto-generowane)
}

// Glosariusz - może mieć wiele wersji
export interface Glossary {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  currentVersionId: string
  versions: GlossaryVersion[]

  // Dla glosariuszy dwujęzycznych
  isBilingual?: boolean
  sourceLanguage?: string  // np. 'pl', 'en'
  targetLanguage?: string  // np. 'en', 'de'
  sourceDocumentText?: string // Tekst dokumentu źródłowego
  targetDocumentText?: string // Tekst dokumentu docelowego
  columnView?: '2' | '4'  // Widok: 2 kolumny (terminy) lub 4 kolumny (terminy + konteksty)
}

// Projekt - może mieć wiele glosariuszy
export interface Project {
  id: string
  name: string
  createdAt: string
  updatedAt: string

  // Dla kompatybilności wstecznej (single-document mode)
  fileName: string
  documentText: string
  detectedLanguage: string

  // Dla multi-document mode
  isMultiDocument?: boolean
  documents?: SourceDocument[]

  // Dla bilingual mode
  mode?: 'monolingual' | 'bilingual'
  stage?: 1 | 2  // Workflow stage dla bilingual (1 = base glossary, 2 = finding equivalents)

  glossaries: Glossary[]
  currentGlossaryId: string | null
}

// Stara struktura dla migracji
interface LegacyProject {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  fileName: string
  documentText: string
  detectedLanguage: string
  terms: Term[]
}

const STORAGE_KEY = 'iuridico_projects'
const VERSION_KEY = 'iuridico_storage_version'
const CURRENT_STORAGE_VERSION = 2

// Migracja ze starej struktury do nowej
function migrateProject(legacy: LegacyProject): Project {
  const initialVersion: GlossaryVersion = {
    id: `version-${Date.now()}-1`,
    versionNumber: 1,
    createdAt: legacy.updatedAt || legacy.createdAt,
    description: 'Wersja początkowa (migrowana)',
    terms: legacy.terms || [],
    isSnapshot: true
  }

  const initialGlossary: Glossary = {
    id: `glossary-${Date.now()}`,
    name: 'Glosariusz główny',
    createdAt: legacy.createdAt,
    updatedAt: legacy.updatedAt,
    currentVersionId: initialVersion.id,
    versions: [initialVersion]
  }

  return {
    id: legacy.id,
    name: legacy.name,
    createdAt: legacy.createdAt,
    updatedAt: legacy.updatedAt,
    fileName: legacy.fileName,
    documentText: legacy.documentText,
    detectedLanguage: legacy.detectedLanguage,
    glossaries: [initialGlossary],
    currentGlossaryId: initialGlossary.id
  }
}

// Sprawdź czy projekt jest w starej strukturze
function isLegacyProject(obj: any): obj is LegacyProject {
  return obj && 'terms' in obj && !('glossaries' in obj)
}

export const projectStorage = {
  // Automatyczna migracja przy odczycie
  getAll(): Project[] {
    if (typeof window === 'undefined') return []
    try {
      const version = localStorage.getItem(VERSION_KEY)
      const data = localStorage.getItem(STORAGE_KEY)

      if (!data) return []

      const parsed = JSON.parse(data)

      // Jeśli stara wersja, migruj wszystkie projekty
      if (version !== CURRENT_STORAGE_VERSION.toString()) {
        console.log('🔄 Migrating projects to new structure...')
        const migrated = parsed.map((proj: any) =>
          isLegacyProject(proj) ? migrateProject(proj) : proj
        )
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
        localStorage.setItem(VERSION_KEY, CURRENT_STORAGE_VERSION.toString())
        console.log('✅ Migration complete')
        return migrated
      }

      return parsed
    } catch (error) {
      console.error('Błąd odczytu projektów:', error)
      return []
    }
  },

  // Pobierz projekt po ID
  getById(id: string): Project | null {
    const projects = this.getAll()
    return projects.find(p => p.id === id) || null
  },

  // Zapisz nowy projekt z początkowym glosariuszem
  save(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'glossaries' | 'currentGlossaryId'>): Project {
    const projects = this.getAll()

    const initialVersion: GlossaryVersion = {
      id: `version-${Date.now()}-1`,
      versionNumber: 1,
      createdAt: new Date().toISOString(),
      description: 'Wersja początkowa',
      terms: [],
      isSnapshot: true
    }

    const initialGlossary: Glossary = {
      id: `glossary-${Date.now()}`,
      name: 'Glosariusz główny',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentVersionId: initialVersion.id,
      versions: [initialVersion]
    }

    const newProject: Project = {
      ...project,
      id: `project-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      glossaries: [initialGlossary],
      currentGlossaryId: initialGlossary.id
    }

    projects.push(newProject)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
    return newProject
  },

  // Aktualizuj projekt
  update(id: string, updates: Partial<Project>): Project | null {
    const projects = this.getAll()
    const index = projects.findIndex(p => p.id === id)
    if (index === -1) return null

    projects[index] = {
      ...projects[index],
      ...updates,
      id: projects[index].id,
      createdAt: projects[index].createdAt,
      updatedAt: new Date().toISOString()
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
    return projects[index]
  },

  // Usuń projekt
  delete(id: string): boolean {
    const projects = this.getAll()
    const filtered = projects.filter(p => p.id !== id)
    if (filtered.length === projects.length) return false
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
    return true
  },

  // Wyczyść wszystkie projekty
  clear(): void {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(VERSION_KEY)
  },

  // === OPERACJE NA DOKUMENTACH ===

  // Dodaj dokument do projektu (multi-document mode)
  addDocument(projectId: string, fileName: string, text: string, language: string): SourceDocument | null {
    const project = this.getById(projectId)
    if (!project) return null

    const newDocument: SourceDocument = {
      id: `doc-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      fileName,
      text,
      language,
      addedAt: new Date().toISOString()
    }

    if (!project.documents) {
      project.documents = []
    }

    project.documents.push(newDocument)
    project.isMultiDocument = true
    this.update(projectId, { documents: project.documents, isMultiDocument: true })

    return newDocument
  },

  // Usuń dokument z projektu
  deleteDocument(projectId: string, documentId: string): boolean {
    const project = this.getById(projectId)
    if (!project || !project.documents) return false

    const filtered = project.documents.filter(d => d.id !== documentId)
    if (filtered.length === project.documents.length) return false

    this.update(projectId, { documents: filtered })
    return true
  },

  // Pobierz dokument po ID
  getDocument(projectId: string, documentId: string): SourceDocument | null {
    const project = this.getById(projectId)
    if (!project || !project.documents) return null
    return project.documents.find(d => d.id === documentId) || null
  },

  // === OPERACJE NA GLOSARIUSZACH ===

  // Dodaj nowy glosariusz do projektu
  addGlossary(projectId: string, name: string, terms: Term[] = [], extractionParams?: GlossaryVersion['extractionParams']): Glossary | null {
    const project = this.getById(projectId)
    if (!project) return null

    const initialVersion: GlossaryVersion = {
      id: `version-${Date.now()}-1`,
      versionNumber: 1,
      createdAt: new Date().toISOString(),
      description: 'Wersja początkowa',
      terms,
      extractionParams,
      isSnapshot: true
    }

    const newGlossary: Glossary = {
      id: `glossary-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentVersionId: initialVersion.id,
      versions: [initialVersion]
    }

    project.glossaries.push(newGlossary)
    project.currentGlossaryId = newGlossary.id
    this.update(projectId, { glossaries: project.glossaries, currentGlossaryId: newGlossary.id })

    return newGlossary
  },

  // Usuń glosariusz
  deleteGlossary(projectId: string, glossaryId: string): boolean {
    const project = this.getById(projectId)
    if (!project) return false

    const filtered = project.glossaries.filter(g => g.id !== glossaryId)
    if (filtered.length === project.glossaries.length) return false

    // Jeśli usuwamy aktywny glosariusz, ustaw pierwszy jako aktywny
    let newCurrentId = project.currentGlossaryId
    if (project.currentGlossaryId === glossaryId) {
      newCurrentId = filtered.length > 0 ? filtered[0].id : null
    }

    this.update(projectId, { glossaries: filtered, currentGlossaryId: newCurrentId })
    return true
  },

  // Zmień nazwę glosariusza
  renameGlossary(projectId: string, glossaryId: string, newName: string): boolean {
    const project = this.getById(projectId)
    if (!project) return false

    const glossary = project.glossaries.find(g => g.id === glossaryId)
    if (!glossary) return false

    glossary.name = newName
    glossary.updatedAt = new Date().toISOString()
    this.update(projectId, { glossaries: project.glossaries })
    return true
  },

  // Ustaw aktywny glosariusz
  setCurrentGlossary(projectId: string, glossaryId: string): boolean {
    const project = this.getById(projectId)
    if (!project) return false

    const glossary = project.glossaries.find(g => g.id === glossaryId)
    if (!glossary) return false

    this.update(projectId, { currentGlossaryId: glossaryId })
    return true
  },

  // === OPERACJE NA WERSJACH ===

  // Dodaj nową wersję do glosariusza (automatyczne wersjonowanie)
  addVersion(
    projectId: string,
    glossaryId: string,
    terms: Term[],
    description: string = 'Auto-save',
    extractionParams?: GlossaryVersion['extractionParams'],
    isSnapshot: boolean = false
  ): GlossaryVersion | null {
    const project = this.getById(projectId)
    if (!project) return null

    const glossary = project.glossaries.find(g => g.id === glossaryId)
    if (!glossary) return null

    const currentVersion = glossary.versions.find(v => v.id === glossary.currentVersionId)
    const changesSummary = this.generateChangesSummary(currentVersion?.terms || [], terms)

    const newVersion: GlossaryVersion = {
      id: `version-${Date.now()}-${glossary.versions.length + 1}`,
      versionNumber: glossary.versions.length + 1,
      createdAt: new Date().toISOString(),
      description,
      terms,
      extractionParams,
      isSnapshot,
      changesSummary
    }

    glossary.versions.push(newVersion)
    glossary.currentVersionId = newVersion.id
    glossary.updatedAt = new Date().toISOString()

    this.update(projectId, { glossaries: project.glossaries })
    return newVersion
  },

  // Stwórz snapshot (punkt kontrolny)
  createSnapshot(projectId: string, glossaryId: string, description: string): GlossaryVersion | null {
    const project = this.getById(projectId)
    if (!project) return null

    const glossary = project.glossaries.find(g => g.id === glossaryId)
    if (!glossary) return null

    const currentVersion = glossary.versions.find(v => v.id === glossary.currentVersionId)
    if (!currentVersion) return null

    return this.addVersion(
      projectId,
      glossaryId,
      currentVersion.terms,
      description,
      currentVersion.extractionParams,
      true // isSnapshot
    )
  },

  // Przywróć wersję
  restoreVersion(projectId: string, glossaryId: string, versionId: string): boolean {
    const project = this.getById(projectId)
    if (!project) return false

    const glossary = project.glossaries.find(g => g.id === glossaryId)
    if (!glossary) return false

    const version = glossary.versions.find(v => v.id === versionId)
    if (!version) return false

    glossary.currentVersionId = versionId
    glossary.updatedAt = new Date().toISOString()
    this.update(projectId, { glossaries: project.glossaries })
    return true
  },

  // Usuń wersję (nie można usunąć aktywnej ani jedynej)
  deleteVersion(projectId: string, glossaryId: string, versionId: string): boolean {
    const project = this.getById(projectId)
    if (!project) return false

    const glossary = project.glossaries.find(g => g.id === glossaryId)
    if (!glossary) return false

    // Nie można usunąć aktywnej wersji
    if (glossary.currentVersionId === versionId) return false

    // Nie można usunąć jeśli to jedyna wersja
    if (glossary.versions.length === 1) return false

    glossary.versions = glossary.versions.filter(v => v.id !== versionId)
    glossary.updatedAt = new Date().toISOString()
    this.update(projectId, { glossaries: project.glossaries })
    return true
  },

  // Pobierz aktualny glosariusz projektu
  getCurrentGlossary(projectId: string): Glossary | null {
    const project = this.getById(projectId)
    if (!project || !project.currentGlossaryId) return null
    return project.glossaries.find(g => g.id === project.currentGlossaryId) || null
  },

  // Pobierz aktualną wersję glosariusza
  getCurrentVersion(projectId: string, glossaryId: string): GlossaryVersion | null {
    const project = this.getById(projectId)
    if (!project) return null

    const glossary = project.glossaries.find(g => g.id === glossaryId)
    if (!glossary) return null

    return glossary.versions.find(v => v.id === glossary.currentVersionId) || null
  },

  // Generuj podsumowanie zmian między wersjami
  generateChangesSummary(oldTerms: Term[], newTerms: Term[]): string {
    const added = newTerms.filter(nt => !oldTerms.find(ot => ot.term === nt.term))
    const removed = oldTerms.filter(ot => !newTerms.find(nt => nt.term === ot.term))
    const modified = newTerms.filter(nt => {
      const old = oldTerms.find(ot => ot.term === nt.term)
      return old && (old.definition !== nt.definition || old.context !== nt.context)
    })

    const parts = []
    if (added.length > 0) parts.push(`+${added.length} nowych`)
    if (removed.length > 0) parts.push(`-${removed.length} usuniętych`)
    if (modified.length > 0) parts.push(`~${modified.length} zmodyfikowanych`)

    return parts.length > 0 ? parts.join(', ') : 'Brak zmian'
  }
}
