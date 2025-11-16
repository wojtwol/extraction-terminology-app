'use client'

import './globals.css'
import { LanguageProvider } from '@/contexts/LanguageContext'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pl">
      <head>
        <title>IURIDICO EJ GTEXTT - Glossary and Terminology Extraction Tool</title>
        <meta name="description" content="Professional tool for terminology extraction and glossary creation from legal and official documents" />
      </head>
      <body>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  )
}
