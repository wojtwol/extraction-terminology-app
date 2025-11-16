'use client'

import { useLanguage } from '@/contexts/LanguageContext'

interface ModeSelectorProps {
  onSelectMode: (mode: 'monolingual' | 'bilingual') => void
}

export default function ModeSelector({ onSelectMode }: ModeSelectorProps) {
  const { language } = useLanguage()

  const translations = {
    pl: {
      title: 'Wybierz tryb glosariusza',
      subtitle: 'Jaki rodzaj glosariusza chcesz utworzyć?',
      monolingual: 'Glosariusz jednojęzyczny',
      monolingualDesc: 'Ekstrakcja terminologii z jednego dokumentu w jednym języku',
      bilingual: 'Glosariusz dwujęzyczny',
      bilingualDesc: 'Ekstrakcja i dopasowanie terminologii z dwóch wersji językowych tego samego dokumentu',
      monoFeatures: [
        'Jeden dokument źródłowy',
        'Automatyczna ekstrakcja terminów',
        'Generowanie definicji AI',
        'Eksport w wielu formatach'
      ],
      biFeatures: [
        'Dwa dokumenty w różnych językach',
        'Automatyczne dopasowywanie ekwiwalentów',
        'Wsparcie dla 30+ języków',
        'Dwujęzyczny eksport'
      ]
    },
    en: {
      title: 'Select glossary mode',
      subtitle: 'What type of glossary do you want to create?',
      monolingual: 'Monolingual Glossary',
      monolingualDesc: 'Extract terminology from a single document in one language',
      bilingual: 'Bilingual Glossary',
      bilingualDesc: 'Extract and match terminology from two language versions of the same document',
      monoFeatures: [
        'Single source document',
        'Automatic term extraction',
        'AI-powered definitions',
        'Export in multiple formats'
      ],
      biFeatures: [
        'Two documents in different languages',
        'Automatic equivalent matching',
        'Support for 30+ languages',
        'Bilingual export'
      ]
    }
  }

  const t = translations[language as 'pl' | 'en']

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-8 animate-fadeIn">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">{t.title}</h2>
        <p className="text-gray-600 mb-8">{t.subtitle}</p>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Monolingual Card */}
          <button
            onClick={() => onSelectMode('monolingual')}
            className="group relative bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border-2 border-blue-200 hover:border-blue-400 rounded-xl p-6 text-left transition-all duration-300 hover:shadow-xl hover:scale-105"
          >
            <div className="flex items-start mb-4">
              <div className="bg-blue-500 text-white rounded-lg p-3 mr-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-800 mb-2">{t.monolingual}</h3>
                <p className="text-sm text-gray-600 mb-4">{t.monolingualDesc}</p>
              </div>
            </div>

            <ul className="space-y-2">
              {t.monoFeatures.map((feature, idx) => (
                <li key={idx} className="flex items-center text-sm text-gray-700">
                  <svg className="w-4 h-4 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>

            <div className="mt-6 text-blue-600 font-semibold flex items-center group-hover:translate-x-2 transition-transform">
              {language === 'pl' ? 'Wybierz' : 'Select'}
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </button>

          {/* Bilingual Card */}
          <button
            onClick={() => onSelectMode('bilingual')}
            className="group relative bg-gradient-to-br from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 border-2 border-purple-200 hover:border-purple-400 rounded-xl p-6 text-left transition-all duration-300 hover:shadow-xl hover:scale-105"
          >
            <div className="flex items-start mb-4">
              <div className="bg-purple-500 text-white rounded-lg p-3 mr-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-800 mb-2">{t.bilingual}</h3>
                <p className="text-sm text-gray-600 mb-4">{t.bilingualDesc}</p>
              </div>
            </div>

            <ul className="space-y-2">
              {t.biFeatures.map((feature, idx) => (
                <li key={idx} className="flex items-center text-sm text-gray-700">
                  <svg className="w-4 h-4 text-purple-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>

            <div className="mt-6 text-purple-600 font-semibold flex items-center group-hover:translate-x-2 transition-transform">
              {language === 'pl' ? 'Wybierz' : 'Select'}
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
