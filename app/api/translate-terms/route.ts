import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 600

interface TranslateTermsRequest {
  apiKey: string
  terms: Array<{
    term: string
    context: string
  }>
  sourceLanguage: string
  targetLanguage: string
}

const CHUNK_SIZE = 120 // Terminy sa krotkie - 120 na chunk miesci sie w limicie

export async function POST(request: NextRequest) {
  try {
    const body: TranslateTermsRequest = await request.json()
    const { apiKey, terms, sourceLanguage, targetLanguage } = body

    if (!apiKey || !apiKey.startsWith('sk-ant-')) {
      return NextResponse.json({ error: 'Nieprawidlowy klucz API' }, { status: 400 })
    }
    if (!terms || terms.length === 0) {
      return NextResponse.json({ error: 'Brak terminow do tlumaczenia' }, { status: 400 })
    }
    if (!sourceLanguage || !targetLanguage) {
      return NextResponse.json({ error: 'Wymagany jezyk zrodlowy i docelowy' }, { status: 400 })
    }

    console.log(`🌐 Tlumaczenie ${terms.length} terminow: ${sourceLanguage} -> ${targetLanguage}`)

    const client = new Anthropic({ apiKey })
    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'

    const chunks: Array<typeof terms> = []
    for (let i = 0; i < terms.length; i += CHUNK_SIZE) {
      chunks.push(terms.slice(i, i + CHUNK_SIZE))
    }

    console.log(`   ${chunks.length} chunk(ow) po max ${CHUNK_SIZE}`)

    const allTranslations: Array<{
      sourceTerm: string
      targetTerm: string
      targetContext: string
    }> = []

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex]
      console.log(`   Chunk ${chunkIndex + 1}/${chunks.length}: ${chunk.length} terminow`)

      const termsList = chunk.map((t, i) =>
        `${i + 1}. "${t.term}"${t.context ? ` [${t.context.substring(0, 60).replace(/\n/g, ' ')}]` : ''}`
      ).join('\n')

      const prompt = `Translate these ${chunk.length} terms from ${sourceLanguage} to ${targetLanguage}.

Rules:
- Use officially established translations for technical/legal/domain terms
- For acronyms, keep original if no established translation exists
- Context in brackets [] helps determine domain meaning

TERMS:
${termsList}

Return ONLY valid JSON:
{"translations":[{"sourceTerm":"original","targetTerm":"translation","targetContext":"brief note, 30-60 chars"}]}

Return ALL ${chunk.length} translations in input order.`

      try {
        let responseText = ''

        // Probuj z web_search + streaming
        try {
          const stream = client.messages.stream({
            model,
            max_tokens: 16000,
            tools: [{
              type: 'web_search_20250305',
              name: 'web_search',
              max_uses: 3
            } as any],
            messages: [{ role: 'user', content: prompt }]
          })
          const message = await stream.finalMessage()
          for (const block of message.content) {
            if (block.type === 'text') responseText += block.text
          }
          console.log(`   ✅ Web search + streaming OK`)
        } catch (wsError: any) {
          console.log(`   ⚠️ Web search fallback: ${wsError.message?.substring(0, 60)}`)
          const stream = client.messages.stream({
            model,
            max_tokens: 16000,
            messages: [{ role: 'user', content: prompt }]
          })
          const message = await stream.finalMessage()
          for (const block of message.content) {
            if (block.type === 'text') responseText += block.text
          }
        }

        console.log(`   Odpowiedz: ${responseText.length} znakow`)

        let cleanedResponse = responseText.trim()
        if (cleanedResponse.startsWith('```json')) {
          cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '')
        } else if (cleanedResponse.startsWith('```')) {
          cleanedResponse = cleanedResponse.replace(/```\n?/g, '')
        }

        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          console.error(`   Brak JSON w chunk ${chunkIndex + 1}`)
          chunk.forEach(t => {
            allTranslations.push({ sourceTerm: t.term, targetTerm: '', targetContext: 'Blad: brak JSON' })
          })
          continue
        }

        const parsed = JSON.parse(jsonMatch[0])

        if (parsed.translations && Array.isArray(parsed.translations)) {
          allTranslations.push(...parsed.translations)
          console.log(`   ✅ ${parsed.translations.length} terminow`)
        } else {
          chunk.forEach(t => {
            allTranslations.push({ sourceTerm: t.term, targetTerm: '', targetContext: 'Blad formatu' })
          })
        }
      } catch (chunkError: any) {
        console.error(`   ❌ Chunk ${chunkIndex + 1}:`, chunkError.message)
        chunk.forEach(t => {
          allTranslations.push({ sourceTerm: t.term, targetTerm: '', targetContext: `Blad: ${chunkError.message?.substring(0, 50)}` })
        })
      }
    }

    const successCount = allTranslations.filter(t => t.targetTerm).length
    console.log(`✅ Tlumaczenie: ${successCount}/${terms.length}`)

    return NextResponse.json({ translations: allTranslations, sourceLanguage, targetLanguage })

  } catch (error: any) {
    console.error('❌ Blad:', error)
    if (error.status === 401) return NextResponse.json({ error: 'Nieprawidlowy klucz API.' }, { status: 401 })
    if (error.status === 429) return NextResponse.json({ error: 'Przekroczono limit API.' }, { status: 429 })
    return NextResponse.json({ error: 'Blad tlumaczenia: ' + (error.message || 'Nieznany') }, { status: 500 })
  }
}
