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

// API przetwarza max 120 terminow na request.
// Frontend dzieli na chunki i wysyla wiele requestow.
const MAX_TERMS_PER_REQUEST = 120

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

    // Ogranicz do MAX_TERMS_PER_REQUEST
    const termsToProcess = terms.slice(0, MAX_TERMS_PER_REQUEST)
    console.log(`🌐 Tlumaczenie ${termsToProcess.length} terminow: ${sourceLanguage} -> ${targetLanguage}`)

    const client = new Anthropic({ apiKey })
    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'

    const termsList = termsToProcess.map((t, i) =>
      `${i + 1}. "${t.term}"${t.context ? ` [${t.context.substring(0, 60).replace(/\n/g, ' ')}]` : ''}`
    ).join('\n')

    const prompt = `Translate these ${termsToProcess.length} terms from ${sourceLanguage} to ${targetLanguage}.

Rules:
- Use officially established translations for technical/legal/domain terms
- For acronyms, keep original if no established translation exists
- Context in brackets [] helps determine domain meaning

TERMS:
${termsList}

Return ONLY valid JSON:
{"translations":[{"sourceTerm":"original","targetTerm":"translation","targetContext":"brief note, 30-60 chars"}]}

Return ALL ${termsToProcess.length} translations in input order.`

    let responseText = ''

    // Probuj z web_search + streaming, fallback bez web_search
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
      console.log(`   ✅ Web search + streaming OK, ${responseText.length} znakow`)
    } catch (wsError: any) {
      console.log(`   ⚠️ Fallback bez web_search: ${wsError.message?.substring(0, 60)}`)
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

    // Parsuj JSON
    let cleanedResponse = responseText.trim()
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/```\n?/g, '')
    }

    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error(`   Brak JSON w odpowiedzi`)
      return NextResponse.json({
        translations: termsToProcess.map(t => ({ sourceTerm: t.term, targetTerm: '', targetContext: 'Blad: brak JSON' })),
        sourceLanguage, targetLanguage
      })
    }

    const parsed = JSON.parse(jsonMatch[0])
    const translations = parsed.translations && Array.isArray(parsed.translations)
      ? parsed.translations
      : termsToProcess.map(t => ({ sourceTerm: t.term, targetTerm: '', targetContext: 'Blad formatu' }))

    console.log(`✅ Przetlumaczono ${translations.filter((t: any) => t.targetTerm).length}/${termsToProcess.length}`)

    return NextResponse.json({ translations, sourceLanguage, targetLanguage })

  } catch (error: any) {
    console.error('❌ Blad:', error)
    if (error.status === 401) return NextResponse.json({ error: 'Nieprawidlowy klucz API.' }, { status: 401 })
    if (error.status === 429) return NextResponse.json({ error: 'Przekroczono limit API.' }, { status: 429 })
    return NextResponse.json({ error: 'Blad tlumaczenia: ' + (error.message || 'Nieznany') }, { status: 500 })
  }
}
