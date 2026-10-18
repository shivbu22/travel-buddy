export const colors = {
  canvas: '#FFF7FF', ink: '#1E1A22', muted: '#6B5967', faint: '#9B8997', surface: '#FFFFFF', surfaceSoft: '#F7EFF8', line: '#E7DDE9',
  pink: '#E1037D', pinkDeep: '#B40063', pinkSoft: '#FFD9E3', lime: '#C7EF00', limeSoft: '#EAF7A8', violet: '#7F31C3', violetSoft: '#F1DBFF', aqua: '#00A8C7', danger: '#BA1A1A', dangerSoft: '#FFDAD6', success: '#397300', dark: '#332E38', white: '#FFFFFF',
};
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 40 };
export const radii = { sm: 10, md: 16, lg: 24, xl: 32, pill: 999 };
export const shadows = {
  soft: { shadowColor: '#332E38', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 22, elevation: 3 },
  lift: { shadowColor: '#B40063', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 18, elevation: 4 },
};
export const text = {
  large: { fontSize: 34, lineHeight: 40, fontWeight: '800' as const, letterSpacing: -1 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '800' as const },
  section: { fontSize: 21, lineHeight: 27, fontWeight: '800' as const },
  headline: { fontSize: 16, lineHeight: 22, fontWeight: '700' as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '500' as const },
  footnote: { fontSize: 12, lineHeight: 17, fontWeight: '500' as const },
  label: { fontSize: 10, lineHeight: 14, fontWeight: '800' as const, letterSpacing: 0.9 },
};
