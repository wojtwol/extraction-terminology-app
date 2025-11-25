import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { detectLanguage } from '@/utils/languageDetector'

interface Term {
  id: string
  term: string
  context: string
  occurrences: number
  positions: number[]
  variants?: string[] // Warianty terminu (plural/singular, and/or) - zgrupowane razem
}

export const maxDuration = 300 // Timeout 300 sekund dla Vercel Pro (wymagane dla dużych dokumentów)
export const runtime = 'nodejs' // Użyj Node.js runtime (nie Edge)

export async function POST(request: NextRequest) {
  try {
    console.log('🔵 Otrzymano request do /api/extract-terminology')

    // Parsuj JSON z obsługą błędów
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error('❌ Błąd parsowania body:', parseError)
      return NextResponse.json(
        { terms: [], error: 'Nieprawidłowe dane wejściowe (błąd parsowania JSON)' },
        { status: 400 }
      )
    }
    const { text, apiKey, minTerms = 10, maxTerms = 100, minLength = 3, minOccurrences = 1, detectedLanguage = 'nieznany' } = body

    // Walidacja
    if (!text) {
      return NextResponse.json(
        { terms: [], error: 'Brak tekstu do analizy' },
        { status: 400 }
      )
    }

    if (!apiKey) {
      return NextResponse.json(
        { terms: [], error: 'Brak klucza API. Wklej klucz API Anthropic (zaczyna się od sk-ant-)' },
        { status: 400 }
      )
    }

    if (!apiKey.startsWith('sk-ant-')) {
      return NextResponse.json(
        { terms: [], error: 'Nieprawidłowy klucz API. Klucz powinien zaczynać się od sk-ant-' },
        { status: 400 }
      )
    }

    if (text.length < 50) {
      return NextResponse.json(
        { terms: [], error: 'Tekst jest zbyt krótki (minimum 50 znaków)' },
        { status: 400 }
      )
    }

    // Limit tekstu - 800,000 znaków (ok. 300 stron)
    // Uwaga: dla dokumentów >300 stron zalecane jest podzielenie na mniejsze fragmenty
    if (text.length > 800000) {
      return NextResponse.json(
        { terms: [], error: `Dokument jest zbyt długi (${text.length.toLocaleString()} znaków). Maksymalna długość: 800,000 znaków (ok. 300 stron). Podziel dokument na mniejsze fragmenty.` },
        { status: 400 }
      )
    }

    console.log('🔍 Rozpoczynam ekstrakcję terminologii...')
    console.log(`📄 Długość tekstu: ${text.length} znaków`)
    console.log(`🌍 Wykryty język (z frontendu): ${detectedLanguage}`)
    console.log(`⚙️  Parametry: ${minTerms}-${maxTerms} terminów, min ${minLength} znaków, min ${minOccurrences} wystąpień`)

    // KROK 1: Ponownie wykryj język używając franc-min (bardziej dokładne)
    const languageDetectionResult = detectLanguage(text)
    console.log(`🔬 Wykryty język (franc-min): ${languageDetectionResult.language} (${languageDetectionResult.languageCode})`)
    console.log(`   Pewność: ${languageDetectionResult.confidence}`)
    console.log(`   Metoda: ${languageDetectionResult.detectionMethod}`)

    const anthropic = new Anthropic({ apiKey })

    console.log('🤖 Przygotowuję request do Claude API...')

    // KROK 2: Określ czy i jak podzielić dokument na chunki
    const CHUNK_THRESHOLD = 200000 // Dokumenty >200k znaków dzielimy na chunki
    const OVERLAP_SIZE = 5000 // Nakładanie się chunków (dla kontekstu na granicach)

    let chunks: string[] = []
    let chunkInfo = ''

    if (text.length > CHUNK_THRESHOLD) {
      // Oblicz liczbę chunków
      const numChunks = Math.ceil(text.length / CHUNK_THRESHOLD)
      const chunkSize = Math.floor(text.length / numChunks)

      console.log(`📊 Dokument jest duży (${text.length} znaków) - dzielę na ${numChunks} części`)

      for (let i = 0; i < numChunks; i++) {
        const start = Math.max(0, i * chunkSize - (i > 0 ? OVERLAP_SIZE : 0))
        const end = Math.min(text.length, (i + 1) * chunkSize + OVERLAP_SIZE)
        chunks.push(text.slice(start, end))
        console.log(`   Część ${i + 1}: znaki ${start}-${end} (${end - start} znaków)`)
      }

      chunkInfo = ` (Część dokumentu)`
    } else {
      chunks = [text]
      console.log(`📊 Dokument standardowy (${text.length} znaków) - przetwarzanie jednorazowe`)
    }

    // KROK 3: Tworzenie prompta w języku dokumentu
    let promptInstructions = ''

    if (languageDetectionResult.language === 'Angielski' || languageDetectionResult.languageCode === 'eng') {
      promptInstructions = `You are a terminology extraction expert. Extract ${minTerms}-${maxTerms} most important SPECIALIZED terms from the English text below.

CRITICAL RULES - READ CAREFULLY:
1. ANALYZE THE ENTIRE DOCUMENT from beginning to end - do NOT focus only on the initial sections
2. Extract terms distributed throughout the FULL text, not just from the start
3. Extract terms in their ORIGINAL ENGLISH form EXACTLY as they appear in the document
4. DO NOT translate terms to Polish, German, or any other language
5. Each term MUST exist verbatim in the source text (case-insensitive)
6. Focus on specialized/technical/legal/domain-specific terms only
7. Avoid common words like "the", "and", "or", "is", etc.
8. ONLY extract ENGLISH terms - if the document contains Polish/German/French terms, SKIP them entirely
9. If a term appears in multiple languages (e.g., "cooperation" and "współpraca"), ONLY extract the ENGLISH version

EXAMPLES OF CORRECT EXTRACTION:
- Document: "criminal investigation" → extract "criminal investigation" ✓ (full multi-word term)
- Document: "legal framework" → extract "legal framework" ✓ (full multi-word term)
- Document: "cooperation (współpraca)" → extract "cooperation" ONLY (NOT "współpraca") ✓ (language filtering)
- Document: "śledztwo (investigation)" → extract "investigation" ONLY (NOT "śledztwo") ✓ (language filtering)
- Document: "data protection" → extract "data protection" ✓ (NOT just "protection")

IMPORTANT: Many terms are multi-word phrases - extract the FULL specialized term, not individual words!

EXAMPLES OF INCORRECT EXTRACTION (DO NOT DO THIS):
- Document in English contains "śledztwo" → DO NOT extract "śledztwo" ✗
- Document in English contains "ramy prawne" → DO NOT extract "ramy prawne" ✗

CRITERIA:
- Minimum ${minLength} characters per term
- Minimum ${minOccurrences} occurrences in text
- Base forms (singular for nouns, infinitive for verbs)
- Single-word and multi-word terms allowed
- Terms must be SPECIALIZED (not common words)
- Terms must be in ENGLISH ONLY

Return ONLY valid JSON (no markdown, no explanation):
{
  "terms": [
    {"term": "exact term from document in English", "context": "...surrounding text in English (150-200 characters, include text before and after the term)...", "occurrences": number}
  ]
}

CONTEXT REQUIREMENTS:
- Context should be 150-200 characters long
- Include text BEFORE and AFTER the term for better understanding
- Should be a complete, readable sentence or phrase

IMPORTANT REMINDER: Analyze the COMPLETE document below. Even if you're extracting only ${minTerms}-${maxTerms} terms, read through ALL sections from start to finish to identify the most important terms across the ENTIRE text.

TEXT TO ANALYZE:`
    } else if (languageDetectionResult.language === 'Polski' || languageDetectionResult.languageCode === 'pol') {
      promptInstructions = `Jesteś ekspertem w ekstrakcji terminologii. Wyekstrahuj ${minTerms}-${maxTerms} najważniejszych SPECJALISTYCZNYCH terminów z poniższego polskiego tekstu.

KRYTYCZNE ZASADY - PRZECZYTAJ UWAŻNIE:
1. PRZEANALIZUJ CAŁY DOKUMENT od początku do końca - NIE skupiaj się tylko na początkowych sekcjach
2. Ekstrahuj terminy rozmieszczone w całym tekście, nie tylko z początku
3. Wyekstrahuj terminy w ich ORYGINALNEJ POLSKIEJ formie DOKŁADNIE tak jak występują w dokumencie
4. NIE tłumacz terminów na angielski, niemiecki ani żaden inny język
5. Każdy termin MUSI występować dosłownie w tekście źródłowym (wielkość liter nieistotna)
6. Skup się tylko na terminach specjalistycznych/technicznych/prawnych/domenowych
7. Unikaj zwykłych słów jak "oraz", "który", "jest", itp.
8. TYLKO ekstrahuj terminy POLSKIE - jeśli dokument zawiera terminy angielskie/niemieckie/francuskie, POMIŃ je całkowicie
9. Jeśli termin występuje w wielu językach (np. "współpraca" i "cooperation"), ekstrahuj TYLKO wersję POLSKĄ

PRZYKŁADY PRAWIDŁOWEJ EKSTRAKCJI:
- Dokument: "postępowanie karne" → ekstrahuj "postępowanie karne" ✓ (pełny wielowyrazowy termin)
- Dokument: "ramy prawne" → ekstrahuj "ramy prawne" ✓ (pełny wielowyrazowy termin)
- Dokument: "współpraca (cooperation)" → ekstrahuj "współpraca" TYLKO (NIE "cooperation") ✓ (filtrowanie języków)
- Dokument: "investigation (śledztwo)" → ekstrahuj "śledztwo" TYLKO (NIE "investigation") ✓ (filtrowanie języków)
- Dokument: "ochrona danych" → ekstrahuj "ochrona danych" ✓ (NIE tylko "ochrona")

WAŻNE: Wiele terminów to frazy wielowyrazowe - ekstrahuj PEŁNY specjalistyczny termin, nie pojedyncze słowa!

PRZYKŁADY NIEPRAWIDŁOWEJ EKSTRAKCJI (NIE RÓB TEGO):
- Dokument po polsku zawiera "investigation" → NIE ekstrahuj "investigation" ✗
- Dokument po polsku zawiera "legal framework" → NIE ekstrahuj "legal framework" ✗

KRYTERIA:
- Minimum ${minLength} znaków na termin
- Minimum ${minOccurrences} wystąpień w tekście
- Formy podstawowe (mianownik liczby pojedynczej, bezokolicznik)
- Terminy jedno i wielowyrazowe dozwolone
- Terminy muszą być SPECJALISTYCZNE (nie zwykłe słowa)
- Terminy muszą być TYLKO PO POLSKU

Zwróć TYLKO poprawny JSON (bez markdown, bez wyjaśnień):
{
  "terms": [
    {"term": "dokładny termin z dokumentu po polsku", "context": "...otaczający tekst po polsku (150-200 znaków, uwzględnij tekst przed i po terminie)...", "occurrences": liczba}
  ]
}

WYMAGANIA DOTYCZĄCE KONTEKSTU:
- Kontekst powinien mieć 150-200 znaków
- Uwzględnij tekst PRZED i PO terminie dla lepszego zrozumienia
- Powinien być kompletnym, czytelnym zdaniem lub frazą

WAŻNE PRZYPOMNIENIE: Przeanalizuj CAŁY dokument poniżej. Nawet jeśli ekstraktujesz tylko ${minTerms}-${maxTerms} terminów, przeczytaj wszystkie sekcje od początku do końca, aby zidentyfikować najważniejsze terminy w CAŁYM tekście.

TEKST DO ANALIZY:`
    } else {
      // Fallback dla innych języków UE
      const langName = languageDetectionResult.language
      promptInstructions = `You are a terminology extraction expert. Extract ${minTerms}-${maxTerms} most important SPECIALIZED terms from the text in ${langName}.

CRITICAL RULES:
1. ANALYZE THE ENTIRE DOCUMENT from beginning to end - do NOT focus only on the initial sections
2. Extract terms distributed throughout the FULL text, not just from the start
3. Extract terms in their ORIGINAL ${langName} form EXACTLY as they appear
4. DO NOT translate to English, Polish, or any other language
5. Each term MUST exist in the source text (case-insensitive)
6. Focus on specialized/technical/legal/domain-specific terms only
7. Avoid common words
8. ONLY extract terms in ${langName} - if the document contains terms in other languages, SKIP them entirely
9. If a term appears in multiple languages, ONLY extract the ${langName} version

IMPORTANT: Many terms are multi-word phrases - extract the FULL specialized term, not individual words!
For example:
- "criminal investigation" → extract "criminal investigation" ✓ (NOT just "investigation")
- "legal framework" → extract "legal framework" ✓ (NOT just "framework")

CRITERIA:
- Minimum ${minLength} characters
- Minimum ${minOccurrences} occurrences
- Base forms
- Terms must be SPECIALIZED
- Terms must be in ${langName} ONLY

Return ONLY valid JSON:
{
  "terms": [
    {"term": "exact term in ${langName}", "context": "context in ${langName} (150-200 characters, include text before and after the term)", "occurrences": number}
  ]
}

CONTEXT REQUIREMENTS:
- Context should be 150-200 characters long
- Include text BEFORE and AFTER the term for better understanding
- Should be a complete, readable sentence or phrase

IMPORTANT REMINDER: Analyze the COMPLETE document below. Even if you're extracting only ${minTerms}-${maxTerms} terms, read through ALL sections from start to finish to identify the most important terms across the ENTIRE text.

TEXT:`
    }

    // Model można skonfigurować przez zmienną środowiskową ANTHROPIC_MODEL
    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'

    // KROK 4: Przetwarzaj każdy chunk
    const allChunkTerms: any[] = []

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex]
      const chunkNumber = chunkIndex + 1
      const totalChunks = chunks.length

      console.log(`\n📦 Przetwarzam część ${chunkNumber}/${totalChunks}...`)

      // Dla chunków: dzielimy maxTerms przez liczbę chunków, ale mnożymy x1.5 dla większego pokrycia
      // (bo będą duplikaty między chunkami, które usuniemy później)
      const termsForThisChunk = chunks.length > 1
        ? Math.ceil((maxTerms / chunks.length) * 1.5)
        : maxTerms

      // Dynamiczny max_tokens w zależności od liczby terminów
      const estimatedTokensPerTerm = 120 // ~120 tokenów na termin (term + context + JSON structure)
      const baseTokens = 2000 // Bazowe tokeny na strukturę JSON i overhead
      const calculatedMaxTokens = Math.min(
        baseTokens + (termsForThisChunk * estimatedTokensPerTerm),
        16384 // Maksymalny limit dla Claude Sonnet 4 (16K output tokens)
      )

      console.log(`   Ekstrahuję do ${termsForThisChunk} terminów (max_tokens: ${calculatedMaxTokens})`)

      const message = await anthropic.messages.create({
        model,
        max_tokens: calculatedMaxTokens,
        messages: [
          {
            role: 'user',
            content: promptInstructions + '\n\n' + chunk
          }
        ]
      })

      console.log(`   ✅ Otrzymano odpowiedź dla części ${chunkNumber}/${totalChunks}`)

      // Ekstrakcja JSON z odpowiedzi
      const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

      console.log(`   📝 Długość odpowiedzi: ${responseText.length} znaków`)

      // Sprawdź czy odpowiedź została obcięta (stop_reason)
      if (message.stop_reason === 'max_tokens') {
        console.warn(`   ⚠️  UWAGA: Odpowiedź Claude została obcięta (max_tokens) dla części ${chunkNumber}`)
      }

      // Usuń markdown jeśli jest
      let cleanedResponse = responseText.trim()
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '')
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/```\n?/g, '')
      }

      // Znajdź JSON w odpowiedzi
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error(`   ❌ Nie znaleziono JSON w odpowiedzi dla części ${chunkNumber}`)
        console.error(`   Pomijam tę część i kontynuuję...`)
        continue
      }

      let parsedResponse
      try {
        parsedResponse = JSON.parse(jsonMatch[0])
      } catch (parseError: any) {
        console.error(`   ❌ Błąd parsowania JSON dla części ${chunkNumber}:`, parseError.message)
        console.error(`   Pomijam tę część i kontynuuję...`)
        continue
      }

      if (!parsedResponse.terms || !Array.isArray(parsedResponse.terms)) {
        console.error(`   ❌ Odpowiedź nie zawiera tablicy terminów dla części ${chunkNumber}`)
        console.error(`   Pomijam tę część i kontynuuję...`)
        continue
      }

      console.log(`   📊 Część ${chunkNumber}: Claude zwrócił ${parsedResponse.terms.length} terminów`)

      // Dodaj terminy z tego chunka do kolekcji
      allChunkTerms.push(...parsedResponse.terms.filter((term: any) => term && term.term))

      // Opóźnienie między requestami (jeśli jest więcej chunków)
      if (chunkIndex < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    console.log(`\n✅ Zakończono przetwarzanie wszystkich ${chunks.length} części`)
    console.log(`📊 Zebrano ${allChunkTerms.length} terminów (przed deduplikacją)`)

    // KROK 6: Deduplikacja terminów z normalizacją (plural/singular, and/or)
    // Używamy znormalizowanej formy jako klucza, ale zachowujemy wariant z największą liczbą wystąpień
    const uniqueTermsMap = new Map<string, any>()
    const normalizedKeyMap = new Map<string, string>() // normalizedKey -> originalKey

    for (let i = 0; i < allChunkTerms.length; i++) {
      const term = allChunkTerms[i]
      const termLower = term.term.toLowerCase()
      const normalizedKey = normalizeTermForComparison(term.term)

      // Generuj wszystkie warianty terminu (singular/plural)
      const termVariants = generateTermVariants(term.term)

      // Znajdź wystąpienia WSZYSTKICH wariantów w PEŁNYM dokumencie
      let allPositions: number[] = []
      const foundVariants: string[] = []

      for (const variant of termVariants) {
        const variantPositions = findTermPositions(text, variant)
        if (variantPositions.length > 0) {
          allPositions = [...allPositions, ...variantPositions]
          if (!foundVariants.includes(variant)) {
            foundVariants.push(variant)
          }
        }
      }

      // Usuń duplikaty pozycji i posortuj
      allPositions = Array.from(new Set(allPositions)).sort((a, b) => a - b)

      const positions = allPositions
      const occurrences = positions.length > 0 ? positions.length : (term.occurrences || 1)

      if (foundVariants.length > 1) {
        console.log(`   🔄 Znaleziono warianty dla "${term.term}": ${foundVariants.join(', ')} (razem ${occurrences}x)`)
      }

      // Sprawdź czy mamy już termin o tej samej znormalizowanej formie
      if (normalizedKeyMap.has(normalizedKey)) {
        const existingKey = normalizedKeyMap.get(normalizedKey)!
        const existing = uniqueTermsMap.get(existingKey)

        // Pozycje są już połączone dla wszystkich wariantów, więc bierzemy unię (bez duplikatów)
        const combinedPositions = Array.from(new Set([...existing.positions, ...positions])).sort((a, b) => a - b)

        // Połącz warianty
        const allVariants = Array.from(new Set([
          ...(existing.variants || [existing.term]),
          ...foundVariants
        ]))

        // Zaktualizuj istniejący termin
        existing.positions = combinedPositions.slice(0, 100)
        existing.occurrences = combinedPositions.length
        existing.variants = allVariants

        // Zaktualizuj kontekst jeśli nowy jest lepszy
        if (term.context && term.context.length > (existing.context?.length || 0)) {
          existing.context = term.context
        }

        // Preferuj formę pojedynczą jako główny termin
        const preferredForm = getPreferredTermForm(existing.term, term.term)
        if (preferredForm !== existing.term) {
          console.log(`   ➕ Łączę "${term.term}" z "${existing.term}" → główny termin: "${preferredForm}" (singular) - warianty: ${allVariants.join(', ')} (${existing.occurrences}x)`)
          existing.term = preferredForm
        } else {
          console.log(`   ➕ Łączę "${term.term}" z "${existing.term}" - warianty: ${allVariants.join(', ')} (${existing.occurrences}x)`)
        }
      } else if (!uniqueTermsMap.has(termLower)) {
        // Nowy termin - dodaj do mapy z wariantami
        uniqueTermsMap.set(termLower, {
          id: `term-${i}-${Date.now()}`,
          term: term.term,
          context: term.context || '',
          occurrences: occurrences,
          positions: positions.slice(0, 100),
          variants: foundVariants.length > 1 ? foundVariants : undefined
        })
        normalizedKeyMap.set(normalizedKey, termLower)
      } else {
        // Termin już istnieje (dokładnie ta sama forma) - zaktualizuj kontekst jeśli lepszy
        const existing = uniqueTermsMap.get(termLower)
        if (term.context && term.context.length > (existing.context?.length || 0)) {
          existing.context = term.context
        }
      }
    }

    const allTerms = Array.from(uniqueTermsMap.values())

    console.log(`🔍 Po deduplikacji: ${allTerms.length} unikalnych terminów`)

    // KROK 7: WALIDACJA - odrzuć terminy które nie występują w dokumencie
    const validatedTerms = allTerms.filter((term: Term) => {
      // Sprawdź czy termin rzeczywiście występuje w tekście
      const exists = term.positions.length > 0

      if (!exists) {
        console.log(`⚠️  ODRZUCAM termin "${term.term}" - nie występuje w dokumencie (prawdopodobnie tłumaczenie!)`)
      }

      return exists && term.occurrences >= minOccurrences
    })

    console.log(`✂️  Po walidacji: ${validatedTerms.length} terminów`)
    console.log(`   Odrzucono ${allTerms.length - validatedTerms.length} terminów (nie znaleziono w dokumencie)`)

    // KROK 7.5: WERYFIKACJA I NAPRAWA KONTEKSTÓW
    // Upewnij się, że każdy kontekst zawiera termin - jeśli nie, wygeneruj nowy
    let fixedContextCount = 0
    validatedTerms.forEach((term: Term) => {
      const termLower = term.term.toLowerCase()
      const contextLower = (term.context || '').toLowerCase()

      // Sprawdź czy kontekst zawiera termin (lub jego warianty)
      const termVariants = term.variants || [term.term]
      const contextContainsTerm = termVariants.some(variant =>
        contextLower.includes(variant.toLowerCase())
      )

      if (!contextContainsTerm && term.positions.length > 0) {
        // Wygeneruj nowy kontekst z dokumentu
        const firstPosition = term.positions[0]
        const contextStart = Math.max(0, firstPosition - 80)
        const contextEnd = Math.min(text.length, firstPosition + term.term.length + 120)
        const newContext = text.slice(contextStart, contextEnd).trim()

        // Dodaj elipsy jeśli kontekst jest ucięty
        term.context = (contextStart > 0 ? '...' : '') + newContext + (contextEnd < text.length ? '...' : '')
        fixedContextCount++
        console.log(`   🔧 Naprawiono kontekst dla "${term.term}"`)
      }
    })

    if (fixedContextCount > 0) {
      console.log(`🔧 Naprawiono ${fixedContextCount} kontekstów`)
    }

    // KROK 8: Jeśli mamy więcej terminów niż maxTerms, wybierz top terminy (według liczby wystąpień)
    let finalTerms = validatedTerms
    if (validatedTerms.length > maxTerms) {
      console.log(`📊 Ograniczam do ${maxTerms} najważniejszych terminów (według liczby wystąpień)`)
      finalTerms = validatedTerms
        .sort((a: Term, b: Term) => b.occurrences - a.occurrences)
        .slice(0, maxTerms)
    }

    // Sortuj alfabetycznie dla końcowego wyniku
    finalTerms.sort((a: Term, b: Term) => a.term.localeCompare(b.term, 'pl'))

    console.log('✅ Ekstrakcja zakończona sukcesem (Anthropic API)')
    console.log(`   Język dokumentu: ${languageDetectionResult.language}`)
    console.log(`   Język terminów: ${languageDetectionResult.language}`)
    console.log(`   Liczba terminów: ${finalTerms.length}`)

    // WERYFIKACJA: Sprawdź czy użytkownik ustawił zbyt niską liczbę terminów
    let suggestion = null
    const documentLength = text.length
    const extractedCount = finalTerms.length
    const utilizationRate = extractedCount / maxTerms

    // Sugestia jeśli:
    // 1. Zwrócono >=90% maxTerms (prawdopodobnie było więcej do wyekstrahowania)
    // 2. Długi dokument (>5000 znaków) a mało terminów (<30)
    // 3. Bardzo długi dokument (>10000 znaków) a mało terminów (<50)
    if (utilizationRate >= 0.9 && maxTerms < 100) {
      suggestion = `Wyekstrahowano ${extractedCount} z maksymalnie ${maxTerms} terminów (${Math.round(utilizationRate * 100)}%). W dokumencie mogą znajdować się dodatkowe istotne terminy. Rozważ zwiększenie maksymalnej liczby terminów do ${Math.min(maxTerms + 30, 150)}-${Math.min(maxTerms + 50, 200)}.`
    } else if (documentLength > 10000 && maxTerms < 50) {
      suggestion = `Dokument zawiera ${documentLength} znaków - to stosunkowo długi tekst. Dla kompleksowego glosariusza sugerujemy zwiększenie maksymalnej liczby terminów do minimum 50-80.`
    } else if (documentLength > 5000 && maxTerms < 30) {
      suggestion = `Dokument zawiera ${documentLength} znaków. Dla bardziej kompleksowego glosariusza rozważ zwiększenie maksymalnej liczby terminów do 40-60.`
    }

    if (suggestion) {
      console.log(`💡 Sugestia: ${suggestion}`)
    }

    return NextResponse.json({
      terms: finalTerms,
      suggestion: suggestion
    })

  } catch (error: any) {
    console.error('❌ Błąd podczas ekstrakcji:', error)

    // Szczegółowe obsługiwanie błędów z Anthropic API
    if (error.status === 401) {
      return NextResponse.json(
        { terms: [], error: 'Nieprawidłowy klucz API. Sprawdź czy klucz jest poprawny i aktywny.' },
        { status: 401 }
      )
    }

    if (error.status === 429) {
      return NextResponse.json(
        { terms: [], error: 'Przekroczono limit API. Poczekaj chwilę i spróbuj ponownie.' },
        { status: 429 }
      )
    }

    if (error.status === 400) {
      return NextResponse.json(
        { terms: [], error: 'Błąd w requestcie do API: ' + (error.message || 'Nieznany błąd') },
        { status: 400 }
      )
    }

    // Ogólny błąd
    return NextResponse.json(
      { terms: [], error: 'Błąd: ' + (error.message || 'Nieznany błąd. Sprawdź klucz API i spróbuj ponownie.') },
      { status: 500 }
    )
  }
}

// Funkcja pomocnicza do escape'owania znaków specjalnych w regex
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Funkcja pomocnicza do znajdowania pozycji terminu w tekście (case insensitive)
function findTermPositions(text: string, term: string): number[] {
  const positions: number[] = []
  const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, 'gi') // case insensitive
  const matches = Array.from(text.matchAll(regex))

  matches.forEach(match => {
    if (match.index !== undefined) {
      positions.push(match.index)
    }
  })

  // Ogranicz do 100 wystąpień (dla wydajności)
  return positions.slice(0, 100)
}

// Normalizacja liczby mnogiej do pojedynczej (angielski)
function singularize(word: string): string {
  const lower = word.toLowerCase()

  // Wyjątki - słowa które nie zmieniają się lub mają nieregularną formę
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
    'matrices': 'matrix'
  }

  if (irregulars[lower]) {
    return irregulars[lower]
  }

  // Słowa kończące się na -ies -> -y (np. authorities -> authority)
  if (lower.endsWith('ies') && lower.length > 4) {
    return lower.slice(0, -3) + 'y'
  }

  // Słowa kończące się na -es (po s, x, z, ch, sh) -> usunięcie -es
  if (lower.endsWith('sses') || lower.endsWith('xes') ||
      lower.endsWith('zes') || lower.endsWith('ches') ||
      lower.endsWith('shes')) {
    return lower.slice(0, -2)
  }

  // Słowa kończące się na -ves -> -f lub -fe (np. lives -> life)
  if (lower.endsWith('ves')) {
    // Sprawdź czy lepiej -f czy -fe
    const withF = lower.slice(0, -3) + 'f'
    const withFe = lower.slice(0, -3) + 'fe'
    // Preferuj -fe dla typowych słów
    if (['lives', 'wives', 'knives', 'leaves', 'halves'].includes(lower)) {
      return withFe
    }
    return withF
  }

  // Standardowe -s na końcu -> usunięcie -s
  if (lower.endsWith('s') && lower.length > 3 && !lower.endsWith('ss') && !lower.endsWith('us') && !lower.endsWith('is')) {
    return lower.slice(0, -1)
  }

  return lower
}

// Normalizacja terminu do porównania (deduplikacja)
// Zamienia plural na singular, zachowuje spójniki (and/or) bez zmian
function normalizeTermForComparison(term: string): string {
  // 1. Normalizuj "&" do "and" (to ten sam spójnik)
  let normalized = term.toLowerCase()
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

// Funkcja do sprawdzania czy dwa terminy są wariantami (singular/plural)
function areTermVariants(term1: string, term2: string): boolean {
  const norm1 = normalizeTermForComparison(term1)
  const norm2 = normalizeTermForComparison(term2)
  return norm1 === norm2
}

// Generuj warianty terminu (singular/plural)
function generateTermVariants(term: string): string[] {
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

  return variants
}

// Konwersja liczby pojedynczej na mnogą (angielski)
function pluralize(word: string): string {
  const lower = word.toLowerCase()

  // Wyjątki - nieregularne formy
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
    'activity': 'activities'
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

// Sprawdź czy termin jest w formie pojedynczej (wszystkie słowa)
function isTermSingular(term: string): boolean {
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
function getPreferredTermForm(term1: string, term2: string): string {
  const term1IsSingular = isTermSingular(term1)
  const term2IsSingular = isTermSingular(term2)

  // Preferuj formę pojedynczą
  if (term1IsSingular && !term2IsSingular) {
    return term1
  }
  if (term2IsSingular && !term1IsSingular) {
    return term2
  }

  // Obie formy są takie same - preferuj krótszy termin
  return term1.length <= term2.length ? term1 : term2
}
