export interface CoverAccent {
  rgb: string;
  surfaceGradient: string;
  rowGradient: string;
}

const SAMPLE_SIZE = 32;
const MIN_ALPHA = 32;

function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

export function coverAccentFromRgb(red: number, green: number, blue: number): CoverAccent {
  const rgb = `${clampChannel(red)} ${clampChannel(green)} ${clampChannel(blue)}`;

  return {
    rgb,
    surfaceGradient: `linear-gradient(135deg, rgb(${rgb} / 28%), rgb(${rgb} / 10%) 42%, transparent 72%)`,
    rowGradient: `linear-gradient(90deg, rgb(${rgb} / 26%), rgb(${rgb} / 10%) 46%, transparent 100%)`,
  };
}

function imageFromSource(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('cover-not-readable'));
    image.src = source;
  });
}

export async function dominantCoverAccent(source: string): Promise<CoverAccent | null> {
  if (typeof document === 'undefined') {
    return null;
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (context === null) {
    return null;
  }

  try {
    const image = await imageFromSource(source);
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

    const { data } = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    let red = 0;
    let green = 0;
    let blue = 0;
    let samples = 0;

    for (let index = 0; index < data.length; index += 4) {
      if ((data[index + 3] ?? 0) < MIN_ALPHA) {
        continue;
      }

      red += data[index] ?? 0;
      green += data[index + 1] ?? 0;
      blue += data[index + 2] ?? 0;
      samples += 1;
    }

    return samples === 0 ? null : coverAccentFromRgb(red / samples, green / samples, blue / samples);
  } catch {
    return null;
  }
}
