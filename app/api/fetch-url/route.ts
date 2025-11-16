import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url } = body

    if (!url) {
      return NextResponse.json(
        { error: 'Brak URL' },
        { status: 400 }
      )
    }

    // Walidacja URL
    let validUrl: URL
    try {
      validUrl = new URL(url)
      if (!['http:', 'https:'].includes(validUrl.protocol)) {
        return NextResponse.json(
          { error: 'Nieprawidłowy protokół. Użyj http:// lub https://' },
          { status: 400 }
        )
      }
    } catch (e) {
      return NextResponse.json(
        { error: 'Nieprawidłowy format URL' },
        { status: 400 }
      )
    }

    console.log(`📥 Pobieranie dokumentu z URL: ${url}`)

    // Pobierz zawartość
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'IURIDICO-EJ-GTEXTT/1.0'
      }
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Błąd pobierania: ${response.status} ${response.statusText}` },
        { status: response.status }
      )
    }

    const contentType = response.headers.get('content-type') || ''

    // Sprawdź czy to HTML/XML/text
    if (!contentType.includes('text/html') &&
        !contentType.includes('text/xml') &&
        !contentType.includes('application/xml') &&
        !contentType.includes('text/plain')) {
      return NextResponse.json(
        { error: `Nieobsługiwany typ zawartości: ${contentType}. Obsługiwane: HTML, XML, TXT` },
        { status: 400 }
      )
    }

    const text = await response.text()

    if (!text || text.length < 100) {
      return NextResponse.json(
        { error: 'Pobrana zawartość jest zbyt krótka (mniej niż 100 znaków)' },
        { status: 400 }
      )
    }

    if (text.length > 500000) {
      return NextResponse.json(
        { error: `Pobrana zawartość jest zbyt duża (${text.length.toLocaleString()} znaków). Maksymalnie 500,000 znaków.` },
        { status: 400 }
      )
    }

    console.log(`✅ Pobrano ${text.length.toLocaleString()} znaków`)

    // Podstawowe czyszczenie HTML - usuń tagi, zostaw tekst
    let cleanedText = text

    // Usuń skrypty i style
    cleanedText = cleanedText.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    cleanedText = cleanedText.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')

    // Zamień <br>, <p>, <div> na nowe linie
    cleanedText = cleanedText.replace(/<br\s*\/?>/gi, '\n')
    cleanedText = cleanedText.replace(/<\/p>/gi, '\n\n')
    cleanedText = cleanedText.replace(/<\/div>/gi, '\n')
    cleanedText = cleanedText.replace(/<\/h[1-6]>/gi, '\n\n')
    cleanedText = cleanedText.replace(/<\/li>/gi, '\n')

    // Usuń wszystkie pozostałe tagi HTML
    cleanedText = cleanedText.replace(/<[^>]+>/g, ' ')

    // Dekoduj HTML entities
    cleanedText = cleanedText
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")

    // Wyczyść wielokrotne spacje i nowe linie
    cleanedText = cleanedText.replace(/[ \t]+/g, ' ')
    cleanedText = cleanedText.replace(/\n\s*\n\s*\n/g, '\n\n')
    cleanedText = cleanedText.trim()

    if (cleanedText.length < 100) {
      return NextResponse.json(
        { error: 'Po przetworzeniu HTML tekst jest zbyt krótki (mniej niż 100 znaków)' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      text: cleanedText,
      originalLength: text.length,
      cleanedLength: cleanedText.length,
      contentType
    })

  } catch (error: any) {
    console.error('❌ Błąd pobierania URL:', error)
    return NextResponse.json(
      { error: error.message || 'Błąd pobierania zawartości z URL' },
      { status: 500 }
    )
  }
}
