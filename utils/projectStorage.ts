import { Term } from '@/app/page'

export interface Project {
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

export const projectStorage = {
  // Pobierz wszystkie projekty
  getAll(): Project[] {
    if (typeof window === 'undefined') return []
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      return data ? JSON.parse(data) : []
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

  // Zapisz nowy projekt
  save(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Project {
    const projects = this.getAll()
    const newProject: Project = {
      ...project,
      id: `project-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
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
      id: projects[index].id, // Nie zmieniaj ID
      createdAt: projects[index].createdAt, // Nie zmieniaj daty utworzenia
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
  }
}
