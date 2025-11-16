import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { detectLanguage } from '@/utils/languageDetector'
import { extractTermsHybrid } from '@/utils/nlpExtractor'

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

    // KROK 2: Ekstrakcja NLP (główna metoda - NIE TŁUMACZY!)
    console.log('🧬 Rozpoczynam ekstrakcję NLP/POS tagging...')
    const nlpTerms = extractTermsHybrid(
      text,
      minLength,
      minOccurrences,
      maxTerms,
      languageDetectionResult.languageCode
    )

    console.log(`📊 NLP wyekstrahowało ${nlpTerms.length} terminów`)

    // KROK 3: Konwersja do formatu Term
    const processedTerms: Term[] = nlpTerms.map((nlpTerm, index) => ({
      id: `term-${index}-${Date.now()}`,
      term: nlpTerm.term,
      context: nlpTerm.context,
      occurrences: nlpTerm.occurrences,
      positions: nlpTerm.positions
    }))

    // KROK 4: Walidacja - sprawdź czy terminy faktycznie występują w tekście
    console.log('✅ Walidacja terminów...')
    const validatedTerms = processedTerms.filter(term => {
      // Sprawdź czy termin występuje w tekście (case-insensitive)
      const regex = new RegExp(escapeRegex(term.term), 'i')
      const exists = regex.test(text)

      if (!exists) {
        console.log(`⚠️  Odrzucam termin "${term.term}" - nie występuje w dokumencie`)
      }

      return exists
    })

    console.log(`🔍 Po walidacji: ${validatedTerms.length} terminów`)

    // Sortuj alfabetycznie
    validatedTerms.sort((a, b) => a.term.localeCompare(b.term, 'pl'))

    console.log('✅ Ekstrakcja zakończona sukcesem (metoda NLP - bez tłumaczenia)')
    console.log(`   Język dokumentu: ${languageDetectionResult.language}`)
    console.log(`   Język terminów: ${languageDetectionResult.language}`)
    console.log(`   Liczba terminów: ${validatedTerms.length}`)

    return NextResponse.json({ terms: validatedTerms })

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
