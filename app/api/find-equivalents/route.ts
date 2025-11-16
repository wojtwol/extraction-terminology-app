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
 * Wyciąga kontekst wokół pierwszego wystąpienia terminu
 */
function extractContext(text: string, term: string, contextSize: number = 200): string {
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
3. Return ONLY the target term, nothing else
4. If you cannot find an equivalent, respond with "NOT_FOUND"
5. The term must exist verbatim in the target fragment

Respond with just the target term or "NOT_FOUND".`

        const response = await client.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 100,
          temperature: 0,
          messages: [{
            role: 'user',
            content: prompt
          }]
        })

        const aiResponse = response.content[0].type === 'text'
          ? response.content[0].text.trim()
          : 'NOT_FOUND'

        console.log(`   AI response: "${aiResponse}"`)

        if (aiResponse === 'NOT_FOUND' || aiResponse === '') {
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
          // Znaleziono ekwiwalent - sprawdź czy faktycznie istnieje w oknie
          const positions = findTermOccurrences(targetWindow.text, aiResponse)

          if (positions.length > 0) {
            // Znaleziono w oknie - potwierdzone
            const context = extractContext(targetWindow.text, aiResponse, 200)

            results.push({
              sourceTerm: sourceTerm.term,
              targetTerm: aiResponse,
              targetContext: context,
              targetOccurrences: positions.length,
              targetPositions: positions,
              targetSource: 'document' as const,
              searchedWindow: {
                start: targetWindow.startPercent,
                end: targetWindow.endPercent
              }
            })

            console.log(`   ✅ Found: "${aiResponse}" (${positions.length} occurrences)`)
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

            console.log(`   ❌ AI suggested "${aiResponse}" but not found in window`)
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
