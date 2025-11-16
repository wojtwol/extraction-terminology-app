'use client'

import { useState, useRef, useEffect } from 'react'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'

interface FileUploadProps {
  onExtract: (text: string, filename: string, apiKey: string) => void | Promise<void>
  isLoading: boolean
  savedApiKey?: string
}

export default function FileUpload({ onExtract, isLoading, savedApiKey }: FileUploadProps) {
  const [apiKey, setApiKey] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [inputMode, setInputMode] = useState<'file' | 'text' | 'url'>('file')
  const [pastedText, setPastedText] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [isLoadingUrl, setIsLoadingUrl] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Ustaw zapisany klucz API jeśli jest dostępny
  useEffect(() => {
    if (savedApiKey && !apiKey) {
      setApiKey(savedApiKey)
    }
  }, [savedApiKey])

  const extractTextFromFile = async (file: File): Promise<string> => {
    const extension = file.name.split('.').pop()?.toLowerCase()

    switch (extension) {
      case 'txt':
      case 'html':
      case 'xml':
        return await file.text()

      case 'docx':
        const arrayBuffer = await file.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer })
        return result.value

      case 'xlsx':
      case 'xls':
        const xlsxBuffer = await file.arrayBuffer()
        const workbook = XLSX.read(xlsxBuffer, { type: 'array' })
        let xlsxText = ''
        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName]
          xlsxText += XLSX.utils.sheet_to_txt(sheet) + '\n'
        })
        return xlsxText

      default:
        throw new Error(`Nieobsługiwany format pliku: ${extension}`)
    }
  }

  const handleFile = async (file: File) => {
    if (!apiKey.trim()) {
      alert('Proszę podać klucz API Anthropic')
      return
    }

    try {
      const text = await extractTextFromFile(file)

      if (text.length < 100) {
        alert('Dokument jest zbyt krótki do analizy')
        return
      }

      if (text.length > 200000) {
        alert(`Dokument jest zbyt długi (${text.length.toLocaleString()} znaków).\n\nMaksymalna długość: 200,000 znaków (ok. 100 stron).\n\nPodziel dokument na mniejsze fragmenty i przetwarzaj je osobno.`)
        return
      }

      await onExtract(text, file.name, apiKey)
    } catch (error) {
      console.error('Error processing file:', error)
      alert('Błąd podczas przetwarzania pliku: ' + (error as Error).message)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const handleTextSubmit = async () => {
    if (!apiKey.trim()) {
      alert('Proszę podać klucz API Anthropic')
      return
    }

    if (!pastedText.trim()) {
      alert('Proszę wkleić tekst do analizy')
      return
    }

    if (pastedText.length < 50) {
      alert('Tekst jest zbyt krótki do analizy (minimum 50 znaków)')
      return
    }

    if (pastedText.length > 200000) {
      alert(`Tekst jest zbyt długi (${pastedText.length.toLocaleString()} znaków).\n\nMaksymalna długość: 200,000 znaków (ok. 100 stron).\n\nPodziel tekst na mniejsze fragmenty i przetwarzaj je osobno.`)
      return
    }

    await onExtract(pastedText, 'Wklejony tekst', apiKey)
  }

  const handleUrlSubmit = async () => {
    if (!apiKey.trim()) {
      alert('Proszę podać klucz API Anthropic')
      return
    }

    if (!urlInput.trim()) {
      alert('Proszę podać URL dokumentu')
      return
    }

    // Podstawowa walidacja URL
    try {
      new URL(urlInput.trim())
    } catch (e) {
      alert('Nieprawidłowy format URL. Upewnij się, że URL zaczyna się od http:// lub https://')
      return
    }

    setIsLoadingUrl(true)

    try {
      const response = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: urlInput.trim() })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Błąd pobierania dokumentu')
      }

      const text = data.text

      if (text.length < 100) {
        alert('Pobrany dokument jest zbyt krótki do analizy')
        return
      }

      if (text.length > 200000) {
        alert(`Pobrany dokument jest zbyt długi (${text.length.toLocaleString()} znaków).\n\nMaksymalna długość: 200,000 znaków (ok. 100 stron).\n\nPodziel dokument na mniejsze fragmenty i przetwarzaj je osobno.`)
        return
      }

      // Wyciągnij nazwę pliku z URL
      const urlObj = new URL(urlInput.trim())
      const pathParts = urlObj.pathname.split('/')
      const lastPart = pathParts[pathParts.length - 1] || urlObj.hostname
      const fileName = lastPart || 'Dokument z URL'

      await onExtract(text, fileName, apiKey)
    } catch (error) {
      console.error('Error fetching URL:', error)
      alert('Błąd podczas pobierania dokumentu: ' + (error as Error).message)
    } finally {
      setIsLoadingUrl(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">
        1. Załaduj dokument
      </h2>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Klucz API Anthropic
          </label>
          {savedApiKey && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Zapisany
            </span>
          )}
        </div>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-500 mt-1">
          Pobierz klucz z{' '}
          <a
            href="https://console.anthropic.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            console.anthropic.com
          </a>
          {' • '}Klucz jest automatycznie zapisywany lokalnie
        </p>
        <p className="text-xs text-gray-500 mt-2">
          <strong>Limity:</strong> Maksymalnie 200,000 znaków (~100 stron).
          Dla dokumentów {'>'}50 stron wymagany jest Vercel Pro plan (maxDuration: 300s).
        </p>
      </div>

      {/* Zakładki - przełącznik między plikiem, URL i tekstem */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setInputMode('file')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
            inputMode === 'file'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          disabled={isLoading || isLoadingUrl}
        >
          Załaduj plik
        </button>
        <button
          onClick={() => setInputMode('url')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
            inputMode === 'url'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          disabled={isLoading || isLoadingUrl}
        >
          HTML z URL
        </button>
        <button
          onClick={() => setInputMode('text')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
            inputMode === 'text'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          disabled={isLoading || isLoadingUrl}
        >
          Wklej tekst
        </button>
      </div>

      {/* Tryb: Upload pliku */}
      {inputMode === 'file' && (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".txt,.html,.docx,.xlsx,.xls,.xml"
            onChange={handleChange}
            disabled={isLoading}
          />

          <svg
            className="mx-auto h-12 w-12 text-gray-400 mb-4"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <p className="text-lg text-gray-700 mb-2">
            {isLoading ? 'Przetwarzanie...' : 'Przeciągnij plik tutaj lub kliknij, aby wybrać'}
          </p>

          <p className="text-sm text-gray-500">
            Obsługiwane formaty: TXT, HTML, DOCX, XLSX, XML
          </p>
        </div>
      )}

      {/* Tryb: URL */}
      {inputMode === 'url' && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL dokumentu HTML/XML
            </label>
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://eur-lex.europa.eu/legal-content/PL/TXT/HTML/..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading || isLoadingUrl}
            />
            <p className="text-xs text-gray-500 mt-2">
              <strong>Przykłady:</strong> EUR-Lex, HUDOC (ECHR), akty prawne, dokumenty XML
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800 mb-2">
              <strong>ℹ️ Informacja:</strong> System automatycznie pobierze HTML, usunie tagi i wyekstrahuje czysty tekst do analizy.
            </p>
            <p className="text-xs text-blue-700">
              <strong>Uwaga:</strong> Najlepiej działa ze statycznymi stronami HTML. Strony generowane dynamicznie przez JavaScript mogą nie załadować się poprawnie.
            </p>
          </div>

          <button
            onClick={handleUrlSubmit}
            disabled={isLoading || isLoadingUrl || !urlInput.trim()}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoadingUrl ? 'Pobieranie dokumentu...' : isLoading ? 'Przetwarzanie...' : 'Pobierz i analizuj'}
          </button>
        </div>
      )}

      {/* Tryb: Wklej tekst */}
      {inputMode === 'text' && (
        <div className="space-y-3">
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder="Wklej tutaj tekst do analizy...&#10;&#10;Przykład:&#10;Art. 1. Ustawa reguluje zasady ochrony danych osobowych.&#10;Każdy ma prawo do ochrony prywatności.&#10;Administrator danych jest zobowiązany do przetwarzania danych zgodnie z RODO."
            className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y font-mono text-sm"
            disabled={isLoading}
          />

          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              {pastedText.length.toLocaleString()} znaków
              {pastedText.length > 0 && pastedText.length < 50 && (
                <span className="text-orange-600 ml-2">(minimum 50 znaków)</span>
              )}
              {pastedText.length > 200000 && (
                <span className="text-red-600 ml-2 font-semibold">(przekroczono limit!)</span>
              )}
              {pastedText.length > 100000 && pastedText.length <= 200000 && (
                <span className="text-orange-600 ml-2">(duży dokument - może trwać dłużej)</span>
              )}
            </span>
            <span className="text-xs text-gray-500">
              Maksymalnie 200,000 znaków (ok. 100 stron)
            </span>
          </div>

          <button
            onClick={handleTextSubmit}
            disabled={isLoading || !pastedText.trim() || pastedText.length < 50 || pastedText.length > 200000}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Przetwarzanie...' : 'Analizuj tekst'}
          </button>
        </div>
      )}
    </div>
  )
}
