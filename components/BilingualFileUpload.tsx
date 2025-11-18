'use client'

import { useState } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { getSupportedLanguages } from '@/utils/languageDetector'

interface BilingualFileUploadProps {
  onExtract: (sourceText: string, targetText: string, sourceLang: string, targetLang: string, sourceFileName: string, targetFileName: string) => void
  isLoading: boolean
  savedApiKey: string | null
}

export default function BilingualFileUpload({ onExtract, isLoading, savedApiKey }: BilingualFileUploadProps) {
  const { language, t } = useLanguage()

  const [apiKey, setApiKey] = useState(savedApiKey || '')
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [targetFile, setTargetFile] = useState<File | null>(null)
  const [sourceLang, setSourceLang] = useState<string>('')
  const [targetLang, setTargetLang] = useState<string>('')
  const [detectingSourceLang, setDetectingSourceLang] = useState(false)
  const [detectingTargetLang, setDetectingTargetLang] = useState(false)
  const [sourceLanguage, setSourceLanguage] = useState<'source' | 'target'>('source')

  // Lista obsługiwanych języków
  const supportedLanguages = getSupportedLanguages()

  const translations = {
    pl: {
      title: 'Załaduj dokumenty dwujęzyczne',
      apiKey: 'Klucz API Anthropic (wymagany)',
      apiKeyHint: 'Pobierz klucz z',
      sourceDoc: 'Dokument źródłowy',
      targetDoc: 'Dokument docelowy',
      dragDrop: 'Przeciągnij i upuść plik tutaj lub kliknij, aby wybrać',
      formats: 'Obsługiwane formaty: TXT, HTML, DOCX, XLSX, XML',
      detecting: 'Wykrywanie języka...',
      detected: 'Wykryto',
      selectLang: 'Wybierz język',
      correctLang: 'Skoryguj język jeśli niepoprawny',
      selectSource: 'Wybierz język źródłowy',
      sourceIsSource: 'Ten dokument jest źródłem',
      sourceIsTarget: 'Ten dokument jest celem',
      analyze: 'Analizuj dokumenty',
      analyzing: 'Przetwarzanie...',
      bothRequired: 'Wymagane oba dokumenty',
      apiRequired: 'Proszę podać klucz API Anthropic'
    },
    en: {
      title: 'Upload bilingual documents',
      apiKey: 'Anthropic API Key (required)',
      apiKeyHint: 'Get your key from',
      sourceDoc: 'Source Document',
      targetDoc: 'Target Document',
      dragDrop: 'Drag and drop file here or click to select',
      formats: 'Supported formats: TXT, HTML, DOCX, XLSX, XML',
      detecting: 'Detecting language...',
      detected: 'Detected',
      selectLang: 'Select language',
      correctLang: 'Correct language if needed',
      selectSource: 'Select source language',
      sourceIsSource: 'This document is the source',
      sourceIsTarget: 'This document is the target',
      analyze: 'Analyze documents',
      analyzing: 'Processing...',
      bothRequired: 'Both documents are required',
      apiRequired: 'Please provide Anthropic API key'
    }
  }

  const txt = translations[language as 'pl' | 'en']

  const handleFileSelect = async (file: File, type: 'source' | 'target') => {
    if (type === 'source') {
      setSourceFile(file)
      await detectLanguage(file, 'source')
    } else {
      setTargetFile(file)
      await detectLanguage(file, 'target')
    }
  }

  const detectLanguage = async (file: File, type: 'source' | 'target') => {
    if (type === 'source') setDetectingSourceLang(true)
    else setDetectingTargetLang(true)

    try {
      const text = await file.text()
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

  const handleAnalyze = async () => {
    if (!apiKey) {
      alert(txt.apiRequired)
      return
    }

    if (!sourceFile || !targetFile) {
      alert(txt.bothRequired)
      return
    }

    // Zapisz klucz API
    localStorage.setItem('anthropic_api_key', apiKey)

    const sourceText = await sourceFile.text()
    const targetText = await targetFile.text()

    // Określ który dokument jest source a który target na podstawie wyboru użytkownika
    if (sourceLanguage === 'source') {
      onExtract(sourceText, targetText, sourceLang, targetLang, sourceFile.name, targetFile.name)
    } else {
      onExtract(targetText, sourceText, targetLang, sourceLang, targetFile.name, sourceFile.name)
    }
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

      {/* Dual File Upload */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Source Document */}
        <div className={`border-2 rounded-xl p-6 transition-all ${
          sourceLanguage === 'source' ? 'border-blue-400 bg-blue-50' : 'border-purple-400 bg-purple-50'
        }`}>
          <h3 className="font-semibold mb-3 flex items-center">
            <span className={`inline-block w-3 h-3 rounded-full mr-2 ${
              sourceLanguage === 'source' ? 'bg-blue-500' : 'bg-purple-500'
            }`}></span>
            {sourceLanguage === 'source' ? txt.sourceDoc : txt.targetDoc}
          </h3>

          <label className="block">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 cursor-pointer transition-colors">
              <input
                type="file"
                accept=".txt,.html,.docx,.xlsx,.xml"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0], 'source')}
                className="hidden"
              />
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-gray-600 mb-1">{txt.dragDrop}</p>
              <p className="text-xs text-gray-500">{txt.formats}</p>
            </div>
          </label>

          {sourceFile && (
            <div className="mt-4 p-3 bg-white rounded-lg border border-gray-200">
              <p className="text-sm font-medium text-gray-700 truncate mb-2">{sourceFile.name}</p>
              {detectingSourceLang ? (
                <p className="text-xs text-gray-500 mt-1">{txt.detecting}</p>
              ) : (
                <div className="space-y-1">
                  {sourceLang && (
                    <p className="text-xs text-green-600">{txt.detected}: {sourceLang}</p>
                  )}
                  <label className="block">
                    <p className="text-xs text-gray-600 mb-1">{txt.correctLang}:</p>
                    <select
                      value={sourceLang}
                      onChange={(e) => setSourceLang(e.target.value)}
                      className="w-full text-sm px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">{txt.selectLang}</option>
                      {supportedLanguages.map(lang => (
                        <option key={lang.code} value={lang.name}>
                          {lang.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Target Document */}
        <div className={`border-2 rounded-xl p-6 transition-all ${
          sourceLanguage === 'target' ? 'border-blue-400 bg-blue-50' : 'border-purple-400 bg-purple-50'
        }`}>
          <h3 className="font-semibold mb-3 flex items-center">
            <span className={`inline-block w-3 h-3 rounded-full mr-2 ${
              sourceLanguage === 'target' ? 'bg-blue-500' : 'bg-purple-500'
            }`}></span>
            {sourceLanguage === 'target' ? txt.sourceDoc : txt.targetDoc}
          </h3>

          <label className="block">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 cursor-pointer transition-colors">
              <input
                type="file"
                accept=".txt,.html,.docx,.xlsx,.xml"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0], 'target')}
                className="hidden"
              />
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-gray-600 mb-1">{txt.dragDrop}</p>
              <p className="text-xs text-gray-500">{txt.formats}</p>
            </div>
          </label>

          {targetFile && (
            <div className="mt-4 p-3 bg-white rounded-lg border border-gray-200">
              <p className="text-sm font-medium text-gray-700 truncate mb-2">{targetFile.name}</p>
              {detectingTargetLang ? (
                <p className="text-xs text-gray-500 mt-1">{txt.detecting}</p>
              ) : (
                <div className="space-y-1">
                  {targetLang && (
                    <p className="text-xs text-green-600">{txt.detected}: {targetLang}</p>
                  )}
                  <label className="block">
                    <p className="text-xs text-gray-600 mb-1">{txt.correctLang}:</p>
                    <select
                      value={targetLang}
                      onChange={(e) => setTargetLang(e.target.value)}
                      className="w-full text-sm px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">{txt.selectLang}</option>
                      {supportedLanguages.map(lang => (
                        <option key={lang.code} value={lang.name}>
                          {lang.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Analyze Button */}
      <button
        onClick={handleAnalyze}
        disabled={isLoading || !sourceFile || !targetFile || !apiKey}
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
      >
        {isLoading ? txt.analyzing : txt.analyze}
      </button>
    </div>
  )
}
