import { franc } from 'franc-min'

// Mapowanie kodów ISO 639-3 na pełne nazwy języków
// Obejmuje: 24 języki urzędowe UE + dodatkowe (RU, UKR, serbski, turecki, arabski, albański)
const SUPPORTED_LANGUAGES: Record<string, string> = {
  // Języki UE (24)
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
  'swe': 'Szwedzki',
  // Dodatkowe języki
  'rus': 'Rosyjski',
  'ukr': 'Ukraiński',
  'srp': 'Serbski',
  'tur': 'Turecki',
  'arb': 'Arabski',
  'sqi': 'Albański'
}

// Mapowanie nazw na kody ISO dla Claude
const LANGUAGE_TO_ISO: Record<string, string> = {
  // Języki UE
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
  'Szwedzki': 'swe',
  // Dodatkowe języki
  'Rosyjski': 'rus',
  'Ukraiński': 'ukr',
  'Serbski': 'srp',
  'Turecki': 'tur',
  'Arabski': 'arb',
  'Albański': 'sqi'
}

export interface LanguageDetectionResult {
  language: string
  languageCode: string
  confidence: 'high' | 'medium' | 'low'
  detectionMethod: string
}

/**
 * Wykrywa język dokumentu używając franc-min (bazuje na n-gramach)
 * Obsługuje 30 języków: 24 języki UE + RU, UKR, serbski, turecki, arabski, albański
 */
export function detectLanguage(text: string, fileName?: string): LanguageDetectionResult {
  // Użyj większej próbki dla lepszej dokładności
  const sampleSize = Math.min(10000, text.length)
  const sample = text.slice(0, sampleSize)

  console.log(`🔍 Wykrywanie języka (próbka: ${sampleSize} znaków)...`)
  if (fileName) console.log(`   Plik: ${fileName}`)

  // Ograniczamy franc tylko do obsługiwanych języków dla lepszej dokładności
  const supportedCodes = Object.keys(SUPPORTED_LANGUAGES)

  // franc zwraca kod ISO 639-3
  let detectedCode = franc(sample, {
    minLength: 10,
    only: supportedCodes  // Ograniczamy tylko do naszych języków
  })

  console.log(`   Franc wykrył: ${detectedCode}`)

  // Heurystyka dla poprawienia wykrywania angielskiego vs portugalskiego
  // (franc czasem myli te języki w tekstach prawniczych z łacińskimi terminami)
  // UWAGA: Bazujemy tylko na treści, nie na nazwie pliku!
  if (detectedCode === 'por') {
    const englishIndicators = /\b(the|and|of|to|in|is|are|was|were|be|been|being|have|has|had|for|that|this|with|from|by|at|or|as|shall|may|must|should|would|could|will|can|court|law|case|section|article|act|statute|regulation|jurisdiction|plaintiff|defendant|judge|judgment|appeal|v\.|vs\.|versus)\b/gi
    const portugueseIndicators = /\b(o|a|os|as|um|uma|de|do|da|dos|das|em|no|na|nos|nas|para|por|com|sem|sobre|entre|pelo|pela|pelos|pelas|que|quando|onde|como|porque|artigo|lei|tribunal|juiz|caso|regulamento)\b/gi

    const englishMatches = (sample.match(englishIndicators) || []).length
    const portugueseMatches = (sample.match(portugueseIndicators) || []).length

    console.log(`   Sprawdzanie EN vs PT: EN=${englishMatches}, PT=${portugueseMatches}`)

    // Korekta tylko na podstawie analizy treści (nie nazwy pliku!)
    if (englishMatches > portugueseMatches) {
      console.log(`   ✅ Korekta: zmiana z portugalskiego na angielski (EN=${englishMatches} > PT=${portugueseMatches})`)
      detectedCode = 'eng'
    }
  }

  console.log(`   Ostateczny wynik: ${detectedCode}`)

  // Sprawdź czy to język obsługiwany
  if (detectedCode === 'und') {
    console.log('❌ Nie można wykryć języka')
    return {
      language: 'Nieznany',
      languageCode: 'und',
      confidence: 'low',
      detectionMethod: 'franc-min (failed)'
    }
  }

  const languageName = SUPPORTED_LANGUAGES[detectedCode]

  if (languageName) {
    console.log(`✅ Wykryto: ${languageName} (${detectedCode})`)
    return {
      language: languageName,
      languageCode: detectedCode,
      confidence: sampleSize >= 1000 ? 'high' : 'medium',
      detectionMethod: 'franc-min (n-gram analysis)'
    }
  } else {
    console.log(`⚠️  Wykryto język spoza listy obsługiwanych: ${detectedCode}`)
    // Zwróć oryginalny kod jeśli nie jest obsługiwanym językiem
    return {
      language: `Inny (${detectedCode})`,
      languageCode: detectedCode,
      confidence: 'medium',
      detectionMethod: 'franc-min (unsupported language)'
    }
  }
}

/**
 * Sprawdza czy wykryty język jest obsługiwanym językiem
 */
export function isSupportedLanguage(languageCode: string): boolean {
  return languageCode in SUPPORTED_LANGUAGES
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
  return SUPPORTED_LANGUAGES[languageCode]
}

/**
 * Pobiera listę wszystkich obsługiwanych języków
 */
export function getSupportedLanguages(): { code: string; name: string }[] {
  return Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => ({ code, name }))
}
