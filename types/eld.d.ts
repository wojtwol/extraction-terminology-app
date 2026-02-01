declare module 'eld' {
  export interface DetectionResult {
    language: string
    getScores(): Record<string, number>
    isReliable(): boolean
  }

  export interface ELD {
    detect(text: string): DetectionResult
    dynamicLangSubset(languages: string[] | false): Record<string, boolean> | void
    info(): {
      languages: string[]
      ngramsDatabase: string
      subset: string[] | null
    }
  }

  export const eld: ELD
}
