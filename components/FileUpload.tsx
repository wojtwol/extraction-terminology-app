'use client'

import { useState, useRef } from 'react'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'

interface FileUploadProps {
  onExtract: (text: string, filename: string, apiKey: string) => void
  isLoading: boolean
}

export default function FileUpload({ onExtract, isLoading }: FileUploadProps) {
  const [apiKey, setApiKey] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [inputMode, setInputMode] = useState<'file' | 'text'>('file')
  const [pastedText, setPastedText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      onExtract(text, file.name, apiKey)
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

  const handleTextSubmit = () => {
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

    onExtract(pastedText, 'Wklejony tekst', apiKey)
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">
        1. Załaduj dokument
      </h2>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Klucz API Anthropic
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-500 mt-1">
          Pobierz klucz API z{' '}
          <a
            href="https://console.anthropic.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            console.anthropic.com
          </a>
        </p>
      </div>

      {/* Zakładki - przełącznik między plikiem a tekstem */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setInputMode('file')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
            inputMode === 'file'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          disabled={isLoading}
        >
          Załaduj plik
        </button>
        <button
          onClick={() => setInputMode('text')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
            inputMode === 'text'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          disabled={isLoading}
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
              {pastedText.length} znaków
              {pastedText.length > 0 && pastedText.length < 50 && (
                <span className="text-orange-600 ml-2">(minimum 50 znaków)</span>
              )}
            </span>
            {pastedText.length > 100000 && (
              <span className="text-orange-600">
                Tekst zostanie skrócony do 100,000 znaków
              </span>
            )}
          </div>

          <button
            onClick={handleTextSubmit}
            disabled={isLoading || !pastedText.trim() || pastedText.length < 50}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Przetwarzanie...' : 'Analizuj tekst'}
          </button>
        </div>
      )}
    </div>
  )
}
