// Mapowanie kodów ISO 639-3 na pełne nazwy języków
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

// Top słowa dla każdego języka (najbardziej charakterystyczne)
const LANGUAGE_WORDS: Record<string, string[]> = {
  'eng': ['the', 'and', 'of', 'to', 'in', 'is', 'that', 'it', 'for', 'was', 'with', 'as', 'by', 'on', 'be', 'at', 'this', 'from', 'or', 'an', 'are', 'which', 'has', 'had', 'but', 'not', 'have', 'were', 'been', 'will', 'their', 'if', 'can', 'would', 'there', 'been', 'shall', 'court', 'case', 'section', 'article', 'law', 'act', 'may', 'must', 'right', 'state', 'any', 'such', 'its', 'under', 'shall', 'between', 'whether', 'other', 'against', 'judgment', 'appeal'],
  'pol': ['w', 'i', 'na', 'z', 'do', 'nie', 'że', 'się', 'o', 'to', 'po', 'jest', 'co', 'ale', 'też', 'od', 'dla', 'za', 'ze', 'być', 'jak', 'jest', 'może', 'może', 'przez', 'tym', 'lub', 'jego', 'której', 'został', 'roku', 'został', 'dnia', 'artykuł', 'prawo', 'ustawa', 'sąd', 'sposób', 'również', 'został', 'zgodnie', 'oznacza', 'osoba'],
  'por': ['o', 'a', 'de', 'e', 'do', 'da', 'em', 'um', 'para', 'com', 'não', 'uma', 'os', 'no', 'se', 'na', 'por', 'mais', 'as', 'dos', 'como', 'mas', 'ao', 'ele', 'das', 'à', 'seu', 'sua', 'ou', 'quando', 'muito', 'nos', 'já', 'eu', 'também', 'só', 'pelo', 'pela', 'até', 'isso', 'ela', 'entre', 'depois', 'sem', 'mesmo', 'aos', 'ter', 'seus', 'quem', 'nas', 'me', 'esse', 'eles', 'você', 'essa', 'num', 'nem', 'suas', 'meu', 'às', 'minha', 'numa', 'pelos', 'elas', 'qual', 'nós', 'lhe', 'deles', 'essas', 'esses', 'pelas', 'este', 'dele', 'tu', 'te', 'vocês', 'vos', 'lhes', 'meus', 'minhas', 'teu', 'tua', 'teus', 'tuas', 'nosso', 'nossa', 'nossos', 'nossas', 'dela', 'delas', 'esta', 'estes', 'estas', 'aquele', 'aquela', 'aqueles', 'aquelas', 'isto', 'aquilo', 'estou', 'está', 'estamos', 'estão', 'estive', 'esteve', 'estivemos', 'estiveram', 'estava', 'estávamos', 'estavam', 'estivera', 'estivéramos', 'esteja', 'estejamos', 'estejam', 'estivesse', 'estivéssemos', 'estivessem', 'estiver', 'estivermos', 'estiverem', 'hei', 'há', 'havemos', 'hão', 'houve', 'houvemos', 'houveram', 'houvera', 'houvéramos', 'haja', 'hajamos', 'hajam', 'houvesse', 'houvéssemos', 'houvessem', 'houver', 'houvermos', 'houverem', 'houverei', 'houverá', 'houveremos', 'houverão', 'houveria', 'houveríamos', 'houveriam', 'sou', 'somos', 'são', 'era', 'éramos', 'eram', 'fui', 'foi', 'fomos', 'foram', 'fora', 'fôramos', 'seja', 'sejamos', 'sejam', 'fosse', 'fôssemos', 'fossem', 'for', 'formos', 'forem', 'serei', 'será', 'seremos', 'serão', 'seria', 'seríamos', 'seriam', 'tenho', 'tem', 'temos', 'tém', 'tinha', 'tínhamos', 'tinham', 'tive', 'teve', 'tivemos', 'tiveram', 'tivera', 'tivéramos', 'tenha', 'tenhamos', 'tenham', 'tivesse', 'tivéssemos', 'tivessem', 'tiver', 'tivermos', 'tiverem', 'terei', 'terá', 'teremos', 'terão', 'teria', 'teríamos', 'teriam'],
  'fra': ['le', 'de', 'un', 'et', 'être', 'à', 'il', 'avoir', 'ne', 'je', 'son', 'que', 'se', 'qui', 'ce', 'dans', 'en', 'du', 'elle', 'au', 'pour', 'pas', 'que', 'vous', 'par', 'sur', 'faire', 'plus', 'dire', 'me', 'on', 'mon', 'lui', 'nous', 'comme', 'mais', 'pouvoir', 'avec', 'tout', 'y', 'aller', 'voir', 'où', 'leur', 'si', 'ses', 'ou', 'dont', 'homme', 'alors'],
  'deu': ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich', 'des', 'auf', 'für', 'ist', 'im', 'dem', 'nicht', 'ein', 'eine', 'als', 'auch', 'es', 'an', 'werden', 'aus', 'er', 'hat', 'dass', 'sie', 'nach', 'wird', 'bei', 'einer', 'um', 'am', 'sind', 'noch', 'wie', 'einem', 'über', 'einen', 'so', 'zum', 'war', 'haben', 'nur', 'oder', 'aber', 'vor', 'zur', 'bis', 'mehr', 'durch', 'man', 'sein', 'wurde', 'sei', 'in'],
  'spa': ['de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para', 'con', 'no', 'una', 'su', 'al', 'lo', 'como', 'más', 'pero', 'sus', 'le', 'ya', 'o', 'este', 'sí', 'porque', 'esta', 'entre', 'cuando', 'muy', 'sin', 'sobre', 'también', 'me', 'hasta', 'hay', 'donde', 'quien', 'desde', 'todo', 'nos', 'durante', 'todos', 'uno', 'les', 'ni', 'contra', 'otros', 'ese', 'eso', 'ante', 'ellos', 'e', 'esto', 'mí', 'antes', 'algunos', 'qué', 'unos', 'yo', 'otro', 'otras', 'otra', 'él', 'tanto', 'esa', 'estos', 'mucho', 'quienes', 'nada', 'muchos', 'cual', 'poco', 'ella', 'estar', 'estas', 'algunas', 'algo', 'nosotros'],
  'ita': ['di', 'e', 'il', 'la', 'che', 'a', 'è', 'per', 'un', 'in', 'una', 'sono', 'da', 'non', 'con', 'le', 'si', 'dei', 'gli', 'come', 'io', 'al', 'nella', 'del', 'alla', 'nel', 'anche', 'ha', 'più', 'delle', 'questo', 'dalla', 'era', 'stato', 'lo', 'ma', 'gli', 'essere', 'agli', 'questa', 'sia', 'degli', 'ad', 'però', 'nelle', 'nei', 'tutti', 'lui', 'quando', 'tra'],
  'rus': ['в', 'и', 'не', 'на', 'с', 'что', 'а', 'по', 'это', 'как', 'к', 'из', 'у', 'он', 'за', 'от', 'его', 'для', 'о', 'то', 'был', 'же', 'она', 'при', 'так', 'быть', 'все', 'этот', 'до', 'или', 'вы', 'но', 'бы', 'если', 'мы', 'года', 'еще', 'когда', 'их', 'уже', 'может', 'была', 'один', 'были', 'чтобы', 'себя', 'них', 'есть', 'было', 'лет'],
  'ukr': ['і', 'в', 'на', 'не', 'з', 'що', 'він', 'до', 'а', 'як', 'за', 'у', 'по', 'та', 'це', 'від', 'його', 'був', 'або', 'є', 'й', 'для', 'про', 'при', 'під', 'який', 'всі', 'були', 'того', 'була', 'було', 'можна', 'які', 'їх', 'має', 'була', 'коли', 'буде', 'один', 'її', 'також', 'якщо', 'бути', 'така', 'так', 'цього', 'все', 'були', 'того', 'років']
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
 * Wykrywa język dokumentu używając prostej analizy słów kluczowych
 * Obsługuje 30 języków: 24 języki UE + RU, UKR, serbski, turecki, arabski, albański
 */
export function detectLanguage(text: string, fileName?: string): LanguageDetectionResult {
  console.log(`🔍 Wykrywanie języka (długość: ${text.length} znaków)...`)
  if (fileName) console.log(`   Plik: ${fileName}`)

  // Normalizuj tekst: lowercase i usuń znaki interpunkcyjne
  const normalized = text.toLowerCase()

  // Podziel na słowa (tylko alfanumeryczne)
  const words = normalized.match(/\b[a-zżźćńółęąśŻŹĆĄŚĘŁÓŃа-яёА-ЯЁіїєІЇЄçñáéíóúàèìòùâêîôûãõäëïöüαβγδεζηθικλμνξοπρστυφχψωàèéìòù]+\b/g) || []

  if (words.length < 10) {
    console.log('❌ Zbyt mało słów do analizy')
    return {
      language: 'Nieznany',
      languageCode: 'und',
      confidence: 'low',
      detectionMethod: 'insufficient-data'
    }
  }

  console.log(`   Znaleziono ${words.length} słów`)

  // Policz dopasowania dla każdego języka
  const scores: Record<string, number> = {}

  for (const [langCode, keywords] of Object.entries(LANGUAGE_WORDS)) {
    let matches = 0
    const keywordSet = new Set(keywords)

    for (const word of words) {
      if (keywordSet.has(word)) {
        matches++
      }
    }

    scores[langCode] = matches
  }

  // Znajdź język z najwyższym score
  const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1])

  console.log('   Top 5 wyników:')
  sortedScores.slice(0, 5).forEach(([code, score]) => {
    console.log(`     ${SUPPORTED_LANGUAGES[code]}: ${score} trafień`)
  })

  const [detectedCode, maxScore] = sortedScores[0]
  const secondScore = sortedScores[1]?.[1] || 0

  // Określ confidence
  let confidence: 'high' | 'medium' | 'low'
  if (maxScore > words.length * 0.2 && maxScore > secondScore * 2) {
    confidence = 'high'
  } else if (maxScore > words.length * 0.1 && maxScore > secondScore * 1.5) {
    confidence = 'medium'
  } else {
    confidence = 'low'
  }

  const languageName = SUPPORTED_LANGUAGES[detectedCode]

  console.log(`✅ Wykryto: ${languageName} (${detectedCode})`)
  console.log(`   Trafienia: ${maxScore}/${words.length} słów (${(maxScore/words.length*100).toFixed(1)}%)`)
  console.log(`   Confidence: ${confidence}`)

  return {
    language: languageName || 'Nieznany',
    languageCode: detectedCode || 'und',
    confidence,
    detectionMethod: 'keyword-matching'
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
