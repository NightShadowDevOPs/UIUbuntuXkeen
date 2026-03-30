const getLatencyFromUrlAPI = (url: string) => {
  return new Promise<number>((resolve) => {
    const startTime = performance.now()
    const img = document.createElement('img')
    img.src = url + (url.includes('?') ? '&' : '?') + '_=' + new Date().getTime()
    img.style.display = 'none'
    img.onload = () => {
      const endTime = performance.now()
      img.remove()
      resolve(endTime - startTime)
    }
    img.onerror = () => {
      img.remove()
      resolve(0)
    }

    document.body.appendChild(img)
  })
}

const normalizeTargetToUrl = (target: string) => {
  const raw = (target || '').trim()
  if (!raw) return ''

  // If user already provided a full URL, keep it.
  if (/^https?:\/\//i.test(raw)) {
    // If it ends with '/', try favicon.
    return raw.endsWith('/') ? raw + 'favicon.ico' : raw
  }

  // domain / ip
  const base = `https://${raw}`
  return base.endsWith('/') ? base + 'favicon.ico' : base + '/favicon.ico'
}

export const getLatencyFromTargetAPI = (target: string) => {
  const url = normalizeTargetToUrl(target)
  if (!url) return Promise.resolve(0)
  return getLatencyFromUrlAPI(url)
}

export const getCloudflareLatencyAPI = () => {
  return getLatencyFromUrlAPI('https://www.cloudflare.com/favicon.ico')
}

export const getYouTubeLatencyAPI = () => {
  return getLatencyFromUrlAPI('https://yt3.ggpht.com/favicon.ico')
}

export const getGithubLatencyAPI = () => {
  return getLatencyFromUrlAPI('https://github.githubassets.com/favicon.ico')
}

export const getBaiduLatencyAPI = () => {
  return getLatencyFromUrlAPI('https://apps.bdimg.com/favicon.ico')
}

export const getYandexLatencyAPI = () => {
  return getLatencyFromUrlAPI('https://yandex.ru/favicon.ico')
}

export const get2ipLatencyAPI = () => {
  return getLatencyFromUrlAPI('https://2ip.ru/favicon.ico')
}
