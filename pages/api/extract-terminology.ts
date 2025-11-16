import type { NextApiRequest, NextApiResponse } from 'next'
import Anthropic from '@anthropic-ai/sdk'

interface Term {
  id: string
  term: string
  context: string
  occurrences: number
  positions: number[]
}

interface ExtractionRequest {
  text: string
  apiKey: string
  minTerms?: number
  maxTerms?: number
  minLength?: number
  caseSensitive?: boolean
}

interface ExtractionResponse {
  terms: Term[]
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ExtractionResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ terms: [], error: 'Method not allowed' })
  }

  const { text, apiKey, minTerms = 10, maxTerms = 100, minLength = 3 }: ExtractionRequest = req.body

  if (!text || !apiKey) {
    return res.status(400).json({ terms: [], error: 'Missing required fields' })
  }

  try {
    const anthropic = new Anthropic({ apiKey })

    // Ograniczenie długości tekstu do ~100k znaków dla Claude
    const truncatedText = text.slice(0, 100000)

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Jesteś ekspertem w analizie dokumentów prawnych i urzędowych. Przeanalizuj poniższy tekst i wyekstrahuj najważniejsze terminy specjalistyczne.

WYMAGANIA:
- Wyekstrahuj między ${minTerms} a ${maxTerms} najważniejszych terminów
- Terminy muszą mieć minimum ${minLength} znaki
- Uwzględnij terminy jedno- i wielowyrazowe
- Znajdź wszystkie formy gramatyczne (deklinacja, koniugacja)
- Priorytet: rzeczowniki, przymiotniki, czasowniki specjalistyczne
- Dla każdego terminu podaj kontekst (1-2 zdania, w których występuje)

Format odpowiedzi (JSON):
{
  "terms": [
    {
      "term": "nazwa terminu w formie podstawowej",
      "context": "fragment tekstu z kontekstem",
      "occurrences": liczba wystąpień
    }
  ]
}

TEKST DO ANALIZY:
${truncatedText}

Zwróć TYLKO poprawny JSON bez dodatkowych komentarzy.`
        }
      ]
    })

    // Ekstrakcja JSON z odpowiedzi
    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    // Znajdź JSON w odpowiedzi
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Nie znaleziono JSON w odpowiedzi')
    }

    const parsedResponse = JSON.parse(jsonMatch[0])

    // Przetwórz terminy i znajdź ich pozycje w tekście
    const processedTerms: Term[] = parsedResponse.terms.map((term: any, index: number) => {
      const positions = findTermPositions(text, term.term)
      return {
        id: `term-${index}-${Date.now()}`,
        term: term.term,
        context: term.context || '',
        occurrences: term.occurrences || positions.length,
        positions: positions
      }
    })

    // Sortuj alfabetycznie
    processedTerms.sort((a, b) => a.term.localeCompare(b.term, 'pl'))

    return res.status(200).json({ terms: processedTerms })

  } catch (error) {
    console.error('Error extracting terminology:', error)
    return res.status(500).json({
      terms: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    })
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
