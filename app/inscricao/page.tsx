import { Suspense } from 'react'
import { EnrollmentFlow } from '@/components/enrollment-flow'

export default function Page() {
  return <Suspense fallback={<main className="launcher" />}><EnrollmentFlow /></Suspense>
}
