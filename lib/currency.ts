export const SUPPORTED_CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar', region: 'Americas' },
  { code: 'EUR', symbol: '€', name: 'Euro', region: 'Europe' },
  { code: 'GBP', symbol: '£', name: 'British Pound', region: 'Europe' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', region: 'Americas' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', region: 'Asia-Pacific' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', region: 'Asia-Pacific' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', region: 'Europe' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', region: 'Asia-Pacific' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', region: 'Asia-Pacific' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', region: 'Americas' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso', region: 'Americas' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', region: 'Asia-Pacific' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', region: 'Asia-Pacific' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', region: 'Asia-Pacific' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', region: 'Europe' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', region: 'Europe' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone', region: 'Europe' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Zloty', region: 'Europe' },
  { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna', region: 'Europe' },
  { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint', region: 'Europe' },
  { code: 'ILS', symbol: '₪', name: 'Israeli Shekel', region: 'Middle East' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht', region: 'Asia-Pacific' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', region: 'Asia-Pacific' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso', region: 'Asia-Pacific' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', region: 'Asia-Pacific' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong', region: 'Asia-Pacific' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won', region: 'Asia-Pacific' },
  { code: 'TWD', symbol: 'NT$', name: 'New Taiwan Dollar', region: 'Asia-Pacific' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', region: 'Africa' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', region: 'Middle East' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal', region: 'Middle East' },
  { code: 'QAR', symbol: '﷼', name: 'Qatari Riyal', region: 'Middle East' },
  { code: 'KWD', symbol: 'د.ك', name: 'Kuwaiti Dinar', region: 'Middle East' },
  { code: 'BHD', symbol: '.د.ب', name: 'Bahraini Dinar', region: 'Middle East' },
  { code: 'OMR', symbol: '﷼', name: 'Omani Rial', region: 'Middle East' },
  { code: 'JOD', symbol: 'JD', name: 'Jordanian Dinar', region: 'Middle East' },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound', region: 'Africa' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', region: 'Africa' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', region: 'Africa' },
  { code: 'GHS', symbol: '₵', name: 'Ghanaian Cedi', region: 'Africa' },
] as const;

export type CurrencyCode = typeof SUPPORTED_CURRENCIES[number]['code'];

export interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  name: string;
  region: string;
}

export function formatCurrency(amount: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function getCurrencySymbol(currency: CurrencyCode): string {
  const found = SUPPORTED_CURRENCIES.find(c => c.code === currency);
  return found?.symbol || currency;
}

export function getCurrencyInfo(currency: CurrencyCode): CurrencyInfo | undefined {
  return SUPPORTED_CURRENCIES.find(c => c.code === currency);
}

export function getCurrenciesByRegion(): Record<string, CurrencyInfo[]> {
  const grouped: Record<string, CurrencyInfo[]> = {};
  for (const currency of SUPPORTED_CURRENCIES) {
    if (!grouped[currency.region]) {
      grouped[currency.region] = [];
    }
    grouped[currency.region].push(currency);
  }
  return grouped;
}

export function formatDualCurrency(
  originalAmount: number,
  originalCurrency: CurrencyCode,
  convertedAmount: number,
  baseCurrency: CurrencyCode
): string {
  return `${formatCurrency(originalAmount, originalCurrency)} → ${formatCurrency(convertedAmount, baseCurrency)}`;
}

export function isValidCurrency(currency: string): currency is CurrencyCode {
  return SUPPORTED_CURRENCIES.some(c => c.code === currency);
}