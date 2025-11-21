'use client'

import { Term } from '@/app/page'
import * as XLSX from 'xlsx-js-style'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useLanguage } from '@/contexts/LanguageContext'

interface ExportButtonsProps {
  terms: Term[]
  fileName: string
  documentText: string
  onImportTerms?: (terms: Term[], source: string) => void  // Callback do importu terminów
  glossaryMode?: 'monolingual' | 'bilingual' | null  // Tryb glosariusza
  selectedColumnView?: '2' | '4'  // Widok kolumn dla dwujęzycznego (2 lub 4)
  targetDocumentText?: string  // Tekst dokumentu docelowego (dla dwujęzycznych)
}

export default function ExportButtons({
  terms,
  fileName,
  documentText,
  onImportTerms,
  glossaryMode,
  selectedColumnView = '4',
  targetDocumentText
}: ExportButtonsProps) {
  const { language } = useLanguage()

  // Sprawdź czy jest to glosariusz dwujęzyczny
  const isBilingual = glossaryMode === 'bilingual'
  const is2Column = selectedColumnView === '2'
  const is4Column = selectedColumnView === '4'

  // Funkcja pomocnicza do zaznaczania terminu w kontekście
  const highlightTermInContext = (context: string, term: string): string => {
    if (!context || !term) return context
    // Case-insensitive replace with red highlighting
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    return context.replace(regex, '<span style="color: #dc3545; font-weight: 600;">$1</span>')
  }

  const exportToCSV = () => {
    let csvContent: string[][]

    if (isBilingual) {
      // Eksport glosariusza dwujęzycznego
      if (is2Column) {
        // 2 kolumny: Termin źródłowy | Termin docelowy
        csvContent = [
          [language === 'pl' ? 'Termin źródłowy' : 'Source Term', language === 'pl' ? 'Termin docelowy' : 'Target Term'],
          ...terms.map(term => [
            term.term,
            term.targetTerm || ''
          ])
        ]
      } else {
        // 4 kolumny: Termin źródłowy | Kontekst źródłowy | Termin docelowy | Kontekst docelowy
        csvContent = [
          [
            language === 'pl' ? 'Termin źródłowy' : 'Source Term',
            language === 'pl' ? 'Kontekst źródłowy' : 'Source Context',
            language === 'pl' ? 'Termin docelowy' : 'Target Term',
            language === 'pl' ? 'Kontekst docelowy' : 'Target Context'
          ],
          ...terms.map(term => [
            term.term,
            term.context || '',
            term.targetTerm || '',
            term.targetContext || ''
          ])
        ]
      }
    } else {
      // Eksport glosariusza jednojęzycznego (istniejący kod)
      const hasDefinitions = terms.some(t => t.definition && t.definition.trim() !== '')

      if (hasDefinitions) {
        csvContent = [
          ['Termin', 'Liczba wystąpień', 'Dokument', 'Definicja', 'Źródło definicji', 'Kontekst'],
          ...terms.map(term => [
            term.term,
            term.occurrences.toString(),
            term.sourceDocument || fileName || 'Dokument',
            term.definition || '',
            term.definitionSource === 'document' ? 'Z dokumentu' :
             term.definitionSource === 'edited' ? 'Edytowano' :
             term.definitionSource === 'ai' ? 'AI' : '',
            term.context || ''
          ])
        ]
      } else {
        csvContent = [
          ['Termin', 'Liczba wystąpień', 'Dokument', 'Kontekst'],
          ...terms.map(term => [
            term.term,
            term.occurrences.toString(),
            term.sourceDocument || fileName || 'Dokument',
            term.context || ''
          ])
        ]
      }
    }

    const csvString = csvContent
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')

    const suffix = isBilingual ? (is2Column ? '_dwujezyczny_2kol' : '_dwujezyczny_4kol') : '_glosariusz'
    const filename = `${fileName}${suffix}.csv`
    downloadFile(csvString, filename, 'text/csv;charset=utf-8;')
  }

  const exportBilingualToHTML = () => {
    const t = {
      title: language === 'pl' ? 'Glosariusz dwujęzyczny' : 'Bilingual Glossary',
      termCount: language === 'pl' ? 'Liczba terminów:' : 'Number of terms:',
      createdAt: language === 'pl' ? 'Data utworzenia:' : 'Created at:',
      viewMode: language === 'pl' ? 'Widok:' : 'View:',
      columns2: language === 'pl' ? '2 kolumny' : '2 columns',
      columns4: language === 'pl' ? '4 kolumny' : '4 columns',
      nr: language === 'pl' ? 'Nr' : 'No.',
      sourceTerm: language === 'pl' ? 'Termin źródłowy' : 'Source Term',
      sourceContext: language === 'pl' ? 'Kontekst źródłowy' : 'Source Context',
      targetTerm: language === 'pl' ? 'Termin docelowy' : 'Target Term',
      targetContext: language === 'pl' ? 'Kontekst docelowy' : 'Target Context'
    }

    const locale = language === 'pl' ? 'pl-PL' : 'en-US'
    const lang = language === 'pl' ? 'pl' : 'en'

    const htmlContent = `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.title} - ${fileName}</title>
  <style>
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      max-width: 1600px;
      margin: 0 auto;
      padding: 30px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
    }
    .container {
      background: white;
      border-radius: 10px;
      padding: 30px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    h1 {
      color: #333;
      border-bottom: 3px solid #667eea;
      padding-bottom: 15px;
      margin-bottom: 10px;
    }
    .subtitle {
      color: #666;
      font-size: 0.95em;
      margin-bottom: 20px;
    }
    .metadata {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 25px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 10px;
    }
    .metadata-item {
      display: flex;
      gap: 8px;
    }
    .metadata-label {
      font-weight: 600;
      color: #495057;
    }
    table {
      width: 100%;
      background: white;
      border-collapse: collapse;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      border-radius: 8px;
      overflow: hidden;
    }
    th {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 14px 12px;
      text-align: left;
      font-weight: 600;
      font-size: 0.95em;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e9ecef;
      vertical-align: top;
    }
    tr:hover {
      background: #f8f9fa;
    }
    tr:last-child td {
      border-bottom: none;
    }
    .term {
      font-weight: 600;
      color: #2c3e50;
    }
    .context {
      font-size: 0.85em;
      color: #6c757d;
      font-style: italic;
      line-height: 1.4;
    }
    .nr-col {
      width: 40px;
      text-align: center;
      color: #adb5bd;
      font-weight: 500;
    }
    .highlighted-term {
      color: #dc3545;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>IURIDICO EJ GTEXTT</h1>
    <p class="subtitle">Bilingual Glossary and Terminology Tool</p>

    <div class="metadata">
      <div class="metadata-item">
        <span class="metadata-label">${t.termCount}</span>
        <span>${terms.length}</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">${t.viewMode}</span>
        <span>${is2Column ? t.columns2 : t.columns4}</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">${t.createdAt}</span>
        <span>${new Date().toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="nr-col">${t.nr}</th>
          <th style="width: ${is2Column ? '45%' : '22%'};">${t.sourceTerm}</th>
          ${is4Column ? `<th style="width: 28%;">${t.sourceContext}</th>` : ''}
          <th style="width: ${is2Column ? '45%' : '22%'};">${t.targetTerm}</th>
          ${is4Column ? `<th style="width: 28%;">${t.targetContext}</th>` : ''}
        </tr>
      </thead>
      <tbody>
        ${terms.map((term, index) => `
          <tr>
            <td class="nr-col">${index + 1}</td>
            <td class="term">${term.term}</td>
            ${is4Column ? `<td class="context">${highlightTermInContext(term.context || '', term.term)}</td>` : ''}
            <td class="term">${term.targetTerm || '<span style="color: #adb5bd;">-</span>'}</td>
            ${is4Column ? `<td class="context">${term.targetTerm ? highlightTermInContext(term.targetContext || '', term.targetTerm) : '<span style="color: #adb5bd;">-</span>'}</td>` : ''}
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>
`

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' })
    const suffix = is2Column ? '_dwujezyczny_2kol' : '_dwujezyczny_4kol'
    const filename = `${fileName}${suffix}.html`
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
  }

  const exportToHTML = () => {
    // Obsługa glosariuszy dwujęzycznych
    if (isBilingual) {
      exportBilingualToHTML()
      return
    }

    // Sprawdź czy są definicje (dla jednojęzycznych)
    const hasDefinitions = terms.some(t => t.definition && t.definition.trim() !== '')

    // Dynamiczne szerokości kolumn (z uwzględnieniem kolumny Dokument)
    const definitionWidth = hasDefinitions ? '26%' : '12%'  // Zmniejszone o miejsce dla kolumny Dokument
    const sourceWidth = '100px'
    const contextWidth = hasDefinitions ? '26%' : '38%'     // Zmniejszone o miejsce dla kolumny Dokument

    // Tłumaczenia
    const t = {
      title: language === 'pl' ? 'Glosariusz' : 'Glossary',
      sourceDoc: language === 'pl' ? 'Dokument źródłowy:' : 'Source Document:',
      termCount: language === 'pl' ? 'Liczba terminów:' : 'Number of terms:',
      createdAt: language === 'pl' ? 'Data utworzenia:' : 'Created at:',
      nr: language === 'pl' ? 'Nr' : 'No.',
      term: language === 'pl' ? 'Termin' : 'Term',
      occurrences: language === 'pl' ? 'Liczba wystąpień' : 'Number of occurrences',
      document: language === 'pl' ? 'Dokument' : 'Document',
      definition: language === 'pl' ? 'Definicja' : 'Definition',
      defSource: language === 'pl' ? 'Źródło definicji' : 'Definition source',
      context: language === 'pl' ? 'Kontekst' : 'Context',
      fromDoc: language === 'pl' ? 'Dokument' : 'Document',
      edited: language === 'pl' ? 'Edytowano' : 'Edited',
      ai: 'AI'
    }

    const locale = language === 'pl' ? 'pl-PL' : 'en-US'
    const lang = language === 'pl' ? 'pl' : 'en'

    const htmlContent = `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.title} - ${fileName}</title>
  <style>
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      max-width: 1400px;
      margin: 0 auto;
      padding: 30px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
    }
    .container {
      background: white;
      border-radius: 10px;
      padding: 30px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    h1 {
      color: #333;
      border-bottom: 3px solid #667eea;
      padding-bottom: 15px;
      margin-bottom: 10px;
    }
    .subtitle {
      color: #666;
      font-size: 0.95em;
      margin-bottom: 20px;
    }
    .metadata {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 25px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 10px;
    }
    .metadata-item {
      display: flex;
      gap: 8px;
    }
    .metadata-label {
      font-weight: 600;
      color: #495057;
    }
    table {
      width: 100%;
      background: white;
      border-collapse: collapse;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      border-radius: 8px;
      overflow: hidden;
    }
    th {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 14px 12px;
      text-align: left;
      font-weight: 600;
      font-size: 0.95em;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e9ecef;
      vertical-align: top;
    }
    tr:hover {
      background: #f8f9fa;
    }
    tr:last-child td {
      border-bottom: none;
    }
    .term {
      font-weight: 600;
      color: #2c3e50;
    }
    .occurrences {
      text-align: center;
      font-weight: 500;
      color: #667eea;
    }
    .definition {
      font-size: 0.9em;
      color: #495057;
      line-height: 1.5;
    }
    .source-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.75em;
      font-weight: 600;
      margin-top: 5px;
    }
    .source-document {
      background: #d4edda;
      color: #155724;
    }
    .source-ai {
      background: #d1ecf1;
      color: #0c5460;
    }
    .source-edited {
      background: #fff3cd;
      color: #856404;
    }
    .context {
      font-size: 0.85em;
      color: #6c757d;
      font-style: italic;
      line-height: 1.4;
    }
    .nr-col {
      width: 40px;
      text-align: center;
      color: #adb5bd;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>IURIDICO EJ GTEXTT</h1>
    <p class="subtitle">Glossary and Terminology Extraction Tool</p>

    <div class="metadata">
      <div class="metadata-item">
        <span class="metadata-label">${t.sourceDoc}</span>
        <span>${fileName}</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">${t.termCount}</span>
        <span>${terms.length}</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">${t.createdAt}</span>
        <span>${new Date().toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="nr-col">${t.nr}</th>
          <th style="width: 180px;">${t.term}</th>
          <th style="width: 70px; text-align: center;">${t.occurrences}</th>
          <th style="width: 150px;">${t.document}</th>
          ${hasDefinitions ? `
          <th style="width: ${definitionWidth};">${t.definition}</th>
          <th style="width: ${sourceWidth}; text-align: center;">${t.defSource}</th>
          ` : ''}
          <th style="width: ${contextWidth};">${t.context}</th>
        </tr>
      </thead>
      <tbody>
        ${terms.map((term, index) => `
          <tr>
            <td class="nr-col">${index + 1}</td>
            <td class="term">${term.term}</td>
            <td class="occurrences">${term.occurrences}</td>
            <td style="font-size: 0.85em; color: #6c757d;">
              ${term.sourceDocument || fileName || t.document}
            </td>
            ${hasDefinitions ? `
            <td class="definition">
              ${term.definition || '<span style="color: #adb5bd;">-</span>'}
            </td>
            <td style="text-align: center;">
              ${term.definition ? `
                <div class="source-badge ${
                  term.definitionSource === 'document'
                    ? 'source-document'
                    : term.definitionSource === 'edited'
                    ? 'source-edited'
                    : 'source-ai'
                }">
                  ${
                    term.definitionSource === 'document'
                      ? t.fromDoc
                      : term.definitionSource === 'edited'
                      ? t.edited
                      : t.ai
                  }
                </div>
              ` : '<span style="color: #adb5bd;">-</span>'}
            </td>
            ` : ''}
            <td class="context">${term.context || '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>
    `

    downloadFile(htmlContent, `${fileName}_glosariusz.html`, 'text/html;charset=utf-8;')
  }

  const exportBilingualToXLSX = () => {
    const t = {
      title: language === 'pl' ? 'Glosariusz dwujęzyczny' : 'Bilingual Glossary',
      sourceDoc: language === 'pl' ? 'Dokument źródłowy:' : 'Source Document:',
      createdAt: language === 'pl' ? 'Data utworzenia:' : 'Created at:',
      termCount: language === 'pl' ? 'Liczba terminów:' : 'Number of terms:',
      viewMode: language === 'pl' ? 'Widok:' : 'View:',
      columns2: language === 'pl' ? '2 kolumny' : '2 columns',
      columns4: language === 'pl' ? '4 kolumny' : '4 columns',
      nr: language === 'pl' ? 'Nr' : 'No.',
      sourceTerm: language === 'pl' ? 'Termin źródłowy' : 'Source Term',
      sourceContext: language === 'pl' ? 'Kontekst źródłowy' : 'Source Context',
      targetTerm: language === 'pl' ? 'Termin docelowy' : 'Target Term',
      targetContext: language === 'pl' ? 'Kontekst docelowy' : 'Target Context'
    }

    const locale = language === 'pl' ? 'pl-PL' : 'en-US'
    const numCols = is2Column ? 2 : 4

    // Nagłówek z metadanymi
    const emptyRow = Array(numCols).fill('')
    const metadataRows = [
      [t.title],
      emptyRow,
      [t.termCount, terms.length],
      [t.viewMode, is2Column ? t.columns2 : t.columns4],
      [t.createdAt, new Date().toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })],
      emptyRow
    ]

    // Nagłówki kolumn
    let headerRow: string[]
    if (is2Column) {
      headerRow = [t.sourceTerm, t.targetTerm]
    } else {
      headerRow = [t.sourceTerm, t.sourceContext, t.targetTerm, t.targetContext]
    }

    // Wiersze danych
    const dataRows = terms.map(term => {
      if (is2Column) {
        return [
          term.term,
          term.targetTerm || ''
        ]
      } else {
        return [
          term.term,
          term.context || '',
          term.targetTerm || '',
          term.targetContext || ''
        ]
      }
    })

    // Stwórz arkusz
    const allRows = [...metadataRows, headerRow, ...dataRows]
    const worksheet = XLSX.utils.aoa_to_sheet(allRows)

    // Stylizacja nagłówka tabeli (wiersz z kolumnami)
    const headerRowIndex = metadataRows.length
    const headerStyle = {
      fill: { fgColor: { rgb: '667eea' } },
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    }

    headerRow.forEach((_, colIndex) => {
      const cellRef = XLSX.utils.encode_cell({ r: headerRowIndex, c: colIndex })
      if (!worksheet[cellRef]) worksheet[cellRef] = { t: 's', v: '' }
      worksheet[cellRef].s = headerStyle
    })

    // Szerokości kolumn
    if (is2Column) {
      worksheet['!cols'] = [
        { wch: 40 }, // Source Term
        { wch: 40 }  // Target Term
      ]
    } else {
      worksheet['!cols'] = [
        { wch: 30 }, // Source Term
        { wch: 50 }, // Source Context
        { wch: 30 }, // Target Term
        { wch: 50 }  // Target Context
      ]
    }

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, language === 'pl' ? 'Glosariusz' : 'Glossary')

    const suffix = is2Column ? '_dwujezyczny_2kol' : '_dwujezyczny_4kol'
    const filename = `${fileName}${suffix}.xlsx`
    XLSX.writeFile(workbook, filename)
  }

  const exportToXLSX = () => {
    // Obsługa glosariuszy dwujęzycznych
    if (isBilingual) {
      exportBilingualToXLSX()
      return
    }

    // Sprawdź czy są jakieś definicje (dla jednojęzycznych)
    const hasDefinitions = terms.some(t => t.definition && t.definition.trim() !== '')
    const numCols = hasDefinitions ? 7 : 5  // 7 z definicjami, 5 bez

    // Tłumaczenia
    const t = {
      sourceDoc: language === 'pl' ? 'Dokument źródłowy:' : 'Source Document:',
      createdAt: language === 'pl' ? 'Data utworzenia:' : 'Created at:',
      termCount: language === 'pl' ? 'Liczba terminów:' : 'Number of terms:',
      nr: language === 'pl' ? 'Nr' : 'No.',
      term: language === 'pl' ? 'Termin' : 'Term',
      occurrences: language === 'pl' ? 'Liczba wystąpień' : 'Number of occurrences',
      document: language === 'pl' ? 'Dokument' : 'Document',
      definition: language === 'pl' ? 'Definicja' : 'Definition',
      defSource: language === 'pl' ? 'Źródło definicji' : 'Definition source',
      context: language === 'pl' ? 'Kontekst' : 'Context',
      fromDoc: language === 'pl' ? 'Z dokumentu' : 'From document',
      edited: language === 'pl' ? 'Edytowano' : 'Edited',
      aiGenerated: language === 'pl' ? 'Wygenerowane AI' : 'AI Generated'
    }

    const locale = language === 'pl' ? 'pl-PL' : 'en-US'

    // Przygotuj puste komórki dla scalania
    const emptyRow = Array(numCols).fill('')

    // Przygotuj nagłówek i wiersze danych w zależności od hasDefinitions
    let headerRow: string[]
    let dataRows: (string | number)[][]

    if (hasDefinitions) {
      headerRow = [t.nr, t.term, t.occurrences, t.document, t.definition, t.defSource, t.context]
      dataRows = terms.map((term, index) => [
        (index + 1).toString(),
        term.term,
        term.occurrences.toString(),
        term.sourceDocument || fileName || t.document,
        term.definition || '',
        term.definitionSource === 'document' ? t.fromDoc :
         term.definitionSource === 'edited' ? t.edited :
         term.definitionSource === 'ai' ? t.aiGenerated : '',
        term.context || ''
      ])
    } else {
      headerRow = [t.nr, t.term, t.occurrences, t.document, t.context]
      dataRows = terms.map((term, index) => [
        (index + 1).toString(),
        term.term,
        term.occurrences.toString(),
        term.sourceDocument || fileName || t.document,
        term.context || ''
      ])
    }

    const data = [
      emptyRow,  // Wiersz 1 - tytuł
      emptyRow,  // Wiersz 2 - podtytuł
      emptyRow,  // Wiersz 3 - pusty
      [t.sourceDoc, fileName, ...Array(numCols - 2).fill('')],
      [t.createdAt, new Date().toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }), ...Array(numCols - 2).fill('')],
      [t.termCount, terms.length.toString(), ...Array(numCols - 2).fill('')],
      emptyRow,  // Pusty wiersz
      headerRow,
      ...dataRows
    ]

    // Ustaw tytuły w pierwszym i drugim wierszu
    data[0][0] = 'IURIDICO EJ GTEXTT'
    data[1][0] = 'Glossary and Terminology Extraction Tool'

    const ws = XLSX.utils.aoa_to_sheet(data)

    // Scalanie komórek dla nazwy aplikacji (wiersze 1-2, wszystkie kolumny)
    const lastCol = numCols - 1
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } }, // Wiersz 1: IURIDICO EJ GTEXTT
      { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } }  // Wiersz 2: Glossary/Bilingual Glossary
    ]

    // Dynamiczne szerokości kolumn
    if (hasDefinitions) {
      ws['!cols'] = [
        { wch: 8 },   // Nr
        { wch: 30 },  // Termin
        { wch: 12 },  // Liczba wystąpień
        { wch: 25 },  // Dokument
        { wch: 60 },  // Definicja
        { wch: 18 },  // Źródło definicji
        { wch: 32 }   // Kontekst
      ]
    } else {
      ws['!cols'] = [
        { wch: 8 },   // Nr
        { wch: 30 },  // Termin
        { wch: 12 },  // Liczba wystąpień
        { wch: 25 },  // Dokument
        { wch: 80 }   // Kontekst (szersza bez definicji)
      ]
    }

    // Ustawienia wysokości wierszy dla lepszego formatowania
    ws['!rows'] = []
    for (let i = 0; i <= terms.length + 7; i++) {
      if (i === 0) {
        ws['!rows'][i] = { hpt: 25 } // Tytuł główny
      } else if (i === 1) {
        ws['!rows'][i] = { hpt: 20 } // Podtytuł
      } else if (i === 7) {
        ws['!rows'][i] = { hpt: 25 } // Nagłówek tabeli
      } else if (i >= 8) {
        ws['!rows'][i] = { hpt: 60 } // Dane - bardzo wysokie wiersze dla zawijania
      }
    }

    // Stylowanie komórek
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')

    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
        if (!ws[cellAddress]) continue

        // Domyślny styl
        ws[cellAddress].s = {
          alignment: { vertical: 'top', wrapText: true },
          border: {
            top: { style: 'thin', color: { rgb: 'E0E0E0' } },
            bottom: { style: 'thin', color: { rgb: 'E0E0E0' } },
            left: { style: 'thin', color: { rgb: 'E0E0E0' } },
            right: { style: 'thin', color: { rgb: 'E0E0E0' } }
          }
        }

        // Tytuł główny (wiersz 1)
        if (R === 0) {
          ws[cellAddress].s = {
            font: { bold: true, sz: 18, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '5B47A8' } },
            alignment: { vertical: 'center', horizontal: 'center', wrapText: false },
            border: {
              top: { style: 'thick', color: { rgb: '5B47A8' } },
              bottom: { style: 'thin', color: { rgb: '5B47A8' } },
              left: { style: 'thick', color: { rgb: '5B47A8' } },
              right: { style: 'thick', color: { rgb: '5B47A8' } }
            }
          }
        }

        // Podtytuł (wiersz 2)
        if (R === 1) {
          ws[cellAddress].s = {
            font: { sz: 11, color: { rgb: 'FFFFFF' }, italic: true },
            fill: { fgColor: { rgb: '5B47A8' } },
            alignment: { vertical: 'center', horizontal: 'center', wrapText: false },
            border: {
              top: { style: 'thin', color: { rgb: '5B47A8' } },
              bottom: { style: 'thick', color: { rgb: '5B47A8' } },
              left: { style: 'thick', color: { rgb: '5B47A8' } },
              right: { style: 'thick', color: { rgb: '5B47A8' } }
            }
          }
        }

        // Metadane (wiersze 4-6)
        if (R >= 3 && R <= 5) {
          if (C === 0) {
            ws[cellAddress].s = {
              font: { bold: true, sz: 11 },
              fill: { fgColor: { rgb: 'E8E8E8' } },
              alignment: { vertical: 'center' },
              border: {
                top: { style: 'thin', color: { rgb: 'CCCCCC' } },
                bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
                left: { style: 'thin', color: { rgb: 'CCCCCC' } },
                right: { style: 'thin', color: { rgb: 'CCCCCC' } }
              }
            }
          } else {
            ws[cellAddress].s = {
              font: { sz: 11 },
              alignment: { vertical: 'center', wrapText: true },
              border: {
                top: { style: 'thin', color: { rgb: 'CCCCCC' } },
                bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
                left: { style: 'thin', color: { rgb: 'CCCCCC' } },
                right: { style: 'thin', color: { rgb: 'CCCCCC' } }
              }
            }
          }
        }

        // Nagłówek tabeli (wiersz 8)
        if (R === 7) {
          ws[cellAddress].s = {
            font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12 },
            fill: { fgColor: { rgb: '2B579A' } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
              top: { style: 'medium', color: { rgb: '1E3A5F' } },
              bottom: { style: 'medium', color: { rgb: '1E3A5F' } },
              left: { style: 'medium', color: { rgb: '1E3A5F' } },
              right: { style: 'medium', color: { rgb: '1E3A5F' } }
            }
          }
        }

        // Dane tabeli (od wiersza 9)
        if (R >= 8) {
          const isEven = (R - 8) % 2 === 0
          ws[cellAddress].s = {
            font: { sz: 11 },
            alignment: {
              vertical: 'top',
              wrapText: true,
              horizontal: C === 0 || C === 2 ? 'center' : 'left'
            },
            fill: { fgColor: { rgb: isEven ? 'FFFFFF' : 'F5F5F5' } },
            border: {
              top: { style: 'thin', color: { rgb: 'D0D0D0' } },
              bottom: { style: 'thin', color: { rgb: 'D0D0D0' } },
              left: { style: 'thin', color: { rgb: 'D0D0D0' } },
              right: { style: 'thin', color: { rgb: 'D0D0D0' } }
            }
          }

          // Pogrubienie terminów (kolumna B)
          if (C === 1) {
            ws[cellAddress].s.font = { bold: true, sz: 12, color: { rgb: '1E3A5F' } }
          }

          // Wyróżnienie źródła definicji (kolumna E)
          if (C === 4 && ws[cellAddress].v) {
            const source = ws[cellAddress].v.toString()
            if (source === 'Z dokumentu') {
              ws[cellAddress].s.font = { ...ws[cellAddress].s.font, color: { rgb: '28A745' }, bold: true }
            } else if (source === 'Wygenerowane AI') {
              ws[cellAddress].s.font = { ...ws[cellAddress].s.font, color: { rgb: '6F42C1' }, bold: true }
            } else if (source === 'Edytowano') {
              ws[cellAddress].s.font = { ...ws[cellAddress].s.font, color: { rgb: 'FD7E14' }, bold: true }
            }
          }
        }
      }
    }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Glosariusz')

    // Zapisz plik
    const filename = `${fileName}_glosariusz.xlsx`
    XLSX.writeFile(wb, filename)
  }

  const exportToPDF = () => {
    // Nowa implementacja z pełnym wsparciem dla UTF-8 i polskich znaków
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 10

    // Nagłówek dokumentu
    doc.setFillColor(50, 50, 50)
    doc.rect(0, 0, pageWidth, 20, 'F')

    doc.setFontSize(16)
    doc.setTextColor(255, 255, 255)
    doc.text('IURIDICO EJ GTEXTT', margin, 8)

    doc.setFontSize(8)
    doc.setTextColor(220, 220, 220)
    doc.text('Glossary and Terminology Extraction Tool', margin, 14)

    // Informacje o dokumencie
    const dateStr = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    doc.setFontSize(7)
    doc.setTextColor(100, 100, 100)
    doc.text(`Document: ${fileName}`, margin, 25)
    doc.text(`Date: ${dateStr}`, pageWidth / 2, 25)
    doc.text(`Terms: ${terms.length}`, pageWidth - margin - 20, 25)

    // Sprawdź czy są definicje
    const hasDefinitions = terms.some(t => t.definition && t.definition.trim() !== '')

    // Przygotuj dane dla tabeli - dane są już w UTF-8, jsPDF autoTable je obsłuży
    const tableData = terms.map((term, index) => {
      let sourceText = '-'
      if (term.definitionSource === 'document') sourceText = 'Document'
      else if (term.definitionSource === 'edited') sourceText = 'Edited'
      else if (term.definitionSource === 'ai') sourceText = 'AI'

      return [
        String(index + 1),
        term.term || '',
        String(term.occurrences),
        term.definition || '-',
        sourceText,
        term.context || '-'
      ]
    })

    // Optymalne szerokości kolumn (A4 landscape = 297mm, dostępne ~277mm)
    // Suma kolumn musi być < 277mm aby uniknąć wychodzenia poza stronę
    const colWidths = hasDefinitions
      ? { 0: 10, 1: 42, 2: 18, 3: 60, 4: 22, 5: 70 }  // Z definicjami: 222mm
      : { 0: 10, 1: 45, 2: 18, 3: 18, 4: 22, 5: 105 } // Bez definicji: 218mm

    // Tabela z danymi
    autoTable(doc, {
      startY: 28,
      head: [['No.', 'Term', 'Number of\noccurrences', 'Definition', 'Source of\ndefinition', 'Context']],
      body: tableData,

      // Podstawowe style
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 2.5,
        overflow: 'linebreak',
        cellWidth: 'wrap',
        valign: 'top',
        halign: 'left',
        lineColor: [220, 220, 220],
        lineWidth: 0.1
      },

      // Style nagłówka
      headStyles: {
        fillColor: [70, 70, 70],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        cellPadding: 3
      },

      // Style poszczególnych kolumn
      columnStyles: {
        0: {
          cellWidth: colWidths[0],
          halign: 'center',
          valign: 'middle',
          fontSize: 7
        },
        1: {
          cellWidth: colWidths[1],
          fontStyle: 'bold',
          fontSize: 9,
          overflow: 'linebreak'
        },
        2: {
          cellWidth: colWidths[2],
          halign: 'center',
          valign: 'middle'
        },
        3: {
          cellWidth: colWidths[3],
          fontSize: 6.5,
          cellPadding: 2,
          overflow: 'linebreak'
        },
        4: {
          cellWidth: colWidths[4],
          halign: 'center',
          fontSize: 7
        },
        5: {
          cellWidth: colWidths[5],
          fontSize: 6.5,
          cellPadding: 2,
          overflow: 'linebreak',
          minCellWidth: 70
        }
      },

      // Naprzemienne wiersze
      alternateRowStyles: {
        fillColor: [250, 250, 250]
      },

      // Marginesy
      margin: { left: margin, right: margin },

      // Stopka na każdej stronie
      didDrawPage: function(data) {
        // Stopka
        const footerY = pageHeight - 8

        doc.setFontSize(7)
        doc.setTextColor(150, 150, 150)
        doc.text('Generated by IURIDICO EJ GTEXTT', margin, footerY)
        doc.text(`Page ${data.pageNumber}`, pageWidth / 2, footerY, { align: 'center' })
        doc.text(dateStr, pageWidth - margin, footerY, { align: 'right' })
      }
    })

    // Zapisz PDF
    doc.save(`${fileName}_glossary.pdf`)
  }

  const exportToJSON = () => {
    const jsonContent = JSON.stringify(terms, null, 2)
    const filename = `${fileName}_glosariusz.json`
    downloadFile(jsonContent, filename, 'application/json')
  }

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleImportJSON = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const data = JSON.parse(text)

        // Walidacja: sprawdź czy to jest poprawny format glosariusza
        if (!Array.isArray(data)) {
          alert('Błąd: Plik JSON musi zawierać tablicę terminów.')
          return
        }

        // Walidacja każdego terminu
        const importedTerms: Term[] = data.filter((item: any) => {
          return item && typeof item === 'object' && typeof item.term === 'string'
        }).map((item: any) => ({
          id: item.id || `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          term: item.term,
          context: item.context || '',
          occurrences: item.occurrences || 0,
          positions: Array.isArray(item.positions) ? item.positions : [],
          definition: item.definition || '',
          definitionSource: item.definitionSource || null,
          sourceDocument: item.sourceDocument || file.name
        }))

        if (importedTerms.length === 0) {
          alert('Błąd: Nie znaleziono poprawnych terminów w pliku JSON.')
          return
        }

        // Wywołaj callback z zaimportowanymi terminami
        if (onImportTerms) {
          onImportTerms(importedTerms, file.name)
        }

        console.log(`✅ Zaimportowano ${importedTerms.length} terminów z JSON`)
      } catch (error) {
        console.error('Błąd importu JSON:', error)
        alert('Błąd podczas importu pliku JSON. Sprawdź czy plik jest poprawny.')
      }
    }
    input.click()
  }

  const handleImportXLSX = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xlsx,.xls'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const data = await file.arrayBuffer()
        const workbook = XLSX.read(data, { type: 'array' })

        // Pobierz pierwszy arkusz
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]

        // Konwertuj arkusz do JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

        if (jsonData.length < 2) {
          alert('Błąd: Plik XLSX jest pusty lub nie zawiera danych.')
          return
        }

        // Znajdź wiersz nagłówka (zazwyczaj wiersz 8, ale szukamy po słowie "Termin")
        let headerRowIndex = -1
        let termColIndex = -1
        let occurrencesColIndex = -1
        let documentColIndex = -1
        let definitionColIndex = -1
        let sourceColIndex = -1
        let contextColIndex = -1

        for (let i = 0; i < Math.min(jsonData.length, 15); i++) {
          const row = jsonData[i]
          termColIndex = row.findIndex((cell: any) =>
            typeof cell === 'string' && cell.toLowerCase().includes('termin')
          )

          if (termColIndex !== -1) {
            headerRowIndex = i
            occurrencesColIndex = row.findIndex((cell: any) =>
              typeof cell === 'string' && cell.toLowerCase().includes('wystąpień')
            )
            documentColIndex = row.findIndex((cell: any) =>
              typeof cell === 'string' && cell.toLowerCase().includes('dokument')
            )
            definitionColIndex = row.findIndex((cell: any) =>
              typeof cell === 'string' && cell.toLowerCase().includes('definicja')
            )
            sourceColIndex = row.findIndex((cell: any) =>
              typeof cell === 'string' && cell.toLowerCase().includes('źródło')
            )
            contextColIndex = row.findIndex((cell: any) =>
              typeof cell === 'string' && cell.toLowerCase().includes('kontekst')
            )
            break
          }
        }

        if (headerRowIndex === -1 || termColIndex === -1) {
          alert('Błąd: Nie znaleziono kolumny "Termin" w pliku XLSX.')
          return
        }

        // Parsuj wiersze danych
        const importedTerms: Term[] = []
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i]
          const termValue = row[termColIndex]

          if (termValue && typeof termValue === 'string' && termValue.trim() !== '') {
            const term: Term = {
              id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              term: termValue.trim(),
              context: contextColIndex !== -1 ? (row[contextColIndex] || '') : '',
              occurrences: occurrencesColIndex !== -1 ? parseInt(row[occurrencesColIndex]) || 0 : 0,
              positions: [],
              definition: definitionColIndex !== -1 ? (row[definitionColIndex] || '') : '',
              definitionSource: null,
              sourceDocument: documentColIndex !== -1 ? (row[documentColIndex] || file.name) : file.name
            }

            // Ustaw definitionSource na podstawie kolumny źródła
            if (sourceColIndex !== -1 && row[sourceColIndex]) {
              const source = row[sourceColIndex].toString().toLowerCase()
              if (source.includes('dokument') || source.includes('document')) {
                term.definitionSource = 'document'
              } else if (source.includes('ai')) {
                term.definitionSource = 'ai'
              } else if (source.includes('edytowano') || source.includes('edited')) {
                term.definitionSource = 'edited'
              }
            }

            importedTerms.push(term)
          }
        }

        if (importedTerms.length === 0) {
          alert('Błąd: Nie znaleziono poprawnych terminów w pliku XLSX.')
          return
        }

        // Wywołaj callback z zaimportowanymi terminami
        if (onImportTerms) {
          onImportTerms(importedTerms, file.name)
        }

        console.log(`✅ Zaimportowano ${importedTerms.length} terminów z XLSX`)
      } catch (error) {
        console.error('Błąd importu XLSX:', error)
        alert('Błąd podczas importu pliku XLSX. Sprawdź czy plik jest poprawny.')
      }
    }
    input.click()
  }

  const hasTerms = terms.length > 0

  const handleImportChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    if (value === 'json') {
      handleImportJSON()
    } else if (value === 'xlsx') {
      handleImportXLSX()
    }
    // Reset select
    e.target.value = ''
  }

  const handleExportChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    if (value === 'xlsx') {
      exportToXLSX()
    } else if (value === 'pdf') {
      exportToPDF()
    } else if (value === 'csv') {
      exportToCSV()
    } else if (value === 'html') {
      exportToHTML()
    } else if (value === 'json') {
      exportToJSON()
    }
    // Reset select
    e.target.value = ''
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Import Dropdown - Always Active */}
      <div className="w-full">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Import
        </label>
        <select
          onChange={handleImportChange}
          className="w-full px-4 py-2.5 bg-white border-2 border-indigo-500 text-gray-700 rounded-lg hover:border-indigo-600 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 transition-all font-medium text-sm cursor-pointer"
        >
          <option value="">Wybierz format...</option>
          <option value="json">📥 Import JSON</option>
          <option value="xlsx">📥 Import XLSX</option>
        </select>
      </div>

      {/* Export Dropdown - Disabled when no terms */}
      <div className="w-full">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Eksport
        </label>
        <select
          onChange={handleExportChange}
          disabled={!hasTerms}
          className="w-full px-4 py-2.5 bg-white border-2 border-emerald-500 text-gray-700 rounded-lg hover:border-emerald-600 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 transition-all font-medium text-sm cursor-pointer disabled:bg-gray-200 disabled:border-gray-300 disabled:cursor-not-allowed disabled:text-gray-500"
        >
          <option value="">Wybierz format...</option>
          <option value="xlsx">📊 Excel (XLSX)</option>
          <option value="pdf">📄 PDF</option>
          <option value="csv">📊 CSV</option>
          <option value="html">🌐 HTML</option>
          <option value="json">💾 JSON</option>
        </select>
        <p className="text-xs text-gray-500 mt-2">
          <strong>XLSX, PDF i HTML</strong> zawierają definicje
        </p>
      </div>
    </div>
  )
}
