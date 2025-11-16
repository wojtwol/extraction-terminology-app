'use client'

import { Term } from '@/app/page'
import * as XLSX from 'xlsx-js-style'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface ExportButtonsProps {
  terms: Term[]
  fileName: string
  documentText: string
  glossaryMode?: 'monolingual' | 'bilingual' | null
  sourceLanguage?: string
  targetLanguage?: string
  sourceFileName?: string
  targetFileName?: string
}

export default function ExportButtons({
  terms,
  fileName,
  documentText,
  glossaryMode,
  sourceLanguage,
  targetLanguage,
  sourceFileName,
  targetFileName
}: ExportButtonsProps) {
  const isBilingual = glossaryMode === 'bilingual'
  const hasTargetTerms = terms.some(t => t.targetTerm || t.targetSource === 'missing')
  const exportToCSV = () => {
    let csvContent: string

    if (isBilingual && hasTargetTerms) {
      // Bilingual CSV
      const headers = ['Nr', 'Source Term', 'Occurrences', 'Target Term', 'Source Context', 'Target Context', 'Status']
      const rows = terms.map((term, index) => [
        (index + 1).toString(),
        term.term,
        term.occurrences.toString(),
        term.targetTerm || '',
        term.context || '',
        term.targetContext || '',
        term.targetSource === 'document' ? 'Document' :
        term.targetSource === 'ai' ? 'AI' :
        term.targetSource === 'manual' ? 'Manual' : 'Missing'
      ])

      csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n')
    } else {
      // Monolingual CSV (original)
      csvContent = [
        ['Termin', 'Liczba wystąpień', 'Kontekst'],
        ...terms.map(term => [
          term.term,
          term.occurrences.toString(),
          term.context || ''
        ])
      ]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n')
    }

    const filename = isBilingual && hasTargetTerms
      ? `${sourceFileName || fileName}_${sourceLanguage}-${targetLanguage}_glossary.csv`
      : `${fileName}_glosariusz.csv`

    downloadFile(csvContent, filename, 'text/csv;charset=utf-8;')
  }

  const exportToHTML = () => {
    // Sprawdź czy są definicje
    const hasDefinitions = terms.some(t => t.definition && t.definition.trim() !== '')

    // Dynamiczne szerokości kolumn
    const definitionWidth = hasDefinitions ? '30%' : '15%'  // 50% mniej gdy brak definicji
    const sourceWidth = '100px'
    const contextWidth = hasDefinitions ? '30%' : '45%'     // Rozszerzona gdy brak definicji

    const htmlContent = `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Glosariusz - ${fileName}</title>
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
        <span class="metadata-label">Dokument źródłowy:</span>
        <span>${fileName}</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">Liczba terminów:</span>
        <span>${terms.length}</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">Data utworzenia:</span>
        <span>${new Date().toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="nr-col">Nr</th>
          <th style="width: 200px;">Termin</th>
          <th style="width: 80px; text-align: center;">Liczba wystąpień</th>
          <th style="width: ${definitionWidth};">Definicja</th>
          <th style="width: ${sourceWidth}; text-align: center;">Źródło definicji</th>
          <th style="width: ${contextWidth};">Kontekst</th>
        </tr>
      </thead>
      <tbody>
        ${terms.map((term, index) => `
          <tr>
            <td class="nr-col">${index + 1}</td>
            <td class="term">${term.term}</td>
            <td class="occurrences">${term.occurrences}</td>
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
                      ? 'Dokument'
                      : term.definitionSource === 'edited'
                      ? 'Edytowano'
                      : 'AI'
                  }
                </div>
              ` : '<span style="color: #adb5bd;">-</span>'}
            </td>
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

  const exportToJSON = () => {
    const baseData: any = {
      createdAt: new Date().toISOString(),
      termsCount: terms.length,
      glossaryMode: glossaryMode || 'monolingual'
    }

    if (isBilingual && hasTargetTerms) {
      // Bilingual JSON
      baseData.sourceFile = sourceFileName || fileName
      baseData.targetFile = targetFileName
      baseData.sourceLanguage = sourceLanguage
      baseData.targetLanguage = targetLanguage
      baseData.terms = terms.map(term => ({
        sourceTerm: term.term,
        sourceOccurrences: term.occurrences,
        sourceContext: term.context,
        sourcePositions: term.positions,
        targetTerm: term.targetTerm,
        targetOccurrences: term.targetOccurrences,
        targetContext: term.targetContext,
        targetPositions: term.targetPositions,
        targetSource: term.targetSource
      }))
    } else {
      // Monolingual JSON (original)
      baseData.sourceFile = fileName
      baseData.terms = terms.map(term => ({
        term: term.term,
        occurrences: term.occurrences,
        context: term.context,
        positions: term.positions,
        definition: term.definition,
        definitionSource: term.definitionSource
      }))
    }

    const jsonContent = JSON.stringify(baseData, null, 2)

    const filename = isBilingual && hasTargetTerms
      ? `${sourceFileName || fileName}_${sourceLanguage}-${targetLanguage}_glossary.json`
      : `${fileName}_glosariusz.json`

    downloadFile(jsonContent, filename, 'application/json;charset=utf-8;')
  }

  const exportToXLSX = () => {
    let data: any[][]
    let numCols = 6

    if (isBilingual && hasTargetTerms) {
      // Bilingual XLSX
      numCols = 7
      data = [
        ['IURIDICO EJ GTEXTT', '', '', '', '', '', ''],
        ['Bilingual Glossary', '', '', '', '', '', ''],
        ['', '', '', '', '', '', ''],
        ['Source file:', sourceFileName || fileName, '', '', '', '', ''],
        ['Target file:', targetFileName || '', '', '', '', '', ''],
        ['Languages:', `${sourceLanguage} → ${targetLanguage}`, '', '', '', '', ''],
        ['Date:', new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }), '', '', '', '', ''],
        ['Terms count:', terms.length.toString(), '', '', '', '', ''],
        [],
        ['No.', 'Source Term', 'Occ.', 'Target Term', 'Source Context', 'Target Context', 'Status'],
        ...terms.map((term, index) => [
          (index + 1).toString(),
          term.term,
          term.occurrences.toString(),
          term.targetTerm || '',
          term.context || '',
          term.targetContext || '',
          term.targetSource === 'document' ? 'Document' :
           term.targetSource === 'ai' ? 'AI' :
           term.targetSource === 'manual' ? 'Manual' : 'Missing'
        ])
      ]
    } else {
      // Monolingual XLSX (original)
      data = [
        ['IURIDICO EJ GTEXTT', '', '', '', '', ''],
        ['Glossary and Terminology Extraction Tool', '', '', '', '', ''],
        ['', '', '', '', '', ''],
        ['Dokument źródłowy:', fileName, '', '', '', ''],
        ['Data utworzenia:', new Date().toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }), '', '', '', ''],
        ['Liczba terminów:', terms.length.toString(), '', '', '', ''],
        [],
        ['Nr', 'Termin', 'Liczba wystąpień', 'Definicja', 'Źródło definicji', 'Kontekst'],
        ...terms.map((term, index) => [
          (index + 1).toString(),
          term.term,
          term.occurrences.toString(),
          term.definition || '',
          term.definitionSource === 'document' ? 'Z dokumentu' :
           term.definitionSource === 'edited' ? 'Edytowano' :
           term.definitionSource === 'ai' ? 'Wygenerowane AI' : '',
          term.context || ''
        ])
      ]
    }

    const ws = XLSX.utils.aoa_to_sheet(data)

    // Scalanie komórek dla nazwy aplikacji (wiersze 1-2, wszystkie kolumny)
    const lastCol = numCols - 1
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } }, // Wiersz 1: IURIDICO EJ GTEXTT
      { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } }  // Wiersz 2: Glossary/Bilingual Glossary
    ]

    // Dynamiczne szerokości kolumn
    if (isBilingual && hasTargetTerms) {
      // Bilingual columns
      ws['!cols'] = [
        { wch: 8 },   // Nr
        { wch: 30 },  // Source Term
        { wch: 12 },  // Occurrences
        { wch: 30 },  // Target Term
        { wch: 40 },  // Source Context
        { wch: 40 },  // Target Context
        { wch: 15 }   // Status
      ]
    } else {
      // Monolingual columns (original)
      const hasDefinitions = terms.some(t => t.definition && t.definition.trim() !== '')
      const definitionColWidth = hasDefinitions ? 70 : 12
      const sourceColWidth = hasDefinitions ? 18 : 18
      const contextColWidth = hasDefinitions ? 36 : 72

      ws['!cols'] = [
        { wch: 20 },                 // Nr
        { wch: 35 },                 // Termin
        { wch: 18 },                 // Liczba wystąpień
        { wch: definitionColWidth }, // Definicja (dynamiczna)
        { wch: sourceColWidth },     // Źródło (dynamiczna)
        { wch: contextColWidth }     // Kontekst (zwężona, z zawijaniem)
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
    const filename = isBilingual && hasTargetTerms
      ? `${sourceFileName || fileName}_${sourceLanguage}-${targetLanguage}_glossary.xlsx`
      : `${fileName}_glosariusz.xlsx`

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

  return (
    <div className="flex flex-col gap-2 items-start">
      <button
        onClick={exportToXLSX}
        className="w-[180px] px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm flex items-center gap-2"
      >
        📊 Excel (XLSX)
      </button>

      <button
        onClick={exportToPDF}
        className="w-[180px] px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm flex items-center gap-2"
      >
        📄 PDF
      </button>

      <button
        onClick={exportToCSV}
        className="w-[180px] px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm flex items-center gap-2"
      >
        📊 CSV
      </button>

      <button
        onClick={exportToHTML}
        className="w-[180px] px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm flex items-center gap-2"
      >
        🌐 HTML
      </button>

      <button
        onClick={exportToJSON}
        className="w-[180px] px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm flex items-center gap-2"
      >
        📄 JSON
      </button>

      <p className="text-xs text-gray-500 mt-2">
        <strong>XLSX, PDF i HTML</strong> zawierają definicje
      </p>
    </div>
  )
}
