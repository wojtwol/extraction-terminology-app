# Ekstraktor Terminologii

Aplikacja webowa do ekstrakcji terminologii i tworzenia glosariuszy z dokumentów prawnych i urzędowych.

## Funkcje (wersja testowa)

- ✅ Upload dokumentów (TXT, HTML, DOCX, XLSX, XML)
- ✅ Ekstrakcja terminologii przy użyciu Claude AI
- ✅ Edycja terminów (modyfikacja, usuwanie)
- ✅ Zmiana kolejności terminów
- ✅ Sortowanie alfabetyczne i według liczby wystąpień
- ✅ Wyświetlanie kontekstu
- ✅ Przeszukiwanie glosariusza
- ✅ Eksport do CSV, HTML, JSON

## Wymagania

- Node.js 18+ (pobierz z https://nodejs.org)
- Klucz API Anthropic (utwórz konto na https://console.anthropic.com)

## Instalacja i uruchomienie lokalnie

1. **Zainstaluj zależności:**
```bash
npm install
```

2. **Uruchom serwer deweloperski:**
```bash
npm run dev
```

3. **Otwórz przeglądarkę:**
```
http://localhost:3000
```

4. **Użyj aplikacji:**
   - Wklej swój klucz API Anthropic (zaczyna się od `sk-ant-`)
   - Załaduj dokument
   - Poczekaj na ekstrakcję terminologii
   - Edytuj i eksportuj glosariusz

## Deployment na Vercel (DARMOWY!)

### Krok 1: Utwórz konto na Vercel

1. Wejdź na https://vercel.com
2. Kliknij "Sign Up"
3. Zaloguj się przez GitHub (najłatwiejszy sposób)

### Krok 2: Wypchnij kod na GitHub

Jeśli jeszcze nie masz kodu na GitHubie:

```bash
# Dodaj wszystkie pliki
git add .

# Utwórz commit
git commit -m "Initial commit - Ekstraktor Terminologii"

# Wypchnij na GitHub
git push -u origin claude/terminology-glossary-app-01VApkcCm3KZrfLVaq2wXyjX
```

### Krok 3: Deploy na Vercel

#### Opcja A: Przez stronę Vercel (najłatwiejsza)

1. Zaloguj się na https://vercel.com
2. Kliknij "Add New..." → "Project"
3. Wybierz swoje repozytorium GitHub
4. Kliknij "Import"
5. Vercel automatycznie wykryje Next.js - **nie zmieniaj niczego**
6. Kliknij "Deploy"
7. Poczekaj 2-3 minuty
8. **Gotowe!** Dostaniesz link typu `https://twoja-aplikacja.vercel.app`

#### Opcja B: Przez terminal (dla zaawansowanych)

```bash
# Zainstaluj Vercel CLI
npm install -g vercel

# Zaloguj się
vercel login

# Deploy
vercel

# Dla produkcji
vercel --prod
```

### Krok 4: Używanie aplikacji

1. Otwórz link do swojej aplikacji
2. Pobierz klucz API z https://console.anthropic.com
3. Wklej klucz w aplikacji
4. Załaduj dokument i korzystaj!

## Bezpieczeństwo

⚠️ **WAŻNE:**
- Klucz API jest przechowywany tylko w pamięci przeglądarki (nie na serwerze)
- Dokumenty są przetwarzane tymczasowo i nie są zapisywane
- Dla produkcji rozważ dodanie autoryzacji użytkowników

## Rozwój aplikacji

To jest wersja testowa. Planowane funkcje:

- [ ] Glosariusze dwujęzyczne
- [ ] Więcej formatów (RTF, TMX, XLIFF, SDLXLIFF)
- [ ] Podgląd i nawigacja w dokumencie źródłowym
- [ ] Eksport do PDF i formatów CAT
- [ ] Wskazanie jednostek redakcyjnych
- [ ] Więcej parametrów ekstrakcji
- [ ] Obsługa jeszcze większych plików

## Problemy?

- **Błąd "Failed to extract"** - sprawdź klucz API
- **Aplikacja nie działa** - sprawdź konsolę przeglądarki (F12)
- **Deployment nie działa** - sprawdź logi na Vercel

## Technologie

- Next.js 14 + TypeScript
- React
- Tailwind CSS
- Anthropic Claude API
- Vercel (hosting)
