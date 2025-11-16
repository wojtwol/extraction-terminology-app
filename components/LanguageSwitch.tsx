'use client'

import { useLanguage } from '@/contexts/LanguageContext'

export default function LanguageSwitch() {
  const { language, setLanguage } = useLanguage()

  return (
    <div className="flex items-center gap-2 bg-white rounded-lg shadow-md px-3 py-2">
      <button
        onClick={() => setLanguage('pl')}
        className={`px-3 py-1.5 rounded transition-all text-sm font-medium ${
          language === 'pl'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
        title="Polski"
      >
        🇵🇱 PL
      </button>
      <button
        onClick={() => setLanguage('en')}
        className={`px-3 py-1.5 rounded transition-all text-sm font-medium ${
          language === 'en'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
        title="English"
      >
        🇬🇧 EN
      </button>
    </div>
  )
}
