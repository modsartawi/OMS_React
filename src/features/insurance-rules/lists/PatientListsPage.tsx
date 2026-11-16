import { useTranslation } from 'react-i18next'
import KeyedLists from './KeyedLists'

/**
 * Insurance rules ▸ Patient lists — `/insurance-rules/patient-lists` (BackOffice spec 3972, ticket 3982). BR-7's blocked
 * patients, BR-4's patient and any other patient list, under the insurance managers' own grant
 * (`InsurancePatientBlock`, probe flag `canPatientLists`): a rule author never reads a national id. Each entry carries
 * the kind of finding, the reporting payer, a reference and its start and end days; a change takes effect at the next
 * check, with no approval, and is logged. A session without the grant gets the doors' bare 403 as "no access".
 */
export default function PatientListsPage() {
  const { t } = useTranslation('insurance-lists')
  return (
    <section className="flex w-full flex-col gap-4" data-patient-lists-page="">
      <header className="max-w-3xl">
        <h1 className="text-lg font-semibold tracking-tight">{t('patientPage.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('patientPage.lede')}</p>
      </header>
      <KeyedLists kind="patient" />
    </section>
  )
}
