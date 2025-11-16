import nlp from 'compromise'

export interface NLPTerm {
  term: string
  positions: number[]
  occurrences: number
  context: string
  partOfSpeech?: string[]
}

/**
 * Ekstrakcja terminów przy użyciu NLP i POS tagging
 * Nie używa tłumaczenia - wyciąga terminy bezpośrednio z tekstu
 */
export function extractTermsWithNLP(
  text: string,
  minLength: number = 3,
  minOccurrences: number = 1,
  maxTerms: number = 50,
  languageCode: string = 'eng'
): NLPTerm[] {
  console.log(`🔬 NLP Ekstrakcja rozpoczęta (język: ${languageCode})`)
  console.log(`   Parametry: minLength=${minLength}, minOccurrences=${minOccurrences}, maxTerms=${maxTerms}`)

  const terms = new Map<string, NLPTerm>()

  // Użyj compromise do analizy NLP (działa najlepiej dla angielskiego, ale podstawowa analiza działa dla innych)
  const doc = nlp(text)

  // 1. Wyekstrahuj rzeczowniki (nouns) - podstawowe terminy
  const nouns = doc.nouns().out('array')
  console.log(`   Znaleziono ${nouns.length} rzeczowników`)

  // 2. Wyekstrahuj zwroty rzeczownikowe (noun phrases) - terminy wielowyrazowe
  const nounPhrases = doc.match('#Noun+').out('array')
  console.log(`   Znaleziono ${nounPhrases.length} zwrotów rzeczownikowych`)

  // 3. Wyekstrahuj przymiotniki + rzeczowniki (specjalistyczne terminy)
  const adjectiveNouns = doc.match('#Adjective+ #Noun+').out('array')
  console.log(`   Znaleziono ${adjectiveNouns.length} zwrotów przymiotnik+rzeczownik`)

  // 4. Wyekstrahuj terminy techniczne (wielkie litery, akronimy)
  const technicalTerms = doc.match('#Acronym').out('array')
  const properNouns = doc.match('#ProperNoun+').out('array')
  console.log(`   Znaleziono ${technicalTerms.length} akronimów i ${properNouns.length} nazw własnych`)

  // Połącz wszystkie kandydatury
  const candidates = [
    ...nouns,
    ...nounPhrases,
    ...adjectiveNouns,
    ...technicalTerms,
    ...properNouns
  ]

  console.log(`   Łącznie ${candidates.length} kandydatów na terminy`)

  // Przeanalizuj każdego kandydata
  candidates.forEach(candidate => {
    const normalized = candidate.trim().toLowerCase()

    // Filtry podstawowe
    if (normalized.length < minLength) return
    if (/^\d+$/.test(normalized)) return // Pomiń same liczby
    if (normalized.split(/\s+/).length > 5) return // Pomiń zbyt długie frazy

    // Znajdź wszystkie wystąpienia w tekście (case-insensitive)
    const regex = new RegExp(`\\b${escapeRegex(candidate)}\\b`, 'gi')
    const matches = Array.from(text.matchAll(regex))

    if (matches.length < minOccurrences) return

    // Znajdź pozycje
    const positions = matches.map(m => m.index!).filter(i => i !== undefined)

    // Pobierz kontekst (pierwsze wystąpienie)
    const contextStart = Math.max(0, positions[0] - 50)
    const contextEnd = Math.min(text.length, positions[0] + candidate.length + 50)
    const context = text.slice(contextStart, contextEnd).replace(/\s+/g, ' ').trim()

    // Dodaj lub aktualizuj termin (unikaj duplikatów pozycji!)
    if (terms.has(normalized)) {
      const existing = terms.get(normalized)!
      // Użyj Set do deduplikacji pozycji
      const uniquePositions = new Set([...existing.positions, ...positions])
      existing.positions = Array.from(uniquePositions).sort((a, b) => a - b)
      existing.occurrences = existing.positions.length
    } else {
      terms.set(normalized, {
        term: candidate.toLowerCase(), // Zachowaj oryginalną formę (ale znormalizowaną)
        positions,
        occurrences: matches.length,
        context: `...${context}...`,
        partOfSpeech: []
      })
    }
  })

  console.log(`   Po filtracji: ${terms.size} unikalnych terminów`)

  // Sortuj według liczby wystąpień (malejąco)
  const sortedTerms = Array.from(terms.values())
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, maxTerms)

  console.log(`✅ NLP Ekstrakcja zakończona: ${sortedTerms.length} terminów`)

  return sortedTerms
}

/**
 * Ekstrakcja terminów z użyciem wyrażeń regularnych i analizy statystycznej
 * Metoda fallback dla języków nie obsługiwanych przez compromise
 */
export function extractTermsWithRegex(
  text: string,
  minLength: number = 3,
  minOccurrences: number = 1,
  maxTerms: number = 50,
  languageCode: string = 'pol'
): NLPTerm[] {
  console.log(`📊 Regex Ekstrakcja rozpoczęta (język: ${languageCode})`)

  const terms = new Map<string, NLPTerm>()

  // 1. Znajdź wszystkie słowa (z obsługą znaków diakrytycznych)
  // Użyj prostszego regex kompatybilnego z ES5
  const wordRegex = /[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻäöüßàáâãèéêëìíîïòóôõùúûüýÿñçæœ][a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻäöüßàáâãèéêëìíîïòóôõùúûüýÿñçæœ-]{2,}/g
  const words = text.match(wordRegex) || []

  console.log(`   Znaleziono ${words.length} słów`)

  // 2. Znajdź frazy 2-3 słowne
  const phraseRegex = /[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻäöüßàáâãèéêëìíîïòóôõùúûüýÿñçæœ][a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻäöüßàáâãèéêëìíîïòóôõùúûüýÿñçæœ-]{2,}(?:\s+[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻäöüßàáâãèéêëìíîïòóôõùúûüýÿñçæœ][a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻäöüßàáâãèéêëìíîïòóôõùúûüýÿñçæœ-]{2,}){1,2}/g
  const phrases = text.match(phraseRegex) || []

  console.log(`   Znaleziono ${phrases.length} fraz`)

  // Połącz słowa i frazy
  const allCandidates: string[] = (words as string[]).concat(phrases as string[])
  const candidates = Array.from(new Set(allCandidates))

  console.log(`   Łącznie ${candidates.length} unikalnych kandydatów`)

  // Przeanalizuj każdego kandydata
  candidates.forEach(candidate => {
    const normalized = candidate.toLowerCase()

    // Filtry
    if (normalized.length < minLength) return
    if (/^\d+$/.test(normalized)) return
    if (normalized.split(/\s+/).length > 4) return

    // Sprawdź czy to nie jest częsty wyraz (prosta heurystyka - bardzo krótkie słowa)
    if (normalized.length < 4 && normalized.split(/\s+/).length === 1) return

    // Znajdź wszystkie wystąpienia
    const regex = new RegExp(`\\b${escapeRegex(candidate)}\\b`, 'gi')
    const matches = Array.from(text.matchAll(regex))

    if (matches.length < minOccurrences) return

    const positions = matches.map(m => m.index!).filter(i => i !== undefined)

    // Kontekst
    const contextStart = Math.max(0, positions[0] - 50)
    const contextEnd = Math.min(text.length, positions[0] + candidate.length + 50)
    const context = text.slice(contextStart, contextEnd).replace(/\s+/g, ' ').trim()

    // Dodaj lub aktualizuj termin (unikaj duplikatów pozycji!)
    if (terms.has(normalized)) {
      const existing = terms.get(normalized)!
      // Użyj Set do deduplikacji pozycji
      const uniquePositions = new Set([...existing.positions, ...positions])
      existing.positions = Array.from(uniquePositions).sort((a, b) => a - b)
      existing.occurrences = existing.positions.length
    } else {
      terms.set(normalized, {
        term: candidate.toLowerCase(),
        positions,
        occurrences: matches.length,
        context: `...${context}...`
      })
    }
  })

  console.log(`   Po filtracji: ${terms.size} unikalnych terminów`)

  // Sortuj według TF (term frequency)
  const sortedTerms = Array.from(terms.values())
    .sort((a, b) => {
      // Preferuj dłuższe terminy (prawdopodobnie bardziej specjalistyczne)
      const lengthScore = (term: NLPTerm) => term.term.length * 0.1
      const scoreA = a.occurrences + lengthScore(a)
      const scoreB = b.occurrences + lengthScore(b)
      return scoreB - scoreA
    })
    .slice(0, maxTerms)

  console.log(`✅ Regex Ekstrakcja zakończona: ${sortedTerms.length} terminów`)

  return sortedTerms
}

/**
 * Hybrydowa ekstrakcja - wybiera najlepszą metodę w zależności od języka
 */
export function extractTermsHybrid(
  text: string,
  minLength: number = 3,
  minOccurrences: number = 1,
  maxTerms: number = 50,
  languageCode: string = 'eng'
): NLPTerm[] {
  console.log(`🧬 Hybrydowa ekstrakcja (język: ${languageCode})`)

  // Compromise działa dobrze dla języków germańskich i romańskich
  const nlpLanguages = ['eng', 'deu', 'nld', 'fra', 'spa', 'ita', 'por']

  if (nlpLanguages.includes(languageCode)) {
    console.log('   Używam NLP (compromise)')
    return extractTermsWithNLP(text, minLength, minOccurrences, maxTerms, languageCode)
  } else {
    console.log('   Używam Regex (statystyka)')
    return extractTermsWithRegex(text, minLength, minOccurrences, maxTerms, languageCode)
  }
}

/**
 * Escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
