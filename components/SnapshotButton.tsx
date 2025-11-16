'use client'

import { useState } from 'react'
import { projectStorage } from '@/utils/projectStorage'

interface SnapshotButtonProps {
  projectId: string
  glossaryId: string
  onSnapshotCreated: () => void
}

export default function SnapshotButton({ projectId, glossaryId, onSnapshotCreated }: SnapshotButtonProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [description, setDescription] = useState('')

  const handleCreateSnapshot = () => {
    if (!description.trim()) {
      alert('Podaj opis snapshota')
      return
    }

    const result = projectStorage.createSnapshot(projectId, glossaryId, description.trim())
    if (result) {
      setDescription('')
      setShowDialog(false)
      onSnapshotCreated()
      alert('Snapshot został utworzony')
    } else {
      alert('Nie udało się utworzyć snapshota')
    }
  }

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors flex items-center gap-2"
        title="Utwórz punkt kontrolny (snapshot)"
      >
        📸 Utwórz snapshot
      </button>

      {showDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Utwórz snapshot</h3>
            <p className="text-sm text-gray-600 mb-4">
              Snapshot to punkt kontrolny, który pozwala zapisać aktualny stan glosariusza.
              Możesz do niego wrócić w dowolnym momencie.
            </p>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && e.ctrlKey) handleCreateSnapshot()
                if (e.key === 'Escape') setShowDialog(false)
              }}
              placeholder="Opisz co zawiera ten snapshot (np. 'Przed zmianą parametrów ekstrakcji', 'Wersja finalna do przeglądu')..."
              className="w-full px-3 py-2 border border-gray-300 rounded mb-4 h-24 resize-none"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDialog(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Anuluj
              </button>
              <button
                onClick={handleCreateSnapshot}
                className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
              >
                Utwórz snapshot
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">Tip: Ctrl+Enter aby szybko utworzyć</p>
          </div>
        </div>
      )}
    </>
  )
}
