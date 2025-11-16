import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

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
    console.log(`🌍 Wykryty język: ${detectedLanguage}`)
    console.log(`⚙️  Parametry: ${minTerms}-${maxTerms} terminów, min ${minLength} znaków, min ${minOccurrences} wystąpień`)

    const anthropic = new Anthropic({ apiKey })

    console.log('🤖 Wysyłam request do Claude API...')

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Wyekstrahuj ${minTerms}-${maxTerms} najważniejszych terminów specjalistycznych z poniższego tekstu.

WYKRYTY JĘZYK DOKUMENTU: ${detectedLanguage}

KRYTERIA EKSTRAKCJI:
- Minimum ${minLength} znaków
- Minimum ${minOccurrences} wystąpień w tekście
- Formy podstawowe (mianownik l.p. dla rzeczowników)
- Terminy jedno i wielowyrazowe
- Priorytet: terminy częste, kluczowe dla treści

WAŻNE - JĘZYK TERMINÓW:
- Terminy MUSZĄ być w tym samym języku co dokument źródłowy (${detectedLanguage})
- NIE tłumacz terminów na żaden inny język
- Zachowaj oryginalne brzmienie terminów z dokumentu
- Kontekst również w języku dokumentu

Zwróć TYLKO JSON (bez markdown):
{
  "terms": [
    {
      "term": "termin w formie podstawowej w języku ${detectedLanguage}",
      "context": "krótki kontekst w języku ${detectedLanguage} (1-2 zdania)",
      "occurrences": liczba_wystąpień
    }
  ]
}

TEKST DO ANALIZY:
${text}`
        }
      ]
    })

    console.log('✅ Otrzymano odpowiedź z Claude API')

    // Ekstrakcja JSON z odpowiedzi
    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    console.log('📝 Pierwszych 200 znaków odpowiedzi:', responseText.substring(0, 200))

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
      console.error('Odpowiedź Claude:', responseText.substring(0, 500))
      return NextResponse.json(
        { terms: [], error: 'Claude nie zwrócił poprawnego JSON. Spróbuj ponownie.' },
        { status: 500 }
      )
    }

    let parsedResponse
    try {
      parsedResponse = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      console.error('❌ Błąd parsowania JSON:', parseError)
      console.error('JSON do parsowania:', jsonMatch[0].substring(0, 500))
      return NextResponse.json(
        { terms: [], error: 'Błąd parsowania odpowiedzi. Spróbuj ponownie.' },
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

    console.log(`📊 Znaleziono ${parsedResponse.terms.length} terminów z Claude`)

    // Przetwórz terminy i znajdź ich pozycje w tekście
    const allTerms = parsedResponse.terms
      .filter((term: any) => term && term.term) // Filtruj puste terminy
      .map((term: any, index: number) => {
        const positions = findTermPositions(text, term.term)
        return {
          id: `term-${index}-${Date.now()}`,
          term: term.term,
          context: term.context || '',
          occurrences: positions.length > 0 ? positions.length : (term.occurrences || 1),
          positions: positions
        }
      })

    console.log(`🔍 Przed filtrowaniem: ${allTerms.length} terminów`)

    // Filtruj według minimalnej liczby wystąpień
    const processedTerms: Term[] = allTerms.filter((term: Term) => term.occurrences >= minOccurrences)

    console.log(`✂️  Po filtrowaniu (min ${minOccurrences} wystąpień): ${processedTerms.length} terminów`)

    // Sortuj alfabetycznie
    processedTerms.sort((a, b) => a.term.localeCompare(b.term, 'pl'))

    console.log('✅ Ekstrakcja zakończona sukcesem')

    return NextResponse.json({ terms: processedTerms })

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

// Funkcja pomocnicza do znajdowania pozycji terminu w tekście
function findTermPositions(text: string, term: string): number[] {
  const positions: number[] = []
  const lowerText = text.toLowerCase()
  const lowerTerm = term.toLowerCase()
  let position = lowerText.indexOf(lowerTerm)

  while (position !== -1) {
    positions.push(position)
    position = lowerText.indexOf(lowerTerm, position + 1)

    // Ogranicz do 50 wystąpień
    if (positions.length >= 50) break
  }

  return positions
}
