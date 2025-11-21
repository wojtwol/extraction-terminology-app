import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 30
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { term, documentText, apiKey, language = 'pl' } = body

    if (!term || !documentText || !apiKey) {
      return NextResponse.json(
        { error: 'Brak wymaganych parametrów' },
        { status: 400 }
      )
    }

    const anthropic = new Anthropic({ apiKey })

    console.log(`🔍 Szukam definicji dla terminu: ${term} (język: ${language})`)

    // Model można skonfigurować przez zmienną środowiskową ANTHROPIC_MODEL
    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'

    // Najpierw sprawdź czy definicja jest w dokumencie
    const documentCheckMessage = await anthropic.messages.create({
      model,
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
${documentText.slice(0, 800000)}

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
      return await generateAIDefinition(anthropic, term, documentText, language)
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
    return await generateAIDefinition(anthropic, term, documentText, language)

  } catch (error: any) {
    console.error('❌ Błąd generowania definicji:', error)
    return NextResponse.json(
      { error: error.message || 'Błąd generowania definicji' },
      { status: 500 }
    )
  }
}

async function generateAIDefinition(anthropic: Anthropic, term: string, documentText: string, language: string) {
  const languageNames: {[key: string]: string} = {
    'pl': 'polskim',
    'en': 'English',
    'de': 'Deutsch',
    'fr': 'français',
    'es': 'español',
    'it': 'italiano'
  }

  const langName = languageNames[language] || 'polskim'
  const isPolish = language === 'pl'

  const promptTemplate = isPolish
    ? `Na podstawie poniższego dokumentu wygeneruj krótką, precyzyjną definicję terminu "${term}" w języku polskim.

Wytyczne:
- Definicja powinna mieć 1-2 zdania
- Powinna być oparta na kontekście użycia w dokumencie
- Użyj języka fachowego ale zrozumiałego
- Nie używaj zwrotów typu "w tym dokumencie", "zgodnie z tekstem" - podaj samą definicję

Dokument:
${documentText.slice(0, 50000)}

Zwróć TYLKO tekst definicji po polsku, bez dodatkowych komentarzy.`
    : `Based on the document below, generate a short, precise definition of the term "${term}" in ${langName}.

Guidelines:
- Definition should be 1-2 sentences
- Should be based on the context of use in the document
- Use professional but understandable language
- Do not use phrases like "in this document", "according to the text" - provide only the definition

Document:
${documentText.slice(0, 50000)}

Return ONLY the definition text in ${langName}, without additional comments.`

  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'

  const aiMessage = await anthropic.messages.create({
    model,
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: promptTemplate
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
