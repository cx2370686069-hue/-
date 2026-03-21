export function isValidPhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone)
}

export function isValidPassword(pwd) {
  return typeof pwd === 'string' && pwd.length >= 6
}

export function isNotEmpty(str) {
  return typeof str === 'string' && str.trim().length > 0
}
