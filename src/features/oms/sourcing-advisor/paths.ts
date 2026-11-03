/** The explanation's route for one order (ticket 738). Pure. */
export const explainPath = (orderNo: string): string => `/oms/sourcing-advisor/order/${encodeURIComponent(orderNo.trim())}`

/** The advisor itself: the 30-day simulation and the lookup by order number. */
export const ADVISOR_PATH = '/oms/sourcing-advisor'
