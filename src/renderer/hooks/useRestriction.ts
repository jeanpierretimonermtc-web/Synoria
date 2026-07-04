import { useContext } from 'react'
import { RestrictionContext } from '../App'
import type { RestrictionState } from '../../shared/types'

export function useRestriction(): RestrictionState {
  return useContext(RestrictionContext)
}
