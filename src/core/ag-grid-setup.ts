import { AllCommunityModule, ModuleRegistry, ValidationModule } from 'ag-grid-community'

// Side-effect import from the screen chunks that host a grid: registers the AG
// Grid Community modules once. Enterprise (Excel export, set filters) is budgeted
// but not licensed — baseline 404 §3; the xlsx export is built client-side instead.
ModuleRegistry.registerModules([
  AllCommunityModule,
  ...(import.meta.env.DEV ? [ValidationModule] : []),
])
