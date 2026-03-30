import { i18n } from '@/i18n'
import { type Ref } from 'vue'

const t = i18n.global.t
const alertMap = new Map<
  string,
  {
    timer: number
    alert: HTMLElement
  }
>()
let toastRef: Ref<HTMLElement> | null = null

export const initNotification = (toast: Ref<HTMLElement>) => {
  toastRef = toast
}

const setTimer = (alert: HTMLElement, timeout: number, alertKey?: string) => {
  let timer = -1

  if (timeout !== 0) {
    timer = setTimeout(() => {
      if (alertKey) {
        alertMap.delete(alertKey)
      }
      alert.remove()
    }, timeout)
  }

  if (alertKey) {
    alertMap.set(alertKey, { alert, timer })
  }
}

const closeAlert = (alert: HTMLElement, alertKey?: string) => {
  if (alertKey) {
    const alertData = alertMap.get(alertKey)
    if (alertData) {
      clearTimeout(alertData.timer)
      alertMap.delete(alertKey)
    }
  }
  alert.remove()
}

const setAlert = (
  alert: HTMLElement,
  content: string,
  params: Record<string, string>,
  type: string,
  alertKey?: string,
) => {
  alert.className = `alert flex p-2 pr-5 break-all whitespace-normal relative ${type}`

  const contentDiv = document.createElement('div')
  contentDiv.className = 'flex-1'
  contentDiv.innerHTML = t(content, params)

  const closeButton = document.createElement('button')
  closeButton.className = 'absolute top-0 right-0 btn btn-xs btn-circle btn-ghost'
  closeButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3 h-3">
      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  `
  closeButton.addEventListener('click', () => closeAlert(alert, alertKey))

  alert.innerHTML = ''
  alert.appendChild(contentDiv)
  alert.appendChild(closeButton)
}

export const showNotification = ({
  content,
  params = {},
  key,
  type = 'alert-warning',
  timeout = 3000,
}: {
  content: string
  params?: Record<string, string>
  key?: string
  type?: 'alert-warning' | 'alert-success' | 'alert-error' | 'alert-info' | ''
  timeout?: number
}) => {
  const alertKey = key

  if (alertKey && alertMap.has(alertKey)) {
    const { alert, timer } = alertMap.get(alertKey)!
    clearTimeout(timer)

    setAlert(alert, content, params, type, alertKey)
    setTimer(alert, timeout, alertKey)
    return
  }

  const alert = document.createElement('div')

  setAlert(alert, content, params, type, alertKey)
  toastRef?.value?.insertBefore(alert, toastRef?.value?.firstChild)
  setTimer(alert, timeout, alertKey)
}
