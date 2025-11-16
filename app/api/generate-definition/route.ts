import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 30
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { term, documentText, apiKey } = body

    if (!term || !documentText || !apiKey) {
      return NextResponse.json(
        { error: 'Brak wymaganych parametrów' },
        { status: 400 }
      )
    }

    const anthropic = new Anthropic({ apiKey })

    console.log(`🔍 Szukam definicji dla terminu: ${term}`)

    // Najpierw sprawdź czy definicja jest w dokumencie
    const documentCheckMessage = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Przeanalizuj poniższy dokument i sprawdź czy zawiera JAWNĄ definicję terminu "${term}".

WAŻNE: Szukaj TYLKO następujących typów definicji:
1. Definicje w słowniczku/liście pojęć (np. "Słownik pojęć", "Definicje", "Lista terminów")
2. Definicje w tekście w formacie: "termin" oznacza/to/jest...
3. Definicje w nawiasach: termin (definicja)
4. Definicje w cudzysłowie po terminie

NIE wymyślaj definicji na podstawie kontekstu. Jeśli nie ma JAWNEJ definicji, odpowiedz "BRAK".

Dokument:
${documentText.slice(0, 50000)}

Zwróć TYLKO JSON:
{
  "hasDefinition": true/false,
  "definition": "tekst definicji lub BRAK"
}`
        }
      ]
    })

    const documentCheckText = documentCheckMessage.content[0].type === 'text'
      ? documentCheckMessage.content[0].text
      : ''

    // Parsuj odpowiedź
    let cleanedResponse = documentCheckText.trim()
    if (cleanedResponse.includes('```json')) {
      cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    }

    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      // Fallback - generuj AI
      return await generateAIDefinition(anthropic, term, documentText)
    }

    const checkResult = JSON.parse(jsonMatch[0])

    if (checkResult.hasDefinition && checkResult.definition !== 'BRAK') {
      console.log('✅ Znaleziono definicję w dokumencie')
      return NextResponse.json({
        definition: checkResult.definition,
        source: 'document'
      })
    }

    // Nie znaleziono w dokumencie - generuj AI
    console.log('⚠️ Brak definicji w dokumencie, generuję AI')
    return await generateAIDefinition(anthropic, term, documentText)

  } catch (error: any) {
    console.error('❌ Błąd generowania definicji:', error)
    return NextResponse.json(
      { error: error.message || 'Błąd generowania definicji' },
      { status: 500 }
    )
  }
}

async function generateAIDefinition(anthropic: Anthropic, term: string, documentText: string) {
  const aiMessage = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `Na podstawie poniższego dokumentu wygeneruj krótką, precyzyjną definicję terminu "${term}".

Wytyczne:
- Definicja powinna mieć 1-2 zdania
- Powinna być oparta na kontekście użycia w dokumencie
- Użyj języka fachowego ale zrozumiałego
- Nie używaj zwrotów typu "w tym dokumencie", "zgodnie z tekstem" - podaj samą definicję

Dokument:
${documentText.slice(0, 20000)}

Zwróć TYLKO tekst definicji, bez dodatkowych komentarzy.`
      }
    ]
  })

  const definition = aiMessage.content[0].type === 'text'
    ? aiMessage.content[0].text.trim()
    : 'Nie udało się wygenerować definicji'

  return NextResponse.json({
    definition,
    source: 'ai'
  })
}
