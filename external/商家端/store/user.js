import { defineStore } from 'pinia'
import { getToken, getUser, setToken, setUser, clearAuth } from '@/utils/auth.js'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: getToken(),
    userInfo: getUser()
  }),

  getters: {
    isLoggedIn: (state) => !!(state.token && state.userInfo),
    role: (state) => state.userInfo?.['角色'] || 'user',
    nickname: (state) => state.userInfo?.['昵称'] || ''
  },

  actions: {
    login(token, userInfo) {
      this.token = token
      this.userInfo = userInfo
      setToken(token)
      setUser(userInfo)
    },

    logout() {
      this.token = ''
      this.userInfo = null
      clearAuth()
    }
  }
})
