import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 600 // 10 minutes for large glossaries

interface TranslateTermsRequest {
  apiKey: string
  terms: Array<{
    term: string
    context: string
  }>
  sourceLanguage: string
  targetLanguage: string
}

const CHUNK_SIZE = 80 // Duzy chunk - same terminy bez kontekstu zajmuja malo tokenow

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
    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'

    // Podziel terminy na chunki
    const chunks: Array<typeof terms> = []
    for (let i = 0; i < terms.length; i += CHUNK_SIZE) {
      chunks.push(terms.slice(i, i + CHUNK_SIZE))
    }

    console.log(`   Podzielono na ${chunks.length} chunk(ow) po max ${CHUNK_SIZE}`)

    const allTranslations: Array<{
      sourceTerm: string
      targetTerm: string
      targetContext: string
    }> = []

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex]
      console.log(`   Chunk ${chunkIndex + 1}/${chunks.length}: ${chunk.length} terminow`)

      // Kompaktowa lista - tylko termin i krotki kontekst
      const termsList = chunk.map((t, i) =>
        `${i + 1}. "${t.term}"${t.context ? ` [${t.context.substring(0, 80).replace(/\n/g, ' ')}]` : ''}`
      ).join('\n')

      const prompt = `You are a professional translator specializing in technical and domain-specific terminology.

Translate these ${chunk.length} terms from ${sourceLanguage} to ${targetLanguage}.

Rules:
- Use officially established translations for technical/legal/domain terms
- Maintain technical precision and formality
- For acronyms, provide target language equivalent if it exists, otherwise keep original
- Context in brackets [] helps determine the correct domain meaning

TERMS:
${termsList}

Return ONLY valid JSON (no markdown):
{"translations":[{"sourceTerm":"original","targetTerm":"translation","targetContext":"brief note about translation choice, 30-60 chars"}]}

Return ALL ${chunk.length} translations in input order.`

      try {
        const response = await client.messages.create({
          model,
          max_tokens: 8192,
          messages: [{
            role: 'user',
            content: prompt
          }]
        })

        let responseText = ''
        for (const block of response.content) {
          if (block.type === 'text') {
            responseText += block.text
          }
        }

        console.log(`   Odpowiedz: ${responseText.length} znakow`)

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
          console.error(`   Pierwsze 300 znakow: ${responseText.substring(0, 300)}`)
          chunk.forEach(t => {
            allTranslations.push({ sourceTerm: t.term, targetTerm: '', targetContext: 'Blad: brak JSON w odpowiedzi' })
          })
          continue
        }

        const parsed = JSON.parse(jsonMatch[0])

        if (parsed.translations && Array.isArray(parsed.translations)) {
          allTranslations.push(...parsed.translations)
          console.log(`   ✅ Przetlumaczono ${parsed.translations.length} terminow`)
        } else {
          console.error(`   Nieprawidlowy format JSON chunk ${chunkIndex + 1}`)
          chunk.forEach(t => {
            allTranslations.push({ sourceTerm: t.term, targetTerm: '', targetContext: 'Blad formatu' })
          })
        }
      } catch (chunkError: any) {
        console.error(`   ❌ Blad chunk ${chunkIndex + 1}:`, chunkError.message)
        chunk.forEach(t => {
          allTranslations.push({ sourceTerm: t.term, targetTerm: '', targetContext: `Blad: ${chunkError.message?.substring(0, 50)}` })
        })
      }
    }

    const successCount = allTranslations.filter(t => t.targetTerm).length
    console.log(`✅ Tlumaczenie zakonczone: ${successCount}/${terms.length} terminow`)

    return NextResponse.json({
      translations: allTranslations,
      sourceLanguage,
      targetLanguage
    })

  } catch (error: any) {
    console.error('❌ Blad tlumaczenia:', error)

    if (error.status === 401) {
      return NextResponse.json({ error: 'Nieprawidlowy klucz API.' }, { status: 401 })
    }
    if (error.status === 429) {
      return NextResponse.json({ error: 'Przekroczono limit API. Poczekaj chwile.' }, { status: 429 })
    }

    return NextResponse.json(
      { error: 'Blad tlumaczenia: ' + (error.message || 'Nieznany blad') },
      { status: 500 }
    )
  }
}
