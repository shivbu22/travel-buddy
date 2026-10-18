export type Page = 'welcome' | 'login' | 'otp' | 'onboarding' | 'trip' | 'home' | 'profile' | 'chat' | 'settings' | 'report' | 'policy' | 'verify' | 'paywall';
export type Tab = 'discover' | 'journal' | 'matches' | 'chat' | 'profile';
export type Go = (page: Page) => void;
