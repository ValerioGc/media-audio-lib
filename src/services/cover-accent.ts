export interface CoverAccent {
  rgb: string;
  surfaceGradient: string;
  rowGradient: string;
}

const SAMPLE_SIZE = 32;
const MIN_ALPHA = 32;
const MAX_GRADIENT_ALPHA = 92;

function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function gradientAlpha(base: number, intensity: number): number {
  return Math.min(MAX_GRADIENT_ALPHA, Math.max(0, Math.round((base * intensity) / 100)));
}

function liftDarkColor(red: number, green: number, blue: number): [number, number, number] {
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

  if (luminance >= 104) {
    return [red, green, blue];
  }

  const lift = 104 - luminance;

  return [red + lift * 0.7, green + lift * 0.7, blue + lift * 0.9];
}

export function coverAccentFromRgb(
  red: number,
  green: number,
  blue: number,
  intensity = 100,
): CoverAccent {
  const [visibleRed, visibleGreen, visibleBlue] = liftDarkColor(red, green, blue);
  const rgb = `${clampChannel(visibleRed)} ${clampChannel(visibleGreen)} ${clampChannel(visibleBlue)}`;
  const surfaceStrong = gradientAlpha(58, intensity);
  const surfaceMid = gradientAlpha(32, intensity);
  const surfaceLinear = gradientAlpha(42, intensity);
  const surfaceLinearSoft = gradientAlpha(18, intensity);
  const rowStrong = gradientAlpha(44, intensity);
  const rowSoft = gradientAlpha(24, intensity);

  return {
    rgb,
    surfaceGradient: `radial-gradient(circle at 12% 18%, rgb(${rgb} / ${surfaceStrong}%), rgb(${rgb} / ${surfaceMid}%) 34%, transparent 68%), linear-gradient(135deg, rgb(${rgb} / ${surfaceLinear}%), rgb(${rgb} / ${surfaceLinearSoft}%) 54%, transparent 88%)`,
    rowGradient: `linear-gradient(90deg, rgb(${rgb} / ${rowStrong}%), rgb(${rgb} / ${rowSoft}%) 48%, transparent 100%)`,
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

export async function dominantCoverAccent(
  source: string,
  intensity = 100,
): Promise<CoverAccent | null> {
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

    return samples === 0
      ? null
      : coverAccentFromRgb(red / samples, green / samples, blue / samples, intensity);
  } catch {
    return null;
  }
}
