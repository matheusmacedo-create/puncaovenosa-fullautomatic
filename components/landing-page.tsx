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
import { EngagementTracking } from '@/components/engagement-tracking'
import { StructuredData } from '@/components/structured-data'
import { TestPriceNotice } from '@/components/test-price-notice'
import { RegistroDeVisita } from '@/components/registro-de-visita'

/**
 * A landing inteira.
 *
 * Continua num componente próprio, e não dentro de `app/page.tsx`, para que
 * a página do App Router siga sendo só o ponto de entrada — metadata e
 * roteamento de um lado, conteúdo do outro.
 *
 * Ordem das seções conforme o documento mestre.
 */
export function LandingPage() {
  return (
    <>
      <StructuredData />
      <RegistroDeVisita />
      <EngagementTracking />
      <TestPriceNotice />
      <InstitutionalHeader />
      <main className="pb-20 md:pb-0">
        <HeroSection />
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
