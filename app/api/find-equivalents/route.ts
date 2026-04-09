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
function extractContext(text: string, term: string, contextSize: number = 900): string {
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
${needsLemmatization ? `5. MANDATORY LEMMATIZATION for ${targetLanguage}:
   You MUST ALWAYS provide BOTH fields - this is not optional:
   - "foundForm": copy-paste the EXACT form from the document (VERBATIM, character by character)
   - "lemma": convert to DICTIONARY/BASE form (NOMINATIVE case for nouns, INFINITIVE for verbs)

   !!! ABSOLUTNIE ZAKAZANE - NIE ZMIENIAJ SŁÓW NA INNE !!!
   Lemmatyzacja to TYLKO zmiana formy gramatycznej, NIE zmiana słowa na inne!
   - "uprawnienia" (rzeczownik) → "uprawnienie" ✓
   - "uprawnienia" → "uprawniony" ✗ BŁĄD! To INNE słowo!
   - "właściwymi" → "właściwy" ✓
   - "właściwymi" → "właściwość" ✗ BŁĄD! To INNE słowo!

   CRITICAL: The "lemma" field MUST be DIFFERENT from "foundForm" if the word is inflected!
   CRITICAL: NEVER change words to different words - only change grammatical form!

   LEMMATIZATION RULES:
   - Nouns: convert to NOMINATIVE SINGULAR (mianownik) - SAME WORD, different case
   - Adjectives: convert to NOMINATIVE SINGULAR MASCULINE - SAME WORD, different case
   - Verbs: convert to INFINITIVE (bezokolicznik) - SAME VERB
   - For multi-word terms: lemmatize EACH word separately (keeping the SAME words)

   EXAMPLES (foundForm → lemma):
   - "decyzją stwierdzającą" → "decyzja stwierdzająca" (instrumental→nominative)
   - "zautomatyzowanego systemu" → "zautomatyzowany system" (genitive→nominative)
   - "właściwymi organami" → "właściwy organ" (instrumental plural→nominative singular)
   - "postępowania karnego" → "postępowanie karne" (genitive→nominative)
   - "decyzji Rady" → "decyzja Rady" (genitive→nominative)
   - "dyrektora administracyjnego" → "dyrektor administracyjny" (genitive→nominative)
   - "uprawnień" → "uprawnienie" (NOT "uprawniony"!)
   - "postanowieniu" → "postanowienie" (NOT "postanawiać"!)

   If foundForm is already in nominative, lemma should be the same as foundForm.` : ''}

Respond with JSON only:
${needsLemmatization
  ? '{"found": true, "foundForm": "inflected form from text", "lemma": "base form in nominative"}'
  : '{"found": true, "term": "exact term from text"}'
}
Or if not found: {"found": false}`

        const response = await client.messages.create({
          model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
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
          let lemmaForm = aiResponse.lemma || foundForm  // Użyj lemmy jeśli dostępna, inaczej foundForm

          // Funkcja pomocnicza do lemmatyzacji
          const performLemmatization = async (textToLemmatize: string): Promise<string> => {
            try {
              console.log(`   🔄 Performing lemmatization for: "${textToLemmatize}"`)
              const lemmaResponse = await client.messages.create({
                model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
                max_tokens: 100,
                temperature: 0,
                messages: [{
                  role: 'user',
                  content: `Zamień polskie wyrażenie na formę podstawową (mianownik dla rzeczowników, bezokolicznik dla czasowników).

ABSOLUTNIE KRYTYCZNE - NIE ZMIENIAJ SŁÓW NA INNE! Tylko zmień formę gramatyczną tego samego słowa!

PRZYKŁADY POPRAWNE:
- "decyzją stwierdzającą" → "decyzja stwierdzająca" (narzędnik→mianownik)
- "właściwymi organami" → "właściwy organ" (narzędnik l.mn.→mianownik l.poj.)
- "uprawnienia" → "uprawnienie" (dopełniacz→mianownik, TO SAMO SŁOWO!)
- "zautomatyzowanego systemu" → "zautomatyzowany system" (dopełniacz→mianownik)
- "postępowania karnego" → "postępowanie karne" (dopełniacz→mianownik)

PRZYKŁADY BŁĘDNE (NIGDY TAK NIE RÓB!):
- "uprawnienia" → "uprawniony" ✗ (to INNE słowo!)
- "postanowieniu" → "postanawiać" ✗ (to INNE słowo!)

Wyrażenie do lemmatyzacji: "${textToLemmatize}"

Odpowiedz TYLKO formą podstawową (mianownik), bez żadnych wyjaśnień ani cudzysłowów.`
                }]
              })

              const lemmaText = lemmaResponse.content[0].type === 'text'
                ? lemmaResponse.content[0].text.trim().replace(/^["']|["']$/g, '') // Usuń cudzysłowy
                : textToLemmatize

              // Weryfikuj że to nie jest całkowicie inne słowo (podobna długość)
              if (lemmaText && lemmaText.length > 0 && lemmaText.length < textToLemmatize.length * 2) {
                console.log(`   ✅ Lemmatization result: "${textToLemmatize}" → "${lemmaText}"`)
                return lemmaText
              }
              return textToLemmatize
            } catch (lemmaError) {
              console.log(`   ❌ Lemmatization failed:`, lemmaError)
              return textToLemmatize
            }
          }

          // Log dla debugowania lemmatyzacji
          if (needsLemmatization) {
            const needsForcedLemmatization = !aiResponse.lemma || aiResponse.lemma === foundForm

            if (needsForcedLemmatization) {
              console.log(`   ⚠️  WARNING: AI returned ${!aiResponse.lemma ? 'no lemma' : 'lemma=foundForm'} for "${foundForm}"`)
              // Zawsze uruchom osobną lemmatyzację dla języków słowiańskich gdy brak lub błędna lemma
              lemmaForm = await performLemmatization(foundForm)
            } else {
              console.log(`   ✅ Lemmatization from AI: "${foundForm}" → "${aiResponse.lemma}"`)
            }
          }

          // Sprawdź czy faktycznie istnieje w oknie
          const positions = findTermOccurrences(targetWindow.text, foundForm)

          if (positions.length > 0) {
            // Znaleziono w oknie - potwierdzone
            const rawContext = extractContext(targetWindow.text, foundForm, 900)
            // Zaznacz znalezioną formę w kontekście
            const highlightedContext = highlightTermInContext(rawContext, foundForm)

            console.log(`   📝 Context length: ${rawContext.length} chars, highlighted: ${highlightedContext.includes('**')}`)

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
