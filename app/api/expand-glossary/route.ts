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

export const maxDuration = 300 // Timeout 300 sekund dla Vercel Pro
export const runtime = 'nodejs'

/**
 * Endpoint do rozbudowania istniejącego glosariusza
 * Generuje dodatkowe terminy bez utraty już istniejących
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔵 Otrzymano request do /api/expand-glossary')

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

    const {
      text,
      apiKey,
      existingTerms = [],
      newMaxTerms,
      minLength = 3,
      minOccurrences = 1,
      detectedLanguage = 'nieznany'
    } = body

    // Walidacja
    if (!text) {
      return NextResponse.json(
        { terms: [], error: 'Brak tekstu do analizy' },
        { status: 400 }
      )
    }

    if (!apiKey || !apiKey.startsWith('sk-ant-')) {
      return NextResponse.json(
        { terms: [], error: 'Nieprawidłowy klucz API' },
        { status: 400 }
      )
    }

    if (!newMaxTerms || newMaxTerms <= existingTerms.length) {
      return NextResponse.json(
        { terms: [], error: `Nowa maksymalna liczba terminów (${newMaxTerms}) musi być większa od liczby istniejących terminów (${existingTerms.length})` },
        { status: 400 }
      )
    }

    const currentCount = existingTerms.length
    const additionalTermsNeeded = newMaxTerms - currentCount

    console.log(`🔄 Rozbudowa glosariusza:`)
    console.log(`   Istniejące terminy: ${currentCount}`)
    console.log(`   Nowy maksymalny limit: ${newMaxTerms}`)
    console.log(`   Dodatkowe terminy do wygenerowania: ${additionalTermsNeeded}`)

    // Wykryj język
    const languageDetectionResult = detectLanguage(text)
    console.log(`🔬 Wykryty język: ${languageDetectionResult.language} (${languageDetectionResult.languageCode})`)

    const anthropic = new Anthropic({ apiKey })

    // Przygotuj listę istniejących terminów do wykluczenia
    const existingTermsList = existingTerms.map((t: any) => t.term).join('", "')

    // KROK 1: Tworzenie prompta
    let promptInstructions = ''

    if (languageDetectionResult.language === 'Angielski' || languageDetectionResult.languageCode === 'eng') {
      promptInstructions = `You are a terminology extraction expert. Extract approximately ${additionalTermsNeeded} ADDITIONAL specialized terms from the English text below.

CRITICAL RULES:
1. ANALYZE THE ENTIRE DOCUMENT from beginning to end
2. Extract terms distributed throughout the FULL text
3. Extract terms in their ORIGINAL ENGLISH form EXACTLY as they appear
4. DO NOT translate terms to Polish, German, or any other language
5. Each term MUST exist verbatim in the source text (case-insensitive)
6. Focus on specialized/technical/legal/domain-specific terms only
7. Avoid common words
8. ONLY extract ENGLISH terms

IMPORTANT - EXCLUDE THESE EXISTING TERMS (do NOT extract them again):
"${existingTermsList}"

You must find NEW terms that are NOT in the list above.

CRITERIA:
- Minimum ${minLength} characters per term
- Minimum ${minOccurrences} occurrences in text
- Base forms (singular for nouns, infinitive for verbs)
- Single-word and multi-word terms allowed
- Terms must be SPECIALIZED (not common words)
- Terms must be in ENGLISH ONLY
- Terms must be DIFFERENT from existing terms

Return ONLY valid JSON (no markdown, no explanation):
{
  "terms": [
    {"term": "exact NEW term from document in English", "context": "...surrounding text in English (150-200 characters)...", "occurrences": number}
  ]
}

CONTEXT REQUIREMENTS:
- Context should be 150-200 characters long
- Include text BEFORE and AFTER the term
- Should be a complete, readable sentence or phrase

TEXT TO ANALYZE:`
    } else if (languageDetectionResult.language === 'Polski' || languageDetectionResult.languageCode === 'pol') {
      promptInstructions = `Jesteś ekspertem w ekstrakcji terminologii. Wyekstrahuj około ${additionalTermsNeeded} DODATKOWYCH specjalistycznych terminów z poniższego polskiego tekstu.

KRYTYCZNE ZASADY:
1. PRZEANALIZUJ CAŁY DOKUMENT od początku do końca
2. Ekstrahuj terminy rozmieszczone w całym tekście
3. Wyekstrahuj terminy w ich ORYGINALNEJ POLSKIEJ formie DOKŁADNIE tak jak występują w dokumencie
4. NIE tłumacz terminów na angielski, niemiecki ani żaden inny język
5. Każdy termin MUSI występować dosłownie w tekście źródłowym
6. Skup się tylko na terminach specjalistycznych/technicznych/prawnych/domenowych
7. Unikaj zwykłych słów
8. TYLKO ekstrahuj terminy POLSKIE

WAŻNE - WYKLUCZ TE ISTNIEJĄCE TERMINY (NIE ekstrahuj ich ponownie):
"${existingTermsList}"

Musisz znaleźć NOWE terminy, których NIE MA na powyższej liście.

KRYTERIA:
- Minimum ${minLength} znaków na termin
- Minimum ${minOccurrences} wystąpień w tekście
- Formy podstawowe (mianownik liczby pojedynczej, bezokolicznik)
- Terminy jedno i wielowyrazowe dozwolone
- Terminy muszą być SPECJALISTYCZNE
- Terminy muszą być TYLKO PO POLSKU
- Terminy muszą być RÓŻNE od istniejących

Zwróć TYLKO poprawny JSON (bez markdown, bez wyjaśnień):
{
  "terms": [
    {"term": "dokładny NOWY termin z dokumentu po polsku", "context": "...otaczający tekst po polsku (150-200 znaków)...", "occurrences": liczba}
  ]
}

WYMAGANIA DOTYCZĄCE KONTEKSTU:
- Kontekst powinien mieć 150-200 znaków
- Uwzględnij tekst PRZED i PO terminie
- Powinien być kompletnym, czytelnym zdaniem lub frazą

TEKST DO ANALIZY:`
    } else {
      // Fallback dla innych języków
      const langName = languageDetectionResult.language
      promptInstructions = `You are a terminology extraction expert. Extract approximately ${additionalTermsNeeded} ADDITIONAL specialized terms from the text in ${langName}.

CRITICAL RULES:
1. ANALYZE THE ENTIRE DOCUMENT from beginning to end
2. Extract terms in their ORIGINAL ${langName} form EXACTLY as they appear
3. DO NOT translate to English, Polish, or any other language
4. Each term MUST exist in the source text
5. Focus on specialized/technical/legal/domain-specific terms only
6. ONLY extract terms in ${langName}

IMPORTANT - EXCLUDE THESE EXISTING TERMS (do NOT extract them again):
"${existingTermsList}"

You must find NEW terms that are NOT in the list above.

CRITERIA:
- Minimum ${minLength} characters
- Minimum ${minOccurrences} occurrences
- Base forms
- Terms must be SPECIALIZED
- Terms must be in ${langName} ONLY
- Terms must be DIFFERENT from existing terms

Return ONLY valid JSON:
{
  "terms": [
    {"term": "exact NEW term in ${langName}", "context": "context in ${langName} (150-200 characters)", "occurrences": number}
  ]
}

TEXT:`
    }

    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'

    console.log('🤖 Wysyłam request do Claude API (expand glossary)...')

    const message = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: promptInstructions + '\n\n' + text
        }
      ]
    })

    console.log('✅ Otrzymano odpowiedź z Claude API')

    // Ekstrakcja JSON z odpowiedzi
    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    let cleanedResponse = responseText.trim()
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/```\n?/g, '')
    }

    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('❌ Nie znaleziono JSON w odpowiedzi')
      return NextResponse.json(
        { terms: [], error: 'Claude nie zwrócił poprawnego JSON' },
        { status: 500 }
      )
    }

    let parsedResponse
    try {
      parsedResponse = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      console.error('❌ Błąd parsowania JSON:', parseError)
      return NextResponse.json(
        { terms: [], error: 'Błąd parsowania odpowiedzi' },
        { status: 500 }
      )
    }

    if (!parsedResponse.terms || !Array.isArray(parsedResponse.terms)) {
      console.error('❌ Odpowiedź nie zawiera tablicy terminów')
      return NextResponse.json(
        { terms: [], error: 'Nieprawidłowy format odpowiedzi' },
        { status: 500 }
      )
    }

    console.log(`📊 Claude zwrócił ${parsedResponse.terms.length} nowych terminów`)

    // Przetwórz nowe terminy
    const newTerms = parsedResponse.terms
      .filter((term: any) => term && term.term)
      .map((term: any, index: number) => {
        const positions = findTermPositions(text, term.term)

        return {
          id: `term-expanded-${index}-${Date.now()}`,
          term: term.term,
          context: term.context || '',
          occurrences: positions.length > 0 ? positions.length : (term.occurrences || 1),
          positions: positions
        }
      })

    // WALIDACJA 1: Odrzuć terminy które nie występują w dokumencie
    let validatedTerms = newTerms.filter((term: Term) => {
      const exists = term.positions.length > 0
      if (!exists) {
        console.log(`⚠️  ODRZUCAM nowy termin "${term.term}" - nie występuje w dokumencie`)
      }
      return exists && term.occurrences >= minOccurrences
    })

    // WALIDACJA 2: Odrzuć terminy które już istnieją (case-insensitive)
    const existingTermsLower = new Set(existingTerms.map((t: any) => t.term.toLowerCase()))
    const beforeDedupCount = validatedTerms.length

    validatedTerms = validatedTerms.filter((term: Term) => {
      const isDuplicate = existingTermsLower.has(term.term.toLowerCase())
      if (isDuplicate) {
        console.log(`⚠️  ODRZUCAM termin "${term.term}" - już istnieje w glosariuszu`)
      }
      return !isDuplicate
    })

    console.log(`✂️  Walidacja:`)
    console.log(`   Po sprawdzeniu występowania: ${newTerms.length} → ${beforeDedupCount} terminów`)
    console.log(`   Po deuplikacji: ${beforeDedupCount} → ${validatedTerms.length} terminów`)
    console.log(`   Odrzucono duplikatów: ${beforeDedupCount - validatedTerms.length}`)

    // Sortuj alfabetycznie
    validatedTerms.sort((a: Term, b: Term) => a.term.localeCompare(b.term, 'pl'))

    console.log('✅ Rozbudowa glosariusza zakończona sukcesem')
    console.log(`   Nowych terminów: ${validatedTerms.length}`)
    console.log(`   Łącznie terminów będzie: ${currentCount + validatedTerms.length}`)

    return NextResponse.json({
      terms: validatedTerms,
      stats: {
        existingCount: currentCount,
        newCount: validatedTerms.length,
        totalCount: currentCount + validatedTerms.length,
        requestedAdditional: additionalTermsNeeded
      }
    })

  } catch (error: any) {
    console.error('❌ Błąd podczas rozbudowy glosariusza:', error)

    if (error.status === 401) {
      return NextResponse.json(
        { terms: [], error: 'Nieprawidłowy klucz API' },
        { status: 401 }
      )
    }

    if (error.status === 429) {
      return NextResponse.json(
        { terms: [], error: 'Przekroczono limit API' },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { terms: [], error: 'Błąd: ' + (error.message || 'Nieznany błąd') },
      { status: 500 }
    )
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function findTermPositions(text: string, term: string): number[] {
  const positions: number[] = []
  const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, 'g')
  const matches = Array.from(text.matchAll(regex))

  matches.forEach(match => {
    if (match.index !== undefined) {
      positions.push(match.index)
    }
  })

  return positions.slice(0, 100)
}
