'use client'

import { cn } from "../../lib/utils"
import { Check, Circle } from 'lucide-react'

interface StepperProps {
  steps: string[]
  currentStep: string
}

export function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <div className="flex items-center justify-between">
      {steps.map((step, index) => {
        const isActive = steps.indexOf(currentStep) === index
        const isCompleted = steps.indexOf(currentStep) > index

        return (
          <div key={step} className="flex flex-col items-center flex-1">
            <div className="flex items-center w-full">
              <div className="relative flex items-center justify-center">
                <div
                  className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center transition-all duration-200",
                    {
                      "bg-primary text-white": isActive,
                      "bg-green-500 text-white": isCompleted,
                      "bg-gray-100 text-gray-500": !isActive && !isCompleted
                    }
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                  )}
                </div>
                {isActive && (
                  <div className="absolute -top-1 -right-1 h-3 w-3">
                    <Circle className="h-3 w-3 text-primary animate-pulse" fill="currentColor" />
                  </div>
                )}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "h-1 w-full mx-2 transition-colors duration-200",
                    {
                      "bg-primary": isCompleted,
                      "bg-gray-100": !isCompleted
                    }
                  )}
                />
              )}
            </div>
            <span 
              className={cn(
                "mt-2 text-sm transition-colors duration-200",
                {
                  "text-primary font-semibold": isActive,
                  "text-green-500 font-medium": isCompleted,
                  "text-gray-500": !isActive && !isCompleted
                }
              )}
            >
              {step}
            </span>
          </div>
        )
      })}
    </div>
  )
} 