export type SocialPostAggregateStatus = 'Publishing' | 'Published' | 'PartiallyFailed' | 'Failed'

export function aggregateSocialPostStatus(state: {
  published: number
  failed: number
  pending: number
}): SocialPostAggregateStatus {
  if (state.pending > 0) return 'Publishing'
  if (state.failed === 0) return 'Published'
  return state.published > 0 ? 'PartiallyFailed' : 'Failed'
}
