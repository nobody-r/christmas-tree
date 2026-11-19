export const PARTICLE_COUNT = 6000;
export const PARTICLE_SIZE = 0.06;
export const TREE_HEIGHT = 15;
export const TREE_RADIUS_BASE = 6;
export const CAMERA_FOV = 45;

export const COLOR_PALETTE = {
  primary: '#ffd98a',   // 暖金光
  secondary: '#ff5964', // 圣诞红
  accent: '#fff7e6',    // 奶白高光
  ice: '#9fd8ff',       // 冰蓝微光
  bg: '#070b18'         // 午夜深蓝
};

// Helper to generate data URI - ensures no network errors for default images
const generatePlaceholder = (text: string, bg: string, color: string) => {
  const svg = `
  <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="${bg}" opacity="0.85"/>
    <rect width="100%" height="100%" fill="none" stroke="${color}" stroke-width="8" stroke-opacity="0.6"/>
    <circle cx="200" cy="200" r="60" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="6,6">
      <animateTransform attributeName="transform" type="rotate" from="0 200 200" to="360 200 200" dur="12s" repeatCount="indefinite"/>
    </circle>
    <text x="50%" y="50%" font-family="serif" font-size="26" fill="${color}" font-weight="bold" dominant-baseline="middle" text-anchor="middle">${text}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

export const GALLERY_IMAGES = [
  generatePlaceholder('CHRISTMAS 01', '#141a30', '#ffd98a'),
  generatePlaceholder('CHRISTMAS 02', '#2a1218', '#ff5964'),
  generatePlaceholder('CHRISTMAS 03', '#141a30', '#9fd8ff'),
  generatePlaceholder('CHRISTMAS 04', '#12251c', '#7ee0a3'),
  generatePlaceholder('CHRISTMAS 05', '#141a30', '#ffd98a'),
  generatePlaceholder('CHRISTMAS 06', '#2a1218', '#ff5964'),
  generatePlaceholder('CHRISTMAS 07', '#141a30', '#9fd8ff'),
  generatePlaceholder('CHRISTMAS 08', '#12251c', '#7ee0a3'),
];
