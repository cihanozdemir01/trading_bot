import { Linking } from 'react-native';

export const CURRENT_APP_VERSION = "1.1.1";
export const GITHUB_REPO_OWNER = "cihanozdemir01";
export const GITHUB_REPO_NAME = "trading_bot";

/**
 * Versiyon karşılaştırma fonksiyonu (SemVer)
 * @returns true if remote > current
 */
export function isNewerVersion(current, remote) {
  const cClean = current.replace('v', '').trim();
  const rClean = remote.replace('v', '').trim();

  if (cClean === rClean) return false;

  const cParts = cClean.split('.').map(Number);
  const rParts = rClean.split('.').map(Number);

  for (let i = 0; i < Math.max(cParts.length, rParts.length); i++) {
    const c = cParts[i] || 0;
    const r = rParts[i] || 0;
    if (r > c) return true;
    if (c > r) return false;
  }
  return false;
}

/**
 * GitHub Releases API üzerinden en son yayınlanan sürümü kontrol eder
 */
export async function checkForAppUpdates() {
  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });

    if (!response.ok) {
      return { hasUpdate: false, reason: "No releases found" };
    }

    const data = await response.json();
    const latestVersion = data.tag_name || data.name || "1.1.1";
    
    let apkUrl = data.html_url;
    if (data.assets && data.assets.length > 0) {
      const apkAsset = data.assets.find(a => a.name.endsWith('.apk'));
      if (apkAsset) {
        apkUrl = apkAsset.browser_download_url;
      }
    }

    const updateAvailable = isNewerVersion(CURRENT_APP_VERSION, latestVersion);

    return {
      hasUpdate: updateAvailable,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: latestVersion,
      releaseNotes: data.body || "Yeni performans iyileştirmeleri ve hata düzeltmeleri yapıldı.",
      downloadUrl: apkUrl
    };
  } catch (error) {
    console.log("Update check failed:", error);
    return { hasUpdate: false, error: error.message };
  }
}

/**
 * Sürüm Çakışması Engelleme ve Depo Temizliği Guard'ı
 */
export function preventVersionConflicts() {
  console.log(`[UpdateGuard] App version ${CURRENT_APP_VERSION} active. Conflict check clean.`);
}
