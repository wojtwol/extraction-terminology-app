import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for batch processing

interface Term {
  id: string
  term: string
  context: string
  occurrences: number
  positions: number[]
  targetTerm?: string
  targetContext?: string
  targetOccurrences?: number
  targetPositions?: number[]
  targetSource?: 'document' | 'ai' | 'manual' | 'missing'
}

interface MatchBilingualTermsRequest {
  apiKey: string
  sourceTerms: Term[]
  sourceText: string
  targetText: string
  sourceLanguage: string
  targetLanguage: string
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
): { text: string; startPercent: number; endPercent: number; startIndex: number } {
  const startPercent = Math.max(0, targetPositionPercent - windowSize)
  const endPercent = Math.min(100, targetPositionPercent + windowSize)

  const startIndex = Math.floor((startPercent / 100) * document.length)
  const endIndex = Math.floor((endPercent / 100) * document.length)

  return {
    text: document.slice(startIndex, endIndex),
    startPercent,
    endPercent,
    startIndex
  }
}

/**
 * Znajduje wszystkie wystąpienia terminu w całym dokumencie docelowym
 */
function findTermOccurrencesInDocument(text: string, term: string): number[] {
  const positions: number[] = []
  let startIndex = 0
  const lowerText = text.toLowerCase()
  const lowerTerm = term.toLowerCase()

  while (startIndex < text.length) {
    const index = lowerText.indexOf(lowerTerm, startIndex)
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
    const body: MatchBilingualTermsRequest = await request.json()
    const {
      apiKey,
      sourceTerms,
      sourceText,
      targetText,
      sourceLanguage,
      targetLanguage
    } = body

    console.log('\n\n🚀 ===== BILINGUAL MATCHING STARTED =====')
    console.log(`📊 Request details:`)
    console.log(`   - Source terms: ${sourceTerms.length}`)
    console.log(`   - Source text length: ${sourceText.length}`)
    console.log(`   - Target text length: ${targetText.length}`)
    console.log(`   - Source language: ${sourceLanguage}`)
    console.log(`   - Target language: ${targetLanguage}`)
    console.log(`   - API key: ${apiKey ? '✓ provided' : '✗ missing'}`)

    // Walidacja
    if (!apiKey || !apiKey.startsWith('sk-ant-')) {
      console.error('❌ Invalid API key')
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 400 }
      )
    }

    if (!sourceTerms || sourceTerms.length === 0) {
      console.error('❌ No source terms provided')
      return NextResponse.json(
        { error: 'No source terms provided' },
        { status: 400 }
      )
    }

    if (!sourceText || !targetText) {
      console.error('❌ Source and target texts required')
      return NextResponse.json(
        { error: 'Source and target texts required' },
        { status: 400 }
      )
    }

    console.log(`🔍 Matching bilingual terms: ${sourceTerms.length} terms (${sourceLanguage} → ${targetLanguage})`)

    const client = new Anthropic({ apiKey })
    const matchedTerms: Term[] = []
    const errors: Array<{term: string, error: string}> = []

    // Process każdego terminu
    for (const sourceTerm of sourceTerms) {
      console.log(`\n📍 Processing: "${sourceTerm.term}"`)

      // 1. Oblicz pozycję pierwszego wystąpienia w dokumencie źródłowym (%)
      const sourcePosition = sourceTerm.positions && sourceTerm.positions.length > 0
        ? sourceTerm.positions[0]
        : 0

      const sourcePositionPercent = getDocumentPosition(sourcePosition, sourceText.length)

      console.log(`   Source position: ${sourcePositionPercent.toFixed(1)}%`)

      // 2. Wyciągnij okno z dokumentu docelowego (±20% od pozycji)
      const targetWindow = extractWindowAroundPosition(
        targetText,
        sourcePositionPercent,
        20  // ±20%
      )

      console.log(`   Target window: ${targetWindow.startPercent.toFixed(1)}% - ${targetWindow.endPercent.toFixed(1)}%`)

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
          model: 'claude-3-5-sonnet-20240620',
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

        // 4. Sprawdź czy znaleziono termin
        if (aiResponse === 'NOT_FOUND' || aiResponse === '') {
          // Nie znaleziono ekwiwalentu
          matchedTerms.push({
            ...sourceTerm,
            targetTerm: undefined,
            targetContext: undefined,
            targetOccurrences: 0,
            targetPositions: [],
            targetSource: 'missing'
          })
        } else {
          // Znaleziono ekwiwalent - znajdź wszystkie wystąpienia w całym dokumencie docelowym
          const allTargetPositions = findTermOccurrencesInDocument(targetText, aiResponse)

          if (allTargetPositions.length > 0) {
            // Znaleziono w dokumencie - potwierdzone
            const targetContext = extractContext(targetText, aiResponse, 200)

            matchedTerms.push({
              ...sourceTerm,
              targetTerm: aiResponse,
              targetContext: targetContext,
              targetOccurrences: allTargetPositions.length,
              targetPositions: allTargetPositions,
              targetSource: 'document'
            })

            console.log(`   ✅ Found: "${aiResponse}" (${allTargetPositions.length} occurrences in full document)`)
          } else {
            // AI zwrócił coś czego nie ma w dokumencie - traktuj jako NOT_FOUND
            matchedTerms.push({
              ...sourceTerm,
              targetTerm: undefined,
              targetContext: undefined,
              targetOccurrences: 0,
              targetPositions: [],
              targetSource: 'missing'
            })

            console.log(`   ❌ AI suggested "${aiResponse}" but not found in document`)
          }
        }

        // Delay między requestami aby nie przekroczyć rate limit
        if (sourceTerms.indexOf(sourceTerm) < sourceTerms.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }

      } catch (aiError: any) {
        const errorMsg = aiError?.message || aiError?.toString() || 'Unknown error'
        console.error(`   ❌ AI error for "${sourceTerm.term}":`, errorMsg)
        console.error(`   Full error:`, aiError)

        errors.push({
          term: sourceTerm.term,
          error: errorMsg
        })

        // W przypadku błędu AI, oznacz jako missing
        matchedTerms.push({
          ...sourceTerm,
          targetTerm: undefined,
          targetContext: undefined,
          targetOccurrences: 0,
          targetPositions: [],
          targetSource: 'missing'
        })
      }
    }

    const foundCount = matchedTerms.filter(t => t.targetTerm).length
    console.log(`\n✅ Completed: ${foundCount}/${sourceTerms.length} equivalents found`)
    console.log(`📊 Final stats:`)
    console.log(`   - Total: ${sourceTerms.length}`)
    console.log(`   - Found: ${foundCount}`)
    console.log(`   - Missing: ${sourceTerms.length - foundCount}`)
    console.log(`   - Errors: ${errors.length}`)
    if (errors.length > 0) {
      console.error(`❌ Errors encountered:`, errors.slice(0, 5))
    }
    console.log('🏁 ===== BILINGUAL MATCHING COMPLETED =====\n\n')

    return NextResponse.json({
      success: true,
      matchedTerms,
      stats: {
        total: sourceTerms.length,
        found: foundCount,
        missing: sourceTerms.length - foundCount
      },
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error: any) {
    console.error('❌ Error matching bilingual terms:', error)
    return NextResponse.json(
      {
        error: 'Failed to match bilingual terms',
        details: error.message
      },
      { status: 500 }
    )
  }
}
