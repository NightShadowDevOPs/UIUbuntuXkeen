/// <reference types="vite/client" />

import 'axios'

declare module 'axios' {
  interface AxiosRequestConfig<D = any> {
    silent?: boolean
  }
}
