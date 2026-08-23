import { InstitutionalHeader } from '@/components/institutional-header'
import { HeroSection } from '@/components/hero-section'
import { CourseFacts } from '@/components/course-facts'
import { ValueProposition } from '@/components/value-proposition'
import { PainSection } from '@/components/pain-section'
import { SolutionSection } from '@/components/solution-section'
import { BenefitsGrid } from '@/components/benefits-grid'
import { AppliedContentSection } from '@/components/applied-content-section'
import { ClassFormationSection } from '@/components/class-formation-section'
import { OfferCard } from '@/components/offer-card'
import { AudienceSection } from '@/components/audience-section'
import { FAQSection } from '@/components/faq-section'
import { LocationSection } from '@/components/location-section'
import { FinalCTA } from '@/components/final-cta'
import { MobileStickyCTA } from '@/components/mobile-sticky-cta'
import { InstitutionalFooter } from '@/components/institutional-footer'
import { DevelopmentChecklist } from '@/components/development-checklist'
import { StructuredData } from '@/components/structured-data'
import { TestPriceNotice } from '@/components/test-price-notice'
import { VariantAssignment } from '@/components/variant-assignment'
import { resolveVariant } from '@/lib/ab-test'

/**
 * Ordem das seções conforme o documento mestre. Apenas a copy do hero
 * muda entre as variantes A e B: todo o restante tem paridade total.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string | string[] }>
}) {
  const { variant } = await searchParams
  const requested = resolveVariant(variant)

  return (
    <>
      <StructuredData />
      <VariantAssignment requested={requested} />
      <TestPriceNotice />
      <InstitutionalHeader />
      <main className="pb-20 md:pb-0">
        <HeroSection variant={requested ?? 'a'} />
        <CourseFacts />
        <ValueProposition />
        <PainSection />
        <SolutionSection />
        <BenefitsGrid />
        <AppliedContentSection />
        <ClassFormationSection />
        <OfferCard />
        <AudienceSection />
        <FAQSection />
        <LocationSection />
        <FinalCTA />
      </main>
      <InstitutionalFooter />
      <DevelopmentChecklist />
      <MobileStickyCTA />
    </>
  )
}
