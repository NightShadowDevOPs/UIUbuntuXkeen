import { APP_DISPLAY_NAME } from '@/config/project'
import { ROUTE_NAME } from '@/constant'
import { renderRoutes } from '@/helper'
import { i18n } from '@/i18n'
import { language } from '@/store/settings'
import { activeBackend } from '@/store/setup'
import ConnectionsPage from '@/views/ConnectionsPage.vue'
import HomePage from '@/views/HomePage.vue'
import LogsPage from '@/views/LogsPage.vue'
import OverviewPage from '@/views/OverviewPage.vue'
import RouterPage from '@/views/RouterPage.vue'
import TasksPage from '@/views/TasksPage.vue'
import PoliciesPage from '@/views/PoliciesPage.vue'
import ProxiesRoutePage from '@/views/ProxiesRoutePage.vue'
import ProxyProvidersRoutePage from '@/views/ProxyProvidersRoutePage.vue'
import SubscriptionsPage from '@/views/SubscriptionsPage.vue'
import TrafficPage from '@/views/TrafficPage.vue'
import RulesPage from '@/views/RulesPage.vue'
import MihomoPage from '@/views/MihomoPage.vue'
import SettingsPage from '@/views/SettingsPage.vue'
import UsersPage from '@/views/UsersPage.vue'
import XuiHostsPage from '@/views/XuiHostsPage.vue'
import SetupPage from '@/views/SetupPage.vue'
import { useTitle } from '@vueuse/core'
import { watch } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'

const childrenRouter = [
  {
    path: 'proxies',
    name: ROUTE_NAME.proxies,
    component: ProxiesRoutePage,
  },
  {
    path: 'proxy-providers',
    name: ROUTE_NAME.proxyProviders,
    component: ProxyProvidersRoutePage,
  },
  {
    path: 'subscriptions',
    name: ROUTE_NAME.subscriptions,
    component: SubscriptionsPage,
  },
  {
    path: 'overview',
    name: ROUTE_NAME.overview,
    component: OverviewPage,
  },
  {
    path: 'traffic',
    name: ROUTE_NAME.traffic,
    component: TrafficPage,
  },
  {
    path: 'router',
    name: ROUTE_NAME.router,
    component: RouterPage,
  },
  {
    path: 'tasks',
    name: ROUTE_NAME.tasks,
    component: TasksPage,
  },
  {
    path: 'connections',
    name: ROUTE_NAME.connections,
    component: ConnectionsPage,
  },
  {
    path: 'logs',
    name: ROUTE_NAME.logs,
    component: LogsPage,
  },
  {
    path: 'rules',
    name: ROUTE_NAME.rules,
    component: RulesPage,
  },
  {
    path: 'users',
    name: ROUTE_NAME.users,
    component: UsersPage,
  },
  {
    path: 'xui-hosts',
    name: ROUTE_NAME.xuiHosts,
    component: XuiHostsPage,
  },
  {
    path: 'policies',
    name: ROUTE_NAME.policies,
    component: PoliciesPage,
  },
  {
    path: 'mihomo',
    name: ROUTE_NAME.mihomo,
    component: MihomoPage,
  },
  {
    path: 'settings',
    name: ROUTE_NAME.settings,
    component: SettingsPage,
  },
]

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: ROUTE_NAME.proxies,
      component: HomePage,
      children: childrenRouter,
    },
    {
      path: '/setup',
      name: ROUTE_NAME.setup,
      component: SetupPage,
    },
    {
      path: '/:catchAll(.*)',
      redirect: ROUTE_NAME.proxies,
    },
  ],
})

const title = useTitle(APP_DISPLAY_NAME)
const setTitleByName = (name: string | symbol | undefined) => {
  if (typeof name === 'string' && activeBackend.value) {
    title.value = `${APP_DISPLAY_NAME} | ${i18n.global.t(name)}`
  } else {
    title.value = APP_DISPLAY_NAME
  }
}

router.beforeEach((to, from) => {
  const toIndex = renderRoutes.value.findIndex((item) => item === to.name)
  const fromIndex = renderRoutes.value.findIndex((item) => item === from.name)

  if (toIndex === 0 && fromIndex === renderRoutes.value.length - 1) {
    to.meta.transition = 'slide-left'
  } else if (toIndex === renderRoutes.value.length - 1 && fromIndex === 0) {
    to.meta.transition = 'slide-right'
  } else if (toIndex !== fromIndex) {
    to.meta.transition = toIndex < fromIndex ? 'slide-right' : 'slide-left'
  }

  if (!activeBackend.value && to.name !== ROUTE_NAME.setup) {
    router.push({ name: ROUTE_NAME.setup })
  }
})

router.afterEach((to) => {
  setTitleByName(to.name)
})

watch(language, () => {
  setTitleByName(router.currentRoute.value.name)
})

export default router
