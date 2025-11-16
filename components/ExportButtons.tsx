'use client'

import { Term } from '@/app/page'
import * as XLSX from 'xlsx'
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
                <div class="source-badge ${term.definitionSource === 'document' ? 'source-document' : 'source-ai'}">
                  ${term.definitionSource === 'document' ? 'Z dokumentu' : 'Wygenerowane AI'}
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
      ['IURIDICO EJ GTEXTT - Glossary and Terminology Extraction Tool', '', '', '', '', ''],
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
         term.definitionSource === 'ai' ? 'Wygenerowane AI' : '',
        term.context || ''
      ])
    ]

    const ws = XLSX.utils.aoa_to_sheet(data)

    // Szerokości kolumn
    ws['!cols'] = [
      { wch: 6 },   // Nr
      { wch: 30 },  // Termin
      { wch: 12 },  // Wystąpienia
      { wch: 60 },  // Definicja
      { wch: 20 },  // Źródło
      { wch: 70 }   // Kontekst
    ]

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

        // Tytuł (wiersz 1)
        if (R === 0) {
          ws[cellAddress].s = {
            font: { bold: true, sz: 14, color: { rgb: '1F4E78' } },
            fill: { fgColor: { rgb: 'E7E6F7' } },
            alignment: { vertical: 'center', wrapText: true }
          }
        }

        // Metadane (wiersze 2-4)
        if (R >= 1 && R <= 3) {
          if (C === 0) {
            ws[cellAddress].s = {
              font: { bold: true, sz: 10 },
              fill: { fgColor: { rgb: 'F2F2F2' } },
              alignment: { vertical: 'center' }
            }
          } else {
            ws[cellAddress].s = {
              alignment: { vertical: 'center', wrapText: true }
            }
          }
        }

        // Nagłówek tabeli (wiersz 6)
        if (R === 5) {
          ws[cellAddress].s = {
            font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
            fill: { fgColor: { rgb: '4472C4' } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: {
              top: { style: 'medium', color: { rgb: '2E5C8A' } },
              bottom: { style: 'medium', color: { rgb: '2E5C8A' } },
              left: { style: 'thin', color: { rgb: '2E5C8A' } },
              right: { style: 'thin', color: { rgb: '2E5C8A' } }
            }
          }
        }

        // Dane tabeli (od wiersza 7)
        if (R >= 6) {
          const isEven = (R - 6) % 2 === 0
          ws[cellAddress].s = {
            alignment: {
              vertical: 'top',
              wrapText: true,
              horizontal: C === 0 || C === 2 ? 'center' : 'left'
            },
            fill: { fgColor: { rgb: isEven ? 'FFFFFF' : 'F8F9FA' } },
            border: {
              top: { style: 'thin', color: { rgb: 'E0E0E0' } },
              bottom: { style: 'thin', color: { rgb: 'E0E0E0' } },
              left: { style: 'thin', color: { rgb: 'E0E0E0' } },
              right: { style: 'thin', color: { rgb: 'E0E0E0' } }
            }
          }

          // Pogrubienie terminów (kolumna B)
          if (C === 1) {
            ws[cellAddress].s.font = { bold: true, sz: 10 }
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
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: true
    })

    // Tytuł
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('IURIDICO EJ GTEXTT', 14, 15)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text('Glossary and Terminology Extraction Tool', 14, 22)

    // Linia separująca
    doc.setDrawColor(200, 200, 200)
    doc.line(14, 25, 283, 25)

    // Metadane
    doc.setFontSize(9)
    doc.setTextColor(60, 60, 60)
    doc.setFont('helvetica', 'normal')
    doc.text(`Dokument: ${fileName}`, 14, 31)
    doc.text(`Data: ${new Date().toLocaleDateString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`, 14, 36)
    doc.text(`Liczba terminów: ${terms.length}`, 14, 41)

    // Przygotuj dane tabeli - BEZ truncate, pełny tekst
    const tableData = terms.map((term, index) => [
      (index + 1).toString(),
      term.term,
      term.occurrences.toString(),
      term.definition || '-',
      term.definitionSource === 'document' ? 'Z dokumentu' :
       term.definitionSource === 'ai' ? 'AI' : '-',
      term.context || '-'
    ])

    // Utwórz tabelę z lepszym formatowaniem
    autoTable(doc, {
      startY: 48,
      head: [['Nr', 'Termin', 'Wyst.', 'Definicja', 'Źródło', 'Kontekst']],
      body: tableData,
      styles: {
        fontSize: 7,
        cellPadding: 2.5,
        font: 'helvetica',
        overflow: 'linebreak',
        cellWidth: 'wrap',
        lineColor: [220, 220, 220],
        lineWidth: 0.1,
        textColor: [40, 40, 40],
        minCellHeight: 8
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
        valign: 'middle',
        cellPadding: 3
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center', valign: 'middle' },  // Nr
        1: { cellWidth: 40, fontStyle: 'bold', valign: 'top' },     // Termin
        2: { cellWidth: 15, halign: 'center', valign: 'middle' },   // Wystąpienia
        3: { cellWidth: 70, valign: 'top' },                        // Definicja
        4: { cellWidth: 20, halign: 'center', fontSize: 6, valign: 'middle' }, // Źródło
        5: { cellWidth: 105, valign: 'top' }                        // Kontekst
      },
      alternateRowStyles: {
        fillColor: [248, 249, 250]
      },
      margin: { left: 14, right: 14 },
      tableWidth: 'auto',
      showHead: 'everyPage',
      didDrawPage: function (data) {
        // Stopka na każdej stronie
        doc.setFontSize(7)
        doc.setTextColor(150, 150, 150)
        doc.text(
          `Strona ${data.pageNumber}`,
          doc.internal.pageSize.getWidth() / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        )
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
    <>
      <button
        onClick={exportToXLSX}
        className="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm"
      >
        📊 Excel (XLSX)
      </button>

      <button
        onClick={exportToPDF}
        className="w-full px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm"
      >
        📄 PDF
      </button>

      <button
        onClick={exportToCSV}
        className="w-full px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
      >
        📊 CSV
      </button>

      <button
        onClick={exportToHTML}
        className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
      >
        🌐 HTML
      </button>

      <button
        onClick={exportToJSON}
        className="w-full px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm"
      >
        📄 JSON
      </button>

      <p className="text-xs text-gray-500 mt-2">
        <strong>XLSX i PDF</strong> zawierają definicje
      </p>
    </>
  )
}
