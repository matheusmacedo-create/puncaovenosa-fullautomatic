import { notFound } from 'next/navigation'
import { TriageFlow } from '@/components/triage-flow'

export default async function TriagePage({ params }: { params: Promise<{ step: string }> }) {
  const { step: rawStep } = await params
  const step = Number(rawStep)
  if (!Number.isInteger(step) || step < 1 || step > 8) notFound()
  return <TriageFlow step={step} />
}
