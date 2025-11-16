'use client'

import { Term } from '@/app/page'
import * as XLSX from 'xlsx-js-style'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface ExportButtonsProps {
  terms: Term[]
  fileName: string
  documentText: string
}

export default function ExportButtons({ terms, fileName, documentText }: ExportButtonsProps) {
  const exportToCSV = () => {
    const csvContent = [
      ['Termin', 'Wystąpienia', 'Kontekst'],
      ...terms.map(term => [
        term.term,
        term.occurrences.toString(),
        term.context || ''
      ])
    ]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')

    downloadFile(csvContent, `${fileName}_glosariusz.csv`, 'text/csv;charset=utf-8;')
  }

  const exportToHTML = () => {
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
          <th style="width: 80px; text-align: center;">Wystąpienia</th>
          <th style="width: 35%;">Definicja</th>
          <th style="width: 35%;">Kontekst</th>
        </tr>
      </thead>
      <tbody>
        ${terms.map((term, index) => `
          <tr>
            <td class="nr-col">${index + 1}</td>
            <td class="term">${term.term}</td>
            <td class="occurrences">${term.occurrences}</td>
            <td>
              ${term.definition ? `
                <div class="definition">${term.definition}</div>
                <div class="source-badge ${
                  term.definitionSource === 'document'
                    ? 'source-document'
                    : term.definitionSource === 'edited'
                    ? 'source-edited'
                    : 'source-ai'
                }">
                  ${
                    term.definitionSource === 'document'
                      ? 'Z dokumentu'
                      : term.definitionSource === 'edited'
                      ? 'Edytowano'
                      : 'Wygenerowane AI'
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
    const jsonContent = JSON.stringify({
      sourceFile: fileName,
      createdAt: new Date().toISOString(),
      termsCount: terms.length,
      terms: terms.map(term => ({
        term: term.term,
        occurrences: term.occurrences,
        context: term.context,
        positions: term.positions
      }))
    }, null, 2)

    downloadFile(jsonContent, `${fileName}_glosariusz.json`, 'application/json;charset=utf-8;')
  }

  const exportToXLSX = () => {
    // Przygotuj dane dla XLSX
    const data = [
      ['IURIDICO EJ GTEXTT', '', '', '', '', ''],
      ['Glossary and Terminology Extraction Tool', '', '', '', '', ''],
      ['', '', '', '', '', ''],
      ['Dokument źródłowy:', fileName, '', '', '', ''],
      ['Data utworzenia:', new Date().toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }), '', '', '', ''],
      ['Liczba terminów:', terms.length.toString(), '', '', '', ''],
      [],
      ['Nr', 'Termin', 'Wystąpienia', 'Definicja', 'Źródło definicji', 'Kontekst'],
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

    const ws = XLSX.utils.aoa_to_sheet(data)

    // Szerokości kolumn - dostosowane wg wymagań
    ws['!cols'] = [
      { wch: 10 },   // Nr (+30%)
      { wch: 35 },  // Termin
      { wch: 11 },  // Wystąpienia (-25%)
      { wch: 70 },  // Definicja
      { wch: 22 },  // Źródło
      { wch: 80 }   // Kontekst
    ]

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
    XLSX.writeFile(wb, `${fileName}_glosariusz.xlsx`)
  }

  const exportToPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 15

    // Nagłówek strony z gradientem (symulacja)
    doc.setFillColor(91, 71, 168) // Fioletowy
    doc.rect(0, 0, pageWidth, 35, 'F')

    // Tytuł
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text('IURIDICO EJ GTEXTT', margin, 15)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(230, 230, 230)
    doc.text('Glossary and Terminology Extraction Tool', margin, 22)

    // Metadane w białym bloku
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.1)
    doc.roundedRect(margin, 28, pageWidth - 2 * margin, 2, 0, 0, 'FD')

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text(`Dokument: ${fileName}`, margin + 3, 29)
    doc.setTextColor(100, 100, 100)
    doc.text(`|`, margin + 70, 29)
    doc.text(`Data: ${new Date().toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, margin + 72, 29)
    doc.text(`|`, margin + 120, 29)
    doc.text(`Terminów: ${terms.length}`, margin + 122, 29)

    // Przygotuj dane tabeli
    const tableData = terms.map((term, index) => {
      const sourceText = term.definitionSource === 'document' ? 'Dok.' :
                        term.definitionSource === 'edited' ? 'Ed.' :
                        term.definitionSource === 'ai' ? 'AI' : '-'

      return [
        (index + 1).toString(),
        term.term,
        term.occurrences.toString(),
        term.definition || '-',
        sourceText,
        term.context || '-'
      ]
    })

    // Tabela z nowoczesnym designem
    autoTable(doc, {
      startY: 38,
      head: [['Nr', 'Termin', 'Wyst.', 'Definicja', 'Źr.', 'Kontekst']],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3.5,
        font: 'helvetica',
        overflow: 'linebreak',
        cellWidth: 'wrap',
        lineColor: [220, 220, 220],
        lineWidth: 0.1,
        textColor: [50, 50, 50],
        valign: 'top',
        halign: 'left'
      },
      headStyles: {
        fillColor: [43, 87, 154],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10,
        halign: 'center',
        valign: 'middle',
        cellPadding: 4,
        lineWidth: 0.2,
        lineColor: [30, 60, 120]
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center', valign: 'middle', fontStyle: 'normal', textColor: [100, 100, 100] },
        1: { cellWidth: 35, fontStyle: 'bold', textColor: [30, 60, 95] },
        2: { cellWidth: 12, halign: 'center', valign: 'middle' },
        3: { cellWidth: 50 },
        4: { cellWidth: 11, halign: 'center', fontSize: 8, textColor: [100, 100, 100] },
        5: { cellWidth: 62 }
      },
      alternateRowStyles: {
        fillColor: [250, 250, 252]
      },
      margin: { left: margin, right: margin, top: 35, bottom: 20 },
      didDrawPage: function (data) {
        // Nagłówek na każdej stronie (poza pierwszą)
        if (data.pageNumber > 1) {
          doc.setFillColor(91, 71, 168)
          doc.rect(0, 0, pageWidth, 12, 'F')
          doc.setFontSize(10)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(255, 255, 255)
          doc.text('IURIDICO EJ GTEXTT', margin, 8)
          doc.setFontSize(7)
          doc.setFont('helvetica', 'normal')
          doc.text(fileName, pageWidth - margin, 8, { align: 'right' })
        }

        // Stopka
        doc.setFontSize(8)
        doc.setTextColor(150, 150, 150)
        doc.setFont('helvetica', 'normal')
        const pageText = `Strona ${data.pageNumber}`
        doc.text(pageText, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' })

        // Dodatkowa informacja w stopce
        doc.setFontSize(7)
        doc.text('Wygenerowano przez IURIDICO EJ GTEXTT', margin, doc.internal.pageSize.getHeight() - 10)
      }
    })

    doc.save(`${fileName}_glosariusz.pdf`)
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
        className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm flex items-center gap-2"
      >
        📊 Excel (XLSX)
      </button>

      <button
        onClick={exportToPDF}
        className="px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm flex items-center gap-2"
      >
        📄 PDF
      </button>

      <button
        onClick={exportToCSV}
        className="px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm flex items-center gap-2"
      >
        📊 CSV
      </button>

      <button
        onClick={exportToHTML}
        className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm flex items-center gap-2"
      >
        🌐 HTML
      </button>

      <button
        onClick={exportToJSON}
        className="px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm flex items-center gap-2"
      >
        📄 JSON
      </button>

      <p className="text-xs text-gray-500 mt-2">
        <strong>XLSX, PDF i HTML</strong> zawierają definicje
      </p>
    </div>
  )
}
