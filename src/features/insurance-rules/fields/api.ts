/**
 * The Fields screen's own doors (BackOffice spec 3126; door 3132, oms ticket 610). Adding and retiring a field
 * need the master-data grant; there is no probe until 618, so a bare 403 on either is said in words. The read
 * (`GET InsuranceRules/Fields`) is `@/core/insurance-rules/registry-api`, which the guard palette shares.
 *
 * Reconciled with 3132 as built in oms 618: Add answers the field, Retire the retired field (409 `INSFIELDS_EXISTS`, 404
 * `INSFIELDS_NOT_FOUND`; master data `BackOfficeScreen[InsuranceRuleAuthoring, 01]`).
 */
import { api } from '@/core/api'
import { INSURANCE_RULES_BASE } from '@/core/insurance-rules/api'
import type { NewRegistryField, RegistryField } from '@/core/insurance-rules/registry'
import { FIELDS_KEY } from '@/core/insurance-rules/registry-api'
import { refParts, treeClickOf, treeNodeOf, type BundleTree, type TreeClickDoorReply, type TreeClickReply, type TreeDoorNode, type TreeSample } from './bundle-tree'
import { proposalOf, type FieldProposal, type FieldProposalsReply, type ProposalDoorRow } from './field-proposal'
import { compileVerdictOf, probeReplyOf, scopeOf, type CompileDoorReply, type CompileInput, type CompileVerdict, type FieldProposalBody, type ProbeDoorReply, type ProbeReply } from './raw-path'

/** The kept copy a ref names; a ref that names none is said, never sent. */
function keptCopy(ref: string): { kind: string; keptId: string } {
  const parts = refParts(ref)
  if (!parts) throw new Error('Choose a kept bundle from the list.')
  return parts
}

/** Under `FIELDS_KEY`, so a proposal's arrival refreshes whatever reads the fields; 696's inbox reads it. */
export const FIELD_PROPOSALS_KEY = [...FIELDS_KEY, 'proposals'] as const

export const fieldsApi = {
  /** ⚠️ PROVISIONAL (oms 695; 711 reconciles): `POST InsuranceRules/Fields/Compile` — syntax, the refused functions, the type, the extension URLs, the case-only code. */
  async compile(input: CompileInput): Promise<CompileVerdict> {
    return compileVerdictOf(await api.post<CompileDoorReply | null>(`${INSURANCE_RULES_BASE}/Fields/Compile`, { fhirPath: input.path }))
  },
  /** ⚠️ PROVISIONAL (oms 695): `POST InsuranceRules/Fields/Probe` — the path over the kept bundles and samples, per payer. */
  async probe(input: CompileInput): Promise<ProbeReply> {
    return probeReplyOf(
      await api.post<ProbeDoorReply | null>(`${INSURANCE_RULES_BASE}/Fields/Probe`, { scope: scopeOf(input), type: input.type, cardinality: input.cardinality, system: input.system, fhirPath: input.path }),
    )
  },
  /** ⚠️ PROVISIONAL (oms 695): `POST InsuranceRules/Fields/Proposals` — the row joins the inbox; the catalog only once someone else approves it. */
  propose(body: FieldProposalBody): Promise<unknown> {
    const { moment, level, ...rest } = body
    return api.post<unknown>(`${INSURANCE_RULES_BASE}/Fields/Proposals`, { ...rest, scope: scopeOf({ moment, level }) })
  },
  /** `GET InsuranceRules/Fields/Tree/Samples` — the newest kept copies, no content. */
  async treeSamples(): Promise<TreeSample[]> {
    return (await api.get<TreeSample[] | null>(`${INSURANCE_RULES_BASE}/Fields/Tree/Samples`)) ?? []
  },
  /** `POST InsuranceRules/Fields/Tree/Open` — a kept bundle as a tree, under the read grant; the door logs the read. */
  async tree(ref: string): Promise<BundleTree> {
    return { ref, root: treeNodeOf(await api.post<TreeDoorNode>(`${INSURANCE_RULES_BASE}/Fields/Tree/Open`, keptCopy(ref))) }
  },
  /** `POST InsuranceRules/Fields/Tree/Click` — a clicked node to its proposed path, the field already on it, and the Patient warning. */
  async treeClick(ref: string, nodeRef: string): Promise<TreeClickReply> {
    return treeClickOf(await api.post<TreeClickDoorReply>(`${INSURANCE_RULES_BASE}/Fields/Tree/Click`, { ...keptCopy(ref), node: nodeRef }))
  },
  /** ⚠️ PROVISIONAL (oms 696): `GET InsuranceRules/Fields/Proposals`. With no `viewer`, both roles stand and HQ refuses (the approval.ts precedent). */
  async proposals(): Promise<FieldProposalsReply> {
    const rows = await api.get<ProposalDoorRow[] | null>(`${INSURANCE_RULES_BASE}/Fields/Proposals`)
    return { proposals: (rows ?? []).map(proposalOf), viewer: { approver: true } }
  },
  /** ⚠️ PROVISIONAL (oms 696): `POST …/Proposals/{id}/Approve` — the row joins the catalog. HQ refuses an own approval. */
  approve(id: string): Promise<FieldProposal> {
    return api.post<ProposalDoorRow>(`${INSURANCE_RULES_BASE}/Fields/Proposals/${encodeURIComponent(id)}/Approve`, {}).then(proposalOf)
  },
  /** ⚠️ PROVISIONAL (oms 696): `POST …/Proposals/{id}/Reject` with its reason. */
  reject(id: string, body: { reason: string }): Promise<FieldProposal> {
    return api.post<ProposalDoorRow>(`${INSURANCE_RULES_BASE}/Fields/Proposals/${encodeURIComponent(id)}/Reject`, { note: body.reason }).then(proposalOf)
  },
  /** `POST InsuranceRules/Fields` → the field added. A key in use is refused. */
  add(body: NewRegistryField): Promise<RegistryField> {
    return api.post<RegistryField>(`${INSURANCE_RULES_BASE}/Fields`, body)
  },
  /** `POST InsuranceRules/Fields/{key}/Retire` — never a delete: rules that name it keep reading it. */
  retire(key: string): Promise<unknown> {
    return api.post<unknown>(`${INSURANCE_RULES_BASE}/Fields/${encodeURIComponent(key)}/Retire`, {})
  },
}
