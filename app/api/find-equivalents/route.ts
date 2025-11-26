import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for batch processing

interface FindEquivalentsRequest {
  apiKey: string
  sourceTerms: Array<{
    term: string
    context: string
    position: number
    occurrences: number
  }>
  sourceDocument: string
  targetDocument: string
  sourceLanguage: string
  targetLanguage: string
  mode: 'single' | 'batch'  // single = jeden termin, batch = wszystkie
}

/**
 * Znajduje pozycję terminu w dokumencie jako procent długości dokumentu
 */
function getDocumentPosition(absolutePosition: number, documentLength: number): number {
  return (absolutePosition / documentLength) * 100
}

/**
 * Wyciąga fragment dokumentu wokół danej pozycji (±windowSize%)
 */
function extractWindowAroundPosition(
  document: string,
  targetPositionPercent: number,
  windowSize: number = 20
): { text: string; startPercent: number; endPercent: number } {
  const startPercent = Math.max(0, targetPositionPercent - windowSize)
  const endPercent = Math.min(100, targetPositionPercent + windowSize)

  const startIndex = Math.floor((startPercent / 100) * document.length)
  const endIndex = Math.floor((endPercent / 100) * document.length)

  return {
    text: document.slice(startIndex, endIndex),
    startPercent,
    endPercent
  }
}

/**
 * Znajduje wszystkie wystąpienia terminu w tekście
 */
function findTermOccurrences(text: string, term: string): number[] {
  const positions: number[] = []
  let startIndex = 0

  while (startIndex < text.length) {
    const index = text.toLowerCase().indexOf(term.toLowerCase(), startIndex)
    if (index === -1) break
    positions.push(index)
    startIndex = index + 1
  }

  return positions
}

/**
 * Wyciąga kontekst wokół pierwszego wystąpienia terminu i zaznacza go
 */
function extractContext(text: string, term: string, contextSize: number = 400): string {
  const lowerText = text.toLowerCase()
  const lowerTerm = term.toLowerCase()
  const index = lowerText.indexOf(lowerTerm)

  if (index === -1) return ''

  const start = Math.max(0, index - contextSize)
  const end = Math.min(text.length, index + term.length + contextSize)

  let context = text.slice(start, end)

  // Dodaj wielokropki jeśli obcięliśmy
  if (start > 0) context = '...' + context
  if (end < text.length) context = context + '...'

  return context.trim()
}

/**
 * Zaznacza termin w kontekście (case-insensitive)
 */
function highlightTermInContext(context: string, term: string): string {
  if (!context || !term) return context
  // Escape special regex characters
  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escapedTerm})`, 'gi')
  return context.replace(regex, '**$1**')
}

export async function POST(request: NextRequest) {
  try {
    const body: FindEquivalentsRequest = await request.json()
    const {
      apiKey,
      sourceTerms,
      sourceDocument,
      targetDocument,
      sourceLanguage,
      targetLanguage,
      mode
    } = body

    // Walidacja
    if (!apiKey || !apiKey.startsWith('sk-ant-')) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 400 }
      )
    }

    if (!sourceTerms || sourceTerms.length === 0) {
      return NextResponse.json(
        { error: 'No source terms provided' },
        { status: 400 }
      )
    }

    if (!sourceDocument || !targetDocument) {
      return NextResponse.json(
        { error: 'Source and target documents required' },
        { status: 400 }
      )
    }

    console.log(`🔍 Finding equivalents: ${sourceTerms.length} terms (${sourceLanguage} → ${targetLanguage})`)

    const client = new Anthropic({ apiKey })
    const results = []

    // Process każdego terminu
    for (const sourceTerm of sourceTerms) {
      console.log(`\n📍 Processing: "${sourceTerm.term}"`)

      // 1. Oblicz pozycję w dokumencie źródłowym (%)
      const sourcePositionPercent = getDocumentPosition(
        sourceTerm.position,
        sourceDocument.length
      )

      console.log(`   Source position: ${sourcePositionPercent.toFixed(1)}%`)

      // 2. Wyciągnij okno z dokumentu docelowego (±20% od pozycji)
      const targetWindow = extractWindowAroundPosition(
        targetDocument,
        sourcePositionPercent,
        20  // ±20% zgodnie z wymaganiami
      )

      console.log(`   Target window: ${targetWindow.startPercent.toFixed(1)}% - ${targetWindow.endPercent.toFixed(1)}%`)
      console.log(`   Window size: ${targetWindow.text.length} chars`)

      // 3. Użyj AI do znalezienia ekwiwalentu
      // Sprawdź czy język docelowy to język słowiański (wymaga lemmatyzacji)
      const slavicLanguages = ['pl', 'polish', 'cs', 'czech', 'sk', 'slovak', 'uk', 'ukrainian', 'ru', 'russian', 'bg', 'bulgarian', 'hr', 'croatian', 'sr', 'serbian', 'sl', 'slovenian']
      const needsLemmatization = slavicLanguages.some(lang =>
        targetLanguage.toLowerCase().includes(lang)
      )

      try {
        const prompt = `You are a professional translator and terminology expert.

TASK: Find the equivalent term in the target language document.

SOURCE TERM: "${sourceTerm.term}"
SOURCE LANGUAGE: ${sourceLanguage}
SOURCE CONTEXT: "${sourceTerm.context}"

TARGET LANGUAGE: ${targetLanguage}
TARGET DOCUMENT FRAGMENT (around ${sourcePositionPercent.toFixed(1)}% of document):
"""
${targetWindow.text}
"""

INSTRUCTIONS:
1. Find the EXACT equivalent of the source term in the target document fragment
2. The equivalent should be in the same semantic position (similar context)
3. The term must exist verbatim in the target fragment
4. If you cannot find an equivalent, respond with: {"found": false}
${needsLemmatization ? `5. CRITICAL - LEMMATIZATION for ${targetLanguage}:
   You MUST provide BOTH fields:
   - "foundForm": the EXACT form as it appears in the document (copy-paste from text)
   - "lemma": the DICTIONARY/BASE form (nouns in NOMINATIVE, verbs in INFINITIVE, adjectives in NOMINATIVE SINGULAR MASCULINE)

   LEMMATIZATION EXAMPLES:
   - "właściwymi organami" → lemma: "właściwy organ" (nominative singular)
   - "dyrektora administracyjnego" → lemma: "dyrektor administracyjny" (nominative)
   - "postępowania karnego" → lemma: "postępowanie karne" (nominative)
   - "decyzją stwierdzającą odpowiedni poziom" → lemma: "decyzja stwierdzająca odpowiedni poziom" (nominative)
   - "zautomatyzowanego systemu zarządzania sprawami" → lemma: "zautomatyzowany system zarządzania sprawami" (nominative)

   For multi-word terms, convert EACH word to its base/dictionary form.
   The lemma field is REQUIRED - do not skip it!` : ''}

Respond with JSON only:
${needsLemmatization
  ? '{"found": true, "foundForm": "exact form from text", "lemma": "dictionary base form in nominative"}'
  : '{"found": true, "term": "exact term from text"}'
}
Or if not found: {"found": false}`

        const response = await client.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 200,
          temperature: 0,
          messages: [{
            role: 'user',
            content: prompt
          }]
        })

        const aiResponseText = response.content[0].type === 'text'
          ? response.content[0].text.trim()
          : '{"found": false}'

        console.log(`   AI response: "${aiResponseText}"`)

        // Parse JSON response
        let aiResponse: { found: boolean; term?: string; foundForm?: string; lemma?: string }
        try {
          // Wyczyść odpowiedź z ewentualnych znaczników markdown
          const cleanedResponse = aiResponseText.replace(/```json\n?|\n?```/g, '').trim()
          aiResponse = JSON.parse(cleanedResponse)
        } catch {
          // Fallback - stary format (plain text)
          if (aiResponseText === 'NOT_FOUND' || aiResponseText === '') {
            aiResponse = { found: false }
          } else {
            aiResponse = { found: true, term: aiResponseText }
          }
        }

        if (!aiResponse.found) {
          // Nie znaleziono ekwiwalentu
          results.push({
            sourceTerm: sourceTerm.term,
            targetTerm: null,
            targetContext: null,
            targetOccurrences: 0,
            targetPositions: [],
            targetSource: 'missing' as const,
            searchedWindow: {
              start: targetWindow.startPercent,
              end: targetWindow.endPercent
            }
          })
        } else {
          // Znaleziono ekwiwalent
          const foundForm = aiResponse.foundForm || aiResponse.term || ''
          const lemmaForm = aiResponse.lemma || foundForm  // Użyj lemmy jeśli dostępna, inaczej foundForm

          // Sprawdź czy faktycznie istnieje w oknie
          const positions = findTermOccurrences(targetWindow.text, foundForm)

          if (positions.length > 0) {
            // Znaleziono w oknie - potwierdzone
            const rawContext = extractContext(targetWindow.text, foundForm, 400)
            // Zaznacz znalezioną formę w kontekście
            const highlightedContext = highlightTermInContext(rawContext, foundForm)

            results.push({
              sourceTerm: sourceTerm.term,
              targetTerm: lemmaForm,  // Używamy formy podstawowej jako główny termin
              targetFoundForm: foundForm,  // Zachowujemy też znalezioną formę
              targetContext: highlightedContext,
              targetOccurrences: positions.length,
              targetPositions: positions,
              targetSource: 'document' as const,
              searchedWindow: {
                start: targetWindow.startPercent,
                end: targetWindow.endPercent
              }
            })

            console.log(`   ✅ Found: "${foundForm}" → lemma: "${lemmaForm}" (${positions.length} occurrences)`)
          } else {
            // AI zwrócił coś czego nie ma w oknie - traktuj jako NOT_FOUND
            results.push({
              sourceTerm: sourceTerm.term,
              targetTerm: null,
              targetContext: null,
              targetOccurrences: 0,
              targetPositions: [],
              targetSource: 'missing' as const,
              searchedWindow: {
                start: targetWindow.startPercent,
                end: targetWindow.endPercent
              }
            })

            console.log(`   ❌ AI suggested "${foundForm}" but not found in window`)
          }
        }

        // Delay między requestami aby nie przekroczyć rate limit
        if (mode === 'batch' && sourceTerms.indexOf(sourceTerm) < sourceTerms.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }

      } catch (aiError: any) {
        console.error(`   ❌ AI error for "${sourceTerm.term}":`, aiError.message)

        // W przypadku błędu AI, oznacz jako missing
        results.push({
          sourceTerm: sourceTerm.term,
          targetTerm: null,
          targetContext: null,
          targetOccurrences: 0,
          targetPositions: [],
          targetSource: 'missing' as const,
          error: aiError.message
        })
      }
    }

    console.log(`\n✅ Completed: ${results.filter(r => r.targetTerm).length}/${sourceTerms.length} equivalents found`)

    return NextResponse.json({
      success: true,
      results,
      stats: {
        total: sourceTerms.length,
        found: results.filter(r => r.targetTerm).length,
        missing: results.filter(r => !r.targetTerm).length
      }
    })

  } catch (error: any) {
    console.error('❌ Error finding equivalents:', error)
    return NextResponse.json(
      {
        error: 'Failed to find equivalents',
        details: error.message
      },
      { status: 500 }
    )
  }
}
