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
      font-family: Arial, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    h1 {
      color: #333;
      border-bottom: 3px solid #0066cc;
      padding-bottom: 10px;
    }
    table {
      width: 100%;
      background: white;
      border-collapse: collapse;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    th {
      background: #0066cc;
      color: white;
      padding: 12px;
      text-align: left;
    }
    td {
      padding: 10px;
      border-bottom: 1px solid #ddd;
    }
    tr:hover {
      background: #f9f9f9;
    }
    .context {
      font-size: 0.9em;
      color: #666;
      font-style: italic;
    }
  </style>
</head>
<body>
  <h1>Glosariusz terminologiczny</h1>
  <p><strong>Dokument źródłowy:</strong> ${fileName}</p>
  <p><strong>Liczba terminów:</strong> ${terms.length}</p>
  <p><strong>Data utworzenia:</strong> ${new Date().toLocaleDateString('pl-PL')}</p>

  <table>
    <thead>
      <tr>
        <th>Nr</th>
        <th>Termin</th>
        <th>Wystąpienia</th>
        <th>Kontekst</th>
      </tr>
    </thead>
    <tbody>
      ${terms.map((term, index) => `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${term.term}</strong></td>
          <td>${term.occurrences}</td>
          <td class="context">${term.context || ''}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
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
      ['Glosariusz terminologiczny', '', '', '', ''],
      ['Dokument źródłowy:', fileName, '', '', ''],
      ['Data utworzenia:', new Date().toLocaleDateString('pl-PL'), '', '', ''],
      ['Liczba terminów:', terms.length.toString(), '', '', ''],
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

    // Stylowanie (szerokości kolumn)
    ws['!cols'] = [
      { wch: 5 },   // Nr
      { wch: 25 },  // Termin
      { wch: 12 },  // Wystąpienia
      { wch: 50 },  // Definicja
      { wch: 18 },  // Źródło
      { wch: 60 }   // Kontekst
    ]

    // Pogrubienie nagłówków
    const headerCell = ws['A1']
    if (headerCell) {
      headerCell.s = {
        font: { bold: true, sz: 14 }
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
      format: 'a4'
    })

    // Tytuł
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('Glosariusz terminologiczny', 14, 15)

    // Metadane
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Dokument źródłowy: ${fileName}`, 14, 25)
    doc.text(`Data utworzenia: ${new Date().toLocaleDateString('pl-PL')}`, 14, 30)
    doc.text(`Liczba terminów: ${terms.length}`, 14, 35)

    // Tabela
    const tableData = terms.map((term, index) => [
      (index + 1).toString(),
      term.term,
      term.occurrences.toString(),
      term.definition || '-',
      term.definitionSource === 'document' ? 'Z dokumentu' :
       term.definitionSource === 'ai' ? 'AI' : '-',
      (term.context || '').substring(0, 100) + (term.context && term.context.length > 100 ? '...' : '')
    ])

    autoTable(doc, {
      startY: 42,
      head: [['Nr', 'Termin', 'Wyst.', 'Definicja', 'Źródło', 'Kontekst']],
      body: tableData,
      styles: {
        fontSize: 8,
        cellPadding: 2,
        font: 'helvetica'
      },
      headStyles: {
        fillColor: [0, 102, 204],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9
      },
      columnStyles: {
        0: { cellWidth: 10 },  // Nr
        1: { cellWidth: 40 },  // Termin
        2: { cellWidth: 15 },  // Wystąpienia
        3: { cellWidth: 70 },  // Definicja
        4: { cellWidth: 25 },  // Źródło
        5: { cellWidth: 70 }   // Kontekst
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
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
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">
        2. Eksportuj glosariusz
      </h2>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={exportToXLSX}
          className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium shadow-md"
        >
          📊 Excel (XLSX)
        </button>

        <button
          onClick={exportToPDF}
          className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium shadow-md"
        >
          📄 PDF
        </button>

        <button
          onClick={exportToCSV}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
        >
          📊 CSV
        </button>

        <button
          onClick={exportToHTML}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          🌐 HTML
        </button>

        <button
          onClick={exportToJSON}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium col-span-2"
        >
          📄 JSON
        </button>
      </div>

      <p className="text-sm text-gray-500 mt-4">
        <strong>XLSX i PDF</strong> zawierają definicje i oznaczenia źródła
      </p>
    </div>
  )
}
