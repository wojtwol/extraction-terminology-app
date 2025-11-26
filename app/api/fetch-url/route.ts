import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30
export const runtime = 'nodejs'

// Funkcja do formatowania tytułów z EUR-Lex w przyjazny sposób
function formatEurLexTitle(title: string): string | null {
  // Wzorce do wykrywania typów dokumentów i numerów
  const patterns = [
    // Wyrok TSUE / CJEU Judgment - najwyższy priorytet
    {
      regex: /(?:Wyrok|WYROK).*?(?:w sprawie|sprawie)\s*([CT]-\d+\/\d+(?:\s*P)?)/i,
      polish: 'Wyrok TSUE w sprawie',
      english: 'CJEU Judgment, Case'
    },
    {
      regex: /(?:Judgment|JUDGMENT|Arrêt).*?(?:Case|case|affaire)\s*([CT]-\d+\/\d+(?:\s*P)?)/i,
      polish: 'Wyrok TSUE w sprawie',
      english: 'CJEU Judgment, Case'
    },
    // Opinia rzecznika generalnego / Advocate General Opinion
    {
      regex: /(?:Opinia rzecznika generalnego|OPINIA RZECZNIKA GENERALNEGO).*?(?:w sprawie|sprawie)\s*([CT]-\d+\/\d+(?:\s*P)?)/i,
      polish: 'Opinia RG w sprawie',
      english: 'AG Opinion, Case'
    },
    {
      regex: /(?:Opinion of (?:the )?Advocate General|OPINION OF (?:THE )?ADVOCATE GENERAL).*?(?:Case|case)\s*([CT]-\d+\/\d+(?:\s*P)?)/i,
      polish: 'Opinia RG w sprawie',
      english: 'AG Opinion, Case'
    },
    // Postanowienie / Order
    {
      regex: /(?:Postanowienie|POSTANOWIENIE).*?(?:w sprawie|sprawie)\s*([CT]-\d+\/\d+(?:\s*P)?)/i,
      polish: 'Postanowienie TSUE w sprawie',
      english: 'CJEU Order, Case'
    },
    {
      regex: /(?:Order|ORDER).*?(?:Case|case)\s*([CT]-\d+\/\d+(?:\s*P)?)/i,
      polish: 'Postanowienie TSUE w sprawie',
      english: 'CJEU Order, Case'
    },
    // Pytanie prejudycjalne / Request for preliminary ruling
    {
      regex: /(?:Pytanie prejudycjalne|PYTANIE PREJUDYCJALNE).*?(?:w sprawie|sprawie)\s*([CT]-\d+\/\d+(?:\s*P)?)/i,
      polish: 'Pytanie prejudycjalne w sprawie',
      english: 'Preliminary ruling, Case'
    },
    {
      regex: /(?:Request for (?:a )?preliminary ruling|REQUEST FOR (?:A )?PRELIMINARY RULING).*?(?:Case|case)\s*([CT]-\d+\/\d+(?:\s*P)?)/i,
      polish: 'Pytanie prejudycjalne w sprawie',
      english: 'Preliminary ruling, Case'
    },
    // Rozporządzenie / Regulation
    {
      regex: /(?:Rozporządzenie|ROZPORZĄDZENIE).*?(?:\(UE\)|UE)?\s*(?:Nr\.?|nr\.?|No\.?)?\s*(\d+\/\d+)/i,
      polish: 'Rozporządzenie',
      english: 'Regulation'
    },
    {
      regex: /(?:Regulation|REGULATION).*?(?:\(EU\)|EU)?\s*(?:No\.?)?\s*(\d+\/\d+)/i,
      polish: 'Rozporządzenie',
      english: 'Regulation'
    },
    // Dyrektywa / Directive
    {
      regex: /(?:Dyrektywa|DYREKTYWA).*?(?:\(UE\)|UE)?\s*(?:Nr\.?|nr\.?)?\s*(\d+\/\d+)/i,
      polish: 'Dyrektywa',
      english: 'Directive'
    },
    {
      regex: /(?:Directive|DIRECTIVE).*?(?:\(EU\)|EU)?\s*(?:No\.?)?\s*(\d+\/\d+)/i,
      polish: 'Dyrektywa',
      english: 'Directive'
    },
    // Decyzja / Decision
    {
      regex: /(?:Decyzja|DECYZJA).*?(?:\(UE\)|UE)?\s*(?:Nr\.?|nr\.?)?\s*(\d+\/\d+)/i,
      polish: 'Decyzja',
      english: 'Decision'
    },
    {
      regex: /(?:Decision|DECISION).*?(?:\(EU\)|EU)?\s*(?:No\.?)?\s*(\d+\/\d+)/i,
      polish: 'Decyzja',
      english: 'Decision'
    },
    // Zalecenie / Recommendation
    {
      regex: /(?:Zalecenie|ZALECENIE).*?(?:\(UE\)|UE)?\s*(?:Nr\.?|nr\.?)?\s*(\d+\/\d+)/i,
      polish: 'Zalecenie',
      english: 'Recommendation'
    },
    {
      regex: /(?:Recommendation|RECOMMENDATION).*?(?:\(EU\)|EU)?\s*(?:No\.?)?\s*(\d+\/\d+)/i,
      polish: 'Zalecenie',
      english: 'Recommendation'
    },
    // Opinia instytucji / Institutional Opinion
    {
      regex: /(?:Opinia|OPINIA).*?(?:\(UE\)|UE)?\s*(?:Nr\.?|nr\.?)?\s*(\d+\/\d+)/i,
      polish: 'Opinia',
      english: 'Opinion'
    },
    {
      regex: /(?:Opinion|OPINION).*?(?:\(EU\)|EU)?\s*(?:No\.?)?\s*(\d+\/\d+)/i,
      polish: 'Opinia',
      english: 'Opinion'
    }
  ]

  // Sprawdź język tytułu - rozszerzone wykrywanie
  const isPolish = /(?:Wyrok|Rozporządzenie|Dyrektywa|Decyzja|Zalecenie|Opinia|Postanowienie|Pytanie prejudycjalne|rzecznika generalnego)/i.test(title)

  // Spróbuj dopasować jeden z wzorców
  for (const pattern of patterns) {
    const match = title.match(pattern.regex)
    if (match && match[1]) {
      const number = match[1]
      return isPolish ? `${pattern.polish} ${number}` : `${pattern.english} ${number}`
    }
  }

  // Jeśli nie znaleziono dopasowania, zwróć null
  return null
}

// Funkcja do parsowania numeru CELEX i formatowania tytułu
function formatCelexTitle(celexOrUrl: string, language: 'pl' | 'en' = 'en'): string | null {
  // Wzorce CELEX: 32017R1939 (3=akty prawne, 2017=rok, R=typ, 1939=numer)
  const celexMatch = celexOrUrl.match(/3(\d{4})([RDLH])(\d+)/i)

  if (celexMatch) {
    const year = celexMatch[1]
    const type = celexMatch[2].toUpperCase()
    const number = celexMatch[3]

    const typeMap: { [key: string]: { pl: string, en: string } } = {
      'R': { pl: 'Rozporządzenie', en: 'Regulation' },
      'L': { pl: 'Dyrektywa', en: 'Directive' },
      'D': { pl: 'Decyzja', en: 'Decision' },
      'H': { pl: 'Zalecenie', en: 'Recommendation' }
    }

    const typeLabel = typeMap[type]
    if (typeLabel) {
      return language === 'pl'
        ? `${typeLabel.pl} ${year}/${number}`
        : `${typeLabel.en} ${year}/${number}`
    }
  }

  return null
}

// Funkcja do formatowania nazw plików XML z EUR-Lex
function formatEurLexXmlFilename(filename: string, language: 'pl' | 'en' = 'en'): string | null {
  // Format: L_2017283EN.01000101.xml -> wyekstrahuj rok i typ
  // L = Dziennik Urzędowy seria L, C = seria C
  const xmlMatch = filename.match(/([LC])_(\d{4})(\d{3})[A-Z]{2}\./)

  if (xmlMatch) {
    const series = xmlMatch[1]
    const year = xmlMatch[2]
    const dayOfYear = xmlMatch[3]

    // Nie możemy określić dokładnego numeru aktu z nazwy pliku XML,
    // więc zwracamy ogólną nazwę
    return language === 'pl'
      ? `Dokument z Dziennika Urzędowego ${series} ${year}/${dayOfYear}`
      : `Official Journal ${series} ${year}/${dayOfYear}`
  }

  return null
}

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

    // Pobierz zawartość z rozszerzonymi nagłówkami - imitacja prawdziwej przeglądarki
    const response = await fetch(urlWithoutFragment, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,pl;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      },
      redirect: 'follow'
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

    if (text.length > 800000) {
      return NextResponse.json(
        { error: `Pobrana zawartość jest zbyt duża (${text.length.toLocaleString()} znaków). Maksymalnie 800,000 znaków (~300 stron).` },
        { status: 400 }
      )
    }

    console.log(`✅ Pobrano ${text.length.toLocaleString()} znaków`)

    // Wykryj język na podstawie URL
    const urlLower = urlWithoutFragment.toLowerCase()
    const detectedLanguage: 'pl' | 'en' = urlLower.includes('/pl/') || urlLower.includes('_pl') ? 'pl' : 'en'

    // Ekstrakcja tytułu dokumentu
    let documentTitle = validUrl.hostname // Domyślnie użyj hostname

    // Dla EUR-Lex, spróbuj najpierw sparsować CELEX z URL
    if (validUrl.hostname.includes('eur-lex.europa.eu')) {
      // Spróbuj wyekstrahować CELEX z URL
      const celexInUrl = urlWithoutFragment.match(/CELEX[:=](\d+[A-Z]\d+)/i)
      if (celexInUrl && celexInUrl[1]) {
        const celexFormatted = formatCelexTitle(celexInUrl[1], detectedLanguage)
        if (celexFormatted) {
          documentTitle = celexFormatted
          console.log(`✨ Sformatowano CELEX z URL: "${documentTitle}"`)
        }
      }

      // Jeśli nie znaleziono CELEX, spróbuj sparsować nazwę pliku XML
      if (documentTitle === validUrl.hostname) {
        const xmlFilename = validUrl.pathname.split('/').pop()
        if (xmlFilename && xmlFilename.endsWith('.xml')) {
          const xmlFormatted = formatEurLexXmlFilename(xmlFilename, detectedLanguage)
          if (xmlFormatted) {
            documentTitle = xmlFormatted
            console.log(`✨ Sformatowano nazwę pliku XML: "${documentTitle}"`)
          }
        }
      }
    }

    // Jeśli nie udało się sformatować z URL/nazwy pliku, spróbuj z tagu <title>
    if (documentTitle === validUrl.hostname) {
      const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
      if (titleMatch && titleMatch[1]) {
        let extractedTitle = titleMatch[1]

        // Dekoduj HTML entities w tytule
        const htmlEntitiesForTitle: { [key: string]: string } = {
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

        for (const [entity, char] of Object.entries(htmlEntitiesForTitle)) {
          extractedTitle = extractedTitle.replace(new RegExp(entity, 'g'), char)
        }

        // Dekoduj numeryczne HTML entities
        extractedTitle = extractedTitle.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
        extractedTitle = extractedTitle.replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))

        // Usuń zbędne białe znaki
        extractedTitle = extractedTitle.replace(/\s+/g, ' ').trim()

        if (extractedTitle && extractedTitle.length > 0 && extractedTitle.length < 500) {
          documentTitle = extractedTitle
          console.log(`📋 Wyekstrahowano tytuł: "${documentTitle}"`)

          // Formatowanie tytułów EUR-Lex w przyjazny sposób
          if (validUrl.hostname.includes('eur-lex.europa.eu')) {
            const formattedTitle = formatEurLexTitle(documentTitle)
            if (formattedTitle) {
              documentTitle = formattedTitle
              console.log(`✨ Sformatowano tytuł EUR-Lex z <title>: "${documentTitle}"`)
            }
          }
        } else {
          console.log(`⚠️  Tytuł jest zbyt długi lub pusty, używam hostname`)
        }
      } else {
        console.log(`⚠️  Nie znaleziono tagu <title>, używam hostname: ${documentTitle}`)
      }
    }

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
      contentType,
      documentTitle  // Dodajemy tytuł dokumentu
    })

  } catch (error: any) {
    console.error('❌ Błąd pobierania URL:', error)
    return NextResponse.json(
      { error: error.message || 'Błąd pobierania zawartości z URL' },
      { status: 500 }
    )
  }
}
