import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for batch translation with web search

interface TranslateTermsRequest {
  apiKey: string
  terms: Array<{
    term: string
    context: string
  }>
  sourceLanguage: string
  targetLanguage: string
}

const CHUNK_SIZE = 30 // Max terms per API call

export async function POST(request: NextRequest) {
  try {
    const body: TranslateTermsRequest = await request.json()
    const { apiKey, terms, sourceLanguage, targetLanguage } = body

    // Walidacja
    if (!apiKey || !apiKey.startsWith('sk-ant-')) {
      return NextResponse.json(
        { error: 'Nieprawidlowy klucz API' },
        { status: 400 }
      )
    }

    if (!terms || terms.length === 0) {
      return NextResponse.json(
        { error: 'Brak terminow do tlumaczenia' },
        { status: 400 }
      )
    }

    if (!sourceLanguage || !targetLanguage) {
      return NextResponse.json(
        { error: 'Wymagany jezyk zrodlowy i docelowy' },
        { status: 400 }
      )
    }

    console.log(`🌐 Tlumaczenie ${terms.length} terminow: ${sourceLanguage} -> ${targetLanguage}`)

    const client = new Anthropic({ apiKey })
    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6-20250514'

    // Podziel terminy na chunki
    const chunks: Array<typeof terms> = []
    for (let i = 0; i < terms.length; i += CHUNK_SIZE) {
      chunks.push(terms.slice(i, i + CHUNK_SIZE))
    }

    console.log(`   Podzielono na ${chunks.length} chunk(ow)`)

    const allTranslations: Array<{
      sourceTerm: string
      targetTerm: string
      targetContext: string
    }> = []

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex]
      console.log(`   Chunk ${chunkIndex + 1}/${chunks.length}: ${chunk.length} terminow`)

      const termsList = chunk.map((t, i) =>
        `${i + 1}. "${t.term}" (kontekst: "${t.context.substring(0, 150)}")`
      ).join('\n')

      const prompt = `You are a professional translator and terminology expert specializing in technical, legal, and domain-specific terminology.

TASK: Translate the following specialized terms from ${sourceLanguage} to ${targetLanguage}.

IMPORTANT INSTRUCTIONS:
1. Use web search to verify the correct specialized translations - search for official terminology databases, glossaries, and authoritative sources
2. For technical/legal/domain terms, prefer officially established translations over literal ones
3. Search for terms in context to find the most accurate domain-specific translation
4. If a term has multiple possible translations, choose the one most appropriate for the given context
5. Maintain the same level of technical precision and formality
6. For abbreviations/acronyms, provide the target language equivalent if it exists, otherwise keep the original

TERMS TO TRANSLATE:
${termsList}

Return ONLY valid JSON (no markdown, no explanation):
{
  "translations": [
    {"sourceTerm": "original term", "targetTerm": "translated term", "targetContext": "brief explanation of the translation choice or usage context in ${targetLanguage}, 50-100 chars"}
  ]
}

IMPORTANT: Return translations for ALL ${chunk.length} terms. The order must match the input order.`

      try {
        const response = await client.messages.create({
          model,
          max_tokens: 4096,
          tools: [{
            type: 'web_search_20250305' as const,
            name: 'web_search',
            max_uses: 10
          }],
          messages: [{
            role: 'user',
            content: prompt
          }]
        })

        // Wyciagnij tekst z odpowiedzi (moze zawierac tool_use blocks)
        let responseText = ''
        for (const block of response.content) {
          if (block.type === 'text') {
            responseText += block.text
          }
        }

        console.log(`   Odpowiedz (pierwsze 200 znakow): ${responseText.substring(0, 200)}`)

        // Wyczysc i parsuj JSON
        let cleanedResponse = responseText.trim()
        if (cleanedResponse.startsWith('```json')) {
          cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '')
        } else if (cleanedResponse.startsWith('```')) {
          cleanedResponse = cleanedResponse.replace(/```\n?/g, '')
        }

        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          console.error(`   Nie znaleziono JSON w odpowiedzi chunk ${chunkIndex + 1}`)
          // Dodaj puste tlumaczenia dla tego chunka
          chunk.forEach(t => {
            allTranslations.push({
              sourceTerm: t.term,
              targetTerm: '',
              targetContext: 'Blad tlumaczenia'
            })
          })
          continue
        }

        const parsed = JSON.parse(jsonMatch[0])

        if (parsed.translations && Array.isArray(parsed.translations)) {
          allTranslations.push(...parsed.translations)
          console.log(`   Przetlumaczono ${parsed.translations.length} terminow`)
        } else {
          console.error(`   Nieprawidlowy format odpowiedzi chunk ${chunkIndex + 1}`)
          chunk.forEach(t => {
            allTranslations.push({
              sourceTerm: t.term,
              targetTerm: '',
              targetContext: 'Blad formatu odpowiedzi'
            })
          })
        }
      } catch (chunkError: any) {
        console.error(`   Blad chunk ${chunkIndex + 1}:`, chunkError.message)
        chunk.forEach(t => {
          allTranslations.push({
            sourceTerm: t.term,
            targetTerm: '',
            targetContext: `Blad: ${chunkError.message?.substring(0, 50)}`
          })
        })
      }
    }

    console.log(`✅ Tlumaczenie zakonczone: ${allTranslations.filter(t => t.targetTerm).length}/${terms.length} terminow`)

    return NextResponse.json({
      translations: allTranslations,
      sourceLanguage,
      targetLanguage
    })

  } catch (error: any) {
    console.error('❌ Blad tlumaczenia:', error)

    if (error.status === 401) {
      return NextResponse.json(
        { error: 'Nieprawidlowy klucz API.' },
        { status: 401 }
      )
    }

    if (error.status === 429) {
      return NextResponse.json(
        { error: 'Przekroczono limit API. Poczekaj chwile.' },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: 'Blad tlumaczenia: ' + (error.message || 'Nieznany blad') },
      { status: 500 }
    )
  }
}
