/**
 * iPhone/iPad start-up screens for the home-screen app. iOS ignores the web
 * manifest splash: it shows the image whose media query matches the device
 * exactly, otherwise a blank screen. Sizes are CSS points × pixel ratio.
 * Images are produced by `node scripts/generate-pwa-assets.mjs`.
 */
export interface SplashDevice {
  width: number
  height: number
  ratio: number
}

export const SPLASH_DEVICES: SplashDevice[] = [
  { width: 440, height: 956, ratio: 3 }, // iPhone 16/17 Pro Max
  { width: 402, height: 874, ratio: 3 }, // iPhone 16/17 Pro, 17
  { width: 420, height: 912, ratio: 3 }, // iPhone Air
  { width: 430, height: 932, ratio: 3 }, // iPhone 14 Pro Max, 15/16 Plus
  { width: 393, height: 852, ratio: 3 }, // iPhone 14 Pro, 15, 16
  { width: 428, height: 926, ratio: 3 }, // iPhone 12/13 Pro Max, 14 Plus
  { width: 390, height: 844, ratio: 3 }, // iPhone 12/13/14
  { width: 375, height: 812, ratio: 3 }, // iPhone X/XS/11 Pro, 12/13 mini
  { width: 414, height: 896, ratio: 3 }, // iPhone XS Max, 11 Pro Max
  { width: 414, height: 896, ratio: 2 }, // iPhone XR, 11
  { width: 414, height: 736, ratio: 3 }, // iPhone 6-8 Plus
  { width: 375, height: 667, ratio: 2 }, // iPhone SE 2/3, 6-8
  { width: 320, height: 568, ratio: 2 }, // iPhone SE 1
  { width: 1024, height: 1366, ratio: 2 }, // iPad Pro 12.9"
  { width: 834, height: 1194, ratio: 2 }, // iPad Pro 11"
  { width: 820, height: 1180, ratio: 2 }, // iPad Air
  { width: 768, height: 1024, ratio: 2 } // iPad
]

export function splashFileName(device: SplashDevice, orientation: 'portrait' | 'landscape') {
  const w = device.width * device.ratio
  const h = device.height * device.ratio
  return orientation === 'portrait' ? `splash-${w}x${h}.png` : `splash-${h}x${w}.png`
}

export function splashLinks() {
  return SPLASH_DEVICES.flatMap(device => (['portrait', 'landscape'] as const).map(orientation => ({
    rel: 'apple-touch-startup-image' as const,
    href: `/pwa/${splashFileName(device, orientation)}`,
    media: `(device-width: ${device.width}px) and (device-height: ${device.height}px) and (-webkit-device-pixel-ratio: ${device.ratio}) and (orientation: ${orientation})`
  })))
}
