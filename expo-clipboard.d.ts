declare module 'expo-clipboard' {
  export function getStringAsync(): Promise<string>;
  export function setStringAsync(value: string): Promise<void>;
}