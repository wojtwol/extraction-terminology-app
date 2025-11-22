'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'

interface BilingualFileUploadProps {
  onExtract: (sourceText: string, targetText: string, sourceLang: string, targetLang: string, sourceFileName: string, targetFileName: string) => void
  isLoading: boolean
  savedApiKey: string | null
  clearTrigger?: number  // Trigger do czyszczenia pól
}

type InputMode = 'file' | 'text' | 'url'

export default function BilingualFileUpload({ onExtract, isLoading, savedApiKey, clearTrigger }: BilingualFileUploadProps) {
  const { language, t } = useLanguage()

  const [apiKey, setApiKey] = useState(savedApiKey || '')

  // Source document states
  const [sourceInputMode, setSourceInputMode] = useState<InputMode>('file')
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [sourceText, setSourceText] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceDocumentTitle, setSourceDocumentTitle] = useState<string>('')
  const [sourceLang, setSourceLang] = useState<string>('')
  const [detectingSourceLang, setDetectingSourceLang] = useState(false)
  const [loadingSourceUrl, setLoadingSourceUrl] = useState(false)

  // Target document states
  const [targetInputMode, setTargetInputMode] = useState<InputMode>('file')
  const [targetFile, setTargetFile] = useState<File | null>(null)
  const [targetText, setTargetText] = useState('')
  const [targetUrl, setTargetUrl] = useState('')
  const [targetDocumentTitle, setTargetDocumentTitle] = useState<string>('')
  const [targetLang, setTargetLang] = useState<string>('')
  const [detectingTargetLang, setDetectingTargetLang] = useState(false)
  const [loadingTargetUrl, setLoadingTargetUrl] = useState(false)

  const [sourceLanguage, setSourceLanguage] = useState<'source' | 'target'>('source')

  // Wyczyść pola gdy clearTrigger się zmieni
  useEffect(() => {
    if (clearTrigger !== undefined && clearTrigger > 0) {
      setSourceUrl('')
      setTargetUrl('')
      setSourceText('')
      setTargetText('')
      setSourceDocumentTitle('')
      setTargetDocumentTitle('')
      console.log('🧹 BilingualFileUpload: Wyczyszczono pola URL i tekst')
    }
  }, [clearTrigger])

  const translations = {
    pl: {
      title: 'Załaduj dokumenty dwujęzyczne',
      apiKey: 'Klucz API Anthropic (wymagany)',
      apiKeyHint: 'Pobierz klucz z',
      sourceDoc: 'Dokument źródłowy',
      targetDoc: 'Dokument docelowy',
      uploadFile: 'Plik',
      enterUrl: 'URL',
      pasteText: 'Tekst',
      dragDrop: 'Przeciągnij i upuść plik lub kliknij',
      formats: 'TXT, HTML, DOCX, XLSX, XLS, XML',
      detecting: 'Wykrywanie języka...',
      detected: 'Wykryto',
      selectSource: 'Wybierz język źródłowy',
      sourceIsSource: 'Ten dokument jest źródłem',
      sourceIsTarget: 'Ten dokument jest celem',
      analyze: 'Analizuj dokumenty',
      analyzing: 'Przetwarzanie...',
      bothRequired: 'Wymagane oba dokumenty',
      apiRequired: 'Proszę podać klucz API Anthropic',
      urlLabel: 'URL dokumentu HTML/XML',
      urlPlaceholder: 'https://example.com/document.html',
      fetchDocument: 'Pobierz dokument',
      fetching: 'Pobieranie...',
      pasteTextLabel: 'znaków',
      minChars: 'Minimum 50 znaków',
      analyzeText: 'Analizuj tekst'
    },
    en: {
      title: 'Upload bilingual documents',
      apiKey: 'Anthropic API Key (required)',
      apiKeyHint: 'Get your key from',
      sourceDoc: 'Source Document',
      targetDoc: 'Target Document',
      uploadFile: 'File',
      enterUrl: 'URL',
      pasteText: 'Text',
      dragDrop: 'Drag and drop file or click',
      formats: 'TXT, HTML, DOCX, XLSX, XLS, XML',
      detecting: 'Detecting language...',
      detected: 'Detected',
      selectSource: 'Select source language',
      sourceIsSource: 'This document is the source',
      sourceIsTarget: 'This document is the target',
      analyze: 'Analyze documents',
      analyzing: 'Processing...',
      bothRequired: 'Both documents are required',
      apiRequired: 'Please provide Anthropic API key',
      urlLabel: 'HTML/XML Document URL',
      urlPlaceholder: 'https://example.com/document.html',
      fetchDocument: 'Fetch document',
      fetching: 'Fetching...',
      pasteTextLabel: 'characters',
      minChars: 'Minimum 50 characters',
      analyzeText: 'Analyze text'
    }
  }

  const txt = translations[language as 'pl' | 'en']

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
        throw new Error(`Unsupported file format: ${extension}`)
    }
  }

  const detectLanguage = async (text: string, type: 'source' | 'target') => {
    if (type === 'source') setDetectingSourceLang(true)
    else setDetectingTargetLang(true)

    try {
      const response = await fetch('/api/detect-language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 10000) })
      })

      const data = await response.json()

      if (data.language) {
        if (type === 'source') {
          setSourceLang(data.language)
        } else {
          setTargetLang(data.language)
        }
      }
    } catch (error) {
      console.error('Error detecting language:', error)
    } finally {
      if (type === 'source') setDetectingSourceLang(false)
      else setDetectingTargetLang(false)
    }
  }

  const handleFileSelect = async (file: File, type: 'source' | 'target') => {
    try {
      const text = await extractTextFromFile(file)

      if (type === 'source') {
        setSourceFile(file)
        await detectLanguage(text, 'source')
      } else {
        setTargetFile(file)
        await detectLanguage(text, 'target')
      }
    } catch (error) {
      console.error('Error processing file:', error)
      alert((language === 'pl' ? 'Błąd przetwarzania pliku: ' : 'Error processing file: ') + (error as Error).message)
    }
  }

  const handleUrlFetch = async (type: 'source' | 'target') => {
    const url = type === 'source' ? sourceUrl : targetUrl

    if (!url.trim()) {
      alert(language === 'pl' ? 'Proszę podać URL' : 'Please provide URL')
      return
    }

    try {
      new URL(url.trim())
    } catch (e) {
      alert(language === 'pl'
        ? 'Nieprawidłowy format URL'
        : 'Invalid URL format')
      return
    }

    if (type === 'source') setLoadingSourceUrl(true)
    else setLoadingTargetUrl(true)

    try {
      const response = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error fetching document')
      }

      const text = data.text
      const documentTitle = data.documentTitle

      if (text.length < 100) {
        alert(language === 'pl' ? 'Dokument jest zbyt krótki' : 'Document is too short')
        return
      }

      if (type === 'source') {
        setSourceText(text)
        setSourceFile(null)
        setSourceDocumentTitle(documentTitle || new URL(url.trim()).hostname)
        await detectLanguage(text, 'source')
      } else {
        setTargetText(text)
        setTargetFile(null)
        setTargetDocumentTitle(documentTitle || new URL(url.trim()).hostname)
        await detectLanguage(text, 'target')
      }
    } catch (error) {
      console.error('Error fetching URL:', error)
      alert((language === 'pl' ? 'Błąd pobierania: ' : 'Fetch error: ') + (error as Error).message)
    } finally {
      if (type === 'source') setLoadingSourceUrl(false)
      else setLoadingTargetUrl(false)
    }
  }

  const handleAnalyze = async () => {
    if (!apiKey) {
      alert(txt.apiRequired)
      return
    }

    // Zbierz teksty z różnych źródeł
    let finalSourceText = ''
    let finalTargetText = ''
    let sourceFileName = ''
    let targetFileName = ''

    // Source document
    if (sourceInputMode === 'file' && sourceFile) {
      finalSourceText = await extractTextFromFile(sourceFile)
      sourceFileName = sourceFile.name
    } else if (sourceInputMode === 'text' && sourceText.trim()) {
      finalSourceText = sourceText
      sourceFileName = language === 'pl' ? 'Wklejony tekst' : 'Pasted text'
    } else if (sourceInputMode === 'url' && sourceText) {
      finalSourceText = sourceText
      // Użyj zapisanego tytułu dokumentu (z API) lub fallback do hostname
      sourceFileName = sourceDocumentTitle || new URL(sourceUrl.trim()).hostname
    } else {
      alert(txt.bothRequired)
      return
    }

    // Target document
    if (targetInputMode === 'file' && targetFile) {
      finalTargetText = await extractTextFromFile(targetFile)
      targetFileName = targetFile.name
    } else if (targetInputMode === 'text' && targetText.trim()) {
      finalTargetText = targetText
      targetFileName = language === 'pl' ? 'Wklejony tekst' : 'Pasted text'
    } else if (targetInputMode === 'url' && targetText) {
      finalTargetText = targetText
      // Użyj zapisanego tytułu dokumentu (z API) lub fallback do hostname
      targetFileName = targetDocumentTitle || new URL(targetUrl.trim()).hostname
    } else {
      alert(txt.bothRequired)
      return
    }

    if (!finalSourceText || !finalTargetText) {
      alert(txt.bothRequired)
      return
    }

    // Zapisz klucz API
    localStorage.setItem('anthropic_api_key', apiKey)

    // Określ który dokument jest source a który target
    if (sourceLanguage === 'source') {
      onExtract(finalSourceText, finalTargetText, sourceLang, targetLang, sourceFileName, targetFileName)
    } else {
      onExtract(finalTargetText, finalSourceText, targetLang, sourceLang, targetFileName, sourceFileName)
    }
  }

  const renderDocumentInput = (
    type: 'source' | 'target',
    inputMode: InputMode,
    setInputMode: (mode: InputMode) => void,
    file: File | null,
    text: string,
    setText: (text: string) => void,
    url: string,
    setUrl: (url: string) => void,
    lang: string,
    detecting: boolean,
    loadingUrl: boolean
  ) => {
    const isSource = (type === 'source' && sourceLanguage === 'source') || (type === 'target' && sourceLanguage === 'target')
    const borderColor = isSource ? 'border-blue-400 bg-blue-50' : 'border-purple-400 bg-purple-50'
    const dotColor = isSource ? 'bg-blue-500' : 'bg-purple-500'
    const label = isSource ? txt.sourceDoc : txt.targetDoc

    return (
      <div className={`border-2 rounded-xl p-6 transition-all ${borderColor}`}>
        <h3 className="font-semibold mb-3 flex items-center">
          <span className={`inline-block w-3 h-3 rounded-full mr-2 ${dotColor}`}></span>
          {label}
        </h3>

        {/* Mode selector */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setInputMode('file')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              inputMode === 'file'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
            disabled={isLoading}
          >
            {txt.uploadFile}
          </button>
          <button
            onClick={() => setInputMode('url')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              inputMode === 'url'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
            disabled={isLoading}
          >
            {txt.enterUrl}
          </button>
          <button
            onClick={() => setInputMode('text')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              inputMode === 'text'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
            disabled={isLoading}
          >
            {txt.pasteText}
          </button>
        </div>

        {/* File mode */}
        {inputMode === 'file' && (
          <label className="block">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 cursor-pointer transition-colors bg-white">
              <input
                type="file"
                accept=".txt,.html,.docx,.xlsx,.xls,.xml"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0], type)}
                className="hidden"
                disabled={isLoading}
              />
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-gray-600 mb-1">{txt.dragDrop}</p>
              <p className="text-xs text-gray-500">{txt.formats}</p>
            </div>
          </label>
        )}

        {/* URL mode */}
        {inputMode === 'url' && (
          <div className="space-y-3">
            <input
              type="text"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={txt.urlPlaceholder}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              disabled={isLoading || loadingUrl}
              autoComplete="off"
              data-form-type="other"
              data-lpignore="true"
              name="bilingual-url-input"
            />
            <button
              onClick={() => handleUrlFetch(type)}
              disabled={isLoading || loadingUrl || !url.trim()}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loadingUrl ? txt.fetching : txt.fetchDocument}
            </button>
          </div>
        )}

        {/* Text mode */}
        {inputMode === 'text' && (
          <div className="space-y-2">
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                if (e.target.value.length >= 100) {
                  detectLanguage(e.target.value, type)
                }
              }}
              placeholder={language === 'pl' ? 'Wklej tekst tutaj...' : 'Paste text here...'}
              className="w-full h-48 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y font-mono text-sm bg-white"
              disabled={isLoading}
            />
            <div className="text-xs text-gray-600">
              {text.length.toLocaleString()} {txt.pasteTextLabel}
              {text.length > 0 && text.length < 50 && (
                <span className="text-orange-600 ml-2">({txt.minChars})</span>
              )}
            </div>
          </div>
        )}

        {/* Status */}
        {(file || (inputMode === 'url' && text) || (inputMode === 'text' && text.length >= 50)) && (
          <div className="mt-4 p-3 bg-white rounded-lg border border-gray-200">
            {file && <p className="text-sm font-medium text-gray-700 truncate mb-1">{file.name}</p>}
            {detecting ? (
              <p className="text-xs text-gray-500">{txt.detecting}</p>
            ) : lang ? (
              <p className="text-xs text-green-600">{txt.detected}: {lang}</p>
            ) : null}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
      <h2 className="text-2xl font-semibold mb-6 text-gray-800">{txt.title}</h2>

      {/* API Key */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {txt.apiKey}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="sk-ant-..."
        />
        <p className="text-xs text-gray-500 mt-1">
          {txt.apiKeyHint}{' '}
          <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            console.anthropic.com
          </a>
        </p>
      </div>

      {/* Document Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">{txt.selectSource}</label>
        <div className="flex gap-4">
          <button
            onClick={() => setSourceLanguage('source')}
            className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
              sourceLanguage === 'source'
                ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
            }`}
          >
            ← {txt.sourceIsSource}
          </button>
          <button
            onClick={() => setSourceLanguage('target')}
            className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
              sourceLanguage === 'target'
                ? 'border-purple-500 bg-purple-50 text-purple-700 font-semibold'
                : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
            }`}
          >
            {txt.sourceIsTarget} →
          </button>
        </div>
      </div>

      {/* Dual Document Input */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {renderDocumentInput(
          'source',
          sourceInputMode,
          setSourceInputMode,
          sourceFile,
          sourceText,
          setSourceText,
          sourceUrl,
          setSourceUrl,
          sourceLang,
          detectingSourceLang,
          loadingSourceUrl
        )}

        {renderDocumentInput(
          'target',
          targetInputMode,
          setTargetInputMode,
          targetFile,
          targetText,
          setTargetText,
          targetUrl,
          setTargetUrl,
          targetLang,
          detectingTargetLang,
          loadingTargetUrl
        )}
      </div>

      {/* Analyze Button */}
      <button
        onClick={handleAnalyze}
        disabled={isLoading || loadingSourceUrl || loadingTargetUrl || !apiKey}
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
      >
        {isLoading ? txt.analyzing : txt.analyze}
      </button>
    </div>
  )
}
