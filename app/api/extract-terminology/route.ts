import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { detectLanguage } from '@/utils/languageDetector'

interface Term {
  id: string
  term: string
  context: string
  occurrences: number
  positions: number[]
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

    // Limit tekstu - 200,000 znaków (ok. 100 stron)
    // Uwaga: dla dokumentów >100 stron zalecane jest podzielenie na mniejsze fragmenty
    if (text.length > 200000) {
      return NextResponse.json(
        { terms: [], error: `Dokument jest zbyt długi (${text.length.toLocaleString()} znaków). Maksymalna długość: 200,000 znaków (ok. 100 stron). Podziel dokument na mniejsze fragmenty.` },
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

    console.log('🤖 Wysyłam request do Claude API...')

    // KROK 2: Tworzenie prompta w języku dokumentu
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

    // Dynamiczny max_tokens w zależności od liczby terminów
    // Dla wielu terminów potrzeba więcej tokenów na odpowiedź
    const estimatedTokensPerTerm = 100 // ~100 tokenów na termin (term + context)
    const baseTokens = 1000 // Bazowe tokeny na strukturę JSON
    const calculatedMaxTokens = Math.min(
      baseTokens + (maxTerms * estimatedTokensPerTerm),
      8192 // Maksymalny limit dla Claude
    )

    console.log(`🔢 Maksymalna liczba tokenów dla odpowiedzi: ${calculatedMaxTokens} (dla ${maxTerms} terminów)`)

    const message = await anthropic.messages.create({
      model,
      max_tokens: calculatedMaxTokens,
      messages: [
        {
          role: 'user',
          content: promptInstructions + '\n\n' + text
        }
      ]
    })

    console.log('✅ Otrzymano odpowiedź z Claude API')

    // KROK 3: Ekstrakcja JSON z odpowiedzi
    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    console.log('📝 Długość odpowiedzi:', responseText.length, 'znaków')
    console.log('📝 Pierwszych 300 znaków odpowiedzi:', responseText.substring(0, 300))

    // Sprawdź czy odpowiedź została obcięta (stop_reason)
    if (message.stop_reason === 'max_tokens') {
      console.warn('⚠️  UWAGA: Odpowiedź Claude została obcięta (max_tokens)!')
      console.warn(`   Rozważ zmniejszenie liczby terminów lub zwiększenie max_tokens`)
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
      console.error('❌ Nie znaleziono JSON w odpowiedzi')
      console.error('Pełna odpowiedź Claude (pierwsze 1000 znaków):')
      console.error(responseText.substring(0, 1000))
      console.error('Ostatnie 500 znaków odpowiedzi:')
      console.error(responseText.substring(Math.max(0, responseText.length - 500)))
      return NextResponse.json(
        { terms: [], error: 'Claude nie zwrócił poprawnego JSON. Odpowiedź mogła zostać obcięta. Spróbuj zmniejszyć liczbę terminów.' },
        { status: 500 }
      )
    }

    let parsedResponse
    try {
      parsedResponse = JSON.parse(jsonMatch[0])
    } catch (parseError: any) {
      console.error('❌ Błąd parsowania JSON:', parseError.message)
      console.error('Pozycja błędu:', parseError.message)
      console.error('JSON do parsowania (pierwsze 1000 znaków):', jsonMatch[0].substring(0, 1000))
      console.error('JSON do parsowania (ostatnie 500 znaków):', jsonMatch[0].substring(Math.max(0, jsonMatch[0].length - 500)))

      // Sprawdź czy JSON jest obcięty (brak zamykającego nawiasu)
      const openBraces = (jsonMatch[0].match(/\{/g) || []).length
      const closeBraces = (jsonMatch[0].match(/\}/g) || []).length
      const openBrackets = (jsonMatch[0].match(/\[/g) || []).length
      const closeBrackets = (jsonMatch[0].match(/\]/g) || []).length

      if (openBraces > closeBraces || openBrackets > closeBrackets) {
        console.error('❌ JSON jest niekompletny (obcięty)!')
        console.error(`   Nawiasy klamrowe: ${openBraces} otwierających, ${closeBraces} zamykających`)
        console.error(`   Nawiasy kwadratowe: ${openBrackets} otwierających, ${closeBrackets} zamykających`)
        return NextResponse.json(
          { terms: [], error: `Odpowiedź została obcięta (za dużo terminów). Zmniejsz liczbę terminów z ${maxTerms} do ${Math.floor(maxTerms * 0.7)} i spróbuj ponownie.` },
          { status: 500 }
        )
      }

      return NextResponse.json(
        { terms: [], error: 'Błąd parsowania odpowiedzi: ' + parseError.message + '. Spróbuj ponownie lub zmniejsz liczbę terminów.' },
        { status: 500 }
      )
    }

    if (!parsedResponse.terms || !Array.isArray(parsedResponse.terms)) {
      console.error('❌ Odpowiedź nie zawiera tablicy terminów')
      return NextResponse.json(
        { terms: [], error: 'Nieprawidłowy format odpowiedzi. Spróbuj ponownie.' },
        { status: 500 }
      )
    }

    console.log(`📊 Claude zwrócił ${parsedResponse.terms.length} terminów`)

    // KROK 4: Przetwórz terminy i znajdź ich pozycje w tekście
    const allTerms = parsedResponse.terms
      .filter((term: any) => term && term.term) // Filtruj puste terminy
      .map((term: any, index: number) => {
        // Znajdź wszystkie wystąpienia terminu w tekście
        const positions = findTermPositions(text, term.term)

        return {
          id: `term-${index}-${Date.now()}`,
          term: term.term,
          context: term.context || '',
          occurrences: positions.length > 0 ? positions.length : (term.occurrences || 1),
          positions: positions
        }
      })

    console.log(`🔍 Przed walidacją: ${allTerms.length} terminów`)

    // KROK 5: WALIDACJA - odrzuć terminy które nie występują w dokumencie
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

    // Sortuj alfabetycznie
    validatedTerms.sort((a: Term, b: Term) => a.term.localeCompare(b.term, 'pl'))

    console.log('✅ Ekstrakcja zakończona sukcesem (Anthropic API)')
    console.log(`   Język dokumentu: ${languageDetectionResult.language}`)
    console.log(`   Język terminów: ${languageDetectionResult.language}`)
    console.log(`   Liczba terminów: ${validatedTerms.length}`)

    // WERYFIKACJA: Sprawdź czy użytkownik ustawił zbyt niską liczbę terminów
    let suggestion = null
    const documentLength = text.length
    const extractedCount = validatedTerms.length
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
      terms: validatedTerms,
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

// Funkcja pomocnicza do znajdowania pozycji terminu w tekście (case sensitive)
function findTermPositions(text: string, term: string): number[] {
  const positions: number[] = []
  const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, 'g')
  const matches = Array.from(text.matchAll(regex))

  matches.forEach(match => {
    if (match.index !== undefined) {
      positions.push(match.index)
    }
  })

  // Ogranicz do 100 wystąpień (dla wydajności)
  return positions.slice(0, 100)
}
