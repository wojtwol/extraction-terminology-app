import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ekstraktor Terminologii',
  description: 'Aplikacja do ekstrakcji terminologii i tworzenia glosariuszy',
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
