import { get } from '@/utils/request.js'

export function getTownServiceAreas() {
  return get('/common/service-areas', { area_type: 'town' })
}
