import { eld } from 'eld'

// Mapowanie ISO 639-1 (eld) → ISO 639-3 (używane w aplikacji)
const ISO_639_1_TO_639_3: Record<string, string> = {
  'ar': 'arb', // Arabski
  'bg': 'bul', // Bułgarski
  'hr': 'hrv', // Chorwacki
  'cs': 'ces', // Czeski
  'da': 'dan', // Duński
  'nl': 'nld', // Niderlandzki
  'en': 'eng', // Angielski
  'et': 'est', // Estoński
  'fi': 'fin', // Fiński
  'fr': 'fra', // Francuski
  'de': 'deu', // Niemiecki
  'el': 'ell', // Grecki
  'hu': 'hun', // Węgierski
  'it': 'ita', // Włoski
  'lv': 'lav', // Łotewski
  'lt': 'lit', // Litewski
  'pl': 'pol', // Polski
  'pt': 'por', // Portugalski
  'ro': 'ron', // Rumuński
  'sk': 'slk', // Słowacki
  'sl': 'slv', // Słoweński
  'es': 'spa', // Hiszpański
  'sv': 'swe', // Szwedzki
  'ru': 'rus', // Rosyjski
  'uk': 'ukr', // Ukraiński
  'sr': 'srp', // Serbski
  'tr': 'tur', // Turecki
  'sq': 'sqi', // Albański
}

// Mapowanie kodów ISO 639-3 na pełne nazwy języków
const SUPPORTED_LANGUAGES: Record<string, string> = {
  // Języki UE (24) - 22 obsługiwane przez ELD
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
  'gle': 'Irlandzki', // NIE obsługiwany przez ELD
  'ita': 'Włoski',
  'lav': 'Łotewski',
  'lit': 'Litewski',
  'mlt': 'Maltański', // NIE obsługiwany przez ELD
  'pol': 'Polski',
  'por': 'Portugalski',
  'ron': 'Rumuński',
  'slk': 'Słowacki',
  'slv': 'Słoweński',
  'spa': 'Hiszpański',
  'swe': 'Szwedzki',
  // Dodatkowe języki (6) - wszystkie obsługiwane
  'rus': 'Rosyjski',
  'ukr': 'Ukraiński',
  'srp': 'Serbski',
  'tur': 'Turecki',
  'arb': 'Arabski',
  'sqi': 'Albański'
}

// Konfiguruj ELD na subset obsługiwanych języków (28 z 30 - brak ga i mt)
const SUPPORTED_ISO_639_1_CODES = Object.keys(ISO_639_1_TO_639_3)
try {
  eld.dynamicLangSubset(SUPPORTED_ISO_639_1_CODES)
  console.log('✅ ELD skonfigurowany dla 28 języków')
} catch (error) {
  console.warn('⚠️ Nie udało się skonfigurować ELD subset:', error)
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
  'Szwedzki': 'swe',
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
 * Wykrywa język dokumentu używając ELD (Efficient Language Detector)
 * Obsługuje 28 języków (z 30 planowanych - brakuje irlandzki i maltański)
 */
export function detectLanguage(text: string, fileName?: string): LanguageDetectionResult {
  console.log(`🔍 Wykrywanie języka ELD (długość: ${text.length} znaków)...`)
  if (fileName) console.log(`   Plik: ${fileName}`)

  // Sprawdź minimalną długość tekstu
  if (text.length < 50) {
    console.log('❌ Tekst zbyt krótki do analizy')
    return {
      language: 'Nieznany',
      languageCode: 'und',
      confidence: 'low',
      detectionMethod: 'insufficient-data'
    }
  }

  try {
    // Użyj ELD do wykrycia języka
    const result = eld.detect(text)
    const iso639_1Code = result.language // np. 'en', 'pl', 'pt'

    console.log(`   ELD wykrył: ${iso639_1Code}`)
    console.log(`   isReliable: ${result.isReliable()}`)

    // Jeśli nie wykryto języka
    if (!iso639_1Code || iso639_1Code === '') {
      console.log('❌ ELD nie wykrył języka')
      return {
        language: 'Nieznany',
        languageCode: 'und',
        confidence: 'low',
        detectionMethod: 'eld-no-detection'
      }
    }

    // Konwertuj ISO 639-1 na ISO 639-3
    const iso639_3Code = ISO_639_1_TO_639_3[iso639_1Code]

    if (!iso639_3Code) {
      console.log(`⚠️ Wykryto nieobsługiwany język: ${iso639_1Code}`)
      return {
        language: 'Nieznany',
        languageCode: 'und',
        confidence: 'low',
        detectionMethod: 'eld-unsupported-language'
      }
    }

    const languageName = SUPPORTED_LANGUAGES[iso639_3Code]

    // Określ confidence na podstawie ELD isReliable() + sprawdź scores
    const scores = result.getScores()
    const scoreValues = Object.values(scores).sort((a, b) => (b as number) - (a as number))
    const topScore = scoreValues[0] as number
    const secondScore = scoreValues[1] as number || 0
    const gap = topScore - secondScore

    let confidence: 'high' | 'medium' | 'low'
    if (result.isReliable() && gap > 0.3) {
      confidence = 'high'
    } else if (result.isReliable() || gap > 0.2) {
      confidence = 'medium'
    } else {
      confidence = 'low'
    }

    console.log(`✅ Wykryto: ${languageName} (${iso639_3Code})`)
    console.log(`   Top score: ${(topScore * 100).toFixed(1)}%, gap: ${(gap * 100).toFixed(1)}%`)
    console.log(`   Confidence: ${confidence}`)

    return {
      language: languageName,
      languageCode: iso639_3Code,
      confidence,
      detectionMethod: 'eld'
    }
  } catch (error) {
    console.error('❌ Błąd ELD:', error)
    return {
      language: 'Nieznany',
      languageCode: 'und',
      confidence: 'low',
      detectionMethod: 'eld-error'
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
