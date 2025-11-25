// Funkcje normalizacji terminów (singular/plural, and/or)
// Używane zarówno przy ekstrakcji jak i imporcie

// Escape regex special characters
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Konwersja liczby mnogiej na pojedynczą (angielski)
export function singularize(word: string): string {
  const lower = word.toLowerCase()

  // Wyjątki - nieregularne formy (plural -> singular)
  const irregulars: Record<string, string> = {
    'children': 'child',
    'people': 'person',
    'men': 'man',
    'women': 'woman',
    'teeth': 'tooth',
    'feet': 'foot',
    'mice': 'mouse',
    'geese': 'goose',
    'criteria': 'criterion',
    'phenomena': 'phenomenon',
    'data': 'datum',
    'analyses': 'analysis',
    'bases': 'basis',
    'crises': 'crisis',
    'theses': 'thesis',
    'hypotheses': 'hypothesis',
    'axes': 'axis',
    'indices': 'index',
    'appendices': 'appendix',
    'matrices': 'matrix',
    'countries': 'country',
    'authorities': 'authority',
    'parties': 'party',
    'bodies': 'body',
    'agencies': 'agency',
    'categories': 'category',
    'territories': 'territory',
    'activities': 'activity',
    'offences': 'offence',
    'offenses': 'offense',
    'investigations': 'investigation',
    'prosecutions': 'prosecution',
    'decisions': 'decision',
    'regulations': 'regulation',
    'provisions': 'provision',
    'obligations': 'obligation',
    'operations': 'operation',
    'transactions': 'transaction',
    'proceedings': 'proceeding',
    'measures': 'measure',
    'interests': 'interest',
    'safeguards': 'safeguard'
  }

  if (irregulars[lower]) {
    return irregulars[lower]
  }

  // Słowa kończące się na -ies -> -y (np. authorities -> authority)
  if (lower.endsWith('ies') && lower.length > 4) {
    return lower.slice(0, -3) + 'y'
  }

  // Słowa kończące się na -ves -> -f lub -fe
  if (lower.endsWith('ves') && lower.length > 4) {
    // Sprawdź czy słowo base + 'fe' jest poprawne
    const base = lower.slice(0, -3)
    if (['kni', 'wi', 'li'].includes(base.slice(-2) + base.slice(-1))) {
      return base + 'fe'
    }
    return base + 'f'
  }

  // Słowa kończące się na -es (po s, x, z, ch, sh) -> usuń -es
  if (lower.endsWith('es') && lower.length > 3) {
    const base = lower.slice(0, -2)
    if (base.endsWith('s') || base.endsWith('x') || base.endsWith('z') ||
        base.endsWith('ch') || base.endsWith('sh')) {
      return base
    }
    // Inne przypadki -es -> -e (np. cases -> case)
    if (lower.endsWith('ses') || lower.endsWith('zes') || lower.endsWith('xes')) {
      return lower.slice(0, -2)
    }
  }

  // Słowa kończące się na -s -> usuń -s
  if (lower.endsWith('s') && lower.length > 3 && !lower.endsWith('ss')) {
    return lower.slice(0, -1)
  }

  return lower
}

// Konwersja liczby pojedynczej na mnogą (angielski)
export function pluralize(word: string): string {
  const lower = word.toLowerCase()

  // Wyjątki - nieregularne formy (singular -> plural)
  const irregulars: Record<string, string> = {
    'child': 'children',
    'person': 'people',
    'man': 'men',
    'woman': 'women',
    'tooth': 'teeth',
    'foot': 'feet',
    'mouse': 'mice',
    'goose': 'geese',
    'criterion': 'criteria',
    'phenomenon': 'phenomena',
    'datum': 'data',
    'analysis': 'analyses',
    'basis': 'bases',
    'crisis': 'crises',
    'thesis': 'theses',
    'hypothesis': 'hypotheses',
    'axis': 'axes',
    'index': 'indices',
    'appendix': 'appendices',
    'matrix': 'matrices',
    'country': 'countries',
    'authority': 'authorities',
    'party': 'parties',
    'body': 'bodies',
    'agency': 'agencies',
    'category': 'categories',
    'territory': 'territories',
    'activity': 'activities',
    'offence': 'offences',
    'offense': 'offenses',
    'investigation': 'investigations',
    'prosecution': 'prosecutions',
    'decision': 'decisions',
    'regulation': 'regulations',
    'provision': 'provisions',
    'obligation': 'obligations',
    'operation': 'operations',
    'transaction': 'transactions',
    'proceeding': 'proceedings',
    'measure': 'measures',
    'interest': 'interests',
    'safeguard': 'safeguards'
  }

  if (irregulars[lower]) {
    return irregulars[lower]
  }

  // Słowa kończące się na -y (po spółgłosce) -> -ies
  if (lower.endsWith('y') && lower.length > 2) {
    const beforeY = lower.charAt(lower.length - 2)
    const vowels = 'aeiou'
    if (!vowels.includes(beforeY)) {
      return lower.slice(0, -1) + 'ies'
    }
  }

  // Słowa kończące się na -s, -x, -z, -ch, -sh -> -es
  if (lower.endsWith('s') || lower.endsWith('x') || lower.endsWith('z') ||
      lower.endsWith('ch') || lower.endsWith('sh')) {
    return lower + 'es'
  }

  // Słowa kończące się na -f lub -fe -> -ves
  if (lower.endsWith('f')) {
    return lower.slice(0, -1) + 'ves'
  }
  if (lower.endsWith('fe')) {
    return lower.slice(0, -2) + 'ves'
  }

  // Standardowe - dodaj -s
  return lower + 's'
}

// Normalizacja terminu do porównania (deduplikacja)
// Zamienia plural na singular, "or" na "and"
export function normalizeTermForComparison(term: string): string {
  // 1. Zamień spójniki "or" na "and" dla spójnego porównania
  let normalized = term.toLowerCase()
    .replace(/\s+or\s+/g, ' and ')
    .replace(/\s+&\s+/g, ' and ')

  // 2. Podziel na słowa i znormalizuj każde słowo (singularizacja)
  const words = normalized.split(/\s+/)
  const singularizedWords = words.map(word => {
    // Nie normalizuj spójników i przyimków
    const skipWords = ['and', 'or', 'the', 'a', 'an', 'of', 'for', 'to', 'in', 'on', 'at', 'by', 'with']
    if (skipWords.includes(word)) {
      return word
    }
    return singularize(word)
  })

  return singularizedWords.join(' ')
}

// Funkcja do sprawdzania czy dwa terminy są wariantami (singular/plural, and/or)
export function areTermVariants(term1: string, term2: string): boolean {
  const norm1 = normalizeTermForComparison(term1)
  const norm2 = normalizeTermForComparison(term2)
  return norm1 === norm2
}

// Generuj warianty terminu (singular/plural)
export function generateTermVariants(term: string): string[] {
  const variants: string[] = [term]
  const words = term.split(/\s+/)

  // Dla każdego słowa, wygeneruj wariant singular/plural
  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const wordLower = word.toLowerCase()

    // Skip krótkie słowa i spójniki
    if (word.length <= 2 || ['and', 'or', 'the', 'a', 'an', 'of', 'for', 'to', 'in', 'on', 'at', 'by', 'with'].includes(wordLower)) {
      continue
    }

    // Wygeneruj formę pojedynczą jeśli słowo jest w liczbie mnogiej
    const singular = singularize(word)
    if (singular !== wordLower) {
      const variantWords = [...words]
      // Zachowaj oryginalną wielkość liter
      variantWords[i] = word[0] === word[0].toUpperCase()
        ? singular.charAt(0).toUpperCase() + singular.slice(1)
        : singular
      const variant = variantWords.join(' ')
      if (!variants.includes(variant)) {
        variants.push(variant)
      }
    }

    // Wygeneruj formę mnogą jeśli słowo jest w liczbie pojedynczej
    const plural = pluralize(word)
    if (plural !== wordLower) {
      const variantWords = [...words]
      variantWords[i] = word[0] === word[0].toUpperCase()
        ? plural.charAt(0).toUpperCase() + plural.slice(1)
        : plural
      const variant = variantWords.join(' ')
      if (!variants.includes(variant)) {
        variants.push(variant)
      }
    }
  }

  // Dla terminów złożonych (np. "investigation and prosecution")
  // generuj też wariant z wszystkimi słowami w liczbie mnogiej/pojedynczej
  if (words.length > 2 && words.some(w => w.toLowerCase() === 'and' || w.toLowerCase() === 'or')) {
    // Wszystkie w liczbie pojedynczej
    const allSingular = words.map(w => {
      if (['and', 'or', 'the', 'a', 'an', 'of', 'for', 'to', 'in', 'on', 'at', 'by', 'with'].includes(w.toLowerCase())) {
        return w
      }
      const s = singularize(w)
      return w[0] === w[0].toUpperCase() ? s.charAt(0).toUpperCase() + s.slice(1) : s
    }).join(' ')
    if (!variants.includes(allSingular)) {
      variants.push(allSingular)
    }

    // Wszystkie w liczbie mnogiej
    const allPlural = words.map(w => {
      if (['and', 'or', 'the', 'a', 'an', 'of', 'for', 'to', 'in', 'on', 'at', 'by', 'with'].includes(w.toLowerCase())) {
        return w
      }
      const p = pluralize(w)
      return w[0] === w[0].toUpperCase() ? p.charAt(0).toUpperCase() + p.slice(1) : p
    }).join(' ')
    if (!variants.includes(allPlural)) {
      variants.push(allPlural)
    }
  }

  return variants
}

// Sprawdź czy termin jest w formie pojedynczej (wszystkie słowa)
export function isTermSingular(term: string): boolean {
  const words = term.split(/\s+/)
  const skipWords = ['and', 'or', 'the', 'a', 'an', 'of', 'for', 'to', 'in', 'on', 'at', 'by', 'with']

  for (const word of words) {
    if (skipWords.includes(word.toLowerCase())) continue
    if (word.length <= 2) continue

    const singular = singularize(word)
    // Jeśli singularize zmienia słowo, to słowo jest w liczbie mnogiej
    if (singular !== word.toLowerCase()) {
      return false
    }
  }
  return true
}

// Wybierz preferowaną formę terminu (singular > plural)
// Zwraca termin w formie pojedynczej jeśli to możliwe
export function getPreferredTermForm(term1: string, term2: string): string {
  const term1IsSingular = isTermSingular(term1)
  const term2IsSingular = isTermSingular(term2)

  // Preferuj formę pojedynczą
  if (term1IsSingular && !term2IsSingular) {
    return term1
  }
  if (term2IsSingular && !term1IsSingular) {
    return term2
  }

  // Obie formy są takie same (obie singular lub obie plural)
  // Preferuj krótszy termin (zwykle singular)
  return term1.length <= term2.length ? term1 : term2
}

// Konwertuj termin do formy pojedynczej (zachowując wielkość liter)
export function convertToSingular(term: string): string {
  const words = term.split(/\s+/)
  const skipWords = ['and', 'or', 'the', 'a', 'an', 'of', 'for', 'to', 'in', 'on', 'at', 'by', 'with']

  const singularWords = words.map(word => {
    if (skipWords.includes(word.toLowerCase())) return word
    if (word.length <= 2) return word

    const singular = singularize(word)
    // Zachowaj oryginalną wielkość liter
    if (word[0] === word[0].toUpperCase()) {
      return singular.charAt(0).toUpperCase() + singular.slice(1)
    }
    return singular
  })

  return singularWords.join(' ')
}

// Znajdź istniejący termin w mapie używając normalizacji
export function findExistingTermByNormalization(
  termsMap: Map<string, any>,
  normalizedKeyMap: Map<string, string>,
  term: string
): { existingTerm: any; existingKey: string } | null {
  const normalizedKey = normalizeTermForComparison(term)

  if (normalizedKeyMap.has(normalizedKey)) {
    const existingKey = normalizedKeyMap.get(normalizedKey)!
    const existingTerm = termsMap.get(existingKey)
    if (existingTerm) {
      return { existingTerm, existingKey }
    }
  }

  return null
}
