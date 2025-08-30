import React from 'react'
import { Loader2 } from 'lucide-react'
import { clsx } from 'clsx'

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large'
  className?: string
}

export function LoadingSpinner({ size = 'medium', className }: LoadingSpinnerProps) {
  return (
    <Loader2
      className={clsx(
        'animate-spin text-blue-600',
        {
          'w-4 h-4': size === 'small',
          'w-6 h-6': size === 'medium',
          'w-8 h-8': size === 'large',
        },
        className
      )}
    />
  )
}
