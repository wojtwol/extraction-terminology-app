import { NextRequest, NextResponse } from 'next/server'
import { detectLanguage } from '@/utils/languageDetector'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text } = body

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Brak tekstu do analizy' },
        { status: 400 }
      )
    }

    if (text.length < 50) {
      return NextResponse.json(
        { error: 'Tekst jest zbyt krótki (minimum 50 znaków)' },
        { status: 400 }
      )
    }

    const result = detectLanguage(text)

    return NextResponse.json({
      language: result.language,
      languageCode: result.languageCode,
      confidence: result.confidence,
      method: result.detectionMethod
    })

  } catch (error: any) {
    console.error('❌ Błąd wykrywania języka:', error)
    return NextResponse.json(
      { error: 'Błąd podczas wykrywania języka: ' + (error.message || 'Nieznany błąd') },
      { status: 500 }
    )
  }
}
