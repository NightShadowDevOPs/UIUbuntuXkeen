export declare const normalizeProviderIcon: (v: any) => string;
/**
 * Convert a flag emoji (pair of Regional Indicator Symbols) to ISO 3166-1 alpha-2.
 * Examples: "🇩🇪" -> "DE", "🇯🇵" -> "JP".
 */
export declare const flagEmojiToCountryCode: (emoji: string) => string;
export declare const countryCodeToFlagEmoji: (code: string) => string;
export declare const providerIconLabel: (icon: string) => {
    kind: "none" | "globe" | "flag";
    text: string;
};
