import { franc } from 'franc-min'

// Mapowanie kodów ISO 639-3 na pełne nazwy języków UE
const EU_LANGUAGES: Record<string, string> = {
  'bul': 'Bułgarski',
  'hrv': 'Chorwacki',
  'ces': 'Czeski',
  'dan': 'Duński',
  'nld': 'Niderlandzki',
  'eng': 'Angielski',
  'est': 'Estoński',
  'fin': 'Fiński',
  'fra': 'Francuski',
  'deu': 'Niemiecki',
  'ell': 'Grecki',
  'hun': 'Węgierski',
  'gle': 'Irlandzki',
  'ita': 'Włoski',
  'lav': 'Łotewski',
  'lit': 'Litewski',
  'mlt': 'Maltański',
  'pol': 'Polski',
  'por': 'Portugalski',
  'ron': 'Rumuński',
  'slk': 'Słowacki',
  'slv': 'Słoweński',
  'spa': 'Hiszpański',
  'swe': 'Szwedzki'
}

// Mapowanie nazw na kody ISO dla Claude
const LANGUAGE_TO_ISO: Record<string, string> = {
  'Bułgarski': 'bul',
  'Chorwacki': 'hrv',
  'Czeski': 'ces',
  'Duński': 'dan',
  'Niderlandzki': 'nld',
  'Angielski': 'eng',
  'Estoński': 'est',
  'Fiński': 'fin',
  'Francuski': 'fra',
  'Niemiecki': 'deu',
  'Grecki': 'ell',
  'Węgierski': 'hun',
  'Irlandzki': 'gle',
  'Włoski': 'ita',
  'Łotewski': 'lav',
  'Litewski': 'lit',
  'Maltański': 'mlt',
  'Polski': 'pol',
  'Portugalski': 'por',
  'Rumuński': 'ron',
  'Słowacki': 'slk',
  'Słoweński': 'slv',
  'Hiszpański': 'spa',
  'Szwedzki': 'swe'
}

export interface LanguageDetectionResult {
  language: string
  languageCode: string
  confidence: 'high' | 'medium' | 'low'
  detectionMethod: string
}

/**
 * Wykrywa język dokumentu używając franc-min (bazuje na n-gramach)
 * Obsługuje wszystkie 24 języki urzędowe UE
 */
export function detectLanguage(text: string): LanguageDetectionResult {
  // Użyj większej próbki dla lepszej dokładności
  const sampleSize = Math.min(10000, text.length)
  const sample = text.slice(0, sampleSize)

  console.log(`🔍 Wykrywanie języka (próbka: ${sampleSize} znaków)...`)

  // franc zwraca kod ISO 639-3
  const detectedCode = franc(sample, { minLength: 10 })

  console.log(`   Wykryty kod: ${detectedCode}`)

  // Sprawdź czy to język UE
  if (detectedCode === 'und') {
    console.log('❌ Nie można wykryć języka')
    return {
      language: 'Nieznany',
      languageCode: 'und',
      confidence: 'low',
      detectionMethod: 'franc-min (failed)'
    }
  }

  const languageName = EU_LANGUAGES[detectedCode]

  if (languageName) {
    console.log(`✅ Wykryto: ${languageName} (${detectedCode})`)
    return {
      language: languageName,
      languageCode: detectedCode,
      confidence: sampleSize >= 1000 ? 'high' : 'medium',
      detectionMethod: 'franc-min (n-gram analysis)'
    }
  } else {
    console.log(`⚠️  Wykryto język spoza UE: ${detectedCode}`)
    // Zwróć oryginalny kod jeśli nie jest językiem UE
    return {
      language: `Inny (${detectedCode})`,
      languageCode: detectedCode,
      confidence: 'medium',
      detectionMethod: 'franc-min (non-EU language)'
    }
  }
}

/**
 * Sprawdza czy wykryty język jest językiem urzędowym UE
 */
export function isEULanguage(languageCode: string): boolean {
  return languageCode in EU_LANGUAGES
}

/**
 * Pobiera kod ISO dla nazwy języka
 */
export function getLanguageCode(languageName: string): string | undefined {
  return LANGUAGE_TO_ISO[languageName]
}

/**
 * Pobiera nazwę języka dla kodu ISO
 */
export function getLanguageName(languageCode: string): string | undefined {
  return EU_LANGUAGES[languageCode]
}
