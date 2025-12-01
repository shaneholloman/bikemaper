// Generate a monochrome gray color from an ID (using a hash function)
export function getColorFromId(id: string | number): string {
  // Convert ID to string and hash it
  const str = String(id);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Generate grayscale values (120-200 for subtle variation)
  const gray = 120 + (Math.abs(hash) % 80);
  return `rgb(${gray}, ${gray}, ${gray})`;
}

