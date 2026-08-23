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
import { VariantAssignment } from '@/components/variant-assignment'
import type { Variant } from '@/lib/ab-test'

/**
 * A landing inteira, com a copy do topo escolhida por `variante`.
 *
 * Vive aqui, e não em `app/page.tsx`, porque duas rotas a servem: `/` (a
 * página padrão) e `/lp/[slug]` (uma por página do registro). Duplicar a
 * lista de seções entre as duas garantiria que um dia elas divergissem — e
 * a paridade entre as páginas é o que torna a comparação honesta: só o topo
 * pode mudar.
 *
 * Ordem das seções conforme o documento mestre.
 */
export function LandingPage({ variante }: { variante: Variant }) {
  return (
    <>
      <StructuredData />
      <VariantAssignment variante={variante} />
      <EngagementTracking />
      <TestPriceNotice />
      <InstitutionalHeader />
      <main className="pb-20 md:pb-0">
        <HeroSection variant={variante} />
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
