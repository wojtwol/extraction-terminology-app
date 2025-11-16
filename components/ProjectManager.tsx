'use client'

import { useState, useEffect } from 'react'
import { Project, projectStorage } from '@/utils/projectStorage'

interface ProjectManagerProps {
  currentProject: Project | null
  onLoadProject: (project: Project) => void
  onNewProject: () => void
}

export default function ProjectManager({ currentProject, onLoadProject, onNewProject }: ProjectManagerProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [showList, setShowList] = useState(true) // Domyślnie widoczne

  useEffect(() => {
    loadProjects()
  }, [currentProject]) // Odśwież listę gdy zmienia się currentProject

  const loadProjects = () => {
    const allProjects = projectStorage.getAll()
    // Sortuj po dacie modyfikacji (najnowsze na górze)
    allProjects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    setProjects(allProjects)
  }

  const handleDelete = (id: string) => {
    if (confirm('Czy na pewno chcesz usunąć ten projekt?')) {
      projectStorage.delete(id)
      loadProjects()
      if (currentProject?.id === id) {
        onNewProject()
      }
    }
  }

  const formatDate = (isoDate: string) => {
    return new Date(isoDate).toLocaleString('pl-PL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-800">
          Zapisane projekty ({projects.length})
        </h2>
        <button
          onClick={onNewProject}
          className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
          title="Nowy projekt"
        >
          + Nowy projekt
        </button>
      </div>

      {currentProject && (
        <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800">{currentProject.name}</p>
              <p className="text-xs text-gray-600 mt-1">
                {currentProject.terms.length} terminów • {currentProject.detectedLanguage}
              </p>
              <p className="text-xs text-gray-500">
                Zmieniono: {formatDate(currentProject.updatedAt)}
              </p>
            </div>
            <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Aktywny</span>
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {projects.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            Brak zapisanych projektów. Załaduj dokument i utwórz pierwszy glosariusz.
          </p>
        ) : (
          projects.map((project) => (
              <div
                key={project.id}
                className={`p-3 rounded-lg border transition-colors ${
                  currentProject?.id === project.id
                    ? 'bg-blue-50 border-blue-300'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {project.name}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {project.terms.length} terminów • {project.detectedLanguage}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(project.updatedAt)}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {currentProject?.id !== project.id && (
                      <button
                        onClick={() => onLoadProject(project)}
                        className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                        title="Wczytaj"
                      >
                        Wczytaj
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                      title="Usuń"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
      </div>
    </div>
  )
}
