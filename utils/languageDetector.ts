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
  'por': ['o', 'a', 'de', 'e', 'do', 'da', 'em', 'um', 'para', 'com', 'não', 'uma', 'os', 'no', 'se', 'na', 'por', 'mais', 'as', 'dos', 'como', 'mas', 'ao', 'ele', 'das', 'à', 'seu', 'sua', 'ou', 'quando', 'muito', 'nos', 'já', 'eu', 'também', 'só', 'pelo', 'pela', 'até', 'isso', 'ela', 'entre', 'depois', 'sem', 'mesmo', 'aos', 'ter', 'seus', 'quem', 'nas', 'artigo', 'lei', 'direito', 'tribunal'],
  'fra': ['le', 'de', 'un', 'et', 'être', 'à', 'il', 'avoir', 'ne', 'je', 'son', 'que', 'se', 'qui', 'ce', 'dans', 'en', 'du', 'elle', 'au', 'pour', 'pas', 'que', 'vous', 'par', 'sur', 'faire', 'plus', 'dire', 'me', 'on', 'mon', 'lui', 'nous', 'comme', 'mais', 'pouvoir', 'avec', 'tout', 'y', 'aller', 'voir', 'où', 'leur', 'si', 'ses', 'ou', 'dont', 'homme', 'alors'],
  'deu': ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich', 'des', 'auf', 'für', 'ist', 'im', 'dem', 'nicht', 'ein', 'eine', 'als', 'auch', 'es', 'an', 'werden', 'aus', 'er', 'hat', 'dass', 'sie', 'nach', 'wird', 'bei', 'einer', 'um', 'am', 'sind', 'noch', 'wie', 'einem', 'über', 'einen', 'so', 'zum', 'war', 'haben', 'nur', 'oder', 'aber', 'vor', 'zur', 'bis', 'mehr', 'durch', 'man', 'sein', 'wurde', 'sei', 'in'],
  'spa': ['de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para', 'con', 'no', 'una', 'su', 'al', 'lo', 'como', 'más', 'pero', 'sus', 'le', 'ya', 'o', 'este', 'sí', 'porque', 'esta', 'entre', 'cuando', 'muy', 'sin', 'sobre', 'también', 'me', 'hasta', 'hay', 'donde', 'quien', 'desde', 'todo', 'nos', 'durante', 'todos', 'uno', 'les', 'ni', 'contra', 'otros', 'ese', 'eso', 'ante', 'ellos', 'e', 'esto', 'mí', 'antes', 'algunos', 'qué', 'unos', 'yo', 'otro', 'otras', 'otra', 'él', 'tanto', 'esa', 'estos', 'mucho', 'quienes', 'nada', 'muchos', 'cual', 'poco', 'ella', 'estar', 'estas', 'algunas', 'algo', 'nosotros'],
  'ita': ['di', 'e', 'il', 'la', 'che', 'a', 'è', 'per', 'un', 'in', 'una', 'sono', 'da', 'non', 'con', 'le', 'si', 'dei', 'gli', 'come', 'io', 'al', 'nella', 'del', 'alla', 'nel', 'anche', 'ha', 'più', 'delle', 'questo', 'dalla', 'era', 'stato', 'lo', 'ma', 'gli', 'essere', 'agli', 'questa', 'sia', 'degli', 'ad', 'però', 'nelle', 'nei', 'tutti', 'lui', 'quando', 'tra'],
  'rus': ['в', 'и', 'не', 'на', 'с', 'что', 'а', 'по', 'это', 'как', 'к', 'из', 'у', 'он', 'за', 'от', 'его', 'для', 'о', 'то', 'был', 'же', 'она', 'при', 'так', 'быть', 'все', 'этот', 'до', 'или', 'вы', 'но', 'бы', 'если', 'мы', 'года', 'еще', 'когда', 'их', 'уже', 'может', 'была', 'один', 'были', 'чтобы', 'себя', 'них', 'есть', 'было', 'лет'],
  'ukr': ['і', 'в', 'на', 'не', 'з', 'що', 'він', 'до', 'а', 'як', 'за', 'у', 'по', 'та', 'це', 'від', 'його', 'був', 'або', 'є', 'й', 'для', 'про', 'при', 'під', 'який', 'всі', 'були', 'того', 'була', 'було', 'можна', 'які', 'їх', 'має', 'була', 'коли', 'буде', 'один', 'її', 'також', 'якщо', 'бути', 'така', 'так', 'цього', 'все', 'були', 'того', 'років'],
  'bul': ['на', 'и', 'в', 'да', 'за', 'не', 'се', 'от', 'с', 'по', 'който', 'че', 'е', 'при', 'като', 'до', 'към', 'този', 'или', 'за', 'той', 'са', 'може', 'бъде', 'има', 'ще', 'все', 'тази', 'тях', 'било', 'бил', 'съгласно', 'член', 'закон', 'право', 'съд'],
  'hrv': ['i', 'u', 'je', 'na', 'se', 'za', 'da', 'od', 's', 'to', 'nije', 'su', 'kao', 'ili', 'biti', 'ali', 'biti', 'ima', 'po', 'iz', 'koji', 'samo', 'ovaj', 'taj', 'može', 'godine', 'do', 'također', 'članak', 'prema', 'zakon', 'sud'],
  'ces': ['a', 'v', 'na', 'je', 'o', 'se', 'z', 'do', 's', 'k', 'si', 'být', 'že', 'po', 'za', 'i', 'od', 'jako', 'pro', 'nebo', 'při', 'který', 've', 'co', 'který', 'tento', 'může', 'jsou', 'byl', 'podle', 'článek', 'zákon', 'soud'],
  'dan': ['og', 'i', 'af', 'til', 'en', 'at', 'er', 'den', 'det', 'på', 'som', 'for', 'med', 'ikke', 'der', 'en', 'de', 'har', 'kan', 'være', 'om', 'fra', 'eller', 'efter', 'også', 'denne', 'artikel', 'lov', 'ret', 'domstol'],
  'nld': ['de', 'het', 'een', 'en', 'van', 'in', 'op', 'is', 'te', 'dat', 'die', 'aan', 'voor', 'met', 'niet', 'als', 'ook', 'zijn', 'wordt', 'heeft', 'kan', 'worden', 'door', 'bij', 'uit', 'naar', 'deze', 'artikel', 'wet', 'recht', 'rechtbank'],
  'est': ['ja', 'on', 'ei', 'ning', 'see', 'et', 'kui', 'ka', 'või', 'siis', 'aga', 'oli', 'võib', 'kõik', 'mis', 'kes', 'tema', 'või', 'olema', 'selle', 'artikkel', 'seadus', 'õigus', 'kohus'],
  'fin': ['ja', 'on', 'ei', 'että', 'se', 'joka', 'oli', 'ei', 'myös', 'kuin', 'tai', 'voi', 'olla', 'kun', 'jos', 'näin', 'vain', 'sen', 'tämä', 'tämän', 'artikla', 'laki', 'oikeus', 'tuomioistuin'],
  'ell': ['και', 'η', 'το', 'του', 'ο', 'τα', 'στο', 'στη', 'για', 'με', 'από', 'που', 'των', 'είναι', 'της', 'στην', 'ή', 'αυτό', 'αυτή', 'μπορεί', 'άρθρο', 'νόμος', 'δικαίωμα', 'δικαστήριο'],
  'hun': ['a', 'az', 'és', 'nem', 'egy', 'hogy', 'van', 'ezt', 'amely', 'volt', 'vagy', 'mint', 'is', 'lehet', 'csak', 'után', 'meg', 'ez', 'ha', 'cikk', 'törvény', 'jog', 'bíróság'],
  'gle': ['an', 'na', 'agus', 'i', 'ar', 'is', 'le', 'go', 'sa', 'ó', 'de', 'do', 'as', 'mar', 'seo', 'sin', 'bheith', 'chun', 'féidir', 'airteagal', 'dlí', 'ceart', 'cúirt'],
  'lav': ['un', 'ir', 'ar', 'kas', 'no', 'uz', 'par', 'vai', 'bet', 'kā', 'lai', 'var', 'šis', 'tas', 'jau', 'tiek', 'tika', 'kuru', 'pants', 'likums', 'tiesības', 'tiesa'],
  'lit': ['ir', 'kad', 'yra', 'su', 'tai', 'bet', 'ar', 'į', 'iš', 'jo', 'jis', 'kaip', 'tik', 'buvo', 'nėra', 'gali', 'šis', 'tas', 'straipsnis', 'įstatymas', 'teisė', 'teismas'],
  'mlt': ['u', 'li', 'ta', 'għal', 'fil', 'hu', 'hija', 'kien', 'kienu', 'bħal', 'ma', 'jew', 'dan', 'dik', 'minn', 'jista', 'artikolu', 'liġi', 'dritt', 'qorti'],
  'ron': ['și', 'de', 'a', 'în', 'la', 'pentru', 'este', 'cu', 'pe', 'cel', 'un', 'să', 'care', 'sau', 'ca', 'se', 'din', 'sunt', 'fie', 'poate', 'articol', 'lege', 'drept', 'instanță'],
  'slk': ['a', 'v', 'na', 'je', 'o', 'sa', 'že', 'do', 's', 'z', 'za', 'aj', 'k', 'ako', 'alebo', 'tento', 'ktorý', 'sú', 'by', 'môže', 'článok', 'zákon', 'právo', 'súd'],
  'slv': ['in', 'je', 'v', 'na', 'za', 'da', 'se', 'z', 'o', 'do', 'ki', 'tudi', 'ali', 'ko', 'so', 'iz', 'lahko', 'ta', 'tega', 'člen', 'zakon', 'pravica', 'sodišče'],
  'swe': ['och', 'i', 'att', 'en', 'är', 'som', 'det', 'på', 'av', 'för', 'till', 'med', 'den', 'var', 'har', 'kan', 'inte', 'om', 'eller', 'från', 'artikel', 'lag', 'rätt', 'domstol'],
  'srp': ['и', 'у', 'је', 'на', 'се', 'за', 'да', 'од', 'с', 'то', 'који', 'као', 'или', 'су', 'из', 'по', 'има', 'може', 'члан', 'закон', 'право', 'суд'],
  'tur': ['ve', 'bir', 'bu', 'da', 'için', 'ile', 'olan', 'değil', 'olarak', 'var', 'mi', 'daha', 'ya', 'ancak', 'gibi', 'şu', 'göre', 'madde', 'kanun', 'hak', 'mahkeme'],
  'arb': ['في', 'من', 'أن', 'على', 'إلى', 'هذا', 'أو', 'ما', 'لا', 'كان', 'قد', 'التي', 'الذي', 'ذلك', 'عن', 'كل', 'له', 'هو', 'المادة', 'قانون', 'حق', 'محكمة'],
  'sqi': ['dhe', 'i', 'të', 'që', 'në', 'për', 'është', 'e', 'një', 'si', 'nga', 'me', 'ose', 'do', 'po', 'ka', 'nga', 'neni', 'ligj', 'e drejtë', 'gjykatë']
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

  // Policz dopasowania dla każdego języka (używając ratio)
  const scores: Record<string, { matches: number; ratio: number; dictSize: number }> = {}

  for (const [langCode, keywords] of Object.entries(LANGUAGE_WORDS)) {
    let matches = 0
    const keywordSet = new Set(keywords)

    // Zlicz unikalne słowa ze słownika występujące w tekście
    const uniqueMatches = new Set<string>()
    for (const word of words) {
      if (keywordSet.has(word)) {
        uniqueMatches.add(word)
      }
    }

    matches = uniqueMatches.size
    // Ratio: ile % słów ze słownika znaleziono w tekście
    const ratio = matches / keywords.length

    scores[langCode] = {
      matches,
      ratio,
      dictSize: keywords.length
    }
  }

  // Sortuj według ratio (nie absolutnej liczby trafień)
  const sortedScores = Object.entries(scores).sort((a, b) => b[1].ratio - a[1].ratio)

  console.log('   Top 5 wyników:')
  sortedScores.slice(0, 5).forEach(([code, data]) => {
    console.log(`     ${SUPPORTED_LANGUAGES[code]}: ${data.matches}/${data.dictSize} (${(data.ratio * 100).toFixed(1)}%)`)
  })

  const [detectedCode, maxScoreData] = sortedScores[0]
  const secondScoreData = sortedScores[1]?.[1]

  // Określ confidence na podstawie ratio i przewagi nad drugim miejscem
  let confidence: 'high' | 'medium' | 'low'
  const ratioGap = secondScoreData ? maxScoreData.ratio - secondScoreData.ratio : maxScoreData.ratio

  if (maxScoreData.ratio > 0.25 && ratioGap > 0.10) {
    confidence = 'high'
  } else if (maxScoreData.ratio > 0.15 && ratioGap > 0.05) {
    confidence = 'medium'
  } else {
    confidence = 'low'
  }

  const languageName = SUPPORTED_LANGUAGES[detectedCode]

  console.log(`✅ Wykryto: ${languageName} (${detectedCode})`)
  console.log(`   Dopasowanie: ${maxScoreData.matches}/${maxScoreData.dictSize} słów ze słownika (${(maxScoreData.ratio * 100).toFixed(1)}%)`)
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
