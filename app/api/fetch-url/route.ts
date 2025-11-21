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

    // Usuń fragment z URL (część po #) - nie jest wysyłana do serwera przez przeglądarkę
    const urlWithoutFragment = url.split('#')[0]

    console.log(`📥 Pobieranie dokumentu z URL: ${urlWithoutFragment}`)

    // Pobierz zawartość z rozszerzonymi nagłówkami
    const response = await fetch(urlWithoutFragment, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pl,en-US;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache'
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

    console.log(`📄 Surowy HTML - pierwsze 500 znaków:`)
    console.log(text.substring(0, 500))

    if (!text || text.length < 100) {
      return NextResponse.json(
        { error: 'Pobrana zawartość jest zbyt krótka (mniej niż 100 znaków)' },
        { status: 400 }
      )
    }

    if (text.length > 1000000) {
      return NextResponse.json(
        { error: `Pobrana zawartość jest zbyt duża (${text.length.toLocaleString()} znaków). Maksymalnie 1,000,000 znaków.` },
        { status: 400 }
      )
    }

    console.log(`✅ Pobrano ${text.length.toLocaleString()} znaków`)

    // Zaawansowane czyszczenie HTML - usuń tagi, zostaw tekst
    let cleanedText = text

    // Usuń komentarze HTML
    cleanedText = cleanedText.replace(/<!--[\s\S]*?-->/g, '')

    // Usuń skrypty, style i noscript
    cleanedText = cleanedText.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    cleanedText = cleanedText.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    cleanedText = cleanedText.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')

    // Usuń tylko head (bez całego contentu - może zawierać meta description)
    cleanedText = cleanedText.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')

    // NIE usuwamy nav i footer - mogą zawierać tekst
    // cleanedText = cleanedText.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    // cleanedText = cleanedText.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')

    // Zamień <br>, <p>, <div> na nowe linie PRZED usunięciem tagów
    cleanedText = cleanedText.replace(/<br\s*\/?>/gi, '\n')
    cleanedText = cleanedText.replace(/<\/p>/gi, '\n\n')
    cleanedText = cleanedText.replace(/<\/div>/gi, '\n')
    cleanedText = cleanedText.replace(/<\/h[1-6]>/gi, '\n\n')
    cleanedText = cleanedText.replace(/<\/li>/gi, '\n')
    cleanedText = cleanedText.replace(/<\/tr>/gi, '\n')
    cleanedText = cleanedText.replace(/<\/td>/gi, ' | ')
    cleanedText = cleanedText.replace(/<\/th>/gi, ' | ')

    console.log(`📊 Po usunięciu tagów strukturalnych - pierwsze 500 znaków:`)
    console.log(cleanedText.substring(0, 500))

    // Usuń wszystkie pozostałe tagi HTML
    cleanedText = cleanedText.replace(/<[^>]+>/g, ' ')

    console.log(`📊 Po usunięciu wszystkich tagów - pierwsze 500 znaków:`)
    console.log(cleanedText.substring(0, 500))

    // Dekoduj HTML entities (rozszerzona lista)
    const htmlEntities: { [key: string]: string } = {
      '&nbsp;': ' ',
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&apos;': "'",
      '&ndash;': '–',
      '&mdash;': '—',
      '&euro;': '€',
      '&pound;': '£',
      '&copy;': '©',
      '&reg;': '®',
      '&trade;': '™',
      '&hellip;': '...',
      '&bull;': '•',
      '&middot;': '·',
      '&laquo;': '«',
      '&raquo;': '»',
      '&deg;': '°'
    }

    for (const [entity, char] of Object.entries(htmlEntities)) {
      cleanedText = cleanedText.replace(new RegExp(entity, 'g'), char)
    }

    // Dekoduj numeryczne HTML entities (&#123; i &#xAB;)
    cleanedText = cleanedText.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    cleanedText = cleanedText.replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))

    // Wyczyść wielokrotne spacje, tabulatory i nowe linie
    cleanedText = cleanedText.replace(/[ \t]+/g, ' ')
    cleanedText = cleanedText.replace(/\n\s*\n\s*\n+/g, '\n\n')
    cleanedText = cleanedText.replace(/^\s+|\s+$/gm, '') // Trim każdej linii
    cleanedText = cleanedText.trim()

    console.log(`📊 Długość po czyszczeniu: ${cleanedText.length.toLocaleString()} znaków`)
    console.log(`📄 Oczyszczony tekst - pierwsze 500 znaków:`)
    console.log(cleanedText.substring(0, 500))

    if (cleanedText.length < 50) {
      console.error(`❌ Tekst zbyt krótki: ${cleanedText.length} znaków`)
      console.error(`Całość tekstu: "${cleanedText}"`)
      return NextResponse.json(
        {
          error: `Po przetworzeniu HTML tekst jest zbyt krótki (${cleanedText.length} znaków). Możliwe że strona używa JavaScript do dynamicznego ładowania treści lub ma nietypową strukturę. Spróbuj:\n1. Skopiować tekst ze strony i wkleić go w zakładce "Wklej tekst"\n2. Użyć innego URL (np. wersji do druku)\n3. Zapisać stronę jako PDF i wczytać plik`,
          originalLength: text.length,
          cleanedLength: cleanedText.length,
          sample: cleanedText.substring(0, 200)
        },
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
