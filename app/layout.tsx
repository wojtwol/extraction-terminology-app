import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'IURIDICO EJ GTEXTT - Glossary and Terminology Extraction Tool',
  description: 'Profesjonalne narzędzie do ekstrakcji terminologii i tworzenia glosariuszy z dokumentów prawnych i urzędowych',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  )
}
