/** The explanation's route for one order (ticket 738). Pure. */
export const explainPath = (orderNo: string): string => `/oms/sourcing-advisor/order/${encodeURIComponent(orderNo.trim())}`
