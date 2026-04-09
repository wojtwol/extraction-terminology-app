import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

interface GenerateTargetTermRequest {
  apiKey: string
  sourceTerm: string
  sourceContext: string
  targetDocument: string
  sourceLanguage: string
  targetLanguage: string
  termPosition: number
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
    const body: GenerateTargetTermRequest = await request.json()
    const {
      apiKey,
      sourceTerm,
      sourceContext,
      targetDocument,
      sourceLanguage,
      targetLanguage,
      termPosition
    } = body

    // Walidacja
    if (!apiKey || !apiKey.startsWith('sk-ant-')) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 400 }
      )
    }

    if (!sourceTerm || !targetDocument) {
      return NextResponse.json(
        { error: 'Source term and target document required' },
        { status: 400 }
      )
    }

    console.log(`🤖 Generating target term for: "${sourceTerm}" (${sourceLanguage} → ${targetLanguage})`)

    // Oblicz pozycję w dokumencie docelowym
    const sourcePositionPercent = termPosition / 100 // termPosition już jest w procentach

    // Wyciągnij okno z dokumentu docelowego (±20% od pozycji)
    const targetWindow = extractWindowAroundPosition(
      targetDocument,
      sourcePositionPercent,
      20  // ±20% zgodnie z wymaganiami
    )

    console.log(`   Target window: ${targetWindow.startPercent.toFixed(1)}% - ${targetWindow.endPercent.toFixed(1)}%`)
    console.log(`   Window size: ${targetWindow.text.length} chars`)

    const client = new Anthropic({ apiKey })

    // Użyj AI do wygenerowania ekwiwalentu
    const prompt = `You are a professional translator and terminology expert.

TASK: Generate the most appropriate equivalent term in the target language for the given source term.

SOURCE TERM: "${sourceTerm}"
SOURCE LANGUAGE: ${sourceLanguage}
SOURCE CONTEXT: "${sourceContext}"

TARGET LANGUAGE: ${targetLanguage}
TARGET DOCUMENT FRAGMENT (around ${sourcePositionPercent.toFixed(1)}% of document):
"""
${targetWindow.text}
"""

INSTRUCTIONS:
1. Find or generate the BEST equivalent of the source term for the target language
2. The equivalent should match the semantic context and domain of the source term
3. Prefer terms that actually appear in the target document fragment
4. If no perfect match exists in the fragment, generate an appropriate translation
5. Return ONLY the target term, nothing else - no explanations, no quotes, just the term
6. The term should be grammatically correct in the target language
7. Maintain the same level of formality and technical precision

Respond with just the target term (one word or short phrase).`

    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6-20250514',
      max_tokens: 100,
      temperature: 0.3,  // Trochę wyższa temperatura dla kreatywności
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    const aiResponse = response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : ''

    console.log(`   AI generated: "${aiResponse}"`)

    if (!aiResponse || aiResponse === '') {
      return NextResponse.json(
        { error: 'Failed to generate target term' },
        { status: 500 }
      )
    }

    // Sprawdź czy wygenerowany termin faktycznie istnieje w dokumencie docelowym
    const fullDocPositions = findTermOccurrences(targetDocument, aiResponse)
    const windowPositions = findTermOccurrences(targetWindow.text, aiResponse)

    let targetSource: 'document' | 'ai' = 'ai'
    let targetContext = ''
    let targetOccurrences = 0
    let targetPositions: number[] = []

    if (fullDocPositions.length > 0) {
      // Termin istnieje w pełnym dokumencie
      targetSource = 'document'
      targetContext = extractContext(targetDocument, aiResponse, 200)
      targetOccurrences = fullDocPositions.length
      targetPositions = fullDocPositions
      console.log(`   ✅ Found in document: "${aiResponse}" (${fullDocPositions.length} occurrences)`)
    } else {
      // Termin nie istnieje - został wygenerowany przez AI
      targetSource = 'ai'
      targetContext = `${sourceLanguage}: "${sourceContext}"`
      targetOccurrences = 0
      targetPositions = []
      console.log(`   🤖 Generated by AI: "${aiResponse}" (not found in document)`)
    }

    return NextResponse.json({
      success: true,
      targetTerm: aiResponse,
      targetContext,
      targetOccurrences,
      targetPositions,
      targetSource,
      searchedWindow: {
        start: targetWindow.startPercent,
        end: targetWindow.endPercent
      }
    })

  } catch (error: any) {
    console.error('❌ Error generating target term:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate target term',
        details: error.message
      },
      { status: 500 }
    )
  }
}
